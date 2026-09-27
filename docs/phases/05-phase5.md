# Phase 5: WebGPU Foundations

## Objective

Establish the WebGPU compute foundations for the Continuous Evolutionary Particle Computation (CEPC) project, enabling GPU‑accelerated execution of the Minimal Formal Model v3 (MFM v3) while preserving scientific correctness. This phase builds the GPU primitives and infrastructure that will later be used to implement the full MFM v3 simulation on the GPU, validated against the TypeScript CPU reference and the C++ oracle from earlier phases.

## Goals

- Create a WebGPU‑based compute layer that can perform basic GPU operations (buffer creation, compute shaders, dispatch, read‑back) in a browser‑compatible environment.
- Implement GPU primitives that correspond to MFM v3 mechanisms (neighbor search, charge update, communication, mechanics) as isolated, testable compute kernels.
- Ensure deterministic behavior for integer and discrete operations on the GPU, matching the CPU reference and C++ oracle.
- Provide a validation framework that compares GPU outputs to the CPU reference for a set of canonical test cases.
- Establish a build and CI pipeline for WebGPU code (using Vite, TypeScript, and automated tests).
- Lay the groundwork for the full WebGPU MFM v3 implementation in Phase 6.

## Detailed Tasks

### 1. Create the WebGPU‑Core Package

- Create a new package under `src/webgpu-core/`.
- Initialize `package.json` (name: `@cepc/webgpu-core`, private: true) with dependencies: TypeScript, Vite (for dev), and devDependencies: Vitest, Playwright (for browser tests), `@webgpu/types` (if available), and `ts‑webgpu` utilities.
- Add an `index.ts` that exports the WebGPU helper functions and classes.
- Set up `tsconfig.json` (extends root) with `declaration: true`, `outDir: ./dist`, `rootDir: ./src`, `sourceMap: true`.
- Add a `README.md` describing the purpose of the package and its API.

### 2. WebGPU Environment Setup

- Create a utility class `WebGPUContext` that:
  - Requests a WebGPU adapter and device.
  - Provides methods to create buffers, bind groups, pipelines, and dispatch compute shaders.
  - Handles errors gracefully and provides informative messages for debugging.
- Write a simple test that creates a buffer, writes data, runs a trivial compute shader (e.g., add two numbers), and reads back the result.
- Ensure the test runs in a headless browser environment (e.g., Playwright with Chromium) for CI.

### 3. Define GPU Data Structures

- Define TypeScript interfaces for GPU buffers that mirror the MFM v3 data structures:
  - `GenomeBuffer`: flat array of genomes (each genome is a struct of floats/ints).
  - `ParticleStateBuffer`: flat array of particle states (position, velocity, health, charge, senderSet, etc.).
  - `PopulationBuffer`: metadata about the population (number of active particles, capacity, etc.).
- Use `Float32Array` for floating‑point fields and `Uint32Array` or `Int32Array` for integer fields.
- Implement helper functions to serialize/deserialize TypeScript objects to/from GPU buffers.
- Ensure alignment and padding rules are respected for WebGPU storage buffers (e.g., 16‑byte alignment for `vec4<f32>`).

### 4. Implement Basic GPU Primitives

#### 4.1 Buffer Creation and Management

- Write functions to allocate GPU buffers with the appropriate usage flags (`GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC`).
- Provide a utility to write data to a buffer from the CPU and read data back.
- Test with a simple add‑two‑arrays kernel.

#### 4.2 Compute Shader for Charge Update

- Write a WGSL compute shader that takes a `ParticleStateBuffer` and updates charge according to the MFM v3 charge update rules (thresholding, processing, decay).
- The shader should be parameterized (e.g., `Q_max`, `delta_q`) via uniform buffers.
- Ensure integer arithmetic is performed correctly (WGSL supports `i32` and `u32`).
- Write a test that compares GPU output to CPU reference for a small population (e.g., 10 particles) with a fixed seed.

#### 4.3 Compute Shader for Communication Neighborhood

- Implement a naive O(N²) neighbor search kernel that computes pairwise distances (with periodic boundary conditions) and writes a neighbor list for each particle.
- For now, store neighbor lists in a fixed‑size buffer (e.g., each particle can have up to K neighbors). Later phases may use spatial hashing.
- Validate against CPU reference for small populations.

#### 4.4 Compute Shader for Target Selection

- Implement a WGSL kernel that computes communication scores `S_{ij}` and performs softmax sampling.
- Because softmax involves exponentials, use a numerically stable implementation (subtract max before exponentiation).
- Sampling on GPU can be done via a deterministic PRNG (e.g., xorshift32 implemented in WGSL) seeded per particle.
- Compare GPU results to CPU reference for deterministic seeds.

#### 4.5 Compute Shader for Mechanics

- Implement a WGSL kernel for asymmetric force computation and semi‑implicit integration.
- Forces may be computed in a separate kernel that writes forces to a buffer, then another kernel that integrates positions and velocities.
- Ensure that the kernel respects the periodic boundary conditions.
- Validate against CPU reference for small populations.

### 5. Deterministic PRNG on GPU

- Implement a WGSL PRNG (e.g., xorshift32 or PCG32) that can be seeded per particle or per kernel invocation.
- Ensure the PRNG produces the same sequence as the TypeScript and C++ implementations when seeded identically.
- Write a test that compares the first N random numbers generated on GPU vs CPU for a given seed.

### 6. Validation Framework

- Create a validation script (TypeScript) that:
  - Loads a test case (initial population, genome, input signal, random seed).
  - Runs the same test case on the CPU reference and the WebGPU backend.
  - Compares the outputs (charge, health, position, velocity, readout) step‑by‑step.
- Use the test families from Phase 4 (one‑step exact cases, multi‑step causal cases, etc.) as the basis for validation.
- Allow configurable tolerances for floating‑point comparisons (e.g., 1e‑5 relative error).
- Generate a report of mismatches for debugging.

### 7. Testing

- Write unit tests for each WebGPU primitive using Vitest and a headless browser (Playwright).
- Test buffer creation, data transfer, and shader execution.
- Test each kernel (charge update, neighbor search, target selection, mechanics) against the CPU reference.
- Use the golden trajectories from Phase 4 as the source of truth.
- Aim for >80% coverage on the webgpu-core package.

### 8. CI Integration

- Add a new GitHub Actions job `webgpu-tests` that:
  - Installs Node.js and pnpm.
  - Runs the WebGPU tests in a headless Chromium environment using Playwright.
  - Builds the WebGPU package and runs unit tests.
  - Optionally, runs the validation script against a subset of the Phase 4 test families.
- Note that WebGPU support in CI may be limited; the job should be allowed to be skipped on runners without GPU support, or use a software‑rendered WebGPU implementation (e.g., Dawn) if available.

### 9. Documentation

- Add a `README.md` in `src/webgpu-core/` explaining how to use the WebGPU context, how to write compute shaders, and how to run tests.
- Document the data layout for each GPU buffer and the expected alignment/padding.
- Provide examples of how to run a simple kernel (e.g., charge update) and how to validate against the CPU reference.
- Update the top‑level `AGENTS.md` if needed to mention the WebGPU package.

## Deliverables

- A fully functional WebGPU‑core package in `src/webgpu-core/`.
- WebGPU context utilities for creating buffers, pipelines, and dispatching compute shaders.
- WGSL compute shaders for charge update, communication neighborhood, target selection, and mechanics (as basic primitives).
- A deterministic PRNG implementation in WGSL.
- Validation scripts that compare GPU outputs to CPU reference and C++ oracle.
- A test suite (Vitest + Playwright) covering buffer management and each primitive.
- CI job configuration for WebGPU tests.
- Documentation on data layout, shader usage, and validation.

## Acceptance Criteria (Exit Conditions for Phase 5)

The following must succeed in a fresh checkout after Phase 4 is complete:

```bash
# From repository root
pnpm install   # (if not already done)

# Lint the webgpu-core package
pnpm run lint -- --filter @cepc/webgpu-core

# Run unit tests for webgpu-core
pnpm test -- --filter @cepc/webgpu-core

# Build the webgpu-core package
pnpm run build -- --filter @cepc/webgpu-core

# Run validation tests (compare GPU vs CPU reference for a subset of Phase 4 test families)
pnpm run test:webgpu-validation
```

Specifically:

- The WebGPU context can be created and used to create buffers, pipelines, and dispatch compute shaders in a headless browser.
- The charge update kernel produces identical results to the CPU reference for a small population with a fixed seed.
- The neighbor search kernel produces identical neighbor lists to the CPU reference for a small population.
- The target selection kernel produces identical target selections to the CPU reference for a fixed seed.
- The mechanics kernel produces positions and velocities that match the CPU reference within a small tolerance.
- The PRNG on GPU produces the same sequence as the TypeScript and C++ PRNGs when seeded identically.
- The validation script reports no mismatches for the test families selected.
- The code is lint‑clean (ESLint + Prettier) and builds without errors.
- The CI job runs the WebGPU tests (or skips gracefully if WebGPU is not available) and reports success.

## Dependencies and Tool Versions (inherited from earlier phases)

- Node.js: >=18.x (LTS)
- pnpm: >=8.x
- TypeScript: >=5.0
- Vitest: >=1.0
- Playwright: >=1.40 (for headless browser tests)
- WebGPU support: Chromium with WebGPU enabled (or a software WebGPU implementation like Dawn for CI)

## Notes for Future Phases

- Phase 6 (WebGPU MFM v3) will combine these primitives into a full simulation kernel that runs the entire MFM v3 step on the GPU.
- Performance optimizations (spatial hashing, workgroup sizing, memory coalescing) will be explored in later phases.
- The validation framework established here will be reused to ensure that GPU optimizations do not change scientific behavior.
- Consider adding a fallback CPU path for environments without WebGPU support.
- Keep the WGSL shaders modular and well‑documented to facilitate future changes.

## Checklist

- [ ] src/webgpu-core/ package folder created
- [ ] package.json (name: @cepc/webgpu-core) present
- [ ] tsconfig.json (extends root) present
- [ ] WebGPUContext class implemented with buffer/pipeline utilities
- [ ] Simple compute shader (add two numbers) test passes
- [ ] GPU data structures defined (GenomeBuffer, ParticleStateBuffer, etc.) with correct alignment
- [ ] Charge update WGSL kernel implemented and tested against CPU reference
- [ ] Neighbor search WGSL kernel implemented and tested against CPU reference
- [ ] Target selection WGSL kernel implemented and tested against CPU reference
- [ ] Mechanics WGSL kernel implemented and tested against CPU reference
- [ ] Deterministic PRNG implemented in WGSL and validated against TypeScript/C++ PRNG
- [ ] Validation script that compares GPU vs CPU outputs for Phase 4 test families
- [ ] Vitest + Playwright tests for each primitive, with >80% coverage
- [ ] CI job for WebGPU tests added and passing (or gracefully skipped)
- [ ] README in src/webgpu-core/ with usage examples and data layout documentation
- [ ] Acceptance criteria checks pass (manual or automated)

---

*This plan is derived from the Implementation Phases section (32) of the Reference Implementation and the broader documentation in `/docs/` (especially Minimal Formal Model v3.md, Technical Framework v4.md, Experimental Design.md, and Reference Implementation itself). It is intended to be executed after Phase 4 is complete and before the full WebGPU MFM v3 implementation begins.*
