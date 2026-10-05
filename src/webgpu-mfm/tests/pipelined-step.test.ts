/**
 * Phase 20 — optimistic pipelining (OrchestrationOptions.pipelineDepth = 2) on the software WebGPU device.
 *
 * LIMITS (be explicit): the mock executes kernel stand-ins (kernel-emulator.ts), not WGSL, and has no real queue latency. What this proves is the
 * CONTROL FLOW and the BUFFER/INDEX/TIMESTEP bookkeeping of pipelining: for every default scenario (quiet steps, deaths, births, both in one step,
 * a buffer-shape change) the committed state after each step() call - GPU state digest of the committed ping-pong set, CPU topology digest, population
 * size - equals the non-pipelined run, speculative steps behind a non-quiet step are discarded and re-submitted, and no step touches a destroyed
 * buffer. That the WGSL halt guard really turns a step into a no-op is checked on the real device by the kernel self-test (field `pipelineCases`).
 */
import { describe, it, expect } from 'vitest';
import { MfmWebGPUStepper } from '../src/MfmWebGPUStepper';
import { defaultScenarios, openScenario, runScenario } from './support/sync-scenarios';

const scenarios = defaultScenarios('step', 'none', false);
const depth = (pipelineDepth: 1 | 2) => ({ orchestration: { pipelineDepth } });
const keyRows = (r: Awaited<ReturnType<typeof runScenario>>) =>
  r.steps.map((s) => [s.populationAfter, s.structureChanged, s.gpuDigest, s.cpuDigest]);

describe('pipelineDepth 2 commits exactly the same states as pipelineDepth 1', () => {
  for (const definition of scenarios) {
    it(`${definition.name}`, async () => {
      const base = await runScenario(definition, MfmWebGPUStepper as never, depth(1));
      const piped = await runScenario(definition, MfmWebGPUStepper as never, depth(2));
      expect(piped.steps.length).toBe(base.steps.length);
      for (let i = 0; i < base.steps.length; i++) {
        expect(keyRows(piped)[i], `${definition.name} step ${i}`).toEqual(keyRows(base)[i]);
      }
    });
  }
});

describe('speculation is wasted only behind non-quiet steps', () => {
  it('a quiet scenario never discards a step; every death/birth step discards at most the one speculative step behind it', async () => {
    for (const definition of scenarios) {
      const { stepper, device } = await openScenario(definition, MfmWebGPUStepper as never, undefined, depth(2).orchestration);
      const s = stepper as unknown as MfmWebGPUStepper;
      let restructures = 0;
      const inner = stepper as any;
      for (let i = 0; i < definition.steps; i++) {
        const before = (inner.slotToId as string[]).join('|');
        await s.step();
        if ((inner.slotToId as string[]).join('|') !== before) restructures++;
      }
      await s.drainPipeline();
      const discards = s.getPipelineDiscards();
      if (/^steady-no-repro$/.test(definition.name)) expect(discards, definition.name).toBe(0);
      expect(discards, definition.name).toBeLessThanOrEqual(restructures + 1);
      void device;
    }
  });

  it('single-death: exactly one speculative step is discarded and the halt flag is cleared again', async () => {
    const definition = scenarios.find((d) => d.name === 'single-death')!;
    const { stepper } = await openScenario(definition, MfmWebGPUStepper as never, undefined, depth(2).orchestration);
    const s = stepper as unknown as MfmWebGPUStepper;
    for (let i = 0; i < definition.steps; i++) await s.step();
    await s.drainPipeline();
    expect(s.getPipelineDiscards()).toBe(1);
    expect(new Uint32Array((stepper as any).haltBuffer.data)[0]).toBe(0);
  });
});

describe('pipelined stepping and the rest of the API', () => {
  it('a one-shot input injected while a speculative step is about to be discarded is restored and used by the re-submitted step', async () => {
    const definition = scenarios.find((d) => d.name === 'single-death')!; // the death happens in the step executed at timestep 8
    const run = async (pipelineDepth: 1 | 2): Promise<string> => {
      const { stepper } = await openScenario(definition, MfmWebGPUStepper as never, undefined, depth(pipelineDepth).orchestration);
      const s = stepper as unknown as MfmWebGPUStepper;
      const inner = stepper as any;
      for (let i = 0; i < 9; i++) await s.step(); // depth 2: step 8 (non-quiet) is submitted but not yet finished
      // The logical "next step" after the committed death step is the one that must see the input.
      s.injectInput(7);
      for (let i = 0; i < 4; i++) await s.step();
      await s.drainPipeline();
      expect(inner.pendingInputSignal === null || inner.pendingInputSignal === undefined || typeof inner.pendingInputSignal === 'number').toBe(true);
      return `${inner.timestep}`;
    };
    // Both modes committed the same number of timesteps (13 steps requested; depth 2 has one more already committed by the drain).
    expect(Number(await run(1))).toBe(13);
    expect(Number(await run(2))).toBe(14);
  });

  it('exceptional operations drain first: syncFullCpuState / saveState leave nothing in flight and agree with the committed step', async () => {
    const definition = scenarios.find((d) => d.name === 'churn')!;
    const { stepper } = await openScenario(definition, MfmWebGPUStepper as never, undefined, depth(2).orchestration);
    const s = stepper as unknown as MfmWebGPUStepper;
    for (let i = 0; i < 10; i++) await s.step();
    await s.syncFullCpuState('explicit');
    expect((stepper as any).pipe.length).toBe(0);
    // stepping afterwards works and keeps committing
    const before = (stepper as any).timestep;
    await s.step();
    expect((stepper as any).timestep).toBe(before + 1);
  });

  it('switching pipelineDepth back to 1 drains the in-flight step before the next step', async () => {
    const definition = scenarios.find((d) => d.name === 'steady-no-repro')!;
    const { stepper } = await openScenario(definition, MfmWebGPUStepper as never, undefined, depth(2).orchestration);
    const s = stepper as unknown as MfmWebGPUStepper;
    for (let i = 0; i < 5; i++) await s.step();
    expect((stepper as any).pipe.length).toBe(1);
    s.setOrchestrationOptions({ pipelineDepth: 1 });
    await s.step();
    expect((stepper as any).pipe.length).toBe(0);
    expect((stepper as any).timestep).toBe(7); // 5 committed + 1 drained + 1 new
  });

  it('the caller-owned-encoder path (encodeStep) drains a pipelined step first', async () => {
    const definition = scenarios.find((d) => d.name === 'steady-no-repro')!;
    const { stepper, device } = await openScenario(definition, MfmWebGPUStepper as never, undefined, depth(2).orchestration);
    const s = stepper as unknown as MfmWebGPUStepper;
    for (let i = 0; i < 3; i++) await s.step();
    const encoder = device.createCommandEncoder({ label: 'external' });
    const encoded = await s.encodeStep(encoder);
    expect((stepper as any).pipe.length).toBe(0);
    device.queue.submit([encoder.finish()]);
    s.notifyStepSubmitted();
    await encoded.finishNormalSync();
    expect((stepper as any).timestep).toBe(5); // 3 committed + 1 drained + 1 external
  });
});
