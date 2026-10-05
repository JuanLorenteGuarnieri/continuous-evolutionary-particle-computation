#!/usr/bin/env node
/**
 * Phase 15 — CPU-side orchestration cost of a quiet timestep (Node, no GPU).
 *
 * Runs the REAL MfmWebGPUStepper against the software GPUDevice with every compute pass
 * replaced by a no-op, and reports the Phase 14 CPU section profiler's own numbers
 * (encode, finishNormalSync sections, ...). Because no GPU work and no IPC exists, what is
 * left is exactly the JavaScript the stepper runs between "GPU round trip returned" and
 * "next submission": the part of a timestep during which a real GPU would be idle.
 *
 * WHAT THIS IS NOT: GPU time, WebGPU API/IPC latency, or a prediction of end-to-end
 * throughput. Numbers are V8-on-this-machine CPU milliseconds under a mock device; use them
 * to compare two versions of the orchestration code against each other on the same machine,
 * nothing else.
 *
 * Run (repository root):
 *   node --no-warnings --experimental-strip-types \
 *        --experimental-loader=./tools/bench/ts-prefer-loader.mjs \
 *        tools/bench/cpu-orchestration.mjs [--stepper <file>] [--sizes 1000,10000] [--steps 150] [--repeats 5] [--out <file>]
 *        [--bind-group-cache on|off] [--pack-params on|off]   (Phase 16; ignored by steppers without the switches)
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const args = { stepper: 'src/webgpu-mfm/src/MfmWebGPUStepper.ts', sizes: [1000, 10000], steps: 300, warmup: 300, repeats: 7, label: 'current', out: null, orchestration: null };
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  const next = () => process.argv[++i];
  if (a === '--stepper') args.stepper = next();
  else if (a === '--sizes') args.sizes = next().split(',').map(Number);
  else if (a === '--steps') args.steps = Number(next());
  else if (a === '--warmup') args.warmup = Number(next());
  else if (a === '--repeats') args.repeats = Number(next());
  else if (a === '--label') args.label = next();
  else if (a === '--out') args.out = next();
  else if (a === '--bind-group-cache') (args.orchestration ??= {}).bindGroupCache = next() !== 'off';
  else if (a === '--pack-params') (args.orchestration ??= {}).packParamWrites = next() === 'on';
  else throw new Error(`Unknown option ${a}`);
}

const { MfmWebGPUStepper } = await import(pathToFileURL(resolve(args.stepper)).href);
const { MockDevice, installWebGpuGlobals } = await import(new URL('../../src/webgpu-mfm/tests/support/mock-gpu.ts', import.meta.url).href);
const { createBenchmarkScenario } = await import('@cepc/shared-config');
installWebGpuGlobals();

const percentile = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.floor(p * (sorted.length - 1) + 0.5))];
const results = [];

for (const n of args.sizes) {
  const repeatMeans = [];
  const sectionMeans = {};
  for (let r = 0; r < args.repeats; r++) {
    const scenario = createBenchmarkScenario({ particleCount: n, seed: 42 });
    const device = new MockDevice();
    device.emulator = () => {}; // every compute pass is a no-op: no deaths, no births, no events
    const stepper = new MfmWebGPUStepper(device, scenario.config, scenario.population, scenario.seed);
    if (args.orchestration && typeof stepper.setOrchestrationOptions === 'function') stepper.setOrchestrationOptions(args.orchestration);
    await stepper.init();
    stepper.enableProfiling({ cpu: true, gpuTimestamps: false });
    for (let i = 0; i < args.warmup; i++) { await stepper.step(); stepper.commitProfilingStep(); }
    await stepper.resetProfiling();

    const samples = [];
    for (let i = 0; i < args.steps; i++) {
      const t0 = performance.now();
      await stepper.step();
      samples.push(performance.now() - t0);
      stepper.commitProfilingStep();
    }
    const report = stepper.getProfilingReport().cpu;
    // Repeat 0 is discarded: it carries V8 tier-up for a fresh process and is not representative.
    if (r > 0) {
      for (const section of report.sections) {
        (sectionMeans[section.section] ??= []).push(section.perStepMs.mean);
      }
    }
    const sorted = [...samples].sort((a, b) => a - b);
    if (r > 0) repeatMeans.push({ mean: samples.reduce((s, v) => s + v, 0) / samples.length, p50: percentile(sorted, 0.5), p95: percentile(sorted, 0.95) });
    stepper.destroy();
  }
  const med = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
  const row = {
    particles: n,
    stepsPerRepeat: args.steps,
    repeats: args.repeats,
    stepMeanMsMedianOfRepeats: med(repeatMeans.map((x) => x.mean)),
    stepP50MsMedianOfRepeats: med(repeatMeans.map((x) => x.p50)),
    stepP95MsMedianOfRepeats: med(repeatMeans.map((x) => x.p95)),
    repeatMeansMs: repeatMeans.map((x) => +x.mean.toFixed(4)),
    sectionsMeanMsMedianOfRepeats: Object.fromEntries(Object.entries(sectionMeans).map(([k, v]) => [k, +med(v).toFixed(4)])),
  };
  results.push(row);
  console.log(`\nN=${n}  step mean ${row.stepMeanMsMedianOfRepeats.toFixed(3)} ms  p50 ${row.stepP50MsMedianOfRepeats.toFixed(3)}  p95 ${row.stepP95MsMedianOfRepeats.toFixed(3)}   (median of ${args.repeats} repeats; repeats: ${row.repeatMeansMs.join(', ')})`);
  for (const [name, value] of Object.entries(row.sectionsMeanMsMedianOfRepeats).sort((a, b) => b[1] - a[1]).slice(0, 8)) {
    console.log(`   ${name.padEnd(34)} ${value.toFixed(4)} ms/step`);
  }
}

const out = args.out ?? `performance/phase15/cpu-orchestration-${args.label}.json`;
mkdirSync(dirname(resolve(out)), { recursive: true });
writeFileSync(resolve(out), `${JSON.stringify({ schema: 'cepc-cpu-orchestration/1', timed: true, scope: 'CPU-only JS orchestration under a no-op software GPU; not GPU time', label: args.label, orchestration: args.orchestration, stepper: args.stepper, node: process.version, results }, null, 2)}\n`);
console.log(`\n-> ${out}`);
