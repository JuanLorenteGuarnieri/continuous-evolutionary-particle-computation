# Continuous Evolutionary Particle Computation

## Mathematical Analysis of the Minimal Formal Model v3

---

## 1. Objective

The purpose of this document is to identify the mathematical conditions under which the Minimal Formal Model (MFM v3) is:

1. well-defined;
2. bounded;
3. non-explosive in charge and population;
4. dynamically viable rather than generically extinct or saturated;
5. capable of maintaining useful spatial organization;
6. capable of preserving task-relevant information;
7. capable of changing its computational organization through evolution.

The crucial methodological rule is to distinguish:

\[
\boxed{\text{proved property}}
\neq
\boxed{\text{sufficient condition}}
\neq
\boxed{\text{empirical hypothesis}}.
\]

---

# 2. Mathematical Nature of the Model

The system is not a fixed-dimensional ordinary differential equation. It is a stochastic discrete-time hybrid population process:

\[
\mathcal P_{n+1}
=
\mathcal F(\mathcal P_n,u_n,E_{n-1},\xi_n).
\]

The population cardinality \(N_n\) changes through discrete birth/death events, while particle positions and velocities evolve through second-order mechanical dynamics.

A natural decomposition is

\[
\mathcal P_n=(V_n,X_n,V_n^{vel},H_n,Q_n,C_n,L_n,G_n),
\]

with variable node set \(V_n\).

This variable-cardinality state space is one reason classical fixed-reservoir theorems cannot be invoked directly.

---

# 3. Well-Posedness

A sufficient baseline set of conditions is:

\[
0<m_{min}\le m_i\le m_{max}<\infty,
\]

\[
0<\gamma_{min}\le\gamma_i\le\gamma_{max}<\infty,
\]

\[
|S_{ij}^{spatial}|\le S_{max}<\infty,
\]

\[
R_{s,min}>0,
\qquad
R_{s,max}<\infty,
\]

\[
A_i\in[A_{min},A_{max}],
\qquad
0<A_{min}A_{max}<\infty,
\]

and finite \(K_{max}\), \(Q_{in}^{max}\), \(Q_{max}\) if explicit charge saturation is used.

Under these bounds, each finite population state defines finite force sums because every particle has a bounded interaction radius and the population itself is bounded.

However, boundedness of each instantaneous force does not by itself guarantee bounded velocity over arbitrarily many timesteps; that requires a discrete-time stability condition.

---

# 4. Discrete Mechanical Stability

The velocity update is

\[
\mathbf v_{n+1}
=
\left(1-\frac{\gamma\Delta t}{m}\right)\mathbf v_n
+
\frac{\Delta t}{m}\mathbf F_n.
\]

Define

\[
a_i=1-\frac{\gamma_i\Delta t}{m_i}.
\]

For the damped homogeneous component to be non-expansive in one step, a sufficient condition is

\[
|a_i|\le1,
\]

which gives

\[
0\le\frac{\gamma_i\Delta t}{m_i}\le2.
\]

For strictly dissipative behavior away from sign oscillation, the stronger practical condition

\[
0<\frac{\gamma_i\Delta t}{m_i}<1
\]

is preferable.

With bounded force \(\|F_i^n\|\le F_{max}\), one obtains the scalar bound

\[
\|v_i^n\|
\le
|a_i|^n\|v_i^0\|
+
\frac{\Delta t}{m_i}
F_{max}
\sum_{k=0}^{n-1}|a_i|^k.
\]

If \(|a_i|<1\), then

\[
\boxed{
\sup_n\|v_i^n\|
\le
\|v_i^0\|
+
\frac{\Delta t F_{max}}{m_i(1-|a_i|)}
}
\]

for the simplified bounded-force comparison system.

This is a sufficient boundedness result, not a full stability theorem for the interacting population.

---

# 5. Spatial Force Bound

Because

\[
0\le w(d;R)\le1
\]

and

\[
|S_{ij}^{spatial}| S_{max},
\]

if the number of spatial neighbors satisfies

\[
|\mathcal N_i^s(n)|\le N_{max}-1,
\]

then

\[
\boxed{
\|F_i^n\| (N_{max}-1)S_{max}.
}
\]

A sharper bound can be derived if particle density is bounded by \(\rho_{max}\):

\[
|\mathcal N_i^s|
\lesssim
\rho_{max}\pi(R_s^{eff})^2,
\]

which yields a local-density-dependent force bound.

The unnormalized force sum makes density itself a dynamical control variable.

---

# 6. Charge Branching Analysis

Suppose particle \(i\) processes one threshold packet and outputs

\[
q_i^{out}=A_i\theta_i.
\]

Let the expected number of selected targets be \(\kappa_i\le K_i\), and let \(p_{ij}^{surv}\) denote the probability that a transmitted charge eventually causes a threshold-crossing event in descendants in the next generation of the effective propagation process.

A first-order branching approximation is

\[
\mathcal R_q
\approx
\mathbb E[A_i\theta_i\kappa_i p_{eff}/\theta_{eff}],
\]

where \(p_{eff}\) summarizes attenuation, decay, target availability and threshold mismatch.

The qualitative regimes are:

\[
\mathcal R_q<1
\Rightarrow
\text{subcritical propagation},
\]

\[
\mathcal R_q\approx1
\Rightarrow
\text{critical propagation},
\]

\[
\mathcal R_q>1
\Rightarrow
\text{supercritical propagation / possible runaway}.
\]

This quantity is an approximation because spatial correlations and finite population effects violate the independent branching assumptions.

The experimental programme should therefore estimate an empirical branching ratio rather than rely only on analytic approximation.

---

# 7. Necessary Charge Controls

At least one of the following is required for long-run boundedness:

1. bounded output charge;
2. finite charge decay \(\delta_q>0\);
3. bounded amplification \(A\le A_{max}\);
4. finite target count \(K\le K_{max}\);
5. finite per-particle storage \(q\le Q_{max}\).

The MFM already imposes bounded \(A\), \(K\), and positive decay, but an explicit \(Q_{max}\) is recommended if simulation demonstrates rare-event accumulation.

A useful theorem target is:

> **Proposition 1.** Under bounded input, finite \(N_{max}\), bounded \(A\), bounded \(K\), and the explicit charge cap, the expected total charge remains bounded.

A proof will require an explicit inequality on the induced branching operator.

---

# 8. Health Dynamics and Individual Survival

Health satisfies

\[
H_i^{n+1}
=
\operatorname{clip}
(H_i^n+\beta_iR_i^n-\lambda_iP_n,0,H_{max,i}).
\]

Ignoring clipping for analysis, the expected drift is

\[
\mathbb E[\Delta H_i]
=
\beta_i\Pr(R_i=1)-\lambda_i\mathbb E[P].
\]

Therefore a necessary condition for positive long-run expected health drift is

\[
\boxed{
\beta_i\Pr(R_i=1)
>
\lambda_i\mathbb E[P]
}
\]

for a genotype to persist.

Conversely,

\[
\beta_i\Pr(R_i=1)
<
\lambda_i\mathbb E[P]
\]

implies negative expected drift before saturation effects.

This gives an explicit interpretation of genotype fitness:

\[
\boxed{
\text{fitness depends on the probability of completing a useful local computational cycle.}
}
\]

---

# 9. Population Viability

Let

\[
B_n
\]

be births and

\[
D_n
\]

be deaths.

Then

\[
N_{n+1}=N_n+B_n-D_n,
\]

subject to

\[
N_n\le N_{max}.
\]

A nontrivial stationary regime requires approximately

\[
\boxed{
\mathbb E[B_n]\approx\mathbb E[D_n].
}
\]

If

\[
\mathbb E[B_n]<\mathbb E[D_n]
\]

persistently, extinction is expected.

If births dominate until saturation, the system becomes capacity-limited and may stop evolving.

Therefore useful computation is expected to occur in an intermediate population-turnover regime.

---

# 10. Reproduction Pressure

Let \(p_m\) be mating-event probability for an eligible pair. If local pair density is \(\rho_m\), a crude mean-field birth rate can be written

\[
B_n
\approx
p_m\rho_mV_n\Delta t.
\]

This is only a first-order approximation because candidate pairs overlap and local correlations are strong.

The important theoretical point is that reproduction is not free: finite population capacity creates competition for open slots.

---

# 11. Evolutionary Dynamics

Let \(n_g(n)\) be the number of particles associated with genotype class \(g\). Then

\[
n_g(n+1)
=
n_g(n)+B_g(n)-D_g(n)+M_g(n),
\]

where \(M_g\) represents mutation and recombination flow.

An approximate frequency equation is

\[
p_g(n+1)
\approx
\frac{p_g(n)w_g(n)}{\sum_h p_h(n)w_h(n)},
\]

with effective fitness

\[
w_g(n)
\approx
\Pr(R=1\mid g,\text{environment})
\]

modulated by the health-pressure regime.

Unlike a classical static genetic algorithm, \(w_g\) is endogenous:

\[
w_g=w_g(\text{population},\text{space},\text{task},n).
\]

---

# 12. Charge–Geometry Positive Feedback

The frozen MFM v3 charge-to-range relation is

\[
oxed{R_s^{eff}(q)=R_{s,min}+(R_{s,max}-R_{s,min})rac{q}{Q_{max}}}.
\]

It is linear, monotone and bounded on the allowed charge interval. Hence

\[
rac{dR_s^{eff}}{dq}=rac{R_{s,max}-R_{s,min}}{Q_{max}}.
\]

Nonlinear/saturating mappings are reserved for later ablations.

# 13. Mechanical Energy Considerations

Because forces are not necessarily reciprocal, the total mechanical energy does not generally correspond to a conserved potential-energy system.

Define kinetic energy

\[
K_n=\sum_i\frac12m_i\|v_i^n\|^2.
\]

Damping removes energy approximately as

\[
\Delta K_{damp}
\sim
-\sum_i\gamma_i\|v_i\|^2\Delta t.
\]

Nonreciprocal forces can inject or remove collective energy without a global scalar potential.

Therefore a conventional Lyapunov function based only on mechanical potential + kinetic energy is not automatically available.

A more promising route is a dissipativity inequality of the form

\[
V_{n+1}-V_n
\le
-\alpha\|v_n\|^2+
\sigma(\|u_n\|,\|\xi_n\|)
\]

for a carefully chosen composite storage function \(V\).

This is a research target, not an established result.

---

# 14. Spatial Phases

Several qualitatively distinct regimes are expected:

### Dispersed

\[
\rho(x,t)\approx\text{uniform and low correlation}.
\]

### Clustered

Strong local attraction creates persistent high-density regions.

### Fragmented

Repulsion dominates, producing disconnected neighborhoods.

### Dynamic coherent

Clusters, waves or moving structures persist without reaching a static equilibrium.

The last regime is particularly interesting for computation because dynamic structures can carry information.

Relevant measurements include pair-correlation \(g(r)\), structure factor \(S(k)\), cluster-size distributions and autocorrelation times.

---

# 15. Computational State and Memory

The complete state can be decomposed conceptually as

\[
S_n=(X_n,V_n,H_n,Q_n,C_n,L_n,G_n).
\]

Potential memory channels are:

\[
M_Q,
\quad M_X,
\quad M_H,
\quad M_G.
\]

Unlike a fixed reservoir, \(G_n\) changes slowly through birth/death and mutation.

Therefore a more appropriate decomposition is

\[
X_n=X_n^{fast},
\qquad
G_n=G_n^{slow}.
\]

A useful memory analysis should estimate

\[
I(u_{n-\tau};S_n)
\]

and separately

\[
I(u_{n-\tau};G_n).
\]

The second quantity measures possible long-term structural memory.

---

# 16. Classical Fading Memory Is Not Assumed

For a fixed reservoir, fading memory often means that sufficiently old inputs have diminishing influence on the current state.

For CEPC, long-lived genotypes and spatial structures may intentionally retain information across long timescales.

Thus the correct research question is not

\[
\text{Does all memory fade?}
\]

but rather

\[
\boxed{
\text{Can fast state variables exhibit fading memory while slow structural variables retain useful adaptation?}
}
\]

This suggests a multiscale memory decomposition rather than direct application of the echo-state property to the complete evolving population.

---

# 17. Separation Property

Let

\[
\Phi_n:
(u_{0:n},\mathcal P_0)
\rightarrow Z_n
\]

be the observable representation available to the output layer.

A useful computational reservoir requires that distinct task-relevant histories map sufficiently often to distinguishable observables.

For a practical readout, a statistical condition is more useful than global injectivity:

\[
\operatorname{Var}(Z_n\mid u_{0:n})
\text{ should be low enough for decoding,}
\]

while

\[
\operatorname{Var}(Z_n\mid\text{different relevant histories})
\text{ should remain sufficiently separated.}
\]

There is currently no general theorem establishing this for MFM v3.

---

# 18. Information Processing Capacity

Dambre et al. define capacity measures for dynamical systems based on their ability to reconstruct target functions from system states [3].

For CEPC, capacity experiments should include:

\[
\text{linear delay},
\]

\[
\text{XOR/parity},
\]

\[
\text{nonlinear memory},
\]

\[
\text{NARMA},
\]

and chaotic prediction.

Capacity should be measured both before and after evolution.

The key comparison is not only

\[
C_{evolved}>C_{fixed},
\]

but whether the difference remains after matching particle count and computational cost.

---

# 19. Local Credit-Assignment Problem

The fundamental unresolved theoretical issue is:

\[
\boxed{
\text{Does local cycle completion correlate with task-level usefulness?}
}
\]

The algorithm uses

\[
R_i^n=\mathbf1[receive+process+transmit]
\]

but the ideal counterfactual contribution would resemble

\[
\Delta_i
=
L(\text{without }i)-L(\text{with }i).
\]

The latter is computationally expensive and is **not** part of the algorithm. It is a diagnostic quantity for experiments.

A strong result would show positive association

\[
\operatorname{corr}(R_i,\Delta_i)>0
\]

or an appropriate rank correlation in realistic tasks.

If the correlation is weak, the survival rule is not a credible credit-assignment mechanism.

---

# 20. Stability–Plasticity Analysis

Global pressure is

\[
P(E)=P_{min}+(P_{max}-P_{min})E^\gamma.
\]

Three regimes should be investigated:

### Underplastic

\[
P\approx P_{min}
\]

and adaptation is too slow.

### Functional

\[
P\approx P^*
\]

where useful structure persists while new variants can replace obsolete ones.

### Overplastic

\[
P\approx P_{max}
\]

and turnover destroys useful structures faster than evolution can preserve them.

The central hypothesis is

\[
\boxed{
L(P)\text{ has an interior minimum at }P^*.
}
\]

This must be measured experimentally.

---

# 21. Continual Learning

For task sequence

\[
A\rightarrow B\rightarrow A,
\]

define first acquisition time \(T_A^{first}\) and reacquisition time \(T_A^{return}\).

A meaningful adaptive-memory result is

\[
\boxed{
T_A^{return}<T_A^{first}.
}
\]

However, reacquisition alone is not enough. One should also measure performance on task B after returning to A to quantify catastrophic forgetting.

Useful metrics include forward transfer, backward transfer and area-under-performance-curve during adaptation.

---

# 22. Evolutionary Diversity

Let \(p_g\) denote genotype frequencies. Genetic diversity can be measured by Shannon entropy

\[
H_G=-\sum_gp_g\log p_g.
\]

One can separately measure phenotypic diversity and functional diversity.

A monoculture

\[
H_G\rightarrow0
\]

is not necessarily bad if one genotype dominates for good scientific reasons. But persistent diversity would support the hypothesis of ecological specialization.

---

# 23. Damage Recovery

After training, remove a fraction \(\rho_d\) of internal particles:

\[
\mathcal P^\star
\rightarrow
\tilde{\mathcal P}.
\]

Define task degradation

\[
\Delta L=L(\tilde{\mathcal P})-L(\mathcal P^\star)
\]

and recovery time

\[
T_{rec}.
\]

A strong distributed-computation signature is

\[
\Delta L\text{ finite and }T_{rec}<\infty
\]

without restoring the deleted particles exactly.

---

# 24. Extinction and Saturation Boundaries

Important dimensionless ratios include:

\[
\chi_{birth-death}
=
\frac{\mathbb E[B]}{\mathbb E[D]},
\]

\[
\chi_{charge}
=\mathcal R_q,
\]

and

\[
\chi_{turnover}
=
\frac{\text{births+deaths per unit time}}
{N}.
\]

Expected qualitative regimes:

\[
\chi_{birth-death}<1
\Rightarrow
\text{extinction pressure},
\]

\[
\chi_{birth-death}\approx1
\Rightarrow
\text{demographic homeostasis},
\]

\[
\chi_{birth-death}>1
\Rightarrow
\text{saturation pressure}.
\]

---

# 25. Minimal Proof Programme

The mathematical programme should proceed in the following order.

### Proposition A — Finite-step well-posedness

Given bounded input, a finite population, admissible genes and finite neighborhoods, one update step is finite and defined.

### Proposition B — Mechanical boundedness

Under a damping/timestep condition and bounded force, velocities remain bounded.

### Proposition C — Charge non-explosion

Under bounded amplification/targets and sufficient decay, total charge remains bounded.

### Proposition D — Population non-explosion

Trivial under the hard cap:

\[
N_n\le N_{max}.
\]

### Proposition E — Conditions for non-extinction

Derive sufficient inequalities relating expected local-cycle completion and error pressure.

### Proposition F — Stable turnover regime

Identify parameter regimes where expected births and deaths balance.

### Proposition G — Multiscale memory

Characterize fast charge/motion memory versus slow genotype/population memory.

### Proposition H — Computational separation

Determine sufficient empirical or analytical conditions under which task-relevant histories remain distinguishable.

Universal approximation should be considered only after these steps.

---

# 26. Main Failure Modes to Test

## Charge runaway

\[
\mathcal R_q>1.
\]

## Charge starvation

\[
\mathcal R_q\ll1.
\]

## Spatial collapse

Most particles form one cluster.

## Spatial fragmentation

Communication graph loses giant connected structure.

## Death spiral

Low health increases movement, movement destroys useful contacts, and mortality accelerates.

## Reproductive explosion

Too many candidate births push the system to \(N_{max}\) constantly.

## Genetic monoculture

One phenotype eliminates potentially useful specialization.

## Neutral drift without learning

Genetic diversity changes but task performance does not.

## Survival hacking

Particles maximize local cycle completion while contributing little to task performance.

## Catastrophic forgetting

Adaptation to a new task destroys previously useful organization.

---

# 27. Empirical Quantities Required for Validation

At minimum record:

### Task

- loss;
- accuracy or prediction error;
- adaptation time;
- reacquisition time.

### Charge

- total charge;
- activation rate;
- empirical branching ratio;
- charge lifetime.

### Population

- \(N_t\);
- birth/death rate;
- genotype entropy;
- lineage depth.

### Spatial

- density field;
- pair correlation;
- cluster statistics;
- graph degree;
- connected components;
- modularity.

### Dynamics

- velocity distribution;
- autocorrelation time;
- perturbation sensitivity;
- effective turnover.

### Information

- mutual information with delayed inputs;
- transfer entropy where appropriate;
- nonlinear information-processing capacity.

---

# 28. Interpretation of a Positive Result

A convincing result would not be simply

\[
L<\text{baseline}.
\]

It would be a chain of evidence:

\[
\boxed{
\text{local dynamics}
\rightarrow
\text{emergent structure}
\rightarrow
\text{differential persistence}
\rightarrow
\text{evolution}
\rightarrow
\text{improved task adaptation}.
}
\]

The final causal link should be tested through ablation.

---

# 29. Current Theoretical Status

### Strongly specified

- discrete-time state;
- bounded genotype domains;
- charge threshold and multiplicative processing;
- synchronous causal transmission;
- bounded charge-dependent spatial range;
- asymmetric local forces;
- second-order mechanical integration;
- local survival signal;
- reproduction and mutation;
- population cap;
- fixed I/O interface.

### Sufficient conditions identified but not yet proved globally

- mechanical boundedness;
- charge boundedness;
- non-extinction;
- non-saturation;
- stable turnover.

### Open hypotheses

- useful local credit assignment;
- computational advantage of charge-to-range coupling;
- spontaneous functional specialization;
- evolutionary improvement;
- continual-learning advantage;
- distributed regeneration.

---


# 30. Stage III Master Theoretical Synthesis

Stage III closes the current theoretical programme at four linked levels: (A) well-posedness and boundedness, (B) population/evolutionary dynamics, (C) computational dynamics, and (D) stability–plasticity/continual adaptation.

## 30.1 A precise state decomposition

Write the global state as

\[
S_n=(X_n,V_n,H_n,Q_n,C_n,L_n,G_n,V_n^{pop}),
\]

where the variable node set is part of the state. For analysis it is useful to project this into

\[
S_n=(X_n^{fast},Y_n^{slow}),
\]

where X contains charge and fast mechanical variables and Y contains health, population composition, spatial organization and genotype frequencies. This does not imply a rigorous singular-perturbation theorem yet; it defines the decomposition that Stage IV must measure.

## 30.2 Invariant-state conditions

A sufficient baseline construction is compact/invariant under:

\[
N_n\in\{0,\ldots,N_{max}\},
\]

\[
0\le q_i^n\le Q_{max},
\qquad
0\le H_i^n\le H_{max,i},
\]

bounded genes g_i\in\mathcal G,

\[
\mathbf x_i^n\in\mathbb T^2.
\]

A velocity bound additionally requires stable damping and bounded total force. Thus the explicit charge cap is not cosmetic: it is one of the conditions making the full state space practically bounded.

## 30.3 Charge-activity regimes

Define the empirical charge branching indicator

\[
R_c=\mathbb E[K_iA_ip_{fire,i}].
\]

Then, heuristically,

\[
R_c<1 \Rightarrow \text{subcritical activity},
\]

\[
R_c\approx1 \Rightarrow \text{near-critical activity},
\]

\[
R_c>1 \Rightarrow \text{supercritical activity}.
\]

The boundaries are not mathematically exact because the process has thresholds, finite charge capacity, geometry, correlations and refractory-like effects from residual charge. The correct use is diagnostic and phase-diagram based.

## 30.4 Mechanical stability

For the semi-implicit velocity update,

\[
v_i^{n+1}=a_i v_i^n+b_iF_i^n,
\qquad
 a_i=1-\frac{\gamma_i\Delta t}{m_i}.
\]

Non-expansiveness of the homogeneous part requires |a_i|<=1, giving

\[
0\le\frac{\gamma_i\Delta t}{m_i}\le2.
\]

A practical strictly dissipative region is

\[
0<\frac{\gamma_i\Delta t}{m_i}<1.
\]

With bounded pair force and N_max finite, a finite force bound follows. This provides a route to a global velocity bound for the discrete simulator.

## 30.5 Local survival drift

Ignoring clipping for local reasoning,

\[
\mathbb E[\Delta H_i]
=
\beta_i\rho_i-\lambda_i\mathbb E[P(E)],
\]

where rho_i is the probability of cycle completion. Persistent viability therefore requires positive or near-zero mean health drift in the relevant operating regime.

This yields a direct scientific test: compare survival and reproduction rates across genotypes against their cycle-completion statistics, while separately measuring actual global task contribution. A positive survival/task-correlation is not assumed.

## 30.6 Population equilibrium and turnover

The population identity is

\[
N_{n+1}=N_n+B_n-D_n
\]

with a hard cap. Mean viability requires

\[
\mathbb E[B_n]-\mathbb E[D_n]\approx0.
\]

If deaths dominate persistently, extinction follows. If births dominate persistently, capacity saturation suppresses further structural change. Hence an adaptive operating regime is expected between these extremes.

## 30.7 Evolutionary selection is endogenous

For genotype class g,

\[
n_g^{n+1}=n_g^n+B_g^n-D_g^n+M_g^n.
\]

A mean-field frequency approximation has the qualitative form

\[
p_g^{n+1}\propto p_g^n w_g^n,
\]

but

\[
w_g^n=w_g(\text{environment},\text{density},\text{neighbors},\text{spatial position},\text{task regime},n).
\]

Therefore simple replicator equations can at best be approximations. Frequency-dependent selection, spatial assortment, mutation-selection balance and demographic noise are integral to the system.

## 30.8 Computational representation

Let

\[
\Phi_k:(u_{n-k},\ldots,u_n)\mapsto Z_n
\]

be the induced state map, with Z chosen explicitly. The baseline task-facing representation is

\[
Z_n=q_{out,n}.
\]

Internal diagnostic representations may include charges of all particles, spatial coordinates, graph statistics, genotype frequencies and event traces, but these do not count as baseline readout features.

A useful medium requires task-relevant histories to occupy sufficiently distinct regions of the observable state space. This is the separation hypothesis.

## 30.9 Memory hierarchy

Fast memory is expected to decay through charge decay, threshold consumption, damping, and local reconfiguration. Slow memory can persist through population composition, spatial organization and genotype frequencies.

Thus the relevant decomposition is

\[
\boxed{
\text{fast fading memory} + \text{slow structural memory}
}
\]

rather than a claim that the complete adaptive system is a conventional fading-memory reservoir.

A candidate empirical decomposition is

\[
I(u_{n-k};X_n)
\qquad\text{versus}\qquad
I(u_{n-k};G_n).
\]

## 30.10 Separation and effective dimension

Separation should be measured both internally and at the output interface. Candidate diagnostics include pairwise state distances, linear classification accuracy of past classes, covariance-spectrum participation ratio and rank of the output-state matrix.

Low effective dimension can indicate collapse of the medium. Extremely high dimension without task-aligned structure can instead indicate noisy expansion.

The relevant scientific target is not maximal dimension, but sufficient task-relevant dimension per computational cost.

## 30.11 Nonlinear computational capacity

Although the baseline readout is linear, the medium is nonlinear through thresholding, multiplicative charge processing, probabilistic routing, state-dependent neighborhoods and mechanical interactions. This permits a nonlinear feature expansion before linear decoding.

The capability should be decomposed into:

1. linear memory;
2. static nonlinear transformations;
3. nonlinear temporal functions;
4. benchmark dynamical tasks;
5. nonstationary task tracking.

No universal approximation result should be claimed until assumptions sufficient for a theorem are explicitly established.

## 30.12 Stability–plasticity control

Define

\[
P(E)=P_{min}+(P_{max}-P_{min})E^\gamma.
\]

Then

\[
D_i(E)=\lambda_iP(E).
\]

The loop is intentionally negative-feedback-like: large error increases turnover, which creates structural opportunity for new configurations. However, the same mechanism can cause a death spiral if high error destroys the reproductive base faster than useful structure can recover.

The design objective is therefore not monotonic plasticity but a stable response band:

\[
\boxed{
\text{adequate adaptation rate} + \text{retained functional structure} + \text{population viability}
}.
\]

## 30.13 Continual adaptation criteria

For recurring tasks A->B->A, define first-learning and relearning times

\[
T_A^{first},\qquad T_A^{return}.
\]

Evolutionary memory gain can be operationalized as

\[
EMG=1-\frac{T_A^{return}}{T_A^{first}}
\]

with positive values indicating faster reacquisition. This metric must be accompanied by forgetting, because faster return could arise from residual state rather than genuine structural memory.

Forward transfer, backward transfer, task retention and recovery after damage should be measured jointly.

## 30.14 Adaptive stability regimes

The coupled system suggests several qualitative regimes:

- frozen/overstable: turnover too weak;
- adaptive: stable performance with useful reconfiguration;
- oscillatory: repeated over-correction;
- extinction/collapse: death exceeds regeneration;
- monoculture: diversity collapses while population remains viable;
- evolutionary noise: mutation and turnover dominate retained structure.

Stage IV should estimate phase boundaries empirically rather than assuming one universal critical point.

## 30.15 Main unresolved theorem targets

The strongest feasible theoretical targets after Stage III are:

1. finite-step well-posedness under the explicit bounded state constraints;
2. a rigorous velocity bound for the discrete mechanical system;
3. a sufficient charge non-explosion condition beyond the hard-cap construction;
4. population non-extinction conditions for a restricted mean-field model;
5. conditional fading memory for the fast subsystem under fixed structural state;
6. a separation/capacity theorem for a restricted fixed-population submodel;
7. an adiabatic or timescale-separation approximation for slow evolution;
8. conditions for stable continual tracking under slowly varying environments.

These are theorem targets, not results established by Stage III.

## 30.16 Stage III final scientific position

Theoretical analysis now supports the following restrained statement:

> CEPC defines a mathematically explicit, bounded-by-construction candidate adaptive computational medium in which a fast stochastic dynamical substrate is coupled to slower demographic and evolutionary restructuring. The architecture contains identifiable mechanisms for memory, nonlinear transformation, spatial organization, selection and continual adaptation, but none of the corresponding computational advantages is established without Stage IV–VI experiments and, where possible, restricted mathematical proofs.

# References

1. Jaeger, H. (2001). *The Echo State Approach to Analysing and Training Recurrent Neural Networks*. GMD Report 148.
2. Maass, W., Natschläger, T., & Markram, H. (2002). Real-time computing without stable states. *Neural Computation*, 14(11), 2531–2560. https://doi.org/10.1162/089976602760407955
3. Dambre, J., Verstraeten, D., Schrauwen, B., & Massar, S. (2012). Information processing capacity of dynamical systems. *Scientific Reports*, 2, 514. https://doi.org/10.1038/srep00514
4. Stepney, S. (2024). Physical reservoir computing: A tutorial. *Natural Computing*, 23, 665–685. https://doi.org/10.1007/s11047-024-09997-y
5. Wang, X., & Cichos, F. (2024). Harnessing synthetic active particles for physical reservoir computing. *Nature Communications*, 15, 774. https://doi.org/10.1038/s41467-024-44856-5
6. Mordvintsev, A., Randazzo, E., Niklasson, E., & Levin, M. (2020). Growing Neural Cellular Automata. *Distill*, 5(2), e00023. https://doi.org/10.23915/distill.00023
7. Pajouheshgar, E., Kim, H., Süsstrunk, S., Jakob, W., & Park, J. (2026). Neural Particle Automata: Learning Self-Organizing Particle Dynamics. *SIGGRAPH 2026*. https://doi.org/10.1145/3799902.3811052
8. Li, J., Bauer, R., Rentzeperis, I., & van Leeuwen, C. (2024). Adaptive rewiring: A general principle for neural network development. *Frontiers in Network Physiology*, 4, 1410092. https://doi.org/10.3389/fnetp.2024.1410092
9. Holtmaat, A., & Svoboda, K. (2009). Experience-dependent structural synaptic plasticity in the mammalian brain. *Nature Reviews Neuroscience*, 10, 647–658. https://doi.org/10.1038/nrn2699
10. Ofria, C., & Wilke, C. O. (2004). Avida: A software platform for research in computational evolutionary biology. *Artificial Life*, 10(2), 191–229. https://doi.org/10.1162/106454604773563612
11. Lenski, R. E., Ofria, C., Pennock, R. T., & Adami, C. (2003). The evolutionary origin of complex features. *Nature*, 423, 139–144. https://doi.org/10.1038/nature01568
12. Klapp, S. H. L. (2023). Non-reciprocal interaction for living matter. *Nature Nanotechnology*, 18, 8–9. https://doi.org/10.1038/s41565-022-01268-0
13. Shi, Y.-B., Moessner, R., Alert, R., et al. (2026). Hamiltonian description of non-reciprocal interactions. *Nature Physics*, 22, 1350–1359. https://doi.org/10.1038/s41567-026-03317-0

---

## Research-status statement

This document is a theoretical analysis of a proposed model. The equations define hypotheses and sufficient-condition targets; they are not evidence that the full architecture is computationally effective. Claims of computational superiority, universality, continual-learning benefit or biological relevance require controlled experiments.
