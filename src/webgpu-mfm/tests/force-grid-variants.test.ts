/**
 * Phase 18 — grid-force variants (algorithm level).
 *
 * LIMITS (be explicit): this runs in Node and does NOT execute WGSL. It validates the ALGORITHM the new kernels implement
 * (counting sort + contiguous cell ranges + exact cell culling, see force-grid-model.ts) against a brute-force periodic
 * O(N^2) reference and against the Phase 5..17 linked-list traversal, in float64, on randomized populations including the
 * awkward geometries (1, 2, 3, 4 cells per axis, a wider last cell, particles on cell/domain borders, arbitrary atomic
 * arrival order). Whether the shipped WGSL computes the same thing on a real GPU is checked by
 * `node tools/bench/benchmark-webgpu.mjs --selftest --real-gpu` (kernel-selftest.ts, case 'force-variants').
 */
import { describe, it, expect } from 'vitest';
import {
  buildLinkedList,
  buildSorted,
  forceBruteForce,
  forceOn,
  gridSpec,
  type ForceModelParams,
  type ForceParticle,
  type ForceVariant,
} from '../src/force-grid-model';

function rng(seed: number): () => number {
  let x = seed >>> 0 || 1;
  return () => {
    x ^= x << 13; x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5; x >>>= 0;
    return x / 0x100000000;
  };
}

function shuffled(n: number, rand: () => number): number[] {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

interface Scenario { lx: number; ly: number; n: number; chargeMax: number; border: boolean; seed: number }

function make(s: Scenario): { ps: ForceParticle[]; g: ForceModelParams } {
  const rand = rng(s.seed);
  const rsMin = 0.5, rsMax = 5, qmax = 100;
  const spec = gridSpec(s.lx, s.ly, rsMax, 262_144);
  const g: ForceModelParams = {
    lx: s.lx, ly: s.ly, rsMin, rsMax, qmax, epsilon: 1e-6,
    gridCellSize: spec.cellSize, gridCountX: spec.countX, gridCountY: spec.countY,
  };
  const ps: ForceParticle[] = [];
  for (let i = 0; i < s.n; i++) {
    let x = rand() * s.lx, y = rand() * s.ly;
    if (s.border && rand() < 0.3) {
      // Put particles on / next to cell borders and the domain seam, where wrap and clamp logic matters.
      const bx = Math.floor(rand() * (spec.countX + 1)) * spec.cellSize;
      const by = Math.floor(rand() * (spec.countY + 1)) * spec.cellSize;
      x = Math.min(s.lx - 1e-9, Math.max(0, bx + (rand() - 0.5) * 1e-6));
      y = Math.min(s.ly - 1e-9, Math.max(0, by + (rand() - 0.5) * 1e-6));
    }
    ps.push({
      x, y, vx: (rand() - 0.5) * 6, vy: (rand() - 0.5) * 6,
      q: Math.floor(rand() * s.chargeMax), role: i < 2 ? i + 1 : 0,
      rs: rand() * rsMax, a: rand() * 12, omegaR: rand() - 0.5, omegaA: rand() - 0.5, omegaV: rand() - 0.5,
    });
  }
  return { ps, g };
}

const SCENARIOS: Scenario[] = [
  { lx: 4, ly: 4, n: 60, chargeMax: 100, border: false, seed: 1 }, // 1 x 1 cells
  { lx: 9, ly: 7, n: 80, chargeMax: 100, border: true, seed: 2 }, // 1 x 1
  { lx: 11, ly: 12, n: 90, chargeMax: 100, border: true, seed: 3 }, // 2 x 2
  { lx: 14, ly: 16, n: 120, chargeMax: 100, border: true, seed: 4 }, // 2 x 3
  { lx: 17, ly: 19, n: 150, chargeMax: 100, border: true, seed: 5 }, // 3 x 3 with a wide last cell
  { lx: 21, ly: 20.5, n: 200, chargeMax: 100, border: true, seed: 6 }, // 4 x 4
  { lx: 24.9, ly: 29.9, n: 250, chargeMax: 100, border: true, seed: 7 }, // 4 x 5, wide last cells
  { lx: 31.6, ly: 31.6, n: 400, chargeMax: 100, border: true, seed: 8 }, // 6 x 6 (N = 2000 benchmark geometry)
  { lx: 31.6, ly: 31.6, n: 400, chargeMax: 15, border: true, seed: 9 }, // low charge: tiny ranges
  { lx: 70.7, ly: 70.7, n: 600, chargeMax: 40, border: true, seed: 10 }, // 14 x 14
];

const VARIANTS: ForceVariant[] = ['linked-list', 'sorted', 'sorted-culled'];

describe('grid force variants agree with the periodic brute-force definition', () => {
  for (const s of SCENARIOS) {
    for (const variant of VARIANTS) {
      it(`${variant} on ${s.lx}x${s.ly}, n=${s.n}, qmax-draw=${s.chargeMax}, border=${s.border}`, () => {
        const { ps, g } = make(s);
        const rand = rng(s.seed * 7919);
        const ll = buildLinkedList(ps, g, shuffled(ps.length, rand));
        const sg = buildSorted(ps, g, shuffled(ps.length, rand));
        const slotOf = new Uint32Array(ps.length);
        for (let k = 0; k < sg.sortedIndex.length; k++) slotOf[sg.sortedIndex[k]] = k;
        // The sorted layout is a permutation of all particles with a consistent total.
        expect(sg.start[g.gridCountX * g.gridCountY]).toBe(ps.length);
        expect(new Set(sg.sortedIndex).size).toBe(ps.length);
        for (let i = 0; i < ps.length; i++) {
          const ref = forceBruteForce(i, ps, g);
          const got = forceOn(i, ps, g, variant, ll, sg, slotOf);
          // Same pair set (so the same inRange count) and the same sum up to float64 re-association.
          expect(got.inRange).toBe(ref.inRange);
          const scale = Math.max(1, Math.abs(ref.fx), Math.abs(ref.fy));
          expect(Math.abs(got.fx - ref.fx) / scale).toBeLessThan(1e-9);
          expect(Math.abs(got.fy - ref.fy) / scale).toBeLessThan(1e-9);
        }
      });
    }
  }
});

describe('culling only ever removes candidate tests', () => {
  it('sorted-culled visits no more candidates than sorted, and strictly fewer on low-charge populations', () => {
    const s: Scenario = { lx: 70.7, ly: 70.7, n: 3000, chargeMax: 20, border: false, seed: 11 };
    const { ps, g } = make(s);
    const rand = rng(99);
    const sg = buildSorted(ps, g, shuffled(ps.length, rand));
    const slotOf = new Uint32Array(ps.length);
    for (let k = 0; k < sg.sortedIndex.length; k++) slotOf[sg.sortedIndex[k]] = k;
    let plain = 0, culled = 0;
    for (let i = 0; i < ps.length; i++) {
      plain += forceOn(i, ps, g, 'sorted', null, sg, slotOf).visited;
      culled += forceOn(i, ps, g, 'sorted-culled', null, sg, slotOf).visited;
    }
    expect(culled).toBeLessThanOrEqual(plain);
    expect(culled).toBeLessThan(plain * 0.6);
  });
});
