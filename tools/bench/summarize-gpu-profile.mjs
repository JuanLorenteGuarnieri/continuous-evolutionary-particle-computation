#!/usr/bin/env node
/**
 * Phase 17 — GPU cost model from hardware benchmark runs.
 *
 * Reads performance/phase17/webgpu-<tag>-run<k>.json (written by benchmark-webgpu.mjs --real-gpu, see run-phase17-baseline.ps1)
 * and prints, per particle count, the measured per-pass GPU time, its share of the summed GPU pass time, dispatch and
 * workgroup counts, and the GPU share of the end-to-end step. Medians are taken across rounds; min..max shows the noise.
 *
 *   node tools/bench/summarize-gpu-profile.mjs [--dir performance/phase17] [--tag baseline] [--json out.json] [--md out.md]
 *
 * VALIDITY GATE: a run contributes only if it has real adapter info, was launched with --real-gpu, and carries GPU
 * timestamps. Software-rendered runs (SwiftShader) and runs without timestamp-query are listed as rejected and never
 * enter the cost model. If no run is valid the script exits with code 2 and prints no cost table.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const WORKGROUP_SIZE = 128; // MfmWebGPUStepper.ts WORKGROUP_SIZE; 'pressure' is the exception (1 workgroup of 1 invocation)
const args = { dir: 'performance/phase17', tag: 'baseline', json: null, md: null };
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a === '--dir') args.dir = process.argv[++i];
  else if (a === '--tag') args.tag = process.argv[++i];
  else if (a === '--json') args.json = process.argv[++i];
  else if (a === '--md') args.md = process.argv[++i];
  else throw new Error(`Unknown option ${a}`);
}

const finite = (xs) => xs.filter((x) => Number.isFinite(x));
const median = (xs) => {
  const v = finite(xs).sort((a, b) => a - b);
  if (!v.length) return NaN;
  const m = v.length >> 1;
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
};
const range = (xs) => {
  const v = finite(xs);
  return v.length ? [Math.min(...v), Math.max(...v)] : [NaN, NaN];
};
const fmt = (x, d = 3) => (Number.isFinite(x) ? x.toFixed(d) : 'n/a');

/** Static workgroups per dispatch, from MfmWebGPUStepper.ts (not measured). */
function workgroupsPerDispatch(label, n) {
  if (label === 'pressure') return '1';
  if (label === 'gridClear') return 'ceil(cells/128)';
  return String(Math.ceil(n / WORKGROUP_SIZE));
}

const re = new RegExp(`^webgpu-${args.tag}-run(\\d+)\\.json$`);
const files = readdirSync(args.dir).filter((f) => re.test(f)).sort();
if (!files.length) {
  console.error(`No webgpu-${args.tag}-run<k>.json files in ${args.dir}`);
  process.exit(1);
}

const rejected = [];
const adapters = new Map();
const byN = {}; // byN[N] = { runs: [{ file, baseline, noTs }] }
for (const f of files) {
  const report = JSON.parse(readFileSync(join(args.dir, f), 'utf-8'));
  const realGpuFlag = report.method?.realGpuFlags === true;
  for (const e of report.errors ?? []) rejected.push(`${f}: ERROR ${e.variant} N=${e.particleCount}: ${e.message}`);
  for (const run of report.runs ?? []) {
    if (run.backend !== 'WebGPU') continue;
    const r = run.result;
    const n = run.particleCount;
    const slot = ((byN[n] ??= { runs: [] }).runs[files.indexOf(f)] ??= { file: f });
    if (run.variant === 'gpuTimestampsDisabled') { slot.noTs = r; continue; }
    if (run.variant !== 'baseline') continue;
    const info = r.environment?.adapterInfo;
    const why = [];
    if (!realGpuFlag) why.push('not launched with --real-gpu');
    if (!info) why.push('no adapterInfo');
    if (r.method?.gpuTimestampsEnabled !== true) why.push('gpuTimestampsEnabled=false');
    if (!r.gpu) why.push('result.gpu is null');
    if (why.length) { rejected.push(`${f} N=${n}: ${why.join(', ')}`); continue; }
    adapters.set(JSON.stringify({ vendor: info.vendor, architecture: info.architecture, device: info.device, description: info.description }), 1);
    slot.baseline = r;
  }
}

const sizes = Object.keys(byN).map(Number).sort((a, b) => a - b);
const model = { schemaVersion: 1, kind: 'phase17-gpu-cost-model', tag: args.tag, adapters: [...adapters.keys()].map((s) => JSON.parse(s)), rejected, sizes: {} };
let validSizes = 0;
const md = [];

for (const n of sizes) {
  const valid = byN[n].runs.filter((s) => s?.baseline);
  if (!valid.length) continue;
  validSizes++;
  const gpuSum = valid.map((s) => s.baseline.gpu.sumMs.mean);
  const gpuSpan = valid.map((s) => s.baseline.gpu.spanMs.mean);
  const stepMs = valid.map((s) => s.baseline.frameWallMs?.mean);
  const entry = {
    rounds: valid.length,
    stepMs: { median: median(stepMs), range: range(stepMs) },
    stepP95Ms: median(valid.map((s) => s.baseline.frameWallMs?.p95)),
    stepP99Ms: median(valid.map((s) => s.baseline.frameWallMs?.p99)),
    stepsPerSecond: median(valid.map((s) => s.baseline.stepsPerSecond)),
    particleStepsPerSecond: median(valid.map((s) => s.baseline.particleStepsPerSecond)),
    gpuSumMs: { median: median(gpuSum), range: range(gpuSum) },
    gpuSpanMs: median(gpuSpan),
    gpuGapMs: median(valid.map((s) => s.baseline.gpu.meanGapMs)),
    gpuShareOfStep: median(valid.map((s) => (s.baseline.frameWallMs?.mean > 0 ? s.baseline.gpu.sumMs.mean / s.baseline.frameWallMs.mean : NaN))),
    zeroDurationFraction: median(valid.map((s) => s.baseline.gpu.zeroDurationFraction)),
    labels: {},
    groups: {},
  };
  const labelNames = [...new Set(valid.flatMap((s) => s.baseline.gpu.labels.map((l) => l.label)))];
  for (const label of labelNames) {
    const pick = (fn) => valid.map((s) => { const l = s.baseline.gpu.labels.find((x) => x.label === label); return l ? fn(l) : NaN; });
    entry.labels[label] = {
      meanMs: median(pick((l) => l.perStepMs.mean)),
      rangeMs: range(pick((l) => l.perStepMs.mean)),
      p50Ms: median(pick((l) => l.perStepMs.median)),
      p95Ms: median(pick((l) => l.perStepMs.p95)),
      passesPerStep: median(pick((l) => l.passesPerStep)),
      sharePct: 100 * median(pick((l) => l.shareOfSum)),
      workgroupsPerDispatch: workgroupsPerDispatch(label, n),
    };
  }
  for (const g of new Set(valid.flatMap((s) => s.baseline.gpu.groups.map((x) => x.group)))) {
    const pick = (fn) => valid.map((s) => { const x = s.baseline.gpu.groups.find((y) => y.group === g); return x ? fn(x) : NaN; });
    entry.groups[g] = { meanMs: median(pick((x) => x.perStepMs.mean)), sharePct: 100 * median(pick((x) => x.shareOfSum)) };
  }
  // Instrumentation overhead: only meaningful if both variants ran in the same file.
  const pairs = byN[n].runs.filter((s) => s?.baseline && s?.noTs?.frameWallMs);
  if (pairs.length) {
    const withTs = median(pairs.map((s) => s.baseline.frameWallMs.mean));
    const noTs = median(pairs.map((s) => s.noTs.frameWallMs.mean));
    entry.timestampOverhead = { stepMsWithTimestamps: withTs, stepMsWithout: noTs, deltaPct: (100 * (withTs - noTs)) / noTs, pairs: pairs.length };
  }
  model.sizes[n] = entry;

  md.push(`### N = ${n}  (${valid.length} round${valid.length > 1 ? 's' : ''}, median across rounds)\n`);
  md.push(`step ${fmt(entry.stepMs.median)} ms (p95 ${fmt(entry.stepP95Ms)}, p99 ${fmt(entry.stepP99Ms)}) | ${fmt(entry.stepsPerSecond, 1)} steps/s | ${fmt(entry.particleStepsPerSecond, 0)} particle-steps/s | GPU sum ${fmt(entry.gpuSumMs.median)} ms (${fmt(100 * entry.gpuShareOfStep, 1)}% of step) | GPU span ${fmt(entry.gpuSpanMs)} ms, idle gaps ${fmt(entry.gpuGapMs)} ms\n`);
  if (entry.zeroDurationFraction > 0.05) md.push(`> WARNING: ${fmt(100 * entry.zeroDurationFraction, 1)}% of passes reported 0 ns (timestamp quantization). Re-run with --real-gpu / developer features before trusting small passes.\n`);
  md.push('| pass | mean ms | min..max ms | p50 ms | p95 ms | % of GPU sum | dispatches/step | workgroups/dispatch (static) |');
  md.push('|---|---:|---|---:|---:|---:|---:|---|');
  for (const [label, v] of Object.entries(entry.labels).sort((a, b) => b[1].meanMs - a[1].meanMs)) {
    md.push(`| ${label} | ${fmt(v.meanMs)} | ${fmt(v.rangeMs[0])}..${fmt(v.rangeMs[1])} | ${fmt(v.p50Ms)} | ${fmt(v.p95Ms)} | ${fmt(v.sharePct, 1)} | ${fmt(v.passesPerStep, 1)} | ${v.workgroupsPerDispatch} |`);
  }
  md.push('');
  md.push('| group | mean ms | % of GPU sum |');
  md.push('|---|---:|---:|');
  for (const [g, v] of Object.entries(entry.groups).sort((a, b) => b[1].meanMs - a[1].meanMs)) md.push(`| ${g} | ${fmt(v.meanMs)} | ${fmt(v.sharePct, 1)} |`);
  if (entry.timestampOverhead) md.push(`\nTimestamp instrumentation overhead: ${fmt(entry.timestampOverhead.stepMsWithTimestamps)} ms vs ${fmt(entry.timestampOverhead.stepMsWithout)} ms without (${fmt(entry.timestampOverhead.deltaPct, 1)}%, ${entry.timestampOverhead.pairs} pair(s)).`);
  md.push('');
}

if (rejected.length) {
  console.error(`REJECTED runs (${rejected.length}) — excluded from the cost model:`);
  for (const r of rejected) console.error('  - ' + r);
}
if (!validSizes) {
  console.error('\nNo valid hardware GPU-timestamp runs. No cost model produced (this is intentional: software-rendered or timestamp-less data is not GPU time).');
  process.exit(2);
}
const header = `# GPU cost model — tag "${args.tag}"\n\nAdapters: ${model.adapters.map((a) => `${a.vendor} ${a.architecture} ${a.device} ${a.description}`.trim()).join('; ') || 'n/a'}\n`;
const text = [header, ...md].join('\n');
console.log(text);
if (args.json) writeFileSync(args.json, JSON.stringify(model, null, 2));
if (args.md) writeFileSync(args.md, text);
