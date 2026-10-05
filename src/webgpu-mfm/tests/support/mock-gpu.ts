/**
 * Phase 15 — test-only software model of the WebGPU API surface used by
 * `MfmWebGPUStepper`.
 *
 * WHAT THIS IS
 *   A deterministic, in-process `GPUDevice` stand-in. Buffers are real
 *   `ArrayBuffer`s; `queue.writeBuffer`, `clearBuffer` and
 *   `copyBufferToBuffer` really move bytes; compute dispatches are forwarded
 *   to an injected kernel emulator (see kernel-emulator.ts). Every
 *   synchronization-relevant call is counted at the *device* level
 *   (independent of the stepper's own profiler counters).
 *
 * WHAT THIS IS NOT
 *   It does not execute WGSL and it has no timing model. It therefore
 *   validates the CPU-side orchestration (which buffers are copied, mapped,
 *   uploaded, in what order, how many round trips) — NOT shader correctness
 *   and NOT performance. Counts obtained here are structural evidence only.
 *
 * VALIDATION IT ENFORCES (a subset of the WebGPU spec, chosen because a
 * violation is a real bug that would surface as a validation error on a GPU)
 *   - copyBufferToBuffer / clearBuffer / writeBuffer: 4-byte alignment, bounds,
 *     src !== dst, COPY_SRC / COPY_DST usage bits.
 *   - mapAsync: MAP_READ usage, buffer must be unmapped (no double map),
 *     offset % 8 === 0, size % 4 === 0.
 *   - getMappedRange: buffer must be mapped; the returned ArrayBuffer is
 *     DETACHED on unmap() (use-after-unmap yields zero-length views).
 *   - submit(): a buffer that is mapped/pending map may not be used by a
 *     command in the submitted command buffer.
 *   - destroyed buffers may not be used.
 *   - dynamic uniform offsets: multiple of 256 and inside the buffer.
 */

export const USAGE = {
  MAP_READ: 0x0001,
  MAP_WRITE: 0x0002,
  COPY_SRC: 0x0004,
  COPY_DST: 0x0008,
  UNIFORM: 0x0040,
  STORAGE: 0x0080,
} as const;

export interface DeviceCounters {
  submits: number;
  /** Phase 16: createCommandEncoder() calls (encoders created, whether or not they were submitted). */
  commandEncoders: number;
  commandBuffers: number;
  computePasses: number;
  dispatches: number;
  mapAsync: number;
  getMappedRange: number;
  unmap: number;
  onSubmittedWorkDone: number;
  /**
   * Serial GPU wait depth: a mapAsync / onSubmittedWorkDone that starts while another wait is
   * still pending overlaps it (e.g. Promise.all over two maps) and does NOT add an epoch. This is
   * the number of times the CPU had to wait, one after another, for the queue.
   */
  waitEpochs: number;
  writeBuffer: number;
  clearBuffer: number;
  copyBufferToBuffer: number;
  buffersCreated: number;
  buffersDestroyed: number;
  bindGroupsCreated: number;
  /** Bytes moved by copyBufferToBuffer into MAP_READ (GPU -> CPU staging) buffers. */
  gpuToCpuCopyBytes: number;
  /** Bytes of mapped range exposed to the CPU through getMappedRange. */
  mappedRangeBytes: number;
  /** Bytes moved by queue.writeBuffer (CPU -> GPU). */
  cpuToGpuWriteBytes: number;
  /** Bytes moved by GPU-only copyBufferToBuffer (neither endpoint is a MAP_READ staging buffer). */
  gpuToGpuCopyBytes: number;
}

export function emptyCounters(): DeviceCounters {
  return {
    submits: 0,
    commandEncoders: 0,
    commandBuffers: 0,
    computePasses: 0,
    dispatches: 0,
    mapAsync: 0,
    getMappedRange: 0,
    unmap: 0,
    onSubmittedWorkDone: 0,
    waitEpochs: 0,
    writeBuffer: 0,
    clearBuffer: 0,
    copyBufferToBuffer: 0,
    buffersCreated: 0,
    buffersDestroyed: 0,
    bindGroupsCreated: 0,
    gpuToCpuCopyBytes: 0,
    mappedRangeBytes: 0,
    cpuToGpuWriteBytes: 0,
    gpuToGpuCopyBytes: 0,
  };
}

export function diffCounters(after: DeviceCounters, before: DeviceCounters): DeviceCounters {
  const out = emptyCounters();
  for (const key of Object.keys(out) as Array<keyof DeviceCounters>) {
    out[key] = after[key] - before[key];
  }
  return out;
}

export class MockBuffer {
  public label: string;
  public size: number;
  public usage: number;
  public data: ArrayBuffer;
  public destroyed = false;
  public mapState: 'unmapped' | 'pending' | 'mapped' = 'unmapped';
  private device: MockDevice;
  private handedOut: ArrayBuffer[] = [];

  constructor(device: MockDevice, descriptor: { size: number; usage: number; label?: string }) {
    this.device = device;
    this.label = descriptor.label ?? '';
    this.size = descriptor.size;
    this.usage = descriptor.usage;
    this.data = new ArrayBuffer(descriptor.size);
  }

  public async mapAsync(mode: number, offset = 0, size?: number): Promise<void> {
    if (this.destroyed) throw new Error(`mapAsync on destroyed buffer "${this.label}"`);
    if ((this.usage & USAGE.MAP_READ) === 0 || mode !== 1) {
      throw new Error(`mapAsync(${mode}) requires a MAP_READ buffer: "${this.label}"`);
    }
    if (this.mapState !== 'unmapped') {
      throw new Error(`OperationError: mapAsync on buffer "${this.label}" that is already ${this.mapState}`);
    }
    const length = size ?? this.size - offset;
    if (offset % 8 !== 0 || length % 4 !== 0 || offset + length > this.size) {
      throw new Error(`mapAsync bad range on "${this.label}": offset=${offset} size=${length}`);
    }
    this.mapState = 'pending';
    this.device.counters.mapAsync++;
    this.device.beginWait();
    try {
      // Submitted work is executed synchronously by the mock, so the map is
      // ready after one microtask turn; the *number* of awaited maps is what the
      // accounting measures, not their latency.
      await Promise.resolve();
    } finally {
      this.device.endWait();
    }
    if (this.destroyed) throw new Error(`buffer "${this.label}" destroyed while map pending`);
    if (this.mapState !== 'pending') return; // unmap() cancelled the pending map
    this.mapState = 'mapped';
  }

  public getMappedRange(offset = 0, size?: number): ArrayBuffer {
    if (this.mapState !== 'mapped') {
      throw new Error(`getMappedRange on "${this.label}" which is ${this.mapState}`);
    }
    const length = size ?? this.size - offset;
    if (offset % 8 !== 0 || length % 4 !== 0 || offset + length > this.size) {
      throw new Error(`getMappedRange bad range on "${this.label}": offset=${offset} size=${length}`);
    }
    this.device.counters.getMappedRange++;
    this.device.counters.mappedRangeBytes += length;
    const view = this.data.slice(offset, offset + length);
    this.handedOut.push(view);
    return view;
  }

  public unmap(): void {
    if (this.mapState === 'unmapped') return;
    if (this.mapState === 'pending') {
      this.mapState = 'unmapped'; // cancels the pending map, as in the spec
      return;
    }
    this.device.counters.unmap++;
    this.mapState = 'unmapped';
    for (const view of this.handedOut) {
      // Detach exactly like a real unmap(): later use of the view is a bug.
      structuredClone(view, { transfer: [view] });
    }
    this.handedOut = [];
  }

  public destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.device.counters.buffersDestroyed++;
    this.mapState = 'unmapped';
  }
}

export interface MockBindGroup {
  layout: unknown;
  entries: Array<{ binding: number; buffer: MockBuffer; offset: number; size: number }>;
}

export interface MockPipeline {
  label: string;
}

type Command =
  | { kind: 'clear'; buffer: MockBuffer; offset: number; size: number }
  | { kind: 'copy'; src: MockBuffer; srcOffset: number; dst: MockBuffer; dstOffset: number; size: number }
  | {
      kind: 'dispatch';
      pipeline: MockPipeline;
      bindGroup: MockBindGroup;
      dynamicOffsets: number[];
      workgroups: [number, number, number];
    };

export interface KernelContext {
  device: MockDevice;
  label: string;
  bindings: Map<number, MockBuffer>;
  /** Byte offset of the params block selected by the dynamic offset of binding 0. */
  paramsOffset: number;
  workgroups: [number, number, number];
}

export type KernelEmulator = (context: KernelContext) => void;

export class MockCommandBuffer {
  public commands: Command[];
  public label: string;
  constructor(label: string, commands: Command[]) {
    this.label = label;
    this.commands = commands;
  }
}

function assertUsable(buffer: MockBuffer, what: string): void {
  if (buffer.destroyed) throw new Error(`${what}: buffer "${buffer.label}" is destroyed`);
}

class MockComputePass {
  private encoder: MockCommandEncoder;
  private pipeline: MockPipeline | null = null;
  private bindGroup: MockBindGroup | null = null;
  private dynamicOffsets: number[] = [];
  private ended = false;

  constructor(encoder: MockCommandEncoder) {
    this.encoder = encoder;
  }

  public setPipeline(pipeline: MockPipeline): void {
    this.pipeline = pipeline;
  }

  public setBindGroup(index: number, bindGroup: MockBindGroup, dynamicOffsets: number[] = []): void {
    if (index !== 0) throw new Error('mock supports bind group index 0 only');
    this.bindGroup = bindGroup;
    this.dynamicOffsets = [...dynamicOffsets];
  }

  public dispatchWorkgroups(x: number, y = 1, z = 1): void {
    if (this.ended) throw new Error('dispatch after pass end');
    if (!this.pipeline || !this.bindGroup) throw new Error('dispatch without pipeline/bind group');
    this.encoder.commands.push({
      kind: 'dispatch',
      pipeline: this.pipeline,
      bindGroup: this.bindGroup,
      dynamicOffsets: [...this.dynamicOffsets],
      workgroups: [x, y, z],
    });
  }

  public end(): void {
    this.ended = true;
  }
}

class MockCommandEncoder {
  public commands: Command[] = [];
  private device: MockDevice;
  private label: string;

  constructor(device: MockDevice, label: string) {
    this.device = device;
    this.label = label;
  }

  public clearBuffer(buffer: MockBuffer, offset = 0, size?: number): void {
    const length = size ?? buffer.size - offset;
    if (offset % 4 !== 0 || length % 4 !== 0 || offset + length > buffer.size) {
      throw new Error(`clearBuffer bad range on "${buffer.label}": offset=${offset} size=${length}`);
    }
    if ((buffer.usage & USAGE.COPY_DST) === 0) throw new Error(`clearBuffer needs COPY_DST: "${buffer.label}"`);
    this.commands.push({ kind: 'clear', buffer, offset, size: length });
  }

  public copyBufferToBuffer(
    src: MockBuffer,
    srcOffset: number,
    dst: MockBuffer,
    dstOffset: number,
    size: number,
  ): void {
    if (src === dst) throw new Error(`copyBufferToBuffer with identical src/dst "${src.label}"`);
    if (srcOffset % 4 !== 0 || dstOffset % 4 !== 0 || size % 4 !== 0) {
      throw new Error(
        `copyBufferToBuffer alignment: ${src.label}[${srcOffset}] -> ${dst.label}[${dstOffset}] size=${size}`,
      );
    }
    if (srcOffset + size > src.size || dstOffset + size > dst.size) {
      throw new Error(
        `copyBufferToBuffer out of bounds: ${src.label}[${srcOffset}+${size}/${src.size}] -> ` +
          `${dst.label}[${dstOffset}+${size}/${dst.size}]`,
      );
    }
    if ((src.usage & USAGE.COPY_SRC) === 0) throw new Error(`copy source lacks COPY_SRC: "${src.label}"`);
    if ((dst.usage & USAGE.COPY_DST) === 0) throw new Error(`copy destination lacks COPY_DST: "${dst.label}"`);
    this.commands.push({ kind: 'copy', src, srcOffset, dst, dstOffset, size });
  }

  public beginComputePass(_descriptor?: unknown): MockComputePass {
    this.device.counters.computePasses++;
    return new MockComputePass(this);
  }

  public finish(): MockCommandBuffer {
    return new MockCommandBuffer(this.label, this.commands);
  }
}

export class MockQueue {
  private device: MockDevice;
  constructor(device: MockDevice) {
    this.device = device;
  }

  public writeBuffer(
    buffer: MockBuffer,
    bufferOffset: number,
    data: ArrayBufferView | ArrayBuffer,
    dataOffset = 0,
    size?: number,
  ): void {
    assertUsable(buffer, 'writeBuffer');
    const source = ArrayBuffer.isView(data)
      ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
      : new Uint8Array(data);
    const bytes = size === undefined ? source.subarray(dataOffset) : source.subarray(dataOffset, dataOffset + size);
    if (bufferOffset % 4 !== 0 || bytes.byteLength % 4 !== 0) {
      throw new Error(`writeBuffer alignment on "${buffer.label}": offset=${bufferOffset} bytes=${bytes.byteLength}`);
    }
    if (bufferOffset + bytes.byteLength > buffer.size) {
      throw new Error(
        `writeBuffer out of bounds on "${buffer.label}": ${bufferOffset}+${bytes.byteLength} > ${buffer.size}`,
      );
    }
    if ((buffer.usage & USAGE.COPY_DST) === 0) throw new Error(`writeBuffer needs COPY_DST: "${buffer.label}"`);
    if (buffer.mapState !== 'unmapped') throw new Error(`writeBuffer on mapped buffer "${buffer.label}"`);
    new Uint8Array(buffer.data, bufferOffset, bytes.byteLength).set(bytes);
    this.device.counters.writeBuffer++;
    this.device.counters.cpuToGpuWriteBytes += bytes.byteLength;
  }

  public submit(commandBuffers: MockCommandBuffer[]): undefined {
    this.device.counters.submits++;
    for (const commandBuffer of commandBuffers) {
      this.device.counters.commandBuffers++;
      for (const command of commandBuffer.commands) this.execute(command, commandBuffer.label);
    }
    return undefined;
  }

  public async onSubmittedWorkDone(): Promise<void> {
    this.device.counters.onSubmittedWorkDone++;
    this.device.beginWait();
    try {
      await Promise.resolve();
    } finally {
      this.device.endWait();
    }
  }

  private execute(command: Command, commandBufferLabel: string): void {
    const counters = this.device.counters;
    switch (command.kind) {
      case 'clear': {
        assertUsable(command.buffer, `clearBuffer in ${commandBufferLabel}`);
        if (command.buffer.mapState !== 'unmapped') {
          throw new Error(`submit: "${command.buffer.label}" is ${command.buffer.mapState} but used by clearBuffer`);
        }
        new Uint8Array(command.buffer.data, command.offset, command.size).fill(0);
        counters.clearBuffer++;
        break;
      }
      case 'copy': {
        assertUsable(command.src, `copy src in ${commandBufferLabel}`);
        assertUsable(command.dst, `copy dst in ${commandBufferLabel}`);
        for (const buffer of [command.src, command.dst]) {
          if (buffer.mapState !== 'unmapped') {
            throw new Error(
              `submit: "${buffer.label}" is ${buffer.mapState} but used by copyBufferToBuffer in "${commandBufferLabel}"`,
            );
          }
        }
        new Uint8Array(command.dst.data, command.dstOffset, command.size).set(
          new Uint8Array(command.src.data, command.srcOffset, command.size),
        );
        counters.copyBufferToBuffer++;
        if ((command.dst.usage & USAGE.MAP_READ) !== 0) counters.gpuToCpuCopyBytes += command.size;
        else counters.gpuToGpuCopyBytes += command.size;
        break;
      }
      case 'dispatch': {
        const bindings = new Map<number, MockBuffer>();
        for (const entry of command.bindGroup.entries) {
          assertUsable(entry.buffer, `bind group in ${commandBufferLabel}`);
          if (entry.buffer.mapState !== 'unmapped') {
            throw new Error(`submit: "${entry.buffer.label}" is ${entry.buffer.mapState} but bound to a compute pass`);
          }
          bindings.set(entry.binding, entry.buffer);
        }
        const dynamic = command.dynamicOffsets[0] ?? 0;
        if (dynamic % 256 !== 0) throw new Error(`dynamic offset ${dynamic} not 256-aligned`);
        const params = bindings.get(0);
        if (params && dynamic + 112 > params.size) {
          throw new Error(`dynamic offset ${dynamic}+112 exceeds params buffer size ${params.size}`);
        }
        counters.dispatches++;
        if (this.device.dispatchTrace) {
          const bound = [...bindings.entries()]
            .sort((a, b) => a[0] - b[0])
            .map(([binding, buffer]) => `${binding}=${this.device.buffers.indexOf(buffer)}:${buffer.label}`)
            .join(',');
          const paramsBytes = params ? new Uint8Array(params.data, dynamic, 112) : new Uint8Array(0);
          this.device.dispatchTrace.push(
            `${command.pipeline.label}|${bound}|${Buffer.from(paramsBytes).toString('hex')}|${command.workgroups.join('x')}`,
          );
        }
        this.device.emulator?.({
          device: this.device,
          label: command.pipeline.label,
          bindings,
          paramsOffset: dynamic,
          workgroups: command.workgroups,
        });
        break;
      }
    }
  }
}

export class MockDevice {
  public counters: DeviceCounters = emptyCounters();
  public readonly queue: MockQueue;
  public readonly features = new Set<string>();
  public readonly limits = { maxStorageBufferBindingSize: 1 << 30, maxBufferSize: 1 << 30 };
  public emulator: KernelEmulator | null = null;
  /**
   * Phase 16: when non-null, every executed dispatch appends one normalized record: pipeline label, the
   * (creation-order index, label) of the buffer bound at each binding, the 112 B of the params block that the
   * dynamic offset of binding 0 actually selects, and the workgroup counts. The dynamic OFFSET itself is
   * deliberately not recorded (Phase 16 renumbered the blocks); the CONTENT it selects is what the kernel sees.
   */
  public dispatchTrace: string[] | null = null;
  public readonly buffers: MockBuffer[] = [];
  private pendingWaits = 0;

  public beginWait(): void {
    if (this.pendingWaits === 0) this.counters.waitEpochs++;
    this.pendingWaits++;
  }

  public endWait(): void {
    this.pendingWaits--;
  }

  constructor() {
    this.queue = new MockQueue(this);
  }

  public createBuffer(descriptor: { size: number; usage: number; label?: string }): MockBuffer {
    const buffer = new MockBuffer(this, descriptor);
    this.counters.buffersCreated++;
    this.buffers.push(buffer);
    return buffer;
  }

  /** Latest live buffer with this label (labels are reused after buffer recreation). */
  public findBuffer(label: string): MockBuffer {
    for (let i = this.buffers.length - 1; i >= 0; i--) {
      const buffer = this.buffers[i];
      if (!buffer.destroyed && buffer.label === label) return buffer;
    }
    throw new Error(`no live buffer labelled "${label}"`);
  }

  public createCommandEncoder(descriptor?: { label?: string }): MockCommandEncoder {
    this.counters.commandEncoders++;
    return new MockCommandEncoder(this, descriptor?.label ?? '');
  }

  public createBindGroupLayout(descriptor: { entries: unknown[]; label?: string }): unknown {
    return { entries: descriptor.entries, label: descriptor.label };
  }

  public createPipelineLayout(descriptor: { bindGroupLayouts: unknown[] }): unknown {
    return descriptor;
  }

  public createShaderModule(descriptor: { code: string; label?: string }): unknown {
    return descriptor;
  }

  public createComputePipeline(descriptor: { label?: string }): MockPipeline {
    return { label: descriptor.label ?? '' };
  }

  public createBindGroup(descriptor: {
    layout: unknown;
    entries: Array<{ binding: number; resource: { buffer: MockBuffer; offset?: number; size?: number } }>;
  }): MockBindGroup {
    this.counters.bindGroupsCreated++;
    return {
      layout: descriptor.layout,
      entries: descriptor.entries.map((entry) => ({
        binding: entry.binding,
        buffer: entry.resource.buffer,
        offset: entry.resource.offset ?? 0,
        size: entry.resource.size ?? entry.resource.buffer.size,
      })),
    };
  }

  public snapshotCounters(): DeviceCounters {
    return { ...this.counters };
  }
}

/** The stepper avoids ambient WebGPU globals; MetricsReducer (webgpu-core) does not. */
export function installWebGpuGlobals(): void {
  const g = globalThis as unknown as Record<string, unknown>;
  g.GPUBufferUsage = { ...USAGE };
  g.GPUShaderStage = { COMPUTE: 0x0004 };
  g.GPUMapMode = { READ: 0x0001, WRITE: 0x0002 };
}
