#!/usr/bin/env node
/**
 * Phase 17 — A/B comparison of GPU kernel configurations.
 *
 *   node tools/bench/compare-gpu-profiles.mjs --baseline ab-baseline --candidate ab-death-parallel [--candidate ...]
 *        [--dir performance/phase17] [--variant baseline|renderDisabled] [--md out.md] [--json out.json]
 *
 * Reads webgpu-<tag>-run<k>.json (benchmark-webgpu.mjs --real-gpu), uses only runs with real adapter info + GPU timestamps, takes
 * the MEDIAN across rounds per particle count and reports candidate vs baseline for: end-to-end step time, steps/s,
 * particle-steps/s, summed GPU pass time, and every GPU pass. A difference is flagged "beyond noise" only when the min..max
 * round ranges of baseline and candidate do not overlap; otherwise it is reported as within noise. Differences are never
 * labelled improvements by this script: that decision is made in the report/ledger with correctness results.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const args = { dir: 'performance/phase17', baseline: null, candidates: [], variant: null, md: null, json: null };
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a === '--dir') args.dir = process.argv[++i];
  else if (a === '--baseline') args.baseline = process.argv[++i];
  else if (a === '--candidate') args.candidates.push(process.argv[++i]);
  else if (a === '--variant') args.variant = process.argv[++i];
  else if (a === '--md') args.md = process.argv[++i];
  else if (a === '--json') args.json = process.argv[++i];
  else throw new Error(`Unknown option ${a}`);
}
if (!args.baseline || !args.candidates.length) throw new Error('--baseline and at least one --candidate are required');

const finite = (xs) => xs.filter((x) => Number.isFinite(x));
const median = (xs) => { const v = finite(xs).sort((a, b) => a - b); if (!v.length) return NaN; const m = v.length >> 1; return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2; };
const range = (xs) => { const v = finite(xs); return v.length ? [Math.min(...v), Math.max(...v)] : [NaN, NaN]; };
const fmt = (x, d = 3) => (Number.isFinite(x) ? x.toFixed(d) : 'n/a');
const overlap = (a, b) => a[0] <= b[1] && b[0] <= a[1];

function load(tag, variant) {
  const re = new RegExp(`^webgpu-${tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-run(\\d+)\\.json$`);
  const files = readdirSync(args.dir).filter((f) => re.test(f)).sort();
  if (!files.length) throw new Error(`No files for tag "${tag}" in ${args.dir}`);
  const bySize = {};
  const skipped = [];
  for (const f of files) {
    const report = JSON.parse(readFileSync(join(args.dir, f), 'utf-8'));
    for (const run of report.runs ?? []) {
      if (run.backend !== 'WebGPU' || run.variant !== variant) continue;
      const r = run.result;
      if (!r?.environment?.adapterInfo || !r.gpu || r.method?.gpuTimestampsEnabled !== true) { skipped.push(`${f} N=${run.particleCount}`); continue; }
      (bySize[run.particleCount] ??= []).push(r);
    }
  }
  return { bySize, skipped, files: files.length, kernels: JSON.stringify(JSON.parse(readFileSync(join(args.dir, files[0]), 'utf-8')).method?.kernels ?? null) };
}

const variants = args.variant ? [args.variant] : ['baseline', 'renderDisabled'];
const out = { schemaVersion: 1, kind: 'phase17-ab-comparison', baseline: args.baseline, comparisons: [] };
const md = [];
const pct = (a, b) => (Number.isFinite(a) && Number.isFinite(b) && a !== 0 ? (100 * (b - a)) / a : NaN);
const verdict = (ra, rb, d) => (!Number.isFinite(d) ? 'n/a' : overlap(ra, rb) ? 'within noise' : d < 0 ? 'lower (beyond noise)' : 'higher (beyond noise)');

for (const variant of variants) {
  const base = load(args.baseline, variant);
  for (const tag of args.candidates) {
    const cand = load(tag, variant);
    md.push(`## ${tag} vs ${args.baseline}  [variant: ${variant}]  (kernels: ${cand.kernels}; rounds ${cand.files} vs ${base.files})\n`);
    if (base.skipped.length || cand.skipped.length) md.push(`> excluded (no real adapter/timestamps): ${[...base.skipped, ...cand.skipped].length} run(s)\n`);
    const entry = { candidate: tag, variant, kernels: cand.kernels, sizes: {} };
    for (const n of Object.keys(base.bySize).map(Number).sort((a, b) => a - b)) {
      const A = base.bySize[n]; const B = cand.bySize[n];
      if (!B) continue;
      const metric = (set, fn) => set.map(fn);
      const rows = [];
      const addRow = (name, fa, fb, d = 3) => {
        const va = metric(A, fa); const vb = metric(B, fb);
        const ma = median(va); const mb = median(vb); const delta = pct(ma, mb);
        rows.push({ name, base: ma, cand: mb, deltaPct: delta, verdict: verdict(range(va), range(vb), delta), d });
      };
      addRow('step ms (mean)', (r) => r.frameWallMs.mean, (r) => r.frameWallMs.mean);
      addRow('step ms (p95)', (r) => r.frameWallMs.p95, (r) => r.frameWallMs.p95);
      addRow('particle-steps/s', (r) => r.particleStepsPerSecond, (r) => r.particleStepsPerSecond, 0);
      addRow('GPU sum ms', (r) => r.gpu.sumMs.mean, (r) => r.gpu.sumMs.mean);
      const labels = [...new Set([...A, ...B].flatMap((r) => r.gpu.labels.map((l) => l.label)))];
      for (const label of labels) {
        const get = (r) => r.gpu.labels.find((l) => l.label === label)?.perStepMs.mean ?? NaN;
        addRow(`pass ${label}`, get, get);
      }
      entry.sizes[n] = { roundsBaseline: A.length, roundsCandidate: B.length, rows: rows.map(({ d, ...x }) => x) };
      md.push(`### N = ${n}  (${A.length} baseline / ${B.length} candidate rounds, medians)\n`);
      md.push('| metric | baseline | candidate | delta % | verdict |');
      md.push('|---|---:|---:|---:|---|');
      for (const r of rows) md.push(`| ${r.name} | ${fmt(r.base, r.d)} | ${fmt(r.cand, r.d)} | ${fmt(r.deltaPct, 1)} | ${r.verdict} |`);
      md.push('');
    }
    out.comparisons.push(entry);
  }
}
const text = md.join('\n');
console.log(text);
if (args.md) writeFileSync(args.md, text);
if (args.json) writeFileSync(args.json, JSON.stringify(out, null, 2));
