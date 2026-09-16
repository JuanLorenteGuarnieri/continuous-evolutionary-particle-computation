# Phase 11: Scientific Validation and Performance Characterization

## Objective

Validate the CEPC implementation scientifically and establish a realistic performance envelope. This phase ensures that the software correctly implements the Minimal Formal Model v3 (MFM v3) across all backends (CPU reference, C++ oracle, WebGPU) and documents the limits within which the platform can be used reliably for Stage IV experiments.

## Goals

- Confirm that CPU/GPU trajectories are statistically equivalent for a broad set of seeds, configurations, and experiment protocols.
- Establish a reproducible validation suite that can be run automatically in CI.
- Quantify performance characteristics (latency, throughput, memory usage) for varying population sizes and grid resolutions.
- Document the validated parameter range and performance envelope for public use.
- Identify and mitigate numerical divergences between CPU and GPU implementations.

## Detailed Tasks

### 1. Validation Test Matrix Design

 - Define a comprehensive matrix of test cases covering:
   - Small deterministic cases (one‑particle, two‑particle, three‑particle interactions).
   - Random seeds across a set of representative configurations (population size, domain size, input signals).
   - All Stage IV protocols (P0, P1, P2, P3, P4, delay memory, XOR/parity, NARMA‑10, Mackey‑Glass, Lorenz, regime classification, A→B→A, drift, abrupt shifts, damage/recovery).
   - Edge cases: zero‑neighbor scenarios, saturation of charge/health, population at capacity, mutation boundaries, protected I/O.
 - For each case, specify the reference backend (CPU reference) and the validation backend (C++ oracle and WebGPU).
 - Define acceptance tolerances:
   - Integer‑valued quantities (charge, health, population count) must match exactly.
   - Floating‑point quantities (positions, velocities) must match within a relative tolerance of 1e‑6 or absolute tolerance of 1e‑9, depending on the variable.
   - Statistical quantities (mean readout, variance) must match within a 95% confidence interval.

### 2. CPU/GPU Trajectory Comparisons

 - Implement a validation harness (e.g., `tools/validate‑trajectory.js` or a Python script) that:
   - Loads an experiment manifest.
   - Runs the simulation on the CPU reference and on the WebGPU backend with the same seed and configuration.
   - Saves the full trajectory (or key metrics) for both runs.
   - Compares trajectories element‑wise against the defined tolerances.
   - Reports mismatches with detailed diagnostics (step number, particle ID, variable name, expected vs. actual values).
 - Run the harness for each test case in the matrix.
 - Automate the harness in CI (e.g., a GitHub Actions job that runs on every pull request and nightly).
 - Record the results in a validation report (e.g., a Markdown file or JSON artifact) that is archived with each release.

### 3. Statistical Equivalence Tests

 - For stochastic experiments (e.g., those involving probabilistic target selection or mutation), perform statistical equivalence tests:
   - Use the same PRNG sequence across backends (ensure identical RNG implementation).
   - If the PRNG is identical, trajectories should match exactly. If the PRNG is different (e.g., GPU uses a different RNG), compare distributions rather than exact values.
   - For probabilistic selection, run multiple trials with different seeds and compare the distribution of outcomes (e.g., mean and variance of readout) using a two‑sample Kolmogorov‑Smirnov test or similar.
   - Document any differences and justify them (e.g., due to floating‑point non‑determinism).

### 4. Performance Benchmarks

 - Define a set of benchmark scenarios:
   - Varying population sizes (e.g., 1e3, 1e4, 1e5, 1e6 particles).
   - Varying grid resolutions (e.g., cell sizes for spatial hashing).
   - Varying timestep counts (e.g., short runs of 1e3 steps vs. long runs of 1e5 steps).
 - Measure:
   - **Latency per step**: time to advance one simulation step.
   - **Throughput**: particles processed per second.
   - **Memory usage**: peak GPU memory, CPU memory footprint.
   - **Frame time**: for the browser UI, measure time to render a frame while simulating.
 - Use profiling tools:
   - For WebGPU: Chrome DevTools Performance panel, WebGPU shader profiling, and the `GPU‑Timing` API if available.
   - For CPU: `perf`, `valgrind`, or Node.js `--prof` for the TypeScript reference.
   - For C++: `gprof`, `perf`, or `Intel VTune`.
 - Record results in a `performance/` folder with CSV files and a summary report.

### 5. Population Scaling Analysis

 - Determine the scaling behavior of the simulation as population size increases.
 - Plot latency per step vs. population size for CPU, C++, and WebGPU.
 - Identify the point at which the GPU implementation becomes faster than the CPU implementation.
 - Document the maximum population size that can be simulated in real‑time (e.g., 60 FPS) in a typical browser.
 - Analyze the impact of population dynamics (births/deaths) on performance (e.g., allocation overhead).

### 6. Grid Scaling and Spatial Indexing

 - If the implementation uses a spatial grid or hash for neighbor queries, test how performance scales with grid cell size and domain size.
 - Measure the time spent in neighbor search vs. communication vs. mechanics.
 - Optimize the grid parameters (cell size, number of bins) for typical use cases.
 - Document the optimal grid settings for different population densities.

### 7. Shader and Memory Profiling

 - Profile WebGPU shaders using browser dev tools or vendor‑specific profilers.
 - Identify hot spots: neighbor search, communication scoring, mechanical force computation.
 - Optimize shaders where possible (e.g., reduce register pressure, improve memory access patterns).
 - Measure memory bandwidth usage and ensure that data transfers between CPU and GPU are minimized.

### 8. Checkpoint Benchmarks

 - Measure the time and memory required to save and restore checkpoints.
 - Test checkpointing at different intervals (e.g., every 100 steps, every 1k steps).
 - Ensure that checkpoint/restore preserves determinism (validated in Phase 4).

### 9. Documentation and Reporting

 - Compile a validation report (`docs/validation/validation-report.md`) that includes:
   - Summary of validation test matrix.
   - Results of CPU/GPU trajectory comparisons (pass/fail, tolerance used).
   - Statistical equivalence test results.
   - Performance benchmark results with tables and plots.
   - Validated parameter range (e.g., population size 1e3‑1e5, domain size up to 1024x1024, etc.).
   - Known limitations and caveats (e.g., numerical divergence for large populations, GPU memory constraints).
 - Update the README with a link to the validation report and a summary of the validated parameter range.
 - Add a badge or note in the CI pipeline indicating the validation status.

### 10. CI Integration

 - Add a GitHub Actions workflow (`validation.yml`) that runs the validation harness on a nightly schedule and on release tags.
 - The workflow should:
   - Build all backends.
   - Run the validation matrix on a subset of test cases (full matrix may be too heavy for PRs).
   - Upload validation artifacts (logs, reports) as workflow artifacts.
   - Fail the workflow if any validation test fails or if performance regressions exceed a threshold (e.g., >10% slowdown).
 - Ensure the workflow can be run manually via `workflow_dispatch`.

## Deliverables

 - A validation harness (`tools/validate‑trajectory`) that can compare trajectories across backends.
 - A comprehensive validation test matrix and results report.
 - Performance benchmark scripts and results (`performance/` folder).
 - Validation report documentation (`docs/validation/validation-report.md`).
 - Updated CI workflow (`validation.yml`) that runs validation tests.

## Acceptance Criteria (Exit Conditions for Phase 11)

The following must succeed in a fresh checkout:

```bash
# Run the validation harness on a representative subset of tests
pnpm run validate:subset
# Expected: all tests pass within defined tolerances.

# Run performance benchmarks
pnpm run benchmark
# Expected: benchmark results are generated in performance/ and match the documented performance envelope.

# Run the full validation matrix (optional, may be time‑consuming)
pnpm run validate:full
# Expected: no failures, and the validation report is generated.
```

Specifically:
 - CPU/GPU trajectory comparisons pass for all test cases in the matrix within the defined tolerances.
 - Statistical equivalence tests show no significant differences between backends.
 - Performance benchmarks demonstrate that the WebGPU backend can run at real‑time for the documented population range (e.g., 1e4 particles at 60 FPS).
 - Memory usage stays within typical browser limits (e.g., < 512 MB for the WebGPU backend).
 - The validation report is complete, up‑to‑date, and linked from the README.
 - CI validation workflow runs successfully and reports the status.

## Dependencies and Tool Versions (inherited from previous phases)

 - Node.js: >=18.x (LTS)
 - pnpm: >=8.x
 - TypeScript: >=5.0
 - WebGPU: supported browser (e.g., Chrome Canary or stable with WebGPU enabled)
 - C++ compiler: supports C++20
 - Python: >=3.10 (for analysis scripts)

## Notes for Future Phases

 - Phase 12 (Public Research Release) will rely on the validation report to provide users with a clear understanding of the platform's capabilities and limitations.
 - If performance bottlenecks are identified, they can be addressed in a subsequent optimization phase, but any optimization must be validated against the reference implementations to avoid model drift.
 - The validation suite should be maintained and expanded as new features are added to the platform.

## Checklist

 - [ ] Validation harness implemented and tested
 - [ ] CPU/GPU trajectory comparisons pass for the test matrix
 - [ ] Statistical equivalence tests completed
 - [ ] Performance benchmarks executed and results documented
 - [ ] Population scaling analysis completed
 - [ ] Grid scaling analysis completed
 - [ ] Shader and memory profiling done
 - [ ] Checkpoint benchmarks performed
 - [ ] Validation report written and linked from README
 - [ ] CI validation workflow added and passing
 - [ ] Acceptance criteria checks pass

---

*This plan is derived from the Implementation Phases section (32) of the Reference Implementation and the broader documentation in `/docs/` (especially the Reference Implementation phases and the validation requirements). It is intended to be executed after Phase 10 (Experiment Runner) is complete and before the Public Research Release (Phase 12).*
