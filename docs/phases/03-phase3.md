# Phase 3: C++ Independent Oracle

## Objective

Implement an independent C++20 oracle of the Minimal Formal Model v3 (MFM v3) that replicates the exact behavior of the TypeScript CPU reference (Phase 2) without sharing code. This oracle serves as a cross‑validation backend to ensure that the scientific model is correctly captured and that no implementation‑specific drift has been introduced.

## Goals

- Translate the MFM v3 mathematical specification into idiomatic, type‑safe, modern C++20.
- Preserve the exact order of operations defined in the model to guarantee step‑by‑step traceability.
- Ensure the oracle is fully deterministic given a seeded PRNG and identical inputs.
- Provide checkpointing and golden‑trajectory export capabilities for validation.
- Achieve high test coverage: unit tests for each sub‑step, property tests for invariants, and golden‑run tests that compare against the TypeScript reference.
- Keep the implementation free of framework‑specific details (no GUI, no WebGPU) so it can be compiled and run on any standard C++20 toolchain.

## Detailed Tasks

### 1. Create the C++‑Oracle Package

- Create a new package under `src/cpp-oracle/`.
- Add a `CMakeLists.txt` that sets the C++ standard to 20, enables warnings (`-Wall -Wextra -Wpedantic` or MSVC equivalents), and defines an executable or library target.
- Organize source files under `src/` and headers under `include/` (or a flat layout if preferred).
- Add a simple `main.cpp` that runs a simulation and prints the trajectory (or a test harness).
- Configure GoogleTest as a testing framework (either via `FetchContent` or assume it is available via the system package manager).
- Enable testing with `enable_testing()` and add the test executable.

### 2. Define Core Data Structures (Mirroring the Shared Schema)

- Because the goal is an independent implementation, we will **not** reuse the TypeScript schema directly. Instead, we will define equivalent C++ structs/classes that mirror the MFM v3 data structures defined in Phase 1.
- These structures should live in a header‑only or library component (e.g., `cepc/model.hpp`).
- Required structures (matching the fields from the Minimal Formal Model v3 and Technical Framework v4):
  - `Genome`: fields `H_max`, `theta_q`, `A`, `K`, `R_c`, `m`, `gamma`, `R_s`, `omega_R`, `omega_A`, `omega_v` (all `double` except where noted; `K` is `int`, `m` maybe `double`).
  - `ParticleState`: `position` (2D vector), `velocity` (2D vector), `health` (`double`), `charge` (`int` or `unsigned int`), `senderSet` (e.g., `std::unordered_set<ParticleID>`), `prevSenderSet` (same).
  - `PopulationState`: container for all active particles (e.g., `std::unordered_map<ParticleID, ParticleState>` and `std::unordered_map<ParticleID, Genome>`).
  - `MFMConfig`: domain size `(Lx, Ly)`, `Nmax`, `dt`, etc.
  - `ExperimentConfig`, `SimulationSnapshot`, `ExperimentManifest` (if needed for the oracle; the oracle may only need `MFMConfig` and initial state).
- Each struct should have:
  - A constructor that validates invariants (e.g., charge ≥ 0, health in `[0, H_max]`, etc.) and throws an exception or asserts on violation.
  - A `bool isValid() const` method.
  - Serialization/deserialization methods (to/from JSON or a binary format) for checkpointing.
  - A `version` field (string) to match the MFM v3 version.
- Use `std::array<double, 2>` or a small `struct Vec2 { double x, y; }` for 2‑D vectors.
- For sets of neighbor IDs, consider using `std::vector<ParticleID>` for performance (small sizes) or `unordered_set`.

### 3. Implement the MFM v3 Steps in Scientific Order

Follow the exact same order as in the TypeScript CPU reference (Phase 2). Each sub‑step should be a free function or a method of a `MfmCppOracle` class that takes the current state and returns the next state.

#### 3.1 Domain and Periodic Distance

- Implement a helper for the 2‑D torus domain `[0, L_x) × [0, L_y)`.
- Function `double periodicDistance(const Vec2& a, const Vec2& b, double Lx, double Ly)` returning the minimum‑image Euclidean distance.
- Validate against the specification: periodicity in both axes.

#### 3.2 Input Quantization

- Given an external input signal `u_n ∈ [0,1]` and a maximum charge `Q_in_max`, compute the integer charge injection:
   `Q_n^{in} = std::lround(Q_in_max * u_n)`.
- Distribute this charge to the input‑protected particles (see Fixed I/O later) or to all particles according to the experiment manifest; for now assume a uniform distribution to a designated input particle set.

#### 3.3 Charge Reception

- For each particle, add incoming charge from communication (to be computed later) and any external input to its internal charge accumulator `q_i^{pre}`.
- Ensure charge is kept as an integer (use `int` or `unsigned int`; check that it does not overflow; given expected bounds, 32‑bit is plenty).

#### 3.4 Thresholding

- Determine if a particle activates: `bool act = (q_i^{pre} >= theta_{q,i})`.
- At most one activation packet is processed per particle per timestep (as per MFM v3).

#### 3.5 Processing

- If activated, compute processed output charge: `q_i^{out} = A_i * theta_{q,i}`.
- Otherwise, `q_i^{out} = 0`.
- Note: `A_i` is the genetic multiplicative charge transformation factor (genome field).

#### 3.6 Decay/Cap

- Compute residual charge after activation: `q_i^{res} = q_i^{pre} - theta_{q,i} * act`.
- Apply decay: `q_i^{post} = std::max(0, q_i^{res} - delta_{q,i})`, where `delta_{q,i}` is the decay rate (could be derived from genome or a constant; refer to MFM v3 spec; if not explicit, treat as zero for v3).
- Apply the hard invariant `0 ≤ q_i ≤ Q_{max}` (where `Q_{max}` is a global bound defined in MFMConfig). Clamp if necessary.

#### 3.7 Communication Neighborhood

- For each particle, find all neighbors within communication radius `R_{c,i}` (genome field) using the periodic distance.
- Exclude the particle itself (`j ≠ i`).
- Return the list of neighbor IDs.
- Because this is an O(N²) brute‑force search (acceptable for small validation runs), we will implement a simple double loop. Later phases may optimize with spatial hashing or grids, but the oracle must remain correct.

#### 3.8 Probabilistic Target Selection

- For each particle, compute communication scores to each neighbor:
   `S_{ij} = omega_{R,i} * phi_R(g_j) + omega_{A,i} * phi_A(g_j) + omega_{v,i} * phi_v(g_j)`.
   The phi functions are simple lookup tables mapping genetic traits to scalar values (e.g., `phi_R(g) = g.R_c`, etc.; refer to the spec for exact definitions). For phase 3 we can implement the simplest mapping: each omega multiplies the corresponding genome field (as suggested in the Technical Framework).
- Convert scores to probabilities via softmax: `p_{ij} = exp(S_{ij}) / sum_k exp(S_{ik})`.
- Sample one target per particle according to these probabilities (using the PRNG). If a particle has zero neighbors, it retains no outgoing communication (or self‑communication if allowed; MFM v3 likely expects no self‑communication).
- Ensure sampling is deterministic given the PRNG state.

#### 3.9 History Buffers

- Each particle maintains a `senderSet` (the set of IDs that sent it a packet in the current step) and a `prevSenderSet` (the set from the previous step). After determining all outgoing communications, update:
   `prevSenderSet ← senderSet`
   `senderSet ← { IDs of particles that selected this particle as target }`.
- These buffers are used for computing the local reward (successful‑cycle detection) and for interaction‑history dependent mechanisms (though MFM v3 does not use interaction history directly; it is reserved for future extensions).

#### 3.10 Successful‑Cycle Detection

- A particle successfully completes a cycle if it activated (`act_i = 1`) **and** at least one neighbor selected it as a target (i.e., its `senderSet` is non‑empty after the communication step).
- This detection is used to award the local cycle reward (see later).

#### 3.11 Health and Error Pressure

- Health update consists of three parts:
   a. **Local reward**: if successful cycle, add `+1` to health (or a constant reward defined in MFMConfig).
   b. **Health loss from global error**: subtract `error * healthLossFactor`, where `error` is the difference between the current output and the target (provided by the experiment manifest) and `healthLossFactor` is a configurable parameter.
   c. **Baseline decay**: optionally subtract a small constant to represent metabolic cost (if specified).
- Ensure health stays within `[0, H_{max}]` (clamp if needed).

#### 3.12 Charge‑Dependent Spatial Range

- The effective spatial interaction radius for mechanical forces is `R_{eff,i} = R_s + alpha * (q_i / Q_{max})`, where `R_s` is the baseline spatial‑interaction range (genome) and `alpha` is a coupling factor (maybe 1.0 for v3; refer to spec). For simplicity, we can implement linear interpolation between a minimum and maximum range as described in the Reference Implementation.
- Validate that `R_{eff,i}` stays within `[R_{min}, R_{max}]`.

#### 3.13 Spatial Force (Asymmetric Mechanical Interactions)

- For each pair of particles within `R_{eff,i}` (using periodic distance), compute a force vector on particle i due to j.
- The force is asymmetric: `F_{ij} = f(d_{ij}) * direction_{ji}` where `f` is a function that may depend on the genotypes of i and j (e.g., via inherited coefficients `omega_R`, `omega_A`, `omega_v` or dedicated mechanical genes). Since MFM v3 does not specify detailed force law, we implement a placeholder: a simple spring‑dampening force with coefficients derived from the genome (to be refined in later phases if needed). The important part is to compute forces for each neighbor and accumulate the net force on each particle.
- Ensure force obeys Newton’s third law? The spec says asymmetric interactions, so we do **not** enforce action‑reaction equality; we compute `F_{ij}` and `F_{ji}` independently based on each particle’s perspective.

#### 3.14 Mechanics (Semi‑Implicit Integration)

- Update velocity: `v_i ← v_i + (F_{ij} / m_i) * dt`, where `m_i` is the genome field mass.
- Update position: `x_i ← x_i + v_i * dt`.
- Apply periodic wrapping to keep positions within the torus.
- This is a semi‑implicit (symplectic Euler) integrator; note that the spec mentions second‑order mechanical dynamics; we can use velocity‑Verlet if higher accuracy is needed, but for phase 3 we keep it simple and note that the integration scheme should be validated against the TypeScript reference.

#### 3.15 Death

- A particle dies if its health drops below zero (or a death threshold). Remove it from the population, freeing its slot for reuse.
- Record the death event (optional) for later analysis.

#### 3.16 Reproduction

- When a death occurs, a birth slot opens. Select two parent particles proportionally to their health (or another fitness measure; MFM v3 specifies local two‑parent reproduction with capacity‑limited recombination). For simplicity, we can select parents with probability proportional to `health` (or `health + epsilon`) among the living population.
- If the population is at capacity, no births occur until a death frees a slot.

#### 3.17 Mutation

- For each offspring genome, apply point mutations to each genetic field with a small probability (mutations rate per locus). Mutations are bounded perturbations (e.g., add or subtract a small integer or float within genetically defined bounds). Refer to the Technical Framework v4 for mutation domain.
- Ensure mutations keep values within valid ranges (clamp or reflect).

#### 3.18 Offspring Initialization

- Create a new ParticleState for the offspring:
  - Position: sample uniformly within the domain (or near parents; spec says local reproduction; we can place offspring at the midpoint of parents’ positions plus small jitter).
  - Velocity: zero or inherit average of parents’ velocities.
  - Health: start at `H_{max}` (or a fraction).
  - Charge: zero.
  - senderSet and prevSenderSet: empty sets.
- Assign the newly generated genome.

#### 3.19 Output Readout

- The linear readout is a weighted sum of particle charges (or other dynamic state) at fixed output particle positions (protected I/O particles). For MFM v3, the readout is:
   `output = sum_{i in output particles} w_i * q_i`, where `w_i` are readout weights (could be 1.0 for simplicity; refer to spec for exact definition).
- Protect I/O particles: they are not subject to death, birth, or mutation; their genome is fixed and they do not reproduce. Their charge dynamics still follow the same rules (they can fire and communicate) but their slot is protected.
- Implement a list of output particle IDs defined in the ExperimentConfig or MFMConfig.
- Compute the readout each step and store it for error calculation.

### 4. Deterministic RNG Interface

- Define a simple PRNG interface (e.g., a struct with a `uint32_t next()` method).
- Implement a specific algorithm that is easy to replicate exactly in TypeScript (e.g., Xorshift32, PCG32, or a linear congruential generator with known parameters).
- The PRNG must be seeded with a 32‑bit unsigned integer and produce the same sequence given the same seed.
- Pass the PRNG by reference to any function that needs randomness (target selection, mutation, etc.).
- Ensure that the oracle’s PRNG produces the same sequence as the TypeScript reference’s PRNG when seeded identically (this will be validated in the acceptance criteria).

### 5. Checkpoint Support

- Implement methods to serialize the entire simulation state (population, genomes, PRNG state, current timestep) to a byte array or a file.
- Implement corresponding deserialization to restore the state.
- Use a format that is easy to verify (e.g., JSON or a custom binary format). For simplicity, we can output a JSON text file.
- Ensure that starting from a saved state and stepping forward yields identical results to continuing from the original state.

### 6. Golden Trajectory Export

- Provide a way to run the oracle with a given input signal (experiment manifest) and record the full trajectory (e.g., the readout at each step, or the full population state at each step) to a file.
- This file will be used as a “golden” reference for comparison with the TypeScript CPU reference.
- Ensure the export is deterministic and includes enough information to validate correctness (e.g., step‑by‑step readout, health, charge, etc.).

### 7. Unit Testing and Property Testing

- Write unit tests for each sub‑step (domain distance, input quantization, thresholding, etc.) using GoogleTest.
- Use property‑based testing (if desired) to verify invariants hold across random inputs (within bounds). If property‑based testing is not set up, we can rely on extensive unit tests with randomized seeds.
- Golden‑run tests: compare the output of a known seeded scenario (including a predefined input signal) against a pre‑computed reference trace generated by the TypeScript CPU reference (exported during Phase 2 validation).
- Deterministic replay test: serialize state after N steps, deserialize, and ensure the next M steps match.
- Aim for >90% line coverage on the cpp‑oracle package.

### 8. Linting and Formatting

- Run `clang-format` on all source files to enforce a consistent style (we will use the Google C++ Style Guide as configured in Phase 0).
- Add a lint script in the root `package.json` (or a separate script) that runs `clang-format --dry-run --Werror src/cpp-oracle/**/*.{cpp,hpp}`.
- Optionally run `cppcheck` or `clang-tidy` for additional static analysis.

## Deliverables

- A fully functional C++20 oracle in `src/cpp-oracle/`.
- Core data structures mirroring the MFM v3 schema (Genome, ParticleState, PopulationState, MFMConfig, etc.) with validation and serialization.
- A main simulation class (`MfmCppOracle`) that steps through one MFM v3 timestep.
- A deterministic PRNG implementation (e.g., Xorshift32) that can be seeded.
- Checkpointing and golden‑trajectory export functionality.
- A `CMakeLists.txt` that builds an executable and/or library and enables GoogleTest.
- A comprehensive GoogleTest test suite covering unit, property, golden, and replay tests.
- Updated lint configuration (if any) that passes without errors.

## Acceptance Criteria (Exit Conditions for Phase 3)

The following must succeed in a fresh checkout after Phase 2 is complete:

```bash
# From repository root
pnpm install   # (if not already done, to ensure TypeScript reference is built)

# Build the C++ oracle
cmake -S src/cpp-oracle -B build
cmake --build build

# Lint the cpp‑oracle package
./node_modules/.bin/clang-format --dry-run --Werror src/cpp-oracle/**/*.{cpp,hpp}
# (or use a npm script: npm run lint:cpp)

# Run tests for cpp‑oracle
ctest --test-dir build --output-on-failure

# Deterministic sanity check: run a short simulation with a fixed seed in both the TypeScript reference and the C++ oracle, capture the output readout sequence, and compare them within a small tolerance (e.g., 1e‑9).
# Checkpoint/replay test: serialize state after N steps in each implementation, deserialize, and verify the next M steps match.
# Golden‑run test: compare the oracle’s golden trajectory (exported) against the TypeScript reference’s golden trajectory (generated in Phase 2) and ensure they agree within numerical tolerance.
```

Specifically:

- The C++ oracle passes all unit tests (no failures).
- Property tests confirm that invariants (health bounds, charge limits, etc.) hold for random seeded runs.
- Golden‑run test matches the TypeScript reference’s trace (the reference trace can be generated by running the TypeScript implementation with a fixed seed and saving the output; once approved, it is committed).
- Deterministic replay test passes: state serialization/deserialization yields identical continuation.
- The PRNG sequences match between the two implementations when seeded identically.
- The implementation follows the exact order of operations as listed in the specification; any deviation must be justified and approved.
- The code is lint‑clean (clang-format Google style) and builds without errors.

## Dependencies and Tool Versions (inherited from Phase 0/1/2)

- Node.js: >=18.x (LTS) (for the TypeScript reference; not strictly needed for the C++ oracle alone but required for cross‑validation).
- pnpm: >=8.x
- TypeScript: >=5.0 (for the reference)
- Vitest: >=1.0 (for the reference)
- GoogleTest: any version compatible with C++20 (provided via `FetchContent` or system package manager).
- CMake: >=3.20
- C++ compiler: supports C++20 (gcc>=11, clang>=12, MSVC>=19.30)

## Notes for Future Phases

- Phase 4 (Behavioral Test Suite) will use both the TypeScript reference and the C++ oracle to run the comprehensive test families (one‑step exact cases, multi‑step causal cases, etc.) before any GPU optimization.
- Phase 5 (WebGPU Foundations) will later parallelize the compute kernels while preserving the same logical order; the CPU reference and C++ oracle remain the validation targets.
- Keep the simulation logic free of any rendering or UI concerns; it should be a pure function of state → state.
- If performance becomes a concern in later phases, consider hot‑paths (e.g., neighbor search) but always maintain a reference path for validation (the TypeScript reference).
- The PRNG interface should be simple enough to be duplicated exactly in TypeScript (e.g., xorshift32 or PCG32) to ensure deterministic cross‑language validation.
- Consider adding a script or CI job that automatically runs the TypeScript reference and the C++ oracle on the same input and fails if they diverge beyond tolerance.

## Checklist

- [ ] src/cpp-oracle/ package folder created
- [ ] CMakeLists.txt present with C++20 standard, warnings enabled, and GoogleTest enabled
- [ ] Core data structure headers (e.g., Genome.hpp, ParticleState.hpp, PopulationState.hpp, MFMConfig.hpp, etc.) created
- [ ] Main simulation class file (e.g., MfmCppOracle.hpp/.cpp) created
- [ ] Deterministic PRNG implementation (e.g., Xorshift32.hpp/.cpp) created
- [ ] Checkpointing and golden‑trajectory export functions present
- [ ] GoogleTest test file (e.g., cpp-oracle-test.cpp) with unit, property, golden, and replay tests
- [ ] Lint passes (`clang-format --dry-run --Werror src/cpp-oracle/**/*.{cpp,hpp}`)
- [ ] Build step produces an executable/library without errors
- [ ] Acceptance criteria checks pass (manual or automated)

---

*This plan is derived from the Implementation Phases section (32) of the Reference Implementation and the broader documentation in `/docs/` (especially Minimal Formal Model v3.md, Technical Framework v4.md, and Reference Implementation itself). It is intended to be executed after Phase 2 is complete and before the behavioral test suite (Phase 4) begins.*
