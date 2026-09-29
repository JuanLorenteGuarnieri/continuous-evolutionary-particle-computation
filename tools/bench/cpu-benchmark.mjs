#!/usr/bin/env node
/**
 * Phase 14 — CPU reference benchmark (Node, no browser, no GPU).
 *
 * Measures MfmCpuReference.step() on the shared, deterministic, density-
 * controlled benchmark scenario (src/shared-config/src/BenchmarkScenario.ts).
 * This is the *reference implementation* baseline, not the WebGPU backend.
 *
 * Run (from the repository root):
 *   node --no-warnings --experimental-strip-types \
 *        --experimental-loader=./tools/bench/ts-prefer-loader.mjs \
 *        tools/bench/cpu-benchmark.mjs [options]
 *   (or: pnpm run benchmark:cpu -- [options])
 *
 * Options:
 *   --sizes 200,1000,2000     particle counts (default 200,500,1000,2000)
 *   --steps 20                measured steps per repeat (default 20)
 *   --warmup 3                warm-up steps per repeat (default 3)
 *   --repeats 3               independent runs per size (default 3)
 *   --budget-ms 60000         stop measuring a repeat after this wall time (default 60000)
 *   --seed 42                 scenario seed (default 42)
 *   --out <file>              JSON output path (default performance/phase14/cpu-reference.json)
 *   --quick                   tiny smoke configuration for CI (sizes 100,200; 3 steps; 1 repeat)
 */
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import { dirname, resolve } from 'node:path';
import { MfmCpuReference } from '@cepc/cpu-reference';
import { createBenchmarkScenario } from '@cepc/shared-config';
import { summarizeSamples } from '../../src/webgpu-mfm/src/profiling.ts';

function parseArgs(argv) {
  const args = {
    sizes: [200, 500, 1000, 2000],
    steps: 20,
    warmup: 3,
    repeats: 3,
    budgetMs: 60000,
    seed: 42,
    out: 'performance/phase14/cpu-reference.json',
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === '--sizes') args.sizes = next().split(',').map(Number);
    else if (a === '--steps') args.steps = Number(next());
    else if (a === '--warmup') args.warmup = Number(next());
    else if (a === '--repeats') args.repeats = Number(next());
    else if (a === '--budget-ms') args.budgetMs = Number(next());
    else if (a === '--seed') args.seed = Number(next());
    else if (a === '--out') args.out = next();
    else if (a === '--quick') Object.assign(args, { sizes: [100, 200], steps: 3, warmup: 1, repeats: 1 });
    else throw new Error(`Unknown option ${a}`);
  }
  return args;
}

function gitInfo() {
  try {
    const commit = execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    const dirty = execSync('git status --porcelain', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim().length > 0;
    return { commit, dirty };
  } catch {
    return { commit: null, dirty: null };
  }
}

function runRepeat(particleCount, args) {
  const scenario = createBenchmarkScenario({ particleCount, seed: args.seed });
  const sim = new MfmCpuReference(scenario.config, scenario.population, args.seed);
  const populationStart = scenario.population.particles.size;

  for (let i = 0; i < args.warmup; i++) sim.step();

  const stepMs = [];
  let particleSteps = 0;
  let populationSizeChanges = 0;
  let previousSize = scenario.population.particles.size;
  const runStart = performance.now();
  let truncated = false;
  for (let i = 0; i < args.steps; i++) {
    const before = performance.now();
    sim.step();
    const elapsed = performance.now() - before;
    stepMs.push(elapsed);
    const size = scenario.population.particles.size;
    particleSteps += size;
    if (size !== previousSize) populationSizeChanges++;
    previousSize = size;
    if (performance.now() - runStart > args.budgetMs) {
      truncated = i + 1 < args.steps;
      break;
    }
  }
  const totalMs = stepMs.reduce((a, b) => a + b, 0);
  return {
    measuredSteps: stepMs.length,
    truncated,
    populationStart,
    populationEnd: scenario.population.particles.size,
    populationSizeChanges,
    stepMs: summarizeSamples(stepMs),
    stepsPerSecond: stepMs.length / (totalMs / 1000),
    particleStepsPerSecond: particleSteps / (totalMs / 1000),
  };
}

const args = parseArgs(process.argv.slice(2));
const git = gitInfo();
const cpus = os.cpus();
const report = {
  schemaVersion: 1,
  kind: 'cpu-reference',
  generatedAt: new Date().toISOString(),
  commit: git.commit,
  workingTreeDirty: git.dirty,
  environment: {
    runtime: `node ${process.version}`,
    platform: `${os.platform()} ${os.release()} ${os.arch()}`,
    cpuModel: cpus[0]?.model ?? 'unknown',
    logicalCores: cpus.length,
    totalMemoryGiB: Number((os.totalmem() / 2 ** 30).toFixed(2)),
  },
  method: {
    scenario: 'createBenchmarkScenario (UI-default parameters, density 2 particles/unit^2, domain scaled with sqrt(N))',
    warmupSteps: args.warmup,
    stepsPerRepeat: args.steps,
    repeats: args.repeats,
    budgetMsPerRepeat: args.budgetMs,
    seed: args.seed,
    timer: 'performance.now()',
    gcExposed: typeof globalThis.gc === 'function',
  },
  results: [],
};

for (const particleCount of args.sizes) {
  const repeats = [];
  for (let r = 0; r < args.repeats; r++) {
    if (typeof globalThis.gc === 'function') globalThis.gc();
    const repeat = runRepeat(particleCount, args);
    repeats.push(repeat);
    console.log(
      `N=${particleCount} repeat ${r + 1}/${args.repeats}: median ${repeat.stepMs.median.toFixed(2)} ms, ` +
        `p95 ${repeat.stepMs.p95.toFixed(2)} ms, ${repeat.particleStepsPerSecond.toFixed(0)} particle-steps/s` +
        (repeat.truncated ? ' (truncated by budget)' : ''),
    );
  }
  const scenario = createBenchmarkScenario({ particleCount, seed: args.seed });
  report.results.push({
    particleCount,
    capacity: scenario.capacity,
    domain: { Lx: scenario.Lx, Ly: scenario.Ly },
    density: scenario.density,
    repeats,
    summary: {
      medianStepMs: summarizeSamples(repeats.map((x) => x.stepMs.median)),
      meanStepMs: summarizeSamples(repeats.map((x) => x.stepMs.mean)),
      p95StepMs: summarizeSamples(repeats.map((x) => x.stepMs.p95)),
      stepsPerSecond: summarizeSamples(repeats.map((x) => x.stepsPerSecond)),
      particleStepsPerSecond: summarizeSamples(repeats.map((x) => x.particleStepsPerSecond)),
    },
  });
}

const outPath = resolve(args.out);
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(report, null, 2) + '\n');
console.log(`Wrote ${outPath}`);
