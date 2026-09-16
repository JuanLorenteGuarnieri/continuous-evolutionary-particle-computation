# Continuous Evolutionary Particle Computation (CEPC)

## Overview
CEPC explores a novel computational paradigm where computation emerges from a continuously active, self‑organizing population of simple particles. The project follows a staged research roadmap from conceptual foundations to empirical validation, with a frozen **Minimal Formal Model v3 (MFM v3)** as the authoritative scientific specification.

The current repository hosts design documentation and will host the implementation of multiple validated backends: a TypeScript CPU reference, an independent C++20 oracle, a WebGPU GPU core, an experiment API, and a React UI for real‑time visualization and browser deployment.

## Project Status
- **Stages I‑IV**: Complete (conceptual foundations, formalization, analysis, experimental design)
- **Stage V**: Reference implementation (next)
- **Stages VI‑VII**: Initial experiments and paradigm investigation (pending)

See `docs/Research_Roadmap_Stages_I-VII.md` for details.

## Repository Structure
- `docs/`: Design and research documentation (Technical Framework, Minimal Formal Model, Reference Implementation, Experimental Design, etc.)
- `src/`: Source code (to be created)
  - `cpu-reference/`: TypeScript reference implementation
  - `cpp-oracle/`: C++20 independent validation
  - `webgpu-core/`: WebGPU GPU backend
  - `experiment-api/`: Stage IV experiment orchestration
  - `shared-config/`: Immutable model schema and constants
  - `react-ui/`: Browser UI (React + TypeScript)
  - `web-worker/`: Off‑thread computation
  - `build/`, `tests/`: Build and test scripts

## Getting Started
The implementation is in progress. To set up the TypeScript parts once the source is present:
```bash
npm install
npm run dev
```
For the C++ oracle:
```bash
cmake -S . -B build
cmake --build build
ctest --test-dir build
```
Linting and tests:
```bash
npm run lint
npm test
```
See `AGENTS.md` for full contributor guidelines and `docs/Reference_Implementation.md` for the detailed implementation plan.

## Key Design Principles
- **Scientific integrity**: The MFM v3 specification is frozen; implementation must validate against it.
- **Cross‑validation**: CPU reference and C++ oracle must produce identical results for seeded inputs.
- **Reproducibility**: Deterministic replay and checkpointing are required.
- **GPU‑first browser platform**: WebGPU enables real‑time execution and public deployment on GitHub Pages.

## License
License to be determined. Please contact the maintainers for usage terms.
