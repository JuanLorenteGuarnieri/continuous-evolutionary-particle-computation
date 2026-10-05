# Phase 16 — WebGPU command encoding and resource management

Status: **implemented and validated against the software-device harness; NOT validated on real GPU hardware.**
Read [Validation status](#validation-status-read-this-first) before relying on any number below.

Source of truth: the repository ZIP delivered after Phase 15. The frozen Phase 15 `MfmWebGPUStepper.ts`
(sha256 `1ddde81883ef16ae…`) is the A/B baseline. Evidence labels: **[fact]** verified in source/tests,
**[measured]** produced by a command listed here, **[hypothesis]**, **[proposal]**, **[constraint]**.

## Objective

Encode and submit the same computation with less host-side WebGPU API/resource work, preserving exactly the same
simulation semantics and the Phase 15 GPU-authoritative synchronization model. No kernel, WGSL, RNG, population
or synchronization-policy change.

## Validation status (read this first)

| Item | Status |
| --- | --- |
| Same computation as Phase 15 (state digests, topology digests, normalized dispatch trace) | **Verified** against the emulated-kernel software device: 18 runs, 496 steps, 6 438 dispatches, identical for all 4 option combinations |
| Existing suites on the Phase 16 tree (shimmed vitest + esbuild, **not real vitest**) | `orchestration` 15/15, `sync-accounting` 12/12, `profiling` 9/9, `shared-config` 11/11, `experiment-api` 2/2, `webgpu-mfm` 1/1, `webgpu-core` 1/1 |
| `cpu-reference.test.ts` | **1 of 7 fails** ("keeps input as a non-receiving interface and output as a non-sender"). Fails identically on the frozen Phase 15 tree and under two different module loaders; that package is untouched by Phase 16. Cause not investigated: could be a sandbox artifact, must be re-run with real vitest |
| Strict `tsc` | Stepper, worker, tests: clean, but with ambient stubs for WebGPU/vitest/Node types (`@webgpu/types` not installable offline) |
| Real Chromium/Dawn | Only `RenderPipeline` (SwiftShader). The compute stepper **cannot** run there: the adapter exposes `maxStorageBuffersPerShaderStage = 10`, CEPC's kernels bind more |
| **GPU/hardware performance** | **Not measured. No claim is made.** |
| pnpm install, eslint, real vitest, C++ oracle, CI, production build, GitHub Pages | **Not run** (sandbox has no network/pnpm/vite). Deployment files were not modified |

The device-boundary counters are exact. The JS timings are real but come from a no-op GPU on a 1 vCPU sandbox and
exclude Dawn validation, IPC and GPU execution.

## Phase 15 baseline entering the phase

From the Phase 15 report and its committed artifacts (`performance/phase15/`): quiet steps already have no
per-step readback of dynamic state; CPU-side per-step cost is dominated by population/topology handling, not by
WebGPU encoding (Phase 15: `mergeNormalPopulationTopology` ≈ 0.81 ms/step at N=1 000 and ≈ 47 ms/step at N=10 000).
Phase 15's committed JS-only orchestration baseline had `encode.passesMs` ≈ 0.01 ms/step — i.e. bind-group creation was
already small *in JS*; its real cost (Dawn client serialization, GPU-process validation) was never measured.

## WebGPU orchestration inventory

**[fact]** Quiet normal step, K = 1 (`step()` driver or `encodeStep`+worker): **1 command encoder, 1 `queue.submit`,
12 compute passes (1 dispatch each), 4 `clearBuffer`, 2 `copyBufferToBuffer`.** With reproduction compaction enabled:
13 / 5 / 3. Each extra communication rank adds 2 passes (select + transmit). One 112 B uniform block is written per
rank block (see Changes). Counts are identical before and after Phase 16 (table below).

Call sites in `MfmWebGPUStepper.ts` (Phase 16 tree): `createCommandEncoder`/`queue.submit` 7× each — the normal step
(`stepUnsafe`) plus six exceptional paths (`readChargeMetrics`, `readPopulationMetrics`, `readLatestProcessedOutputCharge`,
`restructureGpuStateInPlace`, `syncFullCpuStateForSnapshot`, `syncFullCpuState`). `createBindGroup` 1 site (the
instrumented `makeBindGroup` helper). `createComputePipeline`/`createShaderModule`/`createPipelineLayout`/
`createBindGroupLayout`: `createPipelines()` only. Worker: 2 encoder+submit pairs (frame step with render, render-only).
Renderer: 1 `createBindGroup` site, no encoder of its own.

**[measured, software device]** Pipeline lifecycle: 14 shader modules, 14 compute pipelines, 14 pipeline layouts, 14 bind
group layouts, all created in `init()`; **0 created during timesteps**, including the buffer-recreation scenario.
Nothing to fix.

**[fact]** Buffer creation: `createDataBuffers()` (init and shape changes; old buffers destroyed first) and
`readLatestProcessedOutputCharge()` (creates a staging buffer per call; **no caller in the step path**, left alone as
an exceptional diagnostic). Metrics/event/full-sync paths use persistent staging buffers (Phase 15).

**[fact]** Bind groups before Phase 16: 10 + 2K per step (+1 with reproduction compaction), all rebuilt every step. The
select and transmit groups were rebuilt inside the rank loop although identical for every rank (rank is selected by
the dynamic offset, binding 0).

## Measured bottlenecks

| What | Configuration | Result | Side |
| --- | --- | --- | --- |
| `createBindGroup` calls per quiet step | software device, K=1 | 12 (Phase 15) | CPU/API |
| `queue.writeBuffer` per quiet step | same | 2 writes, 224 B; two byte-identical 112 B blocks (one unused rank-less block + rank 0) | CPU/API |
| Per-step `ArrayBuffer`+`DataView` allocation for params | source | 1 + maxK pairs per step | CPU, WebGPU-only |
| Renderer `createBindGroup` | real Dawn, 26 frames, ping-pong buffers | 26 creations, only 2 distinct buffer sets exist | CPU/API |
| JS time in bind-group creation | Node, no-op GPU | 0.009 ms (N=1k), 0.012 ms (N=10k) per step | CPU, **JS only** |
| Dawn-side cost of those calls | — | **not measured** | unknown |
| GPU execution time | — | **not measured** | — |

Honest reading: in JS the encoding path was already cheap. Phase 16 reduces *work handed to the browser/driver*;
whether that matters end-to-end is a hardware question this phase could not answer.

## Changes made

Each change was A/B-able in one build through `OrchestrationOptions` (`setOrchestrationOptions`, `--bind-group-cache`,
`--pack-params`), so each mechanism is individually switchable and was measured separately where measurement exists.

### 1. Per-step bind-group set cache (default **on**)

- **Implementation:** `acquireStepBindGroups()` returns an object with all 12 bind groups (+ lazily the reproduction
  compaction group). Cache is an 8-slot array. Select/transmit groups are built once per set, not once per rank.
- **Rationale:** every group depends only on the ping-pong indices plus buffers stable until the data buffers are
  recreated; `rank` is a dynamic offset, not part of the key.
- **Measured (device boundary):** 6 438 → 668 `createBindGroup` over 496 steps (−89.6 %); with the cache off 6 350
  (the 88 fewer come purely from sharing select/transmit across ranks). Quiet K=1 step: 12 → 0 amortized.
- **Measured (JS, Node no-op GPU, median of 3 interleaved rounds):** `encode.passesMs` 0.0090 → 0.0034 ms/step (N=1k),
  0.0123 → 0.0040 (N=10k). Total step mean at N=1k: 0.0797 → 0.0731 ms, and every Phase 16 round was below every
  Phase 15 round (0.0818/0.0792/0.0797 vs 0.0732/0.0731/0.0698). At N=10k the step mean (0.623 vs 0.636) is inside
  round-to-round spread (0.61–0.69): **no end-to-end effect observable**.
- **Not measured:** Dawn/GPU-process effect; real-hardware throughput.

### 2. Parameter blocks: deduplicated, persistent scratch (default behaviour)

- **Implementation:** one persistent `Uint8Array`/`DataView`; block 0 filled once and `copyWithin`-copied to other rank
  blocks with only `rank` patched; one 112 B `writeBuffer` per block. The old extra rank-less block (identical to
  rank 0) is gone: block *r* holds rank *r*, non-rank dispatches bind offset 0, communication binds `rank * 256`.
  Params buffer shrinks from `maxK + 1` to `max(1, maxK)` blocks. Every field is still recomputed from `config` each
  step (no cross-step value caching).
- **Measured:** quiet K=1 step 2 writes / 224 B → 1 write / 112 B; over the 496-step suite writes −20.6 %
  (2 408 → 1 912), bytes −10.8 % (512 304 → 456 752). Per-step typed-array/DataView allocations → none.
- **JS time:** `encode.writeParamsMs` is microseconds and not reliably different (0.0042 → 0.0022 at N=1k; 0.0045 →
  0.0065 at N=10k; both inside noise of a mock `writeBuffer`). Reported as neutral, not as an improvement.
- **Alignment [constraint]:** blocks stay at 256 B stride (`minUniformBufferOffsetAlignment`), 112 B binding size.
  `validateConfiguration` still checks `(maxK + 1) * 256` against the 64 KiB uniform limit — conservative, unchanged.

### 3. Renderer bind-group memo

- **Implementation:** `RenderPipeline` memoizes at most 2 bind groups keyed by buffer identity
  (positions, health, charge, role); cleared when the role buffer changes (the stepper recreates all data buffers
  together), when the uniform buffer is created, and in `destroy()`.
- **Measured on real Chromium/Dawn:** 26 frames → 26 creations (Phase 15) vs 4 (Phase 16: 2 per buffer generation),
  zero validation errors, including after destroying and recreating all data buffers
  (`performance/phase16/dawn-render-check/`). Time not measured.
- **Bug found and fixed along the way [measured]:** `RenderPipeline.destroy()` called `pipeline.destroy()` and
  `bindGroupLayout.destroy()`. Those methods do not exist on `GPURenderPipeline`/`GPUBindGroupLayout`; in real Chromium
  Phase 15's `destroy()` throws `TypeError: this.pipeline?.destroy is not a function` after the uniform buffer is
  destroyed. Removed. `webgpu-core/src/metrics.ts` (`MetricsReducer`) has the same pattern; it has no runtime user
  (the worker mentions it only in a comment), so it was left untouched.

### 4. Counters and harnesses (instrumentation only)

Added `encode.commandEncoders`, `encode.computePasses`, `encode.dispatches`, `encode.clearBuffers`,
`encode.copyBuffers`, `encode.writeBuffers`, `encode.writeBytes`, `encode.bindGroupCacheHits/Misses`,
`submit.queueSubmits` (stepper and worker); `MockDevice.counters.commandEncoders`; a normalized dispatch-trace recorder
and `RunOptions` in the software-device harness; `--bind-group-cache`, `--pack-params`, `--dispatch-traces`,
`--no-sandbox` flags; additive `orchestration` blocks in result JSON. Phase 14/15 schemas are unchanged
(fields only added).

## Before / after

All counts: software `GPUDevice`, 9 scenarios × 2 drivers, 496 steps total
(`performance/phase16/sync-accounting-*.json`, programmatic summary in `comparison.json`).

| Counter (496 steps) | Phase 15 | Phase 16 default | cache off | packed params |
| --- | ---: | ---: | ---: | ---: |
| `createBindGroup` | 6 438 | **668** | 6 350 | 668 |
| `queue.writeBuffer` calls | 2 408 | **1 912** | 1 912 | 1 868 |
| CPU→GPU bytes written | 512 304 | **456 752** | 456 752 | 463 088 |
| compute passes = dispatches | 6 438 | 6 438 | 6 438 | 6 438 |
| command encoders = submits | 888 | 888 | 888 | 888 |
| `clearBuffer` | 2 382 | 2 382 | 2 382 | 2 382 |
| `copyBufferToBuffer` | 2 668 | 2 668 | 2 668 | 2 668 |

Per scenario, `shape-change-fallback` (maxK reaches 3): packed params 88 → 66 writes (−25 %) but 15 080 → 18 248 bytes
(+21 %). Packing trades calls for bytes, wins only when maxK > 1, and has no measured benefit; it stays **off**.

Not reported because not measured on hardware: timesteps/s, particle-steps/s, p50/p95/p99 step time, GPU timestamp
time, GPU wait, readback time, metrics time. The existing browser driver (`tools/bench/benchmark-webgpu.mjs`) emits all
of them in the Phase 14/15 schema and now accepts the Phase 16 switches; see
[Reproducing](#reproducing-and-the-hardware-ab-still-owed).

JS-only host cost (Node, no-op GPU, interleaved A/B rounds, `performance/phase16/cpu-orchestration/`):

| N | variant | step mean ms | step p50 | step p95 | `encode.passesMs` |
| ---: | --- | ---: | ---: | ---: | ---: |
| 1 000 | Phase 15 | 0.0797 | 0.0655 | 0.1220 | 0.0090 |
| 1 000 | Phase 16 | 0.0731 | 0.0586 | 0.0891 | 0.0034 |
| 1 000 | Phase 16, cache off | 0.0797 | 0.0652 | 0.1107 | 0.0098 |
| 10 000 | Phase 15 | 0.6226 | 0.5901 | 0.8131 | 0.0123 |
| 10 000 | Phase 16 | 0.6359 | 0.5934 | 0.8082 | 0.0040 |
| 10 000 | Phase 16, cache off | 0.6369 | 0.5942 | 0.8275 | 0.0135 |

The cache-off row isolates the cache: with it off, Phase 16 matches Phase 15 within noise.

## Resource and cache behaviour

**Step bind-group cache.** Key `stateRead | incomingRead<<1 | eventWrite<<2` (all `*Write` indices are complements).
Max size 8 sets × 13 groups. Measured live sets (`performance/phase16/cache-hit-rate.json`): 2 in steady state, up to 4
after in-place restructuring (the three indices stop flipping together).

| Scenario | steps | hits | misses | hit rate | max live sets |
| --- | ---: | ---: | ---: | ---: | ---: |
| steady-no-repro, repro-enabled, single-death/birth, multi-death, death-and-birth | 24 | 22 | 2 | 91.7 % | 2 |
| shape-change-fallback (buffers recreated twice) | 24 | 18 | 6 | 75.0 % | 2 |
| churn, churn-large | 40 | 36 | 4 | 90.0 % | 4 |

- **Ownership:** the stepper owns both the buffers and the bind groups that reference them.
- **Invalidation:** cleared at the start of `destroyDataBuffersOnly()` (before any `destroy()`), at the start of
  `createDataBuffers()` (defensive), in `destroy()`, and when the cache option is turned off. Nothing else assigns the
  data buffers. In-place restructuring only flips indices, which are part of the key.
- **Safety evidence:** the mock throws at submit if a destroyed buffer is bound; tests assert no cached group holds a
  destroyed buffer across four churn/shape-change scenarios, and mutation checks confirm the suite fails if
  invalidation is removed or if any of the three key components is dropped.
- **Lazy reproduction group:** created only for sets used by a reproduction-compaction step; counts toward the same set.

**Renderer memo.** Key = identity of 4 buffers, ≤ 2 entries, cleared on role-buffer change / uniform recreate /
`destroy()`.

**Correctness invariant exercised, not just argued.** The three ping-pong indices are assigned independently in
several places, so a differential test forces them to diverge (toggling `incomingIndex` and `eventIndex` mid-run) and
requires cache-on and cache-off dispatch traces to be identical.

## Rejected or deferred

- **Merge compute passes into one pass.** Spec-legal (dispatch is the synchronization scope), but no evidence: it would
  break the per-pass GPU timestamps of Phase 14 and the cost per pass was never measured on hardware. Deferred as an
  opt-in candidate for the hardware A/B.
- **Fewer encoders/submits.** A quiet step already has exactly 1 encoder + 1 submit. The others belong to exceptional
  sync/readback paths whose boundaries Phase 15 set deliberately. Nothing to merge.
- **Packing params as default.** More bytes, no measured gain, only differs for maxK > 1.
- **Dynamic-offset or larger uniform consolidation.** Already dynamic offsets; no evidence of a problem.
- **Reusing the `readLatestProcessedOutputCharge` staging buffer.** No caller in the step path.
- **Pipeline/shader caching.** Already init-only (verified).
- **`previousIncoming*` map copies and `mergeNormalPopulationTopology`.** CPU population management (category A/B),
  out of Phase 16 scope; the largest remaining CPU cost (see below).
- **Any GPU-time claim for the cache.** No hardware data.

## Remaining costs

- **CPU orchestration:** population/topology merge and snapshot/map copying (Phase 15 figures above) outweigh all
  WebGPU encoding by orders of magnitude in JS. Per step the stepper still issues 12 passes, 4 clears, 2 copies and 1
  write; nothing was removed there.
- **GPU:** unknown. The Phase 14 timestamp infrastructure exists but has not been run on hardware with this tree.
- **Resource management:** `readLatestProcessedOutputCharge` buffer-per-call (off the hot path); `metrics.ts` destroy
  pattern (unused).

## Recommendations for the next phase (evidence-backed only)

1. Run the hardware A/B below first. It decides whether anything in Phase 16 matters end-to-end, and whether a
   single-compute-pass option is worth building.
2. If population handling still dominates there, target `mergeNormalPopulationTopology` / map copies (Phase 15 data).
3. Only if GPU timestamps on hardware show a dominant kernel, open a kernel phase.

## Reproducing and the hardware A/B still owed

```bash
pnpm run benchmark:sync -- --label phase16 --out performance/phase16/sync-accounting-phase16.json
pnpm run benchmark:sync -- --bind-group-cache off --pack-params off ...
pnpm run benchmark:sync -- --dispatch-traces ...        # per-step dispatch digests
node --no-warnings --experimental-strip-types --experimental-loader=./tools/bench/ts-prefer-loader.mjs \
  tools/bench/cpu-orchestration.mjs --bind-group-cache on|off ...
pnpm test                                                # includes tests/orchestration.test.ts
```

Hardware (needs a machine with a real GPU, `maxStorageBuffersPerShaderStage ≥ 16`): run
`tools/bench/run-phase16-ab.ps1` (PowerShell; uses the new `--real-gpu` driver flag) and `tools/bench/summarize-ab.mjs`, see
`performance/phase16/README.md` — interleave `--bind-group-cache off | on | on --pack-params on`, ≥ 5 rounds, same
machine, report p50/p95/p99 and GPU timestamp time. Only then can "CPU-side improvement" be upgraded to "end-to-end
improvement" or retracted.

## Files changed

`src/webgpu-mfm/src/MfmWebGPUStepper.ts` (+238/−69), `src/web-worker/src/worker.ts`, `src/webgpu-core/src/render-pipeline.ts`,
`src/react-ui/src/benchmark-main.ts` (types), `tools/bench/{benchmark-webgpu,sync-accounting,cpu-orchestration}.mjs`,
`src/webgpu-mfm/tests/support/{mock-gpu,sync-scenarios}.ts`, new `src/webgpu-mfm/tests/orchestration.test.ts`,
new `src/webgpu-mfm/tests/golden/phase15-dispatch-traces.json`, new `performance/phase16/`, this report.
Frozen baseline: Phase 15 `MfmWebGPUStepper.ts` sha256 `1ddde81883ef16aea90a1c7658ac8ec2b9e743174355d3d7a8c8d4de020f7dfc`;
Phase 16 `cb061733efc3bb844c416e16bd90f7b891eba8905b130ccc792980c2d6175cb4`.
