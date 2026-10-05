/**
 * Phase 15 — synchronization regression tests.
 *
 * Runs the real MfmWebGPUStepper against the software GPUDevice in
 * tests/support/mock-gpu.ts. Two independent guarantees:
 *
 *  1. BEHAVIOUR: for every scenario, the per-step digest of the GPU-visible
 *     state (keyed by ParticleID) and of the CPU topology equals the trace
 *     recorded from the unmodified Phase 14 stepper (tests/golden). Any change
 *     to the synchronization code that alters what the GPU or the CPU topology
 *     ends up holding fails here.
 *
 *  2. SYNCHRONIZATION BUDGET: structural upper bounds on the number of serial
 *     GPU waits, queue submissions and GPU->CPU bytes. These are counts taken
 *     at the device boundary, not timings.
 *
 * LIMITS (be explicit): kernels are emulated (kernel-emulator.ts), WGSL is not
 * executed, and nothing here measures time. Passing proves the CPU-side
 * orchestration is behaviour-preserving against the emulated kernels; it does
 * not validate shaders or performance. Run `pnpm run benchmark:webgpu` in a
 * real browser for those.
 */
import { beforeAll, describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MfmWebGPUStepper } from '../src/MfmWebGPUStepper';
import { MockDevice, USAGE } from './support/mock-gpu';
import { defaultScenarios, openScenario, runScenario, type ScenarioResult } from './support/sync-scenarios';

const here = dirname(fileURLToPath(import.meta.url));
const golden = JSON.parse(readFileSync(resolve(here, 'golden/phase14-sync-traces.json'), 'utf-8')) as {
  scenarios: Record<string, Array<[number, string, string]>>;
};

const mean = (values: number[]): number => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0);
const max = (values: number[]): number => (values.length ? Math.max(...values) : 0);

async function run(driver: 'step' | 'encodeStep', metrics: 'none' | 'worker'): Promise<ScenarioResult[]> {
  const results: ScenarioResult[] = [];
  for (const scenario of defaultScenarios(driver, metrics, false)) {
    results.push(await runScenario(scenario, MfmWebGPUStepper as never));
  }
  return results;
}

describe('WebGPU synchronization (structural, software device)', () => {
  it('software device rejects the misuse the stepper must avoid', async () => {
    const device = new MockDevice();
    const staging = device.createBuffer({ size: 16, usage: USAGE.MAP_READ | USAGE.COPY_DST, label: 'staging' });
    await staging.mapAsync(1);
    // double map
    await expect(staging.mapAsync(1)).rejects.toThrow(/already mapped/);
    // submit that touches a mapped buffer
    const source = device.createBuffer({ size: 16, usage: USAGE.COPY_SRC, label: 'source' });
    const encoder = device.createCommandEncoder();
    encoder.copyBufferToBuffer(source, 0, staging, 0, 16);
    expect(() => device.queue.submit([encoder.finish()])).toThrow(/mapped/);
    // use of a mapped range after unmap
    const view = staging.getMappedRange();
    staging.unmap();
    expect(view.byteLength).toBe(0);
  });

  describe('headless step()', () => {
    let results: ScenarioResult[];
    beforeAll(async () => {
      results = await run('step', 'none');
    }, 120_000);

    it('covers every golden scenario', () => {
      expect(results.map((r) => r.name).sort()).toEqual(Object.keys(golden.scenarios).sort());
    });

    it('matches the Phase 14 GPU-state and CPU-topology traces exactly', () => {
      for (const result of results) {
        const expected = golden.scenarios[result.name];
        expect(expected, result.name).toBeDefined();
        const actual = result.steps.map((s) => [s.populationAfter, s.gpuDigest, s.cpuDigest]);
        expect(actual, result.name).toEqual(expected);
      }
    });

    it('a quiet timestep costs one queue submission and one serial GPU wait', () => {
      for (const result of results) {
        const quiet = result.steps.filter((s) => !s.structureChanged);
        expect(quiet.length).toBeGreaterThan(0);
        expect(max(quiet.map((s) => s.counters.submits)), result.name).toBeLessThanOrEqual(1);
        expect(max(quiet.map((s) => s.counters.waitEpochs)), result.name).toBeLessThanOrEqual(1);
        expect(max(quiet.map((s) => s.counters.onSubmittedWorkDone)), result.name).toBe(0);
        // 12-byte count summary copied by the step itself + a 12-byte staging copy: nothing per-particle.
        expect(max(quiet.map((s) => s.counters.gpuToCpuCopyBytes)), result.name).toBeLessThanOrEqual(12);
      }
    });

    it('a population-structure step needs at most 3 serial GPU waits (summary, payload, fallback full sync)', () => {
      for (const result of results) {
        for (const step of result.steps.filter((s) => s.structureChanged)) {
          expect(step.counters.waitEpochs, `${result.name} t=${step.timestep}`).toBeLessThanOrEqual(3);
          expect(step.counters.onSubmittedWorkDone, `${result.name} t=${step.timestep}`).toBe(0);
        }
      }
    });

    it('restructuring with an unchanged buffer shape reads back NO dynamic state and recreates NO buffers', () => {
      for (const result of results.filter((r) => r.name !== 'shape-change-fallback')) {
        // Full dynamic readback would be 24 B/particle; the compact event payload is a few dozen bytes.
        const fullReadbackBytes = 24 * result.particleCount;
        for (const step of result.steps) {
          expect(step.counters.buffersCreated, `${result.name} t=${step.timestep}`).toBe(0);
          expect(step.counters.gpuToCpuCopyBytes, `${result.name} t=${step.timestep}`).toBeLessThanOrEqual(256);
          expect(step.counters.gpuToCpuCopyBytes, `${result.name} t=${step.timestep}`).toBeLessThan(fullReadbackBytes);
          // in-place restructure: at most the 2 serial waits of summary + payload
          expect(step.counters.waitEpochs, `${result.name} t=${step.timestep}`).toBeLessThanOrEqual(2);
        }
      }
    });

    it('the explicit fallback (buffer shape change) still performs the full readback and rebuild', () => {
      const result = results.find((r) => r.name === 'shape-change-fallback')!;
      const rebuilt = result.steps.filter((s) => s.counters.buffersCreated > 0);
      expect(rebuilt.length, 'fallback scenario must actually recreate buffers').toBe(2);
      for (const step of rebuilt) {
        expect(step.counters.gpuToCpuCopyBytes, `t=${step.timestep}`).toBeGreaterThan(24 * (step.populationBefore - 1));
      }
    });

    it('never leaves a staging buffer mapped', () => {
      // The mock throws on double-map / submit-while-mapped, so completing every scenario proves it.
      for (const result of results) expect(result.steps.length, result.name).toBeGreaterThan(0);
    });
  });

  describe('explicit full synchronization and CPU-mirror contract', () => {
    const counter = (stepper: any, name: string): number =>
      stepper.getProfilingReport().cpu.counters.find((c: { counter: string }) => c.counter === name)?.total ?? 0;

    it('syncFullCpuState() returns exactly the GPU-resident state after in-place restructures', async () => {
      const definition = defaultScenarios('step', 'none').find((d) => d.name === 'death-and-birth')!;
      const { stepper, inner } = await openScenario(definition, MfmWebGPUStepper as never);
      stepper.enableProfiling({ cpu: true });
      for (let i = 0; i < definition.steps; i++) {
        await stepper.step();
        stepper.commitProfilingStep(); // the caller that drives the step closes the profiling window
      }
      expect(counter(stepper, 'restructure.inPlace')).toBe(1);
      expect(counter(stepper, 'sync.fullSyncs')).toBe(0); // nothing exceptional happened on the normal path

      const population = await stepper.syncFullCpuState();
      stepper.commitProfilingStep();
      expect(counter(stepper, 'sync.fullSyncs.explicit')).toBe(1);

      const index: number = inner.stateIndex;
      const positions = new Float32Array(inner.positionBuffers[index].data);
      const velocities = new Float32Array(inner.velocityBuffers[index].data);
      const healths = new Float32Array(inner.healthBuffers[index].data);
      const charges = new Uint32Array(inner.chargeBuffers[index].data);
      expect(inner.particleCount).toBe(population.particles.size);
      for (let slot = 0; slot < inner.particleCount; slot++) {
        const id: string = inner.slotToId[slot];
        const state = population.particles.get(id)!;
        expect(state, id).toBeDefined();
        expect([state.position.x, state.position.y], id).toEqual([positions[slot * 2], positions[slot * 2 + 1]]);
        expect(state.health, id).toBe(healths[slot]);
        expect(state.charge, id).toBe(charges[slot]);
        if (state.role === 'internal') {
          expect([state.velocity.x, state.velocity.y], id).toEqual([velocities[slot * 2], velocities[slot * 2 + 1]]);
        }
      }
    });

    it('normal steps never write undefined/NaN into the CPU mirror (Phase 14 did)', async () => {
      const definition = defaultScenarios('step', 'none').find((d) => d.name === 'churn')!;
      const { stepper, inner } = await openScenario(definition, MfmWebGPUStepper as never);
      for (let i = 0; i < definition.steps; i++) await stepper.step();
      for (const [id, state] of inner.population.particles as Map<string, any>) {
        expect(Number.isFinite(state.health), `${id}.health`).toBe(true);
        expect(Number.isFinite(state.charge), `${id}.charge`).toBe(true);
      }
    });

    it('every full readback is attributed to a reason, and only the shape-change fallback triggers one', async () => {
      const definition = defaultScenarios('step', 'none').find((d) => d.name === 'shape-change-fallback')!;
      const { stepper } = await openScenario(definition, MfmWebGPUStepper as never);
      stepper.enableProfiling({ cpu: true });
      for (let i = 0; i < definition.steps; i++) {
        await stepper.step();
        stepper.commitProfilingStep();
      }
      expect(counter(stepper, 'sync.fullSyncs.shapeChange')).toBe(2);
      expect(counter(stepper, 'sync.fullSyncs')).toBe(2);
      expect(counter(stepper, 'restructure.inPlace')).toBe(0);
    });
  });

  describe('interactive worker sequence (encodeStep + submit + finishNormalSync + per-frame metrics)', () => {
    it('matches the Phase 14 traces and needs at most 2 serial GPU waits on a quiet frame', { timeout: 120_000 }, async () => {
      const results = await run('encodeStep', 'worker');
      for (const result of results) {
        const expected = golden.scenarios[result.name];
        expect(
          result.steps.map((s) => [s.populationAfter, s.gpuDigest, s.cpuDigest]),
          result.name,
        ).toEqual(expected);

        const quiet = result.steps.filter((s) => !s.structureChanged);
        // one wait for the step's count summary + one for the (single) metrics readback
        expect(max(quiet.map((s) => s.counters.waitEpochs)), result.name).toBeLessThanOrEqual(2);
        expect(max(quiet.map((s) => s.counters.submits)), result.name).toBeLessThanOrEqual(2);
        // metrics read health+charge exactly once: 8 B/particle, plus the 12 B summary and its staging copy
        const perParticleBytes = mean(quiet.map((s) => s.counters.gpuToCpuCopyBytes));
        expect(perParticleBytes, result.name).toBeLessThanOrEqual(8 * result.particleCount + 24);
      }
    });
  });
});
