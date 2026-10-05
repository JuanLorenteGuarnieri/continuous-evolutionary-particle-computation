/**
 * Phase 15 — scenario runner for synchronization accounting.
 *
 * Drives the REAL `MfmWebGPUStepper` (its real orchestration code) against the
 * mock device in mock-gpu.ts and records, for every timestep:
 *   - device-level counters (submits, awaited maps, onSubmittedWorkDone,
 *     GPU->CPU / CPU->GPU bytes, ...), independent of the stepper's own profiler;
 *   - a canonical digest of the *GPU-visible* state (positions, velocities,
 *     health, charge, pending incoming charge, keyed by ParticleID) and of the
 *     CPU topology (ids, roles, sender sets).
 *
 * The digests are the behavioural oracle used to prove that a change to the
 * synchronization code does not change what the GPU (or the CPU topology)
 * ends up holding. They are only as strong as the kernel emulator: they check
 * orchestration, not WGSL.
 *
 * The stepper class is a parameter so that the same scenarios can be run
 * against the Phase 14 baseline and the current sources (tools/bench/sync-accounting.mjs).
 */
import { createHash } from 'node:crypto';
import { Genome, createBenchmarkScenario } from '@cepc/shared-config';
import { MetricsReducer } from '@cepc/webgpu-core';
import {
  type DeviceCounters,
  MockDevice,
  diffCounters,
  emptyCounters,
  installWebGpuGlobals,
} from './mock-gpu';
import { type KernelScript, createKernelEmulator } from './kernel-emulator';

export type StepDriver =
  /** `stepper.step()`: the headless path (benchmark renderEnabled=false). */
  | 'step'
  /**
   * The interactive worker path (`encodeAndSubmitWebGPUStep`): encodeStep ->
   * submit -> [waitAfterSubmit] -> finishNormalSync. Render encoding is omitted
   * (it adds no synchronization).
   */
  | 'encodeStep';

export type MetricsMode =
  | 'none'
  /** stepper.readChargeMetrics() only. */
  | 'stepper'
  /**
   * What the worker does per frame. Phase 15 worker: stepper.readPopulationMetrics() (one readback).
   * Phase 14 worker (stepper without that method): MetricsReducer.computeMetrics() + readChargeMetrics().
   */
  | 'worker';

export interface ScenarioDefinition {
  name: string;
  description: string;
  particleCount: number;
  capacity: number;
  steps: number;
  seed?: number;
  overrides?: Record<string, number>;
  /** Adjusts the freshly built scenario before the stepper is created (e.g. to force a GPU buffer-shape change). */
  prepare?: (scenario: { population: any; config: any }) => void;
  script: KernelScript;
  driver: StepDriver;
  metrics: MetricsMode;
  /**
   * encodeStep driver only: reproduce the Phase 14 worker's unconditional onSubmittedWorkDone
   * between submit and finishNormalSync (removed in Phase 15).
   */
  waitAfterSubmit?: boolean;
}

export interface StepRecord {
  timestep: number;
  populationBefore: number;
  populationAfter: number;
  structureChanged: boolean;
  counters: DeviceCounters;
  gpuDigest: string;
  cpuDigest: string;
  /** Phase 16: digest of this step's normalized dispatch records (see MockDevice.dispatchTrace); '' unless traced. */
  dispatchDigest: string;
  /** Phase 16: number of dispatch records the step executed (0 unless traced). */
  dispatchRecords: number;
}

/** Phase 16: per-run options of runScenario (all optional; defaults reproduce Phase 15 behaviour). */
export interface RunOptions {
  /** Orchestration switches applied through setOrchestrationOptions() when the stepper has it (Phase 16+). */
  orchestration?: { bindGroupCache?: boolean; packParamWrites?: boolean; quietFastPath?: boolean; pipelineDepth?: 1 | 2 };
  /** Phase 18: kernel switches applied through setKernelOptions() before init (the Phase 15 golden traces need forceKernel 'linked-list'). */
  kernels?: { forceKernel?: 'linked-list' | 'sorted' | 'sorted-culled'; deathCompaction?: 'serial' | 'parallel' };
  /** Record the normalized dispatch trace and fill StepRecord.dispatchDigest. */
  traceDispatches?: boolean;
}

export interface ScenarioResult {
  name: string;
  description: string;
  driver: StepDriver;
  metrics: MetricsMode;
  particleCount: number;
  capacity: number;
  steps: StepRecord[];
  totals: DeviceCounters;
  /** Counters accumulated during device/stepper initialization (excluded from `steps`). */
  initCounters: DeviceCounters;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type StepperLike = {
  init(): Promise<void>;
  step(): Promise<unknown>;
  syncFullCpuState(): Promise<any>;
  enableProfiling(options?: { cpu?: boolean; gpuTimestamps?: boolean }): unknown;
  commitProfilingStep(): void;
  getProfilingReport(): { cpu: { counters: Array<{ counter: string; total: number }> } };
  encodeStep(encoder: any): Promise<{ finishNormalSync(): Promise<unknown> }>;
  notifyStepSubmitted(): void;
  readChargeMetrics(): Promise<unknown>;
  readPopulationMetrics?(): Promise<unknown>;
  getRenderState(): { health: any; charge: any; particleCount: number };
  destroy(): void;
};
export type StepperConstructor = new (device: any, config: any, population: any, seed?: number) => StepperLike;

function digest(parts: string[]): string {
  return createHash('sha256').update(parts.join('\n')).digest('hex').slice(0, 16);
}

/** Canonical GPU-visible state, keyed by ParticleID so it is independent of slot order. */
function gpuStateDigest(stepper: any): string {
  const stateIndex: number = stepper.stateIndex;
  const count: number = stepper.particleCount;
  const positions = new Float32Array(stepper.positionBuffers[stateIndex].data);
  const velocities = new Float32Array(stepper.velocityBuffers[stateIndex].data);
  const healths = new Float32Array(stepper.healthBuffers[stateIndex].data);
  const charges = new Uint32Array(stepper.chargeBuffers[stateIndex].data);
  const incoming = new Uint32Array(stepper.incomingChargeBuffers[stepper.incomingIndex].data);
  // CPU-owned static columns (role, id hash, genome-derived parameters), compared as raw 32-bit
  // words so a wrong slot, a stale column or a shifted range cannot hide behind float formatting.
  const staticBuffers = [
    'roleBuffer', 'particleIdHashBuffer', 'genomeHMaxBuffer', 'genomeMateHealthThresholdBuffer',
    'genomeThetaQBuffer', 'genomeABuffer', 'genomeKBuffer', 'genomeRcBuffer', 'genomeMBuffer',
    'genomeGammaBuffer', 'genomeRsBuffer', 'genomeOmegaRBuffer', 'genomeOmegaABuffer', 'genomeOmegaVBuffer',
  ].map((name) => new Uint32Array(stepper[name].data));
  const rows: string[] = [];
  for (let slot = 0; slot < count; slot++) {
    rows.push(
      [
        stepper.slotToId[slot],
        staticBuffers.map((b) => b[slot]).join(','),
        positions[slot * 2],
        positions[slot * 2 + 1],
        velocities[slot * 2],
        velocities[slot * 2 + 1],
        healths[slot],
        charges[slot],
        incoming[slot],
      ].join('|'),
    );
  }
  rows.sort();
  return digest([`n=${count}`, ...rows]);
}

/** Canonical CPU topology: ids, roles, sender sets, and the CPU-side pending-incoming map. */
function cpuTopologyDigest(stepper: any): string {
  const rows: string[] = [];
  for (const [id, state] of stepper.population.particles as Map<string, any>) {
    rows.push(
      [
        id,
        state.role,
        [...state.senderSet].sort().join(','),
        [...state.prevSenderSet].sort().join(','),
      ].join('|'),
    );
  }
  rows.sort();
  const incoming = [...(stepper.incomingChargeMap as Map<string, number>).entries()]
    .map(([id, value]) => `${id}=${value}`)
    .sort();
  return digest([...rows, '--incoming--', ...incoming]);
}

/** Builds the scenario's stepper on a software device and returns it initialized, for tests that drive it by hand. */
export async function openScenario(
  definition: ScenarioDefinition,
  Stepper: StepperConstructor,
  kernels?: RunOptions['kernels'],
  orchestration?: RunOptions['orchestration'],
): Promise<{ device: MockDevice; stepper: StepperLike; inner: any }> {
  installWebGpuGlobals();
  const scenario = createBenchmarkScenario({
    particleCount: definition.particleCount,
    capacity: definition.capacity,
    seed: definition.seed ?? 42,
    overrides: definition.overrides as any,
  });
  definition.prepare?.(scenario as any);
  const device = new MockDevice();
  device.emulator = createKernelEmulator(definition.script, [...scenario.population.particles.keys()]);
  const stepper = new Stepper(device as any, scenario.config, scenario.population, scenario.seed);
  if (kernels && typeof (stepper as any).setKernelOptions === 'function') (stepper as any).setKernelOptions(kernels);
  if (orchestration && typeof (stepper as any).setOrchestrationOptions === 'function') (stepper as any).setOrchestrationOptions(orchestration);
  await stepper.init();
  return { device, stepper, inner: stepper as any };
}

export async function runScenario(
  definition: ScenarioDefinition,
  Stepper: StepperConstructor,
  options: RunOptions = {},
): Promise<ScenarioResult> {
  installWebGpuGlobals();
  const scenario = createBenchmarkScenario({
    particleCount: definition.particleCount,
    capacity: definition.capacity,
    seed: definition.seed ?? 42,
    overrides: definition.overrides as any,
  });
  definition.prepare?.(scenario as any);
  const knownIds = [...scenario.population.particles.keys()];

  const device = new MockDevice();
  device.emulator = createKernelEmulator(definition.script, knownIds);

  const stepper = new Stepper(device as any, scenario.config, scenario.population, scenario.seed);
  if (options.orchestration && typeof (stepper as any).setOrchestrationOptions === 'function') {
    (stepper as any).setOrchestrationOptions(options.orchestration);
  }
  if (options.kernels && typeof (stepper as any).setKernelOptions === 'function') {
    (stepper as any).setKernelOptions(options.kernels);
  }
  await stepper.init();
  const inner = stepper as any;

  const unifiedMetrics = typeof stepper.readPopulationMetrics === 'function';
  let reducer: any = null;
  if (definition.metrics === 'worker' && !unifiedMetrics) {
    reducer = new MetricsReducer(device as any);
    await reducer.init();
  }
  const initCounters = device.snapshotCounters();

  const steps: StepRecord[] = [];
  for (let i = 0; i < definition.steps; i++) {
    const before = device.snapshotCounters();
    const populationBefore = inner.population.particles.size as number;
    const slotsBefore = (inner.slotToId as string[]).join('|');
    if (options.traceDispatches) device.dispatchTrace = [];

    if (definition.driver === 'step') {
      await stepper.step();
    } else {
      const encoder = device.createCommandEncoder({ label: `driver-step-${i}` });
      const encoded = await stepper.encodeStep(encoder);
      device.queue.submit([encoder.finish()]);
      stepper.notifyStepSubmitted();
      if (definition.waitAfterSubmit ?? false) await device.queue.onSubmittedWorkDone();
      await encoded.finishNormalSync();
    }

    if (definition.metrics === 'worker') {
      if (unifiedMetrics) {
        await stepper.readPopulationMetrics!();
      } else {
        const current = stepper.getRenderState();
        reducer.setBuffers(current.health, current.charge, current.particleCount);
        await reducer.computeMetrics();
        await stepper.readChargeMetrics();
      }
    } else if (definition.metrics === 'stepper') {
      await stepper.readChargeMetrics();
    }

    const after = device.snapshotCounters();
    const populationAfter = inner.population.particles.size as number;
    steps.push({
      timestep: i,
      populationBefore,
      populationAfter,
      // Membership/order of the slot mapping changed (also catches a death and a birth in the same step).
      structureChanged: (inner.slotToId as string[]).join('|') !== slotsBefore,
      counters: diffCounters(after, before),
      gpuDigest: gpuStateDigest(inner),
      cpuDigest: cpuTopologyDigest(inner),
      dispatchDigest: device.dispatchTrace ? digest(device.dispatchTrace) : '',
      dispatchRecords: device.dispatchTrace ? device.dispatchTrace.length : 0,
    });
  }

  const totals = emptyCounters();
  for (const record of steps) {
    for (const key of Object.keys(totals) as Array<keyof DeviceCounters>) totals[key] += record.counters[key];
  }
  stepper.destroy();
  return {
    name: definition.name,
    description: definition.description,
    driver: definition.driver,
    metrics: definition.metrics,
    particleCount: definition.particleCount,
    capacity: definition.capacity,
    steps,
    totals,
    initCounters,
  };
}

// ---------------------------------------------------------------------------
// Scenario matrix
// ---------------------------------------------------------------------------

const quiet: KernelScript = {};

/** Births need >= 2 eligible parents: mating_probability=1 and a mating radius larger than the domain. */
const BIRTH_OVERRIDES = { mating_probability: 1, mate_radius_percent: 1000 };

function churnScript(deathEvery: number, birthEvery: number): KernelScript {
  return {
    healthDrop: (id, t) => (id.startsWith('particle-') && t > 0 && t % deathEvery === 0 && id === `particle-${t % 7}` ? 1e9 : 0),
    success: (id, t) => t > 0 && t % birthEvery === 0 && (id === 'particle-8' || id === 'particle-9'),
    events: (t, ids) => (ids.length > 3 ? [[ids[2], ids[3]]] : []),
  };
}

const liveInternal = (ids: string[]): string[] => ids.filter((id) => id.startsWith('particle-'));

export function defaultScenarios(driver: StepDriver, metrics: MetricsMode, waitAfterSubmit = false): ScenarioDefinition[] {
  const common = { driver, metrics, waitAfterSubmit };
  return [
    {
      ...common,
      name: 'steady-no-repro',
      description: 'Population at capacity (reproduction compaction disabled), no events. The pure normal-step cost.',
      particleCount: 60,
      capacity: 60,
      steps: 24,
      script: quiet,
    },
    {
      ...common,
      name: 'steady-repro-enabled',
      description:
        'Capacity headroom + mating_probability>0 (reproduction compaction enabled) but no eligible parents. ' +
        'Communication events are produced every step but never needed by the CPU.',
      particleCount: 60,
      capacity: 70,
      steps: 24,
      overrides: { mating_probability: 0.5 },
      script: { events: (_t, ids) => (ids.length > 3 ? [[ids[2], ids[3]], [ids[4], ids[5]]] : []) },
    },
    {
      ...common,
      name: 'single-death',
      description: 'One internal particle dies at step 8; nothing else happens.',
      particleCount: 60,
      capacity: 60,
      steps: 24,
      script: { healthDrop: (id, t) => (id === 'particle-5' && t === 8 ? 1e9 : 0) },
    },
    {
      ...common,
      name: 'single-birth',
      description: 'Two eligible parents at step 8 produce offspring; nobody dies.',
      particleCount: 60,
      capacity: 70,
      steps: 24,
      overrides: BIRTH_OVERRIDES,
      script: { success: (id, t) => t === 8 && (id === 'particle-8' || id === 'particle-9') },
    },
    {
      ...common,
      name: 'multi-death',
      description:
        'Four deaths in one step: the first internal slot, an adjacent pair, a middle slot and the LAST slot ' +
        '(exercises head, interior and tail copy runs).',
      particleCount: 60,
      capacity: 60,
      steps: 24,
      script: {
        healthDrop: (id, t) => (t === 8 && ['particle-0', 'particle-1', 'particle-30', 'particle-57'].includes(id) ? 1e9 : 0),
        events: (_t, ids) => (liveInternal(ids).length > 6 ? [[ids[3], ids[4]], [ids[10], ids[2]]] : []),
      },
    },
    {
      ...common,
      name: 'death-and-birth',
      description: 'One death and one birth in the SAME step, with message traffic (pending incoming charge must survive).',
      particleCount: 60,
      capacity: 70,
      steps: 24,
      overrides: BIRTH_OVERRIDES,
      script: {
        healthDrop: (id, t) => (t === 8 && id === 'particle-5' ? 1e9 : 0),
        success: (id, t) => t === 8 && (id === 'particle-8' || id === 'particle-9'),
        events: (_t, ids) => (ids.length > 12 ? [[ids[3], ids[7]], [ids[6], ids[20]], [ids[9], ids[2]]] : []),
      },
    },
    {
      ...common,
      name: 'shape-change-fallback',
      description:
        'The two particles with the largest K die in turn, so the required maxK (hence the GPU buffer shape) ' +
        'shrinks twice: buffers are recreated and the full-readback + full-upload fallback path runs.',
      particleCount: 60,
      capacity: 60,
      steps: 24,
      prepare: (scenario) => {
        const raise = (id: string, delta: number): void => {
          const g = scenario.population.genomes.get(id);
          scenario.population.genomes.set(
            id,
            new Genome({
              version: g.version, H_max: g.H_max, theta_q: g.theta_q, A: g.A, K: g.K + delta, R_c: g.R_c,
              m: g.m, gamma: g.gamma, R_s: g.R_s, omega_R: g.omega_R, omega_A: g.omega_A, omega_v: g.omega_v,
            }),
          );
        };
        raise('particle-4', 2);
        raise('particle-9', 1);
      },
      script: { healthDrop: (id, t) => ((t === 6 && id === 'particle-4') || (t === 14 && id === 'particle-9') ? 1e9 : 0) },
    },
    {
      ...common,
      name: 'churn',
      description: 'Deaths every 5th step and births every 4th step with message traffic: repeated restructuring.',
      particleCount: 60,
      capacity: 70,
      steps: 40,
      overrides: BIRTH_OVERRIDES,
      script: churnScript(5, 4),
    },
    {
      ...common,
      name: 'churn-large',
      description: 'Same churn pattern at 400 particles (byte scaling of the restructuring path).',
      particleCount: 400,
      capacity: 440,
      steps: 40,
      overrides: BIRTH_OVERRIDES,
      script: churnScript(5, 4),
    },
  ];
}
