# Continuous Evolutionary Particle Computation (CEPC)

## Overview

CEPC explores a novel computational paradigm where computation emerges from a continuously active, self‑organizing population of simple particles. The project follows a staged research roadmap from conceptual foundations to empirical validation, with a frozen **Minimal Formal Model v3 (MFM v3)** as the authoritative scientific specification.

The current repository hosts design documentation and will host the implementation of multiple validated backends: a TypeScript CPU reference, an independent C++20 oracle, a WebGPU GPU core, an experiment API, and a React UI for real‑time visualization and browser deployment.

## Project Status

- **Stages I‑IV**: Complete (conceptual foundations, formalization, analysis, experimental design)
- **Stage V**: Reference implementation (complete)
- **Stages VI‑VIII**: Initial experiments, paradigm investigation, and deployment (in progress)

See docs/Research_Roadmap_Stages_I-VII.md for details.

## Repository Structure

- docs/: Design and research documentation (Technical Framework, Minimal Formal Model, Reference Implementation, Experimental Design, etc.)
- src/: Source code
  - cpu-reference/: TypeScript reference implementation
  - cpp-oracle/: C++20 independent validation
  - webgpu-core/: WebGPU GPU backend
  - webgpu-mfm/: WebGPU MFM v3 implementation
  - experiment-api/: Stage IV experiment orchestration
  - shared-config/: Immutable model schema and constants
  -

eact-ui/: Browser UI (React + TypeScript)

- web-worker/: Off‑thread computation
- build/,  ests/: Build and test scripts

## Getting Started

The implementation is in progress. To set up the TypeScript parts once the source is present:
`
pnpm install
pnpm run dev
`
For the C++ oracle:
`
cmake -S src/cpp-oracle -B build
cmake --build build
ctest --test-dir build
`
Linting and tests:
`
pnpm run lint
pnpm test
`
See AGENTS.md for full contributor guidelines and docs/Reference_Implementation.md for the detailed implementation plan.

## Deployment

The platform can be deployed to GitHub Pages using the CI/CD pipeline or manually:

### Manual Deployment

`
pnpm install
pnpm run deploy
`

### Automatic Deployment

Pushes to the main branch will automatically trigger the CI/CD pipeline which:

1. Runs linting, unit tests, and behavioral tests
2. Builds the React UI and WebGPU simulation
3. Deploys to GitHub Pages at https://[username].github.io/continuous-evolutionary-particle-computation/

## Key Design Principles

- **Scientific integrity**: The MFM v3 specification is frozen; implementation must validate against it.
- **Cross‑validation**: CPU reference and C++ oracle must produce identical results for seeded inputs.
- **Reproducibility**: Deterministic replay and checkpointing are required.
- **GPU‑first browser platform**: WebGPU enables real‑time execution and public deployment on GitHub Pages.

## License

License to be determined. Please contact the maintainers for usage terms.

## Validation

Scientific validation and performance characterization are documented in [docs/validation/validation-report.md](docs/validation/validation-report.md).

## Public Release

The CEPC simulator is publicly available at <https://juanlorenteguarnieri.github.io/continuous-evolutionary-particle-computation/>
Version: v0.1.0
Implemented features: MFM v3, CPU reference, C++ oracle, WebGPU backend, experiment runner
Validation status: See docs/validation/validation-report.md
Known limitations: Max ~1e5 particles in browser, WebGPU required, memory constraints
