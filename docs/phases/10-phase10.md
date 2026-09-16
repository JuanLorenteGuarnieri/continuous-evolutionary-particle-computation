# Phase 10: Experiment Runner

## Objective

Translate Stage IV into executable experiments.

## Goals

- Implement experiment manifests that define the configuration for each Stage IV protocol.
- Create an experiment runner that can load manifests and execute the corresponding experiments.
- Ensure that experiments can be launched from versioned configurations without modifying source code.
- Integrate with the simulation API to control simulation parameters, initial conditions, and readouts.
- Provide mechanisms to collect and export experiment results and metadata.
- Support both CPU and GPU backends for experiment execution.

## Detailed Tasks

### 1. Experiment Manifest Design

- Define a manifest schema (e.g., JSON or YAML) that specifies:
   - Experiment type (P0, P1, etc.)
   - Simulation parameters (population size, timesteps, etc.)
   - Input signals (if applicable)
   - Readout configuration (if applicable)
   - Output metrics to collect
   - Random seed for reproducibility
   - Backend preference (CPU/GPU)

### 2. Manifest Implementation

- Create a package (e.g., `@cepc/experiment-manifests`) or integrate into `@cepc/experiment-api` to define manifest schemas and validation.
- Implement manifests for each of the Stage IV protocols listed:
   - P0 (likely a simple passive or baseline experiment)
   - P1 (e.g., line attractor or memory task)
   - P2, P3, P4 (progressively complex tasks)
   - Delay memory
   - XOR/parity (logic gate)
   - NARMA-10 (nonlinear autoregressive moving average)
   - Mackey–Glass (chaotic time series prediction)
   - Lorenz (chaotic system prediction)
   - Regime classification (switching between dynamical regimes)
   - A→B→A (sequence learning)
   - Drift (gradual changes in input statistics)
   - Abrupt shifts (sudden changes in input)
   - Damage/recovery (lesioning and recovery simulations)

### 3. Experiment Runner

- Implement a runner service (in `@cepc/experiment-api`) that:
   - Loads and validates experiment manifests.
   - Initializes the simulation with the manifest's configuration.
   - Applies input signals over time as specified.
   - Collects output charges and computes readout predictions.
   - Logs metrics and internal state (if enabled) for analysis.
   - Handles experiment lifecycle: start, pause, resume, stop.
   - Supports checkpointing and restoring experiment state.

### 4. Integration with Simulation and Readout

- Ensure the experiment runner uses the simulation API (worker) to advance steps.
- For experiments requiring a readout, integrate with the linear readout layer (either in TypeScript for browser or Python for offline).
- Allow the runner to work with both CPU reference and GPU backends interchangeably.

### 5. Result Collection and Export

- Define a result format that includes:
   - Input and output time series
   - Readout predictions (if applicable)
   - Computed performance metrics (e.g., error, correlation)
   - Manifest used and git commit hash for reproducibility
   - Optional: internal diagnostics (population health, charge distribution, etc.)
- Implement export functionality to save results to disk (JSON/CSV) or IndexedDB for browser persistence.

### 6. Experiment API Enhancements

- Extend the experiment-api package to provide:
   - Functions to load manifests from files or URLs.
   - Functions to run experiments and return results.
   - Functions to list available experiment types.
   - Event hooks for progress reporting (useful for UI updates).

### 7. Testing and Validation

- Write unit tests for manifest validation and parsing.
- Write integration tests that run a simple experiment (e.g., P0) and verify the output matches expectations.
- For each experiment type, create a golden output (or expected behavior) from a known seed to ensure correctness.
- Validate that experiments produce deterministic results when run with the same seed and backend.
- Test that the CPU and GPU backends produce statistically equivalent results for each experiment (within tolerance).

## Deliverables

- Updated `@cepc/experiment-api` with experiment runner capabilities.
- Manifest definitions for all Stage IV experiments (likely in `@cepc/experiment-api` or a new `@cepc/experiment-manifests` package).
- Result collection and export mechanisms.
- Documentation in `docs/` (e.g., in the developer guide or user guide) explaining how to define and run experiments.
- Example manifests for each experiment type stored in the repository (e.g., in `configs/experiments/`).

## Acceptance Criteria (Exit Conditions for Phase 10)

The following conditions must be met:

1. The application can be built and run locally (`pnpm install`, `pnpm dev` or equivalent).
2. For each Stage IV experiment type, a valid manifest exists in the repository.
3. The experiment runner can load a manifest and execute the experiment end-to-end without manual code changes.
4. Experiments run successfully on both CPU reference and GPU backends (when WebGPU is available).
5. Experiment results are reproducible: running the same manifest with the same seed produces identical output charges (CPU) or statistically equivalent output (GPU).
6. Key performance metrics (e.g., prediction error) can be computed and displayed for each experiment.
7. Results can be exported in a standard format (JSON/CSV) for further analysis.
8. All existing tests continue to pass (no regressions).

## Dependencies and Tool Versions (as of phase 10)

- Inherit from Phase 0: Node.js, pnpm, TypeScript, Vitest, ESLint, Prettier, etc.
- For experiment manifests: May use a schema validation library (e.g., `zod` or `joi`) but can be kept simple.
- For result export: No additional dependencies beyond standard libraries.

## Notes for Future Phases

- Phase 11 will focus on scientific validation and performance characterization, which will rely on the experiment runner to execute benchmarks.
- Phase 12 will prepare the public release, which will include preset experiments based on the manifests developed in this phase.
- Consider adding a web-based experiment configurator in later phases (e.g., in the React UI) to allow users to modify manifests via the interface.
- Ensure that the experiment runner is designed to be extensible for future experiment types beyond Stage IV.

## Checklist

- [ ] Experiment manifest schema defined and validated.
- [ ] Manifests created for all listed Stage IV experiments.
- [ ] Experiment runner implemented in `@cepc/experiment-api`.
- [ ] Integration with simulation API (worker) complete.
- [ ] Result collection and export functionality working.
- [ ] Unit and integration tests passing for manifest handling and experiment execution.
- [ ] Experiments runnable on both CPU and GPU backends.
- [ ] Acceptance criteria met in local development environment.

--- 

*This plan is derived from the Implementation Phases section (32) of the Reference Implementation and the broader documentation in `/docs/`. It is intended to be executed after the successful completion of Phase 9.*
