#!/usr/bin/env node
/**
 * Phase 15 — structural synchronization accounting (Node, no browser, no GPU).
 *
 * Runs the REAL MfmWebGPUStepper against a software GPUDevice
 * (src/webgpu-mfm/tests/support/mock-gpu.ts) and counts, per timestep, every
 * submit / awaited map / onSubmittedWorkDone / GPU->CPU byte / CPU->GPU byte the
 * stepper issues, for a fixed scenario matrix.
 *
 * IMPORTANT — what this is and is not:
 *   - It IS a ground-truth count of synchronization *events and bytes*, taken
 *     at the device boundary (not from the stepper's own profiler).
 *   - It is NOT a timing benchmark and NOT a WGSL test. There is no GPU. The
 *     output is marked `"timed": false`. Wall-clock effects of any count
 *     difference must be measured with `pnpm run benchmark:webgpu` on real hardware.
 *
 * Run (from the repository root):
 *   node --no-warnings --experimental-strip-types \
 *        --experimental-loader=./tools/bench/ts-prefer-loader.mjs \
 *        tools/bench/sync-accounting.mjs [options]
 *   (or: pnpm run benchmark:sync -- [options])
 *
 * Options:
 *   --stepper <file>          stepper source to measure (default: src/webgpu-mfm/src/MfmWebGPUStepper.ts)
 *   --label <name>            label stored in the output (default: "current")
 *   --profile headless|interactive|both   (default both)
 *                             headless    = stepper.step(), no metrics
 *                             interactive = worker path: encodeStep + submit + [wait] + finishNormalSync
 *                                           + per-frame metrics (MetricsReducer + readChargeMetrics)
 *   --wait-after-submit true|false   interactive profile: reproduce the Phase 14 worker's post-submit
 *                             onSubmittedWorkDone (default false = Phase 15 worker; pass true for Phase 14)
 *   --scenarios a,b,c         subset of scenario names
 *   --out <file>              JSON output (default performance/phase15/sync-accounting-<label>.json)
 *   --traces                  also embed per-step state digests in the JSON (used for golden traces)
 *   --dispatch-traces         Phase 16: also embed per-step dispatch-trace digests (implies --traces)
 *   --bind-group-cache on|off Phase 16: stepper orchestration switch (ignored by steppers that lack it)
 *   --pack-params on|off      Phase 16: stepper orchestration switch (ignored by steppers that lack it)
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

function parseArgs(argv) {
  const args = {
    stepper: 'src/webgpu-mfm/src/MfmWebGPUStepper.ts',
    label: 'current',
    profile: 'both',
    waitAfterSubmit: false,
    scenarios: null,
    out: null,
    traces: false,
    dispatchTraces: false,
    orchestration: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === '--stepper') args.stepper = next();
    else if (a === '--label') args.label = next();
    else if (a === '--profile') args.profile = next();
    else if (a === '--wait-after-submit') args.waitAfterSubmit = next() !== 'false';
    else if (a === '--scenarios') args.scenarios = next().split(',');
    else if (a === '--out') args.out = next();
    else if (a === '--traces') args.traces = true;
    else if (a === '--dispatch-traces') args.traces = args.dispatchTraces = true;
    else if (a === '--bind-group-cache') (args.orchestration ??= {}).bindGroupCache = next() !== 'off';
    else if (a === '--pack-params') (args.orchestration ??= {}).packParamWrites = next() === 'on';
    else throw new Error(`Unknown option ${a}`);
  }
  args.out ??= `performance/phase15/sync-accounting-${args.label}.json`;
  return args;
}

const mean = (values) => (values.length === 0 ? 0 : values.reduce((s, v) => s + v, 0) / values.length);

/** Derived, human-meaningful figures from raw device counters. */
function derive(counters) {
  return {
    submits: counters.submits,
    // Serial GPU wait depth: how many times the CPU waited on the queue one after another.
    // (Concurrent mapAsync calls overlap and count once; see mock-gpu.ts `waitEpochs`.)
    serialGpuWaits: counters.waitEpochs,
    // Raw number of awaited mapAsync + onSubmittedWorkDone calls (overlapping ones counted individually).
    gpuWaitCalls: counters.mapAsync + counters.onSubmittedWorkDone,
    mapAsync: counters.mapAsync,
    onSubmittedWorkDone: counters.onSubmittedWorkDone,
    gpuToCpuBytes: counters.gpuToCpuCopyBytes,
    mappedRangeBytes: counters.mappedRangeBytes,
    cpuToGpuBytes: counters.cpuToGpuWriteBytes,
    writeBufferCalls: counters.writeBuffer,
    gpuToGpuCopyBytes: counters.gpuToGpuCopyBytes,
    buffersCreated: counters.buffersCreated,
    bindGroupsCreated: counters.bindGroupsCreated,
    computePasses: counters.computePasses,
    // Phase 16 (additive):
    commandEncoders: counters.commandEncoders ?? 0,
    dispatches: counters.dispatches ?? 0,
    clearBufferCalls: counters.clearBuffer ?? 0,
    copyBufferCalls: counters.copyBufferToBuffer ?? 0,
  };
}

function averageOf(records) {
  const keys = Object.keys(derive(records[0]?.counters ?? {
    submits: 0, mapAsync: 0, onSubmittedWorkDone: 0, gpuToCpuCopyBytes: 0, mappedRangeBytes: 0,
    cpuToGpuWriteBytes: 0, writeBuffer: 0, gpuToGpuCopyBytes: 0, buffersCreated: 0, bindGroupsCreated: 0, computePasses: 0, waitEpochs: 0,
  }));
  const out = {};
  for (const key of keys) out[key] = mean(records.map((r) => derive(r.counters)[key]));
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const stepperModule = await import(pathToFileURL(resolve(args.stepper)).href);
  const Stepper = stepperModule.MfmWebGPUStepper;
  const { runScenario, defaultScenarios } = await import(
    new URL('../../src/webgpu-mfm/tests/support/sync-scenarios.ts', import.meta.url).href
  );

  const profiles = [];
  if (args.profile === 'headless' || args.profile === 'both') {
    profiles.push({ name: 'headless', driver: 'step', metrics: 'none', wait: true });
  }
  if (args.profile === 'interactive' || args.profile === 'both') {
    profiles.push({ name: 'interactive', driver: 'encodeStep', metrics: 'worker', wait: args.waitAfterSubmit });
  }

  const results = [];
  for (const profile of profiles) {
    for (const scenario of defaultScenarios(profile.driver, profile.metrics, profile.wait)) {
      if (args.scenarios && !args.scenarios.includes(scenario.name)) continue;
      const result = await runScenario(scenario, Stepper, {
        orchestration: args.orchestration ?? undefined,
        traceDispatches: args.dispatchTraces,
      });
      const quiet = result.steps.filter((s) => !s.structureChanged);
      const structural = result.steps.filter((s) => s.structureChanged);
      results.push({
        scenario: result.name,
        profile: profile.name,
        driver: result.driver,
        metrics: result.metrics,
        particleCount: result.particleCount,
        capacity: result.capacity,
        steps: result.steps.length,
        quietSteps: quiet.length,
        structureChangeSteps: structural.length,
        perStepAll: averageOf(result.steps),
        perStepQuiet: quiet.length ? averageOf(quiet) : null,
        perStepStructureChange: structural.length ? averageOf(structural) : null,
        totals: derive(result.totals),
        finalPopulation: result.steps.at(-1)?.populationAfter ?? 0,
        ...(args.traces
          ? { trace: result.steps.map((s) => ({ t: s.timestep, n: s.populationAfter, gpu: s.gpuDigest, cpu: s.cpuDigest, ...(args.dispatchTraces ? { disp: s.dispatchDigest, dispN: s.dispatchRecords } : {}) })) }
          : {}),
      });
    }
  }

  const output = {
    schema: 'cepc-sync-accounting/1',
    timed: false,
    note:
      'Structural counts from the real MfmWebGPUStepper against a software GPUDevice. No GPU, no WGSL execution, no timing. ' +
      'Do not read these as performance numbers.',
    label: args.label,
    orchestration: args.orchestration,
    stepper: args.stepper,
    node: process.version,
    results,
  };
  mkdirSync(dirname(resolve(args.out)), { recursive: true });
  writeFileSync(resolve(args.out), `${JSON.stringify(output, null, 2)}\n`);

  const fmt = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(2));
  console.log(`\nsync-accounting [${args.label}] -> ${args.out}\n`);
  console.log(
    'profile      scenario               steps quiet struct | serial-waits/step(q) (s) | submits/step(q) (s) | GPU->CPU B/step(q) (s) | CPU->GPU B/step(q) (s)',
  );
  for (const r of results) {
    const q = r.perStepQuiet;
    const s = r.perStepStructureChange;
    console.log(
      `${r.profile.padEnd(12)} ${r.scenario.padEnd(22)} ${String(r.steps).padStart(5)} ${String(r.quietSteps).padStart(5)} ${String(r.structureChangeSteps).padStart(6)} | ` +
        `${(q ? fmt(q.serialGpuWaits) : '-').padStart(16)} ${(s ? fmt(s.serialGpuWaits) : '-').padStart(17)} | ` +
        `${(q ? fmt(q.submits) : '-').padStart(15)} ${(s ? fmt(s.submits) : '-').padStart(4)} | ` +
        `${(q ? fmt(q.gpuToCpuBytes) : '-').padStart(20)} ${(s ? fmt(s.gpuToCpuBytes) : '-').padStart(6)} | ` +
        `${(q ? fmt(q.cpuToGpuBytes) : '-').padStart(20)} ${(s ? fmt(s.cpuToGpuBytes) : '-').padStart(6)}`,
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
