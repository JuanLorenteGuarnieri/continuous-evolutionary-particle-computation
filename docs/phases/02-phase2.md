# Phase 2: TypeScript CPU Reference Backend

## Objective

Implement the entire Minimal Formal Model v3 (MFM v3) as a transparent, browser‑compatible CPU reference backend in TypeScript. This phase turns the validated schema from Phase 1 into a working deterministic simulation that can be used for unit‑testing, property‑testing, golden‑run validation, and deterministic replay. The CPU reference serves as the authoritative implementation against which the C++ oracle (Phase 3) and WebGPU backend (Phase 5) are validated.

## Goals

- Translate the MFM v3 mathematical specification into idiomatic, type‑safe TypeScript code.
- Preserve the exact order of operations defined in the model to guarantee step‑by‑step traceability.
- Ensure the backend is fully deterministic given a seeded PRNG and identical inputs.
- Make the simulation easy to inspect and debug (e.g., expose intermediate states, loggable events).
- Keep the implementation free of framework‑specific details (no React, no WebGPU) so it can run in Node.js and in the browser (via a WebWorker later).
- Achieve high test coverage: unit tests for each sub‑step, property tests for invariants, golden‑run tests for known trajectories, and deterministic replay tests.

## Detailed Tasks

### 1. Create the CPU‑Reference Package

 - Create a new package under `src/cpu-reference/`.
 - Initialize `package.json` (name: `@cepc/cpu-reference`, private: true) with dependencies on `@cepc/shared-config` and devDependencies: `typescript`, `@types/node`, `vitest`.
 - Add an `index.ts` that exports the main simulation class or function.
 - Set up a `tsconfig.json` (extends root) with `declaration: true`, `outDir: ./dist`, `rootDir: ./src`, `sourceMap: true`.

### 2. Define the Core Simulation Loop

 - Create a class `MfmCpuReference` that takes an `MFMConfig`, an initial `PopulationState`, and a pseudo‑random number generator (PRNG) implementing a simple interface (e.g., `nextUInt32(): number`).
 - The class exposes a method `step(): PopulationState` that advances the simulation by one discrete timestep, returning the new population state.
 - Additionally, provide a method `run(steps: number): PopulationState[]` that returns the trajectory (or optionally a generator) for checkpointing and replay.
 - Ensure the PRNG is immutable and passed down to sub‑components that need randomness (e.g., target selection, mutation).

### 3. Implement the MFM v3 Steps in Scientific Order

Follow the order listed in the Reference Implementation (Phase 2 tasks). Each sub‑step should be a private method of the class, clearly named and unit‑testable in isolation.

#### 3.1 Domain and Periodic Distance
 - Implement a helper for the 2‑D torus domain \([0, L_x) \times [0, L_y)\).
 - Function `periodicDistance(a: Vector2, b: Vector2): number` returning the minimum‑image Euclidean distance.
 - Validate against the specification: periodicity in both axes.

#### 3.2 Input Quantization
 - Given an external input signal \(u_n \in [0,1]\) and a maximum charge \(Q_{in}^{max}\), compute the integer charge injection:
   `Q_n^{in} = round(Q_{in}^{max} * u_n)`.
 - Distribute this charge to the input‑protected particles (see Fixed I/O later) or to all particles according to the experiment manifest; for now assume a uniform distribution to a designated input particle set.

#### 3.3 Charge Reception
 - For each particle, add incoming charge from communication (to be computed later) and any external input to its internal charge accumulator `q_i^{pre}`.
 - Ensure charge is kept as an integer (use `BigInt` or plain `number` with validation that values stay within safe integer range; given expected bounds, `number` is fine).

#### 3.4 Thresholding
 - Determine if a particle activates: `act_i = 1 if q_i^{pre} >= theta_{q,i} else 0`.
 - At most one activation packet is processed per particle per timestep (as per MFM v3).

#### 3.5 Processing
 - If activated, compute processed output charge: `q_i^{out} = A_i * theta_{q,i}`.
 - Otherwise, `q_i^{out} = 0`.
 - Note: `A_i` is the genetic multiplicative charge transformation factor (genome field).

#### 3.6 Decay/Cap
 - Compute residual charge after activation: `q_i^{res} = q_i^{pre} - theta_{q,i} * act_i`.
 - Apply decay: `q_i^{post} = max(0, q_i^{res} - delta_{q,i})`, where `delta_{q,i}` is the decay rate (could be derived from genome or a constant; refer to MFM v3 spec; if not explicit, treat as zero for v3).
 - Apply the hard invariant `0 ≤ q_i ≤ Q_{max}` (where `Q_{max}` is a global bound defined in MFMConfig). Clamp if necessary.

#### 3.7 Communication Neighborhood
 - For each particle, find all neighbors within communication radius `R_{c,i}` (genome field) using the periodic distance.
 - Exclude the particle itself (`j ≠ i`).
 - Return the list of neighbor IDs.

#### 3.8 Probabilistic Target Selection
 - For each particle, compute communication scores to each neighbor:
   `S_{ij} = omega_{R,i} * phi_R(g_j) + omega_{A,i} * phi_A(g_j) + omega_{v,i} * phi_v(g_j)`.
   The phi functions are simple lookup tables mapping genetic traits to scalar values (e.g., `phi_R(g) = g.R_c`, etc.; refer to the spec for exact definitions). For phase 2 we can implement the simplest mapping: each omega multiplies the corresponding genome field (as suggested in the Technical Framework).
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
 - This is a semi‑implicit (symplectic Euler) integrator; note that the spec mentions second‑order mechanical dynamics; we can use velocity‑Verlet if higher accuracy is needed, but for phase 2 we keep it simple and note that the integration scheme should be validated against the C++ oracle.

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

### 4. Deterministic Replay and Checkpointing

 - To enable deterministic replay, the simulation must be able to save and restore the entire state (including PRNG state). Implement methods:
   - `getState(): Uint8Array` (or JSON) that serializes the PopulationState, PRNG internal state, and current timestep.
   - `setState(state: Uint8Array): void` to restore.
 - These methods will be used in Phase 4 (behavioral test suite) and for checkpoint/restore validation.
 - Ensure that starting from a saved state and stepping forward yields identical results to continuing from the original state.

### 5. Unit Testing and Property Testing

 - Write unit tests for each sub‑step (domain distance, input quantization, thresholding, etc.) using Vitest.
 - Use property‑based testing (e.g., with `fast-check`) to verify invariants hold across random inputs (within bounds).
 - Golden‑run tests: compare the output of a known seeded scenario (including a predefined input signal) against a pre‑computed reference trace (to be generated once and committed).
 - Deterministic replay test: serialize state after N steps, deserialize, and ensure the next M steps match.
 - Aim for >90% line coverage on the cpu‑reference package.

### 6. Linting and Formatting

 - Ensure the package adheres to the root ESLint and Prettier configurations.
 - Add a lint script for the package if desired: `"lint:cpu-reference": "eslint \"src/cpu-reference/**/*.{ts,tsx}\""`.

## Deliverables

 - A fully functional TypeScript CPU reference backend in `src/cpu-reference/`.
 - Main simulation class (`MfmCpuReference`) that steps through one MFM v3 timestep.
 - Helper classes/vectors for 2‑D math, PRNG wrapper, etc.
 - A `package.json` for the package.
 - Build outputs (`.d.ts` and `.js`) if a build step is defined.
 - A comprehensive Vitest test suite covering unit, property, golden, and replay tests.
 - Updated lint configuration (if any) that passes without errors.

## Acceptance Criteria (Exit Conditions for Phase 2)

The following must succeed in a fresh checkout after Phase 1 is complete:

```bash
# From repository root
pnpm install   # (if not already done)

# Lint the cpu‑reference package
pnpm run lint -- --filter @cepc/cpu-reference

# Run tests for cpu‑reference
pnpm test -- --filter @cepc/cpu-reference

# Build the package (if a build script exists)
pnpm run build -- --filter @cepc/cpu-reference

# Deterministic sanity check: run a short simulation with a fixed seed, capture the output readout sequence, and compare against a known golden vector (to be generated during development).
# Checkpoint/replay test: serialize state after N steps, deserialize, and verify the next M steps match.
```

Specifically:
 - The CPU backend passes all unit tests (no failures).
 - Property tests confirm that invariants (health bounds, charge limits, etc.) hold for random seeded runs.
 - Golden‑run test matches a pre‑computed reference trace (the reference trace can be generated by running the implementation with a fixed seed and saving the output; once approved, it is committed).
 - Deterministic replay test passes: state serialization/deserialization yields identical continuation.
 - The implementation follows the exact order of operations as listed in the specification; any deviation must be justified and approved.
 - The code is lint‑clean (ESLint + Prettier) and builds without errors.

## Dependencies and Tool Versions (inherited from Phase 0/1)

 - Node.js: >=18.x (LTS)
 - pnpm: >=8.x
 - TypeScript: >=5.0
 - Vitest: >=1.0 (already installed as devDependency in the workspace)
 - (Optional) fast-check: >=3.0 for property‑based testing.

## Notes for Future Phases

 - Phase 3 (C++ Oracle) will implement the same algorithm in C++20; the CPU reference serves as the validation target.
 - Phase 4 (Behavioral Test Suite) will use this backend to run the comprehensive test families (one‑step exact cases, multi‑step causal cases, etc.) before any GPU optimization.
 - Phase 5 (WebGPU Foundations) will later parallelize the compute kernels while preserving the same logical order; the CPU reference remains the correctness arbiter.
 - Keep the simulation logic free of any rendering or UI concerns; it should be a pure function of state → state.
 - If performance becomes a concern in later phases, consider hot‑paths (e.g., neighbor search) but always maintain a reference path for validation.
 - The PRNG interface should be simple enough to be duplicated exactly in C++ (e.g., xorshift32 or PCG32) to ensure deterministic cross‑language validation.

## Checklist

 - [ ] src/cpu-reference/ package folder created
 - [ ] package.json (name: @cepc/cpu-reference) present
 - [ ] tsconfig.json (extends root) present
 - [ ] Main simulation class file (e.g., MfmCpuReference.ts) created
 - [ ] Helper modules (vector2d.ts, prng.ts, etc.) as needed
 - [ ] Each MFM v3 sub‑step implemented as a private method, clearly named and ordered
 - [ ] Deterministic replay serialization/deserialization methods present
 - [ ] Vitest test file (e.g., cpu-reference.test.ts) with unit, property, golden, and replay tests
 - [ ] Lint passes (`pnpm run lint -- --filter @cepc/cpu-reference`)
 - [ ] Build step (if defined) produces `.d.ts` files without errors
 - [ ] Acceptance criteria checks pass (manual or automated)

---

*This plan is derived from the Implementation Phases section (32) of the Reference Implementation and the broader documentation in `/docs/` (especially Minimal Formal Model v3.md, Technical Framework v4.md, and Reference Implementation itself). It is intended to be executed after Phase 1 is complete and before the C++ oracle implementation begins.*
