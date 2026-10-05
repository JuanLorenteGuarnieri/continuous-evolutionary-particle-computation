/**
 * Phase 18 — structural checks of the cell-sorted force WGSL, plus an emulation of the sortScan kernel.
 *
 * LIMITS (be explicit): Node does NOT compile or run WGSL here. These tests catch the mistakes a text-level check can catch
 * (binding numbers/access modes that disagree with the bind group layout the stepper builds, loss of the barriers/array
 * size the scan relies on, the cell function drifting away from gridBuild, the pre-computed features drifting away from the
 * linked-list kernel's expressions) and validate the scan ALGORITHM by emulation. That the shipped WGSL compiles and gives the
 * same forces on a real GPU is checked by `node tools/bench/benchmark-webgpu.mjs --selftest --real-gpu` (kernel-selftest.ts).
 */
import { describe, it, expect } from 'vitest';
import {
  SHADER_GRID_BUILD,
  SHADER_SORT_COUNT,
  SHADER_SORT_SCAN,
  SHADER_SORT_SCATTER,
  shaderForce,
  shaderForceSorted,
} from '../src/MfmWebGPUStepper';

type Access = 'ro' | 'rw';

/** Parses `@binding(n) var<storage, read|read_write> name` declarations. */
function storageBindings(wgsl: string): Map<number, Access> {
  const out = new Map<number, Access>();
  for (const m of wgsl.matchAll(/@binding\((\d+)\)\s*var<storage,\s*(read_write|read)>/g)) {
    out.set(Number(m[1]), m[2] === 'read' ? 'ro' : 'rw');
  }
  return out;
}

/** The layouts built by MfmWebGPUStepper (binding -> access); binding 0 is the uniform block. */
const FORCE_LINKED_LAYOUT: Access[] = ['ro', 'ro', 'ro', 'ro', 'ro', 'ro', 'ro', 'ro', 'ro', 'rw', 'ro', 'rw']; // bindings 1..12 (Phase 5..17)
const FORCE_SORTED_LAYOUT: Access[] = ['ro', 'ro', 'ro', 'ro', 'ro', 'rw', 'ro', 'ro', 'ro', 'ro']; // bindings 1..10 (Phase 18)
const COUNT_LAYOUT: Access[] = ['ro', 'rw'];
const SCAN_LAYOUT: Access[] = ['rw', 'rw'];
const SCATTER_LAYOUT: Access[] = ['ro', 'ro', 'ro', 'ro', 'ro', 'rw', 'rw', 'rw', 'rw'];

function conforms(wgsl: string, layout: Access[], mustCoverAll: boolean): void {
  const declared = storageBindings(wgsl);
  for (const [binding, access] of declared) {
    expect(binding >= 1 && binding <= layout.length).toBe(true);
    expect(layout[binding - 1]).toBe(access);
  }
  if (mustCoverAll) expect(declared.size).toBe(layout.length);
}

describe('Phase 18 shaders agree with the bind group layouts the stepper creates', () => {
  it('linked-list force keeps its Phase 5..17 layout; sorted force uses its own dense 10-binding layout', () => {
    conforms(shaderForce(128), FORCE_LINKED_LAYOUT, true);
    conforms(shaderForceSorted(128, false), FORCE_SORTED_LAYOUT, true);
    conforms(shaderForceSorted(128, true), FORCE_SORTED_LAYOUT, true);
  });
  it('sort passes (exact layouts)', () => {
    conforms(SHADER_SORT_COUNT, COUNT_LAYOUT, true);
    conforms(SHADER_SORT_SCAN, SCAN_LAYOUT, true);
    conforms(SHADER_SORT_SCATTER, SCATTER_LAYOUT, true);
  });
  it('the force workgroup size parameter reaches the sorted kernel', () => {
    for (const wg of [32, 64, 128, 256]) expect(shaderForceSorted(wg, false).includes(`@workgroup_size(${wg})`)).toBe(true);
  });
  it('culling is compiled in only for sorted-culled, and only for >= 4 cells per axis', () => {
    expect(shaderForceSorted(128, true).includes('params.gridCountX >= 4u && params.gridCountY >= 4u')).toBe(true);
    expect(shaderForceSorted(128, false).includes('let cullEnabled = false;')).toBe(true);
  });
});

describe('the sorted layout is built from the same definitions as the linked-list path', () => {
  const cellLines = [
    'let px = wrapCoordinate(positions[i].x, params.lx);',
    'let py = wrapCoordinate(positions[i].y, params.ly);',
    'let cx = min(u32(floor(px / params.gridCellSize)), params.gridCountX - 1u);',
    'let cy = min(u32(floor(py / params.gridCellSize)), params.gridCountY - 1u);',
  ];
  it('sortCellOf uses the gridBuild cell formula', () => {
    for (const line of cellLines) expect(SHADER_GRID_BUILD.includes(line)).toBe(true);
    const sortFn = SHADER_SORT_COUNT.slice(SHADER_SORT_COUNT.indexOf('fn sortCellOf'));
    expect(sortFn.includes('wrapCoordinate(p.x, params.lx)')).toBe(true);
    expect(sortFn.includes('wrapCoordinate(p.y, params.ly)')).toBe(true);
    expect(sortFn.includes('min(u32(floor(px / params.gridCellSize)), params.gridCountX - 1u)')).toBe(true);
    expect(sortFn.includes('min(u32(floor(py / params.gridCellSize)), params.gridCountY - 1u)')).toBe(true);
  });
  it('pre-computed neighbour features are the linked-list kernel\'s expressions', () => {
    const linked = shaderForce(128);
    expect(linked.includes('feature(targetRs[j], params.rsMax)')).toBe(true);
    expect(linked.includes('feature(targetA[j], 10.0)')).toBe(true);
    expect(linked.includes('feature(length(velocities[j]), 10.0)')).toBe(true);
    expect(SHADER_SORT_SCATTER.includes('feature(targetRs[i], params.rsMax)')).toBe(true);
    expect(SHADER_SORT_SCATTER.includes('feature(targetA[i], 10.0)')).toBe(true);
    expect(SHADER_SORT_SCATTER.includes('feature(length(velocities[i]), 10.0)')).toBe(true);
  });
  it('the force law lines are unchanged', () => {
    for (const src of [shaderForce(128), shaderForceSorted(128, false), shaderForceSorted(128, true)]) {
      expect(src.includes('let range = params.rsMin + (params.rsMax - params.rsMin) * (q / f32(params.qmax));')).toBe(true);
      expect(src.includes('distanceSquared > 0.0 && distanceSquared <= rangeSquared')).toBe(true);
      expect(src.includes('let magnitude = spatialScore * (1.0 - distance / range);')).toBe(true);
      expect(src.includes('let forceFactor = magnitude / (distance + params.epsilon);')).toBe(true);
    }
  });
});

describe('sortScan', () => {
  it('keeps the invariants the emulation below relies on', () => {
    expect(SHADER_SORT_SCAN.includes('@workgroup_size(256)')).toBe(true);
    expect(SHADER_SORT_SCAN.includes('var<workgroup> chunkSums: array<u32, 256>;')).toBe(true);
    expect(SHADER_SORT_SCAN.includes('offset < 256u')).toBe(true);
    expect(SHADER_SORT_SCAN.includes('(cells + 255u) / 256u')).toBe(true);
    expect((SHADER_SORT_SCAN.match(/workgroupBarrier\(\)/g) ?? []).length).toBe(3);
  });

  /** Line-by-line emulation of SHADER_SORT_SCAN; every "for lid" loop is one barrier-delimited phase. */
  function scanEmulated(counts: Uint32Array): { start: Uint32Array; zeroed: boolean } {
    const cells = counts.length;
    const cnt = Uint32Array.from(counts);
    const start = new Uint32Array(cells + 1);
    const sums = new Uint32Array(256);
    const chunk = Math.floor((cells + 255) / 256);
    const first = (lid: number) => Math.min(lid * chunk, cells);
    const last = (lid: number) => Math.min(first(lid) + chunk, cells);
    for (let lid = 0; lid < 256; lid++) {
      let total = 0;
      for (let c = first(lid); c < last(lid); c++) total += cnt[c];
      sums[lid] = total;
    }
    for (let offset = 1; offset < 256; offset <<= 1) {
      const addend = new Uint32Array(256);
      for (let lid = 0; lid < 256; lid++) addend[lid] = lid >= offset ? sums[lid - offset] : 0; // all reads ...
      for (let lid = 0; lid < 256; lid++) sums[lid] = sums[lid] + addend[lid]; // ... before any write (barrier)
    }
    for (let lid = 0; lid < 256; lid++) {
      let run = lid > 0 ? sums[lid - 1] : 0;
      for (let c = first(lid); c < last(lid); c++) {
        const n = cnt[c];
        start[c] = run;
        run += n;
        cnt[c] = 0;
      }
      if (lid === 255) start[cells] = sums[255];
    }
    return { start, zeroed: cnt.every((v) => v === 0) };
  }

  it('equals a serial exclusive prefix sum (with the total at [cells]) and re-zeroes the counters', () => {
    let x = 0x9e3779b9;
    const rand = () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 0x100000000; };
    for (const cells of [1, 2, 3, 36, 196, 255, 256, 257, 511, 1000, 4096, 5000, 65536, 262144]) {
      const counts = new Uint32Array(cells);
      for (let c = 0; c < cells; c++) counts[c] = rand() < 0.2 ? 0 : Math.floor(rand() * 60);
      const { start, zeroed } = scanEmulated(counts);
      let run = 0;
      for (let c = 0; c < cells; c++) {
        expect(start[c]).toBe(run);
        run += counts[c];
      }
      expect(start[cells]).toBe(run);
      expect(zeroed).toBe(true);
    }
  });
});
