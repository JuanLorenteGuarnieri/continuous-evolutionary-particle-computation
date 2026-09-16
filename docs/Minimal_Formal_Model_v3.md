# Continuous Evolutionary Particle Computation

## Minimal Formal Model v3

---

## 1. Scope

This document defines the minimal mathematical model to be implemented and analysed before adding architectural extensions. The purpose is to make the synchronous transition

\[
(\mathcal P_n,u_n,E_n,\xi_n)\mapsto\mathcal P_{n+1}
\]

mathematically unambiguous, where E_n is computed from the current output and then used to determine the health/turnover contribution to the next state.

The model contains only mechanisms already selected during the conceptual design:

- two-dimensional periodic domain;
- point particles with position and velocity;
- immutable genotype;
- integer charge;
- threshold activation;
- multiplicative processing;
- genetic communication preference;
- independent genetic spatial preference;
- bounded charge-dependent spatial range;
- asymmetric mechanical interactions;
- health and local cycle reward;
- death;
- local two-parent reproduction;
- recombination and mutation;
- fixed input/output particles;
- quantized input;
- linear output readout;
- global error-dependent turnover pressure;
- finite population budget.

No novelty reward, state-dependent communication preference, learned per-particle plasticity, nonlinear per-particle transfer function, hard-core collision model, asynchronous execution, or kernelized readout is part of v3.

---

# 2. Time and State

Discrete time is

\[
t_n=n\Delta t,
\qquad n\in\mathbb N.
\]

At the beginning of step \(n\):

\[
\mathcal P_n=
\{(s_i^n,g_i):i\in V_n\}.
\]

The population satisfies

\[
N_n=|V_n|\le N_{max}.
\]

Particle state:

\[
s_i^n=
(\mathbf x_i^n,\mathbf v_i^n,H_i^n,q_i^n,C_i^n,L_i^n).
\]

Genotype:

\[
g_i=(H_{max,i},\theta_i,A_i,K_i,R_{c,i},m_i,\gamma_i,R_{s,i},\boldsymbol\omega_i).
\]

During life,

\[
\boxed{g_i^{n+1}=g_i^n}
\]

for all states in which particle \(i\) survives.

---

# 3. Domain

\[
\Omega=\mathbb T^2=[0,L_x)\times[0,L_y).
\]

Minimum-image displacement:

\[
\Delta x_{ij}
=
 x_j-x_i-L_x\operatorname{round}\left(\frac{x_j-x_i}{L_x}\right),
\]

\[
\Delta y_{ij}
=
 y_j-y_i-L_y\operatorname{round}\left(\frac{y_j-y_i}{L_y}\right).
\]

Distance:

\[
d_{ij}=\sqrt{\Delta x_{ij}^2+\Delta y_{ij}^2}.
\]

Particles are points. Coincident positions are numerically regularized by \(\varepsilon>0\) in direction calculations.

---

# 4. Genetic Domain

The initial genotype is

\[
\boxed{
g_i=(H_{max},\theta_q,A,K,R_c,m,\gamma,R_s,\omega_R,\omega_A,\omega_v)
}
\]

with domains

\[
H_{max}\in[H_{min},H_{max}^{ub}],
\]

\[
\theta_q\in\{1,\ldots,\theta_{max}\},
\]

\[
A\in[A_{min},A_{max}],
\qquad A_{min}>0,
\]

\[
K\in\{1,\ldots,K_{max}\},
\]

\[
R_c\in[R_{c,min},R_{c,max}],
\]

\[
m\in[m_{min},m_{max}],
\qquad m_{min}>0,
\]

\[
\gamma\in[\gamma_{min},\gamma_{max}],
\qquad \gamma_{min}>0,
\]

\[
R_s\in[R_{s,min},R_{s,max}],
\]

and

\[
\omega_r\in[\omega_{min},\omega_{max}].
\]

All mutation and recombination operators project back into these admissible domains.

A later experimental programme may test whether some genes should be removed entirely.

---

# 5. External Input

For normalized scalar input

\[
u_n\in[0,1],
\]

quantized integer input charge is

\[
Q_n^{in}
=
\operatorname{round}(Q_{in}^{max}u_n).
\]

Input particles are fixed in position and protected from death.

A deterministic initial encoding is assumed: the integer quantity is distributed according to a fixed input map \(I\).

\[
q_i^{pre}
\mathrel{+}=I_i(Q_n^{in}),
\qquad i\in V_{in}.
\]

For the scalar baseline, \(I\) may target one designated input particle.

---

# 6. Charge Reception and Decay

Let

\[
r_i^n
\]

be total charge scheduled for particle \(i\) from transmissions generated at step \(n-1\).

Then

\[
q_i^{pre}=q_i^n+r_i^n+I_i(Q_n^{in}).
\]

Charge is nonnegative integer-valued.

Activation condition:

\[
\mathsf{act}_i^n
=
\mathbf1[q_i^{pre}\ge\theta_{q,i}].
\]

At most one activation packet can be processed during a timestep.

Residual charge is

\[
q_i^{res}
=
q_i^{pre}-	heta_{q,i}\mathsf{act}_i^n.
\]

After decay:

\[
\boxed{
q_i^{post}
=
\max(0,q_i^{res}-\delta_{q,i})
}
\]

with

\[
\delta_{q,i}\in\mathbb Z_{\ge0}.
\]

---

# 7. Processing

If \(\mathsf{act}_i^n=1\), exactly one threshold packet is processed.

Define transformed output charge

\[
\boxed{
q_i^{out}=A_i\theta_{q,i}
}
\]

and otherwise

\[
q_i^{out}=0.
\]

No additional nonlinear transformation exists in the MFM v3.

---

# 8. Communication Neighborhood

The communication neighborhood is

\[
\mathcal N_i^c(n)
=
\{j\neq i:d_{ij}\le R_{c,i}\}.
\]

Communication range is genotype-defined and is distinct from the spatial force range.

---

# 9. Genetic Communication Preference

Normalized genetic features of target \(j\) are denoted

\[
\phi(g_j)=
(\phi_R(g_j),\phi_A(g_j),\phi_v(g_j)).
\]

The sender-specific communication score is

\[
S_{ij}^{comm}
=
\omega_{R,i}\phi_R(g_j)
+
\omega_{A,i}\phi_A(g_j)
+
\omega_{v,i}\phi_v(g_j).
\]

The probability of choosing target \(j\) is

\[
P(j|i)
=
\frac{e^{\alpha S_{ij}^{comm}}}
{\sum_{k\in\mathcal N_i^c(n)}e^{\alpha S_{ik}^{comm}}}.
\]

A maximum of \(K_i\) distinct targets is sampled without replacement.

If \(\mathcal N_i^c(n)=\varnothing\), no transmission is possible and the local cycle is unsuccessful.

---

# 10. Communication Update

For selected target set \(T_i^n\):

\[
q_j^{next}
\mathrel{+}=q_i^{out},
\qquad j\in T_i^n.
\]

The source identity is recorded:

\[
C_j^{next}
\leftarrow
C_j^{next}\cup\{i\}.
\]

At the end of the step,

\[
L_i^{n+1}=C_i^n,
\]

and the next-step current set is the set constructed by transmissions during the present step.

If no transmissions were generated, \(C_i^{n+1}=\varnothing\).

---

# 11. Local Cycle Completion

Define

\[
R_i^n
=
\mathbf1[
\mathsf{act}_i^n=1
\land
|T_i^n|>0
].
\]

This is the only local signal used as success in MFM v3.

Thus

\[
R_i^n=1
\iff
\text{receive}
\rightarrow
\text{process}
\rightarrow
\text{transmit}
\]

was completed.

Interaction novelty

\[
N_i^n=|C_i^n\setminus L_i^n|
\]

is measured but does not yet change health.

---

# 12. Health Dynamics

Health is bounded:

\[
0\le H_i^n\le H_{max,i}.
\]

Let global error pressure be

\[
P_n=P(E_n).
\]

The health update is

\[
\boxed{
H_i^{n+1}
=
\operatorname{clip}
\left[
H_i^n+eta_iR_i^n-\lambda_iP_n,
0,H_{max,i}
\right]
}
\]

where

\[
\beta_i>0,
\qquad
\lambda_i>0.
\]

The minimal baseline may set \(\beta_i=\beta\) and \(\lambda_i=\lambda\) globally to reduce genotype dimensionality.

Death occurs if

\[
\boxed{H_i^{n+1}\le0.}
\]

---

# 13. Charge-Dependent Spatial Range

Communication range and mechanical spatial-interaction range remain distinct. The particle's current charge influences only the latter.

With the explicit charge bound

\[
0\le q_i^n\le Q_{max},
\]

the effective spatial range is

\[
\boxed{
R_{s,i}^{eff}(n)=R_{s,min}+(R_{s,max}-R_{s,min})\frac{q_i^n}{Q_{max}}
}
\]

and therefore

\[
R_{s,min}\le R_{s,i}^{eff}(n)\le R_{s,max}.
\]

The linear bounded mapping is frozen for MFM v3. Nonlinear or saturating charge-to-range laws are experimental variants. The charge cap is applied after charge updates so the invariant is preserved by construction.


# 14. Spatial Interaction

The spatial neighborhood is

\[
\mathcal N_i^s(n)
=
\{j\neq i:d_{ij}\le R_{s,i}^{eff}(n)\}.
\]

Define normalized genetic features of \(j\) as before. The spatial preference score is

\[
S_{ij}^{spatial}
=
\omega_{R,i}\phi_R(g_j)
+
\omega_{A,i}\phi_A(g_j)
+
\omega_{v,i}\phi_v(g_j).
\]

The baseline radial function is

\[
w(d;R)=\left(1-\frac dR\right)_+.
\]

The pair force is

\[
\boxed{
\mathbf F_{ij}^n
=
S_{ij}^{spatial}
\left(1-\frac{d_{ij}}{R_{s,i}^{eff}(n)}\right)_+
\frac{\mathbf r_{ij}}{d_{ij}+\varepsilon}
}
\]

and

\[
\mathbf F_i^n
=
\sum_{j\in\mathcal N_i^s(n)}\mathbf F_{ij}^n.
\]

No normalization by neighborhood size is applied in MFM v3.

In general:

\[
\mathbf F_{ij}^n\neq-\mathbf F_{ji}^n.
\]

---

# 15. Mechanical Update

For dynamic particles,

\[
\mathbf v_i^{n+1}
=
\mathbf v_i^n+
\frac{\Delta t}{m_i}
(\mathbf F_i^n-\gamma_i\mathbf v_i^n),
\]

\[
\mathbf x_i^{n+1}
=
\Pi_\Omega
(\mathbf x_i^n+\Delta t\mathbf v_i^{n+1}).
\]

\(\Pi_\Omega\) applies periodic wrapping.

Input/output particles remain fixed:

\[
\mathbf x_i^{n+1}=\mathbf x_i^n,
\qquad
\mathbf v_i^{n+1}=0.
\]

---

# 16. Output Readout

Let

\[
\mathbf q_{out,n}
=
(q_{o_1}^n,\ldots,q_{o_M}^n)^\top.
\]

Then

\[
\boxed{
\hat{\mathbf y}_n
=W_{out}\mathbf q_{out,n}+\mathbf b
}
\]

where \(W_{out}\) and \(b\) belong to the task-specific readout interface.

Training of the readout is external to the particle dynamics.

---

# 17. Global Error

For task target \(\mathbf y_n\), define

\[
E_n=\operatorname{Normalize}(\mathcal L(\mathbf y_n,\hat{\mathbf y}_n))
\in[0,1].
\]

The global pressure used for the next health update is

\[
P_n^{next}
=P(E_n)
\]

with

\[
\boxed{
P(E)=P_{min}+(P_{max}-P_{min})E^\gamma
}.
\]

This implements delayed causal feedback:

\[
E_n
\rightarrow
P_{n+1}.
\]

---

# 18. Reproduction

A candidate pair \((i,j)\) satisfies

\[
d_{ij}\le R_{mate},
\]

\[
H_i\ge H_{mate},
\qquad
H_j\ge H_{mate},
\]

\[
R_i^n=1,
\qquad
R_j^n=1.
\]

If a stochastic mating event is accepted and \(N_n<N_{max}\), one offspring \(k\) is created.

---

# 19. Genetic Recombination

For continuous gene \(r\):

\[
g_k^{(r)}
=
\alpha_r g_i^{(r)}+(1-\alpha_r)g_j^{(r)}+
\epsilon_r,
\qquad
\alpha_r\sim U(0,1).
\]

For discrete gene \(r\):

\[
g_k^{(r)}
=g_i^{(r)}
\quad\text{or}\quad
 g_j^{(r)}
\]

with probability \(1/2\) each, followed by bounded mutation.

Mutation is projected into the admissible genetic domain.

---

# 20. Offspring State

For parents i and j, an offspring k begins with no inherited short-term computational state:

\[
q_k^{n+1}=0,
\qquad
C_k^{n+1}=L_k^{n+1}=\varnothing.
\]

Initial health is

\[
H_k^{n+1}=H_{birth}.
\]

Position is initialized near the parental midpoint,

\[
\mathbf x_k^{n+1}=\Pi_\Omega\left(\frac{\mathbf x_i^n+\mathbf x_j^n}{2}+\varepsilon_x\right),
\]

and velocity by

\[
\mathbf v_k^{n+1}=\frac{\mathbf v_i^n+\mathbf v_j^n}{2}+\varepsilon_v.
\]

The bounded perturbations \(\varepsilon_x,\varepsilon_v\) provide local dispersal. They are not task-dependent. Offspring do not inherit parent charge or interaction-history buffers.


# 21. Population Cap

If

\[
N_n=N_{max},
\]

no birth is committed.

Living particles are never removed merely to make room for an offspring.

Protected input/output particles are excluded from population turnover calculations if a separate internal-population cap is desired; the baseline may define \(N_{max}\) as the internal population cap.

---

# 22. Exact State Transition Operator

The MFM v3 is synchronous. All current-step decisions are evaluated from a consistent state snapshot, and transmissions are stored in next-step buffers. The global error measured from the current output influences the health update that produces the next state.

Let \(\xi_n\) contain only explicitly stochastic choices: communication targets, mating choices, recombination coefficients, mutation and bounded offspring perturbations. Then

\[
\boxed{\mathcal P_{n+1}=\mathcal F(\mathcal P_n,u_n,E_n,\xi_n)}.
\]

The reference causal order is:

1. Quantize and inject \(u_n\) into protected input particles.
2. Deliver charge buffered at \(n-1\).
3. Construct current sender sets \(C_i^n\).
4. Evaluate activation using current charge and threshold.
5. If active, consume exactly one threshold packet and generate \(q_i^{out}=A_i\theta_{q,i}\).
6. Select up to \(K_i\) targets probabilistically within communication range and buffer their received charge for \(n+1\).
7. Apply decay to the residual charge after the activation decision/packet consumption, then enforce \(0\le q_i\le Q_{max}\).
8. Set \(R_i^n=1\) iff receive\rightarrow process\rightarrow transmit completes.
9. Update health using fixed reward and global error pressure.
10. Compute charge-dependent spatial range and all pair forces from the step-n snapshot.
11. Integrate dynamic particles; input/output particles remain fixed.
12. Remove particles with nonpositive post-update health.
13. Generate local two-parent offspring only when reproduction conditions hold and population capacity is available.
14. Initialize offspring with the prescribed birth state.
15. Commit next-state buffers and set \(L_i^{n+1}=C_i^n\).
16. Read \(q_{out,n}\) from protected output particles, apply the linear decoder and calculate \(E_n\).

No charge created at step \(n\) can trigger another processing event until step \(n+1\). There are therefore no within-step cascades.


# 23. Minimal Pseudocode Semantics

```text
INPUT:
    population P_n
    external input u_n
    stochastic seed/state xi_n

1. Quantize u_n and inject charge into protected input particles.

2. From the state snapshot at n, deliver charge buffered at n-1 and construct C_i^n.

3. For every particle i:
       q_pre = q_i^n + queued_reception_i + input_i
       activation = (q_pre >= theta_i)

       if activation:
           consume exactly one threshold packet
           q_out = A_i * theta_i
           select up to K_i targets probabilistically
           buffer q_out for those targets at n+1
       else:
           q_out = 0

       residual = q_pre - threshold_if_activated
       residual = max(0, residual - delta_q_i)
       q_i_next = min(Q_max, residual)

       R_i^n = 1 iff receive -> process -> transmit completed

4. Compute q_out,n from the fixed output particles and decode y_hat_n.

5. Compute normalized task error E_n.

6. Compute global pressure P(E_n) and update health for n+1.

7. Compute charge-dependent spatial ranges and all forces from the step-n snapshot.

8. Integrate dynamic particles; wrap positions periodically.

9. Remove particles whose post-update health is <= 0.

10. Evaluate local two-parent reproduction and reject births if capacity is full.

11. Initialize offspring with H_birth, q=0, empty histories and local inherited/perturbed kinematics.

12. Commit all next-state buffers and set L_i^(n+1) = C_i^n.
```

The implementation must preserve the causal ordering above. In particular, E_n affects the next state but cannot retroactively alter the output that produced E_n.

---

# 24. Consistency Constraints

The following constraints are frozen in MFM v3.

### C1 — Genotype immutability

\[g_i^{n+1}=g_i^n\]

for every surviving particle.

### C2 — Causal transmission

Charge transmitted at \(n\) becomes available no earlier than \(n+1\).

### C3 — One activation packet per timestep

\[\text{processed packets per particle per step}\le1.\]

### C4 — Separate communication and spatial preferences

Communication target preference and mechanical spatial preference are distinct genotype-dependent functions.

### C5 — Global error does not assign individual credit

The scalar \(E_n\) changes global turnover pressure only; it never directly identifies a successful or unsuccessful particle.

### C6 — Local success is cycle completion

\[R_i^n=1\iff receive\rightarrow process\rightarrow transmit.\]

### C7 — Bounded effective spatial range

\[R_{s,min}\le R_{s,i}^{eff}\le R_{s,max}.\]

### C8 — Fixed interface particles

Input and output particles are protected from death, reproduction and movement.

### C9 — Finite population

\[N_n\le N_{max}.\]

### C10 — No novelty-as-utility assumption

Current-versus-previous sender novelty is recorded diagnostically but does not affect baseline health.

### C11 — Explicit charge cap

\[0\le q_i^n\le Q_{max}.\]

### C12 — Birth rejection at capacity

If the population cap is reached, candidate births are discarded rather than replacing a living particle.

### C13 — Charge-based output interface

The task readout consumes the vector of charges carried by the protected output particles.

### C14 — Synchronous semantics

All next-state updates are committed simultaneously after the current-step events and interactions have been evaluated.


# 25. Mathematical Status

The MFM v3 is intended to be a **well-defined stochastic discrete-time hybrid population process** once all parameter bounds are fixed. The purpose of v3 is not to add new mechanisms but to freeze the decisions emerging from Stage III theoretical analysis so that Stage IV experiments have an unambiguous reference system.

This document does not claim:

- global contraction;
- the echo-state property;
- universal approximation;
- optimality of the local reward;
- convergence of genotype frequencies;
- existence of a nontrivial stationary population;
- task superiority over ESNs or RNNs.

Those become research questions for the mathematical-analysis document.
