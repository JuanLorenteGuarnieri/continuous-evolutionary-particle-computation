# Continuous Evolutionary Particle Computation (CEPC)

## Research Roadmap — Stages I–VII

### From conceptual foundations to empirical validation and paradigm assessment

---

## Executive status

Stage I — Conceptual Foundations: **Complete**

Stage II — Mathematical Formalization: **Complete**

Stage III — Theoretical Analysis: **Complete for the current baseline**

Stage IV — Experimental Design: **Complete for the current baseline**

Stage V — Reference Implementation: **Next**

Stage VI — Initial Experiments: **Pending**

Stage VII — Paradigm Investigation: **Pending**

The purpose of this roadmap is to prevent unverified mechanisms from silently entering the baseline model. Every stage must produce a frozen artifact before the next dependent stage is treated as authoritative.

---

# Stage I — Conceptual Foundations ✅

## Objective

Define the computational idea independently of implementation details.

## Frozen principles

- The medium is a continuously active population rather than a trained-then-frozen network.
- Particles are individually simple.
- Genotype is immutable during lifetime.
- Dynamic state changes continuously.
- Population structure can change through death, reproduction, recombination and mutation.
- Computation occurs through local interaction and collective dynamics.
- Global error modulates structural plasticity but does not directly assign individual credit.

## Deliverable

A conceptual architecture and falsifiable central hypothesis.

---

# Stage II — Mathematical Formalization ✅

## Objective

Specify an implementation-independent Minimal Formal Model.

## Core object

\[
\mathcal P_n=\{(s_i^n,g_i)\}_{i=1}^{N_n},\qquad N_n\le N_{max}.
\]

## Frozen MFM decisions

- 2D torus with periodic boundaries.
- Point particles in the baseline.
- Integer charge.
- Quantized input.
- Charge decay.
- One firing packet per timestep.
- Multiplicative charge processing.
- Probabilistic communication.
- Separate communication and spatial preferences.
- Bounded asymmetric spatial force.
- Charge-dependent spatial range.
- Binary receive→process→transmit local success.
- Fixed reward per completed cycle.
- Global error as turnover pressure.
- Local two-parent reproduction.
- Recombination and bounded mutation.
- Fixed/protected input and output particles.
- Linear readout from output-particle charges.
- Hard population cap with birth rejection at capacity.
- Synchronous buffered transmission semantics.

## Deliverable

MFM v3.

---

# Stage III — Theoretical Analysis ✅

Stage III is closed at four levels.

## III-A — Well-Posedness and Boundedness

### Main results/decisions

The model is treated as a stochastic discrete-time hybrid population process. The explicit bounded state constraints are

\[
N\le N_{max},\qquad 0\le q_i\le Q_{max},\qquad 0\le H_i\le H_{max,i},\qquad g_i\in\mathcal G,\qquad x_i\in\mathbb T^2.
\]

Mechanical stability is controlled by

\[
0<\frac{\gamma_i\Delta t}{m_i}<1
\]

for the preferred practical regime, while |1−γΔt/m|≤1 gives the weaker non-expansive bound.

The empirical charge branching indicator is

\[
R_{charge}\approx\mathbb E[K_iA_ip_{fire,i}].
\]

Charge cap, finite population, bounded force and bounded genes are explicit safeguards.

## III-B — Population and Evolutionary Dynamics

### Main results/decisions

Population classes satisfy

\[
n_g(n+1)=n_g(n)+B_g(n)-D_g(n)+M_g(n).
\]

Fitness is endogenous and context-dependent rather than externally supplied. The population is expected to operate in a turnover regime between extinction and capacity saturation.

The key scientific risk is selection misalignment: local cycle completion may not correlate with global task contribution. This is an explicit Stage IV diagnostic, not an assumption.

## III-C — Computational Dynamics

### Main results/decisions

The medium has candidate computational state in charge, motion, neighborhood structure and population organization, but the baseline output interface remains

\[
\hat y_n=W_{out}q_{out,n}+b.
\]

Classical ESP/fading-memory claims do not apply automatically to the entire adaptive system. The working hypothesis is multiscale memory:

\[
\text{fast dynamical memory}+\text{slow structural memory}.
\]

Stage IV must measure memory, separation, effective dimensionality, nonlinear capacity and output observability.

## III-D — Stability–Plasticity & Continual Adaptation

### Main results/decisions

Global error produces turnover pressure

\[
P(E)=P_{min}+(P_{max}-P_{min})E^\gamma.
\]

creating the loop

\[
E\rightarrow\text{death pressure}\rightarrow\text{turnover}\rightarrow\text{reorganization}\rightarrow\text{new computation}.
\]

The desired operating point is adaptive stability, not maximal plasticity and not a generic edge-of-chaos condition.

### Central continual-learning benchmark

\[
A\rightarrow B\rightarrow A
\]

with first-learning time, relearning time, forgetting, forward transfer, backward transfer and damage recovery.

## Stage III deliverable set

- Technical Research Framework v4
- Minimal Formal Model v3
- Mathematical Analysis of the Minimal Formal Model v3
- This Research Roadmap — Stages I–VII

---

# Stage IV — Experimental Design ✅

## Objective

Convert Stage III theory into a controlled, reproducible and falsifiable experimental programme. The experimental protocol is designed to attribute observed changes to specific mechanisms rather than to aggregate complexity.

## IV-A — Experimental philosophy

- Mechanisms are introduced incrementally through P0→P1→P2→P3→P4.
- Matched baselines preserve all non-ablated conditions.
- Independent random seeds are mandatory.
- The internal medium receives no gradients or individual global credit in the MFM.
- The primary continual-learning protocol freezes the linear readout after calibration so that internal adaptation is not confused with decoder retraining.
- Readout-refit experiments are secondary diagnostics only.

## IV-B — Exact system under test

Stage IV uses the MFM v3 as the frozen baseline:

\[
\Omega=\mathbb T^2,
\qquad
0\le N_n\le N_{max},
\qquad
0\le q_i\le Q_{max}.
\]

Charge processing is

\[
q_i^{out}=A_i\theta_{q,i}
\]

for at most one firing event per step, with residual charge decay. Communication is probabilistic and genetically biased; communication preference and spatial preference remain distinct. Spatial force is bounded and potentially asymmetric. Spatial range depends on current charge through the bounded mapping

\[
R_{s,i}^{eff}
=R_{min}+(R_{max}-R_{min})\frac{q_i}{Q_{max}}.
\]

The local reward is the binary receive→process→transmit completion signal. Global error controls only the turnover pressure.

All transmissions are synchronous and buffered: charge generated at step \(n\) can only be processed by recipients from step \(n+1\) onward.

## IV-C — Parameter normalization

Use normalized groups wherever possible:

\[
\eta_m=\frac{\gamma\Delta t}{m},
\quad
\eta_s=\frac{R_s}{L},
\quad
\eta_c=\frac{R_c}{L},
\quad
\eta_q=\frac{Q_{in}}{Q_{max}},
\]

\[
\eta_h=\frac{\beta}{\lambda},
\quad
\eta_P=\frac{P_{max}}{\beta},
\quad
K,
\quad
A,
\quad
\rho R^2.
\]

Map stable, extinct, saturated and highly supercritical charge regimes before selecting task-performing configurations.

## IV-D — Mechanism ladder

### P0 / VI-0 — Fixed non-evolving medium

Disable death, reproduction, mutation and global error pressure. Determine whether the particle substrate has intrinsic temporal computational capacity.

### P1 / VI-1 — Health and death

Enable health/death while keeping genotype fixed. Compare endogenous death against matched random turnover.

### P2 / VI-2 — Local reproduction

Enable local two-parent reproduction without mutation. Test whether inherited phenotypes are amplified by selection rather than neutral turnover.

### P3 / VI-3 — Mutation

Add bounded mutation and measure adaptation, diversity and mutation-rate regimes.

### P4 / VI-4 — Global error modulation

Enable

\[
P(E)=P_{min}+(P_{max}-P_{min})E^\gamma.
\]

Compare error-modulated pressure with constant low/medium/high pressure.

## IV-E — Benchmark ladder

The minimum task suite is:

1. single-delay reconstruction;
2. multiple-delay reconstruction;
3. XOR/parity;
4. NARMA-10;
5. Mackey–Glass prediction;
6. Lorenz prediction;
7. controlled temporal-regime classification;
8. abrupt nonstationarity;
9. gradual drift;
10. A→B→A recurrence;
11. multi-regime recurrence;
12. damage/recovery.

The progression deliberately moves from memory to nonlinear temporal processing and finally to continual adaptation. Physical particle reservoir work already demonstrates Mackey–Glass and Lorenz prediction, reinforcing the need for such controls.

## IV-F — Baselines

Required internal baselines:

- linear autoregressive baseline;
- fixed static particle medium;
- mobile non-evolving medium;
- demographic medium without mutation;
- evolving medium without global error modulation;
- full MFM.

External baselines, where computationally fair:

- ESN;
- small vanilla RNN;
- strong non-evolving particle-reservoir baseline;
- dynamic/self-organizing particle baseline where reproducible;
- offline evolutionary optimization baseline where appropriate.

Particle-based reservoir computing is already established, so particle dynamics alone cannot constitute a novelty claim.

## IV-G — Mandatory ablation matrix

Ablate individually:

- movement;
- charge decay;
- amplification;
- charge-dependent spatial range;
- asymmetric spatial preference;
- probabilistic routing;
- death;
- reproduction;
- mutation;
- global error pressure;
- genotype heterogeneity.

Add controls for random turnover, random mating and randomized mutation where feasible.

## IV-H — Readout protocol

Baseline observable:

\[
Z_n=q_{out,n}.
\]

Use a regularized linear readout. Fit only on training data and select regularization on validation data.

For continual-learning claims, freeze \(W_{out},b\) after initial calibration. A refitted-readout condition is reported separately and cannot substitute for the primary frozen-readout result.

Use a fixed washout period for each benchmark family.

## IV-I — Computational dynamics metrics

Measure:

- task loss/error;
- delay reconstruction curve;
- linear memory capacity;
- nonlinear memory capacity;
- state separation;
- output separability;
- covariance-spectrum participation ratio;
- output-state rank/stable rank;
- charge saturation fraction;
- empirical charge branching factor.

The target is not maximum state dimension but sufficient task-relevant computational capacity per computational cost.

## IV-J — Population/evolution metrics

Report:

\[
N_n,
\quad B_n,
\quad D_n,
\quad \tau_{life},
\quad T_{turnover},
\quad H_G.
\]

Also measure phenotype variance, spatial clustering, fragmentation, effective communication graph statistics, edge persistence and realized charge-flow pathways.

## IV-K — Stability–plasticity and continual-learning metrics

For task changes, measure:

- adaptation time;
- stationary-performance variance;
- turnover response;
- forgetting;
- forward transfer;
- backward transfer;
- relearning time;
- resource efficiency.

For recurring tasks define

\[
EMG=1-\frac{T_A^{return}}{T_A^{first}}.
\]

Positive EMG is not sufficient evidence of structural memory; the recurrence protocol must include a fast-state-reset/washout control when feasible.

## IV-L — Damage and regeneration

After adaptation, remove 10%, 20%, 30% and 50% of internal particles. Keep the fixed I/O interface intact.

Measure task-loss increase, population recovery and recovery time:

\[
\Delta L(r),
\qquad
T_{rec}(r).
\]

Compare against matched non-evolving controls.

## IV-M — Local-credit alignment analysis

Offline counterfactual experiments estimate

\[
\Delta_i=L(\text{without }i)-L(\text{with }i).
\]

Compare this with local success and health:

\[
\operatorname{corr}(R_i,\Delta_i),
\qquad
\operatorname{corr}(H_i,\Delta_i).
\]

This does not enter the MFM; it tests whether the local selection signal is actually aligned with task contribution.

## IV-N — Statistical protocol

Exploratory parameter screening may use 5–10 seeds. Main comparisons target at least 20 independent seeds. High-variance final claims should use 30–50 seeds where computationally feasible.

Report effect sizes and confidence intervals, not only p-values. Use multiple-comparison control for large ablation families. Show individual-run distributions whenever possible.

## IV-O — Compute accounting

Every comparison must record:

- particle count;
- simulation steps;
- event count;
- neighbor evaluations;
- births/deaths;
- wall-clock time;
- peak memory;
- hardware;
- number of seeds.

Matched compute is preferred to matched particle count when comparing different algorithms.

## IV-P — Reproducibility

Each run must preserve model version, code commit, configuration, seed, benchmark version, initial state, genotype initialization, readout protocol, split boundaries, hardware and output metrics.

Deterministic replay and checkpointing are mandatory Stage V requirements.

## IV-Q — Go/no-go criteria

Reconsider or narrow the paradigm if robust evidence shows:

- no temporal computation in the non-evolving substrate;
- viability only under trivial or pathological tuning;
- apparent adaptation explained entirely by readout retraining;
- local success unrelated or negatively related to task contribution;
- evolution indistinguishable from neutral drift;
- mutation producing only noise/collapse;
- global error feedback causing instability without a useful adaptation window;
- no continual-learning advantage over matched fixed reservoirs in the claimed niche;
- no recovery after meaningful structural damage;
- or all apparent advantages disappear under matched compute.

## Stage IV deliverable ✅

The complete experimental specification is frozen as:

**Continuous_Evolutionary_Particle_Computation_Stage_IV_Experimental_Design.md**

The next implementation stage must reproduce this specification without silently changing the MFM.

---

# Stage V — Reference Implementation 🔜

## Objective

Implement the frozen MFM v3 and Stage IV experimental protocol exactly before optimization.

## Requirements

- deterministic fixed-seed mode;
- unit tests for invariants;
- exact synchronous semantics;
- event tracing for charge routing;
- protected input/output handling;
- explicit population and charge caps;
- reproducible serialization of state and genotype;
- clear separation between simulator and readout trainer.

## Optimization after correctness

Only after the reference implementation passes validation: spatial hashing, vectorization, parallel/GPU force evaluation and memory pooling.

## Deliverable

A validated reference simulator plus a performance-oriented implementation that is behaviorally equivalent.

---

# Stage VI — Initial Experiments 🔜

## Objective

Establish whether the mechanism actually produces useful computation and adaptation.

## Phased sequence

### VI-0 — Fixed/non-evolving medium
Determine whether a temporal computational substrate exists before evolution.

### VI-1 — Add health and death
Test whether local cycle completion produces persistent selection pressure.

### VI-2 — Add local reproduction
Test demographic persistence and phenotype amplification.

### VI-3 — Add mutation
Test variation, diversity and mutation phase boundaries.

### VI-4 — Add global error modulation
Test stability–plasticity coupling.

### VI-5 — Continual recurrence and drift
Use A→B→A, multiple recurring regimes and gradual drift.

### VI-6 — Damage and recovery
Delete controlled fractions of internal particles and measure recovery.

## Go/no-go criteria

Reconsider the paradigm if robustly: no temporal computation exists; populations are viable only under trivial tuning; evolution is indistinguishable from neutral drift; local survival is unrelated to useful computation; or adaptive performance is consistently inferior to matched fixed reservoirs without compensating advantages.

## Deliverable

A statistically reproducible empirical report with raw trajectories, ablations and matched-budget comparisons.

---

# Stage VII — Paradigm Investigation 🔜

## Objective

Determine whether CEPC deserves to be treated as a distinct computational primitive or paradigm.

## VII-A — Causal chain

Seek evidence for

\[
\text{local rule}
ightarrow\text{collective organization}
ightarrow\text{computation}
ightarrow\text{selection}
ightarrow\text{adaptation}.
\]

## VII-B — Matched-budget comparison

Compare against fixed reservoirs, recurrent baselines, active-particle reservoirs, dynamic particle systems and evolutionary optimization baselines under matched computational resources rather than only matched unit count.

## VII-C — Domain-specific advantage

The strongest plausible result is not universal superiority. It is a measurable advantage on continuous, nonstationary, temporally structured environments where structural adaptation is genuinely useful.

## VII-D — Structural explainability

Relate task changes to genotype frequencies, spatial clusters, communication graphs, charge-flow pathways and turnover.

## VII-E — Reproducibility

Require many independent seeds and report distributions, not only best-case trajectories.

## VII-F — Final claim discipline

Only after all previous stages can the project consider claims such as

\[
\boxed{\text{evolutionary population-level computation is a useful computational primitive}}
\]

or

\[
\boxed{\text{CEPC is a distinct adaptive-computing paradigm}.}
\]

These are outcomes to be earned empirically, not assumptions of the roadmap.

---

# Global Research Questions Remaining After Stage III

1. Does the simple local survival proxy actually select useful computation?
2. Under what parameter regimes does charge activity remain useful rather than die out or explode against the cap?
3. Does spatial mobility add measurable computational value?
4. Does genetic heterogeneity create complementary roles or merely noise?
5. Can structural memory improve recurrent-task adaptation without catastrophic forgetting?
6. Does global error modulation create a stable adaptive regime rather than oscillation or collapse?
7. Can the full variable-population system be approximated by a fast/slow dynamical model?

---

# Dependency Graph

\[
I\rightarrow II\rightarrow III\rightarrow IV\rightarrow V\rightarrow VI\rightarrow VII.
\]

The strict logical dependency is especially strong for

\[
III\rightarrow IV\rightarrow V\rightarrow VI\rightarrow VII.
\]

Theoretical assumptions must be frozen before experimental parameter sweeps; experimental semantics must be frozen before optimized implementation; implementation must be validated before results are interpreted; paradigm claims require empirical evidence.

---

# Current Scientific Position

The project has now completed its first theoretical closure. The architecture is sufficiently specified to begin experimental design without introducing further mechanisms into the baseline.

The immediate objective is therefore not to make the system more biologically realistic or more complex. It is to determine, through controlled experiments, whether the minimal set of mechanisms already defined is sufficient to produce a useful, adaptive computational medium.
