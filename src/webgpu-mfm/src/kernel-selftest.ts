/**
 * Phase 17 — on-device exact-output check for the death-compaction kernel variants.
 *
 * Compiles the SHIPPED WGSL of both variants (SHADER_DEATH_COMPACTION = serial, SHADER_DEATH_COMPACTION_PARALLEL) on the real
 * adapter, runs each on identical synthetic inputs, and requires:
 *   1. deathCount and deathSlots[0..count) equal an independent JS reference;
 *   2. the ENTIRE deathSlots buffer (including untouched tail slots, pre-filled with a sentinel) is identical between variants.
 * Inputs cover tile-boundary sizes (0, 1, 127, 128, 129, ...), no/few/half/all deaths, non-INTERNAL roles with health <= 0,
 * NaN and -0 health. It does not measure time and does not exercise the full simulation.
 */
import {
  SHADER_DEATH_COMPACTION,
  SHADER_DEATH_COMPACTION_PARALLEL,
  SHADER_DEATH_COMPACTION_BLOCKED,
  SHADER_HALT_UPDATE,
  MFM_ROLE_INTERNAL,
  SHADER_GRID_CLEAR,
  SHADER_GRID_BUILD,
  SHADER_SORT_COUNT,
  SHADER_SORT_SCAN,
  SHADER_SORT_SCATTER,
  shaderForce,
  shaderForceSorted,
} from './MfmWebGPUStepper';

const USAGE_MAP_READ = 0x0001;
const USAGE_COPY_SRC = 0x0004;
const USAGE_COPY_DST = 0x0008;
const USAGE_UNIFORM = 0x0040;
const USAGE_STORAGE = 0x0080;
const STAGE_COMPUTE = 0x4;
const MAP_READ = 0x1;
const SENTINEL = 0xffffffff;
const COUNT_SENTINEL = 0xdeadbeef;
/** Params uniform: 28 four-byte fields = 112 bytes; activeCount is the first u32 (see `struct Params` in the stepper). */
const PARAMS_BYTES = 112;

export interface KernelSelfTestCase {
  particles: number;
  deathFraction: number;
  deaths: number;
  serialMatchesReference: boolean;
  parallelMatchesReference: boolean;
  variantsIdentical: boolean;
  /** Phase 19 (additive): the 'blocked' kernel reproduces the reference exactly (count and ascending slots). */
  blockedMatchesReference?: boolean;
}

/** Phase 18: one population compared across the three grid-force kernels on the real device. */
export interface ForceSelfTestCase {
  particles: number;
  cellsX: number;
  cellsY: number;
  chargeMax: number;
  /** cellStart/sortedIndex satisfy the counting-sort invariants (permutation, consistent per-cell ranges, total = N). */
  sortLayoutValid: boolean;
  /**
   * Largest |force_variant - force_linked_list| over all particles/components, in multiples of the per-element tolerance
   * (1e-4 + 1e-4*|force_linked_list|). The test requires <= 1.
   */
  maxToleranceMultipleSorted: number;
  maxToleranceMultipleSortedCulled: number;
  /** Largest |force| of the linked-list kernel, to show the comparison is not vacuous. */
  maxAbsForce: number;
  nonZeroForces: number;
}

/** Phase 20: one halt-guard / halt-update expectation checked on the real device. */
export interface PipelineSelfTestCase {
  name: string;
  passed: boolean;
  detail: string;
}

export interface KernelSelfTestResult {
  schemaVersion: 1;
  kind: 'kernel-selftest';
  adapter: { vendor: string; architecture: string; device: string; description: string } | null;
  passed: boolean;
  cases: KernelSelfTestCase[];
  /** Phase 18 (additive): sorted / sorted-culled force kernels vs the linked-list kernel. Empty when not run. */
  forceCases?: ForceSelfTestCase[];
  /** Phase 20 (additive): the halt guard turns a kernel into a no-op; halt-update sets (and never clears) the flag. Empty when not run. */
  pipelineCases?: PipelineSelfTestCase[];
  failures: string[];
}

function xorshift(seed: number): () => number {
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

function buildInputs(n: number, deathFraction: number, seed: number): { role: Uint32Array; health: Float32Array } {
  const rand = xorshift(seed);
  const cap = Math.max(n, 1);
  const role = new Uint32Array(cap);
  const health = new Float32Array(cap);
  for (let i = 0; i < cap; i++) {
    const r = rand();
    role[i] = r < 0.7 ? MFM_ROLE_INTERNAL : r < 0.8 ? 1 : 2;
    const h = rand();
    if (h < deathFraction) health[i] = rand() < 0.3 ? 0 : -rand() * 5;
    else health[i] = 0.001 + rand() * 10;
    const special = rand();
    if (special < 0.02) health[i] = NaN; // NaN <= 0 is false: must not die
    else if (special < 0.04) health[i] = -0; // -0 <= 0 is true
  }
  return { role, health };
}

function referenceDeaths(n: number, role: Uint32Array, health: Float32Array): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) if (role[i] === MFM_ROLE_INTERNAL && health[i] <= 0) out.push(i);
  return out;
}

export async function runKernelSelfTest(): Promise<KernelSelfTestResult> {
  const gpu = (globalThis as unknown as { navigator?: { gpu?: GPU } }).navigator?.gpu;
  if (!gpu) throw new Error('WebGPU is not available in this context');
  const adapter = await gpu.requestAdapter();
  if (!adapter) throw new Error('No WebGPU adapter');
  const device = await adapter.requestDevice();
  const info = adapter.info;
  const result: KernelSelfTestResult = {
    schemaVersion: 1,
    kind: 'kernel-selftest',
    adapter: info
      ? { vendor: info.vendor, architecture: info.architecture, device: info.device, description: info.description }
      : null,
    passed: false,
    cases: [],
    failures: [],
  };

  try {
    const bindGroupLayout = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: STAGE_COMPUTE, buffer: { type: 'uniform' } },
        { binding: 1, visibility: STAGE_COMPUTE, buffer: { type: 'read-only-storage' } },
        { binding: 2, visibility: STAGE_COMPUTE, buffer: { type: 'read-only-storage' } },
        { binding: 3, visibility: STAGE_COMPUTE, buffer: { type: 'storage' } },
        { binding: 4, visibility: STAGE_COMPUTE, buffer: { type: 'storage' } },
      ],
    });
    const pipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] });

    const makePipeline = async (label: string, code: string): Promise<GPUComputePipeline> => {
      device.pushErrorScope('validation');
      const module = device.createShaderModule({ code, label });
      const pipeline = device.createComputePipeline({ label, layout: pipelineLayout, compute: { module, entryPoint: 'main' } });
      const error = await device.popErrorScope();
      if (error) {
        const messages = (await module.getCompilationInfo()).messages.map((m) => `${m.type} L${m.lineNum}: ${m.message}`);
        throw new Error(`${label}: ${error.message}${messages.length ? ' | ' + messages.join(' | ') : ''}`);
      }
      return pipeline;
    };
    const serial = await makePipeline('selftest-death-serial', SHADER_DEATH_COMPACTION);
    const parallel = await makePipeline('selftest-death-parallel', SHADER_DEATH_COMPACTION_PARALLEL);
    const blocked = await makePipeline('selftest-death-blocked', SHADER_DEATH_COMPACTION_BLOCKED);

    const run = async (pipeline: GPUComputePipeline, n: number, role: Uint32Array, health: Float32Array) => {
      const cap = Math.max(n, 1);
      const storage = (data: Uint32Array | Float32Array, usage: number) => {
        const buffer = device.createBuffer({ size: Math.max(16, data.byteLength), usage: usage | USAGE_COPY_DST });
        device.queue.writeBuffer(buffer, 0, data.buffer as ArrayBuffer, data.byteOffset, data.byteLength);
        return buffer;
      };
      const params = new Uint32Array(PARAMS_BYTES / 4);
      params[0] = n;
      const paramsBuffer = storage(params, USAGE_UNIFORM);
      const healthBuffer = storage(health, USAGE_STORAGE);
      const roleBuffer = storage(role, USAGE_STORAGE);
      const countBuffer = storage(new Uint32Array(4).fill(COUNT_SENTINEL), USAGE_STORAGE | USAGE_COPY_SRC);
      const slotsBuffer = storage(new Uint32Array(Math.max(4, cap)).fill(SENTINEL), USAGE_STORAGE | USAGE_COPY_SRC);
      const bindGroup = device.createBindGroup({
        layout: bindGroupLayout,
        entries: [paramsBuffer, healthBuffer, roleBuffer, countBuffer, slotsBuffer].map((buffer, binding) => ({ binding, resource: { buffer } })),
      });
      const readCount = device.createBuffer({ size: 16, usage: USAGE_MAP_READ | USAGE_COPY_DST });
      const readSlots = device.createBuffer({ size: Math.max(16, cap * 4), usage: USAGE_MAP_READ | USAGE_COPY_DST });
      const encoder = device.createCommandEncoder();
      const pass = encoder.beginComputePass();
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bindGroup);
      pass.dispatchWorkgroups(1); // the production dispatch for this stage is exactly one workgroup
      pass.end();
      encoder.copyBufferToBuffer(countBuffer, 0, readCount, 0, 16);
      encoder.copyBufferToBuffer(slotsBuffer, 0, readSlots, 0, Math.max(16, cap * 4));
      device.queue.submit([encoder.finish()]);
      await readCount.mapAsync(MAP_READ);
      await readSlots.mapAsync(MAP_READ);
      const count = new Uint32Array(readCount.getMappedRange().slice(0))[0];
      const slots = new Uint32Array(readSlots.getMappedRange().slice(0)).slice(0, cap);
      readCount.unmap();
      readSlots.unmap();
      for (const b of [paramsBuffer, healthBuffer, roleBuffer, countBuffer, slotsBuffer, readCount, readSlots]) b.destroy();
      return { count, slots };
    };

    // 255..257 and 65537 straddle the 256-invocation chunking of the 'blocked' kernel; 20000..100000 exercise long chunks.
    const sizes = [0, 1, 2, 127, 128, 129, 255, 256, 257, 1000, 2000, 2049, 4096, 10000, 20000, 65537, 100000];
    const fractions = [0, 0.02, 0.5, 1];
    let seed = 12345;
    for (const n of sizes) {
      for (const deathFraction of fractions) {
        seed++;
        const { role, health } = buildInputs(n, deathFraction, seed);
        const expected = referenceDeaths(n, role, health);
        const a = await run(serial, n, role, health);
        const b = await run(parallel, n, role, health);
        const d = await run(blocked, n, role, health);
        const matches = (r: { count: number; slots: Uint32Array }) =>
          r.count === expected.length && expected.every((slot, k) => r.slots[k] === slot);
        const identical = a.count === b.count && a.slots.length === b.slots.length && a.slots.every((v, k) => v === b.slots[k]);
        const c: KernelSelfTestCase = {
          particles: n,
          deathFraction,
          deaths: expected.length,
          serialMatchesReference: matches(a),
          parallelMatchesReference: matches(b),
          variantsIdentical: identical,
          blockedMatchesReference: matches(d),
        };
        result.cases.push(c);
        if (!c.serialMatchesReference || !c.parallelMatchesReference || !c.variantsIdentical || !c.blockedMatchesReference) {
          result.failures.push(
            `N=${n} p=${deathFraction}: expected ${expected.length} deaths; serial=${a.count} parallel=${b.count}; ` +
              `serialOk=${c.serialMatchesReference} parallelOk=${c.parallelMatchesReference} identical=${c.variantsIdentical} blocked=${d.count} blockedOk=${c.blockedMatchesReference}`,
          );
        }
      }
    }
    result.passed = result.failures.length === 0;
  } catch (error) {
    result.failures.push(error instanceof Error ? error.message : String(error));
  } finally {
    device.destroy();
  }

  // Phase 18: the force kernels need more storage buffers per stage than the default device limit (8), so they run on their own device.
  try {
    result.forceCases = await runForceVariantSelfTest(gpu, result.failures);
  } catch (error) {
    result.failures.push(`force-variants: ${error instanceof Error ? error.message : String(error)}`);
  }
  try {
    result.pipelineCases = await runPipelineGuardSelfTest(gpu, result.failures);
  } catch (error) {
    result.failures.push(`pipeline-guard: ${error instanceof Error ? error.message : String(error)}`);
  }
  result.passed = result.failures.length === 0;
  return result;
}

/**
 * Phase 20 — on-device check of the two WGSL pieces pipelined stepping depends on (the stepper-level behaviour is covered on the software device):
 *   1. a kernel run with params.halted != 0 changes NOTHING (outputs keep sentinel values) - death compaction, blocked and serial, stand in for all
 *      kernels, which share the same first statement; with halted == 0 the same kernel produces the reference output;
 *   2. halt-update: sets the flag iff (not halted) and (deaths > 0 or candidates > 0), and never clears it.
 */
async function runPipelineGuardSelfTest(gpu: GPU, failures: string[]): Promise<PipelineSelfTestCase[]> {
  const adapter = await gpu.requestAdapter();
  if (!adapter) {
    failures.push('pipeline-guard: no adapter available');
    return [];
  }
  const device = await adapter.requestDevice();
  const cases: PipelineSelfTestCase[] = [];
  const record = (name: string, passed: boolean, detail: string): void => {
    cases.push({ name, passed, detail });
    if (!passed) failures.push(`pipeline-guard ${name}: ${detail}`);
  };
  try {
    const U: GPUBufferBindingType = 'uniform';
    const R: GPUBufferBindingType = 'read-only-storage';
    const W: GPUBufferBindingType = 'storage';
    const layoutOf = (types: GPUBufferBindingType[]): GPUBindGroupLayout =>
      device.createBindGroupLayout({ entries: types.map((type, binding) => ({ binding, visibility: STAGE_COMPUTE, buffer: { type } })) });
    const makePipeline = async (label: string, code: string, layout: GPUBindGroupLayout): Promise<GPUComputePipeline> => {
      device.pushErrorScope('validation');
      const module = device.createShaderModule({ code, label });
      const pipeline = device.createComputePipeline({ label, layout: device.createPipelineLayout({ bindGroupLayouts: [layout] }), compute: { module, entryPoint: 'main' } });
      const error = await device.popErrorScope();
      if (error) {
        const messages = (await module.getCompilationInfo()).messages.map((m) => `${m.type} L${m.lineNum}: ${m.message}`);
        throw new Error(`${label}: ${error.message}${messages.length ? ' | ' + messages.join(' | ') : ''}`);
      }
      return pipeline;
    };
    const deathLayout = layoutOf([U, R, R, W, W]);
    const haltLayout = layoutOf([U, R, R, W]);
    const pipes = {
      blocked: await makePipeline('selftest-guard-blocked', SHADER_DEATH_COMPACTION_BLOCKED, deathLayout),
      serial: await makePipeline('selftest-guard-serial', SHADER_DEATH_COMPACTION, deathLayout),
      halt: await makePipeline('selftest-halt-update', SHADER_HALT_UPDATE, haltLayout),
    };
    const SENTINEL = 0xdeadbeef;
    const buf = (bytes: number, usage: number, data?: ArrayBufferView): GPUBuffer => {
      const b = device.createBuffer({ size: Math.max(16, (bytes + 3) & ~3), usage: usage | USAGE_COPY_DST | USAGE_COPY_SRC });
      if (data) device.queue.writeBuffer(b, 0, data.buffer as ArrayBuffer, data.byteOffset, data.byteLength);
      return b;
    };
    const paramsBytes = (activeCount: number, halted: number): Uint8Array => {
      const ab = new ArrayBuffer(PARAMS_BYTES);
      const dv = new DataView(ab);
      dv.setUint32(0, activeCount, true);
      dv.setUint32(108, halted, true);
      return new Uint8Array(ab);
    };
    const read = async (buffer: GPUBuffer, words: number): Promise<Uint32Array> => {
      const staging = device.createBuffer({ size: Math.max(16, words * 4), usage: USAGE_MAP_READ | USAGE_COPY_DST });
      const encoder = device.createCommandEncoder();
      encoder.copyBufferToBuffer(buffer, 0, staging, 0, Math.max(16, words * 4));
      device.queue.submit([encoder.finish()]);
      await staging.mapAsync(MAP_READ);
      const out = new Uint32Array(staging.getMappedRange().slice(0));
      staging.unmap();
      staging.destroy();
      return out;
    };
    const dispatch = (pipeline: GPUComputePipeline, layout: GPUBindGroupLayout, buffers: GPUBuffer[]): void => {
      const encoder = device.createCommandEncoder();
      const pass = encoder.beginComputePass();
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, device.createBindGroup({ layout, entries: buffers.map((buffer, binding) => ({ binding, resource: { buffer } })) }));
      pass.dispatchWorkgroups(1);
      pass.end();
      device.queue.submit([encoder.finish()]);
    };

    // 1. halt guard on the death-compaction kernels
    const n = 600;
    const health = new Float32Array(n).fill(5);
    const roles = new Uint32Array(n);
    const dying = [3, 17, 18, 255, 256, 599];
    for (const i of dying) health[i] = 0;
    for (const [name, pipeline] of [['blocked', pipes.blocked], ['serial', pipes.serial]] as const) {
      for (const halted of [1, 0]) {
        const params = buf(PARAMS_BYTES, USAGE_UNIFORM, paramsBytes(n, halted));
        const count = buf(4, USAGE_STORAGE, new Uint32Array([SENTINEL]));
        const slots = buf(n * 4, USAGE_STORAGE, new Uint32Array(n).fill(SENTINEL));
        dispatch(pipeline, deathLayout, [params, buf(health.byteLength, USAGE_STORAGE, health), buf(roles.byteLength, USAGE_STORAGE, roles), count, slots]);
        const gotCount = (await read(count, 1))[0];
        const gotSlots = await read(slots, n);
        if (halted === 1) {
          const untouched = gotCount === SENTINEL && gotSlots.every((v) => v === SENTINEL);
          record(`${name} halted=1 is a no-op`, untouched, `count=${gotCount >>> 0} (expected sentinel), slots untouched=${gotSlots.every((v) => v === SENTINEL)}`);
        } else {
          const ok = gotCount === dying.length && dying.every((v, k) => gotSlots[k] === v);
          record(`${name} halted=0 matches the reference`, ok, `count=${gotCount} slots=${Array.from(gotSlots.slice(0, dying.length)).join(',')}`);
        }
      }
    }

    // 2. halt-update
    const haltCases: Array<{ name: string; halted: number; death: number; candidates: number; before: number; expected: number }> = [
      { name: 'death count > 0 sets the flag', halted: 0, death: 3, candidates: 0, before: 0, expected: 1 },
      { name: 'candidate count > 0 sets the flag', halted: 0, death: 0, candidates: 2, before: 0, expected: 1 },
      { name: 'quiet step leaves the flag clear', halted: 0, death: 0, candidates: 0, before: 0, expected: 0 },
      { name: 'quiet step never clears a set flag', halted: 0, death: 0, candidates: 0, before: 1, expected: 1 },
      { name: 'a halted step does not touch the flag even with counts', halted: 1, death: 5, candidates: 5, before: 0, expected: 0 },
    ];
    for (const c of haltCases) {
      const params = buf(PARAMS_BYTES, USAGE_UNIFORM, paramsBytes(0, c.halted));
      const halt = buf(4, USAGE_STORAGE, new Uint32Array([c.before]));
      dispatch(pipes.halt, haltLayout, [params, buf(4, USAGE_STORAGE, new Uint32Array([c.death])), buf(4, USAGE_STORAGE, new Uint32Array([c.candidates])), halt]);
      const got = (await read(halt, 1))[0];
      record(`halt-update: ${c.name}`, got === c.expected, `flag=${got} expected=${c.expected}`);
    }
  } finally {
    device.destroy();
  }
  return cases;
}

const MAX_GRID_CELLS = 262_144;
const FORCE_TOLERANCE_ABS = 1e-4; // f32 re-association of <= ~150 terms of magnitude <= ~1.1: expected error ~1e-5
const FORCE_TOLERANCE_REL = 1e-4;

/**
 * Phase 18 — runs the SHIPPED WGSL of gridClear/gridBuild + the linked-list force kernel, and of sortCount/sortScan/
 * sortScatter + both cell-sorted force kernels, on identical synthetic populations (random positions incl. domain seam,
 * 1..14 cells per axis, wide last cell, input/output roles, several charge ranges), and requires:
 *   1. the counting-sort layout is exactly valid (permutation of 0..N-1, every slot lies in its cell's range, total = N);
 *   2. both sorted kernels equal the linked-list kernel within f32 re-association tolerance (the summation ORDER differs).
 */
async function runForceVariantSelfTest(gpu: GPU, failures: string[]): Promise<ForceSelfTestCase[]> {
  // A GPUAdapter can create only ONE device ("consumed" afterwards), and the death-compaction part above already used one,
  // so this test asks for a fresh adapter.
  const adapter = await gpu.requestAdapter();
  if (!adapter) {
    failures.push('force-variants: no second WebGPU adapter available');
    return [];
  }
  const supported = Number(adapter.limits?.maxStorageBuffersPerShaderStage ?? 0);
  if (supported < 16) {
    failures.push(`force-variants: adapter exposes only ${supported} storage buffers per stage; CEPC needs 16`);
    return [];
  }
  const device = await adapter.requestDevice({ requiredLimits: { maxStorageBuffersPerShaderStage: 16 } });
  const cases: ForceSelfTestCase[] = [];
  try {
    const entry = (binding: number, type: GPUBufferBindingType): GPUBindGroupLayoutEntry => ({ binding, visibility: STAGE_COMPUTE, buffer: { type } });
    const layoutOf = (types: GPUBufferBindingType[]): GPUBindGroupLayout =>
      device.createBindGroupLayout({ entries: types.map((t, binding) => entry(binding, t)) });
    const U: GPUBufferBindingType = 'uniform';
    const R: GPUBufferBindingType = 'read-only-storage';
    const W: GPUBufferBindingType = 'storage';
    const layouts = {
      clear: layoutOf([U, W]),
      build: layoutOf([U, R, W, W]),
      count: layoutOf([U, R, W]),
      scan: layoutOf([U, W, W]),
      scatter: layoutOf([U, R, R, R, R, R, W, W, W, W]),
      forceLinked: layoutOf([U, R, R, R, R, R, R, R, R, R, W, R, W]), // the Phase 5..17 layout (12 bindings)
      forceSorted: layoutOf([U, R, R, R, R, R, W, R, R, R, R]), // the Phase 18 layout (10 bindings)
    };
    const makePipeline = async (label: string, code: string, layout: GPUBindGroupLayout): Promise<GPUComputePipeline> => {
      device.pushErrorScope('validation');
      const module = device.createShaderModule({ code, label });
      const pipeline = device.createComputePipeline({
        label,
        layout: device.createPipelineLayout({ bindGroupLayouts: [layout] }),
        compute: { module, entryPoint: 'main' },
      });
      const error = await device.popErrorScope();
      if (error) {
        const messages = (await module.getCompilationInfo()).messages.map((m) => `${m.type} L${m.lineNum}: ${m.message}`);
        throw new Error(`${label}: ${error.message}${messages.length ? ' | ' + messages.join(' | ') : ''}`);
      }
      return pipeline;
    };
    const WG = 128;
    const pipes = {
      clear: await makePipeline('selftest-grid-clear', SHADER_GRID_CLEAR, layouts.clear),
      build: await makePipeline('selftest-grid-build', SHADER_GRID_BUILD, layouts.build),
      count: await makePipeline('selftest-sort-count', SHADER_SORT_COUNT, layouts.count),
      scan: await makePipeline('selftest-sort-scan', SHADER_SORT_SCAN, layouts.scan),
      scatter: await makePipeline('selftest-sort-scatter', SHADER_SORT_SCATTER, layouts.scatter),
      forceLinked: await makePipeline('selftest-force-linked', shaderForce(WG), layouts.forceLinked),
      forceSorted: await makePipeline('selftest-force-sorted', shaderForceSorted(WG, false), layouts.forceSorted),
      forceCulled: await makePipeline('selftest-force-sorted-culled', shaderForceSorted(WG, true), layouts.forceSorted),
    };

    const rsMin = 0.5, rsMax = 5, qmax = 100, epsilon = 1e-6;
    const scenarios = [
      { n: 40, side: 4, chargeMax: 100 }, // 1 x 1 cells
      { n: 300, side: 9, chargeMax: 100 }, // 1 x 1
      { n: 400, side: 12, chargeMax: 100 }, // 2 x 2
      { n: 500, side: 16, chargeMax: 100 }, // 3 x 3
      { n: 700, side: 19, chargeMax: 30 }, // 3 x 3, wide last cell
      { n: 1000, side: 22, chargeMax: 100 }, // 4 x 4: culling enabled
      { n: 2000, side: 31.6, chargeMax: 100 }, // 6 x 6
      { n: 2000, side: 31.6, chargeMax: 20 },
      { n: 10000, side: 70.7, chargeMax: 100 }, // 14 x 14
      { n: 10000, side: 70.7, chargeMax: 25 },
    ];
    let seed = 777;
    for (const sc of scenarios) {
      seed++;
      const rand = xorshift(seed);
      const n = sc.n;
      const cellSize = Math.max(rsMax, Math.sqrt((sc.side * sc.side) / MAX_GRID_CELLS));
      const countX = Math.max(1, Math.floor(sc.side / cellSize));
      const countY = countX;
      const cells = countX * countY;

      const positions = new Float32Array(n * 2);
      const velocities = new Float32Array(n * 2);
      const charges = new Uint32Array(n);
      const roles = new Uint32Array(n);
      const rs = new Float32Array(n), aa = new Float32Array(n);
      const oR = new Float32Array(n), oA = new Float32Array(n), oV = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        let x = rand() * sc.side, y = rand() * sc.side;
        if (i % 50 === 7) x = sc.side - 1e-6 * rand(); // right at the periodic seam
        if (i % 50 === 9) y = 0;
        positions[2 * i] = Math.min(x, sc.side * (1 - 1e-7));
        positions[2 * i + 1] = Math.min(y, sc.side * (1 - 1e-7));
        velocities[2 * i] = (rand() - 0.5) * 6;
        velocities[2 * i + 1] = (rand() - 0.5) * 6;
        charges[i] = Math.floor(rand() * (sc.chargeMax + 1));
        roles[i] = i === 0 ? 1 : i === 1 ? 2 : 0;
        rs[i] = rand() * rsMax; aa[i] = rand() * 12;
        oR[i] = rand() - 0.5; oA[i] = rand() - 0.5; oV[i] = rand() - 0.5;
      }

      const params = new ArrayBuffer(PARAMS_BYTES);
      const pv = new DataView(params);
      pv.setUint32(0, n, true);
      pv.setUint32(4, n, true);
      pv.setUint32(24, qmax, true);
      pv.setFloat32(44, sc.side, true);
      pv.setFloat32(48, sc.side, true);
      pv.setFloat32(52, rsMin, true);
      pv.setFloat32(56, rsMax, true);
      pv.setFloat32(68, epsilon, true);
      pv.setUint32(84, countX, true);
      pv.setUint32(88, countY, true);
      pv.setFloat32(92, cellSize, true);

      const owned: GPUBuffer[] = [];
      const buf = (bytes: number, usage: number, data?: ArrayBufferView | ArrayBuffer): GPUBuffer => {
        const b = device.createBuffer({ size: Math.max(16, (bytes + 3) & ~3), usage: usage | USAGE_COPY_DST | USAGE_COPY_SRC });
        if (data) {
          // Same overload the Phase 17 helper above uses (the ArrayBuffer cast satisfies lib.dom's ArrayBufferView<ArrayBuffer>).
          if (data instanceof ArrayBuffer) device.queue.writeBuffer(b, 0, data, 0, data.byteLength);
          else device.queue.writeBuffer(b, 0, data.buffer as ArrayBuffer, data.byteOffset, data.byteLength);
        }
        owned.push(b);
        return b;
      };
      const paramsBuf = buf(PARAMS_BYTES, USAGE_UNIFORM, params);
      const posBuf = buf(positions.byteLength, USAGE_STORAGE, positions);
      const velBuf = buf(velocities.byteLength, USAGE_STORAGE, velocities);
      const chargeBuf = buf(charges.byteLength, USAGE_STORAGE, charges);
      const roleBuf = buf(roles.byteLength, USAGE_STORAGE, roles);
      const rsBuf = buf(rs.byteLength, USAGE_STORAGE, rs);
      const aBuf = buf(aa.byteLength, USAGE_STORAGE, aa);
      const oRBuf = buf(oR.byteLength, USAGE_STORAGE, oR);
      const oABuf = buf(oA.byteLength, USAGE_STORAGE, oA);
      const oVBuf = buf(oV.byteLength, USAGE_STORAGE, oV);
      const headBuf = buf(cells * 4, USAGE_STORAGE);
      const nextBuf = buf(n * 4, USAGE_STORAGE);
      const cellCountBuf = buf(cells * 4, USAGE_STORAGE);
      const cellStartBuf = buf((cells + 1) * 4, USAGE_STORAGE);
      const sortedIndexBuf = buf(n * 4, USAGE_STORAGE);
      const sortedGeoBuf = buf(n * 16, USAGE_STORAGE);
      const sortedFvBuf = buf(n * 4, USAGE_STORAGE);
      const forceBufs = [0, 1, 2].map(() => buf(n * 8, USAGE_STORAGE));

      const group = (layout: GPUBindGroupLayout, resources: GPUBuffer[]): GPUBindGroup =>
        device.createBindGroup({ layout, entries: resources.map((buffer, binding) => ({ binding, resource: { buffer } })) });
      const forceLinkedGroup = (force: GPUBuffer): GPUBindGroup =>
        group(layouts.forceLinked, [paramsBuf, posBuf, velBuf, chargeBuf, roleBuf, rsBuf, aBuf, oRBuf, oABuf, oVBuf, headBuf, nextBuf, force]);
      const forceSortedGroup = (force: GPUBuffer): GPUBindGroup =>
        group(layouts.forceSorted, [paramsBuf, chargeBuf, roleBuf, oRBuf, oABuf, oVBuf, force, cellStartBuf, sortedIndexBuf, sortedGeoBuf, sortedFvBuf]);

      const encoder = device.createCommandEncoder();
      const dispatch = (pipeline: GPUComputePipeline, bindGroup: GPUBindGroup, workgroups: number) => {
        const pass = encoder.beginComputePass();
        pass.setPipeline(pipeline);
        pass.setBindGroup(0, bindGroup);
        pass.dispatchWorkgroups(workgroups);
        pass.end();
      };
      const particleGroups = Math.ceil(n / WG);
      dispatch(pipes.clear, group(layouts.clear, [paramsBuf, headBuf]), Math.ceil(cells / WG));
      dispatch(pipes.build, group(layouts.build, [paramsBuf, posBuf, headBuf, nextBuf]), particleGroups);
      encoder.clearBuffer(cellCountBuf);
      dispatch(pipes.count, group(layouts.count, [paramsBuf, posBuf, cellCountBuf]), particleGroups);
      dispatch(pipes.scan, group(layouts.scan, [paramsBuf, cellCountBuf, cellStartBuf]), 1);
      dispatch(pipes.scatter, group(layouts.scatter, [paramsBuf, posBuf, velBuf, rsBuf, aBuf, cellStartBuf, cellCountBuf, sortedIndexBuf, sortedGeoBuf, sortedFvBuf]), particleGroups);
      dispatch(pipes.forceLinked, forceLinkedGroup(forceBufs[0]), particleGroups);
      dispatch(pipes.forceSorted, forceSortedGroup(forceBufs[1]), particleGroups);
      dispatch(pipes.forceCulled, forceSortedGroup(forceBufs[2]), particleGroups);

      const readers = [cellStartBuf, sortedIndexBuf, ...forceBufs].map((b) => device.createBuffer({ size: b.size, usage: USAGE_MAP_READ | USAGE_COPY_DST }));
      [cellStartBuf, sortedIndexBuf, ...forceBufs].forEach((b, k) => encoder.copyBufferToBuffer(b, 0, readers[k], 0, b.size));
      device.queue.submit([encoder.finish()]);
      for (const r of readers) await r.mapAsync(MAP_READ);
      const cellStart = new Uint32Array(readers[0].getMappedRange().slice(0));
      const sortedIndex = new Uint32Array(readers[1].getMappedRange().slice(0));
      const fLinked = new Float32Array(readers[2].getMappedRange().slice(0));
      const fSorted = new Float32Array(readers[3].getMappedRange().slice(0));
      const fCulled = new Float32Array(readers[4].getMappedRange().slice(0));
      for (const r of readers) { r.unmap(); r.destroy(); }
      for (const b of owned) b.destroy();

      // Layout invariants, recomputed independently on the CPU from the same f32 positions.
      let sortLayoutValid = cellStart[cells] === n;
      const seen = new Uint8Array(n);
      const cellOf = (i: number): number => {
        const wrap = (v: number, e: number) => v - Math.floor(v / e) * e;
        const cx = Math.min(Math.floor(Math.fround(wrap(positions[2 * i], sc.side)) / cellSize), countX - 1);
        const cy = Math.min(Math.floor(Math.fround(wrap(positions[2 * i + 1], sc.side)) / cellSize), countY - 1);
        return cy * countX + cx;
      };
      for (let c = 0; c < cells && sortLayoutValid; c++) {
        if (cellStart[c] > cellStart[c + 1]) sortLayoutValid = false;
      }
      for (let k = 0; k < n && sortLayoutValid; k++) {
        const i = sortedIndex[k];
        if (i >= n || seen[i]) { sortLayoutValid = false; break; }
        seen[i] = 1;
      }
      let cellMismatches = 0;
      for (let c = 0; c < cells && sortLayoutValid; c++) {
        for (let k = cellStart[c]; k < cellStart[c + 1]; k++) {
          // GPU and CPU may round the f32 wrap/divide differently for a particle within ~1 ulp of a cell border: tolerate those.
          if (cellOf(sortedIndex[k]) !== c) cellMismatches++;
        }
      }
      if (cellMismatches > Math.max(1, Math.floor(n / 1000))) sortLayoutValid = false;

      let maxAbsForce = 0, nonZero = 0, dSorted = 0, dCulled = 0;
      for (let k = 0; k < 2 * n; k++) {
        const ref = fLinked[k];
        if (!Number.isFinite(ref) || !Number.isFinite(fSorted[k]) || !Number.isFinite(fCulled[k])) { dSorted = dCulled = Infinity; break; }
        maxAbsForce = Math.max(maxAbsForce, Math.abs(ref));
        if (ref !== 0) nonZero++;
        const tol = FORCE_TOLERANCE_ABS + FORCE_TOLERANCE_REL * Math.abs(ref);
        dSorted = Math.max(dSorted, Math.abs(fSorted[k] - ref) / tol);
        dCulled = Math.max(dCulled, Math.abs(fCulled[k] - ref) / tol);
      }
      const c: ForceSelfTestCase = {
        particles: n,
        cellsX: countX,
        cellsY: countY,
        chargeMax: sc.chargeMax,
        sortLayoutValid,
        maxToleranceMultipleSorted: dSorted,
        maxToleranceMultipleSortedCulled: dCulled,
        maxAbsForce,
        nonZeroForces: nonZero,
      };
      cases.push(c);
      const label = `N=${n} cells=${countX}x${countY} chargeMax=${sc.chargeMax}`;
      if (!sortLayoutValid) failures.push(`force-variants ${label}: counting-sort layout invalid (cellMismatches=${cellMismatches})`);
      if (!(dSorted <= 1)) failures.push(`force-variants ${label}: sorted differs from linked-list by ${dSorted.toFixed(2)}x tolerance`);
      if (!(dCulled <= 1)) failures.push(`force-variants ${label}: sorted-culled differs from linked-list by ${dCulled.toFixed(2)}x tolerance`);
      if (n >= 300 && nonZero === 0) failures.push(`force-variants ${label}: linked-list forces are all zero (vacuous comparison)`);
    }
  } finally {
    device.destroy();
  }
  return cases;
}
