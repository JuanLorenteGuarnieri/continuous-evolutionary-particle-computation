# Phase 19 — default `sorted-culled`, render-pass GPU timing, render-on CPU path and death compaction

Status: **implemented and validated at algorithm/orchestration level; NOT yet measured on hardware.** Nothing below claims a speed-up
for the new code. Legend: **[source]** verified in code, **[phase18]** measured in the Phase 18 data (Intel HD Graphics 520),
**[node]** CPU micro-benchmark in Node/V8 (indicative for JS, not the browser), **[hypothesis]**, **[pending]** needs the hardware run.
Scope set by the maintainer: make `sorted-culled` the default; add GPU timestamps for the render pass; analyse and optimise the render
processing and `deathCompaction`, the two remaining bottlenecks after Phase 18.

## 19.1 `sorted-culled` is now the default force kernel

`DEFAULT_KERNEL_OPTIONS.forceKernel = 'sorted-culled'` (Phase 18 evidence: force pass -30 %..-83 %, GPU step time -22 %..-73 % from N=500, neutral
at N=200, on-device self-test passed). `linked-list` remains selectable (`--force-kernel linked-list`).
The sort buffers are created at init when a sorted kernel is selected (steps never allocate buffers); with `linked-list` they are created
lazily only if the kernel is switched later.
Tests: the Phase 15 golden dispatch traces and the Phase 16 API budgets describe the Phase 5..17 step, so they now pin `forceKernel: 'linked-list'`
explicitly (`orchestration.test.ts`, `LEGACY_KERNELS`; the golden file is unchanged). A new block checks the **default** step against the same golden
GPU-state and CPU-topology digests, requires exactly 3 extra dispatches per step and 3 extra bind groups per ping-pong parity (15 per step with the cache off).

## 19.2 Render-pass GPU timestamps (instrumentation only)

- `GpuPassTimestampProfiler` records the render pass as label `render` in the same query set as the compute passes.
  `GpuStepTiming.renderNs` / `GpuAggregate.renderMs` carry it; **`sumNs/spanNs/sumMs/spanMs` stay compute-only**, so Phase 14-18 comparisons remain valid
  (test: `profiling.test.ts`). `renderMs` is `null` when no step in the window had a render pass (render-disabled variants).
- Plumbing: `MfmWebGPUStepper.encodeStep(encoder, { deferTimingResolve: true })` defers the query resolve; the worker records the render pass with
  `renderTimestampWrites()` and then calls `endStepTiming(encoder)` before `queue.submit`. `RenderPipeline.render(..., timestampWrites?)` forwards them.
  Without the option nothing changes. Requires the `timestamp-query` feature (already required for the compute passes).
- Also new, CPU side: section `worker.mergeTopologyMs` (see 19.3). Both appear in the benchmark JSON of the `baseline` (render ON) variant.

## 19.3 What the Phase 18 data says about the render-on step

**[phase18]** At N=10000 the render-ON step is 30-40 ms and the render-OFF step 7-15 ms. The named CPU sections of the render-ON step (encode, render encode,
submit, finishNormalSync) sum to 8-16 ms; **24.5-25.5 ms of the step is not inside any named section**, and it is linear in N (2.2-2.5 us per particle for N >= 1000;
0.6-1.3 ms at N=200). **[source]** The only thing the render-ON path runs after `finishNormalSync` is `mergeNormalPopulationTopology`, which rebuilt the whole
population every step (a `Genome.clone()`, a `ParticleState` with two object copies and two `Set` copies, two Map insertions per particle); the render-OFF
(headless) path never calls it. **[hypothesis, strongly supported]** that merge is most of the previously reported "render cost"; the GPU render pass
itself is cheap: one instanced draw of 6 vertices x N, 2-6 px radius quads on an 800x600 target. The new timestamp (19.2) and `worker.mergeTopologyMs` decide this.

**Change (worker-side only, no GPU):** `TopologyMerger` (`webgpu-mfm/src/topology-merge.ts`) replaces the rebuild by an incremental merge: if ids and order
are unchanged and `previous` already holds the clone of each stepper genome, only `role` and the sender sets (when their content differs) are updated in place;
births/deaths/reordering take a structural path that still reuses existing states. The previous implementation is kept verbatim as
`mergeNormalPopulationTopologyRebuild` (reference and `rebuild` A/B mode). Observational equivalence is tested (`topology-merge.test.ts`, 11 cases: 8 seeds x
120 randomized steps with sender-set changes, role changes, births, deaths, genome-object replacement, reordering, an id without genome, a foreign previous view,
worker-side dynamic-state edits; plus non-aliasing of the stepper's Sets/Genomes). One assumption (A1, documented in the module): stepper genome objects are
replaced, never mutated in place (`Genome` has no setters). **[node]** merge cost per call: N=10000 10.9 ms -> 1.3 ms (8.4x; with 10 % sender-set churn 11.8 -> 1.8 ms),
N=2000 0.75 -> 0.21 ms, N=200 0.17 -> 0.06 ms. The browser figure may differ (the unattributed time above is 24.5 ms at N=10000, so the merge may explain
only part of it). Benchmarks select the mode with `--topology-merge rebuild|incremental`; the app uses `incremental`.

**No GPU render-shader change was made.** Candidates exist (4-vertex triangle strip instead of 6 vertices, hoisting `wrapCoordinate`/colour work out of the
per-vertex stage) but at N=10000 the whole draw is ~60 000 vertices and a few hundred thousand fragments; optimising it without a measured render-pass time would be
guessing. Decide after the first `renderMs` numbers.

## 19.4 `deathCompaction`

**[phase18]** 0.052 ms (N=200) -> 0.593 ms (N=10000), linear in N, now the second GPU cost (22 % of GPU compute at N=10000). **[source]** The Phase 17 `parallel`
kernel is ONE workgroup of 128 invocations that walks the particles in tiles of 128 and does an inclusive Hillis-Steele scan (7 steps, 2 barriers each) *per tile*:
~79 tiles x 14 barriers at N=10000, i.e. ~7.5 us per tile, for output that is almost always empty. **[hypothesis]** the cost is barrier/latency-bound per tile, not
bandwidth-bound.

**Candidate `deathCompaction: 'blocked'`** (`SHADER_DEATH_COMPACTION_BLOCKED`): one workgroup of 256; each invocation counts the deaths in one contiguous chunk of
`ceil(n/256)` particles; **one** 8-step scan of the 256 counts yields each chunk's offset; if the total is 0 the kernel stores 0 and returns (no second pass over
the data); otherwise each invocation writes its chunk's slots in ascending order. Output is identical to the serial kernel (same count, same ascending slots, no atomics).
Same bindings/dispatch (1 workgroup), so no orchestration change. Validation: line-by-line emulation vs the serial loop for 20 sizes (0..65537, around the 256-chunk
boundaries) x 6 death fractions plus clustered patterns (23 cases passed); shader-structure test (bindings equal the serial shader's, 3 barriers, early return after the last
barrier). On-device: the self-test now compiles and runs `blocked` on 17 sizes (up to 100000) x 4 fractions against the reference (`blockedMatchesReference`) **[pending]**.
Default stays `parallel` until the A/B. `--death-compaction blocked` selects it.

## 19.5 Validation status

Run here (Node, minimal vitest shim; no GPU/network/pnpm): force-grid-variants 31, force-sorted-shaders 9, force-sorted-orchestration 13, orchestration 19 (golden traces),
sync-accounting 13, death-compaction-scan 50, death-compaction-blocked 23, profiling 10, topology-merge 11, webgpu-mfm 1 - all passed; `tsc` over the changed webgpu-mfm modules with
stubbed WebGPU types: 0 errors. **Not run here:** `pnpm typecheck/lint/test/build` (please run them), WGSL compilation, any GPU/browser measurement. `worker.ts`/`benchmark-main.ts`
changes were not typechecked by `tsc` here (no DOM/worker WebGPU typings in the sandbox).

## 19.6 A/B to run (the data that decides everything above)

```powershell
pnpm typecheck; pnpm lint; pnpm test; pnpm build   # then restart vite preview
.\tools\bench\run-phase19-ab.ps1 -Headed -BaseUrl http://localhost:4180/continuous-evolutionary-particle-computation/
node tools/bench/compare-gpu-profiles.mjs --dir performance/phase19 --baseline ab-base --candidate ab-merge --candidate ab-death --candidate ab-both
```

Configs: `ab-base` (Phase 18 final: rebuild + parallel), `ab-merge`, `ab-death`, `ab-both`, interleaved, 5 rounds, same methodology as Phases 17/18.
Read: `gpu.renderMs` (render pass), `worker.mergeTopologyMs` and `worker.frameStepsMs` (render ON), the `deathCompaction` label (`blocked` vs `parallel`), step wall time and
steps/s for both variants. Acceptance rule: keep a candidate only if its target metric improves outside the noise band at N >= 2000 without regressing N = 200-500, and the self-test passes.

## 19.7 Decision ledger

`performance/phase19/ledger.json`: P19-T1 incremental topology merge, P19-D1 blocked death compaction - both `pending`; nothing rejected yet.

## Files

Changed: `webgpu-mfm/src/MfmWebGPUStepper.ts` (default kernel, eager sort buffers, deferred timing resolve + render timestamp hooks, `blocked` mode + shader),
`webgpu-mfm/src/profiling.ts` (`render` label, `renderNs`, `renderMs`), `webgpu-mfm/src/kernel-selftest.ts` (blocked variant, more sizes), `webgpu-mfm/src/index.ts`,
`webgpu-core/src/render-pipeline.ts` (optional timestampWrites), `web-worker/src/worker.ts` (deferred timing, merge mode, `worker.mergeTopologyMs`), `react-ui/src/benchmark-main.ts`,
`tools/bench/benchmark-webgpu.mjs` (`--topology-merge`, `--death-compaction blocked`), tests (`orchestration`, `force-sorted-orchestration`, `support/sync-scenarios`, `profiling`).
Added: `webgpu-mfm/src/topology-merge.ts`, `tests/topology-merge.test.ts`, `tests/death-compaction-blocked.test.ts`, `tools/bench/run-phase19-ab.ps1`, `performance/phase19/ledger.json`, this report.

---

## 19.8 Hardware run (Intel HD Graphics 520, Chrome 153): 2x2 design, 5 interleaved rounds, data in `performance/phase19/`

Design: merge {rebuild, incremental} x death {parallel, blocked}; `ab-base` = rebuild+parallel (Phase 18 final + render timestamp plumbing), `ab-merge`, `ab-death`, `ab-both`.
Every per-run `method.topologyMerge` / `kernels.deathCompaction` matches the requested configuration (an earlier run in which `topologyMerge` was silently dropped by the
worker's option forwarding was discarded; the forwarding is fixed in `worker.ts`). On-device self-test passed (68 death-compaction cases incl. `blocked`, 10 force cases). 0 dropped steps, 0 anomalous passes.

**Render-pass timestamp: failed.** `gpu.renderMs` is `null`: the pass reports exactly 0 ns in 100 % of steps at every N (cause undetermined; the compute passes on the same query set are fine). The render cost is bounded indirectly (below).

**Topology merge (rebuild -> incremental), interleaved, 5/5 paired wins at every N and for both death baselines.** `worker.mergeTopologyMs` median: N=200 0.5 -> 0.1, 1000 2.1 -> 0.2, 2000 4.0 -> 0.3,
5000 10.1 -> 0.8, 10000 21.2 -> 1.8 ms. Render-ON step median: 4.7 -> 4.2 / 6.3 -> 4.4 / 6.75 -> 4.3 / 8.7 -> 4.6 / 15.95 -> 6.2 / 28.8 -> 9.5 ms (N=200..10000); steps/s x1.06 .. x2.9 (N=10000: 26.6 -> 74.2).
The render-OFF control (the merge is not executed there) is a clean null (ratios 0.97-1.04). The "render cost" reported in Phases 17-18 was therefore mostly this CPU merge, not the GPU render.

**Death compaction (parallel -> blocked), two independent comparisons, 5/5 wins at every N:** pass time N=200 0.056 -> 0.050, 1000 0.096 -> 0.052, 2000 0.150 -> 0.058, 5000 0.310 -> 0.076,
10000 0.579 -> 0.102 ms (x0.89 .. x0.18); GPU step time at N=10000 2.73 -> 2.26 ms (-17 %). Wall clock: visible only at N=10000 with render ON (finishNormalSync 6.2 -> 5.0 ms, step 9.5 -> 8.5 ms, 5/5 wins);
render OFF shows no gain (ratio 1.02-1.05, 1-2 wins of 5; unexplained); N <= 5000 not resolvable (the GPU saving is <= 0.25 ms).

**Final config (`both`) vs Phase 18 final (cross-session):** steps/s render ON x1.19 (N=200) .. x3.26 (N=10000: 25.4 -> 82.8); render OFF x1.01-1.10. Particle-steps/s at N=10000: 828 k (render ON), 997 k (render OFF).

## 19.9 Where the time goes now (final config; code reviewed: `MfmWebGPUStepper.prepareEncodedStep/finishNormalSync/readEventSummary/readPopulationMetrics`, `worker.ts` frame loop, `main.tsx` rAF driver)

Render ON, medians (ms), N=200 / 2000 / 10000: step 4.3 / 4.5 / 8.5 = encode 0.2 / 0.35 / 1.2 + render encode 0.1 + submit 0.1 + **finishNormalSync 3.8 / 3.6 / 5.0** + merge 0.1 / 0.3 / 1.8; **per-frame metrics 3.4 / 3.4 / 3.5**; GPU compute 0.57 / 0.95 / 2.24.

1. **Await latency, not work.** Each awaited `mapAsync` costs ~2.7-3.5 ms regardless of N (finishNormalSync - GPU = 3.2 / 2.7 / 2.8 ms; the metrics readback, which moves 8 B/particle and whose JS loop is negligible, costs 3.4 ms at N=200 and 3.5 ms at N=10000;
   the headless step minus GPU is 3.0-3.5 ms). Two such awaits per frame are 86 % of the cycle at N=200 and 52 % at N=10000. GPU compute is 7 % (N=200) .. 19 % (N=10000) of the cycle. That the floor is a browser/driver
   round-trip latency (and not GPU time or copy size) is a hypothesis consistent with all of this; a 4-byte empty-submit `mapAsync` microbenchmark would confirm it directly.
2. **Consequence for the metrics path:** GPU-side reduction (the project's stated long-term idea) would not help, because the metrics cost does not depend on bytes or on the O(N) loop; what costs is the awaited round trip.
   Reading the metrics of frame f during frame f+1 (copy into a staging buffer at the end of the frame, `mapAsync` without awaiting, consume next frame) removes the await and keeps the values exact.
3. **App loop (code):** `main.tsx` posts one `frame` per `requestAnimationFrame`; the worker drops requests while one is in flight (`frameInFlight`), does `stepsPerFrame` steps (each `await`s `finishNormalSync`), renders, then awaits the metrics readback.
   So each extra step per frame costs ~4.3 ms of mostly latency and the metrics await is paid once per frame; hiding the per-step latency is what would raise simulated steps per frame.
4. **CPU linear in N on quiet steps (code):** `takeSnapshot()` rebuilds the O(N) snapshot every step although on a quiet step only `snapshot.length` and the input slot are used, and `prepareEncodedStep` deep-copies `incomingChargeMap` / `incomingSendersMap`
   (both are replaced, never mutated in place, and the copies are only consumed on non-quiet steps). Node micro-benchmark (indicative): 0.33 ms + up to 1.6 ms at N=10000 versus a measured `encodeStep` of 1.2 ms (0.2 ms at N=200); the worker merge still costs 1.8 ms at N=10000.
5. **GPU compute at N=10000:** `force` 1.6 ms (73 %), sort passes 0.20, death 0.10, ten small passes 0.30. Removing `force` entirely would cut the cycle by ~13 %.
6. **Render:** render ON - merge - render OFF = 0.0-0.4 ms for N <= 2000 and 0.95-1.55 ms at N=5000 (0.1-1.55 at N=10000), an upper bound that includes encoding and presentation. Not a bottleneck.

## 19.10 Recommended next steps (by evidence; none implemented)

1. **Lagged, non-blocking metrics readback** (-3.4 ms per frame: cycle 7.7 -> 4.3 ms at N=200, 12.0 -> 8.6 ms at N=10000; exact values, one frame stale; staging double buffer + role copy). Not GPU reduction.
2. **Skip O(N) work on quiet steps:** lazy snapshot, reference instead of copy for `previousIncoming*`, and a topology epoch so the worker skips the merge (together up to ~3 ms at N=10000, ~0.3-0.6 ms at N=2000). First fix the instrumentation gap (the worker never calls `commitProfilingStep()`, so `stepperCpu` is empty) to measure the quiet-step fraction and the encode split.
3. **Measure the raw await latency** (empty submit + `mapAsync` of 4 bytes, and `onSubmittedWorkDone`) to learn the floor before designing anything around it.
4. **Optimistic pipelining of normal sync** (submit step n+1 before the summary of step n arrives, discard on a non-quiet summary): the only way to hide the ~3 ms per step, but high risk (RNG/timestep determinism on replay, ping-pong/incoming/event buffers, render of discarded steps); needs a design and the measurement of step 3 first.
5. Make `deathCompaction: 'blocked'` the default (GPU -17 % at N=10000, wall gain only there).
6. Diagnose render timestamps only if the render pass ever matters (it does not at present).
