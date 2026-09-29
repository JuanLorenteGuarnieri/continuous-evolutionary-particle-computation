/**
 * Phase 14 — instrumentation primitives.
 *
 * This module is intentionally dependency-free (no imports, no ambient WebGPU
 * enums, only erasable TypeScript syntax) so that it can be unit-tested in
 * plain Node with a mocked GPUDevice and so that it never affects the normal
 * simulation path unless a profiler instance is explicitly created.
 *
 * Nothing here changes simulation semantics. All profilers are opt-in: the
 * stepper only touches them through `profiler?.` checks, so the disabled cost
 * is one null check per instrumented site.
 */

// ---------------------------------------------------------------------------
// Statistics
// ---------------------------------------------------------------------------

export interface SampleStats {
  count: number;
  sum: number;
  mean: number;
  median: number;
  p95: number;
  p99: number;
  min: number;
  max: number;
  stddev: number;
}

const EMPTY_STATS: SampleStats = {
  count: 0,
  sum: 0,
  mean: 0,
  median: 0,
  p95: 0,
  p99: 0,
  min: 0,
  max: 0,
  stddev: 0,
};

/**
 * Linear-interpolation percentile (the "type 7" definition used by NumPy's
 * default). `sorted` must be ascending. `q` is in [0, 1].
 */
export function percentileSorted(sorted: readonly number[], q: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const position = Math.min(Math.max(q, 0), 1) * (sorted.length - 1);
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  const weight = position - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

export function summarizeSamples(values: readonly number[]): SampleStats {
  const finite = values.filter((value) => Number.isFinite(value));
  if (finite.length === 0) return { ...EMPTY_STATS };
  const sorted = [...finite].sort((a, b) => a - b);
  let sum = 0;
  for (const value of sorted) sum += value;
  const mean = sum / sorted.length;
  let squared = 0;
  for (const value of sorted) squared += (value - mean) * (value - mean);
  // Population standard deviation is sufficient here: we report the spread of
  // the measured samples, not an estimator of a wider population.
  const stddev = Math.sqrt(squared / sorted.length);
  return {
    count: sorted.length,
    sum,
    mean,
    median: percentileSorted(sorted, 0.5),
    p95: percentileSorted(sorted, 0.95),
    p99: percentileSorted(sorted, 0.99),
    min: sorted[0],
    max: sorted[sorted.length - 1],
    stddev,
  };
}

// ---------------------------------------------------------------------------
// CPU section profiler
// ---------------------------------------------------------------------------

export interface CpuStepRecord {
  /** Wall-clock milliseconds accumulated per named section during one step. */
  sections: Record<string, number>;
  /** Event counts and byte counts accumulated per named counter during one step. */
  counters: Record<string, number>;
}

/**
 * Accumulates named wall-clock sections and counters between `commitStep()`
 * calls. Sections may be entered several times per step (they accumulate).
 *
 * Usage at an instrumented site:
 *   const t = prof ? prof.now() : 0;
 *   ...work...
 *   prof?.since('section', t);
 */
export class CpuSectionProfiler {
  private sections: Record<string, number> = {};
  private counters: Record<string, number> = {};
  private records: CpuStepRecord[] = [];

  public now(): number {
    return performance.now();
  }

  public add(label: string, elapsedMs: number): void {
    this.sections[label] = (this.sections[label] ?? 0) + elapsedMs;
  }

  public since(label: string, startMs: number): void {
    this.add(label, performance.now() - startMs);
  }

  public inc(label: string, amount = 1): void {
    this.counters[label] = (this.counters[label] ?? 0) + amount;
  }

  /** Closes the current step and starts a new accumulation window. */
  public commitStep(): CpuStepRecord {
    const record: CpuStepRecord = { sections: this.sections, counters: this.counters };
    this.records.push(record);
    this.sections = {};
    this.counters = {};
    return record;
  }

  public getRecords(): readonly CpuStepRecord[] {
    return this.records;
  }

  public reset(): void {
    this.sections = {};
    this.counters = {};
    this.records = [];
  }
}

export interface CpuSectionAggregate {
  section: string;
  /** Number of steps in which the section was entered at least once. */
  stepsPresent: number;
  /** Statistics over all steps (steps without the section count as 0 ms). */
  perStepMs: SampleStats;
  /** Total milliseconds across all supplied records. */
  totalMs: number;
}

export interface CpuCounterAggregate {
  counter: string;
  total: number;
  /** Number of steps in which the counter was non-zero. */
  stepsPresent: number;
  perStep: SampleStats;
}

export interface CpuAggregate {
  steps: number;
  sections: CpuSectionAggregate[];
  counters: CpuCounterAggregate[];
}

export function aggregateCpuRecords(records: readonly CpuStepRecord[]): CpuAggregate {
  const sectionNames = new Set<string>();
  const counterNames = new Set<string>();
  for (const record of records) {
    for (const name of Object.keys(record.sections)) sectionNames.add(name);
    for (const name of Object.keys(record.counters)) counterNames.add(name);
  }

  const sections: CpuSectionAggregate[] = [];
  for (const section of [...sectionNames].sort()) {
    const samples = records.map((record) => record.sections[section] ?? 0);
    const stats = summarizeSamples(samples);
    sections.push({
      section,
      stepsPresent: records.filter((record) => section in record.sections).length,
      perStepMs: stats,
      totalMs: stats.sum,
    });
  }

  const counters: CpuCounterAggregate[] = [];
  for (const counter of [...counterNames].sort()) {
    const samples = records.map((record) => record.counters[counter] ?? 0);
    const stats = summarizeSamples(samples);
    counters.push({
      counter,
      total: stats.sum,
      stepsPresent: samples.filter((value) => value !== 0).length,
      perStep: stats,
    });
  }

  return { steps: records.length, sections, counters };
}

// ---------------------------------------------------------------------------
// GPU timestamp-query pass profiler
// ---------------------------------------------------------------------------

/** Local WebGPU constants; see the note in MfmWebGPUStepper.ts. */
const USAGE_MAP_READ = 0x0001;
const USAGE_COPY_SRC = 0x0004;
const USAGE_COPY_DST = 0x0008;
const USAGE_QUERY_RESOLVE = 0x0200;
const MAP_MODE_READ = 0x0001;

/** Labels used by MfmWebGPUStepper for its compute passes, in encoding order. */
export const MFM_PASS_LABELS = [
  'gridClear',
  'gridBuild',
  'chargeProcess',
  'chargeFinalize',
  'pressure',
  'communicationSelect',
  'communicationTransmit',
  'localSuccess',
  'healthUpdate',
  'force',
  'mechanics',
  'deathCompaction',
  'reproductionCompaction',
] as const;

export type MfmPassLabel = (typeof MFM_PASS_LABELS)[number];

/** Coarser groups used by the Phase 14 report. */
export const MFM_PASS_GROUPS: Record<string, readonly string[]> = {
  grid: ['gridClear', 'gridBuild'],
  charge: ['chargeProcess', 'chargeFinalize'],
  pressure: ['pressure'],
  communication: ['communicationSelect', 'communicationTransmit'],
  localSuccessAndHealth: ['localSuccess', 'healthUpdate'],
  force: ['force'],
  mechanics: ['mechanics'],
  compaction: ['deathCompaction', 'reproductionCompaction'],
};

export interface GpuPassTiming {
  label: string;
  /** Index of this pass among passes with the same label within the step (the rank for communication passes). */
  ordinal: number;
  /** GPU-side duration in nanoseconds between the pass' begin and end timestamps. */
  ns: number;
}

export interface GpuStepTiming {
  passes: GpuPassTiming[];
  /** Sum of the individual pass durations. */
  sumNs: number;
  /** Last pass end minus first pass begin: includes any GPU idle gaps between passes. */
  spanNs: number;
}

export interface TimestampWritesDescriptor {
  querySet: GPUQuerySet;
  beginningOfPassWriteIndex: number;
  endOfPassWriteIndex: number;
}

export interface GpuProfilerOptions {
  /** Maximum instrumented compute passes per step (2 queries each). Default 128. */
  maxPasses?: number;
  /** Number of readback slots that may be in flight simultaneously. Default 8. */
  ringSize?: number;
}

interface ReadbackSlot {
  readback: GPUBuffer;
  pending: Promise<void> | null;
  passCount: number;
  labels: string[];
}

/**
 * Wraps a timestamp query set for per-pass GPU timing.
 *
 * Contract per instrumented step (all on the same GPUCommandEncoder):
 *   beginStep();
 *   ...beginComputePass(descriptorFor(label))... (once per pass)
 *   endStep(encoder);        // resolves queries and copies them to a mappable slot
 *   queue.submit([...]);
 *   afterSubmit();           // starts the asynchronous mapAsync for that slot
 *   await collect();         // (outside the timed region) drains pending readbacks
 *
 * The profiler never blocks the CPU on the GPU by itself: mapAsync is issued
 * once per step after the submission and only awaited by collect().
 *
 * Timestamp resolution: browsers may quantize timestamp queries (Chromium
 * rounds to 100 microseconds unless developer features are enabled). Passes
 * shorter than the quantum are reported as 0 or one quantum. The aggregate
 * exposes `zeroDurationFraction` and `minNonZeroNs` so that the quantization
 * can be detected from the data instead of being assumed.
 */
export class GpuPassTimestampProfiler {
  public static isSupported(device: { features?: { has(name: string): boolean } }): boolean {
    return !!device.features && device.features.has('timestamp-query');
  }

  private readonly device: GPUDevice;
  private readonly maxPasses: number;
  private readonly querySet: GPUQuerySet;
  private readonly resolveBuffer: GPUBuffer;
  private readonly slots: ReadbackSlot[] = [];
  private slotCursor = -1;
  private activeSlot: ReadbackSlot | null = null;
  private passCount = 0;
  private labels: string[] = [];
  private steps: GpuStepTiming[] = [];

  public droppedSteps = 0;
  public overflowPasses = 0;
  public readbackErrors = 0;
  public anomalousPasses = 0;

  constructor(device: GPUDevice, options: GpuProfilerOptions = {}) {
    if (!GpuPassTimestampProfiler.isSupported(device)) {
      throw new Error("GpuPassTimestampProfiler requires the 'timestamp-query' device feature");
    }
    this.device = device;
    this.maxPasses = Math.max(1, options.maxPasses ?? 128);
    const ringSize = Math.max(1, options.ringSize ?? 8);
    const queryCount = this.maxPasses * 2;
    const bytes = queryCount * 8;

    this.querySet = device.createQuerySet({ type: 'timestamp', count: queryCount, label: 'cepc-pass-timestamps' });
    this.resolveBuffer = device.createBuffer({
      label: 'cepc-pass-timestamp-resolve',
      size: bytes,
      usage: USAGE_QUERY_RESOLVE | USAGE_COPY_SRC,
    });
    for (let i = 0; i < ringSize; i++) {
      this.slots.push({
        readback: device.createBuffer({
          label: `cepc-pass-timestamp-readback-${i}`,
          size: bytes,
          usage: USAGE_MAP_READ | USAGE_COPY_DST,
        }),
        pending: null,
        passCount: 0,
        labels: [],
      });
    }
  }

  /** True when a step is currently being recorded (a free readback slot was found). */
  public get recording(): boolean {
    return this.activeSlot !== null;
  }

  public beginStep(): void {
    this.passCount = 0;
    this.labels = [];
    this.activeSlot = null;
    for (let k = 1; k <= this.slots.length; k++) {
      const index = (this.slotCursor + k) % this.slots.length;
      if (this.slots[index].pending === null) {
        this.slotCursor = index;
        this.activeSlot = this.slots[index];
        return;
      }
    }
    // Every slot still has an unresolved readback: skip timing for this step
    // rather than blocking. The caller should await collect() between steps.
    this.droppedSteps++;
  }

  /** Returns `timestampWrites` for the next compute pass, or undefined when not recording. */
  public timestampWritesFor(label: string): TimestampWritesDescriptor | undefined {
    if (!this.activeSlot) return undefined;
    if (this.passCount >= this.maxPasses) {
      this.overflowPasses++;
      return undefined;
    }
    const index = this.passCount++;
    this.labels.push(label);
    return {
      querySet: this.querySet,
      beginningOfPassWriteIndex: index * 2,
      endOfPassWriteIndex: index * 2 + 1,
    };
  }

  /** Resolves the recorded queries into the active readback slot (same encoder as the passes). */
  public endStep(encoder: GPUCommandEncoder): void {
    const slot = this.activeSlot;
    if (!slot || this.passCount === 0) return;
    const queryCount = this.passCount * 2;
    encoder.resolveQuerySet(this.querySet, 0, queryCount, this.resolveBuffer, 0);
    encoder.copyBufferToBuffer(this.resolveBuffer, 0, slot.readback, 0, queryCount * 8);
    slot.passCount = this.passCount;
    slot.labels = this.labels;
  }

  /** Must be called after the queue.submit() that contains the encoder passed to endStep(). */
  public afterSubmit(): void {
    const slot = this.activeSlot;
    this.activeSlot = null;
    if (!slot || slot.passCount === 0 || slot.pending !== null) return;
    const passCount = slot.passCount;
    const labels = slot.labels;
    slot.passCount = 0;
    slot.pending = slot.readback.mapAsync(MAP_MODE_READ).then(
      () => {
        try {
          const mapped = slot.readback.getMappedRange(0, passCount * 16);
          this.steps.push(this.decode(new BigUint64Array(mapped.slice(0)), passCount, labels));
        } catch {
          this.readbackErrors++;
        } finally {
          try {
            slot.readback.unmap();
          } catch {
            this.readbackErrors++;
          }
          slot.pending = null;
        }
      },
      () => {
        this.readbackErrors++;
        slot.pending = null;
      },
    );
  }

  /** Awaits every outstanding readback. Call outside timed regions. */
  public async collect(): Promise<void> {
    const pending: Promise<void>[] = [];
    for (const slot of this.slots) {
      if (slot.pending) pending.push(slot.pending);
    }
    if (pending.length > 0) await Promise.all(pending);
  }

  public getSteps(): readonly GpuStepTiming[] {
    return this.steps;
  }

  /** Clears collected steps and counters. Await collect() first. */
  public reset(): void {
    this.steps = [];
    this.droppedSteps = 0;
    this.overflowPasses = 0;
    this.readbackErrors = 0;
    this.anomalousPasses = 0;
  }

  public destroy(): void {
    this.querySet.destroy();
    this.resolveBuffer.destroy();
    for (const slot of this.slots) slot.readback.destroy();
  }

  private decode(values: BigUint64Array, passCount: number, labels: readonly string[]): GpuStepTiming {
    const ordinals = new Map<string, number>();
    const passes: GpuPassTiming[] = [];
    let sumNs = 0;
    let firstBegin = 0n;
    let lastEnd = 0n;
    for (let i = 0; i < passCount; i++) {
      const begin = values[i * 2];
      const end = values[i * 2 + 1];
      if (i === 0 || begin < firstBegin) firstBegin = begin;
      if (i === 0 || end > lastEnd) lastEnd = end;
      let ns = 0;
      if (end >= begin) {
        ns = Number(end - begin);
      } else {
        this.anomalousPasses++;
      }
      const label = labels[i] ?? 'unknown';
      const ordinal = ordinals.get(label) ?? 0;
      ordinals.set(label, ordinal + 1);
      passes.push({ label, ordinal, ns });
      sumNs += ns;
    }
    const spanNs = lastEnd >= firstBegin ? Number(lastEnd - firstBegin) : 0;
    return { passes, sumNs, spanNs };
  }
}

// ---------------------------------------------------------------------------
// GPU aggregation
// ---------------------------------------------------------------------------

export interface GpuLabelAggregate {
  label: string;
  /** Mean number of passes with this label per step (maxK for communication passes). */
  passesPerStep: number;
  /** Per-step total GPU time for this label, in milliseconds. */
  perStepMs: SampleStats;
  /** Fraction of the summed GPU pass time attributed to this label (mean-based). */
  shareOfSum: number;
  /** Mean GPU time per pass ordinal in milliseconds (index = ordinal, e.g. communication rank). */
  meanMsByOrdinal: number[];
}

export interface GpuGroupAggregate {
  group: string;
  perStepMs: SampleStats;
  shareOfSum: number;
}

export interface GpuAggregate {
  steps: number;
  sumMs: SampleStats;
  spanMs: SampleStats;
  /** Mean of (span - sum) in milliseconds: GPU idle/dispatch gaps between instrumented passes. */
  meanGapMs: number;
  labels: GpuLabelAggregate[];
  groups: GpuGroupAggregate[];
  /** Fraction of pass measurements that reported exactly 0 ns (quantization indicator). */
  zeroDurationFraction: number;
  /** Smallest non-zero pass duration observed, in ns (Infinity-safe: 0 when none). */
  minNonZeroNs: number;
}

const NS_PER_MS = 1e6;

export function aggregateGpuSteps(steps: readonly GpuStepTiming[]): GpuAggregate {
  const labelSet = new Set<string>();
  let totalPasses = 0;
  let zeroPasses = 0;
  let minNonZero = Infinity;
  for (const step of steps) {
    for (const pass of step.passes) {
      labelSet.add(pass.label);
      totalPasses++;
      if (pass.ns === 0) zeroPasses++;
      else if (pass.ns < minNonZero) minNonZero = pass.ns;
    }
  }

  const sumMsSamples = steps.map((step) => step.sumNs / NS_PER_MS);
  const spanMsSamples = steps.map((step) => step.spanNs / NS_PER_MS);
  const sumStats = summarizeSamples(sumMsSamples);
  const spanStats = summarizeSamples(spanMsSamples);

  const labelOrder = [
    ...MFM_PASS_LABELS.filter((label) => labelSet.has(label)),
    ...[...labelSet].filter((label) => !(MFM_PASS_LABELS as readonly string[]).includes(label)).sort(),
  ];

  const labels: GpuLabelAggregate[] = [];
  const perLabelStepMs = new Map<string, number[]>();
  for (const label of labelOrder) {
    const perStep: number[] = [];
    const passCounts: number[] = [];
    const ordinalSums: number[] = [];
    const ordinalCounts: number[] = [];
    for (const step of steps) {
      let stepNs = 0;
      let count = 0;
      for (const pass of step.passes) {
        if (pass.label !== label) continue;
        stepNs += pass.ns;
        count++;
        ordinalSums[pass.ordinal] = (ordinalSums[pass.ordinal] ?? 0) + pass.ns;
        ordinalCounts[pass.ordinal] = (ordinalCounts[pass.ordinal] ?? 0) + 1;
      }
      perStep.push(stepNs / NS_PER_MS);
      passCounts.push(count);
    }
    perLabelStepMs.set(label, perStep);
    const stats = summarizeSamples(perStep);
    labels.push({
      label,
      passesPerStep: summarizeSamples(passCounts).mean,
      perStepMs: stats,
      shareOfSum: sumStats.mean > 0 ? stats.mean / sumStats.mean : 0,
      meanMsByOrdinal: ordinalSums.map((sum, ordinal) => sum / (ordinalCounts[ordinal] || 1) / NS_PER_MS),
    });
  }

  const groups: GpuGroupAggregate[] = [];
  for (const [group, members] of Object.entries(MFM_PASS_GROUPS)) {
    if (!members.some((member) => perLabelStepMs.has(member))) continue;
    const perStep = steps.map((_, index) => {
      let total = 0;
      for (const member of members) total += perLabelStepMs.get(member)?.[index] ?? 0;
      return total;
    });
    const stats = summarizeSamples(perStep);
    groups.push({
      group,
      perStepMs: stats,
      shareOfSum: sumStats.mean > 0 ? stats.mean / sumStats.mean : 0,
    });
  }

  return {
    steps: steps.length,
    sumMs: sumStats,
    spanMs: spanStats,
    meanGapMs: spanStats.mean - sumStats.mean,
    labels,
    groups,
    zeroDurationFraction: totalPasses > 0 ? zeroPasses / totalPasses : 0,
    minNonZeroNs: Number.isFinite(minNonZero) ? minNonZero : 0,
  };
}
