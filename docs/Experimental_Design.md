# Continuous Evolutionary Particle Computation (CEPC)
# Stage IV — Experimental Design

## Experimental protocol for falsifiable evaluation of the Minimal Formal Model

---

## 0. Purpose

Stage IV converts the theoretical closure of Stages III-A through III-D into a reproducible experimental programme. The purpose is not to demonstrate that the proposed particle medium is powerful by construction, but to determine, through controlled comparisons and ablations, which mechanisms actually produce computation, memory, organization, adaptation and robustness.

The central methodological principle is:

> **Every claimed advantage of CEPC must be attributable to a specific mechanism through a matched baseline or ablation.**

The primary experimental object is the Minimal Formal Model (MFM v3). No mechanism may be added to the MFM merely because it improves performance. New mechanisms are experimental variants and must be labeled as such.

Stage IV therefore separates five questions:

1. **Computation:** Can the non-evolving particle medium compute temporal functions at all?
2. **Organization:** Do local survival and spatial interaction produce nontrivial persistent organization?
3. **Evolution:** Does reproduction and mutation improve the computational substrate rather than merely alter it?
4. **Continual adaptation:** Does global-error-modulated turnover create a useful stability–plasticity regime under nonstationarity?
5. **Robustness:** Does the computational organization survive stochastic variation and physical/structural damage?

A negative answer at any level is a legitimate scientific result.

---

# 1. Scientific Questions and Hypotheses

## 1.1 Primary hypothesis

A bounded population of simple interacting particles can act as a computational dynamical medium in which task-relevant temporal information is represented in transient charge/spatial states, while local survival, reproduction, mutation and global error-modulated turnover can progressively reorganize the medium for changing task regimes.

This is a hypothesis, not an established property.

## 1.2 Experimental hypotheses

### H1 — Static computational capacity

A fixed population of particles with charge propagation and spatial dynamics can perform nontrivial temporal tasks using only a linear readout from output-particle charges.

### H2 — Memory/nonlinearity decomposition

The medium will exhibit measurable short-term memory and nonlinear temporal processing. These should not be conflated: high memory alone is not sufficient for nonlinear computation.

### H3 — Spatial organization

Allowing movement and asymmetric local forces will change the computational representation in a reproducible manner compared with a matched immobile population.

### H4 — Local selection

A fixed health reward for successful receive–process–transmit cycles will create differential survival and a nonrandom population structure.

### H5 — Hereditary adaptation

Local reproduction and recombination will redistribute genotypes in a way that changes computational performance beyond the effect of demographic turnover alone.

### H6 — Mutation/diversity

Moderate mutation will produce beneficial exploratory variation in at least some task regimes; too little mutation will limit adaptation, whereas too much mutation may destroy accumulated structure.

### H7 — Global plasticity regulation

Increasing global error pressure will increase structural turnover. There should exist an intermediate regime in which adaptation is sufficiently fast without causing population collapse or destructive forgetting.

### H8 — Continual adaptation

Under nonstationary task sequences, the evolving medium will show measurable adaptation and, potentially, faster reacquisition of previously encountered regimes.

### H9 — Damage recovery

After structural damage, an adapted population will recover function through continued dynamics and evolution without requiring restoration of its original microscopic configuration.

### H10 — Functional diversity

Persistent genotype/phenotype diversity may be beneficial when distinct subpopulations occupy complementary computational niches. This is explicitly an empirical question, not an assumption.

---

# 2. Experimental Philosophy

## 2.1 Separate mechanisms before combining them

The experimental ladder must add mechanisms incrementally:

\[
P0\rightarrow P1\rightarrow P2\rightarrow P3\rightarrow P4
\]

where:

- **P0:** fixed, non-evolving particle medium;
- **P1:** + health and death;
- **P2:** + local reproduction without mutation;
- **P3:** + mutation;
- **P4:** + global error-modulated turnover.

This hierarchy is the main causal scaffold for the project.

## 2.2 Matched comparisons

When a mechanism is removed, all other parameters must remain identical unless the mechanism logically requires a compensating change. Population size, initial conditions, input stream, readout protocol, compute budget and random-seed policy must be matched.

Ablation conclusions must be based on distributions over independent runs, not on a single representative trajectory.

## 2.3 No hidden optimizer

The internal medium does not receive gradients or individual task labels in the MFM. The only task-level feedback available internally is the scalar global error-derived pressure.

The experimental pipeline itself may use optimization for the linear readout, but this optimization must remain outside the particle dynamics and must be reported separately.

## 2.4 Two adaptation channels must be isolated

The readout is a potential confound. Therefore experiments use two explicit readout modes.

### Primary mode — Frozen readout

1. Run an initial calibration period on a stationary task regime.
2. Train the linear readout on a held-out calibration split.
3. Freeze \(W_{out},b\).
4. Continue the particle medium through nonstationary evaluation.

This mode asks whether internal CEPC adaptation itself changes the computational substrate usefully.

### Diagnostic mode — Refit readout

The readout may be periodically retrained or refit using the same specified protocol. This mode measures the computational representation independently of the burden placed on a frozen decoder.

**Primary continual-learning claims must be based on the frozen-readout mode.** Refit-readout results are secondary diagnostics.

---

# 3. Exact System Under Test

All experiments in the main MFM track use the MFM v3 semantics.

## 3.1 Domain

The baseline domain is a two-dimensional torus:

\[
\Omega=\mathbb T^2.
\]

Periodic wrapping avoids boundary-specific computational artifacts. Reflecting or bounded-wall variants are secondary controls only.

## 3.2 Population

\[
0\le N_n\le N_{max}.
\]

Input and output particles are fixed protected interface particles. Internal particles are subject to ordinary birth/death dynamics.

Population capacity is hard. If capacity is full, candidate births are rejected rather than replacing a living particle.

## 3.3 Genotype

Each internal particle has immutable lifetime genotype

\[
g_i=(m_i,\gamma_i,H_{max,i},\theta_{q,i},\delta_{q,i},R_{c,i},K_i,A_i,\Pi_i^{sp},\Pi_i^{comm}),
\]

or the explicitly selected reduced genotype used for a given experiment.

No genotype parameter may change during an individual's lifetime.

## 3.4 Dynamic state

\[
s_i^n=(x_i^n,v_i^n,H_i^n,q_i^n,C_i^n,L_i^n).
\]

Charge is integer-valued and nonnegative. Health is bounded. Particle positions are periodic.

## 3.5 Charge dynamics

For pre-update charge \(q_{pre}\):

\[
\text{activation}=\mathbf 1[q_{pre}\ge\theta_{q,i}].
\]

When active, exactly one threshold packet is consumed:

\[
q_i^{out}=A_i\theta_{q,i},
\]

and the residual charge is

\[
q_i^{res}=q_{pre}-\theta_{q,i}.
\]

When not active, no charge is processed.

Residual charge undergoes integer decay:

\[
q_i^{next}=\min\left(Q_{max},\max(0,q_i^{res}-\delta_{q,i})\right).
\]

The hard charge cap is a mathematical safety bound, not a guarantee of useful dynamics.

## 3.6 Communication

Communication and spatial preference remain distinct mechanisms.

The communication neighborhood is

\[
\mathcal N_i^c(n)=\{j\ne i:d_{ij}\le R_{c,i}\}.
\]

For candidates in the neighborhood,

\[
P(j|i,n)
=
\frac{\exp(\alpha_i S_{ij}^{comm})}
{\sum_{k\in\mathcal N_i^c(n)}\exp(\alpha_iS_{ik}^{comm})}.
\]

At most \(K_i\) distinct targets are sampled without replacement.

## 3.7 Local success

The baseline local reward signal is intentionally minimal:

\[
R_i^n=
\mathbf 1[\text{receive}\rightarrow\text{process}\rightarrow\text{transmit}].
\]

Interaction novelty is measured diagnostically but does not change health in the MFM.

## 3.8 Health

\[
H_i^{n+1}=
\operatorname{clip}
\left[
H_i^n+\beta_iR_i^n-\lambda_iP(E_n),
0,H_{max,i}
\right].
\]

A particle dies when its post-update health is nonpositive.

## 3.9 Global error pressure

The normalized task error is

\[
E_n\in[0,1].
\]

Baseline pressure:

\[
P(E_n)=P_{min}+(P_{max}-P_{min})E_n^\gamma.
\]

Global error never labels individual particles as good or bad.

## 3.10 Charge-dependent spatial range

The baseline effective range is bounded and monotonic in charge:

\[
R_{s,i}^{eff}(n)
=
R_{min}+(R_{max}-R_{min})\frac{q_i^n}{Q_{max}}.
\]

This creates the feedback loop

\[
q\rightarrow R_s\rightarrow\text{neighbors}\rightarrow F\rightarrow x\rightarrow\text{future interactions}\rightarrow q.
\]

The feedback is a hypothesis under test rather than an assumed source of improvement.

## 3.11 Spatial dynamics

The pair force is bounded, local and potentially asymmetric:

\[
F_{ij}^n
=
S_{ij}^{spatial}
\left(1-\frac{d_{ij}}{R_{s,i}^{eff}(n)}\right)_+
\frac{r_{ij}}{d_{ij}+\varepsilon}.
\]

\[
F_i^n=\sum_{j\in\mathcal N_i^s(n)}F_{ij}^n.
\]

Mechanical update:

\[
v_i^{n+1}=v_i^n+\frac{\Delta t}{m_i}(F_i^n-\gamma_i v_i^n),
\]

\[
x_i^{n+1}=\Pi_\Omega(x_i^n+\Delta t\,v_i^{n+1}).
\]

## 3.12 Reproduction

Eligible parents must satisfy the MFM local mating conditions, including local proximity, sufficient health and recent successful cycle completion.

Offspring inherit genotype through recombination and bounded mutation.

Birth state:

\[
q_k=0,
\qquad
C_k=L_k=\varnothing,
\qquad
H_k=H_{birth},
\]

with position and velocity initialized near/interpolated from the parents with bounded perturbation.

## 3.13 Exact synchronous semantics

The simulation is synchronous. All decisions at step \(n\) use the same state snapshot. Transmissions generated at \(n\) are buffered for \(n+1\). There are no within-step cascades.

The implementation must guarantee order independence through old/new state buffers.

---

# 4. Experimental Factors

## 4.1 Core dimensionless groups

Parameter sweeps should preferentially be expressed using dimensionless or normalized groups:

\[
\eta_m=\frac{\gamma\Delta t}{m},
\qquad
\eta_s=\frac{R_s}{L},
\qquad
\eta_c=\frac{R_c}{L},
\qquad
\eta_q=\frac{Q_{in}}{Q_{max}},
\]

\[
\eta_h=\frac{\beta}{\lambda},
\qquad
\eta_P=\frac{P_{max}}{\beta},
\qquad
K,
\qquad A.
\]

where \(L\) is the torus side length.

Additional ratios should be recorded when meaningful, including the expected interaction density

\[
\rho R^2,
\]

and empirical charge branching factor \(\widehat{\mathcal R}_Q\).

## 4.2 Primary sweep variables

The first sweep should focus on:

- communication range \(R_c\);
- maximum targets \(K\);
- amplification \(A\);
- threshold \(\theta_q\);
- charge decay \(\delta_q\);
- spatial range \(R_{min},R_{max}\);
- mechanical damping ratio \(\gamma\Delta t/m\);
- population density \(N/L^2\);
- local reward-to-pressure ratio \(\beta/\lambda\);
- mutation rate;
- global pressure amplitude \(P_{max}\);
- pressure curvature \(\gamma\).

Not every parameter needs a full factorial sweep. Sequential design is preferred to avoid a combinatorial explosion.

## 4.3 Regime map for charge propagation

Three qualitative charge regimes must be measured:

\[
\widehat{\mathcal R}_Q<1,
\qquad
\widehat{\mathcal R}_Q\approx1,
\qquad
\widehat{\mathcal R}_Q>1.
\]

The value must be estimated empirically from realized activation propagation; the theoretical expression is only an approximation.

The experimental target is not simply the critical point. It is the region in which activity is bounded, nontrivial and computationally useful.

---

# 5. Experimental Ladder

## VI-0 / P0 — Fixed non-evolving medium

Disable health-driven death, reproduction, mutation and global pressure.

### Purpose

Establish whether the microscopic medium has computational capacity before evolution is allowed to modify it.

### Variants

- no movement;
- movement;
- no charge-dependent range;
- charge-dependent range;
- deterministic communication control;
- probabilistic communication.

### Required tasks

Delay reconstruction, parity/XOR, NARMA-10 and at least one chaotic prediction task.

### Decision

If no statistically reproducible temporal computation appears in any nontrivial stable regime, the evolutionary components cannot rescue the core computational hypothesis without redefining the paradigm.

---

## VI-1 / P1 — Health and death

Enable health and death while keeping genotype fixed.

### Question

Does the local receive–process–transmit rule create persistent nonrandom organization?

### Measurements

Population size, lifetime distribution, successful-cycle rate, spatial clustering, graph statistics and task performance.

### Critical control

Compare dynamic death against matched random deletion with the same mean mortality rate.

This distinguishes selection effects from mere turnover effects.

---

## VI-2 / P2 — Local reproduction

Enable reproduction without mutation.

### Question

Does local selection amplify pre-existing useful phenotypes?

### Controls

- no reproduction;
- reproduction with randomized mating among eligible local particles;
- reproduction with genotype inheritance but shuffled parental pairing where feasible.

### Key observation

A true selection effect should differ from neutral demographic replacement under matched birth/death statistics.

---

## VI-3 / P3 — Mutation

Enable bounded genetic mutation.

### Question

Does hereditary variation improve adaptation and useful diversity?

### Sweep

At minimum test three mutation regimes: low, intermediate and high.

### Measurements

Genotype entropy, phenotypic variance, fixation time, lineage survival, task performance and adaptation time.

### Failure mode

If performance improves only when mutation is so high that the population behaves approximately as random search, the mechanism should not be interpreted as useful evolution.

---

## VI-4 / P4 — Global error-modulated turnover

Enable

\[
P(E)=P_{min}+(P_{max}-P_{min})E^\gamma.
\]

### Question

Does global error create a useful stability–plasticity response?

### Comparison

For each adaptive run compare:

1. constant low pressure;
2. constant medium pressure;
3. constant high pressure;
4. error-modulated pressure.

This is necessary to show that error feedback itself, rather than simply turnover, produces an advantage.

---

# 6. Benchmark Suite

The benchmark suite is ordered from simple memory to nonlinear temporal processing and finally nonstationarity.

## 6.1 Delay reconstruction

Given scalar input \(u_t\), predict

\[
y_t=u_{t-k}.
\]

Use several delays \(k\).

### Purpose

Directly measure short-term memory and its decay with temporal distance.

### Main metrics

Normalized MSE, correlation and memory curve over delay.

---

## 6.2 Multi-delay reconstruction

Predict multiple delayed values simultaneously:

\[
y_t=(u_{t-k_1},u_{t-k_2},\ldots,u_{t-k_m}).
\]

### Purpose

Measure whether the medium can retain multiple temporal traces simultaneously rather than specializing to one delay.

---

## 6.3 XOR / parity

For binary or thresholded input sequences, predict parity over a finite history.

### Purpose

Test nonlinear temporal processing that cannot be explained by a purely linear memory channel.

---

## 6.4 NARMA-10

Use the standard nonlinear autoregressive moving-average task.

### Purpose

Provide a controlled test combining memory and nonlinear temporal interaction.

### Important control

Input preprocessing and target generation must be identical across all baselines.

---

## 6.5 Mackey–Glass prediction

Use a standardized Mackey–Glass time series configuration.

### Purpose

Test nonlinear long-horizon temporal prediction.

### Metrics

NRMSE over a fixed prediction horizon, one-step prediction error and optional divergence time for recursive prediction.

The benchmark is appropriate for reservoir research because active-particle physical reservoirs have previously been evaluated on Mackey–Glass and Lorenz prediction. citeturn524425search0

---

## 6.6 Lorenz prediction

Use a deterministic Lorenz system with fixed parameters and a standardized sampling procedure.

### Purpose

Stress temporal prediction under chaotic sensitivity.

### Interpretation

Poor long-horizon prediction must not automatically be treated as failure of the substrate: one-step and short-horizon errors should also be reported.

---

## 6.7 Controlled frequency/regime classification

Generate temporal signals from several frequency or dynamical regimes and classify the current regime.

### Purpose

Test whether the medium forms temporally integrated state representations useful for classification rather than only scalar prediction.

---

# 7. Nonstationary and Continual-Learning Protocol

## 7.1 A→B→A protocol

This is the flagship continual-adaptation experiment.

Task sequence:

\[
A\rightarrow B\rightarrow A.
\]

The A and B regimes must differ in a task-relevant but controlled way, for example through distinct temporal statistics or target mappings.

The three phases must have equal or pre-registered durations.

## 7.2 Additional recurrence

Use repeated cycles:

\[
A\rightarrow B\rightarrow C\rightarrow A\rightarrow B\rightarrow C.
\]

This tests whether the medium accumulates useful structural memory rather than memorizing only one previous transition.

## 7.3 Gradual drift

Interpolate between regimes continuously:

\[
\lambda_t\in[0,1],
\qquad
T_{\lambda_t}=(1-\lambda_t)T_A+\lambda_tT_B,
\]

or an equivalent task-specific drift parameterization.

### Purpose

Distinguish abrupt adaptation from tracking of smoothly moving environments.

## 7.4 Abrupt changes

At a pre-specified time, change the task or input statistics sharply.

Measure transient error, turnover response, population recovery and adaptation time.

## 7.5 Relearning and evolutionary memory

Define

\[
T_A^{first}
\]

as the time required to reach a fixed performance threshold on the first exposure to A, and

\[
T_A^{return}
\]

as the corresponding time on the return to A.

Define evolutionary-memory gain:

\[
EMG=1-\frac{T_A^{return}}{T_A^{first}}.
\]

Positive EMG alone is insufficient evidence of structural memory because residual fast dynamic state can also accelerate return. Therefore the return experiment must include a washout/control in which fast state is randomized or reset while structural population state is retained, whenever experimentally feasible.

## 7.6 Forgetting

For task A, measure performance before B and after B:

\[
F_A=L_A^{after\ B}-L_A^{before\ B}
\]

for losses where larger values mean worse retention.

Alternatively use a normalized performance-based definition; the exact convention must be fixed before experiments.

Continual-learning assessment must report adaptation and retention together. Accuracy alone is not enough, and the continual-learning literature explicitly emphasizes forgetting, forward transfer, backward transfer, efficiency and performance trajectories as complementary evaluation dimensions. citeturn770953academia39turn770953academia38

---

# 8. Damage and Regeneration Experiments

After an adapted state is reached, remove a controlled fraction of internal particles:

\[
r\in\{0.1,0.2,0.3,0.5\}.
\]

Input/output particles remain protected.

Measure:

\[
\Delta L(r),
\qquad
T_{rec}(r),
\qquad
\Delta N,
\qquad
\Delta H_G,
\]

where \(\Delta L\) is the task-loss increase, \(T_{rec}\) recovery time and \(H_G\) genotype entropy.

A strong regeneration result should show recovery without restoring the deleted particle identities.

A matched fixed-particle reservoir should also receive equivalent deletion perturbations when possible.

---

# 9. Ablation Matrix

The following ablations are mandatory before strong paradigm claims.

| Mechanism | Full MFM | Ablation | Main causal question |
|---|---:|---:|---|
| Movement | ✓ | No movement | Does spatial motion matter? |
| Charge decay | ✓ | \(\delta_q=0\) | Does fading activation matter? |
| Amplification | ✓ | \(A=1\) or restricted | Is gain necessary? |
| Charge-range coupling | ✓ | Fixed \(R_s\) | Does charge→geometry feedback help? |
| Asymmetric spatial preference | ✓ | Symmetric/null preference | Does directional organization matter? |
| Probabilistic routing | ✓ | Deterministic routing | Is stochastic routing functionally relevant? |
| Death | ✓ | No death | Is turnover required? |
| Reproduction | ✓ | No reproduction | Is inherited replacement useful? |
| Mutation | ✓ | No mutation | Is exploration useful? |
| Global pressure | ✓ | Constant pressure | Does error feedback help? |
| Genotype heterogeneity | ✓ | Homogeneous genotype | Does heterogeneity help? |
| Interaction history | measured | ignored diagnostically | Does history explain selection dynamics? |
| Population cap | ✓ | larger-cap control | Are effects capacity artifacts? |

Additional matched controls should include random turnover, random mutation and random mating where scientifically feasible.

---

# 10. Baselines

The baseline set must progress from mechanistic controls to established computational paradigms.

## 10.1 Internal controls

### B0 — Linear memory baseline

A direct linear autoregressive predictor of matched input history.

### B1 — Fixed particle medium

Same particle dynamics with all evolutionary mechanisms disabled.

### B2 — Mobile particle medium without evolution

Same movement and charge dynamics but fixed genotypes and no turnover.

### B3 — Demographic medium without mutation

Death and reproduction enabled, but genotype pool fixed.

### B4 — Evolving medium without global error modulation

Evolution enabled with constant turnover pressure.

### B5 — Full MFM

All baseline CEPC mechanisms enabled.

## 10.2 External computational baselines

### ESN

Use a conventional echo state network with a matched effective state dimension and matched readout training procedure.

ESNs are an appropriate reference because classical reservoir computing explicitly uses a nonlinear dynamical state with a linear readout, and theoretical work establishes universality for broad fading-memory filters under suitable assumptions. citeturn524425academia60turn524425academia59

### Simple RNN

Include a small recurrent neural network trained for the same task budget where computational comparison is relevant.

### Strong particle-reservoir baseline

Include a non-evolving particle reservoir with the closest available dynamics. This is essential because particle-based physical reservoirs already demonstrate temporal computation and chaotic prediction; particle computation itself cannot be claimed as the novelty. citeturn524425search0

### Dynamic/self-organizing particle baseline

Where technically reproducible and fair, compare with a dynamic particle system such as NPA-like self-organization, especially for morphology and self-organization experiments.

### Evolutionary optimization baseline

Where useful, compare against an offline evolutionary optimizer controlling a similarly sized fixed architecture. This separates continuous endogenous population evolution from conventional external optimization.

---

# 11. Readout Protocol

## 11.1 Feature definition

The primary observable is

\[
Z_n=q_{out,n}.
\]

The diagnostic state may include all particle charges, positions, velocities, health, graph statistics and genotype frequencies, but those features must not silently enter the main benchmark readout.

## 11.2 Training

Use a linear ridge regression or equivalent regularized linear method for continuous targets:

\[
\hat y_n=W_{out}Z_n+b.
\]

Classification tasks may use a linear classifier with a pre-registered regularization procedure.

## 11.3 Washout

Discard a fixed initial washout segment before fitting or evaluating state-dependent tasks. The washout duration must be fixed per benchmark class before comparing models.

## 11.4 Hyperparameter separation

Readout regularization may be selected on a validation split only. The test sequence must never influence readout hyperparameter selection.

## 11.5 Frozen-readout continual evaluation

After calibration and fitting, \(W_{out}\) and \(b\) are frozen for the primary continual-learning experiments.

Any use of online readout updates must be reported as a separate experimental condition.

---

# 12. Computational Capacity and Representation Metrics

Task loss is necessary but insufficient. The internal dynamics must be characterized.

## 12.1 Linear memory capacity

For each delay \(k\), train a linear readout to reconstruct \(u_{n-k}\) from the current reservoir state. Report the memory curve and aggregate memory score across delays.

This follows the general reservoir-computing practice of treating retained temporal information as a measurable property of the dynamical substrate. The information-processing-capacity framework of Dambre et al. relates computational capacity to independent state variables under fading-memory conditions. citeturn524425search1

## 12.2 Nonlinear memory capacity

Repeat the analysis for nonlinear functions of delayed inputs, such as products and parity-like targets.

Do not collapse linear and nonlinear capacities into one number unless the definition is explicitly justified.

## 12.3 Separation

For pairs of input histories \(h,h'\), measure distances in:

- output charge space;
- full charge space;
- spatial configuration;
- combined diagnostic state.

Evaluate whether histories with different task labels are linearly separable.

## 12.4 Effective dimension

Estimate effective dimension using the covariance spectrum of observed state vectors, for example through participation ratio:

\[
D_{PR}=\frac{(\sum_i\lambda_i)^2}{\sum_i\lambda_i^2}.
\]

Interpret carefully:

- too low may indicate collapse;
- very high without task improvement may indicate uncontrolled noisy expansion.

The target is not maximal dimension but task-relevant dimension per cost.

## 12.5 Output rank

Measure numerical rank or stable-rank statistics of the output-state matrix.

This determines whether multiple output channels actually carry independent computational information.

## 12.6 Information-processing capacity

Where computationally feasible, estimate capacity over a controlled function family. The decomposition should distinguish memory from nonlinear transformations rather than reporting one undifferentiated score.

---

# 13. Population and Evolution Metrics

## 13.1 Demography

Report:

\[
N_n,
\qquad
B_n,
\qquad
D_n,
\qquad
\tau_{life},
\qquad
T_{turnover}.
\]

The stationary viability condition is approximately

\[
\mathbb E[B_n]\approx\mathbb E[D_n].
\]

## 13.2 Genotype diversity

Use genotype-frequency entropy:

\[
H_G=-\sum_g p_g\log p_g.
\]

For continuous genotype spaces, supplement this with discretized bins or kernel-based diversity measures defined before analysis.

## 13.3 Phenotypic diversity

Measure variance and covariance of interpretable genetic traits such as threshold, amplification, communication range, target count and mechanical parameters.

## 13.4 Spatial organization

Measure:

- pair-correlation functions;
- local density distribution;
- cluster-size distribution;
- nearest-neighbor statistics;
- fragmentation;
- polarization where meaningful;
- spatial entropy.

## 13.5 Effective communication graph

Distinguish:

\[
G_n=\text{potential interaction graph}
\]

from

\[
G_n^{event}=\text{realized information-flow graph}.
\]

Report degree statistics, strongly connected components, path lengths where meaningful, and temporal edge persistence.

---

# 14. Charge Dynamics Metrics

## 14.1 Charge statistics

Track:

\[
\bar q,
\operatorname{Var}(q),
q_{max}^{observed},
\text{saturation fraction}.
\]

## 14.2 Charge branching factor

Estimate empirical activation branching:

\[
\widehat{\mathcal R}_Q
\approx
\frac{\text{new downstream activations caused by an activation}}
{\text{source activations}}.
\]

The exact estimator must account for delayed propagation and multiple targets.

## 14.3 Information dissipation

Measure the fraction of injected charge that is:

- retained;
- consumed by processing;
- transmitted;
- lost through decay;
- trapped in saturated states.

The purpose is not charge conservation, since amplification deliberately permits non-conservation, but to understand where information-bearing activity disappears or explodes.

---

# 15. Stability–Plasticity Metrics

## 15.1 Adaptation time

For a task change at \(t_0\), define the first time the performance crosses a pre-registered threshold:

\[
T_{adapt}=\min\{\tau:L(t_0+\tau)\le L_{target}\}.
\]

## 15.2 Turnover response

Measure the transient change in death and birth rates following a change in task error.

## 15.3 Plasticity efficiency

Define useful improvement per structural turnover:

\[
PE=\frac{L_{before}-L_{after}}
{1+N_{turnover}}.
\]

This is a diagnostic quantity, not a universal metric.

## 15.4 Stability

Measure performance variance during stationary periods:

\[
\sigma_L^2=\operatorname{Var}(L_t).
\]

Also report population and genotype variance because a stable output can conceal structural instability.

## 15.5 Stability–plasticity frontier

Plot adaptation time against forgetting/stationary variability across pressure settings.

The preferred regime is a Pareto region where adaptation is sufficiently rapid while retention and viability remain acceptable.

---

# 16. Continual-Learning Metrics

For a task sequence \(T_1,\ldots,T_K\), report at least:

### Average performance

Mean task performance over the whole stream.

### Forgetting

Loss or performance degradation on earlier tasks after later-task exposure.

### Forward transfer

Performance on a new task relative to an otherwise identical system encountering that task without prior adaptation.

### Backward transfer

Change in prior-task performance induced by learning later tasks.

### Relearning acceleration

Reduction in adaptation time for recurring tasks.

### Resource efficiency

Performance relative to particle count, event count, wall-clock compute and memory footprint.

These metrics follow the broader continual-learning evaluation principle that performance, forgetting, transfer, memory overhead and computation should be considered jointly rather than relying on a single accuracy number. citeturn770953academia39

---

# 17. Causal Credit-Assignment Analysis

One of the largest conceptual risks is that local survival may reward activity without rewarding task usefulness.

The MFM cannot use a global counterfactual contribution signal internally, but the experimental analysis can calculate one offline.

For a sampled particle or lineage, define a counterfactual task contribution:

\[
\Delta_i
=
L(\text{system without }i)-L(\text{system with }i).
\]

Do not compute this for every particle in every timestep. Use controlled interventions on sampled particles or lineages.

Then examine:

\[
\operatorname{corr}(R_i,\Delta_i),
\qquad
\operatorname{corr}(H_i,\Delta_i),
\]

and analogous rank correlations.

Also test whether local success predicts future lineage persistence.

### Interpretation

- strong positive correlation supports the local-credit hypothesis;
- weak correlation means local survival may be mostly neutral;
- negative correlation indicates potential survival hacking;
- task-dependent correlation indicates contextual specialization rather than universal utility.

This analysis is central and should not be hidden behind aggregate task performance.

---

# 18. Diversity and Niche Analysis

Functional diversity is not synonymous with genotype diversity.

The analysis must ask whether two genotypes that coexist actually perform different computational roles.

For sufficiently abundant phenotypes, estimate conditional task contribution:

\[
C(g)=\text{performance contribution associated with phenotype }g.
\]

Use interaction graphs and spatial co-localization to test for complementary niches.

A strong result would be coexistence in which removal of one phenotype reduces performance despite the continued presence of the other.

This provides evidence for functional complementarity rather than cosmetic genetic diversity.

---

# 19. Experimental Controls Against Trivial Explanations

## 19.1 Random-turnover control

Match the mean birth/death rate of the evolving system while assigning turnover independently of local success.

## 19.2 Random-genotype control

Preserve the same demographic events while sampling offspring genotypes randomly from the parental gene pool or admissible domain, as appropriate.

## 19.3 Random-mating control

Allow local eligible particles to reproduce but remove the genotype-dependent mating bias.

## 19.4 Static-population control

Keep population size approximately matched while disabling evolutionary change.

## 19.5 Readout-only control

Allow readout retraining without internal evolutionary adaptation to quantify how much apparent continual-learning performance comes from decoder adaptation alone.

## 19.6 State-reset control

For recurrence experiments, reset transient dynamical variables while preserving evolved structure to distinguish structural memory from residual fast state.

## 19.7 Structural-reset control

Construct a control with matched instantaneous task performance but randomized population/genotype structure when feasible. This tests whether long-term memory depends on organization rather than only current activity.

---

# 20. Statistical Protocol

## 20.1 Independent runs

Initial experiments should use at least:

\[
N_{seed}\ge20
\]

independent seeds for the main comparisons.

For expensive parameter sweeps, use a staged design:

- 5–10 seeds for exploratory screening;
- 20 seeds for main effects;
- 30–50 seeds for final high-confidence comparisons or highly variable evolutionary conditions.

These are minimum experimental targets, not claims of sufficient power for every effect size.

## 20.2 Train/validation/test separation

Every benchmark must have fixed, reproducible splits or stream segments.

No test data may influence parameter selection, readout regularization, stopping criteria or model selection.

## 20.3 Randomization

Each seed controls all stochastic sources:

- target sampling;
- mating;
- recombination;
- mutation;
- offspring perturbation;
- initial particle placement where randomized;
- stochastic benchmark generation where applicable.

## 20.4 Statistical summaries

Report median and interquartile range for heavily skewed evolutionary measurements and mean ± standard deviation when distributions are approximately symmetric.

Show individual-run points whenever possible.

## 20.5 Significance and effect size

For pairwise comparisons, report effect size and confidence interval rather than relying only on a p-value.

For many ablations, control the false-discovery rate or use a pre-registered hierarchical analysis that separates primary from exploratory comparisons.

## 20.6 Random-seed robustness

A result that occurs in one favorable seed is not considered evidence of a reliable mechanism.

A core result should survive multiple independent seeds and preferably multiple initial spatial configurations.

---

# 21. Experimental Budget and Scaling

## 21.1 Population sizes

Use at least three scales:

\[
N\in\{N_{small},N_{medium},N_{large}\}.
\]

The exact values depend on the implementation, but the medium/large runs should increase the computational budget sufficiently to test whether observed effects disappear or strengthen with population size.

## 21.2 Compute accounting

Every experiment must report:

- particle count;
- simulation steps;
- charge-processing events;
- births and deaths;
- neighbor evaluations;
- wall-clock time;
- CPU/GPU hardware;
- peak memory;
- number of runs.

Matching only particle count is insufficient when comparing algorithms with different per-particle computational costs.

## 21.3 Expected complexity

Naive all-pairs geometry is

\[
O(N^2)
\]

per step.

With spatial hashing or a uniform grid and bounded local density, neighbor construction can approach approximately

\[
O(N)
\]

per step.

Optimization is permitted only after the reference implementation has been validated for behavioral equivalence.

---

# 22. Reproducibility Requirements

Each run must serialize enough information to reproduce the state transition exactly.

Minimum run record:

- model version;
- git commit hash;
- configuration file;
- random seed;
- benchmark identifier/version;
- initial population state;
- genotype initialization;
- readout configuration;
- training/validation/test boundaries;
- hardware information;
- simulator version;
- elapsed time;
- output metrics;
- event trace identifier.

The simulator must support checkpoints and deterministic replay from a checkpoint and seed.

Charge events should be traceable as

\[
(i\rightarrow j,n,q).
\]

This event trace is essential for causal and debugging analysis.

---

# 23. Reference Experiment Matrix

| Experiment | Medium | Evolution | Error pressure | Main result |
|---|---|---|---|---|
| E0 | Static particles | No | None | Existence of computation |
| E1 | Mobile particles | No | None | Effect of spatial dynamics |
| E2 | Mobile + decay/coupling | No | None | Fast memory regime |
| E3 | + death | No reproduction | None/constant | Selection viability |
| E4 | + reproduction | No mutation | Constant | Inheritance/selection |
| E5 | + mutation | Yes | Constant | Evolution/diversity |
| E6 | Full MFM | Yes | Error-modulated | Stability–plasticity |
| E7 | Full MFM | Yes | Error-modulated | A→B→A continual learning |
| E8 | Full MFM | Yes | Error-modulated | Gradual drift |
| E9 | Full MFM | Yes | Error-modulated | Damage/regeneration |

Each row must be accompanied by its matched ablations and external baselines before interpretation.

---

# 24. Recommended Order of Execution

## Phase A — Simulator validation

Before any scientific claims:

1. verify state invariants;
2. verify synchronous semantics;
3. verify deterministic replay;
4. verify charge bounds;
5. verify population cap;
6. verify protected interfaces;
7. verify offspring initialization;
8. verify output/error causality.

## Phase B — Mechanistic sweep

Map stable parameter regimes before optimization.

Primary outputs:

- extinction map;
- saturation map;
- charge branching map;
- spatial-organization map;
- task-performance map.

## Phase C — Computational characterization

Measure memory, separation, effective dimension and nonlinear capacity in the non-evolving medium.

## Phase D — Evolutionary characterization

Introduce health, death, reproduction and mutation one mechanism at a time.

## Phase E — Continual adaptation

Activate global error pressure and test stationary, abrupt, gradual and recurrent regimes.

## Phase F — Robustness

Run damage and stochastic-perturbation tests.

## Phase G — Matched comparison

Compare the best fully specified CEPC regime with ESN, RNN, strong particle-reservoir and evolutionary controls under matched compute budgets.

Only after Phase G should Stage VII paradigm-level interpretation begin.

---

# 25. Go / No-Go Criteria

The project should be reconsidered or the hypothesis narrowed if any of the following occurs robustly across seeds:

1. The non-evolving medium has no measurable temporal computational capacity in stable regimes.
2. Viable populations exist only in an extremely narrow, unstable parameter region.
3. Performance improvements are entirely explained by readout retraining.
4. Local cycle success is unrelated or negatively related to useful task contribution.
5. Evolution is statistically indistinguishable from neutral demographic drift.
6. Mutation produces only noise or monoculture collapse across the useful regime.
7. Global error modulation consistently causes extinction or uncontrolled oscillation without a useful stability–plasticity window.
8. Continual adaptation provides no measurable advantage over matched fixed reservoirs in the domain claimed for CEPC.
9. Damage recovery is absent despite sufficient surviving computational structure.
10. Observed benefits vanish when compute budget rather than particle count is matched.

These outcomes are scientifically valid and should lead to model revision rather than post hoc mechanism additions.

---

# 26. Positive Evidence Required for a Strong Claim

A strong result should establish a causal chain rather than isolated benchmark wins:

\[
\text{local rule}
\rightarrow
\text{collective organization}
\rightarrow
\text{computational representation}
\rightarrow
\text{task performance}
\rightarrow
\text{selection}
\rightarrow
\text{structural adaptation}
\rightarrow
\text{continual benefit}.
\]

The strongest evidence would combine:

- reproducible computation in the fixed medium;
- measurable nonlinear temporal capacity;
- nontrivial spatial organization;
- nonrandom differential survival;
- genotype redistribution;
- correspondence between local success and future functional contribution;
- faster adaptation under changing tasks;
- retention of previous task competence;
- recovery after structural damage;
- and advantages that survive matched compute comparisons.

No single metric is sufficient.

---

# 27. Expected Outcome Classes

Stage IV should classify results into one of five broad outcomes.

### Class I — No computation

The medium fails before evolution becomes relevant.

### Class II — Computational particle medium

The non-evolving substrate computes useful temporal functions, but evolution gives little additional benefit.

### Class III — Evolving computational medium

Evolution reproducibly improves or reorganizes computation under some tasks.

### Class IV — Continually adaptive computational medium

The evolving medium demonstrates a measurable advantage under nonstationary environments while retaining stability.

### Class V — Distinct adaptive computational primitive

The full causal programme is supported against strong matched baselines, including evidence that the computational object is the evolving organization itself rather than a disguised optimizer or a conventional reservoir with incidental turnover.

Only Class V would justify serious paradigm-level claims in Stage VII.

---

# 28. Relationship to Existing Evidence

This protocol treats established reservoir-computing and continual-learning metrics as measurement tools, not as evidence that CEPC satisfies the corresponding theoretical assumptions. In particular, memory-capacity results are interpreted conditionally on the measured state representation, and continual-learning metrics are adapted to a system whose internal structure changes through birth/death/evolution rather than gradient updates.


Reservoir computing research provides the conceptual basis for measuring memory, separation, nonlinear processing and linear-readout performance. Dambre et al. formalized information-processing capacity for dynamical systems, while later work established universality results for suitable fading-memory reservoir families. citeturn524425search1turn524425academia60turn524425academia59

Physical reservoir computing demonstrates that unconventional dynamical substrates can perform temporal computation. In particular, Wang and Cichos demonstrated a physical reservoir based on synthetic active particles and evaluated chaotic-series prediction including Mackey–Glass and Lorenz, making a strong particle-reservoir control scientifically necessary for CEPC. citeturn524425search0

Continual-learning research emphasizes that adaptation, forgetting, transfer and resource use must be evaluated together. These concepts are adopted here but translated to the specific dynamics of a continuously evolving particle population. citeturn770953academia39turn770953academia38

---

# 29. Deliverable of Stage IV

Stage IV is complete when the project has a versioned experimental specification containing:

1. exact MFM version and semantics;
2. frozen benchmark definitions;
3. parameter ranges and normalized groups;
4. experimental ladder;
5. mandatory ablation matrix;
6. baseline set;
7. readout protocol;
8. continual-learning protocol;
9. damage protocol;
10. metrics;
11. statistical analysis plan;
12. compute-budget accounting;
13. reproducibility requirements;
14. go/no-go criteria.

No experimental implementation should be considered scientifically final until these items are fixed.

---

# 30. Stage IV Final Interpretation

Stage IV transforms the project from a collection of mechanisms into a falsifiable experimental programme.

The central test is not whether a sufficiently large particle population can fit a benchmark. The test is whether the combination of local dynamics and endogenous structural change creates a computational substrate with properties that cannot be reduced to:

\[
\text{ordinary fixed reservoir}
\]

plus

\[
\text{external evolutionary optimization}
\]

or

\[
\text{readout retraining alone}.
\]

The most important experiments are therefore the mechanism ladder, matched ablations, frozen-readout continual learning, A→B→A recurrence, damage recovery and compute-matched external baselines.

The scientific burden increases with every stronger claim:

\[
\boxed{
\text{computation}
\;<\;
\text{organization}
\;<\;
\text{evolutionary improvement}
\;<\;
\text{continual advantage}
\;<\;
\text{new computational paradigm}
}
\]

The project should only move to Stage VII after the empirical evidence has earned the corresponding claim.

---

# References

1. Dambre, J., Verstraeten, D., Schrauwen, B., & Massar, S. (2012). Information Processing Capacity of Dynamical Systems. *Scientific Reports*, 2, 514. https://doi.org/10.1038/srep00514
2. Grigoryeva, L., & Ortega, J.-P. (2018). Echo State Networks are Universal. arXiv:1806.00797. https://arxiv.org/abs/1806.00797
3. Grigoryeva, L., & Ortega, J.-P. (2017/2018). Universal discrete-time reservoir computers with stochastic inputs and linear readouts using non-homogeneous state-affine systems. arXiv:1712.00754. https://arxiv.org/abs/1712.00754
4. Wang, X., & Cichos, F. (2024). Harnessing synthetic active particles for physical reservoir computing. *Nature Communications*, 15, 774. https://doi.org/10.1038/s41467-024-44856-5
5. Díaz-Rodríguez, N., Lomonaco, V., Filliat, D., & Maltoni, D. (2018). Don't forget, there is more than forgetting: new metrics for Continual Learning. arXiv:1810.13166. https://arxiv.org/abs/1810.13166
6. De Lange, M., Aljundi, R., Masana, M., Parisot, S., Jia, X., Leonardis, A., Slabaugh, G., & Tuytelaars, T. (2019). A continual learning survey: Defying forgetting in classification tasks. arXiv:1909.08383. https://arxiv.org/abs/1909.08383
7. Wang, L., Zhang, X., Su, H., & Zhu, J. (2023). A Comprehensive Survey of Continual Learning: Theory, Method and Application. arXiv:2302.00487. https://arxiv.org/abs/2302.00487
