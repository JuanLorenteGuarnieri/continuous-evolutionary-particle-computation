/**
 * Phase 16 — WebGPU command/resource orchestration regression tests.
 *
 * Runs the real MfmWebGPUStepper against the software GPUDevice (tests/support/mock-gpu.ts) with the
 * emulated kernels. Guarantees:
 *
 *  1. SAME COMPUTATION: for every scenario x driver x orchestration-option combination, each step's
 *     GPU-visible state digest, CPU-topology digest AND normalized dispatch trace (pipeline, buffer bound at
 *     every binding, the 112 B params block the dynamic offset selects, workgroups) equal the trace recorded
 *     from the unmodified Phase 15 stepper (tests/golden/phase15-dispatch-traces.json).
 *  2. CACHE SAFETY: the bind-group cache holds at most 8 sets, never holds a bind group that references a
 *     destroyed buffer, and is rebuilt after the data buffers are recreated (the mock throws at submit if a
 *     destroyed buffer is bound, so completing the shape-change scenario also proves it).
 *  3. API BUDGET: structural counts at the device boundary (bind groups, writeBuffer calls/bytes).
 *
 * LIMITS (be explicit): kernels are emulated and WGSL is not executed; nothing here measures time and the
 * mock does not model Dawn's validation cost. A passing run proves the orchestration change is
 * behaviour-preserving against the emulated kernels, not that it is faster on real hardware.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MfmWebGPUStepper } from '../src/MfmWebGPUStepper';
import { defaultScenarios, openScenario, runScenario, type RunOptions, type ScenarioResult } from './support/sync-scenarios';

/**
 * Phase 18: the default force kernel is now 'sorted-culled' (3 extra passes, different force bindings). The Phase 15 golden traces and
 * the Phase 16 API budgets below describe the Phase 5..17 step, so they pin forceKernel 'linked-list' explicitly; the default step is
 * checked against the same golden state/topology digests in the 'default kernel' block at the end of this file.
 */
const LEGACY_KERNELS = { forceKernel: 'linked-list' as const };

const here = dirname(fileURLToPath(import.meta.url));
const golden = JSON.parse(readFileSync(resolve(here, 'golden/phase15-dispatch-traces.json'), 'utf-8')) as {
  scenarios: Record<string, Array<[number, string, string, string, number]>>;
};

type Profile = { name: 'headless' | 'interactive'; driver: 'step' | 'encodeStep'; metrics: 'none' | 'worker'; wait: boolean };
const PROFILES: Profile[] = [
  { name: 'headless', driver: 'step', metrics: 'none', wait: true },
  { name: 'interactive', driver: 'encodeStep', metrics: 'worker', wait: false },
];

const OPTION_MATRIX: Array<{ label: string; options: NonNullable<RunOptions['orchestration']> }> = [
  { label: 'cache on, per-block writes (defaults)', options: { bindGroupCache: true, packParamWrites: false } },
  { label: 'cache off, per-block writes', options: { bindGroupCache: false, packParamWrites: false } },
  { label: 'cache on, packed writes', options: { bindGroupCache: true, packParamWrites: true } },
  { label: 'cache off, packed writes', options: { bindGroupCache: false, packParamWrites: true } },
];

async function runAll(profile: Profile, options: RunOptions): Promise<ScenarioResult[]> {
  const results: ScenarioResult[] = [];
  for (const scenario of defaultScenarios(profile.driver, profile.metrics, profile.wait)) {
    results.push(await runScenario(scenario, MfmWebGPUStepper as never, { kernels: LEGACY_KERNELS, ...options }));
  }
  return results;
}

const rows = (result: ScenarioResult) =>
  result.steps.map((s) => [s.populationAfter, s.gpuDigest, s.cpuDigest, s.dispatchDigest, s.dispatchRecords]);

describe('WebGPU orchestration (Phase 16, software device)', () => {
  it('defaults: bind-group cache on, packed parameter writes off', async () => {
    const definition = defaultScenarios('step', 'none', false)[0]!;
    const { stepper } = await openScenario(definition, MfmWebGPUStepper as never);
    expect((stepper as unknown as MfmWebGPUStepper).getOrchestrationOptions().bindGroupCache).toBe(true);
    expect((stepper as unknown as MfmWebGPUStepper).getOrchestrationOptions().packParamWrites).toBe(false);
    stepper.destroy();
  });

  for (const variant of OPTION_MATRIX) {
    describe(variant.label, () => {
      for (const profile of PROFILES) {
        it(`${profile.name}: state, topology and dispatch traces equal the Phase 15 stepper's`, { timeout: 300_000 }, async () => {
          const results = await runAll(profile, { orchestration: variant.options, traceDispatches: true });
          expect(results.length).toBe(9);
          for (const result of results) {
            const expected = golden.scenarios[`${profile.name}/${result.name}`];
            expect(expected, result.name).toBeDefined();
            expect(rows(result), `${profile.name}/${result.name}`).toEqual(expected);
          }
        });
      }
    });
  }

  describe('API budget and cache behaviour', () => {
    const scenario = (name: string, driver: Profile['driver'] = 'step', metrics: Profile['metrics'] = 'none') =>
      defaultScenarios(driver, metrics, false).find((d) => d.name === name)!;

    it('steady state creates no bind groups after the first two steps (cache on) and 12 per step (cache off)', async () => {
      const on = await runScenario(scenario('steady-no-repro'), MfmWebGPUStepper as never, { kernels: LEGACY_KERNELS, orchestration: { bindGroupCache: true } });
      const off = await runScenario(scenario('steady-no-repro'), MfmWebGPUStepper as never, { kernels: LEGACY_KERNELS, orchestration: { bindGroupCache: false } });
      // two ping-pong parities x 12 bind groups, then pure reuse
      expect(on.totals.bindGroupsCreated).toBe(24);
      expect(on.steps.slice(2).reduce((sum, s) => sum + s.counters.bindGroupsCreated, 0)).toBe(0);
      expect(off.totals.bindGroupsCreated).toBe(12 * off.steps.length);
      // the dispatch count is the same: the cache changes what is created, not what is run
      expect(on.totals.dispatches).toBe(off.totals.dispatches);
      expect(on.totals.computePasses).toBe(off.totals.computePasses);
    });

    it('a quiet step uploads ONE 112 B parameter block (Phase 15: two identical 112 B writes)', async () => {
      const result = await runScenario(scenario('steady-no-repro'), MfmWebGPUStepper as never, { kernels: LEGACY_KERNELS });
      for (const step of result.steps) {
        expect(step.counters.writeBuffer, `t=${step.timestep}`).toBe(1);
        expect(step.counters.cpuToGpuWriteBytes, `t=${step.timestep}`).toBe(112);
      }
    });

    it('packed writes issue one writeBuffer per step even when maxK > 1, with identical GPU-visible params', async () => {
      const perBlock = await runScenario(scenario('shape-change-fallback'), MfmWebGPUStepper as never, { kernels: LEGACY_KERNELS, orchestration: { packParamWrites: false } });
      const packed = await runScenario(scenario('shape-change-fallback'), MfmWebGPUStepper as never, { kernels: LEGACY_KERNELS, orchestration: { packParamWrites: true } });
      expect(packed.totals.writeBuffer).toBeLessThan(perBlock.totals.writeBuffer);
      // The honest cost of packing: more bytes (the 144 B padding between blocks travels too).
      expect(packed.totals.cpuToGpuWriteBytes).toBeGreaterThan(perBlock.totals.cpuToGpuWriteBytes);
    });

    it('cache never holds more than 8 sets and never references a destroyed buffer, across churn and buffer recreation', async () => {
      for (const name of ['churn', 'churn-large', 'shape-change-fallback', 'death-and-birth']) {
        const definition = scenario(name);
        const { stepper, inner } = await openScenario(definition, MfmWebGPUStepper as never);
        for (let i = 0; i < definition.steps; i++) {
          await stepper.step();
          const cache = inner.stepBindGroupCache as Array<Record<string, { entries: Array<{ buffer: { destroyed: boolean } }> } | null> | undefined>;
          expect(cache.length, name).toBe(8);
          for (const set of cache) {
            if (!set) continue;
            // Phase 18: `sort` is a nested record of bind groups (sortCount/sortScan/sortScatter), not a bind group itself.
            const groups = Object.values(set).flatMap((value) =>
              value && !('entries' in (value as object)) ? Object.values(value as Record<string, unknown>) : [value],
            ) as Array<{ entries: Array<{ buffer: { destroyed: boolean } }> } | null>;
            for (const group of groups) {
              if (!group) continue;
              for (const entry of group.entries) expect(entry.buffer.destroyed, `${name} t=${i}`).toBe(false);
            }
          }
        }
        stepper.destroy();
        expect((inner.stepBindGroupCache as unknown[]).every((set) => set === undefined), `${name}: destroy() empties the cache`).toBe(true);
      }
    });

    it('cache is transparent even when stateRead / incomingRead / eventWrite diverge (differential, cache on vs off)', async () => {
      // The three ping-pong indices normally flip together, but they are assigned independently (e.g. a full upload resets
      // stateIndex/eventIndex without touching incomingIndex). No stock scenario reaches such a combination, so force it
      // identically in both runs: a key that dropped any of the three would reuse a bind group built for another buffer.
      const trace = async (cache: boolean): Promise<string[][]> => {
        const definition = scenario('steady-no-repro');
        const { device, stepper, inner } = await openScenario(definition, MfmWebGPUStepper as never);
        (stepper as unknown as MfmWebGPUStepper).setOrchestrationOptions({ bindGroupCache: cache });
        const perStep: string[][] = [];
        for (let i = 0; i < 16; i++) {
          if (i === 3 || i === 9) inner.incomingIndex ^= 1;
          if (i === 6 || i === 12) inner.eventIndex ^= 1;
          device.dispatchTrace = [];
          await stepper.step();
          perStep.push(device.dispatchTrace);
        }
        stepper.destroy();
        return perStep;
      };
      const on = await trace(true);
      const off = await trace(false);
      expect(on.length).toBe(16);
      expect(on).toEqual(off);
    });

    it('rebuilds the whole bind-group set in the step after the GPU buffers are recreated', async () => {
      const result = await runScenario(scenario('shape-change-fallback'), MfmWebGPUStepper as never, { kernels: LEGACY_KERNELS });
      const rebuiltAt = result.steps.map((s, i) => (s.counters.buffersCreated > 0 ? i : -1)).filter((i) => i >= 0);
      expect(rebuiltAt.length).toBe(2);
      // Buffers are recreated while finishing step i (after its encode); step i + 1 is the first to encode with them.
      for (const i of rebuiltAt) {
        expect(result.steps[i + 1]).toBeDefined();
        expect(result.steps[i + 1]!.counters.bindGroupsCreated, `step after t=${i}`).toBeGreaterThanOrEqual(12);
      }
    });
  });
});

describe('default kernel (Phase 18: forceKernel sorted-culled)', () => {
  it('is sorted-culled', async () => {
    const { stepper } = await openScenario(defaultScenarios('step', 'none', false)[0]!, MfmWebGPUStepper as never);
    expect((stepper as unknown as MfmWebGPUStepper).getKernelOptions().forceKernel).toBe('sorted-culled');
    stepper.destroy();
  });

  for (const profile of PROFILES) {
    it(`${profile.name}: GPU state and CPU topology digests equal the Phase 15 golden ones; exactly 3 extra dispatches per step`, { timeout: 300_000 }, async () => {
      const results = await runAll(profile, { kernels: { forceKernel: 'sorted-culled' }, traceDispatches: true });
      expect(results.length).toBe(9);
      for (const result of results) {
        const expected = golden.scenarios[`${profile.name}/${result.name}`];
        expect(expected, result.name).toBeDefined();
        const got = rows(result);
        expect(got.length, result.name).toBe(expected.length);
        for (let i = 0; i < got.length; i++) {
          // [populationAfter, gpuStateDigest, cpuTopologyDigest, dispatchTraceDigest, dispatchRecordCount]
          expect(got[i].slice(0, 3), `${profile.name}/${result.name} step ${i}`).toEqual(expected[i].slice(0, 3));
          expect(got[i][4], `${profile.name}/${result.name} step ${i}`).toBe(expected[i][4] + 3);
        }
      }
    });
  }

  it('bind groups: 3 more per ping-pong parity than the legacy step (cache on), 3 more per step (cache off)', async () => {
    const def = defaultScenarios('step', 'none', false).find((d) => d.name === 'steady-no-repro')!;
    const legacy = await runScenario(def, MfmWebGPUStepper as never, { kernels: LEGACY_KERNELS, orchestration: { bindGroupCache: true } });
    const on = await runScenario(def, MfmWebGPUStepper as never, { orchestration: { bindGroupCache: true } });
    const off = await runScenario(def, MfmWebGPUStepper as never, { orchestration: { bindGroupCache: false } });
    expect(on.totals.bindGroupsCreated).toBe(legacy.totals.bindGroupsCreated + 2 * 3);
    expect(on.steps.slice(2).reduce((sum, st) => sum + st.counters.bindGroupsCreated, 0)).toBe(0);
    expect(off.totals.bindGroupsCreated).toBe(15 * off.steps.length);
  });
});
