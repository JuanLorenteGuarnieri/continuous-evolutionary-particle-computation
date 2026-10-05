/**
 * Phase 18 — orchestration of the cell-sorted force kernels on the mock WebGPU device.
 *
 * LIMITS (be explicit): the mock records dispatches and validates bindings / buffer lifetimes / dynamic offsets but computes no
 * forces. This checks: the default path is untouched (no sort pipeline compiled, no extra dispatch), the sorted modes add exactly
 * sortCount, sortScan, sortScatter immediately before `force` on every step, nothing else in the step changes, the new buffers
 * survive population churn and buffer recreation (the mock rejects binding a destroyed buffer), and modes can be switched
 * mid-run. Numerical equivalence is covered by force-grid-variants.test.ts (algorithm) and the on-device kernel self-test.
 */
import { describe, it, expect } from 'vitest';
import { MfmWebGPUStepper } from '../src/MfmWebGPUStepper';
import { defaultScenarios, openScenario } from './support/sync-scenarios';

const scenario = (name: string) => defaultScenarios('step', 'none', false).find((d) => d.name === name)!;
const SORT = ['mfm-sort-count', 'mfm-sort-scan', 'mfm-sort-scatter'];
const labelsOf = (trace: string[]): string[] => trace.map((entry) => entry.split('|')[0]);

type Mode = 'linked-list' | 'sorted' | 'sorted-culled';

async function stepLabels(name: string, mode: Mode | null): Promise<{ perStep: string[][]; inner: any }> {
  const definition = scenario(name);
  const { device, stepper, inner } = await openScenario(definition, MfmWebGPUStepper as never);
  if (mode) (stepper as unknown as MfmWebGPUStepper).setKernelOptions({ forceKernel: mode });
  const perStep: string[][] = [];
  for (let i = 0; i < definition.steps; i++) {
    device.dispatchTrace = [];
    await stepper.step();
    perStep.push(labelsOf(device.dispatchTrace));
  }
  device.dispatchTrace = null;
  return { perStep, inner };
}

describe('cell-sorted force orchestration', () => {
  it('default kernel is sorted-culled: the sort passes run before force on every step', async () => {
    const { perStep, inner } = await stepLabels('steady-no-repro', null);
    expect(inner.kernels.forceKernel).toBe('sorted-culled');
    for (const labels of perStep) {
      const at = labels.indexOf('mfm-sort-count');
      expect(labels.slice(at, at + 4)).toEqual([...SORT, 'mfm-force']);
    }
  });

  it("'linked-list' selected before init (the Phase 5..17 kernel): no sort pass, no sort pipeline, no sort buffers", async () => {
    const definition = scenario('steady-no-repro');
    const { device, stepper, inner } = await openScenario(definition, MfmWebGPUStepper as never, { forceKernel: 'linked-list' });
    expect(inner.kernels.forceKernel).toBe('linked-list');
    expect(inner.sortBuffersReady).toBe(false);
    expect(inner.sortCountPipeline).toBe(undefined);
    for (let i = 0; i < definition.steps; i++) {
      device.dispatchTrace = [];
      await stepper.step();
      const labels = labelsOf(device.dispatchTrace);
      for (const label of SORT) expect(labels.includes(label)).toBe(false);
    }
    device.dispatchTrace = null;
    expect(inner.sortBuffersReady).toBe(false);
  });

  it("'linked-list' selected after init (switching away from the default): no sort pass is dispatched", async () => {
    const { perStep } = await stepLabels('steady-no-repro', 'linked-list');
    for (const labels of perStep) for (const label of SORT) expect(labels.includes(label)).toBe(false);
  });

  for (const mode of ['sorted', 'sorted-culled'] as const) {
    for (const name of ['steady-no-repro', 'churn', 'shape-change-fallback', 'death-and-birth']) {
      it(`${mode} on '${name}': three extra passes right before force, the rest of the step is unchanged, buffers stay valid`, async () => {
        const baseline = await stepLabels(name, 'linked-list');
        const candidate = await stepLabels(name, mode);
        expect(candidate.perStep.length).toBe(baseline.perStep.length);
        for (let i = 0; i < candidate.perStep.length; i++) {
          const labels = candidate.perStep[i];
          const at = labels.indexOf('mfm-sort-count');
          expect(at).toBeGreaterThan(-1);
          expect(labels.slice(at, at + 4)).toEqual([...SORT, 'mfm-force']);
          expect(labels.filter((l) => !SORT.includes(l))).toEqual(baseline.perStep[i]);
        }
      });
    }
  }

  it('modes can be switched between steps; leaving the sorted modes removes the extra passes again', async () => {
    const definition = scenario('churn');
    const { device, stepper } = await openScenario(definition, MfmWebGPUStepper as never);
    const s = stepper as unknown as MfmWebGPUStepper;
    const plan: Mode[] = ['linked-list', 'sorted', 'sorted-culled', 'linked-list', 'sorted-culled', 'sorted'];
    for (let i = 0; i < 18; i++) {
      const mode = plan[Math.floor(i / 3)];
      if (i % 3 === 0) s.setKernelOptions({ forceKernel: mode });
      device.dispatchTrace = [];
      await stepper.step();
      const labels = labelsOf(device.dispatchTrace);
      expect(labels.filter((l) => SORT.includes(l)).length).toBe(mode === 'linked-list' ? 0 : 3);
    }
    device.dispatchTrace = null;
  });

  it('rejects an unknown force kernel', async () => {
    const { stepper } = await openScenario(scenario('steady-no-repro'), MfmWebGPUStepper as never);
    expect(() => (stepper as unknown as MfmWebGPUStepper).setKernelOptions({ forceKernel: 'bogus' as never })).toThrow();
  });
});
