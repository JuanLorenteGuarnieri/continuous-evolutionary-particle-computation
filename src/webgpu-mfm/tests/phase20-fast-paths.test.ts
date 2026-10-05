/**
 * Phase 20 — quiet-step fast path, lagged metrics, halt guard structure, worker option forwarding (mock device / source-level checks).
 * LIMITS: software device with kernel stand-ins; no WGSL is executed here (see kernel-selftest.ts `pipelineCases` for the on-device check).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as Stepper from '../src/MfmWebGPUStepper';
import { MfmWebGPUStepper, SHADER_HALT_UPDATE, SHADER_DEATH_COMPACTION, SHADER_DEATH_COMPACTION_BLOCKED, shaderForce, shaderForceSorted } from '../src/MfmWebGPUStepper';
import { defaultScenarios, openScenario, runScenario } from './support/sync-scenarios';

const here = dirname(fileURLToPath(import.meta.url));
const scenarios = defaultScenarios('step', 'none', false);
const rows = (r: Awaited<ReturnType<typeof runScenario>>) => r.steps.map((s) => [s.populationAfter, s.structureChanged, s.gpuDigest, s.cpuDigest]);

describe('quiet-step fast path is observationally identical', () => {
  for (const definition of scenarios) {
    it(`${definition.name}: same GPU/CPU digests with quietFastPath on and off`, async () => {
      const on = await runScenario(definition, MfmWebGPUStepper as never, { orchestration: { quietFastPath: true } });
      const off = await runScenario(definition, MfmWebGPUStepper as never, { orchestration: { quietFastPath: false } });
      expect(rows(on)).toEqual(rows(off));
    });
  }
  it('the O(N) snapshot is built only by non-quiet steps when the fast path is on (and every step when off)', async () => {
    for (const [fast, name] of [[true, 'steady-no-repro'], [false, 'steady-no-repro'], [true, 'single-death']] as const) {
      const definition = scenarios.find((d) => d.name === name)!;
      const { stepper } = await openScenario(definition, MfmWebGPUStepper as never, undefined, { quietFastPath: fast });
      const inner = stepper as any;
      let calls = 0;
      const original = inner.takeSnapshot.bind(inner);
      inner.takeSnapshot = () => { calls++; return original(); };
      for (let i = 0; i < definition.steps; i++) await stepper.step();
      if (name === 'steady-no-repro') expect(calls).toBe(fast ? 0 : definition.steps);
      else expect(calls).toBe(1); // exactly the one non-quiet (death) step
    }
  });
});

describe('lagged population metrics', () => {
  it('are exact: each sample equals a blocking read taken at the committed step it is tagged with, in quiet and restructuring scenarios', async () => {
    for (const name of ['steady-no-repro', 'death-and-birth', 'churn', 'shape-change-fallback']) {
      const definition = scenarios.find((d) => d.name === name)!;
      const { stepper } = await openScenario(definition, MfmWebGPUStepper as never);
      const s = stepper as unknown as MfmWebGPUStepper;
      const blockingByTimestep = new Map<number, unknown>();
      let samples = 0;
      const initial = await s.readPopulationMetrics();
      blockingByTimestep.set(0, { count: initial.count, healthSum: initial.healthSum, totalCharge: initial.totalCharge, inputCharge: initial.inputCharge, outputCharge: initial.outputCharge });
      expect(s.pollPopulationMetrics()).toBe(null); // nothing completed yet: never blocks, never throws (this call also requests the timestep-0 sample)
      for (let i = 0; i < definition.steps; i++) {
        await s.step();
        const exact = await s.readPopulationMetrics();
        blockingByTimestep.set((stepper as any).timestep, { count: exact.count, healthSum: exact.healthSum, totalCharge: exact.totalCharge, inputCharge: exact.inputCharge, outputCharge: exact.outputCharge });
        const lagged = s.pollPopulationMetrics();
        if (lagged) {
          samples++;
          const { timestep, ...values } = lagged;
          expect(values, `${name} sample for timestep ${timestep}`).toEqual(blockingByTimestep.get(timestep));
          expect(timestep).toBeLessThanOrEqual((stepper as any).timestep);
        }
      }
      expect(samples).toBeGreaterThan(definition.steps / 2);
    }
  });
});

describe('every kernel is guarded by params.halted, and the halt-update pass sets the flag only for an executed non-quiet step', () => {
  it('Params carries `halted` at byte offset 108 (the last member; the uniform block is 112 bytes)', () => {
    const src = readFileSync(resolve(here, '../src/MfmWebGPUStepper.ts'), 'utf-8');
    expect(src.includes('halted: u32,')).toBe(true);
    expect(/const PARAMS_HALTED_OFFSET = 108;/.test(src)).toBe(true);
    expect(/view\.setUint32\(108, 0, true\); \/\/ Phase 20: params\.halted/.test(src)).toBe(true);
    expect(/const UNIFORM_BUFFER_SIZE = 112;/.test(src)).toBe(true);
  });
  it('all compute entry points in the stepper source start with the guard', () => {
    const src = readFileSync(resolve(here, '../src/MfmWebGPUStepper.ts'), 'utf-8').replace(/\r\n/g, '\n');
    const entries = [...src.matchAll(/@compute @workgroup_size\([^\n]*\)\nfn main\([^\n]*\) \{\n([^\n]*)\n/g)];
    expect(entries.length).toBeGreaterThanOrEqual(20);
    for (const m of entries) expect(m[1].trim()).toBe('if (params.halted != 0u) { return; }');
    expect(SHADER_DEATH_COMPACTION.includes('params.halted != 0u')).toBe(true);
    expect(SHADER_DEATH_COMPACTION_BLOCKED.includes('params.halted != 0u')).toBe(true);
    for (const wgsl of [shaderForce(128), shaderForceSorted(128, true)]) expect(wgsl.includes('params.halted != 0u')).toBe(true);
  });
  it('halt-update: guard first, then the non-quiet predicate the CPU uses; it can only SET the flag', () => {
    const body = SHADER_HALT_UPDATE.slice(SHADER_HALT_UPDATE.indexOf('fn main'));
    expect(body.indexOf('params.halted != 0u')).toBeLessThan(body.indexOf('halt[0] = 1u'));
    expect(body.includes('deathCount[0] > 0u || candidateCount[0] > 0u')).toBe(true);
    expect(body.includes('halt[0] = 0u')).toBe(false);
  });
  it('the module exports the new shader (stepper imports are consistent)', () => {
    expect(typeof (Stepper as Record<string, unknown>).SHADER_HALT_UPDATE).toBe('string');
  });
});

describe('worker forwards every benchmark option (the Phase 17 and Phase 19 defects must not recur)', () => {
  it('every BenchmarkRunOptions field appears in the runBenchmark(...) call of the message handler', () => {
    const src = readFileSync(resolve(here, '../../web-worker/src/worker.ts'), 'utf-8').replace(/\r\n/g, '\n');
    const iface = src.slice(src.indexOf('interface BenchmarkRunOptions {'));
    const body = iface.slice(0, iface.indexOf('\n}\n'));
    const fields = [...body.matchAll(/^ {2}(\w+)\??:/gm)].map((m) => m[1]);
    expect(fields.length).toBeGreaterThan(10);
    const handler = src.slice(src.indexOf("case 'runBenchmark': {"));
    const call = handler.slice(handler.indexOf('await runBenchmark({'), handler.indexOf("self.postMessage({ type: 'benchmarkResult'"));
    for (const field of fields) expect(new RegExp(`\\b${field}\\b`).test(call), `runBenchmark call must forward "${field}"`).toBe(true);
  });
});
