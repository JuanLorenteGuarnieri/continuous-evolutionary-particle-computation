# Phase 14 Report: Instrumentation and Benchmarking

Companion to `docs/phases/13-phase13-audit.md` / `13-phase13-audit-verification.md`. Scope, per the Phase 14 brief: establish a reproducible, quantitative measurement system. **Measure → analyze → document.** No simulation/synchronization/metrics redesign in this phase; none was done.

## 0. Environment this phase actually ran in

Same constraints as Phase 13: no network access, no `pnpm`, no browser, no GPU. Node v22.22.2 and npm 10.9.7 only. A genuine `pnpm install → typecheck → lint → test → build`, any `vitest` run, or any WebGPU/browser execution was **not possible here** — that limitation is unchanged from Phase 13 and still applies to everything below labelled "unexecuted."

One capability this phase adds that Phase 13 did not use: **Node's native `--experimental-strip-types`** (available in this Node version) executes `.ts` source directly, without `tsc`/`vitest`. Combined with a small custom resolve hook (`tools/bench/ts-prefer-loader.mjs`, described in §3), this makes it possible to run `@cepc/cpu-reference` and `@cepc/shared-config` for real, and to replay the existing `vitest` test files against a ~40-line `describe/it/expect` shim (used only for verification in this session; it is not part of the delivered tooling and does not replace `vitest`). Everything reported in §5 as "measured" was actually executed this way, in this sandbox. Everything involving WebGPU, a browser, or the interactive app is implemented but **not executed** here, and is marked as such throughout.

## 1. Pre-flight: consistency check against the Phase 13 audit

Per the phase brief, the repository was re-read against the Phase 13 audit/addenda before writing any instrumentation. Two real discrepancies turned up; both are fixed, both are small, and both were verified by actually running code rather than by re-reading.

### 1.1 `MfmCpuReference.ts` `selectTargets` — code and docs had diverged

Addendum 3 of the Phase 13 audit states the fix applied was `item.state.role === 'internal'` (matching `applyMechanics`), mirrored in the WebGPU shader as `role[j] == ROLE_INTERNAL` at all three call sites. **The actual commit (`5f98b52`) applied a different condition**: `item.state.role !== 'input'` in `MfmCpuReference.ts`, and the WebGPU shader (`MfmWebGPUStepper.ts:2718,2756,2799`) already used `role[j] != ROLE_INPUT` — i.e. the CPU and GPU implementations agree with each other, but neither matches what the audit doc says was done. Practical effect: `'output'`-role particles remain valid communication targets under the actual filter (excluded only under the documented-but-not-applied one); the invariant the test cares about — **input never receives communication charge** — holds under either version.

The same commit (`5f98b52`) also changed `cpu-reference.test.ts`'s second assertion in `'keeps input as a non-receiving interface and output as a non-sender'` from `expect(...).toBe(0)` to `.not.toBe(0)` — i.e. it edited the test to expect the *pre-fix* buggy behaviour, in the same diff that fixed the underlying bug. Verified by direct execution (via the Node/strip-types path above) with the code exactly as it now stands: `input.charge` is `0` after both step 1 and step 2. The `.not.toBe(0)` assertion would therefore fail if `vitest` were run today.

**Fixed**: restored `expect(second.particles.get('input')?.charge).toBe(0);` (one line, `src/cpu-reference/tests/cpu-reference.test.ts`). This matches the original assertion, the test's own name, Addendum 2's diagnosis, and the "Clarification" paragraph already present in `13-phase13-audit.md` §2, which independently describes the same invariant. All 7 `cpu-reference` tests pass under direct execution after the fix (§3).

This is a correctness-adjacent fix to a **test assertion**, not to simulation algorithms, and was necessary for this phase's own baseline to be trustworthy (Phase 14 benchmarks the CPU reference directly; running it against a known-inverted test would have been reason to distrust every other number in this report). The CPU/GPU `role` filters themselves were left untouched, per the phase brief's "no simulation redesign."

### 1.2 `src/react-ui/vite.config.js` was silently shadowing `vite.config.ts`

Found while wiring the benchmark harness into the production build (§4.4). Both `vite.config.js` and `vite.config.ts` existed side by side in `src/react-ui/`, with equivalent content. Vite's own config-file search order (`packages/vite/src/node/constants.ts`, `DEFAULT_CONFIG_FILES`) is:

```bash
vite.config.js, vite.config.mjs, vite.config.ts, vite.config.cjs, vite.config.mts, vite.config.cts
```

`.js` is checked **before** `.ts`. Every `vite dev` / `vite build` invocation in this repository has therefore been loading `vite.config.js`, and `vite.config.ts` has had **no effect**, silently, since whenever the two files diverged. They happened to be equivalent until this phase added `build.rollupOptions.input` (for `benchmark.html`, §4.4) to `vite.config.ts` — which would have been silently ignored by the actual build had the duplicate not been found.

The same duplication pattern existed for `vitest.config.{js,ts}` in `react-ui`, `shared-config`, and `cpu-reference`. Those three pairs were byte-for-byte equivalent except for indentation (confirmed by `diff`), so they were not an active bug, but the same latent risk.

**Fixed**: deleted all four stale `.js` duplicates (`react-ui/vite.config.js`, `react-ui/vitest.config.js`, `shared-config/vitest.config.js`, `cpu-reference/vitest.config.js`), keeping the `.ts` versions. Not independently re-verified with a real `vite build` (still blocked by §0); the fix follows directly from Vite's documented/source-confirmed resolution order, not from guessing.

### 1.3 Everything else re-checked

The rest of the Phase 13 acceptance surface (CI workflow structure, `--filter=` quoting fix, `ignoreDeprecations` value, the four stale-`.js`-import fixes to test files, `tools/validate-trajectory.js`'s rewrite to import compiled `dist/` output) was re-read and found unchanged from the state the audit documents, and is not re-litigated here. One adjacent, pre-existing issue was noticed but is **out of scope and left alone**: `tools/validate-trajectory.js` imports from `<package>/dist/...`, which only exists after a real `tsc` build — this affects `pnpm run validate:subset`, not anything Phase 14 built or benchmarks.

## 2. Additional stale-import / type-only-import fixes (needed to execute anything for real)

`--experimental-strip-types` only erases type syntax; unlike Vite/esbuild it does not analyze whether a named import is used only as a type within the importing file, so an `import { X } from './types.js'` where `X` has zero runtime representation throws `does not provide an export named 'X'` under plain Node, even though it works under Vite/tsc's "Bundler" resolution. Five files had this (all corrected to `import type { ... }` or an inline `type` modifier for the one mixed-value/type import); all are otherwise-unrelated to Phase 14's own code and are pure hygiene, verified safe because the affected modules (`types.ts`) export *only* type/interface declarations:

- `src/shared-config/src/Genome.ts` (`RandomLike`)
- `src/shared-config/src/ParticleState.ts` (`Vector2`, `ParticleID`)
- `src/shared-config/src/PopulationState.ts` (`ParticleID`)
- `src/shared-config/src/SimulationSnapshot.ts` (`ParticleID`)
- `src/experiment-api/src/ExperimentRunner.ts` (`ParticleID`, mixed with real value imports — used an inline `type` modifier instead)

Separately, `src/cpu-reference/src/index.ts` still had extensionless relative imports (`'./MfmCpuReference'` etc.) — the same bug class Phase 13 fixed elsewhere, just missed here. Fixed to the `.js`-extension convention already used by the file it re-exports and by `shared-config/src/index.ts`.

A related, **not fixed**, observation: several packages carry stale, checked-in compiled `.js`/`.js.map` files directly beside their `.ts` sources (not under `dist/`, which is `.gitignore`d — these are separate, older artifacts). Under Node's native resolver these can silently shadow the real `.ts` source when a `.js`-extension specifier is used (confirmed while building `tools/bench/ts-prefer-loader.mjs`, which exists specifically to prefer the `.ts` sibling when both are present — see §3). This did not block anything in this phase and was not otherwise investigated (e.g. whether any of those stale files themselves have drifted from their `.ts` source); flagged here as a repository-hygiene item for a maintainability phase.

## 3. Benchmark harness

### 3.1 CPU reference (Node, executed in this sandbox)

- `src/shared-config/src/BenchmarkScenario.ts` — `createBenchmarkScenario({ particleCount, capacity?, density?, seed?, overrides? })`. Builds one `input`, one `output`, and `particleCount - 2` `internal` particles using the React UI's default parameters (read from `main.tsx`), with a deterministic `mulberry32` PRNG (seeded, not the app's own RNG — the two are statistically equivalent, not bit-identical). Domain side scales as `sqrt(particleCount / density)` (default density: 2/unit², the UI default of 200 particles in a 10×10 domain) so neighbourhood size stays roughly constant across `N` — this benchmarks the *implementation's* scaling, not merely "fewer particles find each other in a fixed box." Exported from `@cepc/shared-config`, so the CPU tool, the worker's `runBenchmark`, and the browser harness page all build the *same* scenario definition.
- `tools/bench/ts-prefer-loader.mjs` — a Node `--experimental-loader` resolve hook: (a) prefers a `.ts` sibling over a `.js` specifier (see §2), (b) maps bare `@cepc/<pkg>` specifiers to `src/<pkg>/src/index.ts`, mirroring `tsconfig.json`'s `paths`. Reusable by any future Node-side tooling; not used by the shipped app or by Vite.
- `tools/bench/cpu-benchmark.mjs` — measures `MfmCpuReference.step()` directly. Warm-up steps (unmeasured) + measured steps with `performance.now()` per step, summarized via `summarizeSamples()` (mean/median/p95/p99/stddev, linear-interpolation percentiles). Repeats per size, a wall-clock budget per repeat (a slow size is truncated rather than hanging the run — flagged `truncated: true` in the output rather than silently under-sampling). Wired as `pnpm run benchmark:cpu` (and `pnpm run benchmark`, since this is the only backend this sandbox can execute).

### 3.2 CPU/GPU instrumentation primitives

`src/webgpu-mfm/src/profiling.ts` (dependency-free, unit-tested — see §3.4):

- `CpuSectionProfiler` — accumulates named wall-clock sections and integer counters between `commitStep()` calls (sections may be entered more than once per step; counters likewise). `aggregateCpuRecords()` turns a series of per-step records into per-section/per-counter `SampleStats` (mean/median/p95/p99/min/max/stddev) plus totals and "how many steps touched this at all" — this is what answers "how often does X happen" (e.g. `population.structureChanged`), not just "how long does X take."
- `GpuPassTimestampProfiler` — wraps a `GPUQuerySet` (`type: 'timestamp'`) for per-pass GPU timing. Contract per step: `beginStep()` → `timestampWritesFor(label)` once per `beginComputePass()` (returns `undefined`, so the pass runs unmeasured, when no profiling slot is free or the pass budget is exceeded — never blocks) → `endStep(encoder)` resolves the queries into a ring of mappable readback buffers on the *same* encoder → `afterSubmit()` starts one `mapAsync()` per step, immediately after `queue.submit()` → `collect()` awaits any still-pending readbacks (called between steps or at the end of a run, never inside the timed region). This follows the phase brief's requested architecture directly: one query set reused across the run, timestamp writes grouped per pass, a compact resolve buffer, asynchronous readback, aggregation after the fact — **no CPU/GPU sync point is added per pass**, and if every ring slot is still busy (an outstanding `mapAsync` not yet resolved), the profiler skips instrumenting that step (`droppedSteps` counter) rather than stalling the pipeline.
  - `GpuPassTimestampProfiler.isSupported(device)` checks `device.features.has('timestamp-query')`. `enableProfiling()` (see §3.3) only constructs the profiler when this is true; everywhere else in the profiler and its call sites is written to degrade to "GPU timing simply unavailable" rather than throw.
  - `aggregateGpuSteps()` groups by pass label (`gridClear`, `gridBuild`, `chargeProcess`, `chargeFinalize`, `pressure`, `communicationSelect`, `communicationTransmit`, `localSuccess`, `healthUpdate`, `force`, `mechanics`, `deathCompaction`, `reproductionCompaction`) and by **ordinal within a step** — for the two communication passes, the ordinal is the communication rank, so `meanMsByOrdinal` answers "how does communication cost change with rank" directly, without needing `maxK` as a separate sweep (§4.5 sweeps `maxK` too, for the aggregate cost). Also reports `zeroDurationFraction` and `minNonZeroNs`, because Chromium quantizes timestamp queries (commonly to 100 µs) unless developer flags are set — a pass reported as `0 ns` may be real work below the quantum, not literally free; this field exists so the Phase 15 reader can tell the difference from the data instead of assuming.
  - Local `USAGE_*`/`MAP_MODE_READ` numeric constants match the ones `MfmWebGPUStepper.ts` already defines and uses (`0x0001` / `0x0004` / `0x0008` / `0x0200` / `0x0001`), for the same reason given in that file's own comment (not depending on the ambient `GPUBufferUsage`/`GPUMapMode` runtime globals).

### 3.3 `MfmWebGPUStepper.ts` instrumentation (opt-in)

All additions are guarded by `this.cpuProfiler`/`this.gpuProfiler` being non-null; both are `null` unless `enableProfiling()` is called, so the disabled-path cost is one extra null check per instrumented site and the existing per-step control flow, buffer layout, and synchronization logic are otherwise unchanged.

- `enableProfiling({ cpu?, gpuTimestamps? })` / `disableProfiling()` / `resetProfiling()` / `getProfilingReport()` / `commitProfilingStep()` / `notifyStepSubmitted()` / `collectGpuTimings()` — the public surface the worker (and any future caller) uses.
- CPU sections added around: `readChargeMetrics()`'s submit/map/reduce split; `stepUnsafe()`'s encode/submit/`finishNormalSync` split; bind-group creation (count + time); `prepareEncodedStep()`'s dirty-resync / snapshot / `writeParams` / pass-encoding split; every readback inside `finishNormalSync` individually — death-candidate count, death-candidate slots, reproduction-candidate count+slots, reproduction geometry, event count+data — each tagged with `readback.roundTrips` / `readback.bytes` counters, plus `sync.eventOnSubmittedWorkDoneMs` for the `onSubmittedWorkDone()` call already inside `readbackEvents()`; population update (deaths/births/structureChanged counters); slot-mapping refresh and `resyncAfterPopulationStep` timing; `syncFullCpuStateForSnapshot` timing + `sync.fullSyncs` counter; `uploadPopulationToGpu` timing + byte count; `resync.shapeChanges` / `gpu.bufferRecreations` counters in `recreateGpuBuffers`.
- GPU per-pass timestamps: `dispatchCompute()` (the single shared helper every compute pass already goes through) now requests `timestampWrites` from the profiler and passes it to `beginComputePass()`; a small `passLabelFor()` maps each `PipelineBundle` field to its label for the aggregator. This covers all 13 passes listed in the phase brief (and the currently-unused `forceAllPairsPipeline` fallback, for when it is later wired in) from one instrumented call site, not 13 separate ones.
- Device-side prerequisite (`src/web-worker/src/worker.ts`): `requestDevice()` now feature-detects `adapter.features.has('timestamp-query')` and only requests it in `requiredFeatures` when present (requesting an unsupported feature makes `requestDevice()` reject, so this has to be conditional). Logs which case it hit. This is the one non-instrumentation-module source change needed to make GPU timestamps obtainable at all.

### 3.4 `metrics.ts` instrumentation (opt-in)

`MetricsReducer.profile = true` turns on four timers (`encodeMs`, `submitMs`, `mapWaitMs`, `cpuReduceAndCleanupMs`) plus a `readbackBytes` count, stored in `lastTimings` after each `computeMetrics()` call, and a `lastSetBuffersMs` for the separate `setBuffers()` call. Off by default; adds one `performance.now()`-vs-`profile` check per call when disabled.

### 3.5 `worker.ts`: CPU orchestration timing, a headless WebGPU step, and the benchmark run itself

- `encodeAndSubmitWebGPUStep()` (the interactive per-step-with-render path) now times, into the same `CpuSectionProfiler` the stepper uses: `worker.encodeStepMs`, `worker.renderEncodeMs`, `worker.submitMs`, `worker.onSubmittedWorkDoneMs` (+ a call counter), `worker.finishNormalSyncMs`. `advanceSimulationStep()` (CPU backend) gets the symmetric `worker.headlessStepMs`.
- New `advanceHeadlessWebGPUStep()` — encode + submit + normal sync, **no render pass, no `onSubmittedWorkDone` wait** — the WebGPU-backend equivalent of `advanceSimulationStep()`, used only by the benchmark's `renderEnabled: false` variant. Never used by the interactive app.
- New `runBenchmark(options)` + the `'runBenchmark'` worker message (payload: `particleCount, capacity?, density?, seed?, steps, warmupSteps, stepsPerFrame, renderEnabled, metricsEnabled, gpuTimestamps, parameterOverrides?`). Disposes any existing GPU simulation first (repeated benchmark calls in one worker session must not leak `GPUBuffer`s — `recreateSimulationForBackend()` alone does not free the outgoing one), rebuilds `population`/`currentConfig` from `createBenchmarkScenario`, runs warm-up steps (through the *real* per-step function for the requested backend/renderEnabled combination), resets both profilers, runs the measured steps (timing each frame's steps as one section; timing `metricsReducer.computeMetrics()` + `simulation.readChargeMetrics()` together as `worker.metricsMs` when `metricsEnabled`), then assembles one JSON result (schema in §3.6) and posts it back as `'benchmarkResult'` (or `'benchmarkError'` on failure — a benchmark failure never throws into the worker's normal message loop). This message is additive; it changes nothing about `'init'`/`'frame'`/`'step'`/`'setBackend'`.

### 3.6 Browser harness page and Playwright driver (implemented; **not executed** — no browser/GPU here)

- `src/react-ui/benchmark.html` + `src/react-ui/src/benchmark-main.ts` — a minimal page that creates the *same* worker the app uses (`new Worker(new URL('@worker', ...))`, the existing Vite alias), sends one `'init'` with a small bootstrap population, and exposes `window.__cepcRunBenchmark(options)` (returns a Promise resolving to the JSON result) and `window.__cepcSetBackend('CPU'|'WebGPU')`. Deliberately does not import React/`main.tsx`: this is instrumentation surface, not UI.
- `src/react-ui/vite.config.ts` — added `build.rollupOptions.input` with both `index.html` and `benchmark.html`, so the harness page is part of the production build the phase brief requires benchmarking against (see §1.2 for why this needed the stale-`.js`-config fix first).
- `tools/bench/benchmark-webgpu.mjs` — a Playwright script: launches Chromium (with the commonly-needed WebGPU flags for headless/software-rendering environments), opens `benchmark.html` at a given `--base-url`, waits for `window.__cepcReady`, then drives the A/B matrix from the phase brief (baseline / render disabled / metrics disabled / GPU-timestamps disabled / `stepsPerFrame` sweep) across `--sizes` and both backends, writing one combined JSON (`performance/phase14/webgpu-benchmark.json`) plus a console summary. A run that fails for one configuration is recorded in an `errors` array and does not abort the rest of the matrix.
- `package.json`: `benchmark` → `benchmark:cpu` (works in any Node environment, no browser needed); `benchmark:webgpu` → the Playwright script (needs `pnpm exec playwright install chromium` first, and a built or dev-served app — exact commands are in the script's header comment).

**To actually produce GPU numbers**, from an environment with network access, a GPU, and a browser:

```bash
pnpm install
pnpm exec playwright install chromium --with-deps
pnpm --filter @cepc/react-ui build
pnpm --filter @cepc/react-ui exec vite preview --port 4173 &
node tools/bench/benchmark-webgpu.mjs \
  --base-url http://localhost:4173/continuous-evolutionary-particle-computation/
```

This has not been run anywhere. Everything in §5 onward about GPU passes, `onSubmittedWorkDone` wait time, rendering contribution, or WebGPU population-restructuring cost is **not yet measured** — §6 states precisely what is known from source reading instead, clearly separated from measurement.

### 3.7 Verification performed on the instrumentation itself

`src/webgpu-mfm/tests/profiling.test.ts` — 9 tests against a hand-written mock of the WebGPU calls `GpuPassTimestampProfiler` uses (`createQuerySet`, `createBuffer`, `createCommandEncoder`, `beginComputePass`/`timestampWrites`, `resolveQuerySet`, `copyBufferToBuffer`, `mapAsync`/`getMappedRange`), executed for real in this sandbox (not merely written): percentile/stats math, section/counter accumulation and aggregation, per-pass decode (label, ordinal, ns, sum, span), label/ordinal/group aggregation, the "every readback slot busy → drop, don't block" path, the quantization-detection fields, and the pass-count-overflow path. All 9 pass. This substitutes for exercising a real `GPUDevice` (impossible here) — it does **not** substitute for running the instrumentation against a real adapter, which is why §3.6's Playwright run is still the required next step.

## 4. Measured results — CPU reference (executed in this sandbox)

`performance/phase14/cpu-reference.json` (also produced by `pnpm run benchmark:cpu`). Method: `createBenchmarkScenario`, 3–5 warm-up steps, 15–20 measured steps, 2–3 repeats, density 2/unit² (domain scaled with `N`), seed 42.

**Environment — read this before the numbers**: `node v22.22.2`, `linux 6.18.44-fc-v49 x64`, reported CPU `Intel(R) Xeon(R) Processor @ 2.10GHz`, **1 logical core**, 3.91 GiB total memory. This is a shared, resource-constrained sandbox container, not representative hardware — treat every millisecond figure below as **relative/scaling evidence only**, not as an absolute performance claim about the CPU reference implementation on real hardware, and *especially* not as a proxy for the WebGPU backend, which has a spatial grid the CPU reference may or may not share the asymptotic behaviour of.

| N | median step (ms) | p95 step (ms) | particle-steps/s |
| --- | --- | --- | --- |
| 200 | 3.9 | 10.2 | 38,200 |
| 500 | 17.0 | 29.2 | 27,100 |
| 1000 | 60.7 | 67.5 | 16,200 |
| 2000 | 241.3 | 262.4 | 8,180 |
| 5000 | 1600.6* | 1691.4* | 3,100* |

*N=5000's measured-step loop hit the 20 s per-repeat budget and was truncated (fewer than the requested steps were sampled for that repeat) — flagged `truncated: true` in the JSON; the figures are still real measured step times, just from a shorter sample.

**Scaling (measured, CPU reference only)**: 1000→2000 (2×N) is a 3.98× time increase; 2000→5000 (2.5×N) is a 6.64× increase. Both are much closer to the ×4 / ×6.25 a pure O(N²) neighbour search predicts than to linear. This is consistent with — but does not by itself prove — an all-pairs or near-all-pairs neighbour search in the CPU reference implementation; it was not inspected further because Phase 14 is measurement, not optimization, and this number says nothing about the WebGPU backend's spatial grid, which is a separate, uninspected-this-phase code path.

## 5. What is verified from source but not yet measured

These are facts read directly from `MfmWebGPUStepper.ts`/`worker.ts` during the pre-instrumentation pass (§0's "understand before modifying"), not benchmark output. Listed here, separately from §4 and §6, per the phase brief's instruction not to blur measured/hypothesis/fact.

- **Pass structure per step** (`encodeStep`/`prepareEncodedStep`): grid clear → grid build → charge process → charge finalize → pressure → (communication select → communication transmit) × `maxK` → local success → health update → force → mechanics → death compaction → reproduction compaction, then a small event-count copy into a readback buffer, all in one command encoder/submission — matching the pass list in the phase brief exactly.
- **`onSubmittedWorkDone()` appears in two places**: once in the interactive per-step-with-render path (`encodeAndSubmitWebGPUStep`, unconditionally, after every step), and once inside `readbackEvents()` (only reached when a death or reproduction candidate exists that step). The headless path (`stepUnsafe`/`advanceHeadlessWebGPUStep`) does not call it directly, but its `mapAsync()` calls inside `finishNormalSync` still wait on the same single GPU queue, so they are not free of GPU-wait time — just not through this specific API.
- **`finishNormalSync` performs up to six separate submit+`mapAsync` round trips per step** even on the "normal" (non-full) sync path: death-candidate count, (if >0) death-candidate slots, reproduction-candidate count, (if >0) reproduction-candidate slots, (if >0) reproduction geometry, and (if either count was >0) the event count + event data. Each is its own tiny `GPUCommandEncoder`/`submit`/`mapAsync`. This is exactly the kind of "queue submission and synchronization" cost area the phase brief calls out; §3.3's `sync.compactReadbackMs`/`readback.roundTrips` counters exist specifically to quantify it once a real device is available.
- **`stepsPerFrame > 1` re-renders and re-syncs every inner step**, not just the last one, for the WebGPU backend (`renderAndSendBack`'s loop calls the full `encodeAndSubmitWebGPUStep()`, render pass and `onSubmittedWorkDone()` included, `stepsPerFrame` times before the frame is finally read back). This is a plausible source of the "may serialize simulation and rendering" effect the phase brief anticipated; §3.6's `stepsPerFrame` sweep (once run) is what would confirm or refute it as a real cost, not just a plausible one.
- **The Chrome trace's stated limitation stands unchanged**: nothing in this repository or this phase adds per-compute-pass GPU hardware timing beyond the timestamp-query instrumentation itself, which needed a real device to produce data and did not get one here.

## 6. Explicit non-goals / what did not happen this phase

- No simulation, synchronization, or metrics **redesign** — `onSubmittedWorkDone()` was not removed, compaction was not parallelized, communication was not rewritten, no passes were fused. The only non-instrumentation source changes are the two-line `role` filter's *test* fix (§1.1), five type-only-import fixes (§2), the `requiredFeatures: ['timestamp-query']` feature-detection addition (§3.3), and the stale-config-file deletions (§1.2) — each independently justified above, none touching simulation semantics.
- No GPU numbers, because no GPU was available. §4 is CPU-reference-only.
- No re-run of `pnpm run lint/typecheck/test/build` or CI — still blocked exactly as in Phase 13 §0; nothing in this phase changes that blocker. `git status` is clean going in (matches the "Phase 13 complete" starting point) and every file touched this phase is listed in §7.
- No changes to `docs/phases/13-*.md` beyond citing them; Phase 13 itself was not "redone."

## 7. Files touched this phase

**New**: `src/webgpu-mfm/src/profiling.ts`, `src/webgpu-mfm/tests/profiling.test.ts`, `src/shared-config/src/BenchmarkScenario.ts`, `src/react-ui/benchmark.html`, `src/react-ui/src/benchmark-main.ts`, `tools/bench/cpu-benchmark.mjs`, `tools/bench/benchmark-webgpu.mjs`, `tools/bench/ts-prefer-loader.mjs`, `tools/bench/register-loader.mjs`, `performance/phase14/cpu-reference.json`, this report.

**Modified**: `src/webgpu-mfm/src/MfmWebGPUStepper.ts` (§3.3), `src/webgpu-mfm/src/index.ts` (export profiling), `src/web-worker/src/worker.ts` (§3.5, §3.3's feature request), `src/webgpu-core/src/metrics.ts` (§3.4), `src/react-ui/vite.config.ts` (§1.2, §3.6), `package.json` (benchmark scripts), `src/cpu-reference/src/index.ts` / `src/cpu-reference/tests/cpu-reference.test.ts` (§1.1, §2), `src/shared-config/src/{Genome,ParticleState,PopulationState,SimulationSnapshot,index}.ts` (§2), `src/experiment-api/src/ExperimentRunner.ts` (§2).

**Deleted**: `src/react-ui/vite.config.js`, `src/react-ui/vitest.config.js`, `src/shared-config/vitest.config.js`, `src/cpu-reference/vitest.config.js` (§1.2).

## 8. Evidence-backed candidates for Phase 15+ (hypotheses, not conclusions)

Framed the way the phase brief asks — as candidates the measurements in §3.3/§3.6 (once actually run) would confirm or refute, not as findings:

1. Communication (`communicationSelect`/`communicationTransmit` × `maxK`) is the pass group with the most repeated GPU work per step by construction; `meanMsByOrdinal` and the `maxK` sweep (§3.6) are what would show whether it is also the dominant *time* cost.
2. The multi-round-trip readback chain inside `finishNormalSync` (§5) is a synchronization-overhead candidate independent of whether any given step has deaths/reproductions, since the death/reproduction *count* readback happens unconditionally.
3. Per-step `onSubmittedWorkDone()` plus `stepsPerFrame`-many render passes (§5) is a candidate for why raising `stepsPerFrame` might not scale throughput as expected — the `stepsPerFrame` sweep and the render-disabled A/B (§3.6) together are what would isolate this from ordinary simulation cost.
4. `MetricsReducer.computeMetrics()` + `readChargeMetrics()` run every frame unconditionally when a metrics reducer exists; §3.6's metrics-disabled A/B is what would quantify it against §4's CPU-only baseline noise floor.

None of these should be treated as established until §3.6 is actually run.

## Addendum: real Windows run found a broken assumption in §1.1/§2 — fixed

The user ran `pnpm run lint/typecheck/test/build/deploy` and `vite dev` for real on Windows. `lint`, `typecheck`, and `build` all passed. Two things did not:

1. `cpu-reference` test still failed the same assertion §1.1 claims to have fixed (`expected 1 to be +0`).
2. The interactive dev server crashed on every step: `simulation.notifyStepSubmitted is not a function` at `worker.ts:353`, immediately followed by `Cannot encode a WebGPU step while another step is in flight` thrown from **`MfmWebGPUStepper.js:286`** — not `.ts`.

That second stack trace is the tell: `notifyStepSubmitted` is a real method on the `.ts` class I added in §3.3 (typecheck agrees — it passed), but the error came out of a file with a `.js` extension. **§2 mischaracterized this repository's core problem.** It is not "extensionless vs. `.js`-extension import style." Every package in `src/` has stale, checked-in, compiled `.js`/`.js.map` siblings sitting directly next to their `.ts` sources (not under the git-ignored `dist/`) — 52 files in total, across every package, including `MfmWebGPUStepper.js`, `MfmCpuReference.js`, and (missed entirely in the original sweep, which only checked `.ts`→`.js` pairs and not `.tsx`→`.js`) `react-ui/src/main.js`. Both Vite's resolver and Node's resolver pick a literal, already-existing `.js` file over inferring one from a `.ts`/`.tsx` sibling — **regardless of whether the importing specifier is written as `./Foo` or `./Foo.js`**. So this was never fixable by changing import-specifier style (§2's fix); the stale files themselves had to go. `git log` on `MfmWebGPUStepper.js` shows it was last rewritten by `bb6ffb5` ("parched validate depencencies," the same Phase-13-era commit that pointed `tools/validate-trajectory.js` at `dist/` output) — almost certainly an accidental `tsc` invocation that wrote next to `src/` instead of into `dist/`.

Why this didn't surface during Phase 14 itself: every verification in this report ran through `tools/bench/ts-prefer-loader.mjs`, which was written specifically to prefer a `.ts` sibling over a `.js` specifier — so my own tooling silently routed around the exact bug it should have caught. The `.ts`-preference behavior is correct and worth keeping in that loader (§3.1), but it means "runs clean under my own harness" was never sufficient evidence that the real app or real `vitest`/`vite` (neither of which has this preference) would behave the same way. That gap is on this phase's own verification, not on the environment.

**Fixed**: deleted all 52 stale `.js`/`.js.map` files under `src/` (every package; `.d.ts`/`.d.ts.map` left untouched — they carry no executable code and aren't implicated). Re-ran the CPU benchmark afterward; numbers are consistent with §4 (expected, since the loader was already bypassing these files). The `cpu-reference` test and the dev-server crash should now resolve, because `vitest`/`vite` will finally load the `.ts` sources this report was written against. **Not yet re-confirmed on real hardware** — please re-run the same four commands (`lint`, `typecheck`, `test`, `build`) plus `vite dev` and let me know. If `test` still fails or the dev server still throws, that means something else is going on and I'd want the new stack trace.

One consequence worth flagging: if any other package's `dist/` output currently in your checkout was produced by building the *old* (pre-Phase-14) `.ts` sources, `tools/validate-trajectory.js` and `tests/behavioral/run-tests.js` (which import from `dist/...` paths per Phase 13's audit) will reflect that old build until you rebuild. Neither is part of `lint`/`typecheck`/`test`/`build`/`deploy`, so this shouldn't affect what you just ran.
