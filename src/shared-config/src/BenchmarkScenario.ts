import { Genome } from './Genome.js';
import { MFMConfig } from './MFMConfig.js';
import { ParticleState } from './ParticleState.js';
import { PopulationState } from './PopulationState.js';
import type { ParticleID } from './types.js';

/**
 * Phase 14 — deterministic benchmark scenario.
 *
 * Purpose: give the Node CPU-reference benchmark and the browser WebGPU
 * benchmark the *same* workload definition, so their numbers are comparable
 * and reproducible from a seed.
 *
 * The parameter values are the defaults of the React UI (main.tsx) and the
 * population layout mirrors `createInitialPopulation()` in the web worker
 * (one input, one output, the rest internal with uniformly random positions
 * and small random velocities). It is a mirror, not a shared implementation:
 * the random stream differs from the worker's, so populations are
 * statistically equivalent but not bitwise identical.
 *
 * Density control: with the UI default of 200 particles in a 10 x 10 domain
 * (density 2 particles per unit area), a fixed domain would make the per-
 * particle neighbourhood grow linearly with N. To measure *scaling of the
 * implementation* rather than scaling of the physical density, the domain
 * side is scaled as sqrt(N / density) by default so the expected number of
 * neighbours per particle is constant across N. Pass `density` explicitly
 * for density sweeps.
 */

export interface BenchmarkScenarioOptions {
  /** Initial number of particles, including one input and one output particle. */
  particleCount: number;
  /**
   * Population capacity (Nmax). Defaults to `particleCount`, which matches the
   * application (initial population == capacity). Values above `particleCount`
   * leave headroom so that the reproduction-compaction pass is enabled.
   */
  capacity?: number;
  /** Particles per unit area. Default 2 (UI default: 200 particles in 10 x 10). */
  density?: number;
  seed?: number;
  /** Overrides applied to the UI-default parameters (e.g. mating_probability). */
  overrides?: Partial<BenchmarkParameters>;
}

/** UI-default simulation parameters (names follow the worker `init` config). */
export interface BenchmarkParameters {
  dt: number;
  Qmax: number;
  R_s_min: number;
  R_s_max: number;
  Q_in_max: number;
  Hmax: number;
  theta_q: number;
  A: number;
  K: number;
  Rc: number;
  m: number;
  gamma: number;
  Rs: number;
  omega_R: number;
  omega_A: number;
  omega_v: number;
  genome_variation: number;
  mate_radius_percent: number;
  mate_health_percent: number;
  birth_health_percent: number;
  mating_probability: number;
  communication_alpha: number;
}

export const UI_DEFAULT_BENCHMARK_PARAMETERS: Readonly<BenchmarkParameters> = Object.freeze({
  dt: 0.1,
  Qmax: 100,
  R_s_min: 0.5,
  R_s_max: 5.0,
  Q_in_max: 50,
  Hmax: 50,
  theta_q: 10,
  A: 1,
  K: 1,
  Rc: 1.0,
  m: 1.0,
  gamma: 0.8,
  Rs: 1.0,
  omega_R: 0.1,
  omega_A: -0.5,
  omega_v: -0.5,
  genome_variation: 0.35,
  // The UI stores percentages and divides by 100 before sending them.
  mate_radius_percent: 0.8,
  mate_health_percent: 0.9,
  birth_health_percent: 0.1,
  mating_probability: 0.01,
  communication_alpha: 1,
});

export interface BenchmarkScenario {
  particleCount: number;
  capacity: number;
  density: number;
  seed: number;
  Lx: number;
  Ly: number;
  parameters: BenchmarkParameters;
  /** The MFMConfig used by the CPU reference. */
  config: MFMConfig;
  /** Initial population for the CPU reference. */
  population: PopulationState;
  /**
   * The exact `config` object the worker's `init` message expects
   * (see main.tsx). `initialParticles` is the Phase 14 addition that lets the
   * initial population be smaller than `maxParticles` (= Nmax).
   */
  workerConfig: Record<string, unknown>;
}

/** mulberry32: small, fast, deterministic PRNG. */
function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createBenchmarkScenario(options: BenchmarkScenarioOptions): BenchmarkScenario {
  const particleCount = Math.max(3, Math.floor(options.particleCount));
  const capacity = Math.max(particleCount, Math.floor(options.capacity ?? particleCount));
  const density = options.density ?? 2;
  const seed = options.seed ?? 42;
  const parameters: BenchmarkParameters = { ...UI_DEFAULT_BENCHMARK_PARAMETERS, ...(options.overrides ?? {}) };

  // Domain side scales so that particles-per-area equals `density` for the initial population.
  const side = Math.sqrt(particleCount / density);
  const Lx = side;
  const Ly = side;

  const random = createRandom(seed || 1);
  const between = (min: number, max: number): number => min + (max - min) * random();
  const varied = (value: number, variation: number, minimum: number): number =>
    Math.max(minimum, value * (1 + between(-variation, variation)));

  const config = new MFMConfig({
    Lx,
    Ly,
    Nmax: capacity,
    dt: parameters.dt,
    seed,
    Qmax: parameters.Qmax,
    R_s_min: parameters.R_s_min,
    R_s_max: parameters.R_s_max,
    Q_in_max: parameters.Q_in_max,
    Hmax: parameters.Hmax,
    theta_q: parameters.theta_q,
    A: parameters.A,
    K: parameters.K,
    Rc: parameters.Rc,
    m: parameters.m,
    gamma: parameters.gamma,
    Rs: parameters.Rs,
    omega_R: parameters.omega_R,
    omega_A: parameters.omega_A,
    omega_v: parameters.omega_v,
    genome_variation: parameters.genome_variation,
    mate_radius_percent: parameters.mate_radius_percent,
    mate_health_percent: parameters.mate_health_percent,
    birth_health_percent: parameters.birth_health_percent,
    mating_probability: parameters.mating_probability,
    communication_alpha: parameters.communication_alpha,
  });

  const variation = Math.max(0, Math.min(1, parameters.genome_variation));
  const makeGenome = (vary: boolean): Genome =>
    new Genome({
      H_max: vary ? varied(parameters.Hmax, variation, 1) : parameters.Hmax,
      theta_q: vary ? Math.max(1, Math.round(varied(parameters.theta_q, variation, 1))) : parameters.theta_q,
      A: vary ? varied(parameters.A, variation, 0.01) : parameters.A,
      K: vary ? Math.max(1, Math.round(varied(parameters.K, variation, 1))) : parameters.K,
      R_c: vary ? varied(parameters.Rc, variation, 0.01) : parameters.Rc,
      m: vary ? varied(parameters.m, variation, 0.01) : parameters.m,
      gamma: vary ? varied(parameters.gamma, variation, 0) : parameters.gamma,
      R_s: vary ? varied(parameters.Rs, variation, 0.01) : parameters.Rs,
      omega_R: vary ? varied(parameters.omega_R, variation, -Infinity) : parameters.omega_R,
      omega_A: vary ? varied(parameters.omega_A, variation, -Infinity) : parameters.omega_A,
      omega_v: vary ? varied(parameters.omega_v, variation, -Infinity) : parameters.omega_v,
    });

  const population = new PopulationState();
  const add = (id: string, role: 'internal' | 'input' | 'output', x: number, y: number): void => {
    const genome = makeGenome(role === 'internal');
    const speed = role === 'internal' ? between(0.05, 0.2) : 0;
    const angle = between(0, Math.PI * 2);
    population.addParticle(
      id as ParticleID,
      genome,
      new ParticleState({
        version: '3.0.0',
        position: role === 'internal' ? { x: between(0, Lx), y: between(0, Ly) } : { x, y },
        velocity: { x: speed * Math.cos(angle), y: speed * Math.sin(angle) },
        health: genome.H_max,
        charge: 0,
        senderSet: new Set(),
        prevSenderSet: new Set(),
        role,
      }),
    );
  };

  add('input-0', 'input', Lx * 0.25, Ly * 0.25);
  add('output-0', 'output', Lx * 0.75, Ly * 0.75);
  const internalCount = particleCount - 2;
  for (let index = 0; index < internalCount; index++) {
    add(`particle-${index}`, 'internal', 0, 0);
  }

  const workerConfig: Record<string, unknown> = {
    Lx,
    Ly,
    dt: parameters.dt,
    Qmax: parameters.Qmax,
    R_s_min: parameters.R_s_min,
    R_s_max: parameters.R_s_max,
    maxParticles: capacity,
    initialParticles: particleCount,
    seed,
    Hmax: parameters.Hmax,
    theta_q: parameters.theta_q,
    A: parameters.A,
    K: parameters.K,
    Rc: parameters.Rc,
    m: parameters.m,
    gamma: parameters.gamma,
    Rs: parameters.Rs,
    omega_R: parameters.omega_R,
    omega_A: parameters.omega_A,
    omega_v: parameters.omega_v,
    Q_in_max: parameters.Q_in_max,
    inputSignal: 0,
    genome_variation: parameters.genome_variation,
    mate_radius_percent: parameters.mate_radius_percent,
    mate_health_percent: parameters.mate_health_percent,
    birth_health_percent: parameters.birth_health_percent,
    mating_probability: parameters.mating_probability,
    communication_alpha: parameters.communication_alpha,
  };

  return { particleCount, capacity, density, seed, Lx, Ly, parameters, config, population, workerConfig };
}
