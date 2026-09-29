import { describe, it, expect } from 'vitest';
import {
  CpuSectionProfiler,
  GpuPassTimestampProfiler,
  aggregateCpuRecords,
  aggregateGpuSteps,
  summarizeSamples,
} from '../src/profiling';

// ---------------------------------------------------------------------------
// Minimal mock of the parts of the WebGPU API used by GpuPassTimestampProfiler.
// The mock "GPU" executes deferred commands at submit() time in encoding order
// and writes scripted timestamps for every pass that carries timestampWrites.
// ---------------------------------------------------------------------------

class MockQuerySet {
  public values: BigUint64Array;
  constructor(public count: number) {
    this.values = new BigUint64Array(count);
  }
  destroy(): void {
    // no-op: the mock owns no GPU resources
  }
}

class MockBuffer {
  public data: Uint8Array;
  public mapped = false;
  constructor(public size: number) {
    this.data = new Uint8Array(size);
  }
  public async mapAsync(): Promise<void> {
    this.mapped = true;
  }
  public getMappedRange(offset = 0, size = this.size - offset): ArrayBuffer {
    return this.data.buffer.slice(offset, offset + size) as ArrayBuffer;
  }
  public unmap(): void {
    this.mapped = false;
  }
  public destroy(): void {
    // no-op: the mock owns no GPU resources
  }
}

class MockEncoder {
  public commands: Array<() => void> = [];
  constructor(private device: MockDevice) {}

  public beginComputePass(descriptor?: { timestampWrites?: { querySet: MockQuerySet; beginningOfPassWriteIndex: number; endOfPassWriteIndex: number } }, durationNs = 0) {
    const gpu = this.device;
    return {
      end: () => {
        this.commands.push(() => {
          const writes = descriptor?.timestampWrites;
          gpu.clockNs += gpu.gapNs;
          const begin = gpu.clockNs;
          gpu.clockNs += durationNs;
          const end = gpu.clockNs;
          if (writes) {
            writes.querySet.values[writes.beginningOfPassWriteIndex] = BigInt(begin);
            writes.querySet.values[writes.endOfPassWriteIndex] = BigInt(end);
          }
        });
      },
    };
  }

  public resolveQuerySet(querySet: MockQuerySet, first: number, count: number, destination: MockBuffer, offset: number): void {
    this.commands.push(() => {
      const view = new BigUint64Array(destination.data.buffer, offset, count);
      for (let i = 0; i < count; i++) view[i] = querySet.values[first + i];
    });
  }

  public copyBufferToBuffer(source: MockBuffer, sourceOffset: number, destination: MockBuffer, destinationOffset: number, size: number): void {
    this.commands.push(() => {
      destination.data.set(source.data.subarray(sourceOffset, sourceOffset + size), destinationOffset);
    });
  }
}

class MockDevice {
  public clockNs = 1_000_000;
  public gapNs = 0;
  public features: { has(name: string): boolean };
  constructor(withTimestamps = true) {
    this.features = { has: (name: string) => withTimestamps && name === 'timestamp-query' };
  }
  public createQuerySet(descriptor: { count: number }): MockQuerySet {
    return new MockQuerySet(descriptor.count);
  }
  public createBuffer(descriptor: { size: number }): MockBuffer {
    return new MockBuffer(descriptor.size);
  }
  public createCommandEncoder(): MockEncoder {
    return new MockEncoder(this);
  }
  public submit(encoder: MockEncoder): void {
    for (const command of encoder.commands) command();
  }
}

type PassSpec = { label: string; ns: number };

function runStep(device: MockDevice, profiler: GpuPassTimestampProfiler, passes: PassSpec[]): void {
  const encoder = device.createCommandEncoder();
  profiler.beginStep();
  for (const spec of passes) {
    const timestampWrites = profiler.timestampWritesFor(spec.label);
    const pass = encoder.beginComputePass(timestampWrites ? { timestampWrites: timestampWrites as never } : undefined, spec.ns);
    pass.end();
  }
  profiler.endStep(encoder as never);
  device.submit(encoder);
  profiler.afterSubmit();
}

const STEP: PassSpec[] = [
  { label: 'gridClear', ns: 100_000 },
  { label: 'communicationSelect', ns: 300_000 },
  { label: 'communicationSelect', ns: 500_000 },
  { label: 'communicationTransmit', ns: 200_000 },
  { label: 'communicationTransmit', ns: 200_000 },
  { label: 'force', ns: 1_000_000 },
];

describe('summarizeSamples', () => {
  it('computes mean, median and interpolated percentiles', () => {
    const stats = summarizeSamples([1, 2, 3, 4, 5]);
    expect(stats.count).toBe(5);
    expect(stats.mean).toBe(3);
    expect(stats.median).toBe(3);
    expect(stats.p95).toBeCloseTo(4.8, 10);
    expect(stats.p99).toBeCloseTo(4.96, 10);
    expect(stats.min).toBe(1);
    expect(stats.max).toBe(5);
  });

  it('handles empty and non-finite input', () => {
    expect(summarizeSamples([]).count).toBe(0);
    expect(summarizeSamples([NaN, Infinity]).count).toBe(0);
    expect(summarizeSamples([7]).p99).toBe(7);
  });
});

describe('CpuSectionProfiler', () => {
  it('accumulates sections and counters per step and aggregates them', () => {
    const profiler = new CpuSectionProfiler();
    profiler.add('encode', 1);
    profiler.add('encode', 2);
    profiler.inc('readback.roundTrips', 3);
    profiler.commitStep();
    profiler.add('encode', 5);
    profiler.commitStep();

    const records = profiler.getRecords();
    expect(records.length).toBe(2);
    expect(records[0].sections.encode).toBe(3);
    expect(records[0].counters['readback.roundTrips']).toBe(3);

    const aggregate = aggregateCpuRecords(records);
    const encode = aggregate.sections.find((section) => section.section === 'encode');
    expect(encode?.totalMs).toBe(8);
    expect(encode?.perStepMs.mean).toBe(4);
    const trips = aggregate.counters.find((counter) => counter.counter === 'readback.roundTrips');
    expect(trips?.total).toBe(3);
    expect(trips?.stepsPresent).toBe(1);
  });
});

describe('GpuPassTimestampProfiler', () => {
  it('reports feature support and refuses to construct without it', () => {
    expect(GpuPassTimestampProfiler.isSupported(new MockDevice(true) as never)).toBe(true);
    expect(GpuPassTimestampProfiler.isSupported(new MockDevice(false) as never)).toBe(false);
    expect(() => new GpuPassTimestampProfiler(new MockDevice(false) as never)).toThrow();
  });

  it('decodes per-pass durations, ordinals, sums and spans', async () => {
    const device = new MockDevice();
    device.gapNs = 10_000;
    const profiler = new GpuPassTimestampProfiler(device as never);

    runStep(device, profiler, STEP);
    await profiler.collect();

    const steps = profiler.getSteps();
    expect(steps.length).toBe(1);
    const step = steps[0];
    expect(step.passes.length).toBe(6);
    expect(step.passes[1]).toEqual({ label: 'communicationSelect', ordinal: 0, ns: 300_000 });
    expect(step.passes[2]).toEqual({ label: 'communicationSelect', ordinal: 1, ns: 500_000 });
    expect(step.sumNs).toBe(2_300_000);
    // Five inter-pass gaps are inside the span; the first gap precedes the first begin timestamp.
    expect(step.spanNs).toBe(2_300_000 + 5 * 10_000);
  });

  it('aggregates by label, rank and group', async () => {
    const device = new MockDevice();
    const profiler = new GpuPassTimestampProfiler(device as never);
    for (let i = 0; i < 3; i++) {
      runStep(device, profiler, STEP);
      await profiler.collect();
    }
    const aggregate = aggregateGpuSteps(profiler.getSteps());
    expect(aggregate.steps).toBe(3);
    expect(aggregate.sumMs.mean).toBeCloseTo(2.3, 9);

    const select = aggregate.labels.find((label) => label.label === 'communicationSelect');
    expect(select?.passesPerStep).toBe(2);
    expect(select?.perStepMs.mean).toBeCloseTo(0.8, 9);
    expect(select?.meanMsByOrdinal[0]).toBeCloseTo(0.3, 9);
    expect(select?.meanMsByOrdinal[1]).toBeCloseTo(0.5, 9);
    expect(select?.shareOfSum).toBeCloseTo(0.8 / 2.3, 9);

    const communication = aggregate.groups.find((group) => group.group === 'communication');
    expect(communication?.perStepMs.mean).toBeCloseTo(1.2, 9);
    expect(aggregate.zeroDurationFraction).toBe(0);
    expect(aggregate.minNonZeroNs).toBe(100_000);
  });

  it('drops (rather than blocks on) steps when every readback slot is busy', async () => {
    const device = new MockDevice();
    const profiler = new GpuPassTimestampProfiler(device as never, { ringSize: 2 });
    runStep(device, profiler, STEP);
    runStep(device, profiler, STEP);
    runStep(device, profiler, STEP); // no await between steps: both slots still pending
    expect(profiler.droppedSteps).toBe(1);
    await profiler.collect();
    expect(profiler.getSteps().length).toBe(2);
    runStep(device, profiler, STEP);
    await profiler.collect();
    expect(profiler.getSteps().length).toBe(3);
  });

  it('flags quantized timestamps through the zero-duration fraction', async () => {
    const device = new MockDevice();
    const profiler = new GpuPassTimestampProfiler(device as never);
    runStep(device, profiler, [
      { label: 'pressure', ns: 0 },
      { label: 'mechanics', ns: 100_000 },
    ]);
    await profiler.collect();
    const aggregate = aggregateGpuSteps(profiler.getSteps());
    expect(aggregate.zeroDurationFraction).toBe(0.5);
    expect(aggregate.minNonZeroNs).toBe(100_000);
  });

  it('counts overflow passes instead of writing past the query set', async () => {
    const device = new MockDevice();
    const profiler = new GpuPassTimestampProfiler(device as never, { maxPasses: 2 });
    runStep(device, profiler, STEP);
    await profiler.collect();
    expect(profiler.overflowPasses).toBe(4);
    expect(profiler.getSteps()[0].passes.length).toBe(2);
  });
});
