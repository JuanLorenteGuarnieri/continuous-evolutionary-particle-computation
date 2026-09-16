# Phase 4: MFM v3 Behavioral Test Suite

## Objective

Prove that the software implements the mathematical specification of the Minimal Formal Model v3 (MFM v3) before any GPU optimization. This phase creates a comprehensive behavioral test suite that validates the CPU reference (Phase 2) and the C++ oracle (Phase 3) against the frozen specification. All test families must be automated and run in CI to prevent model drift.

## Goals

- Verify that every MFM v3 mechanism is correctly implemented in both TypeScript and C++ implementations.
- Provide deterministic, reproducible test cases that capture edge cases, invariants, and causal behavior.
- Establish golden trajectories that serve as a reference for future regression testing.
- Ensure cross‑validation between the TypeScript CPU reference and the C++ oracle for all test families.
- Create a test matrix that maps each MFM v3 mechanism to a specific test family, ownership, and validation criteria.
- Automate the execution of all tests in CI (GitHub Actions) so that any deviation from the specification fails the pipeline.

## Detailed Tasks

### 1. Create a Behavioral‑Test Package

 - Create a new package under `tests/behavioral/` (or `src/tests/` if preferred) that contains test data, scripts, and test runners for both TypeScript and C++.
 - Initialize a `package.json` (for the TypeScript test runner) and a `CMakeLists.txt` (for the C++ test runner) that depend on the CPU reference and C++ oracle packages.
 - Add a `test-manifest.yaml` (or JSON) that enumerates all test families, their purpose, and their expected outcomes.
 - Ensure the test package is independent of any UI or WebGPU code; it should only depend on the model implementation.

### 2. Define Test Families (from the Reference Implementation)

The Reference Implementation (Section 32) lists the following test families. For each, define:
 - The MFM v3 mechanism(s) under test.
 - Input configuration (initial population, genome values, input signal, random seed).
 - Expected behavior (exact values, invariants, or statistical properties).
 - Tolerance (exact equality for discrete/integer logic, small epsilon for floating‑point).

Test families:

#### 4.1 One‑Step Exact Cases
 - **Mechanism:** Input quantization, charge reception, thresholding, processing, decay.
 - **Setup:** A single particle with known genome (`theta_q`, `A`, `delta_q`) and a known input signal `u_n`.
 - **Expected:** Compute the resulting charge after one timestep exactly.
 - **Validation:** Compare the resulting charge and activation flag between TypeScript and C++.

#### 4.2 Multi‑Step Causal Cases
 - **Mechanism:** Charge accumulation over multiple steps, communication delay (charge sent in step n is received in step n+1).
 - **Setup:** Two particles (input and output) with a known communication radius and target selection deterministic (e.g., only one neighbor, deterministic selection).
 - **Expected:** Verify that the charge received by the output particle appears exactly one step later, and that the chain of activation follows the specified order.
 - **Validation:** Compare step‑by‑step state (charge, activation, sender sets) between the two implementations.

#### 4.3 Zero‑Neighbor Cases
 - **Mechanism:** Communication with no neighbors.
 - **Setup:** Particle isolated (communication radius zero or no other particles within range).
 - **Expected:** No communication occurs; the particle’s health should only change due to error pressure (if any) and not due to local reward.
 - **Validation:** Verify that senderSet remains empty and no outgoing charge is generated.

#### 4.4 Saturation Cases
 - **Mechanism:** Charge cap (`Q_{max}`) and health cap (`H_{max}`).
 - **Setup:** Inject a huge input signal to force charge overflow; or give a particle a very high health reward repeatedly.
 - **Expected:** Charge is clamped at `Q_{max}`; health is clamped at `H_{max}`.
 - **Validation:** Verify that the clamp occurs exactly as specified in the schema.

#### 4.5 Asymmetric‑Force Cases
 - **Mechanism:** Asymmetric mechanical interactions.
 - **Setup:** Two particles with different genomes that define different force coefficients.
 - **Expected:** The force on particle A due to B is not equal and opposite to the force on B due to A.
 - **Validation:** Compare force vectors between implementations; ensure asymmetry is preserved.

#### 4.6 Death and Birth Cases
 - **Mechanism:** Health‑driven death, capacity‑limited reproduction.
 - **Setup:** A population with a known health distribution; force some particles to die by setting health to zero.
 - **Expected:** Dead particles are removed; if capacity allows, new offspring are created with genomes from selected parents; population size never exceeds `N_{max}`.
 - **Validation:** Verify population size, particle IDs, and that offspring genomes are valid.

#### 4.7 Capacity‑Full Cases
 - **Mechanism:** Population cap enforcement.
 - **Setup:** Fill the population to `N_{max}` and attempt to create new offspring.
 - **Expected:** No births occur until a death frees a slot.
 - **Validation:** Verify that population size remains at `N_{max}`.

#### 4.8 Mutation Boundary Cases
 - **Mechanism:** Genetic mutation with domain constraints.
 - **Setup:** Create a genome at the edge of its allowed domain (e.g., `theta_q` at minimum) and apply mutation.
 - **Expected:** Mutated values stay within the allowed domain (clamped or reflected).
 - **Validation:** Verify that all mutated genomes satisfy validation rules.

#### 4.9 Protected Input/Output Cases
 - **Mechanism:** Fixed I/O particles.
 - **Setup:** Mark specific particles as protected (e.g., input/output) in the configuration.
 - **Expected:** Protected particles are never removed, never mutated, and their genomes remain unchanged.
 - **Validation:** Verify that death/reproduction/mutation never affect protected particles.

#### 4.10 A→B→A Control Cases
 - **Mechanism:** Simple feedback loop (input → intermediate → output → back to input via error signal).
 - **Setup:** Three particles in a chain with a deterministic communication graph.
 - **Expected:** The system produces a predictable pattern of charge flow and health updates over several steps.
 - **Validation:** Compare full trajectories between implementations.

### 3. Test Data and Golden Trajectories

 - For each test family, create a JSON (or YAML) file under `tests/behavioral/data/` containing:
   - `config`: MFMConfig, initial PopulationState, genome values, input signal, random seed.
   - `expected`: The expected output (e.g., final state, readout sequence, or a series of snapshots).
 - Generate golden trajectories using the TypeScript CPU reference (or a trusted manual calculation) and commit them to the repository.
 - The C++ oracle must produce identical outputs (within tolerance) for the same input.

### 4. Test Runner Implementation

#### TypeScript Test Runner
 - Use Vitest to run the test suite.
 - For each test family, write a test file `behavioral.test.ts` that:
   - Loads the test data.
   - Instantiates the `MfmCpuReference` with the given config and seed.
   - Runs the simulation for the required number of steps.
   - Compares the resulting state/readout to the expected values.
   - Runs the same test using the C++ oracle (via a Node.js binding or a subprocess that runs the C++ executable and compares output).
 - Use snapshot testing for full state comparisons (with a deterministic ordering of particle IDs).

#### C++ Test Runner
 - Use GoogleTest to run the test suite.
 - For each test family, write a test file `behavioral_test.cpp` that:
   - Loads the test data (JSON parsing via `nlohmann/json` or similar).
   - Instantiates the `MfmCppOracle` with the given config and seed.
   - Runs the simulation and compares the output to the expected values.
   - Optionally, run a cross‑validation test that calls the TypeScript reference via a subprocess and compares the two outputs.

### 5. Invariant and Property Tests

 - Add property‑based tests (e.g., using `fast-check` in TypeScript) that verify:
   - Health remains within `[0, H_max]` for all particles at all steps.
   - Charge remains within `[0, Q_max]`.
   - Particle IDs are unique and never reused within a simulation run.
   - Sender sets only contain IDs of particles that actually sent a packet in the previous step.
   - Population size never exceeds `N_max`.
   - Deterministic replay: saving state at step N and restoring it yields identical subsequent steps.
 - The same invariants should be tested in the C++ oracle (using GoogleTest assertions or a property‑based testing library if available).

### 6. Cross‑Validation Tests

 - For each test family, run a cross‑validation test that executes both implementations with identical inputs and seeds.
 - Compare:
   - Readout values (floating‑point tolerance).
   - Particle states (charge, health, position, velocity) after each step (integer fields must match exactly; floating‑point fields within epsilon).
   - Event logs (deaths, births, mutations) must match exactly.
 - Fail the test if any difference exceeds tolerance.

### 7. CI Integration

 - Add a new GitHub Actions job `behavioral-tests` that:
   - Installs Node.js, pnpm, and C++ dependencies.
   - Runs `pnpm test` for the TypeScript behavioral tests.
   - Builds the C++ oracle and runs `ctest` for the C++ behavioral tests.
   - Optionally runs a script that performs cross‑validation between the two implementations.
 - Ensure that the test data (golden trajectories) are checked in and versioned alongside the code.
 - Add a step that generates a test report (e.g., JUnit XML) and uploads it as an artifact.

### 8. Documentation

 - Add a `README.md` in `tests/behavioral/` explaining how to add new test families, how to generate golden trajectories, and how to run the tests locally.
 - Document each test family with a short description of the mechanism under test and the expected outcome.
 - Update the top‑level `AGENTS.md` if needed to mention the behavioral test suite.

## Deliverables

 - A test package (`tests/behavioral/`) containing test data, test runners, and documentation.
 - JSON/YAML test data files for each test family, with golden trajectories committed.
 - Vitest test files for TypeScript behavioral tests.
 - GoogleTest test files for C++ behavioral tests.
 - CI job configuration for running the behavioral test suite.
 - A README explaining how to add new tests and generate golden trajectories.

## Acceptance Criteria (Exit Conditions for Phase 4)

The following must succeed in a fresh checkout after Phase 3 is complete:

```bash
# From repository root
pnpm install   # (if not already done)

# Run TypeScript behavioral tests
pnpm test -- --filter behavioral

# Build C++ oracle
cmake -S src/cpp-oracle -B build
cmake --build build

# Run C++ behavioral tests
ctest --test-dir build --output-on-failure -R Behavioral

# Run cross‑validation script (optional)
pnpm run test:cross-validate
```

Specifically:
 - All test families pass for both TypeScript and C++ implementations.
 - Cross‑validation tests show identical outputs (within tolerance) between the two implementations.
 - Golden trajectories are reproduced exactly (or within tolerance for floating‑point fields).
 - Invariant and property tests hold for random seeds and inputs.
 - Deterministic replay tests pass: saving and restoring state yields identical subsequent steps.
 - CI pipeline runs the behavioral tests automatically on every push and pull request, and fails if any test diverges.
 - The test matrix maps each MFM v3 mechanism to a test family, and all mechanisms are covered.

## Dependencies and Tool Versions (inherited from earlier phases)

 - Node.js: >=18.x (LTS)
 - pnpm: >=8.x
 - TypeScript: >=5.0
 - Vitest: >=1.0
 - GoogleTest: any version compatible with C++20
 - CMake: >=3.20
 - C++ compiler: supports C++20 (gcc>=11, clang>=12, MSVC>=19.30)
 - (Optional) fast-check: >=3.0 for property‑based testing in TypeScript.
 - (Optional) nlohmann/json: for JSON parsing in C++ tests.

## Notes for Future Phases

 - Phase 5 (WebGPU Foundations) will use the behavioral test suite as a regression test to ensure that GPU optimizations do not change the scientific behavior.
 - Phase 6 (Initial Experiments) will rely on the test suite to guarantee that the experiment manifests produce reproducible results.
 - If new mechanisms are added to MFM v3 in future versions, the test suite should be extended with new test families before the model changes are merged.
 - The test data (golden trajectories) should be versioned alongside the code; if the model changes, the golden trajectories must be regenerated and reviewed.
 - Keep test data small and focused on edge cases; avoid large random simulations that are hard to debug.

## Checklist

 - [ ] tests/behavioral/ folder created
 - [ ] test-manifest.yaml (or JSON) created listing all test families
 - [ ] Test data files for each test family created under tests/behavioral/data/
 - [ ] Golden trajectories generated using the TypeScript CPU reference and committed
 - [ ] Vitest test files for TypeScript behavioral tests created and passing
 - [ ] GoogleTest test files for C++ behavioral tests created and passing
 - [ ] Cross‑validation tests implemented and passing
 - [ ] Invariant and property tests implemented and passing
 - [ ] Deterministic replay tests implemented and passing
 - [ ] CI job for behavioral tests added and passing
 - [ ] README in tests/behavioral/ explaining how to add new tests
 - [ ] Acceptance criteria checks pass (manual or automated)

---

*This plan is derived from the Implementation Phases section (32) of the Reference Implementation and the broader documentation in `/docs/` (especially Minimal Formal Model v3.md, Technical Framework v4.md, Experimental Design.md, and Reference Implementation itself). It is intended to be executed after Phase 3 is complete and before WebGPU optimization begins.*
