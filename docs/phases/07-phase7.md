# Phase 7: Experiment API and Research Platform Integration

## Objective

Integrate the validated WebGPU MFM v3 implementation (Phase 6) with the experiment orchestration layer, the React UI, and the research platform infrastructure to enable automated execution of Stage IV experiments, real‑time visualization, and reproducible scientific workflows. This phase transforms the simulation engine into a usable research instrument that can run experiments, collect metrics, and export results for analysis.

## Goals

- Provide a high‑level Experiment API that can load ExperimentManifests, configure simulations, and execute experiments end‑to‑end.
- Integrate the WebGPU MFM v3 simulation with the React UI for real‑time visualization and interactive parameter tuning.
- Enable experiment runners to execute Stage IV protocols automatically, with support for parameter sweeps, replicates, and statistical analysis.
- Ensure deterministic replay, checkpointing, and logging for all experiments.
- Export experiment results (metrics, logs, snapshots) in standard formats (JSON, CSV) for downstream analysis.
- Deploy the platform as a static web application on GitHub Pages, with reproducible builds and CI validation.

## Detailed Tasks

### 1. Create the Experiment API Package

 - Create a new package under `src/experiment-api/`.
 - Initialize `package.json` (name: `@cepc/experiment-api`, private: true) with dependencies on `@cepc/shared-config`, `@cepc/webgpu-mfm`, and devDependencies: `typescript`, `vitest`, `zod` (for schema validation).
 - Add an `index.ts` that exports the main API classes.
 - Set up `tsconfig.json` (extends root) with `declaration: true`, `outDir: ./dist`, `rootDir: ./src`, `sourceMap: true`.
 - Add a `README.md` describing the purpose of the package and its API.

### 2. Define Experiment Manifest Schema and Validation

 - Use the `ExperimentManifest` type from `src/shared-config/` as the basis.
 - Implement a validation layer that checks the manifest against the schema (e.g., using Zod or a custom validator).
 - Provide helper functions to load manifests from JSON/YAML files.
 - Ensure that manifests reference the correct MFM v3 version and that all required fields are present.

### 3. Implement the Experiment Runner

 - Create a class `ExperimentRunner` that:
   - Accepts an `ExperimentManifest` and a simulation backend (WebGPU MFM v3 by default, with an option to use CPU reference for validation).
   - Initializes the simulation with the given configuration, initial population, and random seed.
   - Runs the simulation for the specified number of steps or until a termination condition is met.
   - Collects metrics at each step (readout, population size, average health, etc.) as defined in the manifest.
   - Supports parameter sweeps: run multiple experiments with different parameter values, automatically generating a grid of experiments.
   - Supports replicates: run the same experiment with different random seeds and aggregate results.
 - Provide methods:
   - `run(): ExperimentResult` – runs a single experiment and returns the result.
   - `runSweep(params: SweepConfig): SweepResult` – runs a parameter sweep.
   - `runReplicates(n: number): ReplicateResult` – runs replicates.

### 4. Metrics Collection and Logging

 - Define a `MetricsCollector` class that:
   - Records time‑series data for each metric specified in the manifest.
   - Computes summary statistics (mean, variance, etc.) over replicates.
   - Supports real‑time streaming of metrics to the UI via Web Workers.
 - Implement logging of simulation events (deaths, births, mutations) for debugging and analysis.
 - Ensure that all metrics are serializable to JSON for export.

### 5. Checkpointing and Deterministic Replay

 - Integrate checkpointing from the WebGPU MFM v3 implementation.
 - Provide methods to save the simulation state to disk (or IndexedDB in the browser) and restore it later.
 - Ensure that checkpointing works across WebGPU and CPU backends for validation.
 - Provide a `ReplayController` that can step forward and backward through a recorded trajectory.

### 6. React UI Integration

 - Integrate the Experiment API with the React UI (`src/react-ui/`).
 - Create components:
   - `ExperimentConfigPanel` – allows users to load, edit, and validate experiment manifests.
   - `SimulationViewer` – displays real‑time visualization of particles (positions, health, charge) using WebGPU rendering.
   - `MetricsDashboard` – shows live plots of metrics (readout, population size, etc.) using a charting library (e.g., Chart.js or Recharts).
   - `ExperimentRunnerPanel` – controls to start/stop experiments, run sweeps, and download results.
 - Use Web Workers to run the WebGPU simulation off the main thread to keep the UI responsive.
 - Implement error handling and user feedback for simulation failures.

### 7. Real‑Time Visualization

 - Use the WebGPU rendering pipeline (separate from compute) to visualize particles.
 - Map particle state (position, velocity, health, charge) to visual properties (color, size, opacity).
 - Provide interactive controls: zoom, pan, pause, step forward/backward.
 - Ensure that the visualization is synchronized with the simulation state (e.g., via a shared buffer or message passing).

### 8. Experiment Export and Analysis

 - Implement export functions to save experiment results as JSON and CSV files.
 - Provide a summary report generator that creates a markdown or HTML report with key metrics and plots.
 - Support exporting simulation snapshots for later analysis.
 - Ensure that exported data includes metadata (experiment ID, manifest version, random seed, etc.) for reproducibility.

### 9. Testing

 - Write unit tests for the Experiment API using Vitest.
 - Test manifest validation, experiment runner, metrics collection, and checkpointing.
 - Write integration tests that run a small experiment end‑to‑end (WebGPU simulation + API + UI) and verify that the results match the expected output.
 - Use the golden trajectories from Phase 4 to validate experiment results.
 - Aim for >80% coverage on the experiment-api package.

### 10. CI Integration

 - Add a new GitHub Actions job `experiment-api-tests` that:
   - Installs Node.js, pnpm, and Playwright.
   - Runs unit tests for the experiment API.
   - Runs integration tests that execute a small experiment using the WebGPU backend (or CPU fallback if WebGPU is unavailable).
   - Validates that exported results are correct and reproducible.
 - Ensure that the CI job runs on every push and pull request.

### 11. Documentation

 - Add a `README.md` in `src/experiment-api/` explaining how to use the API, how to define experiment manifests, and how to run experiments programmatically.
 - Document the ExperimentManifest schema with examples.
 - Provide a user guide for the React UI, explaining how to load manifests, run experiments, and export results.
 - Update the top‑level `AGENTS.md` if needed to mention the experiment API.

## Deliverables

 - A fully functional Experiment API package in `src/experiment-api/`.
 - Experiment manifest validation and loading utilities.
 - ExperimentRunner class with support for single runs, parameter sweeps, and replicates.
 - Metrics collection and logging system.
 - Checkpointing and replay support integrated with WebGPU MFM v3.
 - React UI components for experiment configuration, simulation visualization, and metrics dashboard.
 - Export functionality for experiment results (JSON, CSV, reports).
 - A test suite (Vitest) covering the Experiment API and integration tests.
 - CI job configuration for experiment API tests.
 - Documentation on how to use the API and UI.

## Acceptance Criteria (Exit Conditions for Phase 7)

The following must succeed in a fresh checkout after Phase 6 is complete:

```bash
# From repository root
pnpm install   # (if not already done)

# Lint the experiment-api package
pnpm run lint -- --filter @cepc/experiment-api

# Run unit tests for experiment-api
pnpm test -- --filter @cepc/experiment-api

# Build the experiment-api package
pnpm run build -- --filter @cepc/experiment-api

# Run integration tests (WebGPU simulation + API)
pnpm run test:experiment-integration

# Run the React UI in development mode and verify that an experiment can be loaded, run, and visualized.
pnpm run dev -- --filter @cepc/react-ui
```

Specifically:
 - The Experiment API can load a valid ExperimentManifest and run an experiment using the WebGPU backend.
 - The experiment runner produces results that match the CPU reference and C++ oracle for the same input (within tolerance).
 - Metrics are collected correctly and exported to JSON/CSV.
 - Checkpointing and replay work: saving state and restoring it yields identical subsequent steps.
 - The React UI can load a manifest, start a simulation, visualize particles in real time, and display metrics.
 - Parameter sweeps and replicates work as expected.
 - The code is lint‑clean (ESLint + Prettier) and builds without errors.
 - The CI job runs the experiment API tests and integration tests and reports success.

## Dependencies and Tool Versions (inherited from earlier phases)

 - Node.js: >=18.x (LTS)
 - pnpm: >=8.x
 - TypeScript: >=5.0
 - Vitest: >=1.0
 - Playwright: >=1.40 (for headless browser tests)
 - WebGPU support: Chromium with WebGPU enabled (or a software WebGPU implementation like Dawn for CI)
 - React: >=18.0
 - Charting library: Chart.js or Recharts (for metrics dashboard)

## Notes for Future Phases

 - Phase 8 (if any) may focus on performance optimization, additional experiment protocols, or user‑generated content.
 - The experiment API should be designed to be extensible: new experiment types can be added by defining new manifests and metrics.
 - Consider adding a plugin system for custom metrics or visualization components.
 - Ensure that the platform remains reproducible: all experiments should be runnable from a manifest and a random seed.
 - Keep the UI responsive by running the simulation in a Web Worker and using efficient data transfer between worker and UI.

## Checklist

 - [ ] src/experiment-api/ package folder created
 - [ ] package.json (name: @cepc/experiment-api) present
 - [ ] tsconfig.json (extends root) present
 - [ ] ExperimentManifest validation and loading utilities implemented
 - [ ] ExperimentRunner class implemented with single run, sweep, and replicate support
 - [ ] MetricsCollector class implemented with real‑time streaming
 - [ ] Checkpointing and replay support integrated with WebGPU MFM v3
 - [ ] React UI components for experiment configuration, simulation viewer, and metrics dashboard implemented
 - [ ] Real‑time visualization of particles using WebGPU rendering
 - [ ] Export functionality for experiment results (JSON, CSV, reports) implemented
 - [ ] Vitest tests for experiment API with >80% coverage
 - [ ] Integration tests for WebGPU simulation + API + UI implemented
 - [ ] CI job for experiment API tests added and passing
 - [ ] README in src/experiment-api/ with usage examples and documentation
 - [ ] Acceptance criteria checks pass (manual or automated)

---

*This plan is derived from the Implementation Phases section (32) of the Reference Implementation and the broader documentation in `/docs/` (especially Minimal Formal Model v3.md, Technical Framework v4.md, Experimental Design.md, and Reference Implementation itself). It is intended to be executed after Phase 6 is complete and before the platform is released for public use.*
