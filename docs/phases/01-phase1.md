# Phase 1: Shared Scientific Model Schema

## Objective

Encode the Minimal Formal Model v3 (MFM v3) types without implementing dynamics yet. This phase establishes a single source of truth for the model’s schema, ensuring that all later implementations (CPU reference, C++ oracle, WebGPU, etc.) share an identical, validated representation of the model’s parameters, state, and configuration.

## Goals

- Define canonical TypeScript interfaces/classes for all MFM v3 data structures.
- Ensure every MFM v3 parameter has exactly one canonical representation (no duplication or drift).
- Embed versioning, validation, and invariant checks directly into the schema.
- Provide typed configuration loading from JSON/YAML experiment manifests.
- Guarantee that no deprecated MFM v2 rules remain in the schema.
- Make the schema usable by both TypeScript and (via code generation or manual binding) C++ and Python contexts.

## Detailed Tasks

### 1. Create a Shared‑Config Package

- Create a new package under `src/shared-config/`.
- Initialize `package.json` (name: `@cepc/shared-config`, private: true) with `typescript` and `@types/node` as devDependencies.
- Add an `index.ts` that exports all public schema entities.
- Set up `tsconfig.json` (extends root) with `declaration: true`, `outDir: ./dist`, `rootDir: ./src`.

### 2. Define Core Data Structures

Implement the following MFM v3‑specific types (based on the Minimal Formal Model v3 specification and Technical Framework v4):

- **Genome** – immutable lifetime characteristics inherited at birth.
   Fields (per MFM v3): `H_max`, `theta_q`, `A`, `K`, `R_c`, `m`, `gamma`, `R_s`, `omega_R`, `omega_A`, `omega_v`.
   Add validation: ranges, positivity constraints, and any inter‑field dependencies noted in the docs.
   Include a `version` field (semver) for schema evolution tracking.
   Provide methods: `clone()`, `mutate(rng: Random)`, `crossover(other: Genome, rng: Random): Genome`.

- **ParticleState** – dynamic state of a single particle.
   Fields: `position` (2D vector), `velocity` (2D vector), `health` (real), `charge` (integer ≥0), `senderSet` (set of ParticleID from previous step), `prevSenderSet` (set from two steps ago?), `age` (optional diagnostic, but note: must not become part of MFM unless promoted).
   Note: The MFM v3 deliberately excludes age as part of the model; we may keep it as an optional field marked `@ts-ignore` or exclude it entirely. For phase 1 we will **exclude** age to keep the schema pure.
   Include methods: `reset()`, `isValid(): boolean` (check invariants like health bounds, charge limits).

- **PopulationState** – container for all active particles.
   Fields: `particles: Map<ParticleID, ParticleState>`, `genomes: Map<ParticleID, Genome>` (or separate arrays for performance later).
   Include methods: `addParticle(id, genome, state)`, `removeParticle(id)`, `getParticle(id)`, `forEachParticle(fn)`.
   Provide validation that each particle’s genome exists in the genome map.

- **MFMConfig** – immutable global configuration for a simulation run.
   Fields: domain size `(Lx, Ly)`, maximum particles `Nmax`, timestep `dt`, random seed, boundary conditions (periodic), etc. (Refer to Technical Framework v4 and Minimal Formal Model v3 for exact list.)
   Add validation: positive timestep, domain > 0, Nmax > 0.
   Include a `version` field and a method `validate()`.

- **ExperimentConfig** – configuration for a specific experiment (Stage IV manifest).
   Fields: input signal definition (time series or function), output readout mapping, error measure, duration, checkpoint interval, etc.
   Validate that required fields are present and types are correct.

- **SimulationSnapshot** – immutable record of the simulation at a given timestep (useful for checkpointing and replay).
   Fields: `timestep: number`, `genomes: Map<ParticleID, Genome>` (or serialized), `particleStates: Map<ParticleID, ParticleState>`, `globalMetrics?: { error: number, ... }`.
   Provide serialization/deserialization methods (to/from plain objects) for storage and transmission.

- **ExperimentManifest** – top‑level description of a Stage IV experiment (as referenced in the docs).
   Fields: `experimentId`, `description`, `mfmConfig: MFMConfig`, `experimentConfig: ExperimentConfig`, `inputSignal: { ... }`, `outputReadout: { ... }`, `duration: number`, `checkpointInterval: number`, `metricsToCollect: string[]`, etc.
   Include validation that references the correct MFM v3 version and that all sub‑configs are valid.

### 3. Add Versioning and Validation

- Every schema class/interface includes a `readonly version: string` (e.g., `"3.0.0"` for MFM v3).
- Implement static `validate(obj: any): boolean` or `assertValid(obj: void)` methods that throw descriptive errors on violation.
- Use a validation library (e.g., `zod`, `superstruct`, or custom) or write simple assertion functions.
- Ensure validation runs automatically in constructors or factory functions.
- Write unit tests for each validation case (valid and invalid inputs).

### 4. Typed Configuration Loading

- Create a utility function `loadExperimentManifest(path: string): ExperimentManifest` that reads a JSON (or YAML) file, parses it, and returns a validated instance.
- For JSON, use built‑in `JSON.parse` plus validation; for YAML, optionally add `js-yaml` as a dependency.
- Ensure the function throws if the file does not conform to the schema.
- Provide a complementary `saveExperimentManifest(manifest: ExperimentManifest, path: string)` for writing.

### 5. Invariant Checks (Optional Runtime)

- While the goal of phase 1 is to define the schema without dynamics, we can embed lightweight invariant checks that will be useful in later phases (e.g., in the CPU reference).
- Example: `ParticleState.isValid()` checks that `0 ≤ charge ≤ Qmax`, `health` within `[0, H_max]`, etc.
- These methods will be called by the simulation kernels in Phase 2 and later to catch model drift early.

### 6. Testing the Schema

- Write a comprehensive test suite using Vitest.
  - Test that each class can be instantiated with valid data.
  - Test that invalid inputs throw expected errors.
  - Test serialization/deserialization round‑trip yields identical objects.
  - Test that version fields are correctly set.
  - Test that cloning and crossover produce valid genomes.
- Aim for >90% coverage on the shared‑config package.

### 7. Linting and Formatting

- Ensure the shared‑config package adheres to the root ESLint and Prettier configurations (already set up in Phase 0).
- Add a script `"lint:shared-config": "eslint \"src/shared-config/**/*.{ts,tsx}\""` to the root `package.json` if desired.

### 8. Documentation

- Add a README.md inside `src/shared-config/` explaining the purpose of the package and how to use it.
- Keep the schema definition close to the source: consider generating a markdown diagram of the types (optional) for reference.
- Update the top‑level `AGENTS.md` if needed (already done in Phase 0).

## Deliverables

- A fully typed, versioned, and validated MFM v3 schema in `src/shared-config/`.
- Source files for each of the six core data structures (Genome.ts, ParticleState.ts, PopulationState.ts, MFMConfig.ts, ExperimentConfig.ts, SimulationSnapshot.ts, ExperimentManifest.ts) or an equivalent aggregated export.
- A `package.json` for the shared‑config package.
- Build outputs (`dist/` with `.d.ts` and `.js` files) after running `pnpm run build` (if a build step is defined).
- A passing Vitest test suite for the package.
- Updated lint configuration (if any) that passes without errors.

## Acceptance Criteria (Exit Conditions for Phase 1)

The following must succeed in a fresh checkout after Phase 0 is complete:

```bash
# From repository root
pnpm install   # (if not already done)

# Lint the shared‑config package
pnpm run lint -- --filter @cepc/shared-config

# Run tests for shared‑config
pnm test -- --filter @cepc/shared-config

# Build the package (if a build script exists)
pnpm run build -- --filter @cepc/shared-config

# Spot‑check: manually instantiate each class with valid data and assert no errors.
# Spot‑check: attempt to instantiate with invalid data and verify appropriate errors are thrown.
```

Specifically:

- Every MFM v3 parameter appearing in the Minimal Formal Model v3 document has exactly one corresponding field in the schema.
- No fields from deprecated MFM v2 (if any) are present.
- Version fields are present and correctly set.
- Validation functions reject invalid inputs (e.g., negative timestep, charge out of bounds, missing required fields).
- Serialization/deserialization is lossless for valid objects.
- The schema can be imported and used by a dummy TypeScript file without compile errors.

## Dependencies and Tool Versions (inherited from Phase 0)

- Node.js: >=18.x (LTS)
- pnpm: >=8.x
- TypeScript: >=5.0
- Vitest: >=1.0 (already installed as devDependency in the workspace)
- (Optional) js-yaml: >=1.0 if YAML support is added.

## Notes for Future Phases

- Phase 2 (CPU Reference) will import these types directly to implement the dynamics.
- Phase 3 (C++ Oracle) may either duplicate the schema manually in C++ or use a code‑generation step (e.g., `tsc --emitDeclarationOnly` plus a custom transformer) to keep the two implementations in lockstep. For simplicity in early phases, manual duplication is acceptable, but a plan to automate synchronization should be considered.
- The schema is intentionally implementation‑agnostic; avoid tying it to any specific runtime (e.g., no DOM references, no Node.js‑only APIs) so it can be used in browsers, Node.js, and C++ (via manual binding) contexts.
- Keep the schema free of simulation logic; it should only describe data, not behavior.
- If the MFM v3 spec evolves, increment the version field and add migration utilities.

## Checklist

- [ ] src/shared-config/ package folder created
- [ ] package.json (name: @cepc/shared-config) present
- [ ] tsconfig.json (extends root) present
- [ ] Genome.ts, ParticleState.ts, PopulationState.ts, MFMConfig.ts, ExperimentConfig.ts, SimulationSnapshot.ts, ExperimentManifest.ts created
- [ ] Each file exports a class/interface with appropriate fields and methods
- [ ] Version field (string) present in each major type
- [ ] Validation methods (static or instance) present and called in constructors/factories
- [ ] Serialization/deserialization methods (to/from plain object) present
- [ ] Vitest test file (e.g., shared-config.test.ts) with tests for validation, serialization, cloning, etc.
- [ ] Lint passes (`pnpm run lint -- --filter @cepc/shared-config`)
- [ ] Build step (if defined) produces `.d.ts` files without errors
- [ ] Acceptance criteria checks pass (manual or automated)

---

*This plan is derived from the Implementation Phases section (32) of the Reference Implementation and the broader documentation in `/docs/` (especially Minimal Formal Model v3.md and Technical Framework v4.md). It is intended to be executed after Phase 0 is complete and before any dynamical implementation begins.*
