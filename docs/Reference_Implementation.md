# Continuous Evolutionary Particle Computation (CEPC)

# Stage V — Reference Implementation

## A research-grade implementation plan for the MFM v3, GPU execution, browser deployment, and experimental platform

---

## 0. Purpose and Stage V Contract

Stage V translates the frozen **Minimal Formal Model v3 (MFM v3)** and the **Stage IV Experimental Design** into a concrete implementation plan.

The objective is not merely to create a visual simulation. The implementation must simultaneously provide:

1. a transparent reference implementation of the scientific model;
2. a GPU implementation capable of real-time browser execution;
3. deterministic and reproducible execution for controlled experiments;
4. cross-backend validation between reference and GPU implementations;
5. an experiment runner able to execute the Stage IV protocol;
6. a public static web application deployable on GitHub Pages;
7. instrumentation for charge flow, population dynamics, evolution, memory, stability–plasticity, and continual-learning experiments.

The central implementation principle is:

\[
\boxed{
\text{MFM v3 specification}
\rightarrow
\{\text{CPU reference},\text{GPU implementation}\}
\rightarrow
\text{cross-validation}
\rightarrow
\text{experimental platform}
}
\]

The web application is therefore a scientific instrument, not only a demonstration.

---

# 1. Frozen Scientific Baseline

Stage V must not silently change the model. The following decisions are considered frozen for the MFM v3 implementation.

## 1.1 Mathematical object

The system is a synchronous stochastic discrete-time hybrid population process:

\[
\boxed{
\mathcal P_{n+1}=\mathcal F(\mathcal P_n,u_n,E_n,\xi_n)
}
\]

where:

- \(\mathcal P_n\): complete population state;
- \(u_n\): external input;
- \(E_n\): task error measured from the current output;
- \(\xi_n\): explicitly stochastic choices.

There is no asynchronous within-step propagation.

## 1.2 Spatial domain

The baseline uses a two-dimensional torus:

\[
\Omega=\mathbb T^2=[0,L_x)\times[0,L_y).
\]

Periodic wrapping is mandatory in the baseline.

The minimum-image displacement is used for all spatial interactions.

Particles are mathematical points. No hard-core collision model is part of MFM v3.

## 1.3 Particle identity

Each logical particle has a persistent `ParticleID` that survives slot reuse only in the sense that the identifier itself is never reused during one simulation trajectory.

The physical storage index is a separate `slotIndex`.

This distinction is required for:

- interaction histories;
- event traces;
- genealogies;
- parent/offspring tracking;
- reproducible random events.

## 1.4 Genotype

The genotype is immutable during the lifetime of a particle:

\[
g_i=(H_{max},\theta_q,A,K,R_c,m,\gamma,R_s,\omega_R,\omega_A,\omega_v).
\]

Conceptually:

- \(H_{max}\): maximum health;
- \(\theta_q\): charge threshold;
- \(A\): multiplicative charge transformation factor;
- \(K\): maximum number of communication targets;
- \(R_c\): communication radius;
- \(m\): mass;
- \(\gamma\): damping;
- \(R_s\): baseline spatial-interaction range;
- \(\omega_R,\omega_A,\omega_v\): inherited communication/spatial preference coefficients.

The exact parameter packing may be optimized in the implementation, but the scientific semantics must remain unchanged.

## 1.5 Dynamic state

For each particle:

\[
s_i^n=(\mathbf x_i^n,\mathbf v_i^n,H_i^n,q_i^n,C_i^n,L_i^n).
\]

The principal dynamic variables are:

- position;
- velocity;
- health;
- integer nonnegative charge;
- current sender set;
- previous sender set.

Optional diagnostics such as age must not become part of the MFM unless explicitly promoted in a later version.

## 1.6 Charge

Charge is an integer computational resource, not a conserved physical quantity:

\[
q_i^n\in\mathbb Z_{\ge0}.
\]

Input is quantized:

\[
Q_n^{in}=\operatorname{round}(Q_{in}^{max}u_n).
\]

The pre-processing charge is:

\[
q_i^{pre}=q_i^n+r_i^n+I_i(Q_n^{in}).
\]

Activation:

\[
\mathsf{act}_i^n=\mathbf 1[q_i^{pre}\ge\theta_{q,i}].
\]

At most one threshold packet is processed per particle and timestep.

Processed output:

\[
q_i^{out}=A_i\theta_{q,i}.
\]

Residual charge:

\[
q_i^{res}=q_i^{pre}-\theta_{q,i}\mathsf{act}_i^n.
\]

Decay:

\[
q_i^{post}=\max(0,q_i^{res}-\delta_{q,i}).
\]

The hard invariant is:

\[
0\le q_i\le Q_{max}.
\]

## 1.7 Communication

Communication and spatial interaction are distinct mechanisms.

Communication neighborhood:

\[
\mathcal N_i^c(n)=\{j\neq i:d_{ij}\le R_{c,i}\}.
\]

Communication score:

\[
S_{ij}^{comm}
=

\omega_{R,i}\phi_R(g_j)
+
\omega_{A,i}\phi_A(g_j)
+
\omega_{v,i}\phi_v(g_j).
\]

The target probability is:

\[
P(j|i)
=

\frac{e^{\alpha S_{ij}^{comm}}}
{\sum_{k\in\mathcal N_i^c(n)}e^{\alpha S_{ik}^{comm}}}.
\]

Up to \(K_i\) distinct targets are sampled without replacement.

A particle without an eligible communication target cannot complete the local computational cycle.

## 1.8 Interaction history

For the current step:

\[
C_i^n=\{j:j\rightarrow i\text{ during }n\}.
\]

The previous-step history is:

\[
L_i^n=C_i^{n-1}.
\]

Novelty is measured diagnostically:

\[
N_i^n=|C_i^n\setminus L_i^n|,
\]

but novelty is not part of baseline health/reward.

## 1.9 Local success and health

A successful local cycle is exactly:

\[
R_i^n=
\mathbf 1[
\mathsf{act}_i^n=1
\land
|T_i^n|>0
].
\]

Equivalently:

\[
\boxed{
R_i^n=1
\iff
\text{receive}\rightarrow\text{process}\rightarrow\text{transmit}
}
\]

Health update:

\[
H_i^{n+1}
=

\operatorname{clip}
\left[
H_i^n+\beta_iR_i^n-\lambda_iP(E_n),
0,H_{max,i}
\right].
\]

Death occurs when post-update health is nonpositive.

The scalar global error does not assign individual credit.

## 1.10 Charge-dependent spatial range

Charge affects spatial behavior indirectly through a bounded interaction range:

\[
\boxed{
R_{s,i}^{eff}(n)=R_{s,min}+(R_{s,max}-R_{s,min})\frac{q_i^n}{Q_{max}}
}
\]

Thus:

\[
R_{s,min}\le R_{s,i}^{eff}\le R_{s,max}.
\]

The MFM baseline does not replace this with a nonlinear or saturating function.

## 1.11 Spatial force

Spatial neighborhood:

\[
\mathcal N_i^s(n)=
\{j\neq i:d_{ij}\le R_{s,i}^{eff}(n)\}.
\]

Radial weighting:

\[
w(d;R)=\left(1-\frac dR\right)_+.
\]

Pair force:

\[
\mathbf F_{ij}^n=
S_{ij}^{spatial}
\left(1-\frac{d_{ij}}{R_{s,i}^{eff}(n)}\right)_+
\frac{\mathbf r_{ij}}{d_{ij}+\varepsilon}.
\]

The interactions are generally asymmetric:

\[
\mathbf F_{ij}\neq-\mathbf F_{ji}.
\]

No neighborhood-size normalization is part of the baseline.

## 1.12 Mechanical dynamics

For mobile particles:

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

\Pi_\Omega(\mathbf x_i^n+\Delta t\mathbf v_i^{n+1}).
\]

Input/output particles remain fixed.

## 1.13 Reproduction

Parents must satisfy:

\[
d_{ij}\le R_{mate},
\]

\[
H_i,H_j\ge H_{mate},
\]

and:

\[
R_i^n=R_j^n=1.
\]

A stochastic mating event may generate one offspring when capacity permits.

## 1.14 Recombination and mutation

Continuous genes:

\[
g_k^{(r)}=
\alpha_rg_i^{(r)}+(1-\alpha_r)g_j^{(r)}+\epsilon_r.
\]

Discrete/categorical genes choose between parental values before bounded mutation.

The mutation operator must satisfy:

\[
\mathcal M(\mathcal G)\subseteq\mathcal G.
\]

## 1.15 Offspring state

New offspring have:

\[
q_k=0,
\qquad
C_k=L_k=\varnothing,
\]

\[
H_k=H_{birth}.
\]

Position is near the parental midpoint and velocity is approximately the parental average, with bounded non-task-dependent perturbations.

Parent health, charge, and short-term interaction history are not inherited as dynamic state.

## 1.16 Population cap

\[
N_n\le N_{max}.
\]

If capacity is full, the birth is rejected.

The implementation never kills a living particle merely to admit an offspring.

## 1.17 I/O interface

Input particles are fixed/protected.

Output particles are fixed/protected.

Their charges form:

\[
\mathbf q_{out,n}
=(q_{o_1}^n,\ldots,q_{o_M}^n)^\top.
\]

The baseline readout is linear:

\[
\boxed{
\hat{\mathbf y}_n=W_{out}\mathbf q_{out,n}+\mathbf b
}
\]

The primary continual-learning protocol freezes the trained readout during adaptation experiments. Readout refitting is a diagnostic control.

## 1.18 Global error and plasticity

Task error:

\[
E_n=\operatorname{Normalize}(\mathcal L(\mathbf y_n,\hat{\mathbf y}_n))\in[0,1].
\]

Global pressure:

\[
\boxed{
P(E)=P_{min}+(P_{max}-P_{min})E^\gamma
}
\]

The causal chain is:

\[
E_n\rightarrow H^{n+1}\rightarrow\text{turnover at later steps}.
\]

Error cannot retroactively modify the output that generated it.

---

# 2. Implementation Architecture

## 2.1 Architectural objective

The implementation must expose a stable simulation API while allowing two computational backends:

\[
\boxed{
\text{Simulation Model}
\rightarrow
\begin{cases}
\text{TypeScript CPU backend}\n\text{WebGPU backend}
\end{cases}
}
\]

An offline C++20 implementation acts as an independent scientific oracle.

The C++ oracle is not required by the browser application.

## 2.2 High-level system

```text
                              CEPC
                               │
                    ┌──────────┴───────────┐
                    │      MFM Model       │
                    │ schemas + semantics  │
                    └──────────┬───────────┘
                               │
                  ┌────────────┴─────────────┐
                  │                          │
             CPU Reference               GPU Backend
            TypeScript                WebGPU + WGSL
                  │                          │
                  └────────────┬─────────────┘
                               │
                       Simulation API
                               │
                    ┌──────────┴──────────┐
                    │                     │
                 Web App              Research Tools
                React/Vite             Python/C++
                    │
              Web Worker
                    │
                 WebGPU
                    │
              GitHub Pages
```

WebGPU is appropriate because its compute pipelines expose GPU-parallel computation and can write results to buffers, while the API also supports rendering through the same graphics device. WebGPU is available in workers in supporting browsers, which matches the worker-based architecture adopted here. Browser availability remains incomplete, so capability detection and a CPU fallback are required. [WebGPU MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API), [GPU API MDN](https://developer.mozilla.org/en-US/docs/Web/API/GPU)

## 2.3 Technology decisions

| Layer | Decision |
| --- | --- |
| Application | React |
| Language | TypeScript |
| Bundler | Vite |
| Package manager | pnpm |
| Runtime GPU API | WebGPU |
| Shader language | WGSL |
| Simulation architecture | Data-oriented / SoA |
| CPU browser backend | TypeScript + TypedArrays |
| Offline reference oracle | C++20 |
| Scientific analysis | Python |
| Readout offline | Python + scikit-learn |
| Browser readout | TypeScript implementation |
| Rendering | WebGPU |
| Main-thread UI | React |
| Simulation execution | Web Worker |
| Canvas transfer | OffscreenCanvas where supported |
| Persistent local experiments | IndexedDB, optional |
| Configuration | Typed JSON |
| Large numeric data | ArrayBuffer / typed binary format |
| CI | GitHub Actions |
| Deployment | GitHub Pages |
| C++ testing | GoogleTest |
| TypeScript testing | Vitest |
| Python testing | pytest |

Vite supports static builds for GitHub Pages and requires the correct `base` setting when the deployment is served under a repository path; deployment can be performed with GitHub Actions. [Vite static deployment guide](https://vite.dev/guide/static-deploy), [GitHub Pages documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site)

---

# 3. Repository Structure

The repository is a monorepo organized around scientific ownership of responsibilities rather than framework boundaries.

```text
cepc/
│
├── apps/
│   └── web/
│       ├── src/
│       │   ├── app/
│       │   ├── components/
│       │   ├── pages/
│       │   ├── hooks/
│       │   └── styles/
│       ├── public/
│       └── index.html
│
├── packages/
│   ├── model/
│   │   ├── src/
│   │   │   ├── genome/
│   │   │   ├── state/
│   │   │   ├── config/
│   │   │   ├── population/
│   │   │   └── invariants/
│   │   └── tests/
│   │
│   ├── simulation/
│   │   ├── src/
│   │   │   ├── engine/
│   │   │   ├── cpu/
│   │   │   ├── population/
│   │   │   ├── communication/
│   │   │   ├── mechanics/
│   │   │   ├── evolution/
│   │   │   ├── io/
│   │   │   └── metrics/
│   │   └── tests/
│   │
│   ├── gpu/
│   │   ├── src/
│   │   │   ├── device/
│   │   │   ├── buffers/
│   │   │   ├── pipelines/
│   │   │   ├── dispatch/
│   │   │   └── diagnostics/
│   │   ├── shaders/
│   │   │   ├── charge/
│   │   │   ├── communication/
│   │   │   ├── spatial/
│   │   │   ├── population/
│   │   │   └── render/
│   │   └── tests/
│   │
│   ├── rendering/
│   │   ├── src/
│   │   └── tests/
│   │
│   ├── experiments/
│   │   ├── src/
│   │   │   ├── runner/
│   │   │   ├── manifests/
│   │   │   ├── protocols/
│   │   │   └── presets/
│   │   └── tests/
│   │
│   ├── serialization/
│   │   ├── src/
│   │   └── tests/
│   │
│   └── shared/
│       ├── src/
│       └── tests/
│
├── reference/
│   └── cpp/
│       ├── include/
│       ├── src/
│       ├── tests/
│       └── CMakeLists.txt
│
├── python/
│   ├── analysis/
│   ├── metrics/
│   ├── readout/
│   ├── experiments/
│   └── tests/
│
├── tests/
│   ├── cross-backend/
│   ├── golden/
│   ├── property/
│   ├── statistical/
│   └── integration/
│
├── configs/
│   ├── model/
│   ├── experiments/
│   └── rendering/
│
├── data/
│   ├── small-reference/
│   ├── generated/
│   └── external/
│
├── docs/
│   ├── architecture/
│   ├── model/
│   ├── experiments/
│   └── development/
│
├── scripts/
│
├── .github/
│   └── workflows/
│       ├── test.yml
│       ├── build.yml
│       ├── deploy.yml
│       └── benchmark.yml
│
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.json
├── vite.config.ts
└── README.md
```

## 3.1 Dependency rule

Dependencies must remain acyclic:

```text
shared
  ↓
model
  ↓
simulation
  ↓
gpu / rendering
  ↓
experiments
  ↓
web application
```

The CPU and GPU backends implement the same model semantics; neither defines the model.

The UI may depend on public simulation APIs, but it must not depend on internal particle buffers or shader implementation details.

---

# 4. Core Data-Oriented Model

## 4.1 Why SoA is mandatory

The runtime population is represented with fixed-capacity contiguous arrays rather than allocating a JavaScript/C++ object for each active particle.

This matches the GPU execution model and keeps the same conceptual layout available to the CPU backend.

## 4.2 Fixed-capacity population storage

For a capacity \(N_{max}\):

```text
positions[Nmax]
velocities[Nmax]
health[Nmax]
charge[Nmax]
alive[Nmax]
particleId[Nmax]
parentA[Nmax]
parentB[Nmax]
generation[Nmax]
genotype[Nmax]
```

The logical population is selected by `alive[i]`.

No physical compaction is required in the first implementation.

## 4.3 Slot identity versus particle identity

```text
slotIndex : physical storage location
particleId: logical immutable identity
```

A slot can be recycled after death, but `particleId` is never recycled within a trajectory.

## 4.4 Genotype representation

The genotype is represented by a strongly typed structure whose fields are GPU-layout-compatible.

Conceptually:

```text
genome[i] = {
    hMax,
    thetaQ,
    deltaQ,
    amplification,
    maxTargets,
    communicationRadius,
    mass,
    damping,
    spatialRadius,
    omegaR,
    omegaA,
    omegaV
}
```

The scientific schema is versioned separately from the storage layout.

## 4.5 Interaction histories

Dynamic vectors per particle are avoided.

The baseline representation is compact CSR-like storage:

```text
senderOffsets[i]
senderCounts[i]
senderIds[]
```

There is a bounded maximum sender count for GPU storage.

The baseline keeps exactly one previous-history layer.

---

# 5. Browser Execution Architecture

## 5.1 Main thread

The main thread owns:

- React UI;
- controls;
- visualization overlays;
- experiment selection;
- lightweight state display.

It does not execute the heavy simulation loop.

## 5.2 Simulation worker

The simulation runs in a Web Worker.

Responsibilities:

- initialize backend;
- own the WebGPU device where supported;
- execute simulation steps;
- manage GPU buffers;
- collect lightweight metrics;
- process checkpoints;
- answer UI commands.

The worker API is message-based.

Example commands:

```text
INIT
START
PAUSE
STEP
RESET
SET_CONFIG
SET_SPEED
SAVE_CHECKPOINT
LOAD_CHECKPOINT
EXPORT_RESULTS
SET_RENDER_MODE
```

## 5.3 Rendering

Rendering is GPU-native.

The simulation should not copy the entire population to the CPU every frame.

The desired flow is:

```text
GPU simulation state
       ↓
GPU render buffers
       ↓
render pass
       ↓
canvas
```

`OffscreenCanvas` is used where supported so that rendering can remain decoupled from the React main thread.

## 5.4 Simulation clock versus render clock

The clocks are independent.

For example:

```text
Render: 60 FPS
Simulation: 1–100+ timesteps/frame
```

This allows scientific runs to proceed faster than real time while maintaining a smooth visualization.

---

# 6. WebGPU Resource Architecture

## 6.1 Device initialization

Initialization sequence:

```text
navigator.gpu / WorkerNavigator.gpu
        ↓
requestAdapter()
        ↓
requestDevice()
        ↓
capability check
        ↓
buffer allocation
        ↓
shader module creation
        ↓
pipeline creation
```

The implementation must fail gracefully when WebGPU is unavailable and switch to the TypeScript CPU backend.

## 6.2 Buffer groups

### State buffers

Ping-pong buffers:

```text
stateA
stateB
```

containing mutable dynamic particle state.

### Genotype buffer

```text
genotypeBuffer
```

### Population metadata

```text
aliveBuffer
particleIdBuffer
parentBuffer
generationBuffer
```

### Communication buffers

```text
queuedChargeBuffer
nextSenderCountBuffer
nextSenderIdsBuffer
targetSelectionBuffer
```

### Spatial buffers

```text
cellIdBuffer
sortedParticleIdBuffer
cellOffsetBuffer
cellCountBuffer
```

### Population-event buffers

```text
deathMask
birthCandidates
freeSlots
```

### Metrics buffers

Only scalar/reduced quantities should normally cross the GPU/CPU boundary.

## 6.3 Ping-pong semantics

The entire mutable state conceptually follows:

\[
S_n\rightarrow S_{n+1}.
\]

A particle must never read state that another particle has already modified during the same timestep.

This is the implementation mechanism that guarantees MFM v3 synchronous semantics.

---

# 7. Exact Simulation Step Architecture

The implementation must preserve the scientific ordering of MFM v3.

## 7.1 Canonical timestep

```text
STEP n
│
├── 01. Quantize external input
├── 02. Inject input charge
├── 03. Deliver queued charge from n-1
├── 04. Construct current sender history C_n
├── 05. Evaluate activation
├── 06. Process at most one threshold packet
├── 07. Select probabilistic communication targets
├── 08. Write next-step charge receptions
├── 09. Apply residual charge decay
├── 10. Clamp charge to Qmax
├── 11. Determine local cycle completion R_n
├── 12. Read output charges
├── 13. Compute y_hat_n
├── 14. Compute E_n
├── 15. Update health toward n+1
├── 16. Compute charge-dependent spatial ranges
├── 17. Build/update spatial index
├── 18. Compute spatial forces
├── 19. Integrate velocities
├── 20. Integrate positions + periodic wrap
├── 21. Mark dead particles
├── 22. Generate reproduction candidates
├── 23. Allocate free population slots
├── 24. Initialize offspring
├── 25. Commit history L_{n+1}=C_n
└── 26. Swap state buffers
```

The exact operation ordering must be represented in one central engine rather than duplicated independently in many components.

## 7.2 Causality invariant

No charge generated at \(n\) can activate a downstream particle during \(n\).

Therefore:

\[
\text{transmission at }n
\rightarrow
\text{reception at }n+1.
\]

## 7.3 Error causality invariant

\[
\hat y_n
\rightarrow
E_n
\rightarrow
H_{n+1}.
\]

The implementation must not allow:

\[
E_n\rightarrow\hat y_n.
\]

---

# 8. Charge Pipeline

## 8.1 Integer storage

Charge is stored with an integer-compatible representation, preferably `u32` in GPU buffers.

If future capacity requirements exceed this range, the model version must explicitly change rather than silently switch precision.

## 8.2 Input deposition

For each input component:

```text
u ∈ [0,1]
   ↓
round(Qin_max * u)
   ↓
fixed input-particle mapping
```

The input mapping is deterministic.

## 8.3 Activation and residual

The shader computes:

```text
q_pre = current_charge + queued_charge + input_charge
active = q_pre >= theta
if active:
    q_pre -= theta
    q_out = amplification * theta
else:
    q_out = 0
```

## 8.4 Decay and cap

```text
q_post = max(0, residual - deltaQ)
q_post = min(Qmax, q_post)
```

The order is deliberate: consume the packet first, then decay residual charge.

## 8.5 Charge overflow protection

The implementation must prevent integer overflow before applying the cap.

Where intermediate products could exceed the storage range:

- use a wider intermediate arithmetic type where supported;
- constrain admissible \(A\) and \(\theta_q\);
- validate the configured parameter set before simulation.

---

# 9. Counter-Based Randomness

## 9.1 Requirement

Randomness must be independent of thread scheduling and particle iteration order.

The conceptual API is:

```text
random(seed, timestep, particleId, eventType, counter)
```

Example event classes:

```text
COMM_TARGET
MATING
RECOMBINATION
MUTATION
POSITION_JITTER
VELOCITY_JITTER
```

## 9.2 Scientific contract

The same:

```text
seed
+ initial state
+ model version
+ configuration
```

must reproduce the same run on the same backend.

CPU and GPU do not need bitwise-identical floating-point trajectories.

## 9.3 Randomness and GPU race conditions

No random event may depend on the order in which neighboring threads happen to execute.

Random values should be generated from stable event identifiers rather than from a single mutable global random stream.

---

# 10. Spatial Index

## 10.1 CPU oracle

The CPU reference uses brute-force neighbor construction:

\[
O(N^2).
\]

Its purpose is correctness, not speed.

## 10.2 GPU backend

The production browser backend uses a uniform spatial grid.

Pipeline:

```text
positions
   ↓
cell ID computation
   ↓
particle-cell grouping
   ↓
cell offsets/counts
   ↓
local neighbor traversal
```

## 10.3 Grid geometry

The cell size should be at least large enough that all neighbors relevant to a query can be found from the cell and its adjacent cells.

Because the torus is periodic, cell indexing must wrap periodically.

## 10.4 Communication versus spatial neighborhoods

The same grid may support both operations, but they remain separate semantic queries:

```text
queryCommunicationNeighbors(i)
querySpatialNeighbors(i)
```

because:

\[
R_c\neq R_s^{eff}
\]

in general.

## 10.5 Validation

For small populations, compare:

\[
\mathcal N_i^{grid}=
\mathcal N_i^{bruteforce}
\]

for every particle.

This is one of the first GPU correctness tests.

---

# 11. Communication Sampling

## 11.1 Candidate generation

For an active particle:

1. query communication neighborhood;
2. remove self;
3. calculate genetic communication score;
4. convert scores to a numerically stable probability distribution;
5. sample up to \(K_i\) distinct targets;
6. emit next-step charge events.

## 11.2 Numerically stable softmax

Compute:

\[
m_i=\max_j \alpha S_{ij}^{comm}
\]

then:

\[
p_{ij}
=

\frac{e^{\alpha S_{ij}-m_i}}
{\sum_k e^{\alpha S_{ik}-m_i}}.
\]

This avoids avoidable exponent overflow.

## 11.3 Weighted sampling without replacement

The first implementation should prioritize correctness and deterministic replay rather than the most advanced parallel sampling algorithm.

The sampling module therefore receives a well-defined interface:

```text
sampleTargets(candidates, scores, K, randomContext)
```

with:

- CPU reference implementation;
- GPU implementation;
- explicit tests for uniqueness and admissibility.

The exact GPU algorithm may be optimized later without changing this interface or the MFM semantics.

## 11.4 Transmission accumulation

Each selected target receives:

\[
+q_i^{out}.
\]

The actual addition belongs to the next-step reception buffer.

---

# 12. Spatial Mechanics

## 12.1 Force pipeline

For every dynamic particle:

```text
q
 ↓
R_s_eff
 ↓
spatial neighbors
 ↓
S_ij^spatial
 ↓
w(d;R)
 ↓
F_ij
 ↓
sum F_i
 ↓
mechanical integration
```

## 12.2 Asymmetry

The implementation must never implicitly enforce Newton's third law.

The pair relation is directed:

```text
i → j
```

and must be computed from the sender particle's force rule.

## 12.3 Floating-point policy

Positions and velocities use floating-point representation.

The reference CPU implementation should use `float64` for scientific validation.

The GPU implementation may initially use `f32` for performance, but CPU/GPU tolerance thresholds must be experimentally established rather than guessed.

Where accumulated force error is significant, a later `f64` capability-dependent path may be evaluated.

## 12.4 Mechanical stability validation

The engine must validate the configured ratio:

\[
0<\frac{\gamma_i\Delta t}{m_i}<1
\]

as the preferred practical stability regime.

The looser non-expansive bound:

\[
0\le\frac{\gamma_i\Delta t}{m_i}\le2
\]

remains a theoretical admissibility condition.

---

# 13. Population and Evolution Engine

## 13.1 Death

Death is first represented as a mask:

```text
alive[i] = false
```

The slot remains available until allocation.

This avoids dynamic GPU object creation/destruction.

## 13.2 Free-slot management

A free-slot structure is maintained separately.

The browser implementation initially resolves allocation conservatively and deterministically when possible.

The allocation policy is not itself a new selection mechanism.

## 13.3 Reproduction candidate generation

Candidate generation checks:

```text
local mating radius
health threshold
successful-cycle requirement
population capacity
```

Candidates are then passed to the mating event sampler.

## 13.4 Offspring genome

The genome-generation function is independent from offspring-state initialization:

```text
parents
  ├── recombination → genome
  └── state initialization → dynamic state
```

This makes inheritance of genotype distinguishable from inheritance of dynamic memory.

## 13.5 Capacity rule

If:

\[
N=N_{max},
\]

no offspring is committed.

No living particle is displaced to admit the candidate.

## 13.6 Protected particles

Input/output particles:

- cannot die through ordinary health turnover;
- cannot reproduce;
- do not move;
- remain present for the entire experiment.

Their charges still participate in ordinary MFM computation.

---

# 14. Readout Architecture

## 14.1 Separation of concerns

The readout is an external observation layer.

The simulator exposes:

\[
\mathbf q_{out,n}.
\]

The readout computes:

\[
\hat{\mathbf y}_n=W_{out}\mathbf q_{out,n}+b.
\]

## 14.2 Offline training

The preferred research workflow is:

```text
simulation
   ↓
collect output-charge matrix
   ↓
Python
   ↓
Ridge Regression
   ↓
W_out, b
   ↓
freeze
   ↓
continual experiments
```

Readout training is not part of internal evolution.

## 14.3 Browser inference

The web runtime contains a lightweight linear algebra implementation for:

\[
\hat y=Wq+b.
\]

No browser-side retraining occurs in the principal continual-learning protocol.

## 14.4 Diagnostic refit mode

A separate control allows refitting \(W_{out}\).

This must be labeled explicitly because it answers a different research question.

---

# 15. Metrics Architecture

Metrics are divided by execution cost.

## 15.1 GPU-side metrics

The GPU should compute cheap reductions such as:

- population count;
- mean/max charge;
- mean health;
- number of active particles;
- number of successful cycles;
- deaths;
- births;
- average effective spatial range;
- charge saturation count.

## 15.2 CPU-side diagnostics

The CPU can periodically process:

- genotype entropy;
- phenotype variance;
- spatial cluster statistics;
- communication graph summaries;
- charge event traces;
- genealogy statistics;
- separation diagnostics.

## 15.3 Avoid full-state readback

A normal rendering frame must not download all particle state from the GPU.

Full snapshots happen only when:

- explicitly requested;
- a checkpoint is created;
- a diagnostic experiment requires them.

---

# 16. Experiment System

## 16.1 Experiment as a first-class object

Every experiment is represented by a manifest:

```text
ExperimentManifest
├── experimentId
├── modelVersion
├── backend
├── seed
├── gitCommit
├── configHash
├── inputDataset
├── readoutProtocol
├── metricsProtocol
├── checkpointPolicy
└── timestamps
```

## 16.2 Configuration layers

Separate:

```text
model configuration
experiment configuration
runtime configuration
render configuration
```

Example:

```text
configs/model/mfm_v3.json
configs/experiments/xor_full.json
configs/runtime/default.json
configs/render/realtime.json
```

## 16.3 Presets

Initial browser presets should include:

```text
MFM v3 minimal
P0 / fixed medium
P1 / health
P2 / reproduction
P3 / mutation
P4 / global error pressure
A→B→A
Damage
```

The preset only selects configuration; it does not modify source-level model rules.

---

# 17. Experiment Protocol Translation from Stage IV

Stage V must directly support the Stage IV experimental ladder.

## 17.1 P0 — Fixed non-evolving medium

Disable:

- death;
- reproduction;
- mutation;
- global turnover pressure.

Purpose:

Determine whether temporal computation exists before evolution.

Required outputs:

- delay reconstruction;
- linear memory;
- XOR/parity;
- state separation;
- effective dimension.

## 17.2 P1 — Health and death

Enable health/death while keeping the genetic population fixed.

Measure:

- population persistence;
- turnover;
- local-success frequency;
- task performance;
- emergence of stable activity patterns.

## 17.3 P2 — Reproduction

Enable local two-parent reproduction without mutation.

Question:

Does existing phenotype variation become selectively amplified?

Required analysis:

- genotype frequency trajectories;
- fitness proxy correlations;
- spatial structure;
- comparison against fixed-genotype controls.

## 17.4 P3 — Mutation

Enable mutation.

Sweep mutation intensity across a controlled range.

Measure:

- genotype entropy;
- phenotypic diversity;
- task performance;
- demographic viability;
- mutation-selection balance;
- extinction probability.

## 17.5 P4 — Global error modulation

Enable:

\[
P(E)=P_{min}+(P_{max}-P_{min})E^\gamma.
\]

Test the stability–plasticity response.

Measure:

- error;
- turnover response;
- recovery time;
- population collapse probability;
- adaptation time.

---

# 18. Benchmark Implementation Plan

## 18.1 Delay reconstruction

Generate bounded stochastic or deterministic input sequences.

Target:

\[
y_n=u_{n-k}.
\]

Sweep \(k\).

Purpose:

Estimate fast memory decay and effective computational memory horizon.

## 18.2 Multi-delay reconstruction

Train separate readouts for:

\[
[u_{n-k_1},u_{n-k_2},\ldots].
\]

Purpose:

Distinguish a single memory mode from multi-timescale memory.

## 18.3 XOR/parity

Use binary/quantized sequences.

Purpose:

Test nonlinear transformations of temporal history.

## 18.4 NARMA-10

Primary nonlinear temporal benchmark.

Important controls:

- washout;
- sequence separation;
- readout regularization;
- multiple seeds.

## 18.5 Mackey–Glass

Prediction of nonlinear deterministic dynamics.

Metrics:

- MSE;
- NMSE;
- long-horizon degradation where appropriate.

## 18.6 Lorenz

Multivariate chaotic prediction.

Purpose:

Test richer temporal state reconstruction under nonlinear dynamics.

## 18.7 Controlled frequency/regime classification

Use synthetic signals with known temporal regimes.

Purpose:

Provide interpretable nonstationarity before moving to more complex continual-learning experiments.

---

# 19. Continual-Learning Implementation

## 19.1 A→B→A protocol

A task is trained/calibrated first:

```text
A → baseline stabilization
```

Then the environment switches:

```text
A → B → A
```

Measure:

\[
T_A^{first},
\qquad
T_A^{return}.
\]

Evolutionary memory gain:

\[
EMG=1-\frac{T_A^{return}}{T_A^{first}}.
\]

This must be accompanied by forgetting measurements.

## 19.2 Frozen-readout requirement

The main protocol holds:

\[
W_{out},b
\]

fixed after calibration.

Therefore changes in task performance must primarily arise from the evolving medium.

## 19.3 State reset controls

Three conditions must be distinguishable:

```text
A→B→A with full state retained
A→B→A with fast dynamic state reset
A→B→A with structural reset
```

This separates:

- residual dynamic memory;
- structural memory;
- genetic/evolutionary memory.

## 19.4 Gradual drift

The target or environment changes continuously:

\[
\mathcal E_t.
\]

Measure tracking lag and sustained error.

## 19.5 Abrupt changes

Test controlled changes with known magnitude.

Measure:

- error spike;
- turnover spike;
- recovery time;
- diversity change.

---

# 20. Damage and Regeneration

After reaching a stable regime:

\[
\mathcal P^\star\rightarrow\mathcal P_r^\star
\]

by deleting a controlled fraction of internal particles.

Suggested levels:

\[
10\%,20\%,30\%,50\%.
\]

Measure:

\[
\Delta L(r),
\qquad
T_{rec}(r).
\]

The key question is whether the computational organization can recover without reconstructing the exact original microscopic configuration.

---

# 21. Testing Strategy

Testing is organized in six layers.

## 21.1 Layer 1 — Unit tests

Individual components:

- quantization;
- threshold detection;
- charge consumption;
- decay;
- hard charge cap;
- amplification;
- softmax;
- target uniqueness;
- force calculation;
- periodic distance;
- mechanical update;
- health update;
- death condition;
- recombination;
- mutation projection;
- offspring initialization.

## 21.2 Layer 2 — Invariant/property tests

Automatically verify:

\[
q_i\in[0,Q_{max}],
\]

\[
H_i\in[0,H_{max,i}],
\]

\[
N\le N_{max},
\]

\[
g_i\in\mathcal G,
\]

positions remain on the torus,

and dead particles are excluded from interactions.

## 21.3 Layer 3 — Golden tests

Small deterministic systems with hand-checkable expected results.

Example:

```text
N = 2
known q
known theta
known A
known targets
one timestep
```

Expected:

- activation;
- output charge;
- residual charge;
- target reception;
- health;
- next state.

## 21.4 Layer 4 — Deterministic replay

The same backend must satisfy:

```text
same model version
same configuration
same seed
same initial state
        ↓
same trajectory
```

This must be tested over many timesteps rather than only one step.

## 21.5 Layer 5 — CPU/GPU cross-validation

For small deterministic test cases:

\[
S_t^{CPU}\approx S_t^{GPU}.
\]

Discrete fields must satisfy exact logical equivalence where possible.

Continuous fields use explicit tolerances.

## 21.6 Layer 6 — Statistical validation

For stochastic experiments, compare distributions rather than requiring trajectory equality.

Examples:

- active-particle counts;
- charge distributions;
- selected-target frequencies;
- birth/death rates;
- genotype-frequency distributions.

---

# 22. Cross-Backend Validation Matrix

| Feature | CPU TS | GPU WebGPU | C++ Oracle |
| --- | ---: | ---: | ---: |
| Charge integer rules | ✓ | ✓ | ✓ |
| Threshold | ✓ | ✓ | ✓ |
| Communication neighborhood | ✓ | ✓ | ✓ |
| Probabilistic selection | ✓ | ✓ | ✓ |
| Health | ✓ | ✓ | ✓ |
| Spatial range | ✓ | ✓ | ✓ |
| Forces | ✓ | ✓ | ✓ |
| Mechanical integration | ✓ | ✓ | ✓ |
| Birth/death | ✓ | ✓ | ✓ |
| Mutation | ✓ | ✓ | ✓ |
| Checkpoints | ✓ | ✓ | ✓ |
| Event tracing | ✓ | partial/full configurable | ✓ |
| Stage IV experiments | ✓ | ✓ | ✓ |

The three implementations do not need identical code. They need a common semantic contract.

---

# 23. Numerical Tolerances

Tolerances must be determined empirically from cross-backend experiments.

Initial categories:

### Exact/discrete

- active/inactive status;
- threshold comparisons;
- charge integer values;
- particle IDs;
- birth/death logical decisions where floating inputs are not involved;
- target admissibility;
- number of selected targets.

### Approximate/continuous

- positions;
- velocities;
- force sums;
- aggregate floating metrics.

The test suite must record tolerances explicitly rather than burying them in code.

---

# 24. C++ Reference Oracle

## 24.1 Role

C++20 is used as an independent, transparent scientific implementation.

It is not the primary browser runtime.

Its main functions are:

- exact small-system validation;
- reference experiments;
- benchmark performance characterization;
- golden trajectory generation;
- independent implementation diversity.

## 24.2 Design

The C++ reference should deliberately favor clarity over optimization:

```text
ParticleState
Population
Simulation
Communication
Mechanics
Evolution
Experiment
```

and brute-force neighbor search.

## 24.3 Why an independent implementation matters

If the TypeScript CPU backend and WebGPU backend share too much implementation logic, the same bug can survive both.

The C++ oracle provides a third implementation lineage and therefore stronger validation.

---

# 25. Python Scientific Layer

Python is used only for offline research tooling.

Responsibilities:

```text
python/
├── analysis/
├── metrics/
├── readout/
├── experiments/
└── tests/
```

Key libraries:

- NumPy;
- SciPy;
- pandas where useful;
- scikit-learn;
- matplotlib;
- optional h5py/pyarrow only for offline research datasets if later justified.

The browser application must not depend on Python execution.

---

# 26. Serialization and Checkpoints

## 26.1 Checkpoint contents

A complete checkpoint contains:

```text
model version
simulation timestep
seed
random counter state
configuration
population state
genotypes
particle IDs
parent IDs
generation numbers
history buffers
output state
readout metadata
```

## 26.2 Browser format

Use binary `ArrayBuffer`/typed-array storage for large numeric arrays.

Metadata is JSON.

A checkpoint therefore has conceptually:

```text
checkpoint/
├── manifest.json
└── state.bin
```

## 26.3 Human-readable debugging

Small checkpoints can additionally be exported as JSON for debugging.

JSON is not the primary high-volume storage format.

---

# 27. Event Tracing

## 27.1 Levels

### OFF

No event log.

### BASIC

Aggregates only:

- number of activations;
- transmissions;
- births;
- deaths.

### FULL

Structured event records:

```text
(timestamp, timestep, eventType, sourceId, targetId, charge, metadata)
```

Possible event types:

```text
INPUT
RECEIVE
ACTIVATE
PROCESS
TRANSMIT
HEALTH_GAIN
HEALTH_LOSS
DEATH
MATING
BIRTH
MUTATION
```

## 27.2 Memory strategy

FULL event tracing must use bounded/circular buffers or chunked export.

The browser must never retain an unlimited event stream in RAM.

---

# 28. Rendering System

## 28.1 Particle rendering

Each particle is rendered as a point/sprite whose visual properties can encode:

- health;
- charge;
- genotype class;
- activity;
- generation.

The scientific mapping used for a visualization must be explicit.

## 28.2 Communication visualization

Optional event edges:

```text
i ─────────→ j
```

should be rendered from recent event buffers rather than reconstructed from complete historical data every frame.

## 28.3 Debug overlays

The browser should expose optional overlays for:

- spatial grid;
- communication radius;
- effective spatial radius;
- output particles;
- input particles;
- current error;
- global pressure;
- population count.

## 28.4 Performance rule

Rendering options may reduce visualization detail but must never modify simulation semantics.

---

# 29. Web Application Interface

The first application version should include:

```text
┌─────────────────────────────────────────────────────────────┐
│ CEPC                                                        │
├───────────────────────────────────────────┬─────────────────┤
│                                           │ Experiment      │
│                                           │ Preset          │
│            LIVE SIMULATION                │ Seed            │
│                                           │ Population      │
│                                           │ Mutation        │
│                                           │ Error pressure  │
│                                           │ Speed           │
│                                           │                 │
├───────────────────────────────────────────┤ Controls        │
│ population / charge / health / error      │ ▶ ⏸ Step Reset │
├───────────────────────────────────────────┴─────────────────┤
│ metrics timeline / task error / population / turnover       │
└─────────────────────────────────────────────────────────────┘
```

The UI must make it clear whether the execution backend is:

```text
WebGPU
```

or:

```text
CPU fallback
```

---

# 30. Performance Strategy

## 30.1 Optimization hierarchy

Priority order:

\[
\boxed{
\text{correctness}
>
\text{reproducibility}
>
\text{backend equivalence}
>
\text{GPU throughput}
>
\text{visual polish}
}
\]

## 30.2 Initial complexity targets

CPU reference:

\[
O(N^2)
\]

for spatial queries.

GPU production:

approximately local-neighborhood complexity under bounded density using the uniform grid.

The exact measured performance must be reported rather than assuming a particular speedup.

## 30.3 Avoid premature optimization

The following are explicitly deferred until profiling demonstrates need:

- kernel fusion;
- full GPU population compaction;
- sophisticated parallel birth allocation;
- advanced weighted sampling algorithms;
- persistent GPU event logs;
- multi-GPU execution.

---

# 31. CI/CD and Deployment

## 31.1 Pull-request checks

Every pull request should run:

```text
TypeScript typecheck
Vitest unit tests
CPU property tests
C++ GoogleTest
Python pytest
shader compilation/validation
build verification
```

## 31.2 Build

The web app is built by Vite.

The GitHub Pages deployment uses GitHub Actions.

The correct Vite `base` path must be set according to whether the repository is served at the root GitHub Pages domain or under `/<repository>/`. [Vite static deployment guide](https://vite.dev/guide/static-deploy)

## 31.3 Deployment workflow

```text
push main
   ↓
GitHub Actions
   ├── install
   ├── test
   ├── build
   └── deploy Pages
```

GitHub Pages serves the resulting static files; the simulation itself runs in the visitor's browser rather than on the GitHub server. [GitHub Pages documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site)

## 31.4 GPU CI limitation

Standard GitHub-hosted CI should not be treated as the only source of browser GPU validation.

GPU validation has three levels:

1. shader/static validation in CI;
2. local browser GPU integration tests;
3. dedicated GPU/browser runners later if required.

---

# 32. Implementation Phases

Stage V is divided into sequential phases. A later phase may start only when its predecessor reaches its acceptance criteria.

---

## Phase 0 — Repository and Toolchain Bootstrap

### Objective

Create the reproducible development environment.

### Tasks

- initialize pnpm workspace;
- configure TypeScript;
- configure Vite;
- configure React;
- create package boundaries;
- create C++20 CMake project;
- create Python environment/configuration;
- configure Vitest, GoogleTest and pytest;
- create initial CI workflows.

### Deliverable

A repository that builds and runs an empty web shell plus passing test suites.

### Acceptance

```text
pnpm install
pnpm test
pnpm build
cmake --build
pytest
```

all succeed.

---

## Phase 1 — Shared Scientific Model Schema

### Objective

Encode the MFM v3 types without implementing dynamics yet.

### Tasks

Implement:

```text
Genome
ParticleState
PopulationState
MFMConfig
ExperimentConfig
SimulationSnapshot
ExperimentManifest
```

Add:

- version fields;
- validation;
- invariant checks;
- typed configuration loading.

### Acceptance

Every MFM v3 parameter has exactly one canonical representation.

No deprecated MFM v2 rules remain in the schema.

---

## Phase 2 — TypeScript CPU Reference Backend

### Objective

Implement the entire MFM v3 in a transparent browser-compatible CPU backend.

### Tasks

Implement in scientific order:

1. domain and periodic distance;
2. input quantization;
3. charge reception;
4. thresholding;
5. processing;
6. decay/cap;
7. communication neighborhood;
8. probabilistic target selection;
9. history buffers;
10. successful-cycle detection;
11. health/error pressure;
12. charge-dependent spatial range;
13. spatial force;
14. mechanics;
15. death;
16. reproduction;
17. mutation;
18. offspring initialization;
19. output readout.

### Acceptance

The CPU backend passes all unit, property, golden, and deterministic replay tests.

---

## Phase 3 — C++ Independent Oracle

### Objective

Implement the same MFM independently in C++20.

### Tasks

- brute-force neighbor search;
- deterministic RNG interface;
- complete timestep;
- checkpoint support;
- golden trajectory export.

### Acceptance

Small deterministic trajectories agree with the TypeScript CPU reference within the defined numerical tolerances.

---

## Phase 4 — MFM v3 Behavioral Test Suite

### Objective

Prove that the software implements the mathematical specification before GPU optimization.

### Test families

- one-step exact cases;
- multi-step causal cases;
- zero-neighbor cases;
- saturation cases;
- asymmetric-force cases;
- death and birth cases;
- capacity-full cases;
- mutation boundary cases;
- protected input/output cases;
- A→B→A control cases.

### Acceptance

All baseline invariants are automatically checked in CI.

---

## Phase 5 — WebGPU Foundations

### Objective

Create the GPU runtime without implementing the complete model yet.

### Tasks

- WebGPU device manager;
- capability detection;
- shader compilation;
- buffer allocator;
- bind-group management;
- command encoder;
- worker integration;
- GPU error handling;
- CPU fallback.

### Acceptance

A small GPU compute test successfully writes/reads a storage buffer, and the browser switches cleanly between WebGPU and CPU modes.

---

## Phase 6 — GPU State and Basic Dynamics

### Objective

Move the simplest MFM state transitions to GPU.

### Tasks

Implement kernels for:

- input deposition;
- charge update;
- activation;
- processing;
- decay;
- hard cap;
- basic mechanical update.

Introduce ping-pong state buffers.

### Acceptance

GPU matches CPU reference on small deterministic charge/mechanics scenarios.

---

## Phase 7 — GPU Spatial Index and Communication

### Objective

Implement the local interaction substrate efficiently.

### Tasks

- periodic cell ID calculation;
- spatial binning/grouping;
- neighbor queries;
- communication scoring;
- probabilistic selection;
- next-step reception buffers.

### Acceptance

GPU neighborhood queries equal brute-force reference results for small systems, and communication events satisfy all admissibility rules.

---

## Phase 8 — GPU Population Dynamics

### Objective

Introduce dynamic population structure.

### Tasks

- health update;
- death masks;
- free-slot tracking;
- local mating candidates;
- recombination;
- mutation;
- offspring state initialization;
- capacity enforcement;
- persistent IDs and genealogy.

### Acceptance

GPU population evolution matches CPU reference on controlled small systems.

---

## Phase 9 — GPU Metrics, Rendering and Realtime Loop

### Objective

Create the public interactive simulation.

### Tasks

- render pipeline;
- particle visual encoding;
- metrics reductions;
- simulation/render decoupling;
- pause/step/reset;
- speed control;
- debug overlays;
- backend indicator.

### Acceptance

The page can execute a complete MFM v3 trajectory in the browser while remaining interactively controllable.

---

## Phase 10 — Experiment Runner

### Objective

Translate Stage IV into executable experiments.

### Tasks

Implement manifests and runners for:

- P0;
- P1;
- P2;
- P3;
- P4;
- delay memory;
- XOR/parity;
- NARMA-10;
- Mackey–Glass;
- Lorenz;
- regime classification;
- A→B→A;
- drift;
- abrupt shifts;
- damage/recovery.

### Acceptance

A complete Stage IV experiment can be launched from a versioned configuration without manually modifying source code.

---

## Phase 11 — Scientific Validation and Performance Characterization

### Objective

Validate the implementation and establish realistic performance regimes.

### Tasks

- CPU/GPU trajectory comparisons;
- statistical equivalence tests;
- performance benchmarks;
- population scaling;
- grid scaling;
- shader profiling;
- memory-usage profiling;
- checkpoint benchmarks.

### Acceptance

The project has a documented validated parameter range and measured performance envelope.

---

## Phase 12 — Public Research Release

### Objective

Publish the simulator as a reproducible scientific web application.

### Tasks

- documentation;
- model specification link;
- reproducibility instructions;
- preset experiments;
- README;
- GitHub Pages deployment;
- experiment export;
- version manifest;
- known limitations.

### Acceptance

A fresh user can open the public page, run the presets, reproduce deterministic runs from a seed, and export experiment metadata/results.

---

# 33. Definition of Done for Stage V

Stage V is considered complete only when all conditions below hold.

## Scientific correctness

- MFM v3 has one authoritative software interpretation.
- All frozen MFM invariants have tests.
- Causal synchronous semantics are enforced.
- CPU reference and GPU backend are cross-validated.
- Population, charge and health are bounded by implementation invariants.

## Reproducibility

- seeds are explicit;
- manifests are exported;
- checkpoints are loadable;
- deterministic same-backend replay succeeds;
- model version and git commit are recorded.

## GPU runtime

- WebGPU backend executes complete MFM v3;
- no full-population CPU readback is needed per frame;
- rendering and simulation share the GPU path;
- CPU fallback exists.

## Experimental completeness

Stage IV protocols are executable without ad hoc source changes.

## Public deployment

The application builds statically and deploys to GitHub Pages.

## Documentation

The repository contains:

- architecture documentation;
- MFM-to-code mapping;
- experiment instructions;
- testing instructions;
- reproducibility instructions.

---

# 34. MFM-to-Code Traceability Matrix

| MFM element | Canonical implementation area | Primary tests |
| --- | --- | --- |
| Torus domain | `model/domain`, `simulation/mechanics` | periodic-distance tests |
| Genotype | `model/genome` | serialization/invariant tests |
| Dynamic state | `model/state` | schema tests |
| Integer charge | `simulation/charge` | exact charge tests |
| Threshold | `simulation/charge` | activation tests |
| Multiplication | `simulation/charge` | processing tests |
| Charge decay | `simulation/charge` | decay tests |
| Communication radius | `simulation/communication` | neighborhood tests |
| Communication preference | `simulation/communication` | score/softmax tests |
| Sampling | `simulation/communication`, `gpu/shaders/communication` | uniqueness/statistical tests |
| Interaction history | `simulation/communication` | history causality tests |
| Local reward | `simulation/evolution` | cycle tests |
| Health | `simulation/evolution` | bounded-health tests |
| Global error | `experiments`, `simulation/evolution` | causal error tests |
| Charge→range coupling | `simulation/mechanics` | range tests |
| Asymmetric force | `simulation/mechanics` | directed-force tests |
| Semi-implicit integration | `simulation/mechanics` | numerical tests |
| Death | `simulation/population` | death tests |
| Reproduction | `simulation/population` | mating tests |
| Recombination | `simulation/population` | inheritance tests |
| Mutation | `simulation/population` | domain-projection tests |
| Population cap | `simulation/population` | capacity tests |
| Fixed I/O | `simulation/io` | protected-particle tests |
| Linear readout | `experiments`, `python/readout` | readout tests |

This matrix is mandatory for implementation reviews: every MFM mechanism must have an owner and a test family.

---

# 35. Scientific Risks During Implementation

## 35.1 Accidental model drift

The largest software risk is implementing a behaviorally similar but mathematically different model.

Examples:

- communication happening within the same timestep;
- decay before instead of after packet consumption;
- force normalization accidentally added;
- implicit Newton-law symmetry;
- readout retraining during continual experiments;
- error influencing current-step output;
- offspring inheriting dynamic charge/history;
- birth replacing an existing particle at capacity.

All such changes must be treated as model changes, not implementation details.

## 35.2 GPU numerical divergence

GPU floating-point behavior may diverge from the CPU oracle.

Mitigation:

- isolate discrete and continuous tests;
- use explicit tolerances;
- validate statistical behavior;
- preserve integer logic where practical.

## 35.3 GPU race conditions

Communication and population allocation are vulnerable to race conditions.

Mitigation:

- next-step buffers;
- deterministic event identifiers;
- bounded allocation schemes;
- staged kernels;
- explicit synchronization between passes.

## 35.4 Performance hiding scientific bugs

An optimized GPU implementation can be very difficult to inspect.

Therefore every production optimization must retain a reference path and a corresponding regression test.

## 35.5 Readout contamination

Continual-learning results can be misleading if the readout is silently retrained.

The UI and experiment manifest must explicitly state:

```text
readout: frozen
```

or:

```text
readout: refit
```

---

# 36. Recommended Development Order

The strict order is:

\[
\boxed{
\text{Schema}
\rightarrow
\text{CPU reference}
\rightarrow
\text{C++ oracle}
\rightarrow
\text{tests}
\rightarrow
\text{GPU primitives}
\rightarrow
\text{GPU MFM}
\rightarrow
\text{rendering}
\rightarrow
\text{experiments}
\rightarrow
\text{public release}
}
\]

The project should **not** begin by implementing the final interactive visualization and then adding scientific correctness afterward.

---

# 37. Immediate First Implementation Milestone

The first actual coding milestone should be:

\[
\boxed{
\text{MFM v3 Phase 0–2 + a complete deterministic one-particle/two-particle testbed}
}
\]

Before introducing the uniform grid, GPU population management, or evolution at scale, the following scenario should work completely:

```text
Input particle
      ↓
charge injection
      ↓
threshold activation
      ↓
processing
      ↓
one selected target
      ↓
next-step reception
      ↓
second activation
      ↓
output particle
      ↓
linear readout
      ↓
error
      ↓
health update
```

with exact step-by-step traceability.

That tiny system will become the canonical debugging fixture for the entire project.

---

# 38. Final Stage V Architecture

The final architecture adopted by this plan is:

```text
                         ┌─────────────────────┐
                         │    MFM v3 Schema    │
                         │ model + invariants  │
                         └──────────┬──────────┘
                                    │
                    ┌───────────────┼────────────────┐
                    │               │                │
                    ▼               ▼                ▼
              TypeScript CPU    C++20 Oracle    Shared Config
                Reference            │
                    │                 │
                    └────────┬────────┘
                             │
                      Cross-validation
                             │
                    ┌────────┴────────┐
                    │                 │
                    ▼                 ▼
                WebGPU Core       Experiment API
                    │                 │
                    │                 ├── P0–P4
                    │                 ├── Memory
                    │                 ├── Nonlinearity
                    │                 ├── Continual learning
                    │                 └── Damage
                    │
              ┌─────┴─────┐
              │           │
           Compute      Render
              │           │
              └─────┬─────┘
                    │
               Web Worker
                    │
                 React UI
                    │
              GitHub Pages
```

The central engineering principle is:

\[
\boxed{
\text{one scientific model} + \text{multiple validated execution backends}
}
\]

rather than multiple independently evolving interpretations of the model.

---

# 39. Stage V Exit Criteria and Transition to Stage VI

Stage V ends when the implementation is capable of producing trustworthy experimental data.

The transition to Stage VI is permitted only after:

1. the MFM v3 behavior is test-complete;
2. the CPU implementation is stable;
3. the C++ oracle agrees with the CPU reference;
4. the GPU backend agrees within validated tolerances;
5. deterministic replay is operational;
6. checkpoints work;
7. Stage IV experiment manifests execute automatically;
8. the browser application can run the complete MFM;
9. metrics and logs are exportable;
10. the deployment is reproducible from the repository.

At that point Stage VI is no longer a software-validation phase. It becomes a genuinely empirical investigation of the hypotheses defined in Stages I–IV.

---

# 40. References and Technical Foundations

1. WebGPU API — MDN Web Docs. <https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API>
2. GPU API — MDN Web Docs. <https://developer.mozilla.org/en-US/docs/Web/API/GPU>
3. Vite — Static Deployment Guide. <https://vite.dev/guide/static-deploy>
4. GitHub Pages — Creating a GitHub Pages site. <https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site>
5. Dambre, J., Verstraeten, D., Schrauwen, B., & Massar, S. (2012). Information Processing Capacity of Dynamical Systems. _Scientific Reports_, 2, 514. <https://doi.org/10.1038/srep00514>
6. Maass, W., Natschläger, T., & Markram, H. (2002). Real-time computing without stable states. _Neural Computation_, 14(11), 2531–2560. <https://doi.org/10.1162/089976602760407955>
7. Stepney, S. (2024). Physical reservoir computing: A tutorial. _Natural Computing_, 23, 665–685. <https://doi.org/10.1007/s11047-024-09997-y>
8. Wang, X., & Cichos, F. (2024). Harnessing synthetic active particles for physical reservoir computing. _Nature Communications_, 15, 774. <https://doi.org/10.1038/s41467-024-44856-5>
9. Mordvintsev, A., Randazzo, E., Niklasson, E., & Levin, M. (2020). Growing Neural Cellular Automata. _Distill_, 5(2), e00023. <https://doi.org/10.23915/distill.00023>
10. Pajouheshgar, E., Kim, H., Süsstrunk, S., Jakob, W., & Park, J. (2026). Neural Particle Automata: Learning Self-Organizing Particle Dynamics. _SIGGRAPH 2026_. <https://doi.org/10.1145/3799902.3811052>
11. Li, J., Bauer, R., Rentzeperis, I., & van Leeuwen, C. (2024). Adaptive rewiring: A general principle for neural network development. _Frontiers in Network Physiology_, 4, 1410092. <https://doi.org/10.3389/fnetp.2024.1410092>
12. Holtmaat, A., & Svoboda, K. (2009). Experience-dependent structural synaptic plasticity in the mammalian brain. _Nature Reviews Neuroscience_, 10, 647–658. <https://doi.org/10.1038/nrn2699>
13. Lenski, R. E., et al. (2003). The evolutionary origin of complex features. _Nature_, 423, 139–144. <https://doi.org/10.1038/nature01568>

---

# 41. Stage V Summary

Stage V defines CEPC as a **GPU-first browser research platform with a scientifically independent reference layer**.

The final design is:

\[
\boxed{
\text{MFM v3}
\rightarrow
\text{typed model}
\rightarrow
\text{CPU reference}
\rightarrow
\text{independent C++ oracle}
\rightarrow
\text{WebGPU implementation}
\rightarrow
\text{real-time browser}
}
\]

while Stage IV becomes executable through:

\[
\boxed{
\text{Experiment Manifest}
\rightarrow
\text{Simulation}
\rightarrow
\text{Readout}
\rightarrow
\text{Metrics}
\rightarrow
\text{Statistical Analysis}
}
\]

The scientific safeguard is that the implementation is never allowed to become the definition of the model. The MFM v3 remains the authoritative specification, and every optimized GPU mechanism must be validated against it.
