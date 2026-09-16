# Continuous Evolutionary Particle Computation (CEPC)

## Technical Research Framework v4

### A continuously active, self-organizing, evolvable particle-based computational paradigm

---

## Abstract

This document specifies a research programme for a proposed computational paradigm in which computation is implemented by a continuously active spatial population of simple interacting particles. The central hypothesis is that useful temporal computation can emerge from local information exchange, mechanical self-organization, differential survival, and hereditary population turnover, without embedding conventional neural networks inside individual particles and without requiring a fixed recurrent graph.

The framework intentionally separates four levels of description. **Genotype** contains immutable lifetime characteristics inherited at birth. **Dynamic state** contains position, velocity, health, charge and short interaction history. **Population structure** comprises the variable set of active particles, their spatial organization and effective communication graph. **Task-level adaptation** is represented by a scalar global performance signal that modulates the rate of structural turnover but does not directly assign credit to individual particles.

The current model is deliberately conservative. External inputs are quantized into integer charge. Charge accumulates until a particle reaches a genetic activation threshold. One activation packet is processed per timestep by multiplication with a genetic transformation factor and transmitted probabilistically to nearby targets selected according to genetically encoded communication preferences. Successful completion of the cycle receive–process–transmit yields a fixed local health reward. Health loss increases with global task error, causing low-performing regimes to undergo greater turnover. Particles move according to second-order mechanical dynamics with bounded, asymmetric pair interactions. Charge modifies spatial behavior indirectly through a bounded effective interaction radius. In the frozen baseline this mapping is linear in normalized charge: the effective spatial range interpolates between fixed lower and upper bounds. Reproduction is local, two-parent, and capacity-limited; descendants recombine parental genotypes and undergo bounded mutation.

The framework does **not** assume that the resulting system satisfies the classical echo-state property, possesses universal approximation guarantees, or necessarily outperforms standard reservoir computers. Those are empirical or theorem-level questions. The central scientific problem is to determine whether population-level organization can become a reusable computational substrate, and whether continuous evolution provides a measurable advantage on nonstationary temporal tasks, robustness to damage, and continual adaptation.

---

# 1. Research Problem

## 1.1 Central hypothesis

Let the computational medium at discrete time step \(n\) be

\[
\mathcal P_n = \{(s_i^n,g_i)\}_{i=1}^{N_n},
\qquad N_n\le N_{\max}.
\]

The central hypothesis is

\[
\boxed{
\text{simple local rules}
\rightarrow
\text{collective dynamics}
\rightarrow
\text{population organization}
\rightarrow
\text{computation}
}
\]

with continuous adaptation

\[
\boxed{
\text{task error}
\rightarrow
\text{global turnover pressure}
\rightarrow
\text{differential survival/reproduction}
\rightarrow
\text{new computational organization}.
}
\]

The system is continuously active. There is no mandatory training/inference boundary:

\[
\text{computation} + \text{adaptation} + \text{evolution}
\]

occur concurrently.

## 1.2 Scientific claim discipline

The following are established precedents, not claims of novelty:

- nonlinear dynamical systems can perform temporal computation and serve as reservoirs [1–3];
- physical substrates can implement reservoir computing [3,4];
- active particles can form nonlinear physical reservoir nodes [5];
- neural cellular automata can self-organize and regenerate [6];
- dynamic particle systems can be trained for self-organization [7];
- neural structure can change through rewiring and structural plasticity [8,9];
- mutation and selection can produce complex digital functions [10,11].

The potentially distinctive hypothesis of CEPC is the **specific coupling** of discrete charge dynamics, spatially mobile interactions, local survival, two-parent hereditary variation, variable-population turnover, and task-level modulation of plasticity. Stage III adds a second key distinction: the substrate should be analysed as a **multiscale adaptive dynamical system**, with fast computational memory and slow structural/evolutionary memory.

---

# 2. Relationship to Existing Computational Paradigms

## 2.1 Reservoir computing

Classical reservoir computing uses

\[
x_{n+1}=F(x_n,u_n),
\qquad
\hat y_n=W_{out}x_n.
\]

CEPC shares the principle that the substrate dynamics perform part of the computation, but the substrate itself is variable:

\[
\mathcal P_{n+1}
=
F(\mathcal P_n,u_n,E_{n-1},\xi_n).
\]

The changing population means that the standard reservoir state-space assumptions cannot simply be transferred to the complete CEPC system.

## 2.2 Liquid-state computation

The system resembles liquid-state computation in that temporally varying inputs perturb a nonlinear high-dimensional medium. However, the substrate is not fixed and the useful computational organization may itself evolve.

## 2.3 Physical reservoir computing

Physical reservoir computing exploits intrinsic material dynamics instead of implementing every nonlinear transformation algorithmically. Wang and Cichos demonstrated prediction of chaotic time series with a synthetic active-particle reservoir, showing that particle-scale dynamics can provide nonlinear temporal computation [5]. CEPC differs by treating population turnover and hereditary adaptation as first-class computational mechanisms rather than merely exploiting fixed physical dynamics.

## 2.4 Neural cellular and particle automata

Growing Neural Cellular Automata demonstrated self-organization and regeneration using local rules [6]. Neural Particle Automata (SIGGRAPH 2026) extend this idea from a fixed lattice to moving particles with dynamic neighborhoods and learned local rules [7]. CEPC should therefore not claim novelty from particles, locality, or self-organization alone. Its proposed distinction is evolutionary: local hereditary variation and differential survival are part of the computational substrate rather than an outer optimization procedure.

## 2.5 Adaptive rewiring and structural plasticity

Adaptive rewiring demonstrates that changing interaction structure can substantially affect network organization [8]. Experience-dependent structural plasticity shows that biological systems can modify connectivity over time [9]. CEPC replaces explicit synapse creation/removal with spatial reorganization plus particle birth/death, producing an implicit dynamic graph.

## 2.6 Digital evolution

Avida and related digital-evolution systems show that mutation, reproduction and selection can generate complex functions [10,11]. CEPC differs in that the evolving object is not an isolated digital program but a spatially coupled population whose phenotype is itself the computational medium.

---

# 3. Architectural Principles

The architecture is governed by seven principles.

1. **Microscopic simplicity.** Individual particles have few state variables and no embedded neural network.
2. **Genetic immutability.** Genotype is fixed during a lifetime.
3. **Locality.** Communication, movement interactions and reproduction are local.
4. **Emergence.** Functional roles are not hard-coded; they may arise from selection.
5. **Distributed survival.** Individual fitness is generated locally from participation in information flow.
6. **Global modulation without direct credit assignment.** Task error changes turnover pressure rather than directly rewarding particular particles.
7. **Continuous operation.** Computation does not stop while adaptation or evolution occurs.

---

# 4. Mathematical Ontology

## 4.1 Genotype

Each particle has

\[
g_i\in\mathcal G,
\]

with

\[
g_i(n)=g_i(n_i^{birth}).
\]

Candidate genotype:

\[
g_i=
(H_{\max},\theta_q,A,K,R_c,m,\gamma,R_s,\omega_1,\omega_2,\omega_3).
\]

The genes have the following roles:

| Gene | Meaning |
|---|---|
| \(H_{\max}\) | maximum health |
| \(\theta_q\) | charge activation threshold |
| \(A\) | multiplicative charge transformation |
| \(K\) | maximum simultaneous transmission targets |
| \(R_c\) | baseline communication range |
| \(m\) | mass |
| \(\gamma\) | mechanical damping |
| \(R_s\) | baseline spatial-interaction range |
| \(\omega_1,\omega_2,\omega_3\) | weights for spatial attraction/repulsion preferences |

The exact feature basis can be expanded only after ablation demonstrates the need.

## 4.2 Dynamic state

\[
s_i(n)=
(\mathbf x_i^n,\mathbf v_i^n,H_i^n,q_i^n,C_i^n,L_i^n).
\]

Here \(C_i^n\) is the set of source identities that sent charge during step \(n\), and \(L_i^n\) is the previous-step source set.

## 4.3 Population state

\[
\mathcal P_n=
\{(s_i^n,g_i):i\in V_n\},
\qquad
|V_n|=N_n\le N_{\max}.
\]

The effective interaction graph is

\[
G_n=(V_n,E_n).
\]

Its node set and edge set are dynamic.

---

# 5. Spatial Domain

The baseline domain is the two-dimensional torus

\[
\Omega=\mathbb T^2,
\]

implemented as a square of side lengths \(L_x,L_y\) with periodic boundaries. The minimum-image displacement is

\[
\Delta x_{ij}=x_j-x_i-L_x\operatorname{round}\left(\frac{x_j-x_i}{L_x}\right),
\]

\[
\Delta y_{ij}=y_j-y_i-L_y\operatorname{round}\left(\frac{y_j-y_i}{L_y}\right),
\]

and

\[
d_{ij}=\sqrt{\Delta x_{ij}^2+\Delta y_{ij}^2}.
\]

Particles are point-like in the minimal model. No hard-core collision law is introduced initially.

The choice removes wall-generated artifacts and makes spatial homogeneity analyzable. Periodic domains are standard in active-matter simulation when bulk behavior is the target of study.

---

# 6. Charge Dynamics

## 6.1 External quantization

For a normalized scalar input \(u_n\in[0,1]\), the minimal encoding is

\[
Q_{in}(u_n)=
\operatorname{round}(Q_{in}^{max}u_n).
\]

The resulting integer charge is injected into fixed input particles.

## 6.2 Accumulation

\[
q_i\in\mathbb Z_{\ge0}.
\]

Let \(r_i^n\) be received charge during step \(n\). Then

\[
q_i^{pre}=q_i^n+r_i^n.
\]

## 6.3 Activation

A particle activates when

\[
q_i^{pre}\ge\theta_{q,i}.
\]

At most one activation occurs per timestep.

## 6.4 Processing

The minimal processing rule is deliberately only multiplicative:

\[
\boxed{
q_i^{out}=A_i\theta_{q,i}
}
\]

so individual particles do not contain arbitrary nonlinear programs.

## 6.5 Residual charge

One threshold packet is consumed:

\[
q_i^{res}=q_i^{pre}-\theta_{q,i}.
\]

Charge decay is then applied:

\[
q_i^{post}=\max(0,q_i^{res}-\delta_{q,i}).
\]

For a non-firing particle,

\[
q_i^{post}=\max(0,q_i^{pre}-\delta_{q,i}).
\]

The decay parameter is a controlled memory timescale.

---

# 7. Communication

## 7.1 Communication neighborhood

The candidate communication neighborhood is

\[
\mathcal N_i^c(n)=
\{j
eq i:d_{ij}\le R_i^c\}.
\]

Initially \(R_i^c=R_{c,i}\), while future extensions may make the effective communication radius state-dependent.

## 7.2 Communication preference

Communication preference is independent from spatial preference. The minimal score is

\[
S_{ij}^{comm}
=
\omega_{i,R}\phi_R(g_j)
+
\omega_{i,A}\phi_A(g_j)
+
\omega_{i,v}\phi_v(g_j),
\]

where \(\phi\) are normalized genetic features.

## 7.3 Probabilistic targeting

Given an activated particle,

\[
P(j\mid i)
=
\frac{\exp(\alpha S_{ij}^{comm})}
{\sum_{k\in\mathcal N_i^c}\exp(\alpha S_{ik}^{comm})}.
\]

At most \(K_i\) targets are selected without replacement.

## 7.4 Charge transmission

For every selected target \(j\),

\[
q_j^{next}
\mathrel{+}=q_i^{out}.
\]

The event also inserts \(i\) into the recipient's next-step source set:

\[
C_j^{next}\leftarrow C_j^{next}\cup\{i\}.
\]

---

# 8. Interaction History

The one-step history is

\[
N_i^n=C_i^n\setminus L_i^n.
\]

The minimal model does not yet use \(N_i^n\) for the survival reward. It is retained as an observable and as a future candidate for anti-loop mechanisms.

This is a deliberate methodological choice: novelty should not be equated with utility without evidence.

---

# 9. Effective Spatial Range and Charge–Geometry Coupling

The baseline explicitly separates communication range from spatial-interaction range. Charge does not alter communication eligibility directly; instead it modulates the spatial neighborhood used by the mechanical interaction.

For bounded charge

\\[
0\\le q_i\\le Q_{max},
\\]

use

\\[
\\boxed{
R_{s,i}^{eff}=R_{s,min}+(R_{s,max}-R_{s,min})\\frac{q_i}{Q_{max}}
}
\\]

so that

\\[
R_{s,min}\\le R_{s,i}^{eff}\\le R_{s,max}.
\\]

This is intentionally the simplest monotone bounded law. A saturating or nonlinear mapping is a later experimental variant, not part of the baseline. The resulting feedback loop is

\\[
q\\rightarrow R_s^{eff}\\rightarrow\\text{neighbors/force}\\rightarrow x,v\\rightarrow\\text{future interactions}\\rightarrow q.
\\]

The feedback is a central source of possible self-organization, but it is not assumed to be stabilizing. Stage III therefore treats runaway positive feedback, spatial collapse and loss of communication as explicit failure modes to test.

# 10. Spatial Interaction Force

## 10.1 Force structure

For \(j\) inside the spatial interaction neighborhood,

\[
\mathbf F_{ij}^n
=
S_{ij}^{spatial}
\,w(d_{ij};R_i^{s,eff})
\,\hat{\mathbf r}_{ij}.
\]

Here

\[
\hat{\mathbf r}_{ij}
=
\frac{\mathbf r_{ij}}
{d_{ij}+\varepsilon}
\]

and

\[
w(d;R)=
\left(1-\frac dR\right)_+.
\]

Thus the force is local, bounded and linearly decaying with distance.

## 10.2 Genetic spatial preference

The minimal preference score is

\[
S_{ij}^{spatial}
=
\omega_{i,R}\phi_R(g_j)
+
\omega_{i,A}\phi_A(g_j)
+
\omega_{i,v}\phi_v(g_j).
\]

Positive score denotes attraction and negative score denotes repulsion.

## 10.3 Nonreciprocity

In general,

\[
S_{ij}^{spatial}
eq-S_{ji}^{spatial},
\]

and therefore

\[
\boxed{
\mathbf F_{ij}
eq-\mathbf F_{ji}
}
\]

in general.

This removes the assumption of Newtonian action–reaction reciprocity. Nonreciprocal interactions are established in active-matter theory as a source of nonequilibrium collective behavior [12,13].

## 10.4 Total force

\[
\mathbf F_i^n
=
\sum_{j\in\mathcal N_i^s(n)}
\mathbf F_{ij}^n.
\]

The baseline model uses an unnormalized sum, so local density affects dynamical intensity.

---

# 11. Mechanical Dynamics

Each non-fixed particle obeys

\[
m_i\dot{\mathbf v}_i
=
\mathbf F_i-\gamma_i\mathbf v_i.
\]

A semi-implicit Euler discretization gives

\[
\mathbf v_i^{n+1}
=
\mathbf v_i^n+
\frac{\Delta t}{m_i}
\left(
\mathbf F_i^n-\gamma_i\mathbf v_i^n
\right),
\]

\[
\boxed{
\mathbf x_i^{n+1}
=
\mathbf x_i^n+
\Delta t\,\mathbf v_i^{n+1}
}
\]

with periodic wrapping in \(\Omega\).

The MFM therefore retains genuine second-order dynamical state rather than directly assigning positions at each step.

---

# 12. Health and Survival

Health satisfies

\[
0\le H_i\le H_{max,i}.
\]

Define cycle completion

\[
R_i^n=
\mathbf 1[
q_i^{pre}\ge\theta_{q,i}
\land
|T_i^n|>0
].
\]

A local success event is therefore exactly

\[
\boxed{
receive\rightarrow process\rightarrow transmit
}
\]

and not merely receiving activity.

Health evolves as

\[
\boxed{
H_i^{n+1}
=
\operatorname{clip}
\left[
H_i^n+
\beta_iR_i^n-
D_i(E_n),
0,H_{max,i}
\right].
}
\]

The minimal model treats \(\beta_i\) as a fixed genetic reward coefficient and initially uses the same global pressure function for all particles:

\[
D_i(E_n)=\lambda_iP(E_n).
\]

---

# 13. Global Performance Modulation

The output is read from fixed output particles:

\[
\hat{\mathbf y}_n
=
W_{out}\mathbf q_{out,n}+\mathbf b.
\]

A task-specific loss is normalized to

\[
E_n\in[0,1].
\]

The global plasticity pressure is

\[
\boxed{
P(E_n)=P_{min}+(P_{max}-P_{min})E_n^\gamma
}
\]

with \(\gamma>0\).

The conceptual regimes are:

\[
E\approx0\Rightarrow\text{low turnover},
\]

\[
E\text{ moderate}\Rightarrow\text{adaptive turnover},
\]

\[
E\approx1\Rightarrow\text{strong turnover pressure}.
\]

The global error does not directly identify which particles are good or bad.

---

# 14. Reproduction and Evolution

## 14.1 Local reproduction condition

A pair \((i,j)\) may reproduce if

\[
d_{ij}\le R_{mate},
\]

\[
H_i\ge H_{mate},
\qquad
H_j\ge H_{mate},
\]

and both particles have recently completed a successful local computational cycle.

## 14.2 Recombination

For gene \(r\), categorical or integer genes can use discrete inheritance:

\[
g_k^{(r)}
=
\begin{cases}
 g_i^{(r)},&\xi_r<1/2,\\
 g_j^{(r)},&\xi_r\ge1/2.
\end{cases}
\]

Continuous genes use interpolation:

\[
g_k^{(r)}
=
\alpha g_i^{(r)}+(1-\alpha)g_j^{(r)}+\epsilon_r,
\qquad
\alpha\sim U(0,1).
\]

## 14.3 Mutation

Continuous genes are perturbed by bounded noise; discrete genes mutate through bounded integer changes. The mutation operator must satisfy

\[
\mathcal M(\mathcal G)\subseteq\mathcal G.
\]

## 14.4 Offspring state

The offspring is born with

\[
q_k=0,
\qquad
C_k=\varnothing,
\qquad
L_k=\varnothing,
\]

\[
H_k=H_{birth},
\]

\[
\mathbf x_k
=\mathbf x_{mid}+\epsilon_x,
\]

\[
\mathbf v_k
=\mathbf v_{mid}+\epsilon_v,
\]

where the midpoint values may be formed from parental states.

No parental health, charge or interaction history is genetically inherited.

## 14.5 Population cap

If

\[
N_n=N_{max},
\]

birth is rejected rather than forcibly replacing another living particle.

---

# 15. Fixed Input/Output Interface

Input particles are immutable in position and protected from normal death.

Output particles are likewise fixed and protected.

The internal population is evolvable.

This creates the architecture

\[
\boxed{
\text{fixed interfaces}
\leftrightarrow
\text{evolving computational medium}
}
\]

without placing a neural network inside the interface.

---

# 16. Exact Synchronous Semantics

The baseline uses synchronous state updates. Every particle reads the same step-n snapshot; all newly generated charge transmissions are buffered for n+1. There are no within-step propagation cascades.

The reference causal order is:

1. quantize and inject external input into protected input particles;
2. deliver transmissions buffered at n-1;
3. record current sender sets;
4. test charge threshold;
5. process at most one threshold packet;
6. select probabilistic communication targets and buffer outgoing charge for n+1;
7. decay the residual unconsumed charge and enforce the hard charge cap;
8. evaluate local cycle completion;
9. read the protected output-particle charges and compute the task error E_n;
10. convert E_n to global pressure and update health toward n+1;
11. compute charge-dependent spatial ranges and pair forces from the step-n snapshot;
12. integrate dynamic particles with the semi-implicit mechanical update;
13. remove particles whose post-update health is nonpositive;
14. evaluate local two-parent reproduction;
15. reject births if population capacity is full;
16. initialize accepted offspring;
17. commit next-state buffers and advance interaction history.

The simulator must use old/new buffers so that results do not depend on particle iteration order. Output and error are causal: E_n can influence only structural state at n+1 and later, never the output that generated E_n.

---

# 17. Stage III Theoretical Closure

Stage III-A through III-D has now fixed the principal baseline assumptions and identified the mathematical properties that can and cannot be asserted at this stage.

## 17.1 Mathematical classification

The complete system is best represented as a stochastic, synchronous, discrete-time hybrid population process

\[
\boxed{
\mathcal P_{n+1}=\mathcal F(\mathcal P_n,u_n,E_n,\xi_n)
}
\]

with variable cardinality, continuous-valued mechanical variables, integer charge, discrete event logic, and birth/death/recombination events. It is not a fixed-dimensional ODE and should not be treated as a conventional fixed reservoir for theoretical purposes.

## 17.2 State hierarchy

The computational state has three practically important timescales:

\[
\boxed{\tau_{charge}\;\ll\;\tau_{demography}\;\lesssim\;\tau_{evolution}}
\]

with a corresponding decomposition into:

- fast dynamical state: charge, recent interaction state, position and velocity;
- demographic state: health, deaths, births and current population configuration;
- structural/evolutionary state: genotype frequencies, spatial organization and emergent interaction topology.

The ordering is a hypothesis to be verified numerically, not an axiom. Parameter choices should permit these timescales to be separated in controlled experiments.

## 17.3 Fixed baseline decisions

The following decisions are frozen for the MFM unless explicitly declared as an ablation or extension:

1. two-dimensional toroidal domain with periodic boundaries;
2. point particles in the minimal model, without hard-core collision physics;
3. integer-valued charge;
4. input quantization by a fixed mapping into integer charge;
5. charge decay when charge is not consumed, providing a short-term forgetting mechanism;
6. one threshold-sized processing packet per particle per timestep at most;
7. processing by multiplicative hereditary factor only;
8. probabilistic local communication with genetically encoded communication preference;
9. communication preference and spatial preference are distinct;
10. spatial force is bounded, local and generally asymmetric;
11. charge changes spatial interaction range rather than entering the force directly;
12. local success is binary receive\rightarrowprocess\rightarrowtransmit cycle completion;
13. novelty is measured but is not used as the baseline utility signal;
14. health receives a fixed positive reward per completed cycle and loses health under global error pressure;
15. global error never labels individual particles as good/bad;
16. reproduction is local two-parent recombination plus bounded mutation;
17. genotypes are immutable during lifetime;
18. input/output particles are fixed and protected from turnover;
19. the output is the charge vector of protected output particles followed by a linear readout;
20. if the population is at capacity, candidate births are rejected rather than replacing an existing particle;
21. synchronous updates use buffered transmissions with one-step causal delay;
22. the charge-to-spatial-range map is bounded and linear in normalized charge;
23. a hard charge cap is part of the minimal bounded model.

## 17.4 Well-posedness and boundedness conditions

Theoretical analysis identifies sufficient design conditions rather than a blanket theorem of global stability.

For mechanical stability a practical condition is

\[
0<\frac{\gamma_i\Delta t}{m_i}<1,
\]

while non-expansiveness of the homogeneous velocity update only requires the weaker range

\[
0\le\frac{\gamma_i\Delta t}{m_i}\le2.
\]

With bounded pair forces and finite population, force sums are bounded. Position is automatically bounded on the torus. A hard upper bound

\[
0\le q_i\le Q_{max}
\]

is required in the baseline because decay alone does not rule out amplification-driven charge explosion.

The approximate charge branching factor

\[
\mathcal R_{charge}\approx\mathbb E[K_iA_ip_{fire,i}]
\]

provides a diagnostic for subcritical, near-critical and supercritical activity. It is an analogy/mean-field indicator, not an exact branching-process identity because thresholds, spatial correlations and saturation couple events.

## 17.5 Population and evolutionary dynamics

For genotype class or phenotype class g,

\[
n_g(n+1)=n_g(n)+B_g(n)-D_g(n)+M_g(n),
\]

where the effective fitness is endogenous:

\[
w_g=w_g(\text{task},\text{space},\text{population},\text{local interactions},n).
\]

The population is viable only in regimes in which births can compensate deaths without permanent saturation. A stationary mean-field condition is approximately

\[
\mathbb E[B_n]\approx\mathbb E[D_n].
\]

The theoretical interpretation of evolution is therefore ecological and frequency-dependent rather than a simple external genetic optimizer.

## 17.6 III-C — Computational dynamics

The fast substrate should be tested for three separable properties:

\[
\boxed{\text{memory} + \text{separation} + \text{nonlinear transformation}}
\]

The readout sees primarily

\[
\mathbf q_{out,n}
\]

and therefore internal variables are only useful to the task insofar as they are observable through the chosen output interface. A linear readout remains the baseline so that nonlinear computation must arise inside the medium rather than from the decoder.

Classical fading-memory and echo-state claims are **not** assumed for the entire evolving population. The relevant hypothesis is conditional fast fading memory under sufficiently controlled structural state, alongside slower structural/evolutionary memory.

## 17.7 III-D — Stability–plasticity and continual adaptation

Stage III-D establishes the central two-layer feedback:

\[
E_n
\rightarrow P_n
\rightarrow D_n
\rightarrow\text{vacancies/turnover}
\rightarrow\text{population restructuring}
\rightarrow\text{new computation}
\rightarrow E_{n+k}.
\]

This mechanism can generate a useful negative feedback, but it can also generate oscillations, extinction spirals, monoculture, or evolutionary noise. Therefore the scientific target is an **adaptive stability regime**, not maximum plasticity and not a generic “edge of chaos” claim.

## 17.8 Two definitions of memory

For a fast observable state X and a structural state G,

\[
I(u_{n-k};X_n)
\]

measures short-lived computational memory, while

\[
I(u_{n-k};G_n)
\]

is a candidate diagnostic for slow structural memory. The long-term state can preserve task history without requiring individual genotype plasticity.

## 17.9 What is still unproven

Stage III does **not** establish:

- useful computation;
- universal approximation;
- global ESP/fading memory of the full adaptive system;
- correlation between local survival and global task contribution;
- guaranteed evolutionary improvement;
- guaranteed coexistence or diversity benefits;
- superior continual learning relative to fixed reservoirs.

Those are Stage IV–VI empirical or stronger theorem-level questions.

## 17.10 Scientific hypotheses passed to Stage IV

H-C1. The non-evolving medium has measurable temporal computational capacity.

H-C2. Charge decay produces finite short-term memory rather than eliminating useful history.

H-C3. Spatial mobility changes computational capacity relative to a static interaction topology.

H-C4. Heterogeneous genotypes can create complementary computational roles.

H-B1. Local cycle completion produces non-neutral selection pressure.

H-B2. Reproduction and mutation can maintain a viable exploratory population without persistent collapse.

H-D1. Global error-modulated turnover creates a useful stability–plasticity regime.

H-D2. Repeated environments exhibit evolutionary memory, measurable by faster reacquisition.

H-D3. Functional diversity can improve adaptation or robustness under changing tasks.

H-D4. Damage can be recovered from faster or more completely in an adaptive medium than in a matched fixed medium.

# 18. Critical Theoretical Questions

The model now supports concrete falsifiable questions.

### 17.1 Charge stability

Define an effective charge branching factor \(\mathcal R_q\). We require a practically stable operating regime with neither uncontrolled charge explosion nor universal extinction.

### 17.2 Spatial stability

The system must avoid generic collapse into one cluster or complete fragmentation.

### 17.3 Population viability

A functional regime should satisfy, approximately,

\[
\mathbb E[B_t]\approx\mathbb E[D_t].
\]

### 17.4 Computational separability

Different recent input histories should induce distinguishable computational states often enough for a simple readout to decode the target task.

### 17.5 Adaptive benefit

Under distribution shift,

\[
\text{adaptation time}_{CEPC}
<
\text{adaptation time}_{baseline}
\]

would be a meaningful target.

### 17.6 Damage recovery

A strong result would show task recovery after deleting particles without restoring the original microscopic state.

---

# 19. Research Methodology

Each mechanism must earn its existence through ablation.

Mandatory comparisons include:

- no movement;
- reciprocal forces;
- no charge-to-range coupling;
- no death;
- no reproduction;
- no mutation;
- deterministic versus probabilistic communication;
- no charge decay;
- no global error modulation;
- homogeneous versus heterogeneous genotypes.

The central scientific principle is

\[
\boxed{
\text{add complexity only when an experiment demonstrates necessity.}
}
\]

---

# 20. Intended Computational Regime

The most plausible initial application area is not static high-dimensional classification. The architecture is structurally biased toward

\[
\boxed{
\text{continuous, temporal, spatially structured, nonstationary environments}.
}
\]

Candidate domains include:

- nonstationary time-series prediction;
- adaptive control;
- robotic sensor streams;
- anomaly detection under drift;
- event-driven sensing;
- physical or distributed computation.

---

# 21. What Would Constitute a New Paradigm?

A strong scientific claim should require multiple observations:

1. **Nontrivial computation from simple local rules.**
2. **Population evolution improves performance at matched computational budget.**
3. **The advantage survives comparison with strong ESN/RNN and particle-system baselines.**
4. **Continuous adaptation outperforms static reservoirs under nonstationarity.**
5. **Structural changes correlate with computational improvement.**
6. **The system can recover after damage.**
7. **Functional organization recurs across initial conditions without identical microscopic trajectories.**

Only the conjunction of these results would justify a broad paradigm claim.

---

# 22. Current Scientific Status

## Established

The external literature supports the feasibility of nonlinear dynamical reservoirs, physical reservoir substrates, active-particle computation, self-organizing particle systems, structural rewiring and digital evolution [1–13].

## Hypotheses

The following remain unproven:

- local receive–process–transmit survival creates useful credit assignment;
- charge-modulated spatial range improves computation;
- heterogeneous genotypes self-organize into functional ecological niches;
- reproduction improves the substrate rather than merely introducing noise;
- global error modulation yields a useful stability–plasticity regime;
- the same continuously active population can acquire and reuse multiple task-specific organizations;
- CEPC is especially competitive on nonstationary temporal tasks.

---

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

This document is a research framework and formal hypothesis specification. It contains no claim that the proposed architecture has yet demonstrated superior computational performance or theoretical universality. All such claims require mathematical proof, simulation, controlled ablation, and comparison with appropriate baselines.
