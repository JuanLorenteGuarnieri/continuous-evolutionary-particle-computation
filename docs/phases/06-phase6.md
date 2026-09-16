# Phase 6: WebGPU MFM v3 Implementation

## Objective

Integrate the WebGPU primitives developed in Phase 5 into a complete GPU‑accelerated implementation of the Minimal Formal Model v3 (MFM v3). This phase builds the full WebGPU simulation kernel that executes the entire MFM v3 timestep on the GPU, while preserving scientific correctness by validating against the TypeScript CPU reference and the C++ oracle from earlier phases.

## Goals

- Assemble the GPU primitives (charge update, communication, mechanics, etc.) into a single, cohesive WebGPU compute pipeline that implements the full MFM v3 step.
- Ensure the WebGPU implementation produces bit‑identical or numerically equivalent results to the CPU reference for integer/discrete operations and within tight tolerances for floating‑point operations.
- Provide deterministic replay and checkpointing support on the GPU.
- Enable real‑time execution of the MFM v3 simulation in the browser.
- Establish a validation framework that continuously compares GPU outputs to CPU reference and C++ oracle for all test families.
- Prepare the codebase for integration with the experiment API and the React UI in later phases.

## Detailed Tasks

### 1. Create the WebGPU‑MFM Package

 - Create a new package under `src/webgpu-mfm/`.
 - Initialize `package.json` (name: `@cepc/webgpu-mfm`, private: true) with dependencies on `@cepc/shared-config`, `@cepc/webgpu-core`, and devDependencies: `typescript`, `vitest`, `playwright`.
 - Add an `index.ts` that exports the main simulation class or function.
 - Set up `tsconfig.json` (extends root) with `declaration: true`, `outDir: ./dist`, `rootDir: ./src`, `sourceMap: true`.
 - Add a `README.md` describing the purpose of the package and its API.

### 2. Define the GPU Simulation Pipeline

 - Design a multi‑pass compute pipeline that executes the MFM v3 steps in the correct order:
   1. Input quantization and charge reception.
   2. Thresholding, processing, and decay.
   3. Communication neighborhood and target selection.
   4. History buffers update.
   5. Successful‑cycle detection and health update.
   6. Charge‑dependent spatial range and mechanical force computation.
   7. Mechanics integration (semi‑implicit).
   8. Death and reproduction.
   9. Mutation and offspring initialization.
   10. Output readout.
 - Each step corresponds to a WGSL compute shader or a group of shaders. Ensure that data dependencies between steps are respected (e.g., charge update must complete before communication).
 - Use intermediate buffers for data that is needed in subsequent steps (e.g., forces, neighbor lists).
 - Implement a `MfmWebGPUStepper` class that manages the pipeline, handles buffer binding, and dispatches the compute passes.

### 3. Buffer Management and Data Layout

 - Define a unified memory layout for GPU buffers that stores:
   - `GenomeBuffer`: flat array of genomes.
   - `ParticleStateBuffer`: flat array of particle states (position, velocity, health, charge, senderSet, prevSenderSet).
   - `PopulationMetaBuffer`: metadata (number of active particles, capacity, current timestep).
   - `InputSignalBuffer`: external input signal for the current timestep.
   - `OutputReadoutBuffer`: buffer for the linear readout result.
 - Ensure alignment and padding rules are respected for WebGPU storage buffers (e.g., 16‑byte alignment for `vec4<f32>`).
 - Implement helper functions to serialize/deserialize TypeScript objects to/from GPU buffers.
 - Implement a double‑buffering scheme (ping‑pong buffers) for data that is read and written in the same timestep to avoid read‑after‑write hazards.

### 4. Implement the Full MFM v3 Step in WGSL

#### 4.1 Input Quantization and Charge Reception
 - WGSL kernel that adds external input charge to each particle and adds incoming charge from communication (from previous step).
 - Use uniform buffers for `Q_in_max` and input signal.

#### 4.2 Thresholding, Processing, and Decay
 - WGSL kernel that computes activation, processes charge, and applies decay.
 - Use integer arithmetic for charge to ensure exact matching with CPU reference.

#### 4.3 Communication Neighborhood and Target Selection
 - WGSL kernel that computes pairwise distances (with periodic boundary conditions) and builds a neighbor list for each particle.
 - For now, use a naive O(N²) approach; later phases may optimize with spatial hashing.
 - A second kernel that computes communication scores and performs softmax sampling using the deterministic PRNG.

#### 4.4 History Buffers Update
 - WGSL kernel that updates `senderSet` and `prevSenderSet` based on outgoing communications.

#### 4.5 Successful‑Cycle Detection and Health Update
 - WGSL kernel that computes local reward and updates health based on global error.
 - Use uniform buffers for error signal and health loss factor.

#### 4.6 Charge‑Dependent Spatial Range and Mechanical Force
 - WGSL kernel that computes effective spatial range based on charge.
 - WGSL kernel that computes asymmetric forces between particles within range.

#### 4.7 Mechanics Integration
 - WGSL kernel that updates velocity and position using semi‑implicit integration.
 - Apply periodic wrapping to positions.

#### 4.8 Death and Reproduction
 - WGSL kernel that identifies dead particles and marks them for removal.
 - WGSL kernel that selects parents and creates offspring (genome recombination and mutation).
 - Ensure that the population size never exceeds `N_max`.

#### 4.9 Output Readout
 - WGSL kernel that computes the linear readout from output particles.
 - Store the result in `OutputReadoutBuffer`.

### 5. Deterministic PRNG on GPU

 - Use the deterministic PRNG implementation from Phase 5 (e.g., xorshift32) in all kernels that require randomness (target selection, mutation, etc.).
 - Ensure the PRNG state is stored per particle or per kernel invocation, and that the sequence matches the CPU reference when seeded identically.
 - Implement a test that compares the first N random numbers generated on GPU vs CPU for a given seed.

### 6. Checkpointing and Replay

 - Implement methods to serialize the entire GPU state (all buffers, PRNG state, current timestep) to a CPU‑accessible buffer.
 - Provide a `saveState()` method that copies GPU buffers to CPU memory and returns a serialized object.
 - Provide a `loadState(state)` method that uploads the serialized state back to the GPU buffers.
 - Validate deterministic replay by saving state at step N, restoring it, and verifying that the next M steps match.

### 7. Validation Framework

 - Create a validation script (TypeScript) that:
   - Loads a test case (initial population, genome, input signal, random seed) from the Phase 4 test data.
   - Runs the same test case on the CPU reference, C++ oracle, and WebGPU implementation.
   - Compares the outputs (charge, health, position, velocity, readout) step‑by‑step.
 - Use the test families from Phase 4 (one‑step exact cases, multi‑step causal cases, etc.) as the basis for validation.
 - Allow configurable tolerances for floating‑point comparisons (e.g., 1e‑5 relative error).
 - Generate a report of mismatches for debugging.

### 8. Testing

 - Write unit tests for each compute pass using Vitest and Playwright.
 - Test each kernel in isolation with small populations and compare against CPU reference.
 - Run the full simulation for a small population (e.g., 50 particles) for a few steps and compare the entire trajectory to the CPU reference.
 - Use the golden trajectories from Phase 4 as the source of truth.
 - Aim for >80% coverage on the webgpu‑mfm package.

### 9. CI Integration

 - Add a new GitHub Actions job `webgpu-mfm-tests` that:
   - Installs Node.js, pnpm, and Playwright.
   - Runs the WebGPU tests in a headless Chromium environment.
   - Builds the webgpu‑mfm package and runs unit tests.
   - Runs the validation script against a subset of Phase 4 test families.
 - Note that WebGPU support in CI may be limited; the job should be allowed to be skipped on runners without GPU support, or use a software‑rendered WebGPU implementation (e.g., Dawn) if available.

### 10. Documentation

 - Add a `README.md` in `src/webgpu-mfm/` explaining how to use the WebGPU simulation, how to initialize the pipeline, and how to run validation tests.
 - Document the data layout for each GPU buffer and the expected alignment/padding.
 - Provide examples of how to run a simple simulation (e.g., 10 particles for 10 steps) and how to validate against the CPU reference.
 - Update the top‑level `AGENTS.md` if needed to mention the WebGPU MFM package.

## Deliverables

 - A fully functional WebGPU MFM v3 implementation in `src/webgpu-mfm/`.
 - WGSL compute shaders for each MFM v3 step, assembled into a coherent pipeline.
 - A `MfmWebGPUStepper` class that manages buffer binding and dispatches the compute passes.
 - Deterministic PRNG implementation in WGSL.
 - Checkpointing and replay support.
 - Validation scripts that compare GPU outputs to CPU reference and C++ oracle.
 - A test suite (Vitest + Playwright) covering each compute pass and the full simulation.
 - CI job configuration for WebGPU MFM tests.
 - Documentation on data layout, shader usage, and validation.

## Acceptance Criteria (Exit Conditions for Phase 6)

The following must succeed in a fresh checkout after Phase 5 is complete:

```bash
# From repository root
pnpm install   # (if not already done)

# Lint the webgpu-mfm package
pnpm run lint -- --filter @cepc/webgpu-mfm

# Run unit tests for webgpu-mfm
pnpm test -- --filter @cepc/webgpu-mfm

# Build the webgpu-mfm package
pnpm run build -- --filter @cepc/webgpu-mfm

# Run validation tests (compare GPU vs CPU reference for a subset of Phase 4 test families)
pnpm run test:webgpu-mfm-validation
```

Specifically:
 - The WebGPU simulation can be initialized and run for a small population (e.g., 50 particles) for at least 10 steps.
 - The WebGPU output matches the CPU reference for integer/discrete fields exactly and within 1e‑5 relative error for floating‑point fields.
 - The PRNG on GPU produces the same sequence as the TypeScript and C++ PRNGs when seeded identically.
 - Checkpointing and replay work: saving state at step N and restoring it yields identical subsequent steps.
 - The validation script reports no mismatches for the test families selected.
 - The code is lint‑clean (ESLint + Prettier) and builds without errors.
 - The CI job runs the WebGPU MFM tests (or skips gracefully if WebGPU is not available) and reports success.

## Dependencies and Tool Versions (inherited from earlier phases)

 - Node.js: >=18.x (LTS)
 - pnpm: >=8.x
 - TypeScript: >=5.0
 - Vitest: >=1.0
 - Playwright: >=1.40 (for headless browser tests)
 - WebGPU support: Chromium with WebGPU enabled (or a software WebGPU implementation like Dawn for CI)

## Notes for Future Phases

 - Phase 7 (Experiment API) will use this WebGPU implementation to run Stage IV experiments in the browser.
 - Performance optimizations (spatial hashing, workgroup sizing, memory coalescing) will be explored in later phases.
 - The validation framework established here will be reused to ensure that any future optimizations do not change scientific behavior.
 - Consider adding a fallback CPU path for environments without WebGPU support.
 - Keep the WGSL shaders modular and well‑documented to facilitate future changes.

## Checklist

 - [ ] src/webgpu-mfm/ package folder created
 - [ ] package.json (name: @cepc/webgpu-mfm) present
 - [ ] tsconfig.json (extends root) present
 - [ ] MfmWebGPUStepper class implemented with multi‑pass pipeline
 - [ ] GPU data structures defined with correct alignment
 - [ ] Double‑buffering scheme implemented for read‑write hazards
 - [ ] WGSL kernels for each MFM v3 step implemented
 - [ ] Deterministic PRNG implemented in WGSL and validated
 - [ ] Checkpointing and replay support implemented
 - [ ] Validation script that compares GPU vs CPU outputs for Phase 4 test families
 - [ ] Vitest + Playwright tests for each compute pass and full simulation, with >80% coverage
 - [ ] CI job for WebGPU MFM tests added and passing (or gracefully skipped)
 - [ ] README in src/webgpu-mfm/ with usage examples and data layout documentation
 - [ ] Acceptance criteria checks pass (manual or automated)

---

*This plan is derived from the Implementation Phases section (32) of the Reference Implementation and the broader documentation in `/docs/` (especially Minimal Formal Model v3.md, Technical Framework v4.md, Experimental Design.md, and Reference Implementation itself). It is intended to be executed after Phase 5 is complete and before the experiment API and UI integration begins.*
