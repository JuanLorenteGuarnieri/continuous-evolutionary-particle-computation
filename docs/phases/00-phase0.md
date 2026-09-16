# Phase 0: Repository and Toolchain Bootstrap

## Objective

Set up a reproducible development environment that allows building, testing, and linting the CEPC codebase with zero configuration friction. This phase establishes the monorepo toolchain, language configurations, and CI foundations before any scientific implementation begins.

## Goals

- Enable developers to clone the repository and run a single command to install all dependencies.
- Provide a working TypeScript + React + Vite starter that displays an empty shell.
- Provide a compilable C++20 project using CMake that can be built and linked (even if empty).
- Configure a Python virtual environment for experiment orchestration and analysis.
- Set up unit test frameworks (Vitest for TS/JS, GoogleTest for C++, pytest for Python) with passing empty tests.
- Establish CI workflows (GitHub Actions) that run on push and pull request to validate builds and tests.
- Define clear package boundaries within the `src/` monorepo using pnpm workspaces.
- Ensure linting and formatting are configured (ESLint, Prettier, clang-format).

## Detailed Tasks

### 1. Repository Initialization

- Ensure the repository root contains a README, .gitignore, LICENSE (to be added), and this documentation.
- Verify that the `docs/` folder contains all design documents.

### 2. pnpm Workspace Setup

- Create `pnpm-workspace.yaml` at the root with packages: `src/*`.
- Add an empty `package.json` at the root (private: true) to manage workspace-wide devDependencies (e.g., typescript, vite, vitest, @types/react, etc.).
- Configure a `.npmrc` to enforce pnpm usage and set engine-strict if desired.

### 3. TypeScript Configuration

- Create a root `tsconfig.json` that extends to individual package configs.
- Set strict mode, noImplicitAny, moduleResolution bundler, target ES2022, lib DOM and ES2022.
- Add path aliases for `@cepc/*` mapping to `src/*/src` if needed.

### 4. Vite + React Setup

- Inside `src/` create a package for the UI, e.g., `src/react-ui`.
- Initialize `package.json` with dependencies: react, react-dom.
- Add devDependencies: @vitejs/plugin-react, vite.
- Create `vite.config.ts` with React plugin and base path configuration for GitHub Pages.
- Add a minimal `index.html` and `main.tsx` that renders an empty `<div id="root"></div>`.
- Add a test file `main.test.tsx` that renders the component and asserts it renders without crashing (using Vitest + React Testing Library).

### 5. React Testing Library & Vitest

- Install Vitest, @vitest/ui, @testing-library/react, @testing-library/jest-dom.
- Create a vitest config (`vitest.config.ts`) that includes jsdom environment and setupFiles.
- Add a setup file to import jest-dom.
- Ensure `pnpm test` runs Vitest in watch mode for CI (with `--run`).

### 6. C++20 Oracle Project

- Create a folder `src/cpp-oracle`.
- Add a `CMakeLists.txt` that sets C++20 standard, enables warnings, and defines an empty library or executable.
- Add a simple test source file (e.g., `tests/test_main.cpp`) using GoogleTest.
- Configure GoogleTest as a dependency (either via FetchContent or assume installed; for CI we can install packages).
- Add a basic test that passes (e.g., `EXPECT_TRUE(true)`).

### 7. Python Environment

- Create a `python/` directory at the root (or inside src/experiment-api) for experiment orchestration scripts.
- Add a `pyproject.toml` or `requirements.txt` specifying pytest and any scientific libraries (e.g., numpy, pandas) as needed.
- Create a minimal `conftest.py` and a dummy test file to ensure pytest works.

### 8. Test Framework Configuration

- **Vitest**: already configured; ensure test files match `*.test.{ts,tsx}`.
- **GoogleTest**: In CMake, enable testing and add the test executable; use `ctest --test-dir build --output-on-failure` for CI.
- **pytest**: Ensure discovery of tests in `python/` folder.

### 9. Linting and Formatting

- **TypeScript/JS**: Install ESLint, Prettier, eslint-plugin-react, eslint-plugin-react-hooks, @typescript-eslint/parser, @typescript-eslint/eslint-plugin.
  - Create `.eslintrc.cjs` extending recommended rules for TS, React, and Prettier.
  - Create `.prettierrc` with preferred formatting (semi: true, singleQuote: true, trailingComma: es5, etc.).
  - Add lint script: `"lint": "eslint \"src/**/*.{ts,tsx,js,jsx}\""`.
- **C++**: Install clang-format.
  - Create a `.clang-format` file based on Google style or LLVM.
  - Add a lint script: `"lint:cpp": "clang-format --dry-run --Werror src/cpp-oracle/**/*.{cpp,hpp}"` (or similar).
- **Python**: Install flake8 or black; optionally add a lint script.

### 10. GitHub Actions CI

- Create `.github/workflows/ci.yml`.
- On push and pull request to main:
   - Setup Node.js (use pnpm-action/setup-pnpm).
   - Install dependencies with `pnpm install`.
   - Run `pnpm test` (Vitest).
   - Run `pnpm run lint` (ESLint + Prettier).
   - Setup C++ environment (install cmake, a compiler, and optionally GoogleTest via package manager).
   - Configure and build C++ project: `cmake -S src/cpp-oracle -B build && cmake --build build`.
   - Run C++ tests: `ctest --test-dir build --output-on-failure`.
   - Setup Python (use actions/setup-python).
   - Install Python dependencies: `pip install -r python/requirements.txt` (or pyproject).
   - Run pytest: `pytest python/`.
   - Optionally build the Vite app: `pnpm run build` (vite build) and verify output.

### 11. Documentation

- Update `AGENTS.md` if needed (already done).
- Ensure the phase 0 plan is recorded here for posterity.

### 12. Optional: Experiment API Placeholder

- Create a folder `src/experiment-api` with a placeholder `package.json` (maybe later depends on shared-config).
- No implementation needed yet.

## Deliverables

- A monorepo structure under `src/` with the following packages:
  - `cpu-reference` (placeholder)
  - `cpp-oracle` (CMake project)
  - `webgpu-core` (placeholder)
  - `experiment-api` (placeholder)
  - `shared-config` (placeholder)
  - `react-ui` (Vite + React starter)
  - `web-worker` (placeholder)
  - Plus root config files.
- A `pnpm-lock.yaml` (generated).
- A working CI badge (once enabled) showing passing builds.

## Acceptance Criteria (Exit Conditions for Phase 0)

The following commands must succeed in a fresh checkout on a clean runner (e.g., Ubuntu-latest):

```bash
# Install dependencies
pnpm install

# Run linting (should pass with no errors)
pnpm run lint

# Run TypeScript/Vitest tests
pnpm test

# Build the Vite app (production build)
pnpm run build

# Configure and build C++ oracle
cmake -S src/cpp-oracle -B build
cmake --build build

# Run C++ tests
ctest --test-dir build --output-on-failure

# Run Python tests
pytest python/
```

All commands should exit with code 0 and produce no test failures.

## Dependencies and Tool Versions (as of phase 0)

- Node.js: >=18.x (LTS)
- pnpm: >=8.x
- TypeScript: >=5.0
- Vite: >=5.0
- React: >=18.0
- Vitest: >=1.0
- GoogleTest: any version compatible with C++20 (provided via package manager or FetchContent)
- CMake: >=3.20
- C++ compiler: supports C++20 (gcc>=11, clang>=12, MSVC>=19.30)
- Python: >=3.10
- pytest: >=7.0

## Notes for Future Phases

- Phase 0 establishes the foundations; subsequent phases will fill in the implementation of each package.
- Keep the workspace root clean; avoid placing source files directly in `src/` except as package folders.
- When adding new packages, remember to add them to the pnpm workspace if they are Node.js packages.
- For C++ packages, ensure they are added to the root CMakeLists.txt if a top-level project is desired, or keep them separate with their own CMake.
- The CI workflow may be optimized later (caching, parallel jobs) but must remain correct.

## Checklist

- [ ] pnpm-workspace.yaml created
- [ ] Root package.json (private) with workspace config
- [ ] tsconfig.json (root) and base configs
- [ ] src/react-ui with Vite + React starter
- [ ] Vitest configured and passing a dummy test
- [ ] ESLint + Prettier configured and lint script passes
- [ ] src/cpp-oracle with CMakeLists.txt and a dummy GoogleTest passing
- [ ] Python test environment with a dummy pytest passing
- [ ] GitHub Actions CI workflow defined and tested on a push
- [ ] README updated with development instructions (optional)
- [ ] All acceptance criteria pass in CI

---

*This plan is derived from the Implementation Phases section (32) of the Reference Implementation and the broader documentation in `/docs/`. It is intended to be executed before any scientific coding begins.*
