/**
 * Phase 17 — death-compaction variants.
 *
 * LIMITS (be explicit): this runs in Node and does NOT execute WGSL. It (1) checks the ALGORITHM of the parallel kernel by
 * emulating its workgroup lockstep (tile loop, Hillis-Steele scan with barriers between phases) against the serial
 * reference on randomized inputs, and (2) checks that both shaders declare identical bindings (so they share one bind
 * group layout) and that the parallel one keeps barriers/shared memory. Whether the shipped WGSL computes the same result on
 * a real GPU is checked by `node tools/bench/benchmark-webgpu.mjs --selftest --real-gpu` (kernel-selftest.ts).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const WG = 128;
const INTERNAL = 0;

function serial(n: number, role: Uint32Array, health: Float32Array): { count: number; slots: number[] } {
  const slots: number[] = [];
  for (let i = 0; i < n; i++) if (role[i] === INTERNAL && health[i] <= 0) slots.push(i);
  return { count: slots.length, slots };
}

/** Line-by-line emulation of SHADER_DEATH_COMPACTION_PARALLEL; each "for lid" loop is one barrier-delimited phase. */
function parallelEmulated(n: number, role: Uint32Array, health: Float32Array): { count: number; slots: number[] } {
  const out: number[] = [];
  const scan = new Uint32Array(WG);
  const flag = new Uint32Array(WG);
  let base = 0;
  for (let tile = 0; tile < n; tile += WG) {
    for (let lid = 0; lid < WG; lid++) {
      const i = tile + lid;
      flag[lid] = i < n && role[i] === INTERNAL && health[i] <= 0 ? 1 : 0;
      scan[lid] = flag[lid];
    }
    for (let offset = 1; offset < WG; offset <<= 1) {
      const addend = new Uint32Array(WG);
      for (let lid = 0; lid < WG; lid++) addend[lid] = lid >= offset ? scan[lid - offset] : 0; // all reads ...
      for (let lid = 0; lid < WG; lid++) scan[lid] = scan[lid] + addend[lid]; // ... before any write (barrier)
    }
    const tileTotal = scan[WG - 1];
    for (let lid = 0; lid < WG; lid++) if (flag[lid] === 1) out[base + scan[lid] - 1] = tile + lid;
    base += tileTotal;
  }
  return { count: base, slots: out };
}

function rng(seed: number): () => number {
  let x = seed >>> 0 || 1;
  return () => {
    x ^= x << 13;
    x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5;
    x >>>= 0;
    return x / 0x100000000;
  };
}

describe('death compaction: parallel algorithm == serial reference (emulated lockstep)', () => {
  const sizes = [0, 1, 2, 127, 128, 129, 255, 256, 257, 1000, 2049, 5000];
  for (const n of sizes) {
    for (const p of [0, 0.02, 0.5, 1]) {
      it(`N=${n} deathFraction=${p}`, () => {
        const rand = rng(1000 + n * 7 + Math.round(p * 100));
        const role = new Uint32Array(Math.max(n, 1));
        const health = new Float32Array(Math.max(n, 1));
        for (let i = 0; i < n; i++) {
          const r = rand();
          role[i] = r < 0.7 ? INTERNAL : r < 0.8 ? 1 : 2;
          health[i] = rand() < p ? -rand() * 5 : 0.001 + rand() * 10;
          const special = rand();
          if (special < 0.03) health[i] = NaN;
          else if (special < 0.06) health[i] = -0;
          else if (special < 0.09) health[i] = 0;
        }
        const a = serial(n, role, health);
        const b = parallelEmulated(n, role, health);
        expect(b.count).toBe(a.count);
        expect(b.slots).toEqual(a.slots); // same slots, same ascending order
      });
    }
  }
});

describe('death compaction shaders: layout compatibility', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const source = readFileSync(resolve(here, '../src/MfmWebGPUStepper.ts'), 'utf-8').replace(/\r\n/g, '\n');
  const region = (name: string): string => {
    const start = source.indexOf(`export const ${name} = /* wgsl */`);
    expect(start).toBeGreaterThan(-1);
    return source.slice(start, source.indexOf('`;', start + 40));
  };
  const bindings = (code: string): string[] =>
    [...code.matchAll(/@group\(0\) @binding\((\d+)\) var<([^>]+)> (\w+): ([^;]+);/g)].map((m) => `${m[1]}:${m[2]}:${m[3]}:${m[4]}`).sort();

  it('declare identical bindings, so both pipelines can share one bind group layout', () => {
    const s = region('SHADER_DEATH_COMPACTION');
    const p = region('SHADER_DEATH_COMPACTION_PARALLEL');
    expect(bindings(s).length).toBe(4);
    expect(bindings(p)).toEqual(bindings(s));
  });

  it('the parallel shader keeps shared memory, barriers and the uniform loop bound', () => {
    const p = region('SHADER_DEATH_COMPACTION_PARALLEL');
    expect(p).toContain('var<workgroup> scanBuf');
    expect(p.match(/workgroupBarrier\(\)/g)?.length).toBeGreaterThanOrEqual(4);
    expect(p).toContain('let n = params.activeCount;');
    expect(p).not.toContain('atomic');
  });
});
