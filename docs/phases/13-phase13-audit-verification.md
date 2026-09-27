# Phase 13 Report: Reproducibility and CI Foundations

Companion to `docs/phases/13-phase13-audit.md`. This records what was actually checked, how, and what was changed as a result — before any Phase 14 (instrumentation/benchmarking) or later work begins.

## Baseline status

**Not fully established.** This environment has no network access and no `pnpm` installed (Node 22.22.2 and npm 10.9.7 are present; a direct request to the npm registry returned `403 host_not_allowed`). A genuine `pnpm install → typecheck → lint → test → build` run could not be performed. What follows instead is: (a) targeted local execution with plain `node`, which needs no install, used to reproduce specific failure hypotheses in isolation, and (b) static reading of configs/scripts for everything install-dependent. Item 1 of the requested checklist (clean-checkout install/typecheck/lint/test/build) is therefore the single largest open item after this phase — it needs to be run for real, by the user or a session with network access, before Phase 14 starts.

## Findings, by the seven checklist items

### 1. Clean-checkout install/typecheck/lint/test/build

**Blocked by environment.** Could not run `pnpm install` (no network) or any command that depends on it (`typecheck`, `lint`, `test`, `build` all need installed devDependencies — `typescript`, `vitest`, `eslint`, `vite`). Nothing here should be read as "passing" or "failing" — it is simply unrun. This is the first thing to do with real network/pnpm access.

### 2. Behavioral tests depending on pre-existing `dist/` artifacts

**Confirmed, with a more precise root cause than originally hypothesized.** Reproduced the exact command the `"test"` script runs (`node ../../tests/behavioral/run-tests.js`, from `src/behavioral-tests/`) directly with plain Node:

- With `dist/` present (as in the supplied zip): fails immediately at `Cannot find module '.../shared-config/src/types'`, thrown from inside `shared-config/src/index.js`'s own internal import — this happens *before* the code ever reaches the `cpu-reference/dist` import, and is independent of whether `dist/` exists.
- Isolating the `cpu-reference/dist` import on its own, with `dist/` removed (simulating a clean checkout, since `dist/` is `.gitignore`d): fails with `Cannot find module '.../dist/cpu-reference/src/MfmCpuReference.js'` — the file genuinely does not exist, confirming the original hypothesis for *this* part.
- Root cause of the first failure: `shared-config`'s (and by inheritance, other packages') `tsconfig.json` sets `"moduleResolution": "Bundler"`, which is correct for how the app actually consumes this code (Vite resolving `"exports": "./src/index.ts"` directly) but permits extensionless relative imports that `tsc` does not rewrite on emit. The resulting compiled `.js` is not valid input for Node's native ESM resolver, which requires explicit extensions. Re-running `tsc` would reproduce the same broken output — this is not simply "nobody built it yet."
- While investigating this, found that `tests/behavioral/behavioral.test.ts` already exists, is logically equivalent to `run-tests.js`, and correctly imports via the `@cepc/shared-config` / `@cepc/cpu-reference` package specifiers (the same resolution path the real app already uses successfully) — but was not wired into any package.json script.

### 3. `src/experiment-api/package.json` duplicate `test` keys

**Confirmed empirically.** `node -e "console.log(require('./src/experiment-api/package.json').scripts.test)"` printed the stub (`node -e "console.log('experiment-api test stub')"`), not `vitest run` — confirming JSON's documented last-key-wins parsing behavior applies here, and that the real vitest suite was dead in any tooling path that reads this file (including `pnpm test --filter @cepc/experiment-api`, which `ci-cd.yml` ran).

### 4. Whether current CI provides typecheck/test/build/deploy validation

**Confirmed via direct reading of all four workflow files.**

| | typecheck | test | prod build | deploy-artifact validation |
| --- | --- | --- | --- | --- |
| `ci.yml` (old) | no | yes, but skipped several suites | yes | n/a |
| `ci-cd.yml` (old) | no | yes, more suites, some tolerant of failure | no | n/a |
| `deploy.yml` | no | yes | yes | no — uploads and deploys `dist/` without serving/smoke-testing it |
| `validation.yml` | no | no | no | runs `validate:subset` (does not test the GPU backend — see the audit, §3) and the `benchmark` stub |

No workflow ran `tsc` in a mode that actually checks types.

### 5. Redundancy between `ci.yml` and `ci-cd.yml`, and consolidation

**Confirmed redundant** — both triggered on identical `push`/`pull_request` events to `main` and shared setup, lint, and the core `pnpm test` step. Consolidated into a single `ci.yml` that is a strict superset of both (every step either original file had is still present), plus a new typecheck step. See "Files changed" below.

### 6. GitHub Pages production build: base path, workers, WGSL/shader resources, static assets

- **Base path:** confirmed correct — `vite.config.ts`'s `base: '/continuous-evolutionary-particle-computation/'` matches the live URL stated in `README.md` exactly.
- **WGSL/shader resources:** confirmed **not a risk** — `grep`ing all of `src/` for `.wgsl` found zero imports of the two `.wgsl` files anywhere in real code; the actual shaders are embedded as JS template-literal strings in `MfmWebGPUStepper.ts`, so they are baked into the JS bundle and have no separate, base-path-sensitive load path.
- **Static assets:** none of note — no `public/` directory, no `<base href>`, standard Vite `index.html`. Low risk, not investigated further.
- **Workers:** **not resolved — flagged as the top open risk.** `main.tsx:503-504` does `new Worker(new URL('@worker', import.meta.url))`, where `@worker` is a `resolve.alias`, not a relative path. This is a documented category of Vite fragility (found real, current GitHub issues — vitejs/vite#15056, vitejs/vite#7788 — describing exactly this alias-plus-`new URL`-plus-worker combination failing to be statically analyzed correctly in various Vite versions), *and* Vite's own docs state the URL argument "must be static so it can be analyzed, otherwise... left as is." Against that: the original (uncleaned) zip's stale `src/react-ui/dist/assets/worker-*.js` is direct evidence that a real build of this exact code *did* successfully produce a separate worker chunk at some point. Net assessment: genuinely uncertain either way from static analysis alone — this needs an actual `pnpm run build` followed by inspecting the `dist/` chunk list and serving `dist/` with a static server (not the dev server) to confirm the worker file is produced and loads correctly under the `/continuous-evolutionary-particle-computation/` base path. Not changed in this phase, since altering it would be a behavior change to production code, outside Phase 13's reproducibility/CI scope.

### 7. Mixed npm/pnpm lockfiles: tracked or local-only?

**Not fully resolvable without git history — the zip contains no `.git` directory.** `.gitignore` contains a bare `package-lock.json` rule (no leading slash), which under standard git semantics matches at any depth, so `/package-lock.json`, `src/react-ui/package-lock.json`, and `src/shared-config/package-lock.json` should all be excluded from version control *if* this `.gitignore` content has been in place since before those files were first added. That's a reasonable inference, not a certainty — it's possible (if unusual) for a file to have been committed before a matching ignore rule existed and remain tracked despite it. No repository changes were made based on this inference; recommend confirming with `git ls-files | grep -E 'package-lock\.json$'` against the real repository.

## Confirmed failures (before this phase's fixes)

- `experiment-api`'s real test suite was unreachable (shadowed by a stub) — confirmed.
- The behavioral test suite's plain-`node` invocation fails before ever reaching `cpu-reference` — confirmed, and would still fail differently (missing `dist/`) even if the first failure were papered over — confirmed via isolated test.
- `ci.yml`/`ci-cd.yml` provided no typecheck coverage — confirmed by reading.
- `deploy.yml` deploys without any post-build validation of the artifact — confirmed by reading.

## Confirmed passes

- All edited/added JSON files parse correctly (validated with `node`'s `JSON.parse` after every edit).
- All edited/added YAML workflow files parse correctly and retain every step from their predecessors (validated with `python3` + `PyYAML`, comparing step lists before/after).
- The `webgpu-core`/`webgpu-mfm` smoke tests were confirmed, by reading their bodies, to not require an actual GPU device — they only check that a placeholder function returns the right type and that a class is defined. This means the existing `|| echo 'WebGPU tests skipped (no GPU support)'` CI fallback is very likely describing the wrong root cause (the real risk is the same compiled-artifact-path fragility as item 2, not an actual GPU requirement) — though this too is not empirically confirmed end-to-end.

## Environment limitations (hard blocks, not choices)

- No network access from this sandbox (registry requests return `403 host_not_allowed`).
- `pnpm` is not installed and cannot be installed without network access.
- Consequently: no real `pnpm install`, `typecheck`, `lint`, `test`, `build`, `cmake`/`ctest`, or `pytest` run was possible. Every fix below is implemented on the strength of static reasoning plus the specific isolated `node`-only reproductions described above, not a full pipeline run.

## Files changed

| File | Reason |
| --- | --- |
| `src/experiment-api/package.json` | Removed the duplicate stub `"test"` key that silently shadowed the real `"vitest run"` (confirmed bug, item 3). Added `"typecheck": "tsc --noEmit"`. |
| `src/behavioral-tests/package.json` | Changed `"test"` to `"vitest run"` (was `node ../../tests/behavioral/run-tests.js`); added `@cepc/shared-config` and `@cepc/cpu-reference` as explicit `workspace:*` dependencies, since the package didn't declare them despite now needing them resolved. |
| `tests/behavioral/behavioral.test.ts` | Fixed `loadJson` to resolve paths via `import.meta.url`/`dirname` instead of a path relative to `process.cwd()` (which is not reliably the repo root when pnpm invokes a filtered package script). |
| `src/webgpu-core/tests/webgpu-core.test.ts` | Changed the import from the compiled `../src/buffers.js` to the `.ts` source, for the same reason as the behavioral-test fix. |
| `src/webgpu-mfm/tests/webgpu-mfm.test.ts` | Same fix as above, for `MfmWebGPUStepper`. |
| `src/shared-config/package.json`, `src/cpu-reference/package.json`, `src/webgpu-core/package.json`, `src/webgpu-mfm/package.json`, `src/react-ui/package.json` | Added `"typecheck": "tsc --noEmit"` (item 4). |
| `package.json` (root) | Added a `"typecheck"` fan-out script (`pnpm --filter './src/*' --if-present typecheck`). |
| `.github/workflows/ci.yml` | Replaced with a single workflow consolidating the old `ci.yml` + `ci-cd.yml` (strict superset of both — every prior step retained) plus a new `Typecheck` step (item 5). |
| `.github/workflows/ci-cd.yml` | Deleted — superseded by the consolidated `ci.yml`. |
| `.github/workflows/deploy.yml` | Added a `Typecheck` step before build; switched `pnpm install` to `pnpm install --frozen-lockfile` for reproducibility, matching the consolidated CI. |

## Files added

| File | Purpose |
| --- | --- |
| `docs/phases/13-phase13-audit.md` | The audit, saved as requested. |
| `docs/phases/13-phase13-audit-verification.md` | This report. |
| `src/behavioral-tests/vitest.config.ts` | Points `vitest run` (invoked from `src/behavioral-tests/`) at the real test file, which lives at the repo-root `tests/behavioral/` rather than inside this package. |

## Validation performed

- Every edited or newly created JSON file: parsed with `node -e "JSON.parse(...)"` immediately after editing. All passed.
- Every edited YAML workflow: parsed with Python's `yaml.safe_load`, and its step list printed and manually diffed against the original file(s) to confirm no step was silently dropped. All passed.
- The three specific bug hypotheses (duplicate JSON key; behavioral-test `dist/` dependency; `moduleResolution: Bundler` incompatibility with plain-Node execution) were each independently reproduced with a minimal, isolated command before being treated as confirmed, rather than assumed from reading alone.
- No dependency-requiring command was executed (see Environment limitations). The fixes are reasoned from how the *existing, already-working* parts of this codebase resolve the same imports (i.e., matching the pattern used by the real app and by `behavioral.test.ts`), not invented from scratch.

## Remaining risks

- The new `typecheck` step may fail on first real CI run, surfacing type errors nothing has ever gated before — expected, and the correct outcome for Phase 13 to produce (an honest baseline, not necessarily a green one). Note that `@ts-nocheck`'d files (several in `webgpu-core`) will trivially "pass" typecheck without being genuinely checked; that gap is unchanged by this phase.
- The behavioral/webgpu-core/webgpu-mfm test-import fixes are reasoned, not executed end-to-end with vitest.
- The `new Worker(new URL('@worker', import.meta.url))` pattern is an open, unresolved risk (see item 6) and was deliberately left unchanged in this phase.
- Whether the consolidated `ci.yml` passes as a whole, and whether the C++ (`cmake`/`ctest`) and Python (`pytest`) steps pass, were not independently investigated in this phase and remain unverified.
- The lockfile tracked/untracked conclusion (item 7) is inferred from `.gitignore` content, not confirmed against actual git history.
- None of this constitutes a "reproducible baseline" yet in the sense Phase 13 is meant to establish — it constitutes a set of specific, evidenced fixes plus a precise map of what still needs a real install-capable environment to confirm. That confirmation is the immediate next step, before Phase 14.
