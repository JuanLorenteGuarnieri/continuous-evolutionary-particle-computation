/**
 * Phase 18 — CPU model of the grid-force kernels, used ONLY by tests (it is not imported by the runtime).
 *
 * It mirrors, operation for operation, the three force variants that exist in MfmWebGPUStepper.ts:
 *   - 'linked-list'  : the Phase 5..17 kernel (cellHead / particleNext chains),
 *   - 'sorted'       : cell-sorted layout (counting sort, contiguous per-cell ranges),
 *   - 'sorted-culled': 'sorted' plus exact culling of neighbour cells that cannot contain an in-range particle.
 * Its purpose is to prove, in float64 on randomized inputs, that all three visit a superset of the in-range pairs and
 * therefore compute the same mathematical sum as a brute-force periodic O(N^2) reference. It does NOT execute WGSL.
 */

export interface ForceParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Charge as a float (the shader converts the u32 charge to f32). */
  q: number;
  /** 0 = internal; anything else = input/output (receives zero force but is still a neighbour). */
  role: number;
  rs: number;
  a: number;
  omegaR: number;
  omegaA: number;
  omegaV: number;
}

export interface ForceModelParams {
  lx: number;
  ly: number;
  rsMin: number;
  rsMax: number;
  qmax: number;
  epsilon: number;
  gridCellSize: number;
  gridCountX: number;
  gridCountY: number;
}

export type ForceVariant = 'linked-list' | 'sorted' | 'sorted-culled';

const jsRound = (x: number): number => Math.floor(x + 0.5);
const torusDelta = (d: number, extent: number): number => d - extent * jsRound(d / extent);
const feature = (value: number, scale: number): number => Math.min(1, Math.max(0, value / scale));

export function wrapCoordinate(x: number, extent: number): number {
  return x - Math.floor(x / extent) * extent;
}

/** Mirror of the stepper's computeGridSpec() for a given largest interaction range. */
export function gridSpec(lx: number, ly: number, maxInteractionRange: number, maxGridCells: number): { countX: number; countY: number; cellSize: number } {
  const cellSize = Math.max(maxInteractionRange, Math.sqrt((lx * ly) / maxGridCells));
  return { countX: Math.max(1, Math.floor(lx / cellSize)), countY: Math.max(1, Math.floor(ly / cellSize)), cellSize };
}

/** Cell used by gridBuild / the new count+scatter passes (positions are wrapped first). */
export function buildCell(p: ForceParticle, g: ForceModelParams): number {
  const px = wrapCoordinate(p.x, g.lx);
  const py = wrapCoordinate(p.y, g.ly);
  const cx = Math.min(Math.floor(px / g.gridCellSize), g.gridCountX - 1);
  const cy = Math.min(Math.floor(py / g.gridCellSize), g.gridCountY - 1);
  return cy * g.gridCountX + cx;
}

export interface LinkedListGrid { head: Int32Array; next: Int32Array }
export interface SortedGrid { start: Uint32Array; sortedIndex: Uint32Array }

/** `order` is the (arbitrary) order in which invocations hit the atomics; the kernels must not depend on it. */
export function buildLinkedList(ps: ForceParticle[], g: ForceModelParams, order: number[]): LinkedListGrid {
  const cells = g.gridCountX * g.gridCountY;
  const head = new Int32Array(cells).fill(-1);
  const next = new Int32Array(ps.length).fill(-1);
  for (const i of order) {
    const c = buildCell(ps[i], g);
    next[i] = head[c];
    head[c] = i;
  }
  return { head, next };
}

/** Counting sort exactly as the shaders do it: count (atomicAdd), exclusive scan (+ total at index `cells`), scatter (atomicAdd cursor). */
export function buildSorted(ps: ForceParticle[], g: ForceModelParams, order: number[]): SortedGrid {
  const cells = g.gridCountX * g.gridCountY;
  const count = new Uint32Array(cells);
  for (const i of order) count[buildCell(ps[i], g)]++;
  const start = new Uint32Array(cells + 1);
  let run = 0;
  for (let c = 0; c < cells; c++) {
    start[c] = run;
    run += count[c];
    count[c] = 0; // the scan pass re-zeroes the counters so the scatter pass can use them as cursors
  }
  start[cells] = run;
  const sortedIndex = new Uint32Array(ps.length);
  for (const i of order) {
    const c = buildCell(ps[i], g);
    sortedIndex[start[c] + count[c]++] = i;
  }
  return { start, sortedIndex };
}

function wrappedCell(c: number, count: number): number {
  const x = c % count;
  return x < 0 ? x + count : x;
}

/** Same self-excluding / dedup rules the kernels use for 1- and 2-cell-wide grids. */
function skipOffset(o: number, count: number): boolean {
  return (count === 1 && o !== 0) || (count === 2 && o === 1);
}

/** Lower/upper x (or y) edge of unwrapped neighbour cell k (k in -1..count) in the frame of the querying particle. */
export function cellLower(k: number, count: number, cs: number, extent: number): number {
  return k < 0 ? (count - 1) * cs - extent : k * cs;
}
export function cellUpper(k: number, count: number, cs: number, extent: number): number {
  if (k < 0) return 0;
  const last = count - 1;
  if (k === last) return extent;
  if (k > last) return extent + cs;
  return (k + 1) * cs;
}

/** Slack that makes the culling test conservative against f32 rounding of cell assignment. */
export const CULL_SLACK_FRACTION = 1e-4;

export interface ForceResult { fx: number; fy: number; visited: number; inRange: number }

/** Force on particle `i`. `visited` counts candidate pairs actually distance-tested (the quantity culling reduces). */
export function forceOn(
  i: number,
  ps: ForceParticle[],
  g: ForceModelParams,
  variant: ForceVariant,
  ll: LinkedListGrid | null,
  sg: SortedGrid | null,
  slotOf: Uint32Array | null,
): ForceResult {
  const p = ps[i];
  if (p.role !== 0) return { fx: 0, fy: 0, visited: 0, inRange: 0 };
  const range = g.rsMin + (g.rsMax - g.rsMin) * (p.q / g.qmax);
  if (!(range > 0)) return { fx: 0, fy: 0, visited: 0, inRange: 0 };
  const rangeSquared = range * range;
  const cx = Math.min(Math.floor(p.x / g.gridCellSize), g.gridCountX - 1);
  const cy = Math.min(Math.floor(p.y / g.gridCellSize), g.gridCountY - 1);
  const cullAllowed = variant === 'sorted-culled' && g.gridCountX >= 4 && g.gridCountY >= 4;
  const slack = CULL_SLACK_FRACTION * g.gridCellSize;
  let fx = 0, fy = 0, visited = 0, inRange = 0;

  const test = (j: number): void => {
    if (i === j) return;
    visited++;
    const q = ps[j];
    const dx = torusDelta(q.x - p.x, g.lx);
    const dy = torusDelta(q.y - p.y, g.ly);
    const d2 = dx * dx + dy * dy;
    if (d2 > 0 && d2 <= rangeSquared) {
      inRange++;
      const distance = Math.sqrt(d2);
      const score = p.omegaR * feature(q.rs, g.rsMax) + p.omegaA * feature(q.a, 10) + p.omegaV * feature(Math.hypot(q.vx, q.vy), 10);
      const factor = (score * (1 - distance / range)) / (distance + g.epsilon);
      fx += factor * dx;
      fy += factor * dy;
    }
  };

  for (let oy = -1; oy <= 1; oy++) {
    if (skipOffset(oy, g.gridCountY)) continue;
    let rowGap = 0;
    if (cullAllowed) {
      const k = cy + oy;
      rowGap = Math.max(cellLower(k, g.gridCountY, g.gridCellSize, g.ly) - p.y, p.y - cellUpper(k, g.gridCountY, g.gridCellSize, g.ly), 0);
    }
    for (let ox = -1; ox <= 1; ox++) {
      if (skipOffset(ox, g.gridCountX)) continue;
      if (cullAllowed) {
        const k = cx + ox;
        const colGap = Math.max(cellLower(k, g.gridCountX, g.gridCellSize, g.lx) - p.x, p.x - cellUpper(k, g.gridCountX, g.gridCellSize, g.lx), 0);
        const reach = range + slack;
        if (colGap * colGap + rowGap * rowGap > reach * reach) continue;
      }
      const cell = wrappedCell(cy + oy, g.gridCountY) * g.gridCountX + wrappedCell(cx + ox, g.gridCountX);
      if (variant === 'linked-list') {
        for (let j = ll!.head[cell]; j !== -1; j = ll!.next[j]) test(j);
      } else {
        for (let s = sg!.start[cell]; s < sg!.start[cell + 1]; s++) {
          if (s === slotOf![i]) continue;
          test(sg!.sortedIndex[s]);
        }
      }
    }
  }
  return { fx, fy, visited, inRange };
}

/** O(N^2) periodic reference: the mathematical definition both grid variants must reproduce. */
export function forceBruteForce(i: number, ps: ForceParticle[], g: ForceModelParams): { fx: number; fy: number; inRange: number } {
  const p = ps[i];
  if (p.role !== 0) return { fx: 0, fy: 0, inRange: 0 };
  const range = g.rsMin + (g.rsMax - g.rsMin) * (p.q / g.qmax);
  if (!(range > 0)) return { fx: 0, fy: 0, inRange: 0 };
  let fx = 0, fy = 0, inRange = 0;
  for (let j = 0; j < ps.length; j++) {
    if (j === i) continue;
    const q = ps[j];
    const dx = torusDelta(q.x - p.x, g.lx);
    const dy = torusDelta(q.y - p.y, g.ly);
    const d2 = dx * dx + dy * dy;
    if (d2 > 0 && d2 <= range * range) {
      inRange++;
      const distance = Math.sqrt(d2);
      const score = p.omegaR * feature(q.rs, g.rsMax) + p.omegaA * feature(q.a, 10) + p.omegaV * feature(Math.hypot(q.vx, q.vy), 10);
      const factor = (score * (1 - distance / range)) / (distance + g.epsilon);
      fx += factor * dx;
      fy += factor * dy;
    }
  }
  return { fx, fy, inRange };
}
