/**
 * Phase 19 — 'blocked' death compaction (SHADER_DEATH_COMPACTION_BLOCKED).
 *
 * LIMITS (be explicit): Node does not run WGSL. This (a) checks the shader text against the bind group layout the stepper builds and
 * against the invariants the emulation relies on, and (b) emulates the kernel phase by phase (one loop per barrier-delimited phase,
 * 256 invocations) and requires the serial loop's exact output (same count, same ascending slots) for many sizes/death patterns,
 * including sizes around the 256-invocation chunking. Whether the shipped WGSL compiles and matches on a real GPU is checked by the
 * on-device kernel self-test (`benchmark-webgpu.mjs --selftest --real-gpu`, field blockedMatchesReference).
 */
import { describe, it, expect } from 'vitest';
import { SHADER_DEATH_COMPACTION, SHADER_DEATH_COMPACTION_BLOCKED } from '../src/MfmWebGPUStepper';

const bindings = (wgsl: string) =>
  [...wgsl.matchAll(/@binding\((\d+)\)\s*var<storage,\s*(read_write|read)>\s*(\w+)/g)].map((m) => `${m[1]}:${m[2]}:${m[3]}`).join(',');

describe('blocked death-compaction shader', () => {
  it('declares the same bindings as the serial shader (the stepper reuses one layout for all modes)', () => {
    expect(bindings(SHADER_DEATH_COMPACTION_BLOCKED)).toBe(bindings(SHADER_DEATH_COMPACTION));
  });
  it('keeps the structure the emulation relies on', () => {
    const s = SHADER_DEATH_COMPACTION_BLOCKED;
    expect(s.includes('@workgroup_size(256)')).toBe(true);
    expect(s.includes('var<workgroup> chunkCounts: array<u32, 256>;')).toBe(true);
    expect(s.includes('let chunk = (n + 255u) / 256u;')).toBe(true);
    expect(s.includes('offset < 256u')).toBe(true);
    expect((s.match(/workgroupBarrier\(\)/g) ?? []).length).toBe(3);
    // the early return must come after the last barrier
    expect(s.lastIndexOf('workgroupBarrier()')).toBeLessThan(s.indexOf('if (count == 0u) { return; }'));
    // the death predicate is the serial kernel's
    expect(s.includes('role[i] == 0u && healthOut[i] <= 0.0')).toBe(true);
    expect(SHADER_DEATH_COMPACTION.includes('role[i] == 0u && healthOut[i] <= 0.0')).toBe(true);
  });
});

function rng(seed: number): () => number {
  let x = seed >>> 0 || 1;
  return () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 0x100000000; };
}

function serial(n: number, role: Uint32Array, health: Float32Array): { count: number; slots: number[] } {
  const slots: number[] = [];
  for (let i = 0; i < n; i++) if (role[i] === 0 && health[i] <= 0) slots.push(i);
  return { count: slots.length, slots };
}

/** Phase-by-phase emulation of SHADER_DEATH_COMPACTION_BLOCKED for one workgroup of 256. */
function blocked(n: number, role: Uint32Array, health: Float32Array): { count: number; slots: number[] } {
  const chunk = Math.floor((n + 255) / 256);
  const first = (t: number) => Math.min(t * chunk, n);
  const last = (t: number) => Math.min(first(t) + chunk, n);
  const dies = (i: number) => role[i] === 0 && health[i] <= 0;
  const counts = new Uint32Array(256);
  const own = new Uint32Array(256);
  for (let t = 0; t < 256; t++) { let c = 0; for (let i = first(t); i < last(t); i++) if (dies(i)) c++; counts[t] = c; own[t] = c; }
  for (let offset = 1; offset < 256; offset <<= 1) {
    const add = new Uint32Array(256);
    for (let t = 0; t < 256; t++) add[t] = t >= offset ? counts[t - offset] : 0; // all reads before any write (barrier)
    for (let t = 0; t < 256; t++) counts[t] += add[t];
  }
  const total = counts[255];
  const slots: number[] = new Array(total).fill(-1);
  for (let t = 0; t < 256; t++) {
    if (own[t] === 0) continue;
    let slot = counts[t] - own[t];
    for (let i = first(t); i < last(t); i++) if (dies(i)) slots[slot++] = i;
  }
  return { count: total, slots };
}

describe('blocked death compaction (emulated) equals the serial loop', () => {
  const sizes = [0, 1, 2, 3, 127, 128, 129, 255, 256, 257, 511, 512, 513, 1000, 2000, 2049, 4096, 10000, 20000, 65537];
  const fractions = [0, 0.001, 0.02, 0.5, 0.97, 1];
  for (const n of sizes) {
    it(`n=${n}`, () => {
      const r = rng(n * 31 + 7);
      for (const fraction of fractions) {
        const role = new Uint32Array(n);
        const health = new Float32Array(n);
        for (let i = 0; i < n; i++) {
          role[i] = r() < 0.01 ? 1 + Math.floor(r() * 2) : 0; // a few input/output particles that must never be listed
          health[i] = r() < fraction ? (r() < 0.5 ? 0 : -r()) : 1 + r() * 99;
        }
        const a = serial(n, role, health);
        const b = blocked(n, role, health);
        expect(b.count, `n=${n} p=${fraction}`).toBe(a.count);
        expect(b.slots, `n=${n} p=${fraction}`).toEqual(a.slots);
      }
    });
  }
  it('clustered deaths (all in one chunk, all in the last chunk, alternating) keep ascending order', () => {
    const n = 5000;
    for (const pattern of ['first', 'last', 'alternate', 'chunk-boundaries']) {
      const role = new Uint32Array(n);
      const health = new Float32Array(n).fill(10);
      const chunk = Math.ceil(n / 256);
      for (let i = 0; i < n; i++) {
        const dead =
          pattern === 'first' ? i < 3 :
          pattern === 'last' ? i >= n - 3 :
          pattern === 'alternate' ? i % 2 === 0 :
          i % chunk === 0 || i % chunk === chunk - 1;
        if (dead) health[i] = 0;
      }
      expect(blocked(n, role, health)).toEqual(serial(n, role, health));
    }
  });
});
