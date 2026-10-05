# Phase 18 — grid-force kernel: cell-sorted neighbour enumeration

Status: **implemented, validated on device, measured on one GPU (Intel HD Graphics 520).** Both candidates are accepted; the default
was `forceKernel: 'linked-list'` at the end of Phase 18; **Phase 19 made `sorted-culled` the default** (the Phase 15 golden traces now pin `linked-list` explicitly, see docs/phases/19-*.md). Measured results: sections 18.3 (validation), 18.5 (comparison). Raw data: `performance/phase18/`.
Scope was set by the maintainer: analyse the `force` kernel (and any other dominant stage) and make it faster without changing the
MFM logic. No render timestamps and no `reproductionCompaction` work (explicitly out of scope).

Legend: **[source]** verified in the code, **[model]** computed with a CPU model of the algorithm (not hardware), **[phase17]** measured
in Phase 17 on an Intel HD Graphics 520, **[hypothesis]**, **[implemented]**, **PASSED** (see 18.5) needs the hardware run.

## 18.1 Starting state

- **[phase17]** `force` is 86–91 % of GPU compute for N ≥ 1000, ≈ 0.9–1.0 µs per particle (N = 10000: ≈ 9 ms). Workgroup size 32/64/256 gave
  no gain (rejected in Phase 17); pressure parallelisation rejected; fusion deferred.
- **[source]** The kernel (`shaderForce`) runs one thread per particle and walks the 3 × 3 neighbour cells through `cellHead` / `particleNext`
  atomic linked lists. Per candidate it loads `particleNext[j]` (a *dependent* load: the next address is unknown until the previous load
  returns) and `positions[j]`, evaluates `periodicDelta` (two divisions) and tests the range; only in-range candidates load
  `targetRs/targetA/velocities[j]` and evaluate three `feature()` calls.
- **[source]** Cell size = `max(R_s_max, …)` = 5.0, so each particle tests the whole 3 × 3 block (area 225) although its range is
  `R_s_min + (R_s_max − R_s_min)·q/Qmax` ∈ [0.5, 5].
- Phase 17's own test/typecheck/lint/build gate passed on this exact ZIP (stated by the maintainer).

## 18.2 Bottleneck analysis

Benchmark geometry: density 2 / unit², N = 10000 → L = 70.7, 14 × 14 cells of size 5.

| Quantity **[model]** (uniform draw of charge in [0, qmax), 10 000 particles) | q<100 | q<50 | q<20 | q<10 |
| --- | ---: | ---: | ---: | ---: |
| candidates distance-tested per particle, 3 × 3 cells | 460 | 460 | 460 | 460 |
| in-range neighbours per particle | 57 | 19 | 5.8 | 3.2 |
| fraction of tests that are in range | 12 % | 4 % | 1.3 % | 0.7 % |
| candidates tested with exact cell culling (`sorted-culled`) | 220 | 136 | 96 | 84 |

Reading: **[model]** the kernel tests ≈ 460 candidates to find ≤ 57 interacting ones, so the work is dominated by rejected candidates, each
costing a dependent global load + a periodic-delta with two divisions. **[hypothesis]** the kernel is limited by memory latency of the
list walk and by wasted arithmetic on rejected candidates rather than by the force law itself (the in-range path is a handful of flops);
this cannot be confirmed without a profiler on the device. The *actual* charge distribution of the running simulation is not in the
benchmark output, so the culling column is a range, not a prediction. Scaling **[source/model]**: candidates per particle are
independent of N at fixed density (≈ 460), so the force cost is linear in N, and proportional to density × cell area.

Other stages: per Phase 17 they are < 14 % of compute at N ≥ 1000, so none is a justified target before `force` is fixed.
`communicationSelect` uses the same linked lists and could reuse the sorted layout later (not done: not a measured bottleneck).

## 18.3 Implemented changes (candidates — one mechanism each, selectable)

Option `KernelOptions.forceKernel`: `'linked-list'` (Phase 17 final kernel; the default until Phase 18, since Phase 19 the default is `'sorted-culled'`) | `'sorted'` | `'sorted-culled'`. CLI: `--force-kernel <mode>`.

**F1 `sorted`** — *problem:* dependent-load chain and scattered reads. *Hypothesis:* a counting-sort of the particles by cell turns each
cell into a contiguous range (independent, coalesced loads), and ordering the threads by cell makes neighbouring threads share the same
ranges. The three loop-invariant neighbour features are computed once per particle instead of once per pair.
*Mechanism:* new passes `clearBuffer(cellCount)`, `sortCount` (atomic count per cell), `sortScan` (one 256-thread workgroup,
chunked Hillis–Steele exclusive scan, total at `cellStart[cells]`, re-zeroes the counters), `sortScatter` (slot = start + atomic cursor;
writes `sortedIndex`, `sortedGeo = (x, y, f(Rs), f(A))`, `sortedFv = f(|v|)`), then `force` with thread *s* handling `sortedIndex[s]`.
Same cell definition as `gridBuild`, same neighbour-cell rules (1- and 2-cell grids), same range/threshold/force-law/feature
expressions (asserted textually by `force-sorted-shaders.test.ts`). The linked-list grid is still built (communication uses it).
*Cost:* 3 extra compute passes + 1 clear per step, 5 buffers (≈ 40 B per particle slot + 4 B per cell), created lazily only when a sorted
mode is selected. **Expected risk [hypothesis]:** the extra passes may make small N (≤ 500) slower; this is exactly what the A/B must show.

**F2 `sorted-culled`** — F1 plus skipping a neighbour cell when the distance from the particle to that cell's rectangle already
exceeds its range (+1e-4 cell sizes slack for f32 cell assignment). The rectangle accounts for the wider last cell and for the periodic
images of wrapped cells. Enabled only with ≥ 4 cells per axis; below that the kernel behaves as `sorted`. *Why ≥ 4:* with 3 cells a pair
could be reachable through another periodic image than the one the skipped cell implies; for ≥ 4 cells the minimum-image bound
(|Δ| < 3·cell ≤ L − range) rules that out (argued in `force-grid-model.ts`; covered by tests).

**Semantics.** The set of interacting pairs and every per-pair term are unchanged. The *summation order* of the force differs, so forces
agree to f32 rounding, not bit-for-bit. This is not a new class of difference: the linked-list order already depended on the arrival
order of `atomicExchange` and varied between runs. **No model change.** If you consider reordering of a float sum a model change, select `linked-list`.

**Correctness validation done here (algorithm level, float64, Node):**

- `force-grid-variants.test.ts` — 31 cases: all three traversals equal an O(N²) periodic brute force (same in-range count, relative error
  < 1e-9) on grids of 1×1 … 14×14 cells, wide last cells, particles on cell borders and on the domain seam, shuffled atomic order; plus
  "culling never increases tests and cuts them > 40 % on low-charge populations". **Passed (run locally with a minimal vitest shim, see Limits).**
- `force-sorted-shaders.test.ts` — 9 cases: bindings/access modes vs the layouts the stepper builds, force-law lines unchanged,
  `sortCellOf` = `gridBuild` cell formula, features = linked-list expressions, and a line-by-line emulation of `sortScan` against a serial
  prefix sum for 1 … 262 144 cells. **Passed.**
- `force-sorted-orchestration.test.ts` — 11 cases on the mock device: default path dispatches no sort pass and compiles no sort pipeline;
  sorted modes add exactly `sortCount, sortScan, sortScatter` right before `force` and leave the rest of the step identical through churn,
  shape change and death/birth; buffers never referenced after destruction; modes can be switched mid-run. **Passed.**
- Existing suites re-run unchanged: `orchestration` 15/15 (Phase 15 golden dispatch traces identical for the default mode),
  `sync-accounting` 13/13, `death-compaction-scan` 49/50 where the one failure is a limitation of my local shim (`not.toContain`), not of the code.
- `tsc` over the changed modules with a stubbed WebGPU type surface: 0 errors.

**Limits of that validation (be explicit).** The sandbox has no GPU, no network and no pnpm/vitest, so: (a) the WGSL was **never compiled** here;
(b) `pnpm typecheck / lint / test / build` were **not run** (only the substitutes above); (c) no benchmark number exists. The on-device check is
`kernel-selftest.ts` (`forceCases`): it compiles the shipped WGSL of all five new/old kernels, runs them on identical populations
(1…14 cells/axis, several charge ranges, seam particles, input/output roles), verifies the counting-sort layout and requires both sorted
kernels to equal the linked-list kernel within 1e-4 + 1e-4·|F|. **PASSED** (see 18.5)

**Performance ledger:** `performance/phase18/ledger.json` (both candidates `keep`; none rejected). Baseline = Phase 17 final (`ab-linked`).

## 18.4 Rejected experiments

None. Both candidates met the acceptance rule below. Phase 17 rejections stand and were not re-introduced.

## 18.5 Measured comparison (Phase 18 start -> end, same methodology as Phase 17)

**Data and validity.** 15 files (3 kernels x 5 interleaved rounds), 6 sizes, 2 variants, 100 measured + 30 warm-up steps, GPU timestamps on.
Every file records the expected `forceKernel`; adapter identical (Intel HD Graphics 520, Chrome 153); 0 dropped steps, 0 anomalous / overflowing /
zero-duration passes, 0 readback errors. Rounds 1-2 were slower than 3-5 for *all* kernels (system warm-up), so comparisons are paired within a
round and rounds 3-5 were checked separately (same conclusions). One device, 5 rounds: effects below ~5 % are not resolvable.

**On-device self-test (kernel-selftest.json): passed.** 56 death-compaction cases plus 10 force cases (1x1 ... 14x14 cells, seam particles, roles):
counting-sort layout valid in all; max deviation of both sorted kernels from the linked-list kernel <= 0.026 of the tolerance (1e-4 + 1e-4|F|),
i.e. ~2.6e-6 absolute on forces up to 6.8. `sorted` and `sorted-culled` show identical deviations to full precision in all 10 cases, consistent with
culling removing only cells that contribute nothing.

**Local effect — `force` pass, ms (median of 5 rounds, render disabled):**

| N | linked-list | sorted | sorted-culled | sorted / linked | culled / linked |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 200 | 0.363 | 0.257 | 0.255 | 0.70 | 0.70 |
| 500 | 0.952 | 0.601 | 0.600 | 0.62 | 0.62 |
| 1000 | 1.589 | 0.778 | 0.608 | 0.49 | 0.38 |
| 2000 | 2.005 | 0.765 | 0.588 | 0.38 | 0.30 |
| 5000 | 4.602 | 1.361 | 0.824 | 0.30 | 0.18 |
| 10000 | 9.405 | 2.657 | 1.605 | 0.28 | 0.17 |

New passes cost 0.094 ms (N=200) to 0.196 ms (N=10000) in total (`sortScan` is a constant ~0.044 ms, `sortScatter` grows 0.031 -> 0.107 ms).
**Net GPU time per step** (all passes): N=200 0.566 -> 0.585 / 0.578 (neutral; within noise, 3/5 paired wins); N=500 -22 %; N=1000 -38 % / -47 %;
N=2000 -48 % / -56 %; N=5000 -60 % / -70 %; N=10000 -63 % / -73 % (sorted / culled). All unchanged passes stayed within noise (ratios 0.95-1.06).

**End-to-end — steps/s, median of 5 rounds (paired ratio vs linked in brackets):**

| N | render off: linked | sorted | culled | render on: linked | sorted | culled |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 200 | 107.8 | 129.2 (1.07) | 130.2 (1.07) | 88.6 | 105.0 (1.01) | 106.4 (1.14) |
| 500 | 112.1 | 128.2 (1.05) | 125.7 (1.02) | 80.3 | 102.5 (1.06) | 102.7 (1.06) |
| 1000 | 110.1 | 126.4 (1.12) | 126.7 (1.13) | 70.4 | 88.4 (1.06) | 91.6 (1.07) |
| 2000 | 105.6 | 122.0 (1.18) | 118.4 (1.18) | 67.9 | 68.6 (1.09) | 71.0 (1.05) |
| 5000 | 78.9 | 104.6 (1.41) | 112.7 (1.53) | 41.0 | 45.2 (1.13) | 46.3 (1.20) |
| 10000 | 52.1 | 84.6 (1.57) | 92.7 (1.72) | 21.7 | 24.0 (1.15) | 25.4 (1.19) |

Step wall time at N=10000: render off 15.3 -> 8.1 / 7.1 ms; render on 37.9 -> 32.2 / 30.4 ms. Paired sign test (candidate faster in the same round): render off, step
time 5/5 at N>=1000 for both; render on 5/5 only at N=5000 and 10000 (weaker below). The official comparison tool labels most end-to-end deltas "within noise" because
its band is wide (it includes the slow rounds 1-2); the GPU and `force` deltas are "beyond noise" from N=500 (and `force` at every N).

**Scaling [measured].** `force` time per particle at N=10000: 0.94 / 0.27 / 0.16 us (linked / sorted / culled); log-log slope of `force` time vs N for N=5000..10000 is
1.03 / 0.97 / 0.96, i.e. linear, as predicted by the candidate count (~460 per particle, independent of N). Up to N=2000 the time does not grow with N
(sorted: 0.778 ms at N=1000, 0.765 ms at N=2000), so there the kernel is latency/under-occupancy-bound, not throughput-bound; fewer candidates per thread (culling) still helps there.
Cost per candidate visit (N>=2000, assuming ~460-500 visits): ~2.0 ns linked, ~0.6 ns sorted.

**Acceptance rule (set in 18.3): met.** End-to-end improvement outside the noise band at N>=2000 (render off, 5/5 paired wins) and no regression at N=200-500 (neutral).

## 18.6 Remaining bottlenecks [measured]

- GPU compute at N=10000 (sorted-culled, 2.75 ms): `force` 1.61 ms (59 %), `deathCompaction` 0.59 ms (22 %, linear in N), sort passes 0.20 ms (7 %), other ten passes 0.32 ms (12 %).
- The GPU is now a minority of the step: GPU share of step+metrics cycle is 6-8 % at N=200 and 26 % at N=10000 (was 54 %). Non-GPU part of the headless step is a ~3.2-4.5 ms
  floor and `readPopulationMetrics` costs ~3.1-3.9 ms per frame, both roughly independent of N and unchanged by this phase.
- With rendering on, the render-on minus render-off step difference is 22-24 ms at N=10000 for all three kernels (75 % of the render-on step now). It was explicitly out of scope
  and is not decomposed here (the two variants also use different step code paths, see 18.2); it is a measured fact about the variants, not an attributed render-pass cost.
- Unexplained, small: a ~76 ms single-step spike per run in both candidates at N=10000 render-on in rounds 3-5 (linked max 54-68 ms; mean/median/p95 still improve); `chargeProcess` at N=5000 is
  0.038 ms in 4/5 linked rounds vs 0.026 ms for the candidates (unchanged kernel, 0.2 % of the step).
- Culling's gain depends on the charge distribution (the scenario starts at charge 0; the evolved distribution is not recorded). Its relative benefit rose with N (22 % at N=1000, 40 % at N=10000), for a reason not established.
- Single device (integrated Intel gen-9). No data for discrete GPUs or other browsers.

## 18.7 Recommended next phase (not started)

1. Decide on the default: `sorted-culled` is never slower than `sorted` in these data and equal below 4 cells/axis. Making it the default requires regenerating the Phase 15 golden dispatch traces (they pin the default step).
2. Record charge and neighbour-count histograms in the benchmark output to explain the N-dependence of the culling gain.
3. `deathCompaction` is now the second GPU cost (0.59 ms at N=10000, linear); candidate for a Phase 17-style look.
4. Non-GPU floor (~3-4.5 ms) and per-frame metrics readback (~3-4 ms) dominate at N<=2000 and are now a larger share than all GPU work at every N tested with render off.
5. Optional micro-optimisation of `force`: replace the per-candidate `periodicDelta` divisions by a per-cell shift (bit-identical for in-range pairs, argued in `force-grid-model.ts`).

## Files

Changed: `src/webgpu-mfm/src/MfmWebGPUStepper.ts` (option, lazy buffers, 3 pipelines, per-family force layout, shaders, dispatch),
`src/webgpu-mfm/src/profiling.ts` (labels `sortCount/sortScan/sortScatter`, group `forceSort`), `src/webgpu-mfm/src/kernel-selftest.ts`
(force cases, fresh adapter), `src/react-ui/src/benchmark-main.ts` (option type), `tools/bench/benchmark-webgpu.mjs` (`--force-kernel`),
`src/webgpu-mfm/tests/support/kernel-emulator.ts` (mock labels). Added: `src/webgpu-mfm/src/force-grid-model.ts` (test-only model),
three test files, `tools/bench/run-phase18-ab.ps1`, `performance/phase18/*` (raw JSON, `ab-comparison.*`, `ledger.json`), this report.
