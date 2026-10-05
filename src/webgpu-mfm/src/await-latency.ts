/**
 * Phase 20 — raw await-latency probe (no CEPC code involved).
 *
 * Phase 19 data showed that every awaited `mapAsync` costs ~2.7-3.5 ms regardless of how much the GPU computes or how many bytes move. This probe
 * measures that floor directly on the real device, and (the question that decides whether pipelining can work) whether the cost is a *latency*
 * that overlaps when several submissions are in flight, or a *serialization* that does not.
 *
 * Measurements (median / p95 / min / max over `iterations`, after `warmup`), all with the staging pattern CEPC uses (copyBufferToBuffer into a
 * MAP_READ buffer, submit, mapAsync, unmap):
 *   - onSubmittedWorkDone     : submit([]) then await queue.onSubmittedWorkDone()
 *   - copyMap                 : 16 B copy -> submit -> await mapAsync            (what a quiet CEPC step pays)
 *   - computeCopyMap(work)    : a one-invocation compute pass doing `work` loop iterations, then the same copy/map
 *   - pipelinedPerStep(d)     : steady-state ms per step when `d` submissions are kept in flight (submit step i, then await the oldest once `d` are
 *                               in flight). d = 1 is the current CEPC behaviour. If perStep(2) ~ perStep(1)/2 the latency overlaps (pipelining helps);
 *                               if perStep(2) ~ perStep(1) it does not.
 */
export interface LatencyStats {
  n: number;
  minMs: number;
  medianMs: number;
  meanMs: number;
  p95Ms: number;
  maxMs: number;
}

export interface AwaitLatencyResult {
  schemaVersion: 1;
  iterations: number;
  warmup: number;
  adapter: { vendor: string | null; architecture: string | null; description: string | null } | null;
  onSubmittedWorkDone: LatencyStats;
  copyMap: LatencyStats;
  computeCopyMap: Array<{ work: number; stats: LatencyStats }>;
  pipelinedPerStep: Array<{ work: number; depth: number; perStepMs: number }>;
}

const BUFFER_MAP_READ = 0x0001;
const BUFFER_COPY_SRC = 0x0004;
const BUFFER_COPY_DST = 0x0008;
const BUFFER_STORAGE = 0x0080;
const STAGE_COMPUTE = 0x4;
const MAP_READ = 0x1;

function stats(samples: number[]): LatencyStats {
  const sorted = [...samples].sort((a, b) => a - b);
  const at = (q: number): number => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
  const mean = sorted.reduce((sum, v) => sum + v, 0) / Math.max(1, sorted.length);
  return { n: sorted.length, minMs: sorted[0] ?? 0, medianMs: at(0.5), meanMs: mean, p95Ms: at(0.95), maxMs: sorted[sorted.length - 1] ?? 0 };
}

const SHADER = /* wgsl */ `
struct Cfg { work: u32 };
@group(0) @binding(0) var<uniform> cfg: Cfg;
@group(0) @binding(1) var<storage, read_write> out: array<u32>;
@compute @workgroup_size(1)
fn main() {
  var acc = 1u;
  for (var i = 0u; i < cfg.work; i++) { acc = acc * 1664525u + 1013904223u; }
  out[0] = acc;
}
`;

export async function runAwaitLatencyProbe(options: { iterations?: number; warmup?: number } = {}): Promise<AwaitLatencyResult> {
  const iterations = options.iterations ?? 200;
  const warmup = options.warmup ?? 20;
  const gpu = (globalThis as unknown as { navigator?: { gpu?: GPU } }).navigator?.gpu;
  if (!gpu) throw new Error('WebGPU is not available in this context');
  const adapter = await gpu.requestAdapter();
  if (!adapter) throw new Error('no WebGPU adapter');
  const device = await adapter.requestDevice();
  let adapterInfo: AwaitLatencyResult['adapter'] = null;
  try {
    const info = (adapter as unknown as { info?: Record<string, string | undefined> }).info ?? {};
    adapterInfo = { vendor: info.vendor ?? null, architecture: info.architecture ?? null, description: info.description ?? null };
  } catch {
    adapterInfo = null;
  }

  try {
    const storage = device.createBuffer({ size: 16, usage: BUFFER_STORAGE | BUFFER_COPY_SRC });
    const uniform = device.createBuffer({ size: 16, usage: 0x40 /* UNIFORM */ | BUFFER_COPY_DST });
    const staging = Array.from({ length: 4 }, () => device.createBuffer({ size: 16, usage: BUFFER_MAP_READ | BUFFER_COPY_DST }));
    const layout = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: STAGE_COMPUTE, buffer: { type: 'uniform' } },
        { binding: 1, visibility: STAGE_COMPUTE, buffer: { type: 'storage' } },
      ],
    });
    const pipeline = device.createComputePipeline({
      layout: device.createPipelineLayout({ bindGroupLayouts: [layout] }),
      compute: { module: device.createShaderModule({ code: SHADER }), entryPoint: 'main' },
    });
    const bindGroup = device.createBindGroup({
      layout,
      entries: [
        { binding: 0, resource: { buffer: uniform } },
        { binding: 1, resource: { buffer: storage } },
      ],
    });
    const setWork = (work: number): void => device.queue.writeBuffer(uniform, 0, new Uint32Array([work, 0, 0, 0]));

    const submitStep = (slot: number, work: number | null): Promise<void> => {
      const encoder = device.createCommandEncoder();
      if (work !== null) {
        const pass = encoder.beginComputePass();
        pass.setPipeline(pipeline);
        pass.setBindGroup(0, bindGroup);
        pass.dispatchWorkgroups(1);
        pass.end();
      }
      encoder.copyBufferToBuffer(storage, 0, staging[slot], 0, 16);
      device.queue.submit([encoder.finish()]);
      return staging[slot].mapAsync(MAP_READ).then(() => {
        staging[slot].getMappedRange();
        staging[slot].unmap();
      });
    };

    const time = async (fn: () => Promise<void>): Promise<number> => {
      const t = performance.now();
      await fn();
      return performance.now() - t;
    };
    const collect = async (fn: () => Promise<void>): Promise<LatencyStats> => {
      for (let i = 0; i < warmup; i++) await fn();
      const samples: number[] = [];
      for (let i = 0; i < iterations; i++) samples.push(await time(fn));
      return stats(samples);
    };

    const onSubmittedWorkDone = await collect(async () => {
      device.queue.submit([]);
      await device.queue.onSubmittedWorkDone();
    });
    const copyMap = await collect(() => submitStep(0, null));

    const workLevels = [0, 20000, 200000];
    const computeCopyMap: AwaitLatencyResult['computeCopyMap'] = [];
    const pipelinedPerStep: AwaitLatencyResult['pipelinedPerStep'] = [];
    for (const work of workLevels) {
      setWork(work);
      computeCopyMap.push({ work, stats: await collect(() => submitStep(0, work)) });
      for (const depth of [1, 2, 3, 4]) {
        // Keep `depth` submissions in flight: submit step i, then await the oldest once `depth` are pending.
        const run = async (count: number): Promise<number> => {
          const pending: Promise<void>[] = [];
          const t = performance.now();
          for (let i = 0; i < count; i++) {
            pending.push(submitStep(i % depth, work));
            if (pending.length >= depth) await pending.shift();
          }
          while (pending.length > 0) await pending.shift();
          return (performance.now() - t) / count;
        };
        await run(warmup);
        pipelinedPerStep.push({ work, depth, perStepMs: await run(iterations) });
      }
    }

    return { schemaVersion: 1, iterations, warmup, adapter: adapterInfo, onSubmittedWorkDone, copyMap, computeCopyMap, pipelinedPerStep };
  } finally {
    device.destroy();
  }
}
