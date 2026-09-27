# Repository Guidelines

## Project Structure

- `src/`: Contains `cpu-reference/` (TS), `cpp-oracle/` (C++), `webgpu-core/`, `experiment-api/`, `shared-config/`, `react-ui/`, `web-worker/`, plus `build/` and `tests/`.
- `docs/`: Design documentation.

## Build, Test, and Development Commands

- **TS**: `npm install`, `npm run build`, `npm test` (Jest)
- **C++**: `cmake`, `make`, `ctest`
- **Dev**: `npm run dev` (Vite dev server) for local experimentation
- **Experiments**: `npm run experiment -- --manifest <path>`
- **Lint**: `npm run lint` (ESLint + Prettier for TS, `clang-format` for C++)

## Coding Style & Naming Conventions

- **TS**: Prefer `pascalCase` for types, `camelCase` for variables/functions. Use ESLint with `@typescript-eslint` and Prettier (2‑space tabs, single quotes, 100‑char line limit).
- **C++**: Follow Google C++ Style Guide; enforce with `clang-format`. File names `snake_case.cpp`, headers `.hpp`. Namespaces: `cepc::<component>`.
- **General**: Keep functions small, document complex invariants, avoid `any` in TS, prefer `constexpr` in CPP.

## Testing Guidelines

- **Unit tests**: Jest for TS, GoogleTest for C++. Aim for >80% coverage on core logic.
- **Cross‑validation**: Automated checks that CPU reference and C++ oracle produce identical outputs for seeded inputs.
- **Experiment validation**: Compare Stage IV manifests against known baselines (see `docs/Experimental_Design.md`).
- **Deterministic replay**: Ensure checkpoint/restore yields bit‑identical trajectories.
- **WebGPU**: Use automated browser testing (e.g., Playwright) for rendering and performance.

## Commit & Pull Request Guidelines

- **Commits**: Imperative mood, scope prefix (e.g., `cpu-reference: add charge decay`, `webgpu-core: fix texture sync`). Reference related issues.
- **Pull Requests**: Must include:
  - Summary of changes and motivation
  - Link to relevant design doc or issue
  - For UI changes: screenshots or demo video
  - For logic changes: test results and validation notes
  - Ensure all tests pass and linting succeeds.
- **Branch strategy**: `main` is stable; feature branches from `main`; PRs require approval.

## Architecture Overview

Follow the layered schema from `docs/Reference_Implementation.md`:

1. **MFM v3 Schema** – immutable model definition (shared config)
2. **CPU Reference** – TypeScript implementation for correctness
3. **C++ Oracle** – independent validation backend
4. **WebGPU Core** – GPU‑accelerated execution
5. **Experiment API** – orchestrates Stage IV protocols
6. **Render & UI** – React/WebWorker for real‑time visualization
All backends must cross‑validate against the schema.

## Additional Notes

- This repository will host both source code and documentation.
- Keep scientific invariants in `shared-config/`; never alter them without consensus.
- When in doubt, consult the frozen specifications in `docs/.
