# Phase 17 — GPU kernel and compute optimization

**Status: CLOSED on measured evidence.** One optimization accepted (Candidate 1, parallel death compaction: −75 % to −94 % of that pass's GPU time, −46 % of total GPU compute at N ≥ 5000, +19 % to +52 % particle-steps/s with rendering off at N ≥ 2000), one experiment rejected (Candidate 2, force workgroup size), the hotspot list and ledger are final. The only open item is the repository-wide validation run listed under *Validation status* (typecheck / lint / test / build), which has to be executed with the project toolchain and was not run by the author of this report.

Legend: **[source]** verified in code · **[measured]** hardware measurement · **[hypothesis]** not verified · **[validated]** checked as stated.
All hardware numbers come from ONE device: **Intel HD Graphics 520 (gen-9, integrated), Chrome 153.0.8010.12, `--real-gpu`, headed, `timestamp-query` granted, 0 dropped steps, `zeroDurationFraction` = 0 everywhere.** Nothing here says how a discrete GPU behaves.

## Objective

Reduce the measured GPU execution time of the simulation compute workload without changing simulation semantics, one measured mechanism at a time.

## Starting baseline

- **[source]** Phases 14–16 contain no GPU time: `performance/phase14` holds only `cpu-reference.json`; every Phase 16 WebGPU artifact has `gpuTimestampsSupported:false`, `adapterInfo:null`, `gpu:null` (software-rendered, stepper apparently not in use). Phase 17 therefore establishes the **first hardware GPU baseline**; cross-phase timing comparison with Phases 14–16 is not possible (see `performance/benchmark-history.md`).
- **[measured] Baseline** (`webgpu-ab-baseline-run{1..5}.json`, Phase 16 kernels pinned explicitly): seed 42, density 2, capacity = N, 100 steps after 30 warm-up, 1 step/frame, normal synchronization, orchestration defaults, **5 interleaved rounds**, medians; N = 200, 500, 1000, 2000, 5000, 10000; variants *baseline* (render + metrics on) and *renderDisabled* (compute isolation). An earlier 3-round run (`webgpu-baseline-run{1..3}.json`, N ≤ 2000, also with *metricsDisabled* and *gpuTimestampsDisabled*) agrees with it.

## GPU execution inventory

**[source]** WGSL is inline in `src/webgpu-mfm/src/MfmWebGPUStepper.ts`; passes are timed per label by `profiling.ts`. Workgroup size 128 except `pressure` (1) and the death-compaction kernels (one workgroup). R = read-only storage, RW = read-write storage.

| Pass (timestamp label) | Group | Workgroup | Workgroups per dispatch | R | RW | Atomics |
| --- | --- | ---: | --- | --- | --- | --- |
| gridClear | grid | 128 | ceil(cells/128) | - | cellHead | atomicStore |
| gridBuild | grid | 128 | ceil(N/128) | positions | cellHead, particleNext | atomicExchange |
| chargeProcess | charge | 128 | ceil(N/128) | chargeIn, incomingCharge, role, thetaQ, amplification | qResidual, activeFlags, qOut | - |
| chargeFinalize | charge | 128 | ceil(N/128) | qResidual | chargeOut | - |
| pressure | pressure | 1 | 1 | charges, role | pressureOut | - |
| communicationSelect | communication | 128 | ceil(N/128) per rank (maxK) | positions, velocities, role, idHash, targetRs, targetA, sourceRc, sourceK, omegaR, omegaA, omegaV, activeFlags, particleNext | cellHead, selectedTargets, selectedCount | atomicLoad |
| communicationTransmit | communication | 128 | ceil(N/128) per rank | qOut, selectedTargets | incomingNext, eventCount, eventSender, eventTarget | atomicAdd |
| localSuccess | localSuccessAndHealth | 128 | ceil(N/128) | incomingPrevious, activeFlags, selectedCount | successful | - |
| healthUpdate | localSuccessAndHealth | 128 | ceil(N/128) | healthIn, role, hmax, successful, pressure | healthOut | - |
| force (grid) | force | 128 (switchable 32/64/128/256) | ceil(N/wg) | positions, velocities, charges, role, targetRs, targetA, omegaR, omegaA, omegaV, particleNext | cellHead, force | atomicLoad |
| mechanics | mechanics | 128 | ceil(N/128) | positionsIn, velocitiesIn, force, role, mass, gamma | positionsOut, velocitiesOut | - |
| **deathCompaction** | compaction | 128 | **1** — `parallel` (default): 128 threads tile-scan; `serial` (Phase 16): only invocation 0 works | healthOut, role | deathCount, deathSlots | - |
| reproductionCompaction | compaction | 128 | **1, serial pattern**; runs only if `mating_probability > 0 && particleCount < Nmax` | positions, velocities, healthIn, healthOut, role, mateThreshold, successful | candidateCount, candidateGeometry, candidateSlots | - |

Other **[source]** facts: the all-pairs force dispatch is commented out (grid force only); `forceAllPairs` has a pass label but is absent from `MFM_PASS_LABELS`/`MFM_PASS_GROUPS` (inactive path). Timestamp groups: grid, charge, pressure, communication, localSuccessAndHealth, force, mechanics, compaction; select/transmit and death/reproduction compaction are separate labels. The benchmark scenario issues one dispatch per label per step (maxK = 1) and never triggers `reproductionCompaction` (capacity = N).

## GPU cost model

### Before (Phase 16 kernels) — mean GPU ms per step per pass, median of 5 rounds, render + metrics on

| pass | N=200 | N=500 | N=1000 | N=2000 | N=5000 | N=10000 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| deathCompaction | 0.208 (28.8%) | 0.481 (30.4%) | 0.963 (35.9%) | 1.896 (47.1%) | 4.777 (49.8%) | 9.503 (49.6%) |
| force | 0.367 (50.9%) | 0.949 (59.9%) | 1.557 (58.2%) | 1.957 (48.6%) | 4.585 (47.8%) | 9.368 (48.9%) |
| mechanics | 0.015 (2.1%) | 0.016 (1.0%) | 0.018 (0.7%) | 0.024 (0.6%) | 0.036 (0.4%) | 0.059 (0.3%) |
| gridBuild | 0.011 (1.5%) | 0.011 (0.7%) | 0.012 (0.4%) | 0.014 (0.3%) | 0.030 (0.3%) | 0.048 (0.3%) |
| chargeProcess | 0.017 (2.3%) | 0.017 (1.1%) | 0.018 (0.7%) | 0.020 (0.5%) | 0.028 (0.3%) | 0.035 (0.2%) |
| healthUpdate | 0.014 (2.0%) | 0.014 (0.9%) | 0.016 (0.6%) | 0.017 (0.4%) | 0.023 (0.2%) | 0.033 (0.2%) |
| gridClear | 0.025 (3.4%) | 0.025 (1.5%) | 0.025 (0.9%) | 0.025 (0.6%) | 0.025 (0.3%) | 0.026 (0.1%) |
| communicationSelect | 0.015 (2.1%) | 0.016 (1.0%) | 0.017 (0.6%) | 0.019 (0.5%) | 0.022 (0.2%) | 0.023 (0.1%) |
| communicationTransmit | 0.016 (2.2%) | 0.016 (1.0%) | 0.017 (0.6%) | 0.017 (0.4%) | 0.020 (0.2%) | 0.023 (0.1%) |
| chargeFinalize | 0.012 (1.6%) | 0.012 (0.8%) | 0.013 (0.5%) | 0.014 (0.3%) | 0.017 (0.2%) | 0.023 (0.1%) |
| localSuccess | 0.015 (2.1%) | 0.015 (1.0%) | 0.016 (0.6%) | 0.016 (0.4%) | 0.017 (0.2%) | 0.020 (0.1%) |
| pressure | 0.007 (0.9%) | 0.006 (0.4%) | 0.007 (0.3%) | 0.007 (0.2%) | 0.007 (0.1%) | 0.007 (0.0%) |
| **GPU sum** | **0.722** | **1.584** | **2.670** | **4.025** | **9.588** | **19.171** |
| GPU % of step (render on) | 14.0% | 21.1% | 31.0% | 31.0% | 37.3% | 35.5% |

**[measured]** Findings: `force` + `deathCompaction` = 80 % of GPU compute at N = 200 and 96–99 % at N ≥ 2000; every other pass is 0.006–0.06 ms (a pass floor of roughly 0.01–0.025 ms, almost flat in N) and together ≈ 4 % at N = 2000. `deathCompaction` is exactly linear in N (**0.95–1.04 µs per particle at every N**) and its share grows from 29 % to 50 %. `force` per particle falls from 1.8 µs (N = 200) to a plateau of ≈ 0.9–0.97 µs (N ≥ 2000). Timestamp quantization is not an issue (`zeroDurationFraction` = 0).

## Hotspots

| # | Fact **[measured]** | Understanding **[source]** | Outcome |
| --- | --- | --- | --- |
| 1 | `deathCompaction`: 0.21 → 9.50 ms (N = 200 → 10000), 29–50 % of GPU compute, linear in N | `if (gid.x != 0u) return;` then one invocation loops `i = 0..activeCount` appending to `deathSlots`: 1 workgroup, 1 useful lane, ≈ 1 µs of dependent global-memory traffic per particle | **Accepted fix (Candidate 1)** |
| 2 | `force`: 0.37 → 9.37 ms, 48–60 % (then 65–91 % after fix 1, 86–91 % at N ≥ 1000) | Grid neighbour traversal (3×3 cells, linked list `cellHead`/`particleNext`), per neighbour a periodic delta, range test and three feature loads; one thread per particle | Workgroup-size experiment **rejected (Candidate 2)**; kernel body not yet analysed or changed → Phase 18 candidate |
| 3 | `pressure`: 0.006–0.007 ms (0.0–0.9 %) | Serial single-invocation loop, but `worker.ts` always calls `setGlobalError(5.5)` ⇒ the loop never runs in the app | **Rejected** (not a hotspot) |
| 4 | `reproductionCompaction`: absent from every run | Same serial pattern as #1, enabled only with population headroom; the benchmark scenario never runs it | **Deferred**, cost unmeasured |

## Optimizations implemented

### Candidate 1 — parallel stable death compaction: **ACCEPTED**, now the default (`DEFAULT_KERNEL_OPTIONS.deathCompaction = 'parallel'`)

- **Problem / evidence**: hotspot 1.
- **Change**: `SHADER_DEATH_COMPACTION_PARALLEL`. Same bindings, same single-workgroup dispatch, same pass label. The workgroup walks the particles in tiles of 128; each tile does an inclusive Hillis–Steele scan of the "dies" flags in `var<workgroup>` memory (all barriers in uniform control flow: loop bounds derive from the uniform `params.activeCount`) and writes each dying slot at `base + scan − 1`; thread 0 writes `deathCount`. No atomics. The Phase 16 `serial` kernel is retained as the reference/A-B variant (`--death-compaction serial`).
- **Semantics**: identical by construction — same `deathCount`, same ascending `deathSlots`, same predicate (`role == INTERNAL && healthOut <= 0`; NaN does not die, −0 does).
- **Correctness validation**: **[validated, on device]** `kernel-selftest.json`: Intel HD Graphics 520, **56 / 56 cases pass** (N ∈ {0, 1, 2, 127, 128, 129, 255, 256, 257, 1000, 2000, 2049, 4096, 10000} × death fraction ∈ {0, 0.02, 0.5, 1}; serial ≡ parallel ≡ independent JS reference over the **entire** `deathSlots` buffer including untouched tail slots; max 6906 deaths at N = 10000). **[validated, Node]** `death-compaction-scan.test.ts` (48 randomized cases of the algorithm under emulated lockstep, plus bindings compatibility; a deliberately broken variant fails 39/50). **Not done**: a full-simulation trajectory comparison (CPU/GPU RNG streams are not bit-identical by design and the `cellHead` list order is scheduling-dependent, so bit-exact trajectories are not a valid criterion); the argument rests on the kernel being exactly equivalent on its inputs.
- **[measured] Result, compute isolation (renderDisabled), median of 5 interleaved rounds**

| N | deathCompaction ms before -> after | Δ | GPU sum ms before -> after | Δ | step ms before -> after | Δ | particle-steps/s before -> after | Δ | verdict (step) |
| ---: | --- | ---: | --- | ---: | --- | ---: | --- | ---: | --- |
| 200 | 0.206 -> 0.052 | -75.0% | 0.727 -> 0.570 | -21.6% | 4.00 -> 3.84 | -4.0% | 27556 -> 27782 | +0.8% | within noise |
| 500 | 0.481 -> 0.065 | -86.6% | 1.573 -> 1.170 | -25.6% | 4.57 -> 4.38 | -4.1% | 62120 -> 62980 | +1.4% | within noise |
| 1000 | 0.969 -> 0.095 | -90.2% | 2.690 -> 1.822 | -32.3% | 5.05 -> 4.47 | -11.5% | 123305 -> 130412 | +5.8% | within noise |
| 2000 | 1.894 -> 0.146 | -92.3% | 4.046 -> 2.261 | -44.1% | 6.90 -> 5.27 | -23.6% | 201005 -> 238749 | +18.8% | lower (beyond noise) |
| 5000 | 4.744 -> 0.307 | -93.5% | 9.519 -> 5.100 | -46.4% | 12.60 -> 7.92 | -37.1% | 318552 -> 454339 | +42.6% | lower (beyond noise) |
| 10000 | 9.498 -> 0.586 | -93.8% | 19.180 -> 10.287 | -46.4% | 23.08 -> 14.10 | -38.9% | 381825 -> 581463 | +52.3% | within noise |

  The `deathCompaction` improvement is beyond noise at every N (slowest candidate round < fastest baseline round in all six sizes). End-to-end (mean frame time), the improvement is beyond noise at N = 2000 and 5000 (candidate faster in 5/5 rounds); at N = 10000 it is faster in 4/5 rounds (the fifth, a 46.5 ms outlier, overlaps the baseline range) with per-round median frame time lower in 5/5 rounds (22.8 → 14.0 ms, −38.6 %); at N = 1000 per-round median frame time is lower in 5/5 rounds (−6.1 %) but mean-based ranges overlap; at N ≤ 500 the 0.15–0.42 ms GPU saving is **within end-to-end noise** and is reported as such.

- **[measured] Result, with rendering and metrics (baseline variant)**

| N | step ms before -> after | Δ | step p95 ms | particle-steps/s before -> after | Δ | verdict (step) |
| ---: | --- | ---: | --- | --- | ---: | --- |
| 200 | 5.20 -> 4.95 | -4.8% | 6.6 -> 6.2 | 23733 -> 24546 | +3.4% | within noise |
| 500 | 7.43 -> 6.77 | -8.9% | 9.3 -> 8.9 | 45310 -> 46275 | +2.1% | within noise |
| 1000 | 8.84 -> 7.57 | -14.4% | 11.3 -> 9.7 | 83340 -> 91600 | +9.9% | within noise |
| 2000 | 12.99 -> 11.18 | -13.9% | 15.5 -> 13.6 | 122647 -> 139189 | +13.5% | lower (beyond noise) |
| 5000 | 25.59 -> 23.64 | -7.6% | 29.4 -> 37.0 | 173112 -> 184026 | +6.3% | within noise |
| 10000 | 53.98 -> 44.97 | -16.7% | 71.1 -> 59.3 | 167235 -> 198918 | +18.9% | within noise |

  With rendering on, per-round median frame time is lower in 5/5 rounds for N ≥ 1000 (−12.9 %, −20.2 %, −16.5 %, −15.8 % at N = 1000, 2000, 5000, 10000); the mean-based verdicts that say "within noise" at N = 5000/10000 are caused by outlier rounds (up to 51 ms) and p95 at N = 5000 got worse because of one such round — not a regression attributable to the kernel (its GPU time is lower in every round).

- **Mechanism confirmed**: per-particle cost of the pass fell from 0.95–1.04 µs to 0.06 µs at N ≥ 5000 (−94 %); the residual 0.05–0.15 ms at small N is the pass floor plus the 128-thread tile loop.

### Candidate 2 — force workgroup size 32 / 64 / 256: **REJECTED** (default stays 128)

The force kernel body is unchanged; only `@workgroup_size` and `ceil(N/wg)` change. Compute-isolation GPU time of the force pass (median of 5 rounds, Phase 16 serial death compaction in all columns):

| N | force ms @128 (Phase 16) | @32 | @64 | @256 | verdict @32 | verdict @64 | verdict @256 |
| ---: | ---: | --- | --- | --- | --- | --- | --- |
| 200 | 0.367 | 0.366 (-0.4%) | 0.366 (-0.4%) | 0.489 (+33.1%) | within noise | within noise | higher (beyond noise) |
| 500 | 0.942 | 0.942 (+0.1%) | 0.951 (+1.0%) | 1.212 (+28.7%) | within noise | within noise | higher (beyond noise) |
| 1000 | 1.557 | 1.560 (+0.2%) | 1.568 (+0.7%) | 1.948 (+25.1%) | within noise | within noise | higher (beyond noise) |
| 2000 | 1.974 | 1.955 (-0.9%) | 1.984 (+0.5%) | 2.156 (+9.2%) | within noise | within noise | higher (beyond noise) |
| 5000 | 4.550 | 4.561 (+0.3%) | 4.578 (+0.6%) | 4.629 (+1.7%) | within noise | within noise | higher (beyond noise) |
| 10000 | 9.361 | 9.417 (+0.6%) | 9.364 (+0.0%) | 9.752 (+4.2%) | within noise | within noise | higher (beyond noise) |

- 32 and 64 are **indistinguishable from 128 at every N (|Δ| ≤ 1 %)**; 256 is **slower beyond noise at every N (+33 % at N = 200 down to +1.7–4.2 % at N ≥ 5000)**. The end-to-end effect is noise (below; occasional single-cell "lower/higher" verdicts there appear while the force GPU time is identical, so they are noise, not a force effect):

| N | step ms @128 | @32 | @64 | @256 |
| ---: | ---: | --- | --- | --- |
| 200 | 4.00 | 4.02 (+0.4%, within noise) | 4.42 (+10.5%, within noise) | 4.33 (+8.2%, within noise) |
| 500 | 4.57 | 4.25 (-7.2%, lower (beyond noise)) | 4.32 (-5.5%, within noise) | 4.54 (-0.7%, within noise) |
| 1000 | 5.05 | 6.17 (+22.2%, within noise) | 5.03 (-0.5%, within noise) | 5.89 (+16.5%, within noise) |
| 2000 | 6.90 | 7.34 (+6.4%, within noise) | 6.78 (-1.8%, within noise) | 6.71 (-2.7%, within noise) |
| 5000 | 12.60 | 12.88 (+2.2%, within noise) | 12.77 (+1.3%, within noise) | 12.64 (+0.3%, within noise) |
| 10000 | 23.08 | 23.35 (+1.2%, within noise) | 23.30 (+0.9%, within noise) | 23.46 (+1.6%, within noise) |

- **Interpretation**: the hypothesis "the device is under-occupied at 2–16 workgroups" is **refuted** on this GPU — spreading the same work over 4× more workgroups changes nothing. The plateau of ≈ 0.9–1.0 µs per particle at N ≥ 2000 suggests the kernel is bound by its own per-particle work (neighbour traversal / dependent loads), not by workgroup scheduling **[hypothesis, not yet verified]**. The `forceWorkgroupSize` switch is kept (default 128, documented) because the optimum is architecture-dependent and other GPUs were not measured.

## Rejected and deferred

- **P17-H1 pressure parallelization — rejected**: 0.0–0.9 % of GPU compute, and the serial loop never executes in the app.
- **Kernel fusion — deferred**: after Candidate 1 the ten small passes total 0.15–0.29 ms (≈ 3–13 % of GPU compute at N ≥ 500, each at the 0.006–0.06 ms pass floor); fusion could only remove pass overhead, below end-to-end noise, and stage ordering is part of the semantics.
- **Grid / communication / atomics — not investigated**: in the final state grid (clear+build, 0.04–0.07 ms) is ≤ 2.1 % and communication (select+transmit, ≈ 0.03–0.05 ms) ≤ 1.8 % of GPU compute at N ≥ 1000. Scaling with maxK is unmeasured (scenario has maxK = 1).
- **reproductionCompaction — deferred** (hotspot 4).
- **Force numerical changes / feature precomputation** — not attempted: they alter the model or add buffers; out of scope without approval and without a measured need.
- **Rendering (render-on minus render-off step: 23 % of the step at N = 200, 47 % at N = 2000, 57 % at N = 10000), the post-GPU step floor, `finishNormalSync`** — measured but outside Phase 17.

## After (final state = Candidate 1 as default) — mean GPU ms per step per pass, median of 5 rounds, render + metrics on

| pass | N=200 | N=500 | N=1000 | N=2000 | N=5000 | N=10000 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| force | 0.366 (64.9%) | 0.951 (81.5%) | 1.556 (86.2%) | 1.948 (85.9%) | 4.519 (89.5%) | 9.318 (91.4%) |
| deathCompaction | 0.052 (9.2%) | 0.065 (5.6%) | 0.091 (5.1%) | 0.149 (6.6%) | 0.307 (6.1%) | 0.582 (5.7%) |
| mechanics | 0.015 (2.6%) | 0.016 (1.4%) | 0.018 (1.0%) | 0.024 (1.1%) | 0.036 (0.7%) | 0.059 (0.6%) |
| gridBuild | 0.011 (2.0%) | 0.011 (1.0%) | 0.012 (0.7%) | 0.013 (0.6%) | 0.029 (0.6%) | 0.047 (0.5%) |
| chargeProcess | 0.016 (2.9%) | 0.017 (1.5%) | 0.018 (1.0%) | 0.020 (0.9%) | 0.027 (0.5%) | 0.034 (0.3%) |
| healthUpdate | 0.014 (2.5%) | 0.015 (1.3%) | 0.016 (0.9%) | 0.017 (0.8%) | 0.023 (0.5%) | 0.032 (0.3%) |
| gridClear | 0.024 (4.4%) | 0.025 (2.1%) | 0.025 (1.4%) | 0.025 (1.1%) | 0.025 (0.5%) | 0.026 (0.3%) |
| communicationTransmit | 0.016 (2.9%) | 0.016 (1.4%) | 0.016 (0.9%) | 0.018 (0.8%) | 0.020 (0.4%) | 0.024 (0.2%) |
| communicationSelect | 0.015 (2.7%) | 0.016 (1.4%) | 0.017 (0.9%) | 0.017 (0.8%) | 0.021 (0.4%) | 0.024 (0.2%) |
| chargeFinalize | 0.012 (2.1%) | 0.012 (1.0%) | 0.013 (0.7%) | 0.013 (0.6%) | 0.016 (0.3%) | 0.022 (0.2%) |
| localSuccess | 0.015 (2.6%) | 0.015 (1.3%) | 0.016 (0.9%) | 0.016 (0.7%) | 0.017 (0.3%) | 0.020 (0.2%) |
| pressure | 0.007 (1.2%) | 0.006 (0.6%) | 0.007 (0.4%) | 0.007 (0.3%) | 0.007 (0.1%) | 0.006 (0.1%) |
| **GPU sum** | **0.567** | **1.166** | **1.804** | **2.268** | **5.047** | **10.190** |
| GPU % of step (render on) | 11.5% | 17.1% | 23.9% | 20.3% | 21.3% | 22.7% |

**[measured]** `force` is now **86–91 % of GPU compute at N ≥ 1000**; total GPU compute fell by 22 % (N = 200) rising to 46 % (N ≥ 5000) (A/B table above: −21.6 % … −46.4 %).

## Scaling

| N | death µs/particle before -> after | force µs/particle (final) | particle-steps/s render on before -> after | particle-steps/s render off before -> after | GPU % of step (render off) before -> after |
| ---: | --- | ---: | --- | --- | --- |
| 200 | 1.04 -> 0.26 | 1.83 | 23733 -> 24546 | 27556 -> 27782 | 18% -> 15% |
| 500 | 0.96 -> 0.13 | 1.90 | 45310 -> 46275 | 62120 -> 62980 | 34% -> 27% |
| 1000 | 0.96 -> 0.09 | 1.56 | 83340 -> 91600 | 123305 -> 130412 | 53% -> 41% |
| 2000 | 0.95 -> 0.07 | 0.97 | 122647 -> 139189 | 201005 -> 238749 | 59% -> 43% |
| 5000 | 0.96 -> 0.06 | 0.90 | 173112 -> 184026 | 318552 -> 454339 | 76% -> 64% |
| 10000 | 0.95 -> 0.06 | 0.93 | 167235 -> 198918 | 381825 -> 581463 | 83% -> 73% |

- The slope of the step time vs N improved: at N = 10000 the render-off step is 14.1 ms instead of 23.1 ms and throughput reaches 581 k particle-steps/s instead of 382 k (+52 %); at N ≤ 500 throughput is unchanged within noise because the step is dominated by a roughly constant non-GPU floor.
- **[measured, derived]** step − GPU pass sum (render off, after) = 3.3 / 3.2 / 2.7 / 3.0 / 2.8 / 3.8 ms at N = 200 … 10000: a near-constant 2.7–3.8 ms per step outside the timed passes (CPU encode, submission, queue latency, gaps between passes, sync). It bounds what any further GPU-only work can win at small N. Nothing was extrapolated beyond N = 10000.
- **Instrumentation overhead**: `gpuTimestampsDisabled` was only run in the 3-round baseline (N ≤ 2000): −3.6 % (N = 1000) and −0.4 % (N = 2000) step time with timestamps on, +16 % / +21 % at N = 200 / 500 dominated by noisy rounds → no overhead demonstrable at N ≥ 1000, small-N inconclusive. Timestamped and un-timestamped runs were never mixed in a comparison.

## Remaining GPU costs (final state)

1. `force` — 1.95 ms (N = 2000), 9.32 ms (N = 10000), 86–91 % of GPU compute; ≈ 0.9–1.0 µs per particle, insensitive to workgroup size.
2. `deathCompaction` (parallel) — 0.15 / 0.58 ms at N = 2000 / 10000 (≈ 6 %).
3. Everything else — ≤ 0.06 ms per pass.

## Phase 16 tooling defect found and fixed

**[source]** `worker.ts` `case 'runBenchmark'` rebuilt its options field by field and did not forward `orchestration`, so the CLI switches `--bind-group-cache` / `--pack-params` could not reach the stepper through the benchmark path. Fixed here (it forwards `orchestration` and the new `kernels`); the effective options are now recorded in every result (`method.orchestration`, `method.kernels`) and were verified for all 300 Phase 17 A/B runs (requested = effective, adapter present, timestamps on, 0 errors). The Phase 16 hardware A/B (bind-group cache, parameter packing) was **never run** and, given this defect, any earlier attempt through the CLI would not have changed the stepper; it remains an open Phase 16 debt.

## Performance ledger

Machine-readable: `performance/phase17/ledger.json`.

| ID | Candidate | Stage | Baseline GPU ms (N=200…10000) | After | Correctness | Decision |
| --- | --- | --- | --- | --- | --- | --- |
| P17-C1 | parallel stable death compaction | deathCompaction | 0.206 / 0.481 / 0.969 / 1.894 / 4.744 / 9.498 | 0.052 / 0.065 / 0.095 / 0.146 / 0.307 / 0.586 (−75 … −94 %); GPU sum −22 … −46 %; step (render off) −4 … −39 %; particle-steps/s +1 … +52 % | on-device 56/56 exact; Node algorithm test 48/48 | **accepted** (default flipped) |
| P17-C2 | force workgroup 32/64/256 | force | 0.367 / 0.942 / 1.557 / 1.974 / 4.550 / 9.361 | 32, 64: ±1 % (noise); 256: +1.7 … +33 % (slower) | n/a (body unchanged) | **rejected** (128 kept; knob retained) |
| P17-H1 | parallelize pressure | pressure | 0.006 … 0.007 | – | – | **rejected** |
| P17-D1 | parallelize reproductionCompaction | reproductionCompaction | not measured | – | – | deferred |
| P17-D2 | fuse the small passes | 10 passes | 0.17 total at N = 2000 (before) | – | – | deferred |

## Validation status

| Check | Status |
| --- | --- |
| On-device exact-output self-test of both death-compaction kernels | **passed, 56/56** (`performance/phase17/kernel-selftest.json`) |
| Requested = effective kernel options in all 300 A/B runs; real adapter + timestamps; 0 errors | **verified** |
| Algorithm test under emulated lockstep (Node) incl. negative control | **passed** (run by the author with a minimal shim; not with vitest) |
| `tsc` partial check of the changed stepper (dependencies not installed in the author's environment) | no new errors vs. the original |
| `pnpm install` · `pnpm typecheck` · `pnpm lint` · `pnpm test` (incl. Phase 16 golden dispatch-trace tests, expected unchanged: same labels, workgroup counts and pipeline count) · `pnpm build` · production-build smoke test under the GitHub Pages base path · CI | **to be executed with the project toolchain before merging** — not run by the author of this report |

## Reproduce

```powershell
pnpm install; pnpm run build
pnpm --filter ./src/react-ui exec vite preview --port 4180 --strictPort   # leave running
.\tools\bench\run-phase17-ab.ps1 -Headed -BaseUrl http://localhost:4180/continuous-evolutionary-particle-computation/
node tools/bench/compare-gpu-profiles.mjs --baseline ab-baseline --candidate ab-death-parallel --candidate ab-force-wg32 --candidate ab-force-wg64 --candidate ab-force-wg256 --md performance/phase17/ab-comparison.md --json performance/phase17/ab-comparison.json
node tools/bench/summarize-gpu-profile.mjs --tag ab-death-parallel --md performance/phase17/gpu-cost-model-final.md --json performance/phase17/gpu-cost-model-final.json
node tools/bench/benchmark-webgpu.mjs --selftest --real-gpu --headed --base-url http://localhost:4180/continuous-evolutionary-particle-computation/ --out performance/phase17/kernel-selftest.json   # regression guard for the kernel
```

The A/B configurations are pinned explicitly (`ab-baseline` = serial + force 128), so the script reproduces the comparison even though the shipped default is now `parallel`.

## Phase 18 starting evidence (candidates only; no Phase 18 work was started)

1. **Rendering**: with rendering on the step is 12.99 → 6.90 ms (N = 2000) and 53.98 → 23.08 ms (N = 10000) with it off, i.e. 6.1 ms (47 %) and 30.9 ms (57 %) of the step at the baseline; at N = 10000 rendering costs more than all simulation compute. Largest measured end-to-end cost left; independent of the compute work.
2. **`force` kernel body** (86–91 % of the remaining GPU compute): workgroup size is excluded; next question is what bounds the ≈ 0.9–1.0 µs/particle (neighbour count per cell, dependent `particleNext` loads, per-neighbour feature loads) — needs sub-pass timing or neighbour-count statistics before any change; any numerical approximation is a model change requiring approval.
3. **Post-GPU step floor of 2.7–3.8 ms**: decomposition of `finishNormalSyncMs`/queue latency/gaps (Phase 15/16-class).
4. **`reproductionCompaction`** serial scan: needs a benchmark scenario with population headroom (capacity > N, `mating_probability > 0`) to be measured; **[hypothesis]** its cost in interactive runs is of the same order as the death compaction before Candidate 1, because the kernel has the same one-invocation structure.
5. **Phase 16 debt**: hardware A/B of the bind-group cache and parameter packing (now possible through the fixed CLI path).
6. **Hardware coverage**: only an Intel HD Graphics 520 was measured; the workgroup-size and compaction conclusions should be re-checked on a discrete GPU.

## Files changed in Phase 17

`src/webgpu-mfm/src/MfmWebGPUStepper.ts` (kernel options, parallel death compaction, force workgroup switch, default flipped), `src/webgpu-mfm/src/kernel-selftest.ts`, `src/webgpu-mfm/src/index.ts`, `src/webgpu-mfm/tests/death-compaction-scan.test.ts`, `src/web-worker/src/worker.ts` (option forwarding fix, self-test message), `src/react-ui/src/benchmark-main.ts`, `tools/bench/{benchmark-webgpu.mjs, run-phase17-baseline.ps1, run-phase17-ab.ps1, summarize-gpu-profile.mjs, compare-gpu-profiles.mjs}`, `performance/phase17/*`, `performance/benchmark-history.md`, `docs/phases/17-phase17-gpu-kernel-optimization.md`, `docs/performance/README.md`, `performance/phase16/README.md` (note).
