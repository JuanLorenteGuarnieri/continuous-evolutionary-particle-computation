# Phase 15 — Synchronization, readback, upload and barrier reduction

**Status:** implemented and structurally validated in a sandbox **without a GPU, browser, network, pnpm, vitest or eslint**.
**No WebGPU timing was measured in this phase.** Every number below is either a *structural count* taken at the device boundary of a software `GPUDevice`, or a *CPU-only JavaScript* timing under a no-op software GPU. Neither is GPU time and neither predicts end-to-end throughput. §9 gives the exact protocol to obtain the real A/B on hardware.

Evidence classes used throughout: **[F]** verified fact from source · **[S]** structural measurement (software device) · **[C]** CPU-only measurement (Node, no-op GPU) · **[H]** hypothesis · **[D]** decision.

---

## 1. Objective

Make the GPU-authoritative architecture behave that way at runtime: reduce GPU→CPU readbacks, CPU→GPU uploads and CPU/GPU barriers that are not semantically required, keep full synchronization exceptional and explicit, and preserve simulation semantics. Out of scope (and not touched): kernel fusion, kernel redesign, compaction redesign, bind-group caching, rendering, WGSL cleanup, large refactors.

## 2. The Phase 14 baseline — what actually exists

**[F] The supplied ZIP contains no WebGPU measurements.** `performance/phase14/` holds only `cpu-reference.json`, and the Phase 14 report itself says `benchmark:webgpu` "has not been run anywhere" and that GPU-pass, `onSubmittedWorkDone`, rendering and restructuring costs are "not yet measured" (its Windows addendum covers lint/typecheck/build/`vite dev`, not the benchmark). The Phase 15 brief says to "use the measurements obtained during Phase 14"; for the WebGPU path there are none in the repository. **If you have since run `benchmark:webgpu` locally, please send the JSON: it replaces everything labelled [H] below.**

Consequences, stated plainly:

* "Measured cost" of any sync path on a GPU is **unknown**. Every claim about it is **[H]**.
* No change in this phase is justified by measured GPU speed-up. Each is justified by a **verified reduction in round trips/bytes/uploads at zero semantic change**, which the brief explicitly allows to be reported as *architectural improvement, not measured performance improvement*.
* The Phase 14 benchmark, once run on hardware, will supply the baseline; its counters (`readback.*`, `upload.*`, `sync.*`, `worker.*`) already cover what is needed, and Phase 15 only *adds* counters (§8).

Also verified, because the brief assumes them: **[F]** `src/cpp-oracle/src/MfmCppOracle.cpp`, `Genome.cpp` and `include/cepc/MfmCppOracle.hpp` are **0-byte files** in the supplied ZIP, so "C++ oracle validation stays green" cannot be checked from this snapshot; **[F]** `test:webgpu-validation` and `test:webgpu-mfm-validation` are `console.log` stubs and `webgpu-mfm.test.ts` only asserts the class is defined — **there were no existing WebGPU behavioural tests to keep green.** If the ZIP was trimmed, please confirm; otherwise these are Phase 13/14 gaps.

## 3. Instrument built for this phase (and its limits)

| Piece | What it does | What it cannot do |
| --- | --- | --- |
| `tests/support/mock-gpu.ts` | Software `GPUDevice`: real `ArrayBuffer` buffers; `writeBuffer`, `clearBuffer`, `copyBufferToBuffer` move real bytes; counts submits, `mapAsync` (and **serial wait epochs**: overlapping maps count once), `onSubmittedWorkDone`, bytes each direction. Enforces spec rules the stepper must obey (alignment, bounds, usage bits, no `src===dst` copy, no double-map, no submit touching a mapped buffer, detach of mapped ranges on `unmap`). | No timing, no IPC/latency model, no WGSL. |
| `tests/support/kernel-emulator.ts` | Deterministic stand-ins for each compute pass; death/reproduction compaction use the same predicates as the WGSL. Scripted deaths, births, events. | It is not the shader. Passing proves orchestration, not kernels. |
| `tests/support/sync-scenarios.ts` | 9 scenarios × 2 drivers (headless `step()`, and the worker's `encodeStep`→`submit`→`finishNormalSync` + per-frame metrics). Per step: device counters + SHA digest of GPU-visible state keyed by ParticleID (positions, velocities, health, charge, pending incoming, **and all 14 static columns as raw words**) + CPU topology digest. | — |
| `tests/golden/phase14-sync-traces.json` | Per-step digests recorded from the **unmodified Phase 14 stepper**. | — |
| `tools/bench/sync-accounting.mjs` (`pnpm run benchmark:sync`) | Runs any stepper source (`--stepper`) over the matrix → `performance/phase15/sync-accounting-*.json` (`"timed": false`). | — |
| `tools/bench/cpu-orchestration.mjs` | Real stepper + no-op GPU + Phase 14 CPU section profiler: the JS that runs while a real GPU would be idle. | Not GPU/IPC time. |

Validity checks performed: reruns are bit-for-bit deterministic for both stepper versions; the same test file run against the **Phase 14 stepper** passes trace-equality and **fails** the 7 budget/contract tests (so the tests discriminate); the harness caught a real ordering bug in an early draft of change U1 (§5), which was fixed.

## 4. Synchronization inventory

**[F]** from source. "Ph14" = as supplied; "Ph15" = now.

| # | Site | Direction / data | Blocking? | Ph14 | Ph15 |
| --- | --- | --- | --- | --- | --- |
| 1 | worker `encodeAndSubmitWebGPUStep` after `submit` | `queue.onSubmittedWorkDone()` | wait, every interactive step | present | **removed** (subsumed by #2, below) |
| 2 | `finishNormalSync`: death count | GPU→CPU 4 B, own encoder + submit + `mapAsync` | wait, every step | own round trip | folded into one 12 B summary copied by the **step's own submission** |
| 3 | `finishNormalSync`: reproduction count | GPU→CPU 4 B, own submit + map (only if reproduction compaction enabled) | wait | own round trip | folded into #2 |
| 4 | event count | 4 B map inside `readbackEvents` | wait | separate | folded into #2 |
| 5 | death slots / candidate slots / candidate geometry | GPU→CPU, 3 sequential submit+map | 3 waits (only when a death/candidate exists) | sequential | **one** submit, staging buffers mapped concurrently |
| 6 | event sender/target lists | GPU→CPU, submit + `onSubmittedWorkDone` + map | 2 waits | present | in #5's batch; extra wait removed |
| 7 | **Restructure readback**: any death/birth → `syncFullCpuStateForSnapshot` | GPU→CPU 24 B/particle (pos, vel, health, charge) | wait | every restructure | **only on buffer-shape change** (§5 R1) |
| 8 | **Restructure upload**: `uploadPopulationToGpu` | CPU→GPU: both state ping-pong sides, 14 static columns, incoming ×2, `selectedTargets` zero-fill — all sized by *capacity* | no wait, but O(capacity) bytes + ~20 typed-array allocations | every restructure | GPU buffer-to-buffer copies + deltas (newborns, shifted static suffix) |
| 9 | per-frame metrics, system A: `MetricsReducer` | GPU→CPU 8 B/particle (health+charge) to sum **health** only; per call creates result buffer, count buffer (previous one never destroyed), bind group, staging buffer | submit + wait | present | **no longer used by the worker** |
| 10 | per-frame metrics, system B: `readChargeMetrics` | GPU→CPU 4 B/particle (charge again) + a `Map.get` per particle for role | submit + wait | present | superseded by `readPopulationMetrics` |
| 11 | public `syncFullCpuState` | GPU→CPU 24 B/particle | wait | second, line-for-line copy of #7's code; invisible to profiler counters | delegates to the single implementation; counted per reason |
| 12 | worker paused-render `onSubmittedWorkDone` | wait, per paused frame | wait | present | **retained** |
| 13 | worker `inspect`/`grab`/backend switch → full sync | explicit | wait | present | retained (explicit, exceptional) |
| 14 | `populationDirty` (config change) → full sync + buffer rebuild | explicit | wait | present | retained; now tagged `configChange` |
| 15 | `readLatestProcessedOutputCharge` | diagnostic readback, new staging buffer per call, redundant `onSubmittedWorkDone` | wait | present | untouched — **[F] no callers** |
| 16 | GPU timestamp readbacks (Phase 14 profiler) | asynchronous, profiling only | no | — | unchanged |

Two findings about the *API*, not changed here (no behaviour change was requested):

* **[F] `syncPartialCpuState` does not exist on the stepper.** The worker feature-detects it and always falls back to a full snapshot (`fallback: true`), and **no UI code sends a `sync` message**. "Partial"/"onDemand" are nominal: they differ from `full` only by a flag. Anything that needs fewer fields currently gets all 24 B/particle.
* **[F] `setPopulation` does not exist on the stepper** (only on the CPU reference). `setSimulationPopulation()` is therefore a no-op for WebGPU: edits made by *grab* and *create particle* modify the worker's CPU copy and **never reach the GPU**. This is the CPU→GPU half of "interaction requiring CPU-side dynamic state" and appears to be a functional gap, not only a performance one. I did not touch it; it needs a product decision (a minimal explicit `applyEdits` upload is the natural shape).

## 5. Changes, one logical unit each

Files: `src/webgpu-mfm/src/MfmWebGPUStepper.ts`, `src/web-worker/src/worker.ts` (plus tests/tooling in §10). Unless stated, evidence class is **[S]** (structure) and **[C]**; **no GPU timing**.

**C1 — one count summary per step.** The step's own command buffer copies death count, reproduction count and event count into a 12-byte staging buffer; one awaited `mapAsync` replaces up to three submit+map pairs. A quiet step now needs **one** serial GPU wait and **no** extra submission.

**C2 — one batched payload round trip.** Death slots, candidate slots, geometry and events are copied in a single submission into two staging buffers mapped concurrently (`Promise.all`). The redundant `onSubmittedWorkDone` is gone: a `mapAsync` on a buffer written by a submission resolves only after that submission completes (same queue, in-order), so the separate wait added only a second completion round trip. Worst case restructure sync is now 2 serial waits instead of 4–9.

**C3 — drop the worker's post-submit `onSubmittedWorkDone` on the stepping path.** `finishNormalSync()` always runs next and begins with the summary `mapAsync`, which completes only after the step submission (compute **and** render) has completed; `transferToImageBitmap()` happens after that. The wait was a second, redundant barrier per step. The paused render-only path has no `finishNormalSync()` and **keeps its wait**.

**C4 — one metrics readback.** `readPopulationMetrics()` copies charge and health once (8 B/particle, one submit, one wait) into a dedicated persistent staging buffer. It replaces `MetricsReducer` (which read health+charge, then discarded its charge sum) followed by `readChargeMetrics` (charge again). Numerics are unchanged: same f32/u32 values summed in JS doubles in slot order. Role lookup uses a per-slot role array rebuilt with the slot mapping instead of a `Map.get` per particle per frame. `MetricsReducer` remains in `webgpu-core` (unused by the worker).

**R1 — restructure the population without reading dynamic state back.** *This is the largest change and the riskiest one; read §7.* Phase 14 answered any death/birth with: full GPU→CPU readback → CPU edit → full CPU→GPU re-upload, solely so the re-upload had the survivors' state. Survivors keep their relative order (insertion-ordered `Map`) and newborns are appended, so the new layout is "old slots minus dead, then newborns". The GPU now performs that permutation itself with `copyBufferToBuffer` of the contiguous surviving runs, from the just-written ping-pong side into the other side (position, velocity, health, charge, **and the pending incoming charge**). The CPU supplies only what it owns or created: newborn initial state and the static columns **from the first shifted slot onward**. `stateIndex`/`incomingIndex` flip to the destination side. Event records are invalidated exactly as before. If the buffer *shape* changes (capacity, maxK, grid) the buffers are recreated and the old readback-and-rebuild path still runs — now tagged `shapeChange`.

**U1 — drop uploads that were provably redundant** (all in the remaining full-upload path, used at init, config change and shape change): the identical copy of the dynamic state written into the *write* side (every kernel reads a write-side buffer only after the kernel that writes it in the same step, all bounded by `i < activeCount`); zeroing the other incoming buffer (`encodeStep` `clearBuffer`s the write side before any `atomicAdd`); zero-filling `selectedTargets` (each `select` pass writes every `(slot, rank)` it later reads); and static columns beyond the live count (every kernel is bounded by `activeCount`). The harness caught that this required `stateIndex = 0` to be selected **before** writing; Phase 14 wrote first and reset after, which is only correct while the stale second copy exists.

**Q0 — stop writing `undefined` into the CPU mirror.** **[F]** A normal-mode readback carries zero-length arrays, which are truthy, so Phase 14 assigned `undefined` to `health`/`charge` of every surviving particle on every normal step (observed by running it). The worker never read those fields for existing particles (it copies them from its own previous copy), which is why nothing visibly broke. Now assigned only when the readback covers the slot.

**Q1 — remove per-step O(N) CPU mirror work from `finishNormalSync`** (CPU-side, inside the sync function; slightly beyond "GPU sync" but it is the window in which the GPU idles, and it is isolated): (a) the per-step `events` map (an object and a `Set` per particle) was **[F] written and never read** — deleted; (b) the evolution callback is skipped when the GPU reported no death and no reproduction candidate: **[F]** with an empty candidate set `createOffspring` runs no loop and consumes **no RNG**, and with no sender-set context the sync function does nothing else.

**D1 — one full-sync implementation, attributed.** The public `syncFullCpuState` delegates to the internal one. Every full readback increments `sync.fullSyncs` and `sync.fullSyncs.<explicit|shapeChange|configChange>`. The explicit/debug/checkpoint/backend-switch path is unchanged in behaviour.

## 6. Results

### 6.1 Structural counts [S] — software device, per-step means

"quiet" = slot mapping unchanged; "restructure" = deaths and/or births that step. One "serial GPU wait" = one time the CPU had to wait on the queue after another wait; overlapping `mapAsync` calls count once. **These are counts, not times.**

**headless** (per-step means; cells are `Phase 14 → Phase 15`; unchanged cells show one value)

| scenario (N/capacity, steps) | quiet / restructure steps | serial GPU waits, quiet | serial GPU waits, restructure | queue submits, quiet | queue submits, restructure | GPU→CPU B, quiet | GPU→CPU B, restructure | CPU→GPU B, restructure | buffers created (run total) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `steady-no-repro` (60/60, 24) | 24 / 0 | 1 | – | 2 → **1** | – | 8 | – | – | 0 |
| `steady-repro-enabled` (60/70, 24) | 24 / 0 | 2 → **1** | – | 3 → **1** | – | 12 | – | – | 0 |
| `single-death` (60/60, 24) | 23 / 1 | 1.7 → **1** | 4 → **2** | 2.7 → **1** | 4 → **3** | 10.6 | 1452 → **12** | 7192 → **3144** | 0 |
| `single-birth` (60/70, 24) | 23 / 1 | 2 → **1** | 6 → **2** | 3 → **1** | 6 → **3** | 12 | 1492 → **52** | 8352 → **316** | 0 |
| `multi-death` (60/60, 24) | 23 / 1 | 1.7 → **1** | 6 → **2** | 2.7 → **1** | 5 → **3** | 10.6 | 1480 → **40** | 7192 → **3256** | 0 |
| `death-and-birth` (60/70, 24) | 23 / 1 | 2 → **1** | 9 → **2** | 3 → **1** | 8 → **3** | 12 | 1520 → **80** | 8352 → **3228** | 0 |
| `shape-change-fallback` (60/60, 24) | 22 / 2 | 1.7 → **1** | 4.5 → **3** | 2.7 → **1** | 4.5 → **3** | 10.9 | 1442 | 7480 → **5356** | 100 → **102** |
| `churn` (60/70, 40) | 25 / 15 | 2 → **1** | 7.7 → **2** | 3 → **1** | 6.7 → **3** | 12 | 1508.3 → **45.9** | 8352 → **1753.3** | 0 |
| `churn-large` (400/440, 40) | 25 / 15 | 2 → **1** | 7.7 → **2** | 3 → **1** | 6.7 → **3** | 12 | 9668.3 → **45.9** | 51272 → **10638.7** | 0 |

**interactive** (per-step means; cells are `Phase 14 → Phase 15`; unchanged cells show one value)

| scenario (N/capacity, steps) | quiet / restructure steps | serial GPU waits, quiet | serial GPU waits, restructure | queue submits, quiet | queue submits, restructure | GPU→CPU B, quiet | GPU→CPU B, restructure | CPU→GPU B, restructure | buffers created (run total) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `steady-no-repro` (60/60, 24) | 24 / 0 | 4 → **2** | – | 4 → **2** | – | 728 → **488** | – | – | 72 → **0** |
| `steady-repro-enabled` (60/70, 24) | 24 / 0 | 5 → **2** | – | 5 → **2** | – | 732 → **492** | – | – | 72 → **0** |
| `single-death` (60/60, 24) | 23 / 1 | 4.7 → **2** | 7 → **3** | 4.7 → **2** | 6 → **4** | 722.8 → **485.4** | 2160 → **484** | 7196 → **3144** | 72 → **0** |
| `single-birth` (60/70, 24) | 23 / 1 | 5 → **2** | 9 → **3** | 5 → **2** | 8 → **4** | 739.8 → **497.2** | 2224 → **540** | 8356 → **316** | 72 → **0** |
| `multi-death` (60/60, 24) | 23 / 1 | 4.7 → **2** | 9 → **3** | 4.7 → **2** | 7 → **4** | 699.3 → **469.7** | 2152 → **488** | 7196 → **3256** | 72 → **0** |
| `death-and-birth` (60/70, 24) | 23 / 1 | 5 → **2** | 12 → **3** | 5 → **2** | 10 → **4** | 732 → **492** | 2240 → **560** | 8356 → **3228** | 72 → **0** |
| `shape-change-fallback` (60/60, 24) | 22 / 2 | 4.7 → **2** | 7.5 → **4** | 4.7 → **2** | 6.5 → **4** | 717.3 → **481.8** | 2144 → **1910** | 7484 → **5356** | 172 → **102** |
| `churn` (60/70, 40) | 25 / 15 | 5 → **2** | 10.7 → **3** | 5 → **2** | 8.7 → **4** | 743.5 → **499.7** | 2241.1 → **534.4** | 8356 → **1753.3** | 120 → **0** |
| `churn-large` (400/440, 40) | 25 / 15 | 5 → **2** | 10.7 → **3** | 5 → **2** | 8.7 → **4** | 4823.5 → **3219.7** | 14481.1 → **3254.4** | 51276 → **10638.7** | 120 → **0** |

Reading the table:

* A **quiet interactive frame** went from 4–5 serial GPU waits, 4–5 submissions, ~12 B/particle read back and **3 buffers + 1 bind group created per frame by the metrics reducer (72 buffers over 24 steps)**, to 2 waits (step summary + metrics), 2 submissions, 8 B/particle and no per-frame buffer creation.
* A **quiet headless step** went from 1–2 serial waits and 2–3 submissions (the extra ones are the separate reproduction-count and death-count round trips) to **exactly 1 wait and 1 submission in every scenario**.
* A **restructure step** at N=400 went from ~9.7 KB read back and 51 KB uploaded to ~46 B read back and ~10.6 KB uploaded, and from 7.7 to 2 serial waits. The remaining uploaded bytes are the shifted static suffix (14 columns × 4 B per shifted slot); a death near the head of the slot order shifts nearly everything.
* The `shape-change-fallback` rows are the **intentionally unchanged** exceptional path (still a full readback and rebuild; 3 waits instead of 4.5 because the count/payload phases improved).

### 6.2 CPU-only orchestration of a quiet step [C]

Real stepper, every compute pass a no-op, Node 22, median of 6 repeats (the cold first repeat discarded), 300 warm-up + 300 measured steps each. This is JavaScript that runs between "GPU returned" and "next submit", i.e. time the GPU would be idle.

| Particles | step mean (ms) | p50 | p95 | `finishNormalSync` | `sync.eventMapBuild` | `sync.evolutionCallback` |
| --- | --- | --- | --- | --- | --- | --- |
| 1 000 | 0.469 → **0.175** | 0.382 → 0.097 | 0.604 → 0.175 | 0.314 → 0.025 | 0.137 → 0.001 | 0.143 → 0.000 |
| 10 000 | 5.06 → **1.06** | 4.32 → 1.02 | 8.29 → 1.43 | 3.93 → 0.033 | 1.92 → 0.001 | 1.75 → 0.000 |

Caveats: Node on this machine, not a browser worker; no IPC; run-to-run spread is visible (per-repeat means in the JSON, e.g. Phase 14 at 1 000: 0.35–0.49 ms) — treat ratios at 10 000 as solid and the 1 000 row as indicative. What remains in a quiet step is `encode` (≈1.0 ms at 10 000, of which `takeSnapshot` is ≈0.53 ms): a per-step O(N) snapshot that is **not** synchronization and was left alone.

### 6.3 Not measured

GPU time, `mapAsync`/`submit` IPC latency, `onSubmittedWorkDone` latency, rendering time, end-to-end timesteps/s and particle-steps/s, step p50/p95/p99 on a real device, timestamp-query data. **No claim is made about any of them.**

## 7. Correctness validation

**Ran (here, with a throw-away ~40-line `describe/it/expect` shim because vitest cannot be installed offline; the shim is not delivered):**

| Check | Result |
| --- | --- |
| `tests/sync-accounting.test.ts` (12 cases) | pass |
| Per-step GPU-state + static-column + pending-incoming + CPU-topology digests vs the **Phase 14 stepper**, 9 scenarios × 2 drivers = 18 runs | **all identical** |
| Same test file pointed at the Phase 14 stepper | trace equality passes, 7 budget/contract tests fail (as they should) |
| Explicit `syncFullCpuState()` after in-place restructures returns exactly the GPU-resident state | pass |
| Behavioural (CPU) 10/10, cpu-reference 7/7, shared-config 11/11, webgpu-core 1/1 | pass on both the Phase 14 tree and this tree (CPU code untouched) |
| `tsc` strict on the changed stepper and worker (`tsc` 6.0.3, `Bundler` resolution) | 0 errors (Phase 14 sources: also 0) |
| Reruns deterministic | yes, both versions |

**Could not run:** `pnpm install/lint/typecheck/test/build`, eslint, real vitest, CI, production build, GitHub Pages deployment, any WebGPU execution, WGSL compilation, `experiment-api` tests (its source uses TS parameter properties the Node type-stripper rejects), the C++ oracle (empty sources). **Therefore the CI-green / build-green / deployment-unaffected criteria are not demonstrated by this phase.** Nothing in the change touches deployment configuration, base paths or workers' loading, but that is an argument, not a test.

**What the validation does and does not establish for R1:** it establishes that, against kernels emulated with the same compaction predicates, the CPU orchestration yields exactly the same GPU-visible state (dynamic, static, incoming) and CPU topology as Phase 14 across head/interior/tail deaths, adjacent deaths, births, death+birth in one step, repeated churn at N=60 and N=400, and the shape-change fallback. It does **not** establish behaviour of the real shaders, real `copyBufferToBuffer` timing, or large-N behaviour. Real-GPU risk for R1 is concentrated in two places: buffer usage flags (`COPY_SRC|COPY_DST` on the state/incoming buffers — enforced by the harness with the stepper's own constants, which match the spec) and the assumption that nothing is still reading the destination side (every prior submission is awaited before restructuring).

**Documented semantic differences** (none change the simulation trajectory the kernels produce):

1. After a restructure, pending incoming charge is the GPU's accumulated value, not a CPU reconstruction from the event list (`computeQOut`). They are equal whenever the CPU `computeQOut` equals the shader's `q_out`, which the design already assumes on every non-restructure step. The CPU `incomingChargeMap` is still maintained for checkpoints.
2. The stepper's CPU `PopulationState` no longer gets a full dynamic refresh as a *side effect* of a restructure. **[F]** audited consumers: the worker takes dynamic fields of existing particles from its own previous copy and of newborns from `createOffspring`; `getState`/checkpoint, inspect, grab and backend switch all call the full sync first. Contract, now explicit: *after a normal step the CPU dynamic fields are not current; call `syncFullCpuState()`.*
3. Q0: `health`/`charge` are no longer `undefined`, they hold their last synchronized value.
4. After a restructure `stateIndex`/`incomingIndex` may be 1 (Phase 14 forced 0).
5. CPU RNG stream unchanged (verified: no RNG consumed in the skipped path). GPU RNG untouched. CPU/GPU remain intentionally non-bit-identical.

## 8. Instrumentation added (additive; Phase 14 JSON schema unchanged)

`readback.roundTrips`/`readback.bytes` now include the summary and payload reads; new counters `sync.fullSyncs.<reason>`, `restructure.inPlace`, `restructure.copyRuns`, `restructure.gpuCopyBytes`, `restructure.inPlaceMs`, `metrics.populationReadbacks`, `metrics.populationReadback.{submit,map,cpuLoop}Ms`; `upload.*` now describes actual bytes; `sync.eventMapEntries` counts processed events (was particle count); `worker.onSubmittedWorkDone*` no longer appears on the stepping path (by design). `webgpu-benchmark.json` picks all of them up automatically through `getProfilingReport()`. New schemas: `cepc-sync-accounting/1` (`"timed": false`) and `cepc-cpu-orchestration/1`.

## 9. Protocol for the real GPU A/B (needs hardware; one command set, two commits)

```bash
# baseline: the Phase 14 tree (the original ZIP)         # candidate: this tree
pnpm install && pnpm exec playwright install chromium --with-deps
pnpm --filter @cepc/react-ui build
pnpm --filter @cepc/react-ui exec vite preview --port 4173 &
node tools/bench/benchmark-webgpu.mjs \
  --base-url http://localhost:4173/continuous-evolutionary-particle-computation/ \
  --sizes 1000,5000,10000 --steps 60 --warmup 20 \
  --out performance/phase15/webgpu-<baseline|phase15>-run<k>.json
```

Run each side **at least 5 times, interleaved** (A B A B …), same machine, same browser build, AC power, compare distributions (p50/p95/p99), not single runs. The existing A/B matrix (render off, metrics off, `stepsPerFrame` 1 and 4) isolates which change moves what: *metrics off* isolates C4; *render off* isolates C3 (the removed wait only exists on the render path); a configuration with frequent deaths/births exercises R1. Note for churn runs: R1 only matters when deaths/births actually occur; check the `population.structureChanged` counter in each result and, if it is near zero, use a configuration that produces deaths/births every few steps (I have not verified how often the default benchmark scenario restructures). Also run `pnpm run benchmark:sync` and `benchmark:cpu`-style comparisons of `worker.finishNormalSyncMs`, `sync.*` and `readback.*` counters.

## 10. Files

Changed: `src/webgpu-mfm/src/MfmWebGPUStepper.ts`, `src/web-worker/src/worker.ts`, `tools/bench/ts-prefer-loader.mjs` (extensionless relative imports resolve to `.ts`, needed to run the stepper under Node), `package.json` (`benchmark:sync`).
New: `src/webgpu-mfm/tests/sync-accounting.test.ts`, `tests/support/{mock-gpu,kernel-emulator,sync-scenarios}.ts`, `tests/golden/phase14-sync-traces.json`, `tools/bench/{sync-accounting,cpu-orchestration}.mjs`, `performance/phase15/*.json`, this report.

## 11. Remaining synchronization, intentionally retained

* **One awaited round trip per step** (the count summary). It is the CPU's only way to learn whether anything needs a topology change; making it asynchronous would mean *deferring* topology decisions by a step, which changes semantics (births/deaths would lag the GPU state). Retained; documented.
* **A second round trip only when a death/candidate exists** (payload) — needed for slot lists, geometry and events.
* **Full readback on buffer-shape change, config change, explicit sync, checkpoint, inspect, grab, backend switch** — each needs a consistent CPU snapshot.
* **Per-frame metrics: still an 8 B/particle readback and still on the frame's critical path** (the worker awaits it before the next frame). Dedicated staging means it can no longer collide with step staging buffers, but it still blocks.
* **Paused-render `onSubmittedWorkDone`** — no other wait exists on that path.
* **Unserialized staging use:** `readPopulationMetrics`/`syncFullCpuState` rely on the worker serializing calls (`stepInFlight`, the render in-flight guard); two concurrent metrics reads would double-map the same buffer. Unchanged hazard, now documented.

## 12. Rejected or deferred, and why

* **GPU-side metrics reduction** (per-workgroup partial sums, ~16 B per 256 particles instead of 8 B/particle). It is the right long-term answer (and the brief's preferred one) but needs a new WGSL kernel I cannot compile or run here; shipping an untested kernel on the metrics path is not justified by *unmeasured* cost. Deferred to the hardware session, with the A/B above deciding whether metrics matter at all. Numerics note for then: per-workgroup f32 partial sums differ from the current all-double sum at ~1e-6 relative.
* **Deferred/double-buffered metrics readback** (consume frame k at frame k+1). Plausible and simple, but changes metric latency by a frame and is only worth it if hardware numbers show the wait matters.
* **Speculative prefix copy of slot lists into the summary** (to make the payload round trip disappear in the common case): heuristic, adds a size threshold; no evidence it is needed.
* **GPU stream compaction / free-list slots** to avoid even the copy runs and the static-suffix upload: a redesign of slot identity; not warranted before measuring.
* **Implementing `syncPartialCpuState`:** no caller exists; build it when a consumer needs it.
* **Removing the paused-render wait, rewriting `readLatestProcessedOutputCharge`:** not on the stepping path; no evidence.
* **Changing `mergeNormalPopulationTopology`** (see §13). Out of scope and worker-level, untested here.

## 13. Evidence for Phase 16

1. **Get the hardware baseline first.** Until §9 is run, every performance statement about WebGPU is a hypothesis.
2. **[C] The worker's per-step population merge looks like the largest remaining CPU-side cost.** `mergeNormalPopulationTopology` rebuilds a `PopulationState` every step (clones every genome, builds a new `ParticleState` and two `Set`s per particle). A Node replica of that code (same allocations) costs **0.81 ms/step at N=1 000 and 47 ms/step at N=10 000** (median of 7×30 steps) — about 45× the stepper's entire post-Phase-15 quiet-step orchestration at N=10 000. It is a *replica in Node, not the browser worker*, so it is **[H]** until `worker.finishNormalSyncMs` is read from a real run. On a quiet step its output equals its input (sender sets unchanged, dynamic fields copied from the previous copy), so a topology-version counter would let the worker skip it; but the worker aliases the stepper's population after a full sync, so this needs care.
3. `encode.snapshotMs` (≈0.53 ms at 10 000): a per-step O(N) snapshot that could be maintained incrementally.
4. The single-thread compaction kernels (`gid.x != 0`) and the single-thread pressure pass are serial O(N) on the GPU — a kernel question for the timestamp-query data, not for this phase.
5. Decide the product question in §4 (`setPopulation` no-op for WebGPU) before building any interaction-related upload.
