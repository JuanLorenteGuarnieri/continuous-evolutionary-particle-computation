#!/usr/bin/env node
/**
 * Phase 16 — summarize the interleaved A/B runs written by run-phase16-ab.ps1
 * (performance/phase16/webgpu-<config>-run<k>.json). Medians across rounds, plus the min..max spread so the noise is visible.
 *   node tools/bench/summarize-ab.mjs [--dir performance/phase16] [--baseline cache-off] [--out performance/phase16/ab-summary.json]
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const args = { dir: 'performance/phase16', baseline: 'cache-off', out: null };
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a === '--dir') args.dir = process.argv[++i];
  else if (a === '--baseline') args.baseline = process.argv[++i];
  else if (a === '--out') args.out = process.argv[++i];
  else throw new Error(`Unknown option ${a}`);
}

const median = (xs) => {
  const v = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return NaN;
  const m = v.length >> 1;
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
};
const range = (xs) => {
  const v = xs.filter((x) => Number.isFinite(x));
  return v.length ? [Math.min(...v), Math.max(...v)] : [NaN, NaN];
};
const section = (stepperCpu, name) => stepperCpu?.sections?.find((s) => s.section === name)?.perStepMs?.mean ?? NaN;
const counterPerStep = (stepperCpu, name) => {
  const c = stepperCpu?.counters?.find((x) => x.counter === name);
  return c && stepperCpu.steps ? c.total / stepperCpu.steps : NaN;
};

const files = readdirSync(args.dir).filter((f) => /^webgpu-.+-run\d+\.json$/.test(f));
if (!files.length) throw new Error(`No webgpu-<config>-run<k>.json files in ${args.dir}`);

// samples[config][N] = { metricName: [values per round] }
const samples = {};
const adapters = new Set();
let realGpuFlags = new Set();
const failures = [];
for (const f of files) {
  const [, config] = /^webgpu-(.+)-run\d+\.json$/.exec(f);
  const report = JSON.parse(readFileSync(join(args.dir, f), 'utf-8'));
  realGpuFlags.add(String(report.method?.realGpuFlags ?? false));
  for (const e of report.errors ?? []) failures.push(`${f}: ${e.variant} N=${e.particleCount}: ${e.message}`);
  for (const run of report.runs ?? []) {
    if (run.backend !== 'WebGPU' || run.variant !== 'baseline') continue;
    const r = run.result;
    const info = r.environment?.adapterInfo;
    if (info) adapters.add(JSON.stringify({ vendor: info.vendor, architecture: info.architecture, device: info.device, description: info.description }));
    const bucket = ((samples[config] ??= {})[run.particleCount] ??= {});
    const push = (k, v) => (bucket[k] ??= []).push(v);
    push('steps/s', r.stepsPerSecond);
    push('particle-steps/s', r.particleStepsPerSecond);
    push('frame p50 ms', r.frameWallMs?.median);
    push('frame p95 ms', r.frameWallMs?.p95);
    push('frame p99 ms', r.frameWallMs?.p99);
    push('gpu sum ms/step', r.gpu?.sumMs?.mean);
    push('gpu span ms/step', r.gpu?.spanMs?.mean);
    push('encode.passes ms', section(r.stepperCpu, 'encode.passesMs'));
    push('encode.writeParams ms', section(r.stepperCpu, 'encode.writeParamsMs'));
    push('stepUnsafe.encode ms', section(r.stepperCpu, 'stepUnsafe.encodeMs'));
    push('stepUnsafe.submit ms', section(r.stepperCpu, 'stepUnsafe.submitMs'));
    push('bindGroups/step', counterPerStep(r.stepperCpu, 'encode.bindGroupsCreated'));
    push('writeBuffer/step', counterPerStep(r.stepperCpu, 'encode.writeBuffers'));
  }
}

console.log('Adapter(s):', [...adapters].join(' | ') || '(none reported)');
if ([...adapters].some((a) => /swiftshader|llvmpipe|software|microsoft basic/i.test(a))) {
  console.log('\n!!! A SOFTWARE adapter was used. These numbers are NOT hardware numbers. Re-run with --real-gpu (the script does) and check chrome://gpu.\n');
}
if (realGpuFlags.has('false')) console.log('!!! Some files were produced without --real-gpu (software-rendering flags were passed).\n');
if (failures.length) console.log('Failures:\n  ' + failures.join('\n  ') + '\n');

const configs = Object.keys(samples).sort((a, b) => (a === args.baseline ? -1 : b === args.baseline ? 1 : a.localeCompare(b)));
const summary = { schema: 'cepc-phase16-ab-summary/1', baseline: args.baseline, adapters: [...adapters].map((a) => JSON.parse(a)), configs: {} };
const sizes = [...new Set(configs.flatMap((c) => Object.keys(samples[c]).map(Number)))].sort((a, b) => a - b);
const metrics = ['steps/s', 'particle-steps/s', 'frame p50 ms', 'frame p95 ms', 'frame p99 ms', 'gpu sum ms/step', 'gpu span ms/step', 'encode.passes ms', 'encode.writeParams ms', 'stepUnsafe.encode ms', 'stepUnsafe.submit ms', 'bindGroups/step', 'writeBuffer/step'];
const fmt = (x) => (Number.isFinite(x) ? (Math.abs(x) >= 1000 ? x.toFixed(0) : Math.abs(x) >= 10 ? x.toFixed(2) : x.toFixed(4)) : 'n/a');

for (const n of sizes) {
  console.log(`\n=== N = ${n}  (median of rounds [min..max]; delta vs ${args.baseline})`);
  console.log(['metric'.padEnd(22), ...configs.map((c) => c.padEnd(34))].join(' '));
  for (const m of metrics) {
    const cells = configs.map((c) => {
      const xs = samples[c]?.[n]?.[m] ?? [];
      const med = median(xs), [lo, hi] = range(xs);
      const base = median(samples[args.baseline]?.[n]?.[m] ?? []);
      const delta = c !== args.baseline && Number.isFinite(base) && base !== 0 ? ` ${(((med - base) / base) * 100).toFixed(1)}%` : '';
      ((summary.configs[c] ??= {})[n] ??= {})[m] = { median: med, min: lo, max: hi, rounds: xs.length };
      return `${fmt(med)} [${fmt(lo)}..${fmt(hi)}]${delta}`.padEnd(34);
    });
    if (cells.every((c) => c.trim().startsWith('n/a'))) continue;
    console.log([m.padEnd(22), ...cells].join(' '));
  }
}
console.log('\nHow to read this: a difference smaller than the min..max spread between rounds is noise, not an effect.');
if (args.out) writeFileSync(args.out, JSON.stringify(summary, null, 1) + '\n');
