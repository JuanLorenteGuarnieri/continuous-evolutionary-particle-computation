# Phase 20 — hiding the await latency: lagged metrics, quiet-step fast paths, latency probe, optimistic pipelining, `blocked` default

Status: **implemented and validated on the software WebGPU device + Node; NOT yet measured on hardware.** Nothing here claims a speed-up.
Legend: **[source]** verified in code, **[phase19]** measured in the Phase 19 data (Intel HD Graphics 520), **[node]** CPU micro-benchmark in Node,
**[hypothesis]**, **[pending]** needs the hardware run (`tools/bench/run-phase20-ab.ps1`).

Motivation **[phase19]**: every awaited `mapAsync` costs ~2.7-3.5 ms regardless of N or bytes; two per frame (the 12-byte step summary and the metrics
readback) are 86 % of the cycle at N=200 and 52 % at N=10000; GPU compute is 7-19 %. The five items below attack that, in order of risk.

## 20.1 `deathCompaction: 'blocked'` is the default (item 5)

`DEFAULT_KERNEL_OPTIONS.deathCompaction = 'blocked'` (Phase 19 evidence: pass x0.89..x0.18, 5/5 paired wins, self-test passed). Same labels/bindings/dispatch as
`parallel`, so the Phase 15 golden traces are unchanged (orchestration suite 19/19). `serial` and `parallel` remain selectable.

## 20.2 Await-latency probe (item 3) — `await-latency.ts`, `--await-latency`

Measures, with no CEPC code, on the real device: `onSubmittedWorkDone`, copy+`mapAsync` (the exact CEPC staging pattern), compute(work)+copy+`mapAsync`, and the steady-state
ms per step when 1, 2, 3 or 4 submissions are kept in flight (`pipelinedPerStep`). **This decides whether pipelining can work:** if depth 2 is ~half of depth 1 the latency
overlaps; if it is ~equal the cost is a serialization and pipelining will not help. Run by `run-phase20-ab.ps1` first; result in `performance/phase20/await-latency.json`.

## 20.3 Quiet-step fast path (item 2) — `OrchestrationOptions.quietFastPath` (default on)

**[source]** On a quiet step only `snapshot.length` and the input slot are used. Changes in `prepareEncodedStep`/`finishNormalSync`:

- the O(N) `Snapshot` is a memoized thunk built only by non-quiet steps (`getSnapshot()`); the length is `population.particles.size` when every particle has a genome (else the old path);
- the input slot is found by an early-exit scan (same skipping rule as `takeSnapshot`);
- `previousIncomingCharges/Senders` reference the incoming maps instead of copying them. Audit: every write to `incomingChargeMap`/`incomingSendersMap` is a whole-map assignment
  (`this.incoming*Map = ...`), the Sets inside are never mutated after construction, and the non-quiet path copies on use (`new Set(...)`).
**Topology epoch**: `getTopologyEpoch()` increases whenever the stepper's population metadata can change (a non-quiet step, `setState`, `refreshCpuSlotMapping`). The worker's new
`'epoch'` merge mode (`EpochTopologyMerger`, default) skips the merge while epoch, source object and view object are exactly those of the last merge.
Validation: `phase20-fast-paths.test.ts` — identical GPU/CPU digests with the fast path on/off in all 9 scenarios; `takeSnapshot` is called 0 times in a steady scenario (N times with the fast path off,
exactly once in the single-death scenario); `epoch-merge.test.ts` — differential vs the reference rebuild over 4 seeds x 150 randomized steps (skips only quiet steps, never a foreign view/source, `previous === next` handled).
`stepperCpu` in the benchmark JSON was empty because the worker never called `commitProfilingStep()`; the benchmark loop now does, so `encode.*`/`prepare.*`/counters appear.

## 20.4 Lagged, non-blocking metrics (item 1) — `pollPopulationMetrics()`, `metricsMode` (default `lagged`)

**[phase19]** the metrics cost is the awaited round trip (3.4 ms at N=200, 3.5 ms at N=10000), not the bytes; so GPU-side reduction would not help. Implementation: two 8 B/particle staging slots; each frame
`pollPopulationMetrics()` returns the newest completed sample and issues a new copy+`mapAsync` for the committed state **without awaiting** (the callback computes the exact same sums as `readPopulationMetrics`).
Samples carry the `timestep` they describe; the app posts that timestep (the first frame posts no metrics). Input/output slots are captured at request time (`ioSlots`, replaced on every slot-mapping refresh) so
restructuring between request and harvest cannot change the result. If both slots are busy the frame skips a request. Buffers destroyed meanwhile only drop the sample.
Validation: for 4 scenarios (steady, deaths+births, churn, buffer-shape change) every lagged sample equals a blocking read taken at the committed step it is tagged with, and more than half of the frames deliver a sample.
Behavioural change (visible in the UI): metrics are one frame stale; select `metricsMode: 'blocking'` (benchmark option) for the old behaviour.

## 20.5 Optimistic pipelining (item 4) — `OrchestrationOptions.pipelineDepth = 2` (**opt-in, default 1**)

`step()` keeps two steps in flight: step n+1 is submitted before the summary of step n arrives. **Design (also documented at `MfmWebGPUStepper.pipe`):**

1. A quiet step's CPU commit changes no data, only ping-pong indices and the timestep, which the next step anticipates (`ahead`: indices flipped `ahead` times, `params.timestep = committed + ahead`).
2. A non-quiet step must be handled by the CPU before anything else runs. The speculative step behind it is made harmless **on the GPU**: new Params member `halted` (offset 108, last member; the uniform block is 112 B);
   **all 20 kernels start with `if (params.halted != 0u) { return; }`** (uniform control flow, before any barrier); the start of every pipelined step copies the GPU halt flag into every Params block
   (`copyBufferToBuffer`, queue-ordered) and into the last word of its own 16-byte summary slot; the last pass (`haltUpdate`, one invocation) sets the flag iff its own death/candidate count is non-zero
   (the CPU's non-quiet predicate) and never clears it. So a step submitted behind a non-quiet step executes no kernel.
3. The CPU reads each step's summary slot (ring of 2): `halted` word = 1 -> no-op, discarded (pending input/error values restored); after a non-quiet step or a discard the flag is cleared with a queue-ordered
   `writeBuffer`; every step still in flight behind it is finished and must be discarded **before** anything new is submitted (if one commits, the stepper throws instead of corrupting).
4. Anything that touches GPU state or the population outside `step()` drains first: `syncFullCpuState`, `setState`, `readLatestProcessedOutputCharge` (qOut is overwritten by every executed step), `encodeStep`
   (caller-owned encoder; never pipelined), switching `pipelineDepth` back to 1, benchmark end. Recreating the data buffers bumps a generation; in-flight steps of an older generation are discarded without mapping.
5. Rendering and metrics of the committed state must be issued between `step()` calls (before the next submission overwrites that ping-pong set); the worker does this (`renderCommittedState`, lagged metrics).
**Audit of what a no-op step still does** (unconditional commands): `clearBuffer` of `incomingChargeBuffers[incomingWrite]`, `senderCountBuffers[eventWrite]`, `selectedCountBuffer`, `cellCountBuffer`, `deathCandidateCountBuffer`,
`reproductionCandidateCountBuffer`; the halt copies; the summary copies into its own slot. Verified against what the non-quiet CPU handling reads: it needs only the summary (own slot), `deathCandidateSlotBuffer`,
`reproductionCandidateSlotBuffer`, `reproductionCandidateBuffer`, and `senderBuffers/targetBuffers[eventWrite of the halted step]` (all written only by kernels, which the halted steps skip; the cleared buffers are the other parity or
transient counters the CPU never reads from the GPU), and `restructureGpuStateInPlace` overwrites the buffers the no-op step cleared. The normal (non-full) path maps no per-particle state.
**Consequences/limits:** per-pass GPU timestamps are not recorded while pipelined; an input injected after step n is used by step n+2 instead of n+1 (restored if the speculative step it was encoded into is discarded);
the worker renders once per committed step/frame **without** awaiting GPU completion (queue order guarantees it sees the committed buffers; the previous path awaited `onSubmittedWorkDone`) — **visual correctness of the presented
frames must be checked by eye on hardware**; each non-quiet step wastes up to one speculative step.
Validation: `pipelined-step.test.ts` (15 cases) — for all 9 scenarios the committed GPU-state digest (committed ping-pong set), CPU topology digest and population size after every `step()` equal depth 1;
discards 0 in the steady scenario and exactly 1 in single-death, halt flag cleared again; input restore; drain behaviour; depth switch; `encodeStep` interop. The equivalence test found a real bug in my first draft
(a step submitted behind a doomed one), fixed by finishing all doomed steps before any new submission. On-device: the kernel self-test now checks the guard (`blocked`/`serial` death compaction with `halted=1` leave sentinels untouched, with `halted=0` match the reference) and `haltUpdate` (5 cases) — field `pipelineCases` **[pending]**.
**Not verified anywhere yet:** real-GPU behaviour of the whole pipelined flow, Dawn's cost of the extra tiny copies/pass, the visual result. It stays opt-in (`--pipeline-depth 2`).

## 20.6 Defects of earlier phases found while working (fixed)

- `topologyMerge` was not forwarded to `runBenchmark` (Phase 19). A new test (`phase20-fast-paths.test.ts`) fails whenever a `BenchmarkRunOptions` field is missing from the `runBenchmark({...})` call.
- The benchmark JSON gains `finalMetrics` (committed-state invariants read after the timed window), `pipelineDiscards`, `topologyMergesSkipped`, `method.metricsMode`, `method.pipelineDepth`.

## 20.7 Validation status

Run here (Node, minimal vitest shim; no GPU/network/pnpm): force-grid-variants 31, force-sorted-shaders 9, force-sorted-orchestration 13, orchestration 19, sync-accounting 13, death-compaction-scan 50, death-compaction-blocked 23,
profiling 10, topology-merge 11, pipelined-step 15, phase20-fast-paths 16, epoch-merge 3, webgpu-mfm 1 — all passed. `tsc` over the stepper modules and (with loose WebGPU stubs) `worker.ts`: 0 errors.
**Not run:** `pnpm typecheck/lint/test/build`, any WGSL compilation (the guard in 20 kernels, `haltUpdate`), any hardware measurement.

## 20.8 What to run

```powershell
pnpm typecheck; pnpm lint; pnpm test; pnpm build   # then restart vite preview
.\tools\bench\run-phase20-ab.ps1 -Headed -BaseUrl http://localhost:4180/continuous-evolutionary-particle-computation/
node tools/bench/compare-gpu-profiles.mjs --dir performance/phase20 --baseline ab-p19 --candidate ab-quiet --candidate ab-epoch --candidate ab-lag --candidate ab-pipe2
```

Order of evidence: (1) `await-latency.json` — does depth 2 halve the per-step time? (2) self-test `pipelineCases` all passed. (3) A/B: p19 -> quiet -> epoch -> lag is cumulative (each differs by one factor); pipe2 = lag + depth 2.
Decision rules: keep a factor only if the targeted section (`encode.snapshotMs`, `worker.mergeTopologyMs`, `worker.metricsMs`, step wall time) improves outside the noise band at N >= 2000 without regressing N = 200-500;
enable pipelining by default only if the probe shows overlap, the self-test passes, `finalMetrics` of pipe2 match lag within the dynamics' sensitivity, `pipelineDiscards` is small, the render looks right, and wall time improves.
