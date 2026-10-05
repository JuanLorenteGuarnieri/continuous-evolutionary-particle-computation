import { Genome, MFMConfig, ParticleState, PopulationState } from '@cepc/shared-config';
import {
  CpuSectionProfiler,
  GpuPassTimestampProfiler,
  aggregateCpuRecords,
  aggregateGpuSteps,
  type TimestampWritesDescriptor,
} from './profiling';
/**
 * GPU implementation of the MFM v3 timestep.
 *
 * Design notes:
 * - Simulation state is stored in Structure-of-Arrays (SoA) GPU buffers.
 * - State buffers use ping-pong double buffering so all decisions in timestep n
 *   read the same snapshot and writes go exclusively to timestep n+1 buffers.
 * - Charge, communication, local-success, health, force and mechanics execute
 *   as WebGPU compute passes.
 * - Population topology changes (death/reproduction) are intentionally handled
 *   on the CPU after the GPU dynamics have completed. This keeps the population
 *   container compatible with PopulationState while leaving the expensive local
 *   particle dynamics on the GPU.
 * - Communication uses deterministic per-particle/per-rank counter-based
 *   randomness derived from seed + persistent ParticleID hash + timestep.
 */

const EPSILON = 1e-6;
const ROLE_INTERNAL = 0;
/** Phase 17: role value the death-compaction WGSL embeds; exported for kernel-selftest.ts. */
export const MFM_ROLE_INTERNAL = ROLE_INTERNAL;
const ROLE_INPUT = 1;
const ROLE_OUTPUT = 2;
const UINT32_MAX = 0xffffffff;
const UNIFORM_BUFFER_SIZE = 112;
const UNIFORM_DYNAMIC_STRIDE = 256;
const MAX_GRID_CELLS = 262_144;
const WORKGROUP_SIZE = 128;

// WebGPU enum values are used as local constants so this package does not
// depend on ambient enum declarations such as GPUBufferUsage/GPUMapMode/
// GPUShaderStage being present in the TypeScript lib configuration.
const BUFFER_USAGE_MAP_READ = 0x0001;
const BUFFER_USAGE_COPY_SRC = 0x0004;
const BUFFER_USAGE_COPY_DST = 0x0008;
const BUFFER_USAGE_UNIFORM = 0x0040;
const BUFFER_USAGE_STORAGE = 0x0080;
const SHADER_STAGE_COMPUTE = 0x0004;
const MAP_MODE_READ = 0x0001;

/** Phase 15: layout of the 12-byte count summary copied by every step submission. */
const EVENT_SUMMARY_DEATH_OFFSET = 0;
const EVENT_SUMMARY_CANDIDATE_OFFSET = 4;
const EVENT_SUMMARY_EVENT_OFFSET = 8;
const EVENT_SUMMARY_BYTES = 12;

/**
 * Phase 16: switches for the WebGPU orchestration mechanisms. They exist so each mechanism can be
 * A/B measured on real hardware in ONE build (`tools/bench/benchmark-webgpu.mjs --bind-group-cache
 * on|off --pack-params on|off`). They never change what the GPU computes: with any combination the
 * same dispatches run with the same bound buffers and the same parameter bytes (verified by the
 * dispatch-trace digests in `tests/orchestration.test.ts`).
 */
export interface OrchestrationOptions {
  /**
   * Reuse the per-step bind groups across timesteps. Cache key: (stateRead, incomingRead,
   * eventWrite) -> at most 8 sets of 13 bind groups. Cleared whenever the data buffers are destroyed.
   */
  bindGroupCache: boolean;
  /**
   * Upload all rank parameter blocks with ONE queue.writeBuffer (more bytes: includes the 144 B of
   * padding between blocks; fewer calls) instead of one 112 B write per block. Only differs when maxK > 1.
   */
  packParamWrites: boolean;
  /**
   * Phase 20: skip O(N) CPU work that a quiet step (no death, no reproduction candidate) never uses: the per-step Snapshot is built only
   * when a non-quiet step needs it, the input slot is found by an early-exit scan, and `previousIncoming*` reference the (replace-only)
   * incoming maps instead of copying them. Observationally identical to the previous behaviour (tests/quiet-fast-path.test.ts).
   */
  quietFastPath: boolean;
  /**
   * Phase 20: number of normal-sync steps kept in flight by `step()`. 1 = the Phase 5..19 behaviour (submit, await the 12-byte summary,
   * commit). 2 = optimistic pipelining: step n+1 is submitted before the summary of step n arrives; a GPU-side halt flag turns every
   * step that follows a non-quiet step into a no-op, and the CPU re-submits it after handling the non-quiet step (see PIPELINING below).
   * Opt-in until validated on hardware.
   */
  pipelineDepth: 1 | 2;
}

export const DEFAULT_ORCHESTRATION_OPTIONS: Readonly<OrchestrationOptions> = Object.freeze({
  bindGroupCache: true,
  packParamWrites: false,
  quietFastPath: true,
  pipelineDepth: 1,
});

/**
 * Phase 17: switches for GPU *kernel* variants. Like OrchestrationOptions they exist so each mechanism can be
 * A/B-benchmarked in one session.
 *
 *  - deathCompaction: 'parallel' (default since Phase 17: one workgroup, tiled stable scan) or 'serial' (the Phase 16
 *    kernel: one invocation scans activeCount particles). Both write the SAME deathCount and the SAME ascending
 *    deathSlots; no atomics, no ordering change. Measured on an Intel HD Graphics 520: deathCompaction GPU time
 *    -75 % (N=200) to -94 % (N=10000), exact outputs on-device (docs/phases/17-phase17-gpu-kernel-optimization.md).
 *    'serial' is kept as the reference/A-B variant.
 *  - forceWorkgroupSize: workgroup size of the grid force kernel only (the kernel body is unchanged; only the number
 *    of invocations per workgroup and the dispatch geometry change). Default 128. On the Intel HD Graphics 520 32 and
 *    64 were indistinguishable from 128 and 256 was slower (+9 % to +33 % force GPU time for N <= 2000), so the
 *    default was kept; other GPU architectures have not been measured. Must not exceed the device's
 *    maxComputeInvocationsPerWorkgroup (256 by default).
 */
/**
 * Phase 19: 'blocked' = one workgroup of 256 invocations; each invocation counts the deaths in ONE contiguous chunk of particles,
 * ONE inclusive scan of the 256 chunk counts gives every chunk its output offset, and each invocation then writes its chunk's slots
 * in ascending order. Output (deathCount, ascending deathSlots) is identical to 'serial' and 'parallel'; it replaces the ~N/128
 * tile scans (14 barriers each) of 'parallel' by a single 8-step scan, and skips the second pass when nothing died.
 * Default since the Phase 19 hardware A/B (pass -11%..-82%, 5/5 paired wins at every N, GPU step time -17% at N=10000, on-device self-test passed).
 */
export type DeathCompactionMode = 'serial' | 'parallel' | 'blocked';
export type ForceWorkgroupSize = 32 | 64 | 128 | 256;
/**
 * Phase 18: which grid-force kernel runs. All three compute the SAME mathematical sum over the SAME in-range pairs
 * (range test, features, force law untouched); they differ only in how candidate neighbours are enumerated.
 *  - 'linked-list'  : Phase 5..17 kernel. One thread per particle walks cellHead/particleNext chains (dependent loads).
 *  - 'sorted'       : three extra passes counting-sort the particles by grid cell (sortCount, sortScan, sortScatter) and
 *                     pre-compute the per-particle neighbour features once; the force kernel then reads contiguous
 *                     per-cell ranges, with threads ordered by cell. No dependent-load chain, ~1 vec4 load per candidate.
 *  - 'sorted-culled': 'sorted' plus exact culling of the (up to 9) neighbour cells whose rectangle lies farther than the
 *                     particle's charge-dependent range. Only enabled when the grid has >= 4 cells per axis (below that
 *                     the periodic wrap could make a skipped cell reachable through another image); otherwise it is 'sorted'.
 * Summation order differs from 'linked-list' (which already depended on atomic arrival order), so forces agree to float
 * rounding, not bit-for-bit. Algorithm-level proof: tests/force-grid-variants.test.ts. On-device proof: kernel self-test.
 * Default: 'sorted-culled' since the Phase 18 hardware A/B (docs/phases/18-*.md: force pass -30%..-83%, GPU step time -22%..-73% from
 * N=500, neutral at N=200, on-device self-test passed). 'linked-list' stays selectable (it is the Phase 5..17 kernel, pinned by the
 * Phase 15 golden dispatch traces).
 */
export type ForceKernelMode = 'linked-list' | 'sorted' | 'sorted-culled';
export interface KernelOptions {
  deathCompaction: DeathCompactionMode;
  forceWorkgroupSize: ForceWorkgroupSize;
  forceKernel: ForceKernelMode;
}

export const DEFAULT_KERNEL_OPTIONS: Readonly<KernelOptions> = Object.freeze({
  deathCompaction: 'blocked',
  forceWorkgroupSize: 128,
  forceKernel: 'sorted-culled',
});

const FORCE_KERNEL_MODES: readonly string[] = ['linked-list', 'sorted', 'sorted-culled'];

const FORCE_WORKGROUP_SIZES: readonly number[] = [32, 64, 128, 256];

/**
 * Phase 16: every bind group one normal timestep needs. Each depends only on the ping-pong indices
 * (stateRead / incomingRead / eventWrite; the *Write indices are their complements) plus buffers that
 * are stable until the data buffers are recreated. `rank` is NOT part of the key: it selects a
 * parameter block through the dynamic offset of binding 0, so one communication bind group serves all ranks.
 */
interface StepBindGroups {
  gridClear: GPUBindGroup;
  gridBuild: GPUBindGroup;
  chargeProcess: GPUBindGroup;
  chargeFinalize: GPUBindGroup;
  pressure: GPUBindGroup;
  select: GPUBindGroup;
  transmit: GPUBindGroup;
  localSuccess: GPUBindGroup;
  healthUpdate: GPUBindGroup;
  force: GPUBindGroup;
  mechanics: GPUBindGroup;
  deathCompaction: GPUBindGroup;
  /** Created lazily, only for steps that run reproduction compaction. */
  reproductionCompaction: GPUBindGroup | null;
  /** Phase 18: created lazily, only while a cell-sorted force kernel is selected. */
  sort: SortBindGroups | null;
}

interface SortBindGroups {
  count: GPUBindGroup;
  scan: GPUBindGroup;
  scatter: GPUBindGroup;
}

/**
 * Phase 15: how the GPU buffers follow a change in population membership when the buffer
 * shape (capacity, maxK, grid) does not change. Dead slots are ascending and unique.
 */
interface RestructurePlan {
  /** Number of GPU-resident slots BEFORE this restructure (== old slot mapping size). */
  oldParticleCount: number;
  deadSlots: number[];
  offspringCount: number;
}

/**
 * Small deterministic CPU-side RNG used only for reproduction/genome
 * operations. GPU communication randomness is generated directly in WGSL
 * from (seed, timestep, ParticleID hash, event/rank), so GPU scheduling never
 * changes its random stream.
 */
class XorShift32 {
  private state: number;

  constructor(seed: number) {
    this.state = (seed >>> 0) || 0x6d2b79f5;
  }

  public nextUint32(): number {
    let x = this.state >>> 0;
    x ^= (x << 13) >>> 0;
    x ^= x >>> 17;
    x ^= (x << 5) >>> 0;
    this.state = x >>> 0;
    return this.state;
  }

  public nextFloat(): number {
    return this.nextUint32() / 0x100000000;
  }

  public getState(): number {
    return this.state >>> 0;
  }

  public setState(state: number): void {
    this.state = (state >>> 0) || 0x6d2b79f5;
  }
}

/**
 * Phase 15: why a full GPU -> CPU dynamic-state readback happened. Counted per reason as
 * `sync.fullSyncs.<reason>` so the benchmark output shows which exceptional boundary fired.
 */
export type FullSyncReason =
  /** Caller asked: checkpoint, inspection, grab, backend switch, validation, debugging. */
  | 'explicit'
  /** A death/birth changed the buffer shape (capacity, maxK, grid): buffers are rebuilt from CPU state. */
  | 'shapeChange'
  /** A configuration change recreated the GPU buffers. */
  | 'configChange';

interface EvolutionResult {
  deadCount: number;
  /** Ids that survive this step. Only meaningful when deadCount > 0. */
  survivingIds: Set<string>;
  offspring: Array<{ id: string; genome: Genome; state: ParticleState }>;
}

interface Snapshot {
  id: string;
  state: ParticleState;
  genome: Genome;
}

/**
 * CPU data required to commit the GPU timestep into PopulationState.
 *
 * Phase 5C deliberately excludes transient GPU event/diagnostic buffers from
 * this readback. Communication events are read back separately only when the
 * CPU population step actually needs them.
 */
interface EvolutionReadback {
  healths: Float32Array;
  charges?: Uint32Array;
  positions?: Float32Array;
  velocities?: Float32Array;
}

interface FullReadbackLayout {
  positions: number;
  velocities: number;
  healths: number;
  charges: number;
  totalBytes: number;
}

type BufferSet = [GPUBuffer, GPUBuffer];

type PipelineBundle = {
  pipeline: GPUComputePipeline;
  layout: GPUBindGroupLayout;
};

type CpuSyncMode = 'normal' | 'full';

const EMPTY_SNAPSHOT: Snapshot[] = [];

// Phase 20 — pipelined stepping. Per-step summary staging slot (16 B): [death count][candidate count][event count][halted-at-start flag].
const PIPE_SUMMARY_BYTES = 16;
const PIPE_SUMMARY_HALTED_OFFSET = 12;
/** Byte offset of `halted` inside every Params block (struct member after pressureGamma; see fillParamsBlock0). */
const PARAMS_HALTED_OFFSET = 108;

/** What encoding a pipelined step needs to know: how many uncommitted steps precede it, and its summary slot. */
interface PipelinedContext {
  ahead: number;
  slot: 0 | 1;
  outcome: PipelinedOutcome;
}

/** Shared between a pipelined step's finishNormalSync() closure and the pipeline bookkeeping. */
interface PipelinedOutcome {
  /** The step was a no-op / stale: nothing was committed and it must be re-submitted. */
  discarded: boolean;
  /** The step executed and was non-quiet (deaths / reproduction candidates): the GPU halt flag must be cleared afterwards. */
  nonQuiet: boolean;
}

interface PipelinedStep {
  encoded: EncodedStepInternal;
  outcome: PipelinedOutcome;
  /** pendingInputSignal / pendingError values this step consumed (restored if the step is discarded). */
  consumedInput: number | null;
  consumedError: number | null;
  bufferGeneration: number;
}

/** One lagged population-metrics sample (see pollPopulationMetrics). `timestep` is the committed step the state belongs to. */
export interface PopulationMetricsSample {
  count: number;
  healthSum: number;
  totalCharge: number;
  inputCharge: number;
  outputCharge: number;
  timestep: number;
}

interface LaggedMetricsSlot {
  buffer: GPUBuffer;
  pending: boolean;
  result: PopulationMetricsSample | null;
}


/**
 * A complete WebGPU MFM v3 stepper with CPU-assisted population evolution.
 */
interface EncodedStepInternal {
  stateWrite: number;
  incomingWrite: number;
  eventWrite: number;
  /** Number of particles with a genome at encode time (= the length of the Snapshot). */
  snapshotLength: number;
  /** Phase 20: the Snapshot is materialized on first use (non-quiet steps only when `quietFastPath` is on). */
  getSnapshot: () => Snapshot[];
  inputSignal: number;
  inputSlot: number;
  previousIncomingCharges: Map<string, number>;
  previousIncomingSenders: Map<string, Set<string>>;
  reproductionCompactionEnabled: boolean;
  finishNormalSync: () => Promise<PopulationState>;
}

export interface EncodedStep {
  renderState: {
    positions: GPUBuffer;
    health: GPUBuffer;
    charge: GPUBuffer;
    role: GPUBuffer;
    particleCount: number;
  };
  finishNormalSync: () => Promise<PopulationState>;
  /** Backwards-compatible alias for the normal synchronization path. */
  finish: () => Promise<PopulationState>;
}

export class MfmWebGPUStepper {
  private device: GPUDevice;
  private config: MFMConfig;
  private population: PopulationState;
  private rng: XorShift32;
  private readonly seed: number;

  private timestep = 0;
  /**
   * Phase 20: incremented whenever the stepper's PopulationState topology/event metadata (membership, roles, sender sets) may have changed:
   * a non-quiet step, setState/loadState, a replaced population. A quiet step leaves the population untouched, so a consumer that merged the
   * population at epoch E can skip merging while the epoch is still E (see getTopologyEpoch()).
   */
  private topologyEpoch = 0;
  private pendingInputSignal: number | null = null;
  private pendingError: number | null = null;

  /** Charge/sender events generated by the previous GPU timestep. */
  private incomingChargeMap = new Map<string, number>();
  private incomingSendersMap = new Map<string, Set<string>>();

  /** Slot mapping. ParticleID is persistent; slotIndex is purely physical. */
  private slotToId: string[] = [];
  private idToSlot = new Map<string, number>();

  /** Reusable CPU snapshot scratch. Entries are mutated/reused every timestep. */
  private readonly snapshotScratch: Snapshot[] = [];

  private capacity = 1;
  private particleCount = 0;
  private maxK = 0;
  private gridCellSize = 1;
  private gridCountX = 1;
  private gridCountY = 1;
  private initialized = false;
  private populationDirty = false;
  

  /**
   * At most one GPU step may be in flight. Concurrent UI/frame requests are
   * coalesced onto the current step instead of being queued as extra timesteps.
   * This prevents shared staging buffers from being mapped by overlapping steps.
   */
  private stepInFlight: Promise<PopulationState> | null = null;
  /** True from encodeStep() until its finishNormalSync() has completed. */
  private encodedStepPending = false;

  /** Ping-pong state buffers. stateIndex is the read/current state. */
  private stateIndex = 0;
  private positionBuffers: BufferSet = [null as never, null as never];
  private velocityBuffers: BufferSet = [null as never, null as never];
  private healthBuffers: BufferSet = [null as never, null as never];
  private chargeBuffers: BufferSet = [null as never, null as never];

  /** Ping-pong charge reception buffers. incomingIndex is the read buffer. */
  private incomingChargeBuffers: BufferSet = [null as never, null as never];
  private incomingIndex = 0;

  /** Current/previous transmission event buffers, implemented as append-only CSR-like event lists. */
  private senderBuffers: BufferSet = [null as never, null as never];
  private targetBuffers: BufferSet = [null as never, null as never];
  private senderCountBuffers: BufferSet = [null as never, null as never];
  private eventIndex = 0;

  /** Spatial grid buffers. A cell stores the head of an atomic linked list of particle slots. */
  private cellHeadBuffer!: GPUBuffer;
  private particleNextBuffer!: GPUBuffer;
  /**
   * Phase 18 cell-sorted layout (used only by the 'sorted' / 'sorted-culled' force kernels).
   * cellCount: per-cell counter, then per-cell cursor (atomic); cellStart: exclusive prefix sums with the total at [cells];
   * sortedIndex[slot] = particle index; sortedGeo[slot] = (x, y, feature(Rs), feature(A)); sortedFv[slot] = feature(|v|).
   */
  private cellCountBuffer!: GPUBuffer;
  private cellStartBuffer!: GPUBuffer;
  private sortedIndexBuffer!: GPUBuffer;
  private sortedGeoBuffer!: GPUBuffer;
  private sortedFvBuffer!: GPUBuffer;
  /** True while the five buffers above exist for the current data buffers (they are created on first use of a sorted kernel). */
  private sortBuffersReady = false;

  /** Static particle/genome buffers. */
  private roleBuffer!: GPUBuffer;
  private particleIdHashBuffer!: GPUBuffer;
  private genomeHMaxBuffer!: GPUBuffer;
  private genomeThetaQBuffer!: GPUBuffer;
  private genomeABuffer!: GPUBuffer;
  private genomeKBuffer!: GPUBuffer;
  private genomeRcBuffer!: GPUBuffer;
  private genomeMBuffer!: GPUBuffer;
  private genomeGammaBuffer!: GPUBuffer;
  private genomeRsBuffer!: GPUBuffer;
  private genomeOmegaRBuffer!: GPUBuffer;
  private genomeOmegaABuffer!: GPUBuffer;
  private genomeOmegaVBuffer!: GPUBuffer;

  /** Temporary/intermediate buffers. */
  private qResidualBuffer!: GPUBuffer;
  private qOutBuffer!: GPUBuffer;
  private activeBuffer!: GPUBuffer;
  private successfulBuffer!: GPUBuffer;
  private selectedTargetsBuffer!: GPUBuffer;
  private selectedCountBuffer!: GPUBuffer;
  private forceBuffer!: GPUBuffer;
  /** Single GPU-resident pressure value computed from P_n/Q_n each step. */
  private pressureBuffer!: GPUBuffer;
  private paramsBuffer!: GPUBuffer;
  /**
   * Phase 16: persistent CPU image of the whole params buffer, reused by every step (Phase 15 allocated an
   * ArrayBuffer + DataView per block per step). Padding between blocks is never written and stays zero.
   */
  private paramsScratch = new Uint8Array(0);
  private paramsView = new DataView(new ArrayBuffer(0));
  /** Phase 16: number of 256 B param blocks, max(1, maxK). Block r holds rank r; block 0 is also the rank-less block. */
  private paramBlocks = 1;
  /** Phase 16: orchestration switches (see OrchestrationOptions). */
  private orchestration: OrchestrationOptions = { ...DEFAULT_ORCHESTRATION_OPTIONS };
  /** Phase 17: GPU kernel variant switches (see KernelOptions). */
  private kernels: KernelOptions = { ...DEFAULT_KERNEL_OPTIONS };
  /**
   * Phase 16: bind-group sets indexed by stateRead | incomingRead << 1 | eventWrite << 2 (8 slots, lazily filled).
   * OWNERSHIP: the sets hold bind groups that reference this stepper's data buffers, so the cache is cleared in
   * destroyDataBuffersOnly() and destroy() BEFORE any buffer is destroyed, and never outlives a createDataBuffers().
   */
  private readonly stepBindGroupCache: Array<StepBindGroups | undefined> = new Array<StepBindGroups | undefined>(8).fill(undefined);
  /** Phase 16: per-step encode counters (plain numbers; published to the CPU profiler only when profiling is on). */
  private encPasses = 0;
  private encClears = 0;
  private encCopies = 0;

  /** Persistent GPU -> CPU readback staging buffers.
   *
   * Normal sync is intentionally only health (4 B/particle); charge is GPU-authoritative.
   * Position/velocity remain GPU-authoritative and are read back only for an
   * exceptional full sync or when reproduction needs the current pre-step
   * geometry.
   */
  private fullStateReadback!: GPUBuffer;
  private reproductionStateReadback!: GPUBuffer;
  /** Phase 15: dedicated staging for per-frame metrics, so metrics never share a mapped buffer with step synchronization. */
  private metricsStateReadback!: GPUBuffer;
  /** Phase 15: role (0 internal, 1 input, 2 output) per slot, rebuilt with the slot mapping; avoids a Map lookup per particle per metrics read. */
  private slotRoles = new Uint8Array(0);
  private reproductionCandidateBuffer!: GPUBuffer;
  private reproductionCandidateSlotBuffer!: GPUBuffer;
  private reproductionCandidateCountBuffer!: GPUBuffer;
  /** Compact GPU slots whose post-step health reaches the population death event. */
  private deathCandidateSlotBuffer!: GPUBuffer;
  private deathCandidateCountBuffer!: GPUBuffer;
  private genomeMateHealthThresholdBuffer!: GPUBuffer;
  private eventSummaryReadback!: GPUBuffer;
  private eventDataReadback!: GPUBuffer;


  /** Compute pipelines. */
  private gridClearPipeline!: PipelineBundle;
  private gridBuildPipeline!: PipelineBundle;
  private chargeProcessPipeline!: PipelineBundle;
  private chargeFinalizePipeline!: PipelineBundle;
  private communicationSelectPipeline!: PipelineBundle;
  private communicationTransmitPipeline!: PipelineBundle;
  private localSuccessPipeline!: PipelineBundle;
  private pressurePipeline!: PipelineBundle;
  private healthUpdatePipeline!: PipelineBundle;
  private forcePipeline!: PipelineBundle;
  /** Phase 18: created lazily the first time a cell-sorted force kernel is selected, so the default path never compiles them. */
  private sortCountPipeline: PipelineBundle | undefined;
  private sortScanPipeline: PipelineBundle | undefined;
  private sortScatterPipeline: PipelineBundle | undefined;
  private forceAllPairsPipeline!: PipelineBundle;
  private mechanicsPipeline!: PipelineBundle;
  private reproductionCompactionPipeline!: PipelineBundle;
  private deathCompactionPipeline!: PipelineBundle;

  /**
   * Phase 14 instrumentation. Both are null unless enableProfiling() is called,
   * so the disabled cost is one null check per instrumented site.
   */
  private cpuProfiler: CpuSectionProfiler | null = null;
  private gpuProfiler: GpuPassTimestampProfiler | null = null;
  /**
   * Phase 20 — PIPELINING (OrchestrationOptions.pipelineDepth = 2). `step()` keeps up to two steps in flight. Correctness argument:
   *  1. A step is *quiet* when it produced no death and no reproduction candidate; then its CPU commit changes no data, only the ping-pong indices
   *     and the timestep, which the next step's encoding can anticipate (indices flip once per step; params.timestep = committed + ahead).
   *  2. A non-quiet step must be handled by the CPU (restructure/offspring) BEFORE the next step may run. The next step is already submitted, so
   *     it is made harmless on the GPU: the last pass of every executed step (`haltUpdate`) sets a GPU halt flag when its own counts are non-zero;
   *     the start of every step copies that flag into every Params block (`params.halted`), and every kernel returns immediately when it is set.
   *     A step submitted behind a halting step therefore executes no kernel; its only effects are the per-step clearBuffer calls, which only touch
   *     buffers that the halted step's CPU handling does not read (audited in docs/phases/20-*.md), and copies into its own summary slot.
   *  3. The CPU learns each step's outcome from its 16-byte summary slot, whose last word is the halt flag as the step saw it: 1 = no-op.
   *     No-op steps are discarded (pending input/error restored), the halt flag is cleared with a queue-ordered writeBuffer, and the steps are re-encoded.
   *  4. Anything that touches the GPU state or the population outside step() first drains the pipeline (drainPipeline()).
   * Rendering/metrics of the committed state must be issued between step() calls (before the next submission overwrites its buffer set).
   */
  private pipe: PipelinedStep[] = [];
  private pipeSeq = 0;
  private pipeResourcesReady = false;
  private haltBuffer!: GPUBuffer;
  private zeroWordBuffer!: GPUBuffer;
  private pipeSummary!: [GPUBuffer, GPUBuffer];
  private haltUpdatePipeline: PipelineBundle | undefined;
  private haltUpdateGroups: { withCandidates: GPUBindGroup; withoutCandidates: GPUBindGroup } | null = null;
  /** Incremented whenever the data buffers are destroyed/recreated: in-flight pipelined steps of an older generation are stale. */
  private bufferGeneration = 0;
  private encodeTimestepAhead = 0;
  private encodingPipelined = false;
  private pipelineDiscards = 0;

  /** Phase 20: lagged, non-blocking population metrics (pollPopulationMetrics). */
  private laggedMetrics: LaggedMetricsSlot[] | null = null;
  private ioSlots: Array<{ slot: number; role: 1 | 2 }> = [];

  /** Phase 19: true between encodeStep(..., { deferTimingResolve: true }) and endStepTiming(). */
  private timingResolveDeferred = false;

  constructor(device: GPUDevice, config: MFMConfig, population: PopulationState, seed?: number) {
    this.device = device;
    this.config = config;
    this.population = population;
    this.seed = (seed ?? config.seed ?? 0) >>> 0;
    this.rng = new XorShift32(this.seed);
    this.refreshCpuSlotMapping();
  }

  public async init(): Promise<void> {
    this.validateConfiguration();
    await this.createPipelines();
    await this.recreateGpuBuffers(true);
    this.initialized = true;
  }

  /**
   * Compact population-event staging. Phase 15 batches death slots, reproduction
   * candidate slots and candidate geometry into this one buffer. A slot is a death
   * (healthOut <= 0) or a candidate (healthOut > 0), never both, so the worst case is
   * every particle being a candidate: 4 B slot + 16 B geometry = 20 B per slot.
   */
  private getReproductionReadbackLayout(): { totalBytes: number } {
    return { totalBytes: Math.max(4, this.capacity * 20) };
  }

  private getFullReadbackLayout(): FullReadbackLayout {
    let offset = 0;

    const positions = offset;
    offset += this.capacity * 8;

    const velocities = offset;
    offset += this.capacity * 8;

    const healths = offset;
    offset += this.capacity * 4;

    const charges = offset;
    offset += this.capacity * 4;

    return { positions, velocities, healths, charges, totalBytes: offset };
  }

  public getOrchestrationOptions(): Readonly<OrchestrationOptions> {
    return this.orchestration;
  }

  /** Phase 16: A/B switches. Safe between steps; turning the cache off also drops its entries. */
  public setOrchestrationOptions(options: Partial<OrchestrationOptions>): void {
    this.orchestration = { ...this.orchestration, ...options };
    if (!this.orchestration.bindGroupCache) this.invalidateBindGroupCache();
  }

  public getKernelOptions(): Readonly<KernelOptions> {
    return this.kernels;
  }

  /**
   * Phase 17: kernel A/B switches. Safe between steps. A changed option rebuilds only the affected pipeline, reusing the
   * existing bind group layout object, so cached bind groups stay valid.
   */
  public setKernelOptions(options: Partial<KernelOptions>): void {
    const next: KernelOptions = { ...this.kernels, ...options };
    if (next.deathCompaction !== 'serial' && next.deathCompaction !== 'parallel' && next.deathCompaction !== 'blocked') {
      throw new Error(`invalid deathCompaction mode: ${String(next.deathCompaction)}`);
    }
    if (!FORCE_WORKGROUP_SIZES.includes(next.forceWorkgroupSize)) {
      throw new Error(`invalid forceWorkgroupSize: ${String(next.forceWorkgroupSize)} (expected one of ${FORCE_WORKGROUP_SIZES.join(', ')})`);
    }
    if (!FORCE_KERNEL_MODES.includes(next.forceKernel)) {
      throw new Error(`invalid forceKernel: ${String(next.forceKernel)} (expected one of ${FORCE_KERNEL_MODES.join(', ')})`);
    }
    const deathChanged = next.deathCompaction !== this.kernels.deathCompaction;
    const forceChanged = next.forceWorkgroupSize !== this.kernels.forceWorkgroupSize || next.forceKernel !== this.kernels.forceKernel;
    const previousForceKernel = this.kernels.forceKernel;
    this.kernels = next;
    // Before createPipelines() has run, the pipelines are simply created with the new options.
    if (deathChanged && this.deathCompactionPipeline) this.buildDeathCompactionPipeline(true);
    if (forceChanged && this.forcePipeline) {
      const familyChanged = (next.forceKernel === 'linked-list') !== (previousForceKernel === 'linked-list');
      // A different bind group layout invalidates every cached bind group that references the force layout.
      if (familyChanged) this.invalidateBindGroupCache();
      this.buildForcePipeline(!familyChanged);
    }
  }

  public getConfig(): MFMConfig {
    return this.config;
  }

  /** Phase 20: see `topologyEpoch`. Also changes whenever the PopulationState object itself is replaced. */
  public getTopologyEpoch(): number {
    return this.topologyEpoch;
  }

  public getPopulation(): PopulationState {
    return this.population;
  }

  public setConfig(config: MFMConfig): void {
    this.config = config;
    this.validateConfiguration();
    this.populationDirty = true;
  }

  public injectInput(value: number): void {
    this.pendingInputSignal = Math.max(0, Math.min(1, value));
  }

  public setGlobalError(error: number): void {
    this.pendingError = Math.max(0, Math.min(1, error));
  }

  /** Execute one complete MFM v3 transition using its own command submission. */
  private async stepUnsafe(): Promise<PopulationState> {
    const commandEncoder = this.device.createCommandEncoder({
      label: `mfm-v3-step-${this.timestep}`,
    });
    const prof = this.cpuProfiler;
    prof?.inc('encode.commandEncoders');
    const tEncode = prof ? prof.now() : 0;
    const encoded = await this.prepareEncodedStep(commandEncoder);
    prof?.since('stepUnsafe.encodeMs', tEncode);
    const tSubmit = prof ? prof.now() : 0;
    this.device.queue.submit([commandEncoder.finish()]);
    this.gpuProfiler?.afterSubmit();
    prof?.since('stepUnsafe.submitMs', tSubmit);
    prof?.inc('submit.queueSubmits');
    if (!prof) return encoded.finishNormalSync();
    const tFinish = prof.now();
    const result = await encoded.finishNormalSync();
    prof.since('stepUnsafe.finishNormalSyncMs', tFinish);
    return result;
  }

  /**
   * Encode the complete GPU portion of one MFM timestep into a caller-owned
   * command encoder. No queue submission is performed here.
   *
   * The returned render state points at the write-side state buffers produced
   * by this timestep, so a render pass may be encoded after the compute passes
   * in the same command buffer.
   */
  /** Return the current GPU state buffers for direct rendering. */
  public getRenderState(): EncodedStep['renderState'] {
    return {
      positions: this.positionBuffers[this.stateIndex],
      health: this.healthBuffers[this.stateIndex],
      charge: this.chargeBuffers[this.stateIndex],
      role: this.roleBuffer,
      particleCount: this.particleCount,
    };
  }

  /**
   * Read the authoritative GPU charge state for presentation/metrics only.
   *
   * Charge is stored as Uint32 on the GPU (Phase 5F), so metrics must not
   * reinterpret that storage as f32. This is intentionally a narrow 4 B/particle
   * readback and does not synchronize PopulationState or positions/velocities.
   */
  /**
   * Phase 14: opt-in profiling. CPU section timers need no device feature;
   * per-pass GPU timing needs the 'timestamp-query' feature to have been
   * requested when the device was created and degrades to CPU-only otherwise.
   */
  public enableProfiling(
    options: { cpu?: boolean; gpuTimestamps?: boolean } = {},
  ): { cpu: boolean; gpuTimestamps: boolean; gpuTimestampsSupported: boolean } {
    const gpuTimestampsSupported = GpuPassTimestampProfiler.isSupported(this.device);
    if (options.cpu ?? true) {
      this.cpuProfiler ??= new CpuSectionProfiler();
    } else {
      this.cpuProfiler = null;
    }
    if (options.gpuTimestamps && gpuTimestampsSupported) {
      this.gpuProfiler ??= new GpuPassTimestampProfiler(this.device);
    } else if (this.gpuProfiler) {
      this.gpuProfiler.destroy();
      this.gpuProfiler = null;
    }
    return {
      cpu: this.cpuProfiler !== null,
      gpuTimestamps: this.gpuProfiler !== null,
      gpuTimestampsSupported,
    };
  }

  public async disableProfiling(): Promise<void> {
    await this.gpuProfiler?.collect();
    this.gpuProfiler?.destroy();
    this.gpuProfiler = null;
    this.cpuProfiler = null;
  }

  /** The shared CPU section profiler (the web worker records its own sections into it). */
  public getCpuProfiler(): CpuSectionProfiler | null {
    return this.cpuProfiler;
  }

  /** Closes the current CPU profiling window. The caller that drives the step owns this call. */
  public commitProfilingStep(): void {
    this.cpuProfiler?.commitStep();
  }

  /**
   * Phase 19: `timestampWrites` for the render pass the caller records after encodeStep(commandEncoder, { deferTimingResolve: true }),
   * or undefined when GPU timing is off / this step is not being recorded. Consumes a pass slot of the step's query set.
   */
  public renderTimestampWrites(): TimestampWritesDescriptor | undefined {
    return this.timingResolveDeferred ? this.gpuProfiler?.timestampWritesFor('render') : undefined;
  }

  /** Phase 19: resolves the step's timestamp queries (compute passes + the render pass) into the readback slot. Call before queue.submit(). */
  public endStepTiming(commandEncoder: GPUCommandEncoder): void {
    if (!this.timingResolveDeferred) return;
    this.timingResolveDeferred = false;
    this.gpuProfiler?.endStep(commandEncoder);
  }

  /** Must be called right after the queue.submit() of an encoder that went through encodeStep(). */
  public notifyStepSubmitted(): void {
    this.gpuProfiler?.afterSubmit();
  }

  /** Awaits outstanding timestamp readbacks. Call outside timed regions. */
  public async collectGpuTimings(): Promise<void> {
    await this.gpuProfiler?.collect();
  }

  public async resetProfiling(): Promise<void> {
    await this.gpuProfiler?.collect();
    this.gpuProfiler?.reset();
    this.cpuProfiler?.reset();
  }

  public getProfilingReport(): {
    cpu: ReturnType<typeof aggregateCpuRecords>;
    gpu: ReturnType<typeof aggregateGpuSteps>;
    gpuTimestamps: {
      enabled: boolean;
      supported: boolean;
      droppedSteps: number;
      overflowPasses: number;
      readbackErrors: number;
      anomalousPasses: number;
    };
  } {
    const gpu = this.gpuProfiler;
    return {
      cpu: aggregateCpuRecords(this.cpuProfiler?.getRecords() ?? []),
      gpu: aggregateGpuSteps(gpu?.getSteps() ?? []),
      gpuTimestamps: {
        enabled: gpu !== null,
        supported: GpuPassTimestampProfiler.isSupported(this.device),
        droppedSteps: gpu?.droppedSteps ?? 0,
        overflowPasses: gpu?.overflowPasses ?? 0,
        readbackErrors: gpu?.readbackErrors ?? 0,
        anomalousPasses: gpu?.anomalousPasses ?? 0,
      },
    };
  }

  public async readChargeMetrics(): Promise<{
    totalCharge: number;
    inputCharge: number;
    outputCharge: number;
  }> {
    if (!this.initialized || this.particleCount <= 0) {
      return { totalCharge: 0, inputCharge: 0, outputCharge: 0 };
    }

    const prof = this.cpuProfiler;
    const tSubmit = prof ? prof.now() : 0;
    const bytes = this.particleCount * 4;
    const encoder = this.device.createCommandEncoder({ label: 'mfm-charge-metrics-readback' });
    encoder.copyBufferToBuffer(
      this.chargeBuffers[this.stateIndex],
      0,
      this.reproductionStateReadback,
      0,
      bytes,
    );
    this.device.queue.submit([encoder.finish()]);
    prof?.since('metrics.chargeReadback.submitMs', tSubmit);
    const tMap = prof ? prof.now() : 0;
    await this.reproductionStateReadback.mapAsync(MAP_MODE_READ);
    prof?.since('metrics.chargeReadback.mapMs', tMap);
    prof?.inc('metrics.readbackBytes', bytes);

    try {
      const tLoop = prof ? prof.now() : 0;
      const charges = new Uint32Array(
        this.reproductionStateReadback.getMappedRange().slice(0, bytes),
      );
      let totalCharge = 0;
      let inputCharge = 0;
      let outputCharge = 0;

      const roles = this.slotRoles;
      for (let i = 0; i < this.particleCount; i++) {
        const charge = charges[i] >>> 0;
        totalCharge += charge;
        const role = roles[i];
        if (role === 1) inputCharge += charge;
        else if (role === 2) outputCharge += charge;
      }

      prof?.since('metrics.chargeReadback.cpuLoopMs', tLoop);
      return { totalCharge, inputCharge, outputCharge };
    } finally {
      this.reproductionStateReadback.unmap();
    }
  }


  /**
   * Phase 15: every per-frame population metric in ONE GPU round trip.
   *
   * Phase 14 obtained these through two independent systems: MetricsReducer copied
   * health+charge per particle (8 B/particle, one submit + one wait, plus a result buffer,
   * a staging buffer, a count buffer and a bind group created per call) only to sum health
   * on the CPU, and readChargeMetrics() then read the charge array again (4 B/particle, a
   * second submit + wait). This reads each array exactly once (8 B/particle), one submit,
   * one wait, into a dedicated persistent staging buffer.
   *
   * Numerics are unchanged: sums are accumulated in JS doubles over the same f32/u32
   * values, in slot order, exactly as before.
   */
  public async readPopulationMetrics(): Promise<{
    count: number;
    healthSum: number;
    totalCharge: number;
    inputCharge: number;
    outputCharge: number;
  }> {
    if (!this.initialized || this.particleCount <= 0) {
      return { count: 0, healthSum: 0, totalCharge: 0, inputCharge: 0, outputCharge: 0 };
    }

    const prof = this.cpuProfiler;
    const count = this.particleCount;
    const roles = this.slotRoles;
    const bytes = count * 4;

    const tSubmit = prof ? prof.now() : 0;
    const encoder = this.device.createCommandEncoder({ label: 'mfm-population-metrics-readback' });
    encoder.copyBufferToBuffer(this.chargeBuffers[this.stateIndex], 0, this.metricsStateReadback, 0, bytes);
    encoder.copyBufferToBuffer(this.healthBuffers[this.stateIndex], 0, this.metricsStateReadback, bytes, bytes);
    this.device.queue.submit([encoder.finish()]);
    prof?.since('metrics.populationReadback.submitMs', tSubmit);

    const tMap = prof ? prof.now() : 0;
    await this.metricsStateReadback.mapAsync(MAP_MODE_READ, 0, bytes * 2);
    prof?.since('metrics.populationReadback.mapMs', tMap);
    prof?.inc('metrics.readbackBytes', bytes * 2);
    prof?.inc('metrics.populationReadbacks');

    try {
      const tLoop = prof ? prof.now() : 0;
      const mapped = this.metricsStateReadback.getMappedRange(0, bytes * 2);
      const charges = new Uint32Array(mapped, 0, count);
      const healths = new Float32Array(mapped, bytes, count);
      let healthSum = 0;
      let totalCharge = 0;
      let inputCharge = 0;
      let outputCharge = 0;
      for (let i = 0; i < count; i++) {
        const charge = charges[i] >>> 0;
        healthSum += healths[i];
        totalCharge += charge;
        const role = roles[i];
        if (role === 1) inputCharge += charge;
        else if (role === 2) outputCharge += charge;
      }
      prof?.since('metrics.populationReadback.cpuLoopMs', tLoop);
      return { count, healthSum, totalCharge, inputCharge, outputCharge };
    } finally {
      this.metricsStateReadback.unmap();
    }
  }

  /**
   * Encodes one step into `commandEncoder`.
   * Phase 19: with `deferTimingResolve`, the GPU timestamp queries are NOT resolved at the end of the step, so the caller can
   * record a render pass into the same encoder with `renderTimestampWrites()` and then call `endStepTiming(commandEncoder)`
   * (before `queue.submit`). Without the option the behaviour is unchanged.
   */
  public async encodeStep(commandEncoder: GPUCommandEncoder, options: { deferTimingResolve?: boolean } = {}): Promise<EncodedStep> {
    if (this.pipe.length > 0) await this.drainPipeline(); // Phase 20: the caller-owned-encoder path is never pipelined
    if (this.stepInFlight || this.encodedStepPending) {
      throw new Error('Cannot encode a WebGPU step while another step is in flight');
    }

    // Reserve the step before the first await in prepareEncodedStep(). Worker
    // messages are independently asynchronous, so an inspect/grab/backend
    // message can arrive while the render path is waiting for GPU completion.
    // The reservation makes exceptional sync wait for the encoded step instead
    // of mapping one of its staging buffers concurrently.
    this.encodedStepPending = true;
    this.timingResolveDeferred = options.deferTimingResolve === true;

    let resolveStep!: (value: PopulationState) => void;
    let rejectStep!: (reason?: unknown) => void;
    const trackedStep = new Promise<PopulationState>((resolve, reject) => {
      resolveStep = resolve;
      rejectStep = reject;
    });
    this.stepInFlight = trackedStep;

    try {
      const encoded = await this.prepareEncodedStep(commandEncoder);
      let finishPromise: Promise<PopulationState> | null = null;

      const finishNormalSync = (): Promise<PopulationState> => {
        // An EncodedStep may be observed by more than one worker-side path.
        // Mapping a GPUBuffer twice before unmap() is illegal in WebGPU, so make
        // completion idempotent and share the same promise with every caller.
        if (!finishPromise) {
          finishPromise = encoded.finishNormalSync();
          finishPromise.then(
            (value) => {
              this.encodedStepPending = false;
              if (this.stepInFlight === trackedStep) this.stepInFlight = null;
              resolveStep(value);
            },
            (error) => {
              this.encodedStepPending = false;
              if (this.stepInFlight === trackedStep) this.stepInFlight = null;
              rejectStep(error);
            },
          );
        }
        return finishPromise;
      };

      return {
        renderState: {
          positions: this.positionBuffers[encoded.stateWrite],
          health: this.healthBuffers[encoded.stateWrite],
          charge: this.chargeBuffers[encoded.stateWrite],
          role: this.roleBuffer,
          particleCount: this.particleCount,
        },
        finishNormalSync,
        finish: finishNormalSync,
      };
    } catch (error) {
      this.encodedStepPending = false;
      if (this.stepInFlight === trackedStep) this.stepInFlight = null;
      rejectStep(error);
      throw error;
    }
  }

  private async prepareEncodedStep(commandEncoder: GPUCommandEncoder, pipe?: PipelinedContext): Promise<EncodedStepInternal> {

    if (!this.initialized) {
      await this.init();
    }

    this.validateConfiguration();

    const prof = this.cpuProfiler;
    const tDirty = prof ? prof.now() : 0;
    if (this.populationDirty) {
      if (pipe && pipe.ahead > 0) throw new Error('internal error: a speculative step cannot recreate GPU buffers');
      prof?.inc('prepare.populationDirtyResyncs');
      // Phase 5F: charge is GPU-authoritative. A configuration change can
      // recreate buffers, so first capture the current GPU dynamic state into
      // PopulationState; otherwise uploadPopulationToGpu() would re-seed the
      // new charge buffers from the intentionally stale CPU charge mirror.
      if (this.initialized && this.particleCount > 0) {
        await this.syncFullCpuStateForSnapshot(this.takeSnapshot(), 'configChange');
      }
      await this.recreateGpuBuffers(false);
      this.populationDirty = false;
      prof?.since('prepare.dirtyResyncMs', tDirty);
    }

    // Phase 4.2: the CPU slot mapping is persistent. It is rebuilt only when
    // topology changes or when the whole PopulationState is replaced.
    this.ensurePopulationFitsCapacity();

    if (this.particleCount === 0) {
      if (pipe) throw new Error('internal error: pipelined stepping needs a non-empty population');
      const emptyInputSignal = this.pendingInputSignal ?? 0;
      // CPU reference consumes one-shot external input/error even when the
      // current population is empty. Keep the GPU path temporally identical.
      this.pendingInputSignal = null;
      this.pendingError = null;
      return {
        stateWrite: this.stateIndex,
        incomingWrite: this.incomingIndex,
        eventWrite: this.eventIndex,
        snapshotLength: 0,
        getSnapshot: () => [],
        inputSignal: emptyInputSignal,
        inputSlot: -1,
        previousIncomingCharges: new Map(this.incomingChargeMap),
        previousIncomingSenders: new Map<string, Set<string>>(),
        // The empty-population fast path cannot produce reproduction candidates.
        reproductionCompactionEnabled: false,
        finishNormalSync: (() => {
          let finishPromise: Promise<PopulationState> | null = null;
          return () => {
            if (!finishPromise) {
              finishPromise = Promise.resolve(this.population).then((population) => {
                this.timestep++;
                return population;
              });
            }
            return finishPromise;
          };
        })(),
      };
    }

    const tSnapshot = prof ? prof.now() : 0;
    const inputSignal = this.pendingInputSignal ?? 0;
    let snapshotMemo: Snapshot[] | null = null;
    const getSnapshot = (): Snapshot[] => (snapshotMemo ??= this.takeSnapshot());
    let snapshotLength: number;
    let inputSlot: number;
    let previousIncomingCharges: Map<string, number>;
    let previousIncomingSenders: Map<string, Set<string>>;
    if (this.orchestration.quietFastPath) {
      // Phase 20. A quiet step (no death, no reproduction candidate; the overwhelming majority) only needs the snapshot LENGTH and the
      // input slot. Both are O(1)/early-exit here; the full O(N) Snapshot is built by finishNormalSync only if the step turns out non-quiet.
      // (The population is not mutated between encodeStep() and finishNormalSync(): the stepper rejects overlapping steps.)
      const particles = this.population.particles;
      const genomes = this.population.genomes;
      snapshotLength = genomes.size === particles.size ? particles.size : getSnapshot().length;
      inputSlot = 0;
      let index = 0;
      for (const [id, state] of particles) {
        if (genomes.size !== particles.size && !genomes.has(id)) continue; // same skipping rule as takeSnapshot()
        if (state.role === 'input') {
          inputSlot = index;
          break;
        }
        index++;
      }
      // previousIncomingCharges is never read; previousIncomingSenders is only read (and copied) by the non-quiet path, and the maps
      // (and the Sets inside them) are replaced, never mutated in place (audit: every write is `this.incoming*Map = ...`).
      previousIncomingCharges = this.incomingChargeMap;
      previousIncomingSenders = this.incomingSendersMap;
    } else {
      const snapshot = getSnapshot();
      snapshotLength = snapshot.length;
      inputSlot = this.findInputSlot(snapshot);
      previousIncomingCharges = new Map(this.incomingChargeMap);
      previousIncomingSenders = new Map<string, Set<string>>();
      for (const [id, senders] of this.incomingSendersMap) {
        previousIncomingSenders.set(id, new Set(senders));
      }
    }
    prof?.since('encode.snapshotMs', tSnapshot);

    // Phase 5F: pressure is now computed on the GPU from Q_n and role.
    // globalPressure carries an explicit error override when set; -1 means
    // "derive error from output charge". This preserves the CPU reference
    // temporal semantics while removing the O(N) charge readback.
    const pressureOverride = this.pendingError;
    this.pendingError = null;
    this.pendingInputSignal = null;
    const pressureInput = pressureOverride ?? -1;

    const tParams = prof ? prof.now() : 0;
    // Phase 20: a pipelined step encoded behind `ahead` uncommitted steps runs at timestep + ahead (RNG/hash input) on ping-pong indices flipped `ahead` times.
    this.encodeTimestepAhead = pipe ? pipe.ahead : 0;
    this.writeStepParams(inputSignal, inputSlot, pressureInput);
    this.encodeTimestepAhead = 0;
    prof?.since('encode.writeParamsMs', tParams);

    const flip = pipe ? pipe.ahead & 1 : 0;
    const stateRead = this.stateIndex ^ flip;
    const stateWrite = 1 - stateRead;
    const incomingRead = this.incomingIndex ^ flip;
    const incomingWrite = 1 - incomingRead;
    const eventWrite = 1 - (this.eventIndex ^ flip);
    const generation = this.bufferGeneration;
    if (pipe) this.ensurePipelineResources();
    const pipeSummaryBuffer = pipe ? this.pipeSummary[pipe.slot] : null;

    // Phase 5G: health is GPU-authoritative. Population events are compacted on GPU and only their
    // small slot lists are read back. (Phase 16: evaluated here so the bind-group set knows whether it needs
    // the reproduction-compaction group; the value is a pure function of config and particleCount.)
    const reproductionCompactionEnabled =
      this.config.mating_probability > 0 && this.particleCount < this.config.Nmax;

    const tPasses = prof ? prof.now() : 0;
    // Phase 20: per-pass GPU timestamps assume one step in flight; they are unavailable while pipelined.
    this.encodingPipelined = pipe !== undefined;
    if (!pipe) this.gpuProfiler?.beginStep();
    this.encPasses = 0;
    this.encClears = 0;
    this.encCopies = 0;
    // Phase 16: all bind groups of this step, created once per (stateRead, incomingRead, eventWrite)
    // when the cache is on. Bind-group creation time is still inside 'encode.passesMs' (as in Phase 15).
    const bg = this.acquireStepBindGroups(
      stateRead,
      incomingRead,
      eventWrite,
      reproductionCompactionEnabled,
    );

    if (pipe) {
      // Phase 20: the GPU halt flag, as of the start of THIS step, becomes params.halted in every Params block and the last word of this step's
      // summary slot. (Copies are queue-ordered after the CPU's writeBuffer of this step's params and after every earlier submission.)
      for (let rank = 0; rank < this.paramBlocks; rank++) {
        commandEncoder.copyBufferToBuffer(this.haltBuffer, 0, this.paramsBuffer, rank * UNIFORM_DYNAMIC_STRIDE + PARAMS_HALTED_OFFSET, 4);
      }
      commandEncoder.copyBufferToBuffer(this.haltBuffer, 0, pipeSummaryBuffer!, PIPE_SUMMARY_HALTED_OFFSET, 4);
      this.encCopies += this.paramBlocks + 1;
    }

    // Reset only buffers that will receive next-step writes.
    this.encClears += 3;
    commandEncoder.clearBuffer(this.incomingChargeBuffers[incomingWrite]);
    commandEncoder.clearBuffer(this.senderCountBuffers[eventWrite]);
    commandEncoder.clearBuffer(this.selectedCountBuffer);

    // -----------------------------------------------------------------------
    // Phase 5 optimization — build a toroidal uniform spatial grid before
    // communication and force queries. The grid is rebuilt from the same n
    // snapshot and is therefore only an acceleration structure; it does not
    // alter the mathematical neighborhood definition.
    // -----------------------------------------------------------------------
    this.dispatchCompute(
      commandEncoder,
      this.gridClearPipeline,
      bg.gridClear,
      0,
      Math.ceil((this.gridCountX * this.gridCountY) / WORKGROUP_SIZE),
    );
    this.dispatchCompute(commandEncoder, this.gridBuildPipeline, bg.gridBuild);

    // -----------------------------------------------------------------------
    // Phase 1/2 — Charge processing + decay/cap
    // -----------------------------------------------------------------------
    this.dispatchCompute(commandEncoder, this.chargeProcessPipeline, bg.chargeProcess);

    this.dispatchCompute(commandEncoder, this.chargeFinalizePipeline, bg.chargeFinalize);

    // Phase 5F: compute global pressure entirely on the GPU from the pre-step
    // charge snapshot Q_n. This pass deliberately reads stateRead rather than
    // stateWrite, matching MfmCpuReference.computePressure(snapshot).
    this.dispatchCompute(commandEncoder, this.pressurePipeline, bg.pressure, 0, 1);

    // -----------------------------------------------------------------------
    // Phase 3 — Communication target selection, without replacement.
    // Each selection rank is a separate dispatch. The previous ranks have
    // completed before the next rank reads them, eliminating race conditions.
    // -----------------------------------------------------------------------
    for (let rank = 0; rank < this.maxK; rank++) {
      this.dispatchCompute(
        commandEncoder,
        this.communicationSelectPipeline,
        bg.select,
        rank * UNIFORM_DYNAMIC_STRIDE,
      );
    }

    // -----------------------------------------------------------------------
    // Phase 3c — Charge transmission into the next-step reception buffer and
    // append exact source->target event records.
    // -----------------------------------------------------------------------
    for (let rank = 0; rank < this.maxK; rank++) {
      this.dispatchCompute(
        commandEncoder,
        this.communicationTransmitPipeline,
        bg.transmit,
        rank * UNIFORM_DYNAMIC_STRIDE,
      );
    }

    // -----------------------------------------------------------------------
    // Phase 4 — Local cycle success and history event creation.
    // -----------------------------------------------------------------------
    this.dispatchCompute(commandEncoder, this.localSuccessPipeline, bg.localSuccess);

    // -----------------------------------------------------------------------
    // Phase 5 — Health / global pressure.
    // -----------------------------------------------------------------------
    this.dispatchCompute(commandEncoder, this.healthUpdatePipeline, bg.healthUpdate);

    // -----------------------------------------------------------------------
    // Phase 6 — Charge-dependent spatial range + asymmetric force.
    // Force deliberately reads q_i^n from stateRead, not q_i^{n+1}.
    // -----------------------------------------------------------------------

    // // Force is computed from the current snapshot, not the next-step charges, so that
    // // the GPU result is mathematically equivalent to the CPU reference.

    // Phase 18: cell-sorted layout for the sorted force kernels (positions/velocities of stateRead, i.e. the same snapshot
    // the linked-list grid was built from). cellCount must be zero before sortCount; sortScan re-zeroes it as the scatter cursor.
    if (this.kernels.forceKernel !== 'linked-list') {
      const sort = bg.sort;
      if (!sort || !this.sortCountPipeline || !this.sortScanPipeline || !this.sortScatterPipeline) {
        throw new Error('internal error: cell-sorted force passes were not prepared');
      }
      this.encClears++;
      commandEncoder.clearBuffer(this.cellCountBuffer);
      this.dispatchCompute(commandEncoder, this.sortCountPipeline, sort.count);
      this.dispatchCompute(commandEncoder, this.sortScanPipeline, sort.scan, 0, 1);
      this.dispatchCompute(commandEncoder, this.sortScatterPipeline, sort.scatter);
    }
    this.dispatchCompute(
      commandEncoder,
      this.forcePipeline,
      bg.force,
      0,
      Math.ceil(this.particleCount / this.kernels.forceWorkgroupSize),
    );

    // Force all-pairs is a fallback for small populations where the grid is not used.
    // this.dispatchCompute(commandEncoder, this.forceAllPairsPipeline,
    //   this.createForceAllPairsBindGroup(stateRead),
    // );

    // -----------------------------------------------------------------------
    // Phase 7 — Semi-implicit Euler mechanics.
    // -----------------------------------------------------------------------
    this.dispatchCompute(commandEncoder, this.mechanicsPipeline, bg.mechanics);

    // (reproductionCompactionEnabled is computed above, before the bind groups are acquired.)
    this.encClears++;
    commandEncoder.clearBuffer(this.deathCandidateCountBuffer);
    this.dispatchCompute(
      commandEncoder,
      this.deathCompactionPipeline,
      bg.deathCompaction,
      0,
      1,
    );

    if (reproductionCompactionEnabled) {
      const reproductionGroup = bg.reproductionCompaction;
      if (!reproductionGroup) throw new Error('internal error: reproduction compaction bind group was not prepared');
      this.encClears++;
      commandEncoder.clearBuffer(this.reproductionCandidateCountBuffer);
      this.dispatchCompute(commandEncoder, this.reproductionCompactionPipeline, reproductionGroup, 0, 1);
    }

    // Phase 5G: NORMAL synchronization has no per-particle dynamic-state
    // readback. Death/reproduction slot lists are consumed below as compact
    // population-event data.

    // Phase 15: every count the CPU needs to decide what (if anything) to read next is
    // copied in THIS command submission into one 12-byte staging buffer:
    //   [0] death candidate count  [4] reproduction candidate count  [8] communication event count
    // A quiet timestep therefore costs exactly one awaited mapAsync and no additional queue
    // submission. (Phase 14 issued a separate submit + mapAsync per count.) The reproduction
    // count is only valid, and only read, when reproductionCompactionEnabled.
    const summaryTarget = pipeSummaryBuffer ?? this.eventSummaryReadback;
    if (pipe) {
      const groups = this.haltUpdateGroups;
      if (!this.haltUpdatePipeline || !groups) throw new Error('internal error: pipeline resources were not prepared');
      this.dispatchCompute(
        commandEncoder,
        this.haltUpdatePipeline,
        reproductionCompactionEnabled ? groups.withCandidates : groups.withoutCandidates,
        0,
        1,
      );
    }
    commandEncoder.copyBufferToBuffer(this.deathCandidateCountBuffer, 0, summaryTarget, EVENT_SUMMARY_DEATH_OFFSET, 4);
    this.encCopies++;
    if (reproductionCompactionEnabled) {
      commandEncoder.copyBufferToBuffer(this.reproductionCandidateCountBuffer, 0, summaryTarget, EVENT_SUMMARY_CANDIDATE_OFFSET, 4);
      this.encCopies++;
    }
    commandEncoder.copyBufferToBuffer(this.senderCountBuffers[eventWrite], 0, summaryTarget, EVENT_SUMMARY_EVENT_OFFSET, 4);
    this.encCopies++;
    this.encodingPipelined = false;
    if (!this.timingResolveDeferred && !pipe) this.gpuProfiler?.endStep(commandEncoder);
    prof?.since('encode.passesMs', tPasses);
    if (prof) {
      // Phase 16: what this step encoded (one compute pass per dispatch). bindGroupsCreated / cache hits are
      // recorded where they happen. Device-boundary ground truth comes from the software-device harness.
      prof.inc('encode.computePasses', this.encPasses);
      prof.inc('encode.dispatches', this.encPasses);
      prof.inc('encode.clearBuffers', this.encClears);
      prof.inc('encode.copyBuffers', this.encCopies);
    }

    let finishPromise: Promise<PopulationState> | null = null;

    return {
      stateWrite,
      incomingWrite,
      eventWrite,
      snapshotLength,
      getSnapshot,
      inputSignal,
      inputSlot,
      previousIncomingCharges,
      previousIncomingSenders,
      reproductionCompactionEnabled,
      finishNormalSync: () => {
        if (finishPromise) return finishPromise;
        finishPromise = (async () => {
        // Phase 5G: read only compact population-event data. No health array
        // is mapped back to the CPU during a normal timestep.
        //
        // Phase 15: at most TWO sequential GPU round trips, regardless of how many
        // event kinds occurred:
        //   1. the 12-byte count summary (always; copied by the step submission itself);
        //   2. only if a death or reproduction candidate exists: ONE submission that copies
        //      death slots, candidate slots, candidate geometry and communication events, and
        //      whose staging buffers are mapped concurrently.
        let reproductionGeometry: Float32Array<ArrayBufferLike> = new Float32Array(0);
        let reproductionCandidateSlots: Uint32Array<ArrayBufferLike> = new Uint32Array(0);
        let deathCandidateSlots: Uint32Array<ArrayBufferLike> = new Uint32Array(0);

        const tSummary = prof ? prof.now() : 0;
        if (pipe && generation !== this.bufferGeneration) {
          // Phase 20: the buffers this step used were destroyed (a non-quiet step before it recreated them): nothing to read, nothing to commit.
          pipe.outcome.discarded = true;
          return this.population;
        }
        const summary: { deathCount: number; candidateCount: number; eventCount: number; halted?: boolean } = pipe
          ? await this.readPipelinedSummary(pipeSummaryBuffer!, reproductionCompactionEnabled)
          : await this.readEventSummary(reproductionCompactionEnabled);
        if (pipe && summary.halted) {
          // Phase 20: this step ran behind a halting (non-quiet) step: every kernel returned immediately. Nothing to commit; it is re-submitted.
          pipe.outcome.discarded = true;
          return this.population;
        }
        if (prof) {
          prof.since('sync.compactReadbackMs', tSummary);
          prof.inc('readback.roundTrips');
          prof.inc('readback.bytes', EVENT_SUMMARY_BYTES);
        }

        const deathCount = Math.min(summary.deathCount, snapshotLength);
        const candidateCount = reproductionCompactionEnabled
          ? Math.min(summary.candidateCount, snapshotLength)
          : 0;

        // Communication event records are only needed by the CPU when a
        // population event can force a topology rebuild or when reproduction
        // candidates exist. Otherwise the GPU incoming buffers remain the
        // authoritative next-step communication state.
        const needsEventReadback = deathCount > 0 || candidateCount > 0;
        if (pipe) pipe.outcome.nonQuiet = needsEventReadback;
        let eventsReadback: { senders: Uint32Array; targets: Uint32Array } = {
          senders: new Uint32Array(0),
          targets: new Uint32Array(0),
        };
        if (needsEventReadback) {
          const tEvents = prof ? prof.now() : 0;
          const payload = await this.readPopulationEventPayload(
            deathCount,
            candidateCount,
            summary.eventCount,
            eventWrite,
          );
          deathCandidateSlots = payload.deathSlots;
          reproductionCandidateSlots = payload.candidateSlots;
          reproductionGeometry = payload.geometry;
          eventsReadback = { senders: payload.eventSenders, targets: payload.eventTargets };
          if (prof) {
            prof.since('sync.eventReadbackMs', tEvents);
            prof.inc('sync.eventReadbacks');
            prof.inc('readback.roundTrips');
            prof.inc('readback.bytes', payload.bytes);
          }
        }

        // The GPU writes now represent P_{n+1} for surviving current particles.
        this.stateIndex = stateWrite;
        this.incomingIndex = incomingWrite;
        this.eventIndex = eventWrite;

        // Build exact current-step event maps from the GPU selection result.
        // For reproduction, success must match the GPU successful[] predicate:
        // received && active && hasTargets. The compacted candidate list is the
        // authoritative subset after additionally applying the pre-step health
        // threshold and post-step survival.
        const tEventMap = prof ? prof.now() : 0;
        const nextIncomingCharges = new Map<string, number>();
        const nextIncomingSenders = new Map<string, Set<string>>();
        const reproductionSuccessIds = new Set<string>();
        for (const slot of reproductionCandidateSlots) {
          if (slot < this.particleCount) reproductionSuccessIds.add(this.slotToId[slot]);
        }

        // Phase 15: Phase 14 also built a per-particle `events` map (an object and a Set per
        // particle, every step). It was written here and never read anywhere, so it is gone.
        // The compacted GPU candidate set above is the authoritative reproduction-success set.

        for (let eventIndex = 0; eventIndex < eventsReadback.senders.length; eventIndex++) {
          const senderSlot = eventsReadback.senders[eventIndex];
          const targetSlot = eventsReadback.targets[eventIndex];

          if (
            senderSlot >= this.particleCount ||
            targetSlot >= this.particleCount
          ) {
            continue;
          }

          const senderId = this.slotToId[senderSlot];
          const targetId = this.slotToId[targetSlot];

          const senderGenome = this.population.genomes.get(senderId);

          if (senderGenome) {
            const transmittedCharge = this.computeQOut(senderGenome);

            if (transmittedCharge > 0) {
              const previousCharge = nextIncomingCharges.get(targetId) ?? 0;

              // WebGPU atomicAdd on u32 wraps modulo 2^32.
              const nextCharge =
                (previousCharge + transmittedCharge) >>> 0;

              nextIncomingCharges.set(targetId, nextCharge);
            }
          }

          const senders = nextIncomingSenders.get(targetId) ?? new Set<string>();
          senders.add(senderId);
          nextIncomingSenders.set(targetId, senders);
        }
        if (prof) {
          prof.since('sync.eventMapBuildMs', tEventMap);
          // Phase 15: counts the communication events actually processed (Phase 14: particleCount).
          prof.inc('sync.eventMapEntries', eventsReadback.senders.length);
        }

        // -----------------------------------------------------------------------
        // Phase 8 — Population dynamics. Death/reproduction remains on CPU.
        // Phase 4.1 keeps the existing PopulationState, ParticleState and Genome
        // instances for survivors and mutates only their timestep fields in place.
        // This removes the per-step allocation of nextStates/nextGenomes and the
        // replacement PopulationState while preserving the pre-step snapshot for
        // reproduction semantics.
        // -----------------------------------------------------------------------
        const tEvolution = prof ? prof.now() : 0;
        // Phase 15: with no death and no reproduction candidate the callback has nothing to do:
        // nobody dies, createOffspring() finds no candidates (and consumes no RNG), and sender
        // sets are only rewritten when event data was read back. Phase 14 still walked all N
        // particles here every step.
        if (needsEventReadback) this.topologyEpoch++; // Phase 20: the population is about to change
        const snapshot = needsEventReadback ? getSnapshot() : EMPTY_SNAPSHOT;
        const evolutionResult: EvolutionResult = !needsEventReadback
          ? { deadCount: 0, survivingIds: new Set<string>(), offspring: [] }
          : await this.withMappedEvolutionState((readback): EvolutionResult => {
          const deadSlots = new Set<number>(deathCandidateSlots);
          const survivingIds = new Set<string>();
          for (let i = 0; i < snapshot.length; i++) {
            if (!deadSlots.has(i)) survivingIds.add(snapshot[i].id);
          }
          const deadCount = deathCandidateSlots.length;

          // Reproduction runs before survivor mutation. Geometry is applied by
          // the exact GPU candidate slot list rather than reconstructing the
          // candidate predicate on the CPU.
          for (let candidateIndex = 0; candidateIndex < reproductionCandidateSlots.length; candidateIndex++) {
            const slot = reproductionCandidateSlots[candidateIndex];
            if (slot >= snapshot.length) continue;
            const item = snapshot[slot];
            const base = candidateIndex * 4;
            item.state.position.x = reproductionGeometry[base];
            item.state.position.y = reproductionGeometry[base + 1];
            item.state.velocity.x = reproductionGeometry[base + 2];
            item.state.velocity.y = reproductionGeometry[base + 3];
          }
          const offspring = this.createOffspring(snapshot, survivingIds, reproductionSuccessIds);

          // Consume mapped GPU memory directly; there is no intermediate CPU
          // ArrayBuffer or per-field copy in Phase 5F. Phase 5G-B makes this
          // mutation an explicit NORMAL synchronization boundary. Position and
          // velocity remain GPU-authoritative except for the conditional
          // reproduction geometry sync and explicit full sync.
          this.applyDynamicStateToPopulation(readback, 'normal', {
            survivingIds,
            ...(needsEventReadback
              ? { previousIncomingSenders, nextIncomingSenders }
              : {}),
            snapshot,
          });

          return { deadCount, survivingIds, offspring };
        });
        prof?.since('sync.evolutionCallbackMs', tEvolution);

        const populationStructureChanged =
          evolutionResult.deadCount > 0 || evolutionResult.offspring.length > 0;
        if (prof) {
          prof.inc('population.deaths', evolutionResult.deadCount);
          prof.inc('population.births', evolutionResult.offspring.length);
          if (populationStructureChanged) prof.inc('population.structureChanged');
        }

        const tPopulationUpdate = prof ? prof.now() : 0;
        // Remove dead particles from the persistent PopulationState.
        if (evolutionResult.deadCount > 0) {
          for (const item of snapshot) {
            if (!evolutionResult.survivingIds.has(item.id)) {
              this.population.particles.delete(item.id);
              this.population.genomes.delete(item.id);
            }
          }
        }

        // Add only genuinely new offspring. No survivor Genome is cloned.
        for (const child of evolutionResult.offspring) {
          this.population.addParticle(child.id, child.genome, child.state);
        }
        prof?.since('sync.populationUpdateMs', tPopulationUpdate);

        if (needsEventReadback) {
          this.incomingChargeMap = nextIncomingCharges;
          this.incomingSendersMap = nextIncomingSenders;
        }

        // Phase 15 — how do the GPU buffers follow the membership change?
        //
        // 5G-C: normal sync does not copy position/velocity into PopulationState, so a CPU -> GPU
        // REBUILD (buffer shape change) must first capture the full GPU dynamic state while the
        // old slot mapping still matches the GPU buffers; otherwise it would upload stale data
        // and freeze/reset particles. That readback is now confined to the shape-change fallback.
        // In the common case (same shape) the GPU permutes its own state in place and nothing
        // dynamic crosses the CPU/GPU boundary. The decision needs the updated CPU population,
        // which is why the CPU topology edit above runs first; survivors are still found by id
        // and the stale entries of dead particles are skipped, so the order is behaviourally
        // equivalent for the fallback.
        let restructurePlan: RestructurePlan | null = null;
        if (populationStructureChanged) {
          const oldParticleCount = this.particleCount;
          const inPlaceAllowed = snapshot.length === oldParticleCount && !this.gpuShapeChangeRequired();
          if (inPlaceAllowed) {
            const dead = new Set<number>();
            for (const slot of deathCandidateSlots) if (slot < oldParticleCount) dead.add(slot);
            restructurePlan = {
              oldParticleCount,
              deadSlots: [...dead].sort((x, y) => x - y),
              offspringCount: evolutionResult.offspring.length,
            };
          } else {
            await this.syncFullCpuStateForSnapshot(snapshot, 'shapeChange');
          }

          const tSlots = prof ? prof.now() : 0;
          this.refreshCpuSlotMapping();
          prof?.since('sync.slotMappingMs', tSlots);
        }
        const tResync = prof ? prof.now() : 0;
        await this.resyncAfterPopulationStep(populationStructureChanged, restructurePlan);
        if (populationStructureChanged) prof?.since('sync.resyncMs', tResync);

        this.timestep++;
        return this.population;
      })();
      return finishPromise;
      },
    };
  }

  public step(): Promise<PopulationState> {
    if (this.stepInFlight) {
      return this.stepInFlight;
    }

    // Phase 20: pipelineDepth 2 keeps a step in flight across calls; a depth change back to 1 first drains it.
    const inFlight =
      this.orchestration.pipelineDepth > 1
        ? this.stepPipelined()
        : this.pipe.length > 0
          ? this.drainPipeline().then(() => this.stepUnsafe())
          : this.stepUnsafe();
    let tracked: Promise<PopulationState>;
    // eslint-disable-next-line prefer-const
    tracked = inFlight.then(
      (value) => {
        if (this.stepInFlight === tracked) {
          this.stepInFlight = null;
        }
        return value;
      },
      (error) => {
        if (this.stepInFlight === tracked) {
          this.stepInFlight = null;
        }
        throw error;
      },
    );
    this.stepInFlight = tracked;
    return tracked;
  }

  public async run(steps: number): Promise<PopulationState[]> {
    const trajectory: PopulationState[] = [];
    for (let i = 0; i < steps; i++) trajectory.push(await this.step());
    return trajectory;
  }

  /**
   * Checkpoint state. The shape intentionally mirrors MfmCpuReference.getState
   * and includes one extra internal counter only where required by the GPU
   * implementation.
   */
  public getState(): Record<string, unknown> {
    return {
      timestep: this.timestep,
      population: this.population.toJSON(),
      rngState: this.rng.getState(),
      pendingInputSignal: this.pendingInputSignal,
      pendingError: this.pendingError,
      incomingCharges: Array.from(this.incomingChargeMap.entries()),
      incomingSenders: Array.from(this.incomingSendersMap.entries()).map(([id, senders]) => [
        id,
        Array.from(senders),
      ]),
    };
  }

  public async setState(state: Record<string, unknown>): Promise<void> {
    await this.drainPipeline(); // Phase 20
    this.timestep = typeof state.timestep === 'number' ? state.timestep : 0;
    this.population = PopulationState.fromJSON(state.population);
    this.topologyEpoch++;
    if (typeof state.rngState === 'number') this.rng.setState(state.rngState);
    this.pendingInputSignal = typeof state.pendingInputSignal === 'number' ? state.pendingInputSignal : null;
    this.pendingError = typeof state.pendingError === 'number' ? state.pendingError : null;

    this.incomingChargeMap = new Map(
      Array.isArray(state.incomingCharges)
        ? state.incomingCharges.filter(
            (entry): entry is [string, number] =>
              Array.isArray(entry) &&
              typeof entry[0] === 'string' &&
              typeof entry[1] === 'number',
          )
        : [],
    );

    this.incomingSendersMap = new Map(
      Array.isArray(state.incomingSenders)
        ? state.incomingSenders
            .filter(
              (entry): entry is [string, string[]] =>
                Array.isArray(entry) &&
                typeof entry[0] === 'string' &&
                Array.isArray(entry[1]),
            )
            .map(([id, senders]) => [
              id,
              new Set(senders.filter((sender): sender is string => typeof sender === 'string')),
            ])
        : [],
    );

    this.refreshCpuSlotMapping();
    if (this.initialized) {
      await this.recreateGpuBuffers(false);
    } else {
      this.populationDirty = true;
    }
  }

  public async saveState(): Promise<Record<string, unknown>> {
    // Checkpointing is an exceptional synchronization boundary: make the CPU
    // population authoritative before serializing it.
    await this.syncFullCpuState();
    return this.getState();
  }

  public async loadState(state: Record<string, unknown>): Promise<void> {
    await this.setState(state);
  }

  /** Return transient q_out for the latest GPU step if needed by diagnostics/UI. */
  public async readLatestProcessedOutputCharge(): Promise<Uint32Array> {
    // Phase 20: qOutBuffer is overwritten by every executed step, so a speculative step in flight would change what "latest" means.
    await this.drainPipeline();
    if (!this.initialized || this.particleCount === 0) return new Uint32Array(0);
    const commandEncoder = this.device.createCommandEncoder({ label: 'read-mfm-qout' });
    const staging = this.device.createBuffer({
      size: Math.max(4, this.particleCount * 4),
      usage: BUFFER_USAGE_MAP_READ | BUFFER_USAGE_COPY_DST,
    });
    commandEncoder.copyBufferToBuffer(this.qOutBuffer, 0, staging, 0, this.particleCount * 4);
    this.device.queue.submit([commandEncoder.finish()]);
    await this.device.queue.onSubmittedWorkDone();
    await staging.mapAsync(MAP_MODE_READ);
    const result = new Uint32Array(staging.getMappedRange().slice(0));
    staging.unmap();
    staging.destroy();
    return result.slice(0, this.particleCount);
  }

  public destroy(): void {
    this.bufferGeneration++;
    this.pipe.length = 0;
    this.invalidateBindGroupCache();
    this.gpuProfiler?.destroy();
    this.gpuProfiler = null;
    this.cpuProfiler = null;
    const buffers: GPUBuffer[] = [
      ...this.positionBuffers,
      ...this.velocityBuffers,
      ...this.healthBuffers,
      ...this.chargeBuffers,
      ...this.incomingChargeBuffers,
      ...this.senderBuffers,
      ...this.targetBuffers,
      ...this.senderCountBuffers,
      this.cellHeadBuffer,
      this.particleNextBuffer,
      ...(this.sortBuffersReady
        ? [this.cellCountBuffer, this.cellStartBuffer, this.sortedIndexBuffer, this.sortedGeoBuffer, this.sortedFvBuffer]
        : []),
      ...(this.pipeResourcesReady ? [this.haltBuffer, this.zeroWordBuffer, ...this.pipeSummary] : []),
      ...(this.laggedMetrics ? this.laggedMetrics.map((slot) => slot.buffer) : []),
      this.roleBuffer,
      this.particleIdHashBuffer,
      this.genomeHMaxBuffer,
      this.genomeMateHealthThresholdBuffer,
      this.genomeThetaQBuffer,
      this.genomeABuffer,
      this.genomeKBuffer,
      this.genomeRcBuffer,
      this.genomeMBuffer,
      this.genomeGammaBuffer,
      this.genomeRsBuffer,
      this.genomeOmegaRBuffer,
      this.genomeOmegaABuffer,
      this.genomeOmegaVBuffer,
      this.qResidualBuffer,
      this.qOutBuffer,
      this.activeBuffer,
      this.successfulBuffer,
      this.selectedTargetsBuffer,
      this.selectedCountBuffer,
      this.forceBuffer,
      this.pressureBuffer,
      this.paramsBuffer,
      this.fullStateReadback,
      this.reproductionStateReadback,
      this.metricsStateReadback,
      this.reproductionCandidateBuffer,
      this.reproductionCandidateSlotBuffer,
      this.reproductionCandidateCountBuffer,
      this.deathCandidateSlotBuffer,
      this.deathCandidateCountBuffer,
      this.eventSummaryReadback,
      this.eventDataReadback,
    ];

    const seen = new Set<GPUBuffer>();
    for (const buffer of buffers) {
      if (buffer && !seen.has(buffer)) {
        seen.add(buffer);
        buffer.destroy();
      }
    }

    this.initialized = false;
  }

  // -------------------------------------------------------------------------
  // GPU resource setup
  // -------------------------------------------------------------------------

  private async recreateGpuBuffers(initialUpload: boolean): Promise<void> {
    // Slot mapping is maintained independently from GPU buffer recreation.
    // Rebuilding GPU resources must not imply an O(N) CPU mapping rebuild.
    this.ensurePopulationFitsCapacity();

    const nextCapacity = Math.max(1, this.config.Nmax, this.population.particles.size);
    const nextMaxK = this.computeRequiredMaxK();
    const nextGrid = this.computeGridSpec();
    const gridChanged =
      this.gridCountX !== nextGrid.countX ||
      this.gridCountY !== nextGrid.countY ||
      Math.abs(this.gridCellSize - nextGrid.cellSize) > 1e-12;

    if (
      this.capacity !== nextCapacity ||
      this.maxK !== nextMaxK ||
      gridChanged ||
      !this.roleBuffer ||
      initialUpload
    ) {
      this.destroyDataBuffersOnly();
      this.cpuProfiler?.inc('gpu.bufferRecreations');
      this.capacity = nextCapacity;
      this.maxK = nextMaxK;
      this.gridCountX = nextGrid.countX;
      this.gridCountY = nextGrid.countY;
      this.gridCellSize = nextGrid.cellSize;
      this.createDataBuffers();
      await this.uploadPopulationToGpu();
    } else {
      await this.uploadPopulationToGpu();
    }

    this.populationDirty = false;
  }

  private createDataBuffers(): void {
    // Phase 16: defensive. Every caller destroys the previous buffers first (which already cleared the bind-group cache);
    // clearing again here guarantees a cached group can never outlive the buffers it was built from.
    this.invalidateBindGroupCache();
    const float2Bytes = this.capacity * 8;
    const floatBytes = this.capacity * 4;
    const uintBytes = this.capacity * 4;
    const eventBytes = Math.max(4, this.capacity * Math.max(1, this.maxK) * 4);
    // Phase 16: block r holds rank r and block 0 doubles as the rank-less block (Phase 15 wrote an
    // identical extra block, so it needed maxK + 1 blocks).
    const paramBlocks = Math.max(1, this.maxK);
    const paramBytes = paramBlocks * UNIFORM_DYNAMIC_STRIDE;
    this.paramBlocks = paramBlocks;
    this.paramsScratch = new Uint8Array(paramBytes);
    this.paramsView = new DataView(this.paramsScratch.buffer);

    const storage = BUFFER_USAGE_STORAGE | BUFFER_USAGE_COPY_DST | BUFFER_USAGE_COPY_SRC;
    const readWrite = storage;

    const make = (size: number, usage = storage, label?: string) =>
      this.device.createBuffer({
        size: Math.max(4, size),
        usage,
        label,
      });

    this.positionBuffers = [make(float2Bytes, readWrite, 'mfm-position-0'), make(float2Bytes, readWrite, 'mfm-position-1')];
    this.velocityBuffers = [make(float2Bytes, readWrite, 'mfm-velocity-0'), make(float2Bytes, readWrite, 'mfm-velocity-1')];
    this.healthBuffers = [make(floatBytes, readWrite, 'mfm-health-0'), make(floatBytes, readWrite, 'mfm-health-1')];
    this.chargeBuffers = [make(uintBytes, readWrite, 'mfm-charge-0'), make(uintBytes, readWrite, 'mfm-charge-1')];

    this.incomingChargeBuffers = [make(uintBytes, readWrite, 'mfm-incoming-0'), make(uintBytes, readWrite, 'mfm-incoming-1')];
    this.senderBuffers = [make(eventBytes, readWrite, 'mfm-sender-events-0'), make(eventBytes, readWrite, 'mfm-sender-events-1')];
    this.targetBuffers = [make(eventBytes, readWrite, 'mfm-target-events-0'), make(eventBytes, readWrite, 'mfm-target-events-1')];
    this.senderCountBuffers = [make(4, readWrite, 'mfm-event-count-0'), make(4, readWrite, 'mfm-event-count-1')];

    const gridCellCount = this.gridCountX * this.gridCountY;
    this.cellHeadBuffer = make(Math.max(4, gridCellCount * 4), readWrite, 'mfm-grid-head');
    this.particleNextBuffer = make(Math.max(4, this.capacity * 4), readWrite, 'mfm-grid-next');
    // Phase 18: the cell-sorted buffers exist from the start when a sorted force kernel is selected (the default), so a step
    // never creates buffers; with 'linked-list' they are created only if setKernelOptions() later switches to a sorted kernel.
    this.sortBuffersReady = false;
    this.pipeResourcesReady = false; // Phase 20: halt flag / summary ring / halt-update groups are per data-buffer generation
    this.haltUpdateGroups = null;
    this.laggedMetrics = null;
    if (this.kernels.forceKernel !== 'linked-list') this.ensureSortBuffers();

    this.roleBuffer = make(uintBytes, readWrite, 'mfm-role');
    this.particleIdHashBuffer = make(uintBytes, readWrite, 'mfm-id-hash');
    this.genomeHMaxBuffer = make(floatBytes, readWrite, 'mfm-g-hmax');
    this.genomeMateHealthThresholdBuffer = make(floatBytes, readWrite, 'mfm-g-mate-health-threshold');
    this.genomeThetaQBuffer = make(uintBytes, readWrite, 'mfm-g-theta');
    this.genomeABuffer = make(floatBytes, readWrite, 'mfm-g-a');
    this.genomeKBuffer = make(uintBytes, readWrite, 'mfm-g-k');
    this.genomeRcBuffer = make(floatBytes, readWrite, 'mfm-g-rc');
    this.genomeMBuffer = make(floatBytes, readWrite, 'mfm-g-m');
    this.genomeGammaBuffer = make(floatBytes, readWrite, 'mfm-g-gamma');
    this.genomeRsBuffer = make(floatBytes, readWrite, 'mfm-g-rs');
    this.genomeOmegaRBuffer = make(floatBytes, readWrite, 'mfm-g-omega-r');
    this.genomeOmegaABuffer = make(floatBytes, readWrite, 'mfm-g-omega-a');
    this.genomeOmegaVBuffer = make(floatBytes, readWrite, 'mfm-g-omega-v');

    this.qResidualBuffer = make(uintBytes, readWrite, 'mfm-q-residual');
    this.qOutBuffer = make(uintBytes, readWrite, 'mfm-q-out');
    this.activeBuffer = make(uintBytes, readWrite, 'mfm-active');
    this.successfulBuffer = make(uintBytes, readWrite, 'mfm-success');
    this.selectedTargetsBuffer = make(eventBytes, readWrite, 'mfm-selected-targets');
    this.selectedCountBuffer = make(uintBytes, readWrite, 'mfm-selected-count');
    this.forceBuffer = make(float2Bytes, readWrite, 'mfm-force');
    this.pressureBuffer = make(4, readWrite, 'mfm-pressure');
    this.paramsBuffer = this.device.createBuffer({
      size: paramBytes,
      usage: BUFFER_USAGE_UNIFORM | BUFFER_USAGE_COPY_DST,
      label: 'mfm-params',
    });

    const stagingUsage = BUFFER_USAGE_MAP_READ | BUFFER_USAGE_COPY_DST;
    const fullReadbackLayout = this.getFullReadbackLayout();

    this.fullStateReadback = make(Math.max(4, fullReadbackLayout.totalBytes),
      stagingUsage, 'mfm-stage-full-readback',);
    const reproductionReadbackLayout = this.getReproductionReadbackLayout();
    this.reproductionStateReadback = make(reproductionReadbackLayout.totalBytes, stagingUsage, 'mfm-stage-reproduction-geometry-readback');
    this.metricsStateReadback = make(Math.max(8, this.capacity * 8), stagingUsage, 'mfm-stage-metrics-readback');
    this.reproductionCandidateBuffer = make(Math.max(16, this.capacity * 16), readWrite, 'mfm-reproduction-candidates');
    this.reproductionCandidateSlotBuffer = make(Math.max(4, this.capacity * 4), readWrite, 'mfm-reproduction-candidate-slots');
    this.reproductionCandidateCountBuffer = make(4, readWrite, 'mfm-reproduction-candidate-count');
    this.deathCandidateSlotBuffer = make(Math.max(4, this.capacity * 4), readWrite, 'mfm-death-candidate-slots');
    this.deathCandidateCountBuffer = make(4, readWrite, 'mfm-death-candidate-count');
    this.eventSummaryReadback = make(EVENT_SUMMARY_BYTES, stagingUsage, 'mfm-event-summary-readback');
    this.eventDataReadback = make(Math.max(8, this.capacity * Math.max(1,
       this.maxK) * 8, ), stagingUsage, 'mfm-event-data-readback',);
  }

  private destroyDataBuffersOnly(): void {
    // Phase 20: in-flight pipelined steps reference these buffers: they become stale (discarded without reading anything).
    this.bufferGeneration++;
    // Phase 16: drop every cached bind group BEFORE the buffers they reference are destroyed.
    this.invalidateBindGroupCache();
    const buffers: GPUBuffer[] = [
      ...this.positionBuffers,
      ...this.velocityBuffers,
      ...this.healthBuffers,
      ...this.chargeBuffers,
      ...this.incomingChargeBuffers,
      ...this.senderBuffers,
      ...this.targetBuffers,
      ...this.senderCountBuffers,
      this.cellHeadBuffer,
      this.particleNextBuffer,
      ...(this.sortBuffersReady
        ? [this.cellCountBuffer, this.cellStartBuffer, this.sortedIndexBuffer, this.sortedGeoBuffer, this.sortedFvBuffer]
        : []),
      ...(this.pipeResourcesReady ? [this.haltBuffer, this.zeroWordBuffer, ...this.pipeSummary] : []),
      ...(this.laggedMetrics ? this.laggedMetrics.map((slot) => slot.buffer) : []),
      this.roleBuffer,
      this.particleIdHashBuffer,
      this.genomeHMaxBuffer,
      this.genomeMateHealthThresholdBuffer,
      this.genomeThetaQBuffer,
      this.genomeABuffer,
      this.genomeKBuffer,
      this.genomeRcBuffer,
      this.genomeMBuffer,
      this.genomeGammaBuffer,
      this.genomeRsBuffer,
      this.genomeOmegaRBuffer,
      this.genomeOmegaABuffer,
      this.genomeOmegaVBuffer,
      this.qResidualBuffer,
      this.qOutBuffer,
      this.activeBuffer,
      this.successfulBuffer,
      this.selectedTargetsBuffer,
      this.selectedCountBuffer,
      this.forceBuffer,
      this.pressureBuffer,
      this.paramsBuffer,
      this.fullStateReadback,
      this.reproductionStateReadback,
      this.metricsStateReadback,
      this.reproductionCandidateBuffer,
      this.reproductionCandidateSlotBuffer,
      this.reproductionCandidateCountBuffer,
      this.deathCandidateSlotBuffer,
      this.deathCandidateCountBuffer,
      this.eventSummaryReadback,
      this.eventDataReadback,
    ];

    const seen = new Set<GPUBuffer>();
    for (const buffer of buffers) {
      if (buffer && !seen.has(buffer)) {
        seen.add(buffer);
        buffer.destroy();
      }
    }
  }

  private async uploadPopulationToGpu(): Promise<void> {
    const uploadProf = this.cpuProfiler;
    const tUpload = uploadProf ? uploadProf.now() : 0;
    this.refreshCpuSlotMapping();
    this.particleCount = this.population.particles.size;

    // Phase 15: the uploaded state becomes the read side of the next step, which is always
    // buffer 0 after an upload. Select it BEFORE writing. (Phase 14 wrote into
    // buffers[this.stateIndex] and only then forced stateIndex = 0, which is why it also had to
    // upload an identical copy into the other side; that copy was the only thing making the
    // upload correct when stateIndex had been 1.)
    this.stateIndex = 0;

    const positions = new Float32Array(this.capacity * 2);
    const velocities = new Float32Array(this.capacity * 2);
    const healths = new Float32Array(this.capacity);
    const charges = new Uint32Array(this.capacity);
    let slot = 0;
    for (const [id, state] of this.population.particles) {
      const genome = this.population.genomes.get(id);
      if (!genome) continue;

      positions[slot * 2] = state.position.x;
      positions[slot * 2 + 1] = state.position.y;
      velocities[slot * 2] = state.velocity.x;
      velocities[slot * 2 + 1] = state.velocity.y;
      healths[slot] = state.health;
      charges[slot] = this.clampInteger(state.charge, 0, this.config.Qmax);
      slot++;
    }

    this.device.queue.writeBuffer(this.positionBuffers[this.stateIndex], 0, positions);
    this.device.queue.writeBuffer(this.velocityBuffers[this.stateIndex], 0, velocities);
    this.device.queue.writeBuffer(this.healthBuffers[this.stateIndex], 0, healths);
    this.device.queue.writeBuffer(this.chargeBuffers[this.stateIndex], 0, charges);

    // Phase 15: the write-side state buffers are NOT initialized. Phase 14 uploaded an identical
    // copy of positions/velocities/health/charge (24 B per slot of capacity) into them. Every
    // kernel that reads a write-side buffer runs after the kernel that writes it in the same
    // step, all bounded by `i < activeCount`, and the render/readback paths read the read side.
    // (Checked against each WGSL kernel in this file; behaviour is guarded by
    // tests/sync-accounting.test.ts, which caught the stateIndex ordering hazard above.)

    // Static, CPU-owned per-particle columns (role, id hash, genome parameters) for every live slot.
    // Phase 15: only the live slots are written; slots >= particleCount are never read because
    // every kernel is bounded by activeCount.
    const staticBytes = this.writeStaticColumns(0, this.particleCount);

    const scheduledIncoming = new Uint32Array(this.capacity);
    for (let i = 0; i < this.slotToId.length; i++) {
      const id = this.slotToId[i];
      scheduledIncoming[i] = this.clampInteger(this.incomingChargeMap.get(id) ?? 0, 0, UINT32_MAX);
    }

    this.device.queue.writeBuffer(this.incomingChargeBuffers[this.incomingIndex], 0, scheduledIncoming);
    // Phase 15: the other incoming buffer is not zeroed here; encodeStep() clears
    // incomingChargeBuffers[incomingWrite] with clearBuffer before it receives any atomicAdd.

    this.device.queue.writeBuffer(this.senderCountBuffers[0], 0, new Uint32Array([0]));
    this.device.queue.writeBuffer(this.senderCountBuffers[1], 0, new Uint32Array([0]));

    // Phase 15: selectedTargets is not zeroed here. Every step dispatches communication-select
    // for every rank 0..maxK-1 and each pass writes entry (slot, rank) for every slot < activeCount
    // before the transmit pass reads it, so no entry that is ever read is stale.

    // Intermediate buffers are overwritten by the next compute step. Keeping
    // their last values is useful for diagnostics (e.g. q_out inspection).

    // If a population was externally restored/reinitialized, preserve the CPU
    // history; GPU event buffers are observability buffers and do not determine
    // correctness of the next causal charge delivery.
    if (uploadProf) {
      const stateBytes = positions.byteLength + velocities.byteLength + healths.byteLength + charges.byteLength;
      uploadProf.since('upload.populationMs', tUpload);
      uploadProf.inc('upload.count');
      uploadProf.inc('upload.bytes', stateBytes + staticBytes + scheduledIncoming.byteLength + 8);
    }
    this.eventIndex = 0;
  }

  /**
   * Writes the CPU-owned, per-particle STATIC columns (role, id hash, genome-derived
   * parameters) for slots [fromSlot, toSlot) using the current slot mapping. These are
   * persistent/topological data, not GPU-authoritative dynamic state, so uploading them is
   * the CPU's job. Returns the number of bytes written.
   */
  private writeStaticColumns(fromSlot: number, toSlot: number): number {
    const n = toSlot - fromSlot;
    if (n <= 0) return 0;

    const roles = new Uint32Array(n);
    const idHashes = new Uint32Array(n);
    const hmax = new Float32Array(n);
    const mateHealthThreshold = new Float32Array(n);
    const theta = new Uint32Array(n);
    const a = new Float32Array(n);
    const k = new Uint32Array(n);
    const rc = new Float32Array(n);
    const mass = new Float32Array(n);
    const gamma = new Float32Array(n);
    const rs = new Float32Array(n);
    const omegaR = new Float32Array(n);
    const omegaA = new Float32Array(n);
    const omegaV = new Float32Array(n);

    for (let i = 0; i < n; i++) {
      const id = this.slotToId[fromSlot + i];
      const state = this.population.particles.get(id);
      const genome = this.population.genomes.get(id);
      if (!state || !genome) continue;

      roles[i] = this.encodeRole(state.role);
      idHashes[i] = this.hashParticleId(id);
      hmax[i] = genome.H_max;
      mateHealthThreshold[i] = genome.H_max * this.config.mate_health_percent;
      theta[i] = this.clampInteger(genome.theta_q, 0, UINT32_MAX);
      a[i] = genome.A;
      k[i] = this.clampInteger(Math.floor(genome.K), 0, UINT32_MAX);
      rc[i] = genome.R_c;
      mass[i] = genome.m;
      gamma[i] = genome.gamma;
      rs[i] = genome.R_s;
      omegaR[i] = genome.omega_R;
      omegaA[i] = genome.omega_A;
      omegaV[i] = genome.omega_v;
    }

    const offset = fromSlot * 4;
    const queue = this.device.queue;
    queue.writeBuffer(this.roleBuffer, offset, roles);
    queue.writeBuffer(this.particleIdHashBuffer, offset, idHashes);
    queue.writeBuffer(this.genomeHMaxBuffer, offset, hmax);
    queue.writeBuffer(this.genomeMateHealthThresholdBuffer, offset, mateHealthThreshold);
    queue.writeBuffer(this.genomeThetaQBuffer, offset, theta);
    queue.writeBuffer(this.genomeABuffer, offset, a);
    queue.writeBuffer(this.genomeKBuffer, offset, k);
    queue.writeBuffer(this.genomeRcBuffer, offset, rc);
    queue.writeBuffer(this.genomeMBuffer, offset, mass);
    queue.writeBuffer(this.genomeGammaBuffer, offset, gamma);
    queue.writeBuffer(this.genomeRsBuffer, offset, rs);
    queue.writeBuffer(this.genomeOmegaRBuffer, offset, omegaR);
    queue.writeBuffer(this.genomeOmegaABuffer, offset, omegaA);
    queue.writeBuffer(this.genomeOmegaVBuffer, offset, omegaV);
    return n * 4 * 14;
  }

  /** True when the current CPU population no longer fits the allocated GPU buffer shape. */
  private gpuShapeChangeRequired(): boolean {
    const desiredCapacity = Math.max(1, this.config.Nmax, this.population.particles.size);
    const desiredMaxK = this.computeRequiredMaxK();
    const desiredGrid = this.computeGridSpec();
    return (
      desiredCapacity !== this.capacity ||
      desiredMaxK !== this.maxK ||
      desiredGrid.countX !== this.gridCountX ||
      desiredGrid.countY !== this.gridCountY ||
      Math.abs(desiredGrid.cellSize - this.gridCellSize) > 1e-12
    );
  }

  /**
   * Phase 15: follow a change in population membership WITHOUT reading GPU dynamic state back.
   *
   * Phase 14 answered every death/birth with: full GPU->CPU dynamic readback (24 B/particle),
   * CPU topology edit, then a full CPU->GPU re-upload of dynamic + static + incoming data for
   * the whole capacity. The only reason the readback existed was so the re-upload had the
   * survivors' positions/velocities/health/charge to write back (5G-C).
   *
   * Survivors keep their relative order (PopulationState is an insertion-ordered Map) and
   * offspring are appended, so the new slot layout is: old slots minus the dead ones, then the
   * newborns. The GPU can realize that permutation itself with buffer-to-buffer copies of the
   * contiguous surviving runs, from the just-written P_{n+1} ping-pong side into the other
   * side. The CPU then supplies only what it owns or created: the newborns' initial state and
   * the static columns from the first shifted slot onward.
   */
  private restructureGpuStateInPlace(plan: RestructurePlan): void {
    const prof = this.cpuProfiler;
    const tStart = prof ? prof.now() : 0;
    const { oldParticleCount, deadSlots, offspringCount } = plan;
    const newParticleCount = this.particleCount;

    const srcState = this.stateIndex;
    const dstState = 1 - srcState;
    const srcIncoming = this.incomingIndex;
    const dstIncoming = 1 - srcIncoming;

    const encoder = this.device.createCommandEncoder({ label: 'mfm-population-restructure' });
    let dstSlot = 0;
    let runs = 0;
    const copyRun = (start: number, length: number): void => {
      encoder.copyBufferToBuffer(this.positionBuffers[srcState], start * 8, this.positionBuffers[dstState], dstSlot * 8, length * 8);
      encoder.copyBufferToBuffer(this.velocityBuffers[srcState], start * 8, this.velocityBuffers[dstState], dstSlot * 8, length * 8);
      encoder.copyBufferToBuffer(this.healthBuffers[srcState], start * 4, this.healthBuffers[dstState], dstSlot * 4, length * 4);
      encoder.copyBufferToBuffer(this.chargeBuffers[srcState], start * 4, this.chargeBuffers[dstState], dstSlot * 4, length * 4);
      // The pending incoming charge accumulated by this step's transmit pass is GPU-authoritative
      // and is carried over exactly (Phase 14 re-derived it on the CPU from the event list).
      encoder.copyBufferToBuffer(this.incomingChargeBuffers[srcIncoming], start * 4, this.incomingChargeBuffers[dstIncoming], dstSlot * 4, length * 4);
      dstSlot += length;
      runs++;
    };

    let runStart = 0;
    for (const dead of deadSlots) {
      if (dead > runStart) copyRun(runStart, dead - runStart);
      runStart = dead + 1;
    }
    if (oldParticleCount > runStart) copyRun(runStart, oldParticleCount - runStart);

    const survivors = dstSlot;
    if (survivors + offspringCount !== newParticleCount) {
      throw new Error(
        `Population restructure invariant violated: ${survivors} survivors + ${offspringCount} offspring ` +
          `!= ${newParticleCount} slots (old=${oldParticleCount}, dead=${deadSlots.length}).`,
      );
    }
    if (runs > 0) this.device.queue.submit([encoder.finish()]);

    let uploadBytes = 0;
    if (offspringCount > 0) {
      const positions = new Float32Array(offspringCount * 2);
      const velocities = new Float32Array(offspringCount * 2);
      const healths = new Float32Array(offspringCount);
      const charges = new Uint32Array(offspringCount);
      for (let j = 0; j < offspringCount; j++) {
        const state = this.population.particles.get(this.slotToId[survivors + j]);
        if (!state) continue;
        positions[j * 2] = state.position.x;
        positions[j * 2 + 1] = state.position.y;
        velocities[j * 2] = state.velocity.x;
        velocities[j * 2 + 1] = state.velocity.y;
        healths[j] = state.health;
        charges[j] = this.clampInteger(state.charge, 0, this.config.Qmax);
      }
      const queue = this.device.queue;
      queue.writeBuffer(this.positionBuffers[dstState], survivors * 8, positions);
      queue.writeBuffer(this.velocityBuffers[dstState], survivors * 8, velocities);
      queue.writeBuffer(this.healthBuffers[dstState], survivors * 4, healths);
      queue.writeBuffer(this.chargeBuffers[dstState], survivors * 4, charges);
      // No event addressed a slot that did not exist yet, so newborns start with no pending charge.
      queue.writeBuffer(this.incomingChargeBuffers[dstIncoming], survivors * 4, new Uint32Array(offspringCount));
      uploadBytes += positions.byteLength + velocities.byteLength + healths.byteLength + charges.byteLength + offspringCount * 4;
    }

    // Slots before the first dead slot keep both their index and their static data.
    const firstShiftedSlot = deadSlots.length > 0 ? deadSlots[0] : oldParticleCount;
    uploadBytes += this.writeStaticColumns(firstShiftedSlot, newParticleCount);

    // Event records refer to the previous slot layout: invalidate them (as the full upload did).
    this.device.queue.writeBuffer(this.senderCountBuffers[0], 0, new Uint32Array([0]));
    this.device.queue.writeBuffer(this.senderCountBuffers[1], 0, new Uint32Array([0]));
    uploadBytes += 8;

    this.stateIndex = dstState;
    this.incomingIndex = dstIncoming;
    this.eventIndex = 0;

    if (prof) {
      prof.since('restructure.inPlaceMs', tStart);
      prof.inc('restructure.inPlace');
      prof.inc('restructure.copyRuns', runs);
      prof.inc('restructure.gpuCopyBytes', survivors * 28);
      prof.inc('upload.count');
      prof.inc('upload.bytes', uploadBytes);
    }
  }

  private async resyncAfterPopulationStep(
    populationStructureChanged: boolean,
    plan: RestructurePlan | null,
  ): Promise<void> {
    // During a normal timestep the GPU already contains the complete
    // P_{n+1} state. Avoid rebuilding/uploading the CPU population again
    // unless particle topology actually changed.
    if (!populationStructureChanged) {
      return;
    }

    // Phase 15: membership changed but the buffer shape did not -> permute on the GPU.
    if (plan) {
      this.restructureGpuStateInPlace(plan);
      return;
    }

    // The buffer shape changed (capacity, maxK or grid): buffers are recreated and the whole
    // population is re-uploaded from CPU state, which finishNormalSync() made current first.
    if (this.gpuShapeChangeRequired()) {
      this.cpuProfiler?.inc('resync.shapeChanges');
      await this.recreateGpuBuffers(false);
      return;
    }

    await this.uploadPopulationToGpu();
  }

  private async createPipelines(): Promise<void> {
    this.gridClearPipeline = this.makePipeline(
      'mfm-grid-clear',
      SHADER_GRID_CLEAR,
      [
        { binding: 0, visibility: SHADER_STAGE_COMPUTE, buffer: { type: 'uniform', hasDynamicOffset: true } },
        { binding: 1, visibility: SHADER_STAGE_COMPUTE, buffer: { type: 'storage' } },
      ],
    );

    this.gridBuildPipeline = this.makePipeline(
      'mfm-grid-build',
      SHADER_GRID_BUILD,
      [
        { binding: 0, visibility: SHADER_STAGE_COMPUTE, buffer: { type: 'uniform', hasDynamicOffset: true } },
        { binding: 1, visibility: SHADER_STAGE_COMPUTE, buffer: { type: 'read-only-storage' } },
        { binding: 2, visibility: SHADER_STAGE_COMPUTE, buffer: { type: 'storage' } },
        { binding: 3, visibility: SHADER_STAGE_COMPUTE, buffer: { type: 'storage' } },
      ],
    );

    this.chargeProcessPipeline = this.makePipeline(
      'mfm-charge-process',
      SHADER_CHARGE_PROCESS,
      [
        { binding: 0, visibility: SHADER_STAGE_COMPUTE, buffer: { type: 'uniform', hasDynamicOffset: true } },
        ...this.readonlyBindings(1, 5),
        ...this.storageBindings(6, 3),
      ],
    );

    this.chargeFinalizePipeline = this.makePipeline(
      'mfm-charge-finalize',
      SHADER_CHARGE_FINALIZE,
      [
        { binding: 0, visibility: SHADER_STAGE_COMPUTE, buffer: { type: 'uniform', hasDynamicOffset: true } },
        { binding: 1, visibility: SHADER_STAGE_COMPUTE, buffer: { type: 'read-only-storage' } },
        { binding: 2, visibility: SHADER_STAGE_COMPUTE, buffer: { type: 'storage' } },
      ],
    );

    this.pressurePipeline = this.makePipeline(
      'mfm-pressure',
      SHADER_PRESSURE,
      [
        { binding: 0, visibility: SHADER_STAGE_COMPUTE, buffer: { type: 'uniform', hasDynamicOffset: true } },
        { binding: 1, visibility: SHADER_STAGE_COMPUTE, buffer: { type: 'read-only-storage' } },
        { binding: 2, visibility: SHADER_STAGE_COMPUTE, buffer: { type: 'read-only-storage' } },
        { binding: 3, visibility: SHADER_STAGE_COMPUTE, buffer: { type: 'storage' } },
      ],
    );

    this.communicationSelectPipeline = this.makePipeline(
      'mfm-communication-select',
      SHADER_COMMUNICATION_SELECT,
      [
        { binding: 0, visibility: SHADER_STAGE_COMPUTE, buffer: { type: 'uniform', hasDynamicOffset: true } },
        ...this.readonlyBindings(1, 12),
        { binding: 13, visibility: SHADER_STAGE_COMPUTE, buffer: { type: 'storage' } },
        { binding: 14, visibility: SHADER_STAGE_COMPUTE, buffer: { type: 'read-only-storage' } },
        { binding: 15, visibility: SHADER_STAGE_COMPUTE, buffer: { type: 'storage' } },
        { binding: 16, visibility: SHADER_STAGE_COMPUTE, buffer: { type: 'storage' } },
      ],
    );

    this.communicationTransmitPipeline = this.makePipeline(
      'mfm-communication-transmit',
      SHADER_COMMUNICATION_TRANSMIT,
      [
        { binding: 0, visibility: SHADER_STAGE_COMPUTE, buffer: { type: 'uniform', hasDynamicOffset: true } },
        { binding: 1, visibility: SHADER_STAGE_COMPUTE, buffer: { type: 'read-only-storage' } },
        { binding: 2, visibility: SHADER_STAGE_COMPUTE, buffer: { type: 'read-only-storage' } },
        { binding: 3, visibility: SHADER_STAGE_COMPUTE, buffer: { type: 'storage' } },
        { binding: 4, visibility: SHADER_STAGE_COMPUTE, buffer: { type: 'storage' } },
        { binding: 5, visibility: SHADER_STAGE_COMPUTE, buffer: { type: 'storage' } },
        { binding: 6, visibility: SHADER_STAGE_COMPUTE, buffer: { type: 'storage' } },
      ],
    );

    this.localSuccessPipeline = this.makePipeline(
      'mfm-local-success',
      SHADER_LOCAL_SUCCESS,
      [
        { binding: 0, visibility: SHADER_STAGE_COMPUTE, buffer: { type: 'uniform', hasDynamicOffset: true } },
        { binding: 1, visibility: SHADER_STAGE_COMPUTE, buffer: { type: 'read-only-storage' } },
        { binding: 2, visibility: SHADER_STAGE_COMPUTE, buffer: { type: 'read-only-storage' } },
        { binding: 3, visibility: SHADER_STAGE_COMPUTE, buffer: { type: 'read-only-storage' } },
        { binding: 4, visibility: SHADER_STAGE_COMPUTE, buffer: { type: 'storage' } },
      ],
    );

    this.healthUpdatePipeline = this.makePipeline(
      'mfm-health-update',
      SHADER_HEALTH_UPDATE,
      [
        { binding: 0, visibility: SHADER_STAGE_COMPUTE, buffer: { type: 'uniform', hasDynamicOffset: true } },
        { binding: 1, visibility: SHADER_STAGE_COMPUTE, buffer: { type: 'read-only-storage' } },
        { binding: 2, visibility: SHADER_STAGE_COMPUTE, buffer: { type: 'read-only-storage' } },
        { binding: 3, visibility: SHADER_STAGE_COMPUTE, buffer: { type: 'read-only-storage' } },
        { binding: 4, visibility: SHADER_STAGE_COMPUTE, buffer: { type: 'read-only-storage' } },
        { binding: 5, visibility: SHADER_STAGE_COMPUTE, buffer: { type: 'read-only-storage' } },
        { binding: 6, visibility: SHADER_STAGE_COMPUTE, buffer: { type: 'storage' } },
      ],
    );

    this.buildForcePipeline(false);

    this.forceAllPairsPipeline = this.makePipeline(
      'mfm-force-all-pairs',
      SHADER_FORCE_ALL_PAIRS,
      [
        { binding: 0, visibility: SHADER_STAGE_COMPUTE, buffer: { type: 'uniform', hasDynamicOffset: true } },
        ...this.readonlyBindings(1, 9),
        { binding: 10, visibility: SHADER_STAGE_COMPUTE, buffer: { type: 'storage' } },
      ],
    );

    this.mechanicsPipeline = this.makePipeline(
      'mfm-mechanics',
      SHADER_MECHANICS,
      [
        { binding: 0, visibility: SHADER_STAGE_COMPUTE, buffer: { type: 'uniform', hasDynamicOffset: true } },
        ...this.readonlyBindings(1, 6),
        ...this.storageBindings(7, 2),
      ],
    );

    this.buildDeathCompactionPipeline(false);

    this.reproductionCompactionPipeline = this.makePipeline(
      'mfm-reproduction-compaction', SHADER_REPRODUCTION_COMPACTION,
      [
        { binding: 0, visibility: SHADER_STAGE_COMPUTE, buffer: { type: 'uniform', hasDynamicOffset: true } },
        ...this.readonlyBindings(1, 7),
        { binding: 8, visibility: SHADER_STAGE_COMPUTE, buffer: { type: 'storage' } },
        { binding: 9, visibility: SHADER_STAGE_COMPUTE, buffer: { type: 'storage' } },
        { binding: 10, visibility: SHADER_STAGE_COMPUTE, buffer: { type: 'storage' } },
      ],
    );
  }

  /** Phase 17: (re)builds the grid force pipeline for this.kernels.forceWorkgroupSize, reusing the existing layout object when only the options changed. */
  private buildForcePipeline(reuseLayout: boolean): void {
    const mode = this.kernels.forceKernel;
    const wg = this.kernels.forceWorkgroupSize;
    if (mode !== 'linked-list') this.ensureSortPipelines();
    // The linked-list kernel keeps its Phase 5..17 layout (12 bindings) so that mode is unchanged. The sorted kernels read
    // fewer buffers (10 bindings, listed in shaderForceSorted), so they get their own layout: a layout is reused only when the
    // mode family did not change (the cached bind groups of the other family are dropped in setKernelOptions).
    const sorted = mode !== 'linked-list';
    this.forcePipeline = this.makePipeline(
      'mfm-force',
      sorted ? shaderForceSorted(wg, mode === 'sorted-culled') : shaderForce(wg),
      sorted
        ? [
            { binding: 0, visibility: SHADER_STAGE_COMPUTE, buffer: { type: 'uniform', hasDynamicOffset: true } },
            ...this.readonlyBindings(1, 5),
            { binding: 6, visibility: SHADER_STAGE_COMPUTE, buffer: { type: 'storage' } },
            ...this.readonlyBindings(7, 4),
          ]
        : [
            { binding: 0, visibility: SHADER_STAGE_COMPUTE, buffer: { type: 'uniform', hasDynamicOffset: true } },
            ...this.readonlyBindings(1, 9),
            { binding: 10, visibility: SHADER_STAGE_COMPUTE, buffer: { type: 'storage' } },
            { binding: 11, visibility: SHADER_STAGE_COMPUTE, buffer: { type: 'read-only-storage' } },
            { binding: 12, visibility: SHADER_STAGE_COMPUTE, buffer: { type: 'storage' } },
          ],
      reuseLayout ? this.forcePipeline.layout : undefined,
    );
  }

  /**
   * Phase 18: creates the cell-sorted buffers on first use, sized from the CURRENT capacity and grid. They are destroyed with the
   * other data buffers (the grid shape is part of the buffer shape, so a grid change always recreates everything).
   */
  private ensureSortBuffers(): void {
    if (this.sortBuffersReady) return;
    const readWrite = BUFFER_USAGE_STORAGE | BUFFER_USAGE_COPY_SRC | BUFFER_USAGE_COPY_DST;
    const make = (size: number, label: string): GPUBuffer => this.device.createBuffer({ size: Math.max(16, size), usage: readWrite, label });
    const gridCellCount = this.gridCountX * this.gridCountY;
    this.cellCountBuffer = make(gridCellCount * 4, 'mfm-sort-cell-count');
    this.cellStartBuffer = make((gridCellCount + 1) * 4, 'mfm-sort-cell-start');
    this.sortedIndexBuffer = make(this.capacity * 4, 'mfm-sort-index');
    this.sortedGeoBuffer = make(this.capacity * 16, 'mfm-sort-geo');
    this.sortedFvBuffer = make(this.capacity * 4, 'mfm-sort-fv');
    this.sortBuffersReady = true;
  }

  /** Phase 18: compiles the three counting-sort pipelines on first use of a cell-sorted force kernel. */
  private ensureSortPipelines(): void {
    if (this.sortCountPipeline) return;
    this.sortCountPipeline = this.makePipeline('mfm-sort-count', SHADER_SORT_COUNT, [
      { binding: 0, visibility: SHADER_STAGE_COMPUTE, buffer: { type: 'uniform', hasDynamicOffset: true } },
      { binding: 1, visibility: SHADER_STAGE_COMPUTE, buffer: { type: 'read-only-storage' } },
      { binding: 2, visibility: SHADER_STAGE_COMPUTE, buffer: { type: 'storage' } },
    ]);
    this.sortScanPipeline = this.makePipeline('mfm-sort-scan', SHADER_SORT_SCAN, [
      { binding: 0, visibility: SHADER_STAGE_COMPUTE, buffer: { type: 'uniform', hasDynamicOffset: true } },
      { binding: 1, visibility: SHADER_STAGE_COMPUTE, buffer: { type: 'storage' } },
      { binding: 2, visibility: SHADER_STAGE_COMPUTE, buffer: { type: 'storage' } },
    ]);
    this.sortScatterPipeline = this.makePipeline('mfm-sort-scatter', SHADER_SORT_SCATTER, [
      { binding: 0, visibility: SHADER_STAGE_COMPUTE, buffer: { type: 'uniform', hasDynamicOffset: true } },
      ...this.readonlyBindings(1, 5),
      ...this.storageBindings(6, 4),
    ]);
  }

  /** Phase 17: (re)builds the death-compaction pipeline for this.kernels.deathCompaction, reusing the existing layout object when only the options changed. */
  private buildDeathCompactionPipeline(reuseLayout: boolean): void {
    this.deathCompactionPipeline = this.makePipeline(
      'mfm-death-compaction',
      this.kernels.deathCompaction === 'blocked'
        ? SHADER_DEATH_COMPACTION_BLOCKED
        : this.kernels.deathCompaction === 'parallel'
          ? SHADER_DEATH_COMPACTION_PARALLEL
          : SHADER_DEATH_COMPACTION,
      [
        { binding: 0, visibility: SHADER_STAGE_COMPUTE, buffer: { type: 'uniform', hasDynamicOffset: true } },
        { binding: 1, visibility: SHADER_STAGE_COMPUTE, buffer: { type: 'read-only-storage' } },
        { binding: 2, visibility: SHADER_STAGE_COMPUTE, buffer: { type: 'read-only-storage' } },
        { binding: 3, visibility: SHADER_STAGE_COMPUTE, buffer: { type: 'storage' } },
        { binding: 4, visibility: SHADER_STAGE_COMPUTE, buffer: { type: 'storage' } },
      ],
      reuseLayout ? this.deathCompactionPipeline.layout : undefined,
    );
  }

  private makePipeline(
    label: string,
    code: string,
    entries: GPUBindGroupLayoutEntry[],
    sharedLayout?: GPUBindGroupLayout,
  ): PipelineBundle {
    const layout = sharedLayout ?? this.device.createBindGroupLayout({ entries, label: `${label}-layout` });
    const module = this.device.createShaderModule({ code, label: `${label}-shader` });
    const pipeline = this.device.createComputePipeline({
      label,
      layout: this.device.createPipelineLayout({ bindGroupLayouts: [layout] }),
      compute: {
        module,
        entryPoint: 'main',
      },
    });
    return { pipeline, layout };
  }

  private readonlyBindings(start: number, count: number): GPUBindGroupLayoutEntry[] {
    return Array.from({ length: count }, (_, i) => ({
      binding: start + i,
      visibility: SHADER_STAGE_COMPUTE,
      buffer: { type: 'read-only-storage' } as const,
    }));
  }

  private storageBindings(start: number, count: number): GPUBindGroupLayoutEntry[] {
    return Array.from({ length: count }, (_, i) => ({
      binding: start + i,
      visibility: SHADER_STAGE_COMPUTE,
      buffer: { type: 'storage' } as const,
    }));
  }

  // -------------------------------------------------------------------------
  // Compute dispatch helpers / bind groups
  // -------------------------------------------------------------------------

  private invalidateBindGroupCache(): void {
    this.stepBindGroupCache.fill(undefined);
  }

  /**
   * Phase 16: the bind groups of one timestep for the given ping-pong selection. The cache key is
   * (stateRead, incomingRead, eventWrite); every complementary index is derived (x_write = 1 - x_read, and
   * eventWrite is the key itself). At most 8 sets of 13 groups exist; in steady state the three indices
   * alternate together, so 2 sets are live. A miss builds the whole set (12 groups, +1 lazily for
   * reproduction compaction); a hit costs one array read.
   */
  private acquireStepBindGroups(
    stateRead: number,
    incomingRead: number,
    eventWrite: number,
    needsReproductionCompaction: boolean,
  ): StepBindGroups {
    const prof = this.cpuProfiler;
    const useCache = this.orchestration.bindGroupCache;
    const key = stateRead | (incomingRead << 1) | (eventWrite << 2);
    if (this.kernels.forceKernel !== 'linked-list') this.ensureSortBuffers();
    let set = useCache ? this.stepBindGroupCache[key] : undefined;
    if (set) {
      prof?.inc('encode.bindGroupCacheHits');
    } else {
      if (useCache) prof?.inc('encode.bindGroupCacheMisses');
      const stateWrite = 1 - stateRead;
      const incomingWrite = 1 - incomingRead;
      set = {
        gridClear: this.createGridClearBindGroup(),
        gridBuild: this.createGridBuildBindGroup(stateRead),
        chargeProcess: this.createChargeProcessBindGroup(stateRead, incomingRead),
        chargeFinalize: this.createChargeFinalizeBindGroup(stateWrite),
        pressure: this.createPressureBindGroup(stateRead),
        select: this.createCommunicationSelectBindGroup(stateRead),
        transmit: this.createCommunicationTransmitBindGroup(stateRead, incomingWrite, eventWrite),
        localSuccess: this.createLocalSuccessBindGroup(incomingRead),
        healthUpdate: this.createHealthUpdateBindGroup(stateRead, stateWrite),
        force: this.createForceBindGroup(stateRead),
        mechanics: this.createMechanicsBindGroup(stateRead, stateWrite),
        deathCompaction: this.createDeathCompactionBindGroup(stateWrite),
        reproductionCompaction: null,
        sort: null,
      };
      if (useCache) this.stepBindGroupCache[key] = set;
    }
    if (this.kernels.forceKernel !== 'linked-list' && !set.sort) {
      set.sort = this.createSortBindGroups(stateRead);
    }
    if (needsReproductionCompaction && !set.reproductionCompaction) {
      set.reproductionCompaction = this.createReproductionCompactionBindGroup(stateRead, 1 - stateRead);
    }
    return set;
  }

  private createDeathCompactionBindGroup(stateWrite: number): GPUBindGroup {
    return this.makeBindGroup(this.deathCompactionPipeline.layout, [
      this.paramsBuffer,
      this.healthBuffers[stateWrite],
      this.roleBuffer,
      this.deathCandidateCountBuffer,
      this.deathCandidateSlotBuffer,
    ]);
  }

  private createReproductionCompactionBindGroup(stateRead: number, stateWrite: number): GPUBindGroup {
    return this.makeBindGroup(this.reproductionCompactionPipeline.layout, [
      this.paramsBuffer, this.positionBuffers[stateRead], this.velocityBuffers[stateRead],
      this.healthBuffers[stateRead], this.healthBuffers[stateWrite], this.roleBuffer,
      this.genomeMateHealthThresholdBuffer, this.successfulBuffer,
      this.reproductionCandidateCountBuffer, this.reproductionCandidateBuffer, this.reproductionCandidateSlotBuffer,
    ]);
  }

  private dispatchCompute(
    encoder: GPUCommandEncoder,
    pipelineBundle: PipelineBundle,
    bindGroup: GPUBindGroup,
    dynamicOffset = 0,
    workgroupCount = Math.ceil(this.particleCount / WORKGROUP_SIZE),
  ): void {
    this.encPasses++;
    const timestampWrites = this.encodingPipelined ? undefined : this.gpuProfiler?.timestampWritesFor(this.passLabelFor(pipelineBundle));
    const pass = encoder.beginComputePass(timestampWrites ? { timestampWrites } : undefined);
    pass.setPipeline(pipelineBundle.pipeline);
    pass.setBindGroup(0, bindGroup, [dynamicOffset]);
    pass.dispatchWorkgroups(workgroupCount);
    pass.end();
  }

  /** Phase 14: maps a pipeline to the label used by the GPU pass profiler. Only called when profiling. */
  private passLabelFor(bundle: PipelineBundle): string {
    if (bundle === this.gridClearPipeline) return 'gridClear';
    if (bundle === this.gridBuildPipeline) return 'gridBuild';
    if (bundle === this.chargeProcessPipeline) return 'chargeProcess';
    if (bundle === this.chargeFinalizePipeline) return 'chargeFinalize';
    if (bundle === this.pressurePipeline) return 'pressure';
    if (bundle === this.communicationSelectPipeline) return 'communicationSelect';
    if (bundle === this.communicationTransmitPipeline) return 'communicationTransmit';
    if (bundle === this.localSuccessPipeline) return 'localSuccess';
    if (bundle === this.healthUpdatePipeline) return 'healthUpdate';
    if (bundle === this.haltUpdatePipeline) return 'haltUpdate';
    if (bundle === this.sortCountPipeline) return 'sortCount';
    if (bundle === this.sortScanPipeline) return 'sortScan';
    if (bundle === this.sortScatterPipeline) return 'sortScatter';
    if (bundle === this.forcePipeline) return 'force';
    if (bundle === this.forceAllPairsPipeline) return 'forceAllPairs';
    if (bundle === this.mechanicsPipeline) return 'mechanics';
    if (bundle === this.deathCompactionPipeline) return 'deathCompaction';
    if (bundle === this.reproductionCompactionPipeline) return 'reproductionCompaction';
    return 'unknown';
  }

  private makeBindGroup(layout: GPUBindGroupLayout, resources: GPUBuffer[]): GPUBindGroup {
    const prof = this.cpuProfiler;
    if (prof) {
      const t = prof.now();
      const group = this.makeBindGroupUninstrumented(layout, resources);
      prof.since('encode.bindGroupCreateMs', t);
      prof.inc('encode.bindGroupsCreated');
      return group;
    }
    return this.makeBindGroupUninstrumented(layout, resources);
  }

  private makeBindGroupUninstrumented(layout: GPUBindGroupLayout, resources: GPUBuffer[]): GPUBindGroup {
    return this.device.createBindGroup({
      layout,
      entries: resources.map((buffer, binding) => ({
        binding,
        resource:
        binding === 0
          ? {
              buffer,
              offset: 0,
              size: UNIFORM_BUFFER_SIZE,
            }
          : {
              buffer,
            },
      })),
    });
  }

  private createGridClearBindGroup(): GPUBindGroup {
    return this.makeBindGroup(this.gridClearPipeline.layout, [
      this.paramsBuffer,
      this.cellHeadBuffer,
    ]);
  }

  private createGridBuildBindGroup(stateRead: number): GPUBindGroup {
    return this.makeBindGroup(this.gridBuildPipeline.layout, [
      this.paramsBuffer,
      this.positionBuffers[stateRead],
      this.cellHeadBuffer,
      this.particleNextBuffer,
    ]);
  }

  private createChargeProcessBindGroup(stateRead: number, incomingRead: number): GPUBindGroup {
    return this.makeBindGroup(this.chargeProcessPipeline.layout, [
      this.paramsBuffer,
      this.chargeBuffers[stateRead],
      this.incomingChargeBuffers[incomingRead],
      this.roleBuffer,
      this.genomeThetaQBuffer,
      this.genomeABuffer,
      this.qResidualBuffer,
      this.activeBuffer,
      this.qOutBuffer,
    ]);
  }

  private createChargeFinalizeBindGroup(stateWrite: number): GPUBindGroup {
    return this.makeBindGroup(this.chargeFinalizePipeline.layout, [
      this.paramsBuffer,
      this.qResidualBuffer,
      this.chargeBuffers[stateWrite],
    ]);
  }

  private createPressureBindGroup(stateRead: number): GPUBindGroup {
    return this.makeBindGroup(this.pressurePipeline.layout, [
      this.paramsBuffer,
      this.chargeBuffers[stateRead],
      this.roleBuffer,
      this.pressureBuffer,
    ]);
  }

  private createCommunicationSelectBindGroup(stateRead: number): GPUBindGroup {
    return this.makeBindGroup(this.communicationSelectPipeline.layout, [
      this.paramsBuffer,
      this.positionBuffers[stateRead],
      this.velocityBuffers[stateRead],
      this.roleBuffer,
      this.particleIdHashBuffer,
      this.genomeRsBuffer,
      this.genomeABuffer,
      this.genomeRcBuffer,
      this.genomeKBuffer,
      this.genomeOmegaRBuffer,
      this.genomeOmegaABuffer,
      this.genomeOmegaVBuffer,
      this.activeBuffer,
      this.cellHeadBuffer,
      this.particleNextBuffer,
      this.selectedTargetsBuffer,
      this.selectedCountBuffer,
    ]);
  }

  private createCommunicationTransmitBindGroup(
    stateRead: number,
    incomingWrite: number,
    eventWrite: number,
  ): GPUBindGroup {
    return this.makeBindGroup(this.communicationTransmitPipeline.layout, [
      this.paramsBuffer,
      this.qOutBuffer,
      this.selectedTargetsBuffer,
      this.incomingChargeBuffers[incomingWrite],
      this.senderCountBuffers[eventWrite],
      this.senderBuffers[eventWrite],
      this.targetBuffers[eventWrite],
    ]);
  }

  private createLocalSuccessBindGroup(incomingRead: number): GPUBindGroup {
    return this.makeBindGroup(this.localSuccessPipeline.layout, [
      this.paramsBuffer,
      this.incomingChargeBuffers[incomingRead],
      this.activeBuffer,
      this.selectedCountBuffer,
      this.successfulBuffer,
    ]);
  }

  private createHealthUpdateBindGroup(stateRead: number, stateWrite: number): GPUBindGroup {
    return this.makeBindGroup(this.healthUpdatePipeline.layout, [
      this.paramsBuffer,
      this.healthBuffers[stateRead],
      this.roleBuffer,
      this.genomeHMaxBuffer,
      this.successfulBuffer,
      this.pressureBuffer,
      this.healthBuffers[stateWrite],
    ]);
  }

  private createForceBindGroup(stateRead: number): GPUBindGroup {
    if (this.kernels.forceKernel !== 'linked-list') {
      // Phase 18 layout: see shaderForceSorted.
      return this.makeBindGroup(this.forcePipeline.layout, [
        this.paramsBuffer,
        this.chargeBuffers[stateRead],
        this.roleBuffer,
        this.genomeOmegaRBuffer,
        this.genomeOmegaABuffer,
        this.genomeOmegaVBuffer,
        this.forceBuffer,
        this.cellStartBuffer,
        this.sortedIndexBuffer,
        this.sortedGeoBuffer,
        this.sortedFvBuffer,
      ]);
    }
    return this.makeBindGroup(this.forcePipeline.layout, [
      this.paramsBuffer,
      this.positionBuffers[stateRead],
      this.velocityBuffers[stateRead],
      this.chargeBuffers[stateRead],
      this.roleBuffer,
      this.genomeRsBuffer,
      this.genomeABuffer,
      this.genomeOmegaRBuffer,
      this.genomeOmegaABuffer,
      this.genomeOmegaVBuffer,
      this.cellHeadBuffer,
      this.particleNextBuffer,
      this.forceBuffer,
    ]);
  }

  private createSortBindGroups(stateRead: number): SortBindGroups {
    const count = this.sortCountPipeline;
    const scan = this.sortScanPipeline;
    const scatter = this.sortScatterPipeline;
    if (!count || !scan || !scatter) throw new Error('internal error: sort pipelines were not created');
    return {
      count: this.makeBindGroup(count.layout, [this.paramsBuffer, this.positionBuffers[stateRead], this.cellCountBuffer]),
      scan: this.makeBindGroup(scan.layout, [this.paramsBuffer, this.cellCountBuffer, this.cellStartBuffer]),
      scatter: this.makeBindGroup(scatter.layout, [
        this.paramsBuffer,
        this.positionBuffers[stateRead],
        this.velocityBuffers[stateRead],
        this.genomeRsBuffer,
        this.genomeABuffer,
        this.cellStartBuffer,
        this.cellCountBuffer,
        this.sortedIndexBuffer,
        this.sortedGeoBuffer,
        this.sortedFvBuffer,
      ]),
    };
  }

  private createForceAllPairsBindGroup(stateRead: number): GPUBindGroup {
    return this.makeBindGroup(this.forceAllPairsPipeline.layout, [
      this.paramsBuffer,
      this.positionBuffers[stateRead],
      this.velocityBuffers[stateRead],
      this.chargeBuffers[stateRead],
      this.roleBuffer,
      this.genomeRsBuffer,
      this.genomeABuffer,
      this.genomeOmegaRBuffer,
      this.genomeOmegaABuffer,
      this.genomeOmegaVBuffer,
      this.forceBuffer,
    ]);
  }

  private createMechanicsBindGroup(stateRead: number, stateWrite: number): GPUBindGroup {
    return this.makeBindGroup(this.mechanicsPipeline.layout, [
      this.paramsBuffer,
      this.positionBuffers[stateRead],
      this.velocityBuffers[stateRead],
      this.forceBuffer,
      this.roleBuffer,
      this.genomeMBuffer,
      this.genomeGammaBuffer,
      this.positionBuffers[stateWrite],
      this.velocityBuffers[stateWrite],
    ]);
  }

  /**
   * Apply GPU dynamic state to the persistent CPU population at an explicit
   * synchronization boundary. Phase 5G-B distinguishes the normal timestep
   * synchronization path from exceptional full synchronization; the byte
   * layout is intentionally still identical in both modes until Phase 5G-C.
   */
  private applyDynamicStateToPopulation(
    readback: EvolutionReadback,
    mode: CpuSyncMode,
    context?: {
      survivingIds?: Set<string>;
      previousIncomingSenders?: Map<string, Set<string>>;
      nextIncomingSenders?: Map<string, Set<string>>;
      snapshot?: Snapshot[];
    },
  ): void {
    const snapshot = context?.snapshot ?? this.takeSnapshot();
    const survivingIds = context?.survivingIds ?? new Set(snapshot.map(item => item.id));

    for (let i = 0; i < snapshot.length; i++) {
      const item = snapshot[i];
      if (!survivingIds.has(item.id)) continue;

      const state = this.population.particles.get(item.id);
      if (!state) continue;

      const protectedParticle = item.state.role !== 'internal';
      if (mode === 'full') {
        if (readback.positions && readback.velocities) {
          state.position.x = readback.positions[i * 2];
          state.position.y = readback.positions[i * 2 + 1];
          state.velocity.x = protectedParticle ? 0 : readback.velocities[i * 2];
          state.velocity.y = protectedParticle ? 0 : readback.velocities[i * 2 + 1];
        }
      }
      // Phase 15: assign only when the readback actually covers this slot. A normal-mode
      // readback carries zero-length arrays, which are truthy; Phase 14 therefore wrote
      // `undefined` into health/charge of every surviving particle on every normal step.
      if (readback.healths && i < readback.healths.length) {
        state.health = protectedParticle ? item.state.health : readback.healths[i];
      }
      if (readback.charges && i < readback.charges.length) {
        state.charge = readback.charges[i];
      }

      if (mode === 'normal') {
        // Sender history is CPU metadata used by topology/checkpoint paths.
        // When no population event required event readback this timestep, keep
        // the last CPU copy instead of replacing it with an empty set.
        if (context?.nextIncomingSenders) {
          state.senderSet = new Set(context.nextIncomingSenders.get(item.id) ?? []);
        }
        if (context?.previousIncomingSenders) {
          state.prevSenderSet = new Set(context.previousIncomingSenders.get(item.id) ?? []);
        }
      }
    }
  }

  /**
   * Exceptional synchronization boundary. This intentionally keeps the full
   * dynamic-state readback. In Phase 5F normal sync contains only health; full sync additionally maps
   * position, velocity and charge.
   * Later phases can narrow the normal path without changing these callers.
   */
  private async syncFullCpuStateForSnapshot(snapshot: Snapshot[], reason: FullSyncReason): Promise<void> {
    if (this.particleCount === 0 || snapshot.length === 0) return;
    const prof = this.cpuProfiler;
    const tFull = prof ? prof.now() : 0;

    const commandEncoder = this.device.createCommandEncoder({ label: 'mfm-full-cpu-sync-internal' });
    const readbackLayout = this.getFullReadbackLayout();
    const stateRead = this.stateIndex;

    commandEncoder.copyBufferToBuffer(
      this.positionBuffers[stateRead], 0, this.fullStateReadback,
      readbackLayout.positions, this.particleCount * 8,
    );
    commandEncoder.copyBufferToBuffer(
      this.velocityBuffers[stateRead], 0, this.fullStateReadback,
      readbackLayout.velocities, this.particleCount * 8,
    );
    commandEncoder.copyBufferToBuffer(
      this.healthBuffers[stateRead], 0, this.fullStateReadback,
      readbackLayout.healths, this.particleCount * 4,
    );
    commandEncoder.copyBufferToBuffer(
      this.chargeBuffers[stateRead], 0, this.fullStateReadback,
      readbackLayout.charges, this.particleCount * 4,
    );

    this.device.queue.submit([commandEncoder.finish()]);
    await this.fullStateReadback.mapAsync(MAP_MODE_READ);

    try {
      const mapped = this.fullStateReadback.getMappedRange();
      const readback: EvolutionReadback = {
        positions: new Float32Array(mapped, readbackLayout.positions, this.particleCount * 2),
        velocities: new Float32Array(mapped, readbackLayout.velocities, this.particleCount * 2),
        healths: new Float32Array(mapped, readbackLayout.healths, this.particleCount),
        charges: new Uint32Array(mapped, readbackLayout.charges, this.particleCount),
      };

      this.applyDynamicStateToPopulation(readback, 'full', { snapshot });
    } finally {
      this.fullStateReadback.unmap();
      if (prof) {
        prof.since('sync.fullSyncMs', tFull);
        prof.inc('sync.fullSyncs');
        prof.inc(`sync.fullSyncs.${reason}`);
        prof.inc('readback.roundTrips');
        prof.inc('readback.bytes', this.particleCount * 24);
      }
    }
  }

  /**
   * Explicit, exceptional full GPU -> CPU synchronization of position, velocity, health and
   * charge (24 B per particle, one blocking round trip). Not part of any normal timestep.
   */
  public async syncFullCpuState(reason: FullSyncReason = 'explicit'): Promise<PopulationState> {
    // Worker messages are asynchronous and are not serialized by the browser.
    // If a simulation step is completing, wait for its normal synchronization
    // before starting an exceptional full readback. This prevents the shared
    // staging buffers from being mapped by two operations at once.
    if (this.stepInFlight) {
      await this.stepInFlight;
    }
    await this.drainPipeline(); // Phase 20: GPU state and CPU view must describe the same committed timestep
    if (this.encodedStepPending) {
      throw new Error('Cannot perform a full CPU synchronization before the encoded WebGPU step has been submitted and finished');
    }

    if (!this.initialized) {
      await this.init();
    }

    this.validateConfiguration();

    if (this.populationDirty) {
      await this.recreateGpuBuffers(false);
      this.populationDirty = false;
    }

    if (this.particleCount === 0) return this.population;

    // Phase 15: delegates to the single full-readback implementation (Phase 14 had a second,
    // line-for-line copy here that was also invisible to the profiler counters).
    await this.syncFullCpuStateForSnapshot(this.takeSnapshot(), reason);

    return this.population;
  }

  // -------------------------------------------------------------------------
  // Readback / CPU population update
  // -------------------------------------------------------------------------

  /**
   * Consume the mapped evolution readback while it is valid.
   *
   * Phase 5F removes the persistent CPU mirror introduced in 5D. The normal
   * staging memory contains only health in the normal path; charge is GPU-
   * authoritative and is included only in the separate full-state staging buffer. The callback must not await
   * or retain any mapped view after returning.
   */
  private async withMappedEvolutionState<T>(
    callback: (readback: EvolutionReadback) => T,
    includePositionVelocity = false,
  ): Promise<T> {
    const fullLayout = this.getFullReadbackLayout();
    const particleCount = this.particleCount;

    // Full readback contains the complete dynamic state and is used only at
    // explicit exceptional synchronization boundaries.
    if (includePositionVelocity) {
      await this.fullStateReadback.mapAsync(MAP_MODE_READ);
      try {
        const mapped = this.fullStateReadback.getMappedRange();
        const readback: EvolutionReadback = {
          positions: new Float32Array(mapped, fullLayout.positions, particleCount * 2),
          velocities: new Float32Array(mapped, fullLayout.velocities, particleCount * 2),
          healths: new Float32Array(mapped, fullLayout.healths, particleCount),
          charges: new Uint32Array(mapped, fullLayout.charges, particleCount),
        };
        return callback(readback);
      } finally {
        this.fullStateReadback.unmap();
      }
    }

    // Phase 5G normal evolution has no per-particle readback. The staging
    // buffer remains allocated only for compatibility with the explicit full
    // synchronization API; never map it in the normal path.
    return callback({
      healths: new Float32Array(0),
      charges: new Uint32Array(0),
    });
  }

  /**
   * Phase 15: the first (and, for a quiet timestep, only) GPU round trip of normal
   * synchronization. The counts were copied into `eventSummaryReadback` by the step
   * submission itself, so no queue submission is needed here: mapAsync resolves once the
   * step's GPU work, including that copy, has completed. It therefore also subsumes any
   * separate queue.onSubmittedWorkDone() wait (same queue, in-order).
   */
  private async readPipelinedSummary(
    buffer: GPUBuffer,
    reproductionCompactionEnabled: boolean,
  ): Promise<{ deathCount: number; candidateCount: number; eventCount: number; halted: boolean }> {
    await buffer.mapAsync(MAP_MODE_READ, 0, PIPE_SUMMARY_BYTES);
    try {
      const counts = new Uint32Array(buffer.getMappedRange(0, PIPE_SUMMARY_BYTES).slice(0));
      return {
        deathCount: counts[EVENT_SUMMARY_DEATH_OFFSET / 4] >>> 0,
        candidateCount: reproductionCompactionEnabled ? counts[EVENT_SUMMARY_CANDIDATE_OFFSET / 4] >>> 0 : 0,
        eventCount: counts[EVENT_SUMMARY_EVENT_OFFSET / 4] >>> 0,
        halted: counts[PIPE_SUMMARY_HALTED_OFFSET / 4] !== 0,
      };
    } finally {
      buffer.unmap();
    }
  }

  /** Phase 20: creates the halt flag, the summary ring and the halt-update pass for pipelined stepping (idempotent; per data-buffer generation). */
  private ensurePipelineResources(): void {
    if (this.pipeResourcesReady) return;
    const readWrite = BUFFER_USAGE_STORAGE | BUFFER_USAGE_COPY_SRC | BUFFER_USAGE_COPY_DST;
    const staging = BUFFER_USAGE_MAP_READ | BUFFER_USAGE_COPY_DST;
    this.haltBuffer = this.device.createBuffer({ size: 16, usage: readWrite, label: 'mfm-halt-flag' });
    this.zeroWordBuffer = this.device.createBuffer({ size: 16, usage: readWrite, label: 'mfm-zero-word' });
    this.pipeSummary = [
      this.device.createBuffer({ size: PIPE_SUMMARY_BYTES, usage: staging, label: 'mfm-stage-pipe-summary-0' }),
      this.device.createBuffer({ size: PIPE_SUMMARY_BYTES, usage: staging, label: 'mfm-stage-pipe-summary-1' }),
    ];
    this.haltUpdatePipeline ??= this.makePipeline('mfm-halt-update', SHADER_HALT_UPDATE, [
      { binding: 0, visibility: SHADER_STAGE_COMPUTE, buffer: { type: 'uniform', hasDynamicOffset: true } },
      { binding: 1, visibility: SHADER_STAGE_COMPUTE, buffer: { type: 'read-only-storage' } },
      { binding: 2, visibility: SHADER_STAGE_COMPUTE, buffer: { type: 'read-only-storage' } },
      { binding: 3, visibility: SHADER_STAGE_COMPUTE, buffer: { type: 'storage' } },
    ]);
    const layout = this.haltUpdatePipeline.layout;
    this.haltUpdateGroups = {
      withCandidates: this.makeBindGroup(layout, [this.paramsBuffer, this.deathCandidateCountBuffer, this.reproductionCandidateCountBuffer, this.haltBuffer]),
      withoutCandidates: this.makeBindGroup(layout, [this.paramsBuffer, this.deathCandidateCountBuffer, this.zeroWordBuffer, this.haltBuffer]),
    };
    this.pipeResourcesReady = true;
  }

  private clearHaltFlag(): void {
    if (!this.pipeResourcesReady) return;
    this.device.queue.writeBuffer(this.haltBuffer, 0, new Uint32Array(1));
  }

  /** Whether another step may be submitted while `this.pipe` is non-empty (nothing the CPU must do first, buffers still the same generation). */
  private canSpeculate(): boolean {
    const head = this.pipe[0];
    return (
      this.initialized &&
      this.pipeResourcesReady &&
      !this.populationDirty &&
      this.particleCount > 0 &&
      head !== undefined &&
      head.bufferGeneration === this.bufferGeneration
    );
  }

  private async submitPipelinedStep(): Promise<void> {
    const ahead = this.pipe.length;
    const slot = (this.pipeSeq++ & 1) as 0 | 1;
    const outcome: PipelinedOutcome = { discarded: false, nonQuiet: false };
    const consumedInput = this.pendingInputSignal;
    const consumedError = this.pendingError;
    const prof = this.cpuProfiler;
    const commandEncoder = this.device.createCommandEncoder({ label: `mfm-v3-pipelined-step-${this.timestep + ahead}` });
    prof?.inc('encode.commandEncoders');
    const tEncode = prof ? prof.now() : 0;
    const encoded = await this.prepareEncodedStep(commandEncoder, { ahead, slot, outcome });
    prof?.since('stepUnsafe.encodeMs', tEncode);
    const tSubmit = prof ? prof.now() : 0;
    this.device.queue.submit([commandEncoder.finish()]);
    prof?.since('stepUnsafe.submitMs', tSubmit);
    prof?.inc('submit.queueSubmits');
    this.pipe.push({ encoded, outcome, consumedInput, consumedError, bufferGeneration: this.bufferGeneration });
  }

  private async topUpPipeline(): Promise<void> {
    const depth = this.orchestration.pipelineDepth;
    while (this.pipe.length < depth) {
      if (this.pipe.length > 0 && !this.canSpeculate()) break;
      await this.submitPipelinedStep();
    }
  }

  /**
   * Finishes the oldest in-flight step. Returns true if it committed a timestep, false if it was a discarded no-op/stale step.
   * After a non-quiet step (or a discard) every step still in flight is doomed (the GPU halt flag was set before it started, or its buffers are gone),
   * so they are all finished - and must all be discarded - BEFORE anything new is submitted: a step submitted behind a doomed step would run at the
   * wrong timestep and on the wrong ping-pong parity. A "doomed" step that commits means the halt invariant was violated: fail loudly, never corrupt.
   */
  private async finishPipelineHead(): Promise<boolean> {
    const head = this.pipe[0];
    if (!head) return true;
    try {
      await head.encoded.finishNormalSync();
    } catch (error) {
      this.pipe.length = 0;
      try { this.clearHaltFlag(); } catch { /* best effort */ }
      throw error;
    }
    this.pipe.shift();
    const { discarded, nonQuiet } = head.outcome;
    if (discarded) this.restoreDiscardedStep(head);
    // Resume: after a non-quiet step (handled) or when a no-op reveals the flag is still set, clear it. Queue-ordered after every step submitted so far.
    if (discarded || nonQuiet) this.clearHaltFlag();
    if ((discarded || nonQuiet) && this.pipe.length > 0) {
      const doomed = this.pipe.splice(0);
      for (const step of doomed) {
        try {
          await step.encoded.finishNormalSync();
        } catch (error) {
          this.pipe.length = 0;
          throw error;
        }
        if (!step.outcome.discarded) {
          throw new Error('internal error: a pipelined step committed behind a non-quiet step (halt invariant violated)');
        }
        this.restoreDiscardedStep(step);
      }
      this.clearHaltFlag();
    }
    return !discarded;
  }

  private restoreDiscardedStep(step: PipelinedStep): void {
    this.pipelineDiscards++;
    this.cpuProfiler?.inc('pipeline.discardedSteps');
    // The no-op consumed one-shot external values at encode time; give them back unless something newer arrived.
    if (this.pendingInputSignal === null) this.pendingInputSignal = step.consumedInput;
    if (this.pendingError === null) this.pendingError = step.consumedError;
  }

  private async stepPipelined(): Promise<PopulationState> {
    if (!this.initialized) await this.init();
    for (;;) {
      if (this.pipe.length === 0 && this.particleCount === 0) return this.stepUnsafe();
      await this.topUpPipeline();
      if (await this.finishPipelineHead()) return this.population;
    }
  }

  /**
   * Phase 20: completes every in-flight pipelined step (committing quiet ones, handling a non-quiet one, discarding the no-ops behind it).
   * Afterwards the CPU view and the GPU state describe the same, committed timestep. Called before anything that touches GPU state or
   * the population outside step().
   */
  public async drainPipeline(): Promise<void> {
    while (this.pipe.length > 0) await this.finishPipelineHead();
  }

  /** Number of pipelined steps that had to be discarded and re-submitted (a measure of how often speculation was wasted). */
  public getPipelineDiscards(): number {
    return this.pipelineDiscards;
  }

  /**
   * Phase 20: non-blocking, one-frame-lagged population metrics. Returns the newest COMPLETED sample (or null if none finished yet) and issues a
   * new request for the CURRENT committed state if a staging slot is free. Never awaits: the 8 B/particle readback overlaps the next frame.
   * Values are exact (same sums over the same f32/u32 data as readPopulationMetrics); `timestep` tells which committed step they describe.
   * Call it between step() calls (before the next submission can overwrite the committed state's buffers; the copy itself is queue-ordered).
   */
  public pollPopulationMetrics(): PopulationMetricsSample | null {
    if (!this.initialized) return null;
    if (this.particleCount <= 0) {
      return { count: 0, healthSum: 0, totalCharge: 0, inputCharge: 0, outputCharge: 0, timestep: this.timestep };
    }
    let ready: PopulationMetricsSample | null = null;
    if (this.laggedMetrics) {
      for (const slot of this.laggedMetrics) {
        if (slot.result) {
          if (!ready || slot.result.timestep >= ready.timestep) ready = slot.result;
          slot.result = null;
        }
      }
    }
    this.requestLaggedMetrics();
    return ready;
  }

  private requestLaggedMetrics(): void {
    if (!this.laggedMetrics) {
      const staging = BUFFER_USAGE_MAP_READ | BUFFER_USAGE_COPY_DST;
      this.laggedMetrics = [0, 1].map((i) => ({
        buffer: this.device.createBuffer({ size: Math.max(8, this.capacity * 8), usage: staging, label: `mfm-stage-metrics-lagged-${i}` }),
        pending: false,
        result: null,
      }));
    }
    const slot = this.laggedMetrics.find((candidate) => !candidate.pending && candidate.result === null);
    if (!slot) return; // both slots busy: skip this frame, the next call asks again
    const count = this.particleCount;
    const bytes = count * 4;
    const timestep = this.timestep;
    const io = this.ioSlots;
    const encoder = this.device.createCommandEncoder({ label: 'mfm-population-metrics-lagged' });
    encoder.copyBufferToBuffer(this.chargeBuffers[this.stateIndex], 0, slot.buffer, 0, bytes);
    encoder.copyBufferToBuffer(this.healthBuffers[this.stateIndex], 0, slot.buffer, bytes, bytes);
    this.device.queue.submit([encoder.finish()]);
    slot.pending = true;
    slot.buffer.mapAsync(MAP_MODE_READ, 0, bytes * 2).then(
      () => {
        try {
          const mapped = slot.buffer.getMappedRange(0, bytes * 2);
          const charges = new Uint32Array(mapped, 0, count);
          const healths = new Float32Array(mapped, bytes, count);
          let healthSum = 0;
          let totalCharge = 0;
          for (let i = 0; i < count; i++) {
            healthSum += healths[i];
            totalCharge += charges[i] >>> 0;
          }
          let inputCharge = 0;
          let outputCharge = 0;
          for (const entry of io) {
            if (entry.slot >= count) continue;
            const charge = charges[entry.slot] >>> 0;
            if (entry.role === 1) inputCharge += charge;
            else outputCharge += charge;
          }
          slot.result = { count, healthSum, totalCharge, inputCharge, outputCharge, timestep };
          slot.buffer.unmap();
        } catch {
          slot.result = null; // buffer destroyed meanwhile: drop the sample
        }
        slot.pending = false;
      },
      () => {
        slot.pending = false;
      },
    );
  }

  private async readEventSummary(
    reproductionCompactionEnabled: boolean,
  ): Promise<{ deathCount: number; candidateCount: number; eventCount: number }> {
    await this.eventSummaryReadback.mapAsync(MAP_MODE_READ, 0, EVENT_SUMMARY_BYTES);
    try {
      const counts = new Uint32Array(this.eventSummaryReadback.getMappedRange(0, EVENT_SUMMARY_BYTES).slice(0));
      return {
        deathCount: counts[EVENT_SUMMARY_DEATH_OFFSET / 4] >>> 0,
        candidateCount: reproductionCompactionEnabled ? counts[EVENT_SUMMARY_CANDIDATE_OFFSET / 4] >>> 0 : 0,
        eventCount: counts[EVENT_SUMMARY_EVENT_OFFSET / 4] >>> 0,
      };
    } finally {
      this.eventSummaryReadback.unmap();
    }
  }

  /**
   * Phase 15: second (and last) GPU round trip, only when a death or reproduction
   * candidate exists. One command submission copies every compact list into two
   * staging buffers; both are mapped concurrently, so the CPU waits for one queue
   * completion, not one per list.
   *
   * Staging layout of `reproductionStateReadback` (all offsets 4-byte aligned):
   *   [death slots: deathCount*4][candidate slots: candidateCount*4][geometry: candidateCount*16]
   * `eventDataReadback`: [senders: eventCount*4][targets: eventCount*4]
   */
  private async readPopulationEventPayload(
    deathCount: number,
    candidateCount: number,
    reportedEventCount: number,
    eventBufferIndex: number,
  ): Promise<{
    deathSlots: Uint32Array;
    candidateSlots: Uint32Array;
    geometry: Float32Array;
    eventSenders: Uint32Array;
    eventTargets: Uint32Array;
    bytes: number;
  }> {
    const maxEvents = this.particleCount * this.maxK;
    const eventCount = maxEvents > 0 ? Math.min(reportedEventCount, maxEvents) : 0;

    const deathBytes = deathCount * 4;
    const slotBytes = candidateCount * 4;
    const geometryBytes = candidateCount * 16;
    const compactBytes = deathBytes + slotBytes + geometryBytes;
    const eventBytes = eventCount * 4;

    const encoder = this.device.createCommandEncoder({ label: 'mfm-population-event-readback' });
    if (deathBytes > 0) {
      encoder.copyBufferToBuffer(this.deathCandidateSlotBuffer, 0, this.reproductionStateReadback, 0, deathBytes);
    }
    if (candidateCount > 0) {
      encoder.copyBufferToBuffer(this.reproductionCandidateSlotBuffer, 0, this.reproductionStateReadback, deathBytes, slotBytes);
      encoder.copyBufferToBuffer(this.reproductionCandidateBuffer, 0, this.reproductionStateReadback, deathBytes + slotBytes, geometryBytes);
    }
    if (eventCount > 0) {
      encoder.copyBufferToBuffer(this.senderBuffers[eventBufferIndex], 0, this.eventDataReadback, 0, eventBytes);
      encoder.copyBufferToBuffer(this.targetBuffers[eventBufferIndex], 0, this.eventDataReadback, eventBytes, eventBytes);
    }
    this.device.queue.submit([encoder.finish()]);

    // No queue.onSubmittedWorkDone(): mapAsync on a buffer written by the submission above
    // resolves only after that submission completes, so a separate wait added a redundant
    // second GPU->CPU completion round trip.
    const pending: Promise<void>[] = [];
    if (compactBytes > 0) pending.push(this.reproductionStateReadback.mapAsync(MAP_MODE_READ, 0, compactBytes));
    if (eventCount > 0) pending.push(this.eventDataReadback.mapAsync(MAP_MODE_READ, 0, eventBytes * 2));

    try {
      await Promise.all(pending);

      let deathSlots = new Uint32Array(0);
      let candidateSlots = new Uint32Array(0);
      let geometry = new Float32Array(0);
      if (compactBytes > 0) {
        const compact = this.reproductionStateReadback.getMappedRange(0, compactBytes);
        deathSlots = new Uint32Array(compact.slice(0, deathBytes));
        candidateSlots = new Uint32Array(compact.slice(deathBytes, deathBytes + slotBytes));
        geometry = new Float32Array(compact.slice(deathBytes + slotBytes, compactBytes));
      }

      let eventSenders = new Uint32Array(0);
      let eventTargets = new Uint32Array(0);
      if (eventCount > 0) {
        const data = this.eventDataReadback.getMappedRange(0, eventBytes * 2);
        eventSenders = new Uint32Array(data.slice(0, eventBytes));
        eventTargets = new Uint32Array(data.slice(eventBytes, eventBytes * 2));
      }

      return { deathSlots, candidateSlots, geometry, eventSenders, eventTargets, bytes: compactBytes + eventBytes * 2 };
    } finally {
      // unmap() is a no-op on an unmapped buffer and cancels a still-pending map, so a
      // rejected mapAsync cannot leave either staging buffer stuck for the next step.
      this.reproductionStateReadback.unmap();
      this.eventDataReadback.unmap();
    }
  }

  private createOffspring(
    snapshot: Snapshot[],
    survivingIds: Set<string>,
    reproductionCandidateIds: Set<string>,
  ): Array<{ id: string; genome: Genome; state: ParticleState }> {
    const offspring: Array<{ id: string; genome: Genome; state: ParticleState }> = [];

    if (
      this.config.mating_probability <= 0 ||
      survivingIds.size >= this.config.Nmax
    ) {
      return offspring;
    }

    const candidates = snapshot.filter((item) =>
      item.state.role === 'internal' &&
      survivingIds.has(item.id) &&
      reproductionCandidateIds.has(item.id),
    );

    const matingRadius = this.config.R_mate * (this.config.mate_radius_percent / 100);

    for (let i = 0; i < candidates.length && survivingIds.size + offspring.length < this.config.Nmax; i++) {
      for (
        let j = i + 1;
        j < candidates.length && survivingIds.size + offspring.length < this.config.Nmax;
        j++
      ) {
        const first = candidates[i];
        const second = candidates[j];

        if (
          this.periodicDistance(first.state.position, second.state.position) > matingRadius ||
          this.rng.nextFloat() >= this.config.mating_probability
        ) {
          continue;
        }

        const id = `offspring-${this.timestep}-${survivingIds.size + offspring.length}`;
        const childGenome = first.genome.crossover(second.genome, this.rng).mutate(this.rng);

        const baseX = (first.state.position.x + second.state.position.x) / 2;
        const baseY = (first.state.position.y + second.state.position.y) / 2;
        const position = this.wrap({
          x: baseX + (this.rng.nextFloat() - 0.5) * 2 * this.config.Lx * 0.01,
          y: baseY + (this.rng.nextFloat() - 0.5) * 2 * this.config.Ly * 0.01,
        });

        const velocity = {
          x: (first.state.velocity.x + second.state.velocity.x) / 2 + (this.rng.nextFloat() - 0.5) * 2 * 0.01,
          y: (first.state.velocity.y + second.state.velocity.y) / 2 + (this.rng.nextFloat() - 0.5) * 2 * 0.01,
        };

        offspring.push({
          id,
          genome: childGenome,
          state: new ParticleState({
            version: first.state.version,
            position,
            velocity,
            health: childGenome.H_max * this.config.birth_health_percent,
            charge: 0,
            senderSet: new Set(),
            prevSenderSet: new Set(),
            role: 'internal',
          }),
        });
      }
    }

    return offspring;
  }

  // -------------------------------------------------------------------------
  // CPU reference helpers
  // -------------------------------------------------------------------------

  /**
   * Phase 5G: population-event decisions are driven by compact GPU slot lists.
   * CPU health is intentionally not consulted here because it is no longer a
   * source of truth for dynamic evolution.
   */
  private takeSnapshot(): Snapshot[] {
    // Phase 4.3: reuse the same Snapshot objects across timesteps. The
    // snapshot is only a transient view over the persistent PopulationState;
    // it does not own ParticleState or Genome instances.
    const snapshot = this.snapshotScratch;
    let index = 0;

    for (const [id, state] of this.population.particles) {
      const genome = this.population.genomes.get(id);
      if (!genome) continue;

      const existing = snapshot[index];
      if (existing) {
        existing.id = id;
        existing.state = state;
        existing.genome = genome;
      } else {
        snapshot.push({ id, state, genome });
      }
      index++;
    }

    snapshot.length = index;
    return snapshot;
  }

  private computeQOut(genome: Genome): number {
    const amplification = Math.fround(genome.A);
    const theta = Math.fround(
      this.clampInteger(genome.theta_q, 0, UINT32_MAX),
    );

    const produced = Math.floor(
      Math.fround(amplification * theta) + 0.5,
    );

    return this.clampInteger(produced, 0, UINT32_MAX);
  }

  private findInputSlot(snapshot: Snapshot[]): number {
    const explicit = snapshot.findIndex((item) => item.state.role === 'input');
    return explicit >= 0 ? explicit : 0;
  }

  /**
   * Rebuild the CPU slot mapping after a topology change or PopulationState
   * replacement. Stable timesteps intentionally do not call this method.
   *
   * The insertion order of PopulationState.particles is the canonical slot
   * order used when GPU buffers are uploaded/recreated.
   */
  private refreshCpuSlotMapping(): void {
    this.topologyEpoch++; // Phase 20
    this.slotToId.length = 0;
    this.idToSlot.clear();

    const roles = new Uint8Array(this.population.particles.size);
    const ioSlots: Array<{ slot: number; role: 1 | 2 }> = [];
    for (const [id, state] of this.population.particles) {
      const slot = this.slotToId.length;
      this.idToSlot.set(id, slot);
      this.slotToId.push(id);
      roles[slot] = state.role === 'input' ? 1 : state.role === 'output' ? 2 : 0;
      if (roles[slot] !== 0) ioSlots.push({ slot, role: roles[slot] as 1 | 2 });
    }
    this.slotRoles = roles;
    this.ioSlots = ioSlots; // replaced, never mutated: lagged-metrics callbacks keep the array they were issued with

    this.particleCount = this.slotToId.length;
  }

  private ensurePopulationFitsCapacity(): void {
    if (this.population.particles.size > Math.max(1, this.config.Nmax)) {
      throw new Error(
        `Population size ${this.population.particles.size} exceeds MFM Nmax ${this.config.Nmax}`,
      );
    }
  }

  private computeRequiredMaxK(): number {
    let maxK = 0;
    for (const [id] of this.population.particles) {
      const genome = this.population.genomes.get(id);
      if (genome) maxK = Math.max(maxK, Math.max(0, Math.floor(genome.K)));
    }
    return maxK;
  }

  private computeGridSpec(): { countX: number; countY: number; cellSize: number } {
    let maxRc = 0;
    for (const [id] of this.population.particles) {
      const genome = this.population.genomes.get(id);
      if (genome) maxRc = Math.max(maxRc, Math.max(0, genome.R_c));
    }

    const maxInteractionRange = Math.max(maxRc, this.config.R_s_max, EPSILON);
    const area = this.config.Lx * this.config.Ly;
    const minimumCellSizeForBudget = Math.sqrt(area / MAX_GRID_CELLS);
    const cellSize = Math.max(maxInteractionRange, minimumCellSizeForBudget);
    const countX = Math.max(1, Math.floor(this.config.Lx / cellSize));
    const countY = Math.max(1, Math.floor(this.config.Ly / cellSize));
    return { countX, countY, cellSize };
  }

  private validateConfiguration(): void {
    const c = this.config;
    const invalid = (name: string, value: unknown) => {
      throw new Error(`Invalid MFM/WebGPU configuration: ${name}=${String(value)}`);
    };

    if (!(c.Nmax >= 1)) invalid('Nmax', c.Nmax);
    if (!(c.Qmax > 0)) invalid('Qmax', c.Qmax);
    if (!(c.Q_in_max >= 0)) invalid('Q_in_max', c.Q_in_max);
    if (!(c.Lx > 0)) invalid('Lx', c.Lx);
    if (!(c.Ly > 0)) invalid('Ly', c.Ly);
    if (!(c.dt >= 0)) invalid('dt', c.dt);
    if (!(c.R_s_min >= 0 && c.R_s_max >= c.R_s_min && c.R_s_max > 0)) invalid('R_s_min/R_s_max', `${c.R_s_min}/${c.R_s_max}`);

    const maxK = this.computeRequiredMaxK();
    if (maxK > 0x7fffffff) invalid('K', maxK);
    if ((maxK + 1) * UNIFORM_DYNAMIC_STRIDE > 65536) invalid('K', `${maxK} exceeds dynamic uniform-buffer capacity`);

    // Prevent the GPU integer charge representation from overflowing in normal
    // configured operation. The model cap itself remains Qmax.
    if (c.Qmax > UINT32_MAX) invalid('Qmax', c.Qmax);
    if (c.Q_in_max > UINT32_MAX) invalid('Q_in_max', c.Q_in_max);
    if (c.delta_q < 0 || c.delta_q > UINT32_MAX) invalid('delta_q', c.delta_q);
  }

  /**
   * Phase 16: refresh the CPU image of every rank block and upload it. Block r (r < max(1, maxK)) holds rank r at
   * byte offset r * UNIFORM_DYNAMIC_STRIDE; non-rank dispatches bind offset 0 (rank 0). Phase 15 wrote block 0
   * (rank 0) AND block 1 (rank 0) with identical bytes, allocated a fresh ArrayBuffer + DataView for each, and
   * issued 1 + maxK writes. Every field except `rank` is identical across blocks, so block 0 is filled once and
   * copied. All fields are still recomputed from this.config every step (no cross-step caching of config values).
   */
  private writeStepParams(inputSignal: number, inputSlot: number, globalPressure: number): void {
    const view = this.paramsView;
    const scratch = this.paramsScratch;
    this.fillParamsBlock0(inputSignal, inputSlot, globalPressure);
    for (let rank = 1; rank < this.paramBlocks; rank++) {
      const base = rank * UNIFORM_DYNAMIC_STRIDE;
      scratch.copyWithin(base, 0, UNIFORM_BUFFER_SIZE);
      view.setUint32(base + 12, rank >>> 0, true);
    }

    const queue = this.device.queue;
    let writes: number;
    let bytes: number;
    if (this.orchestration.packParamWrites && this.paramBlocks > 1) {
      // One contiguous write; the 144 B between blocks are padding (zero) that no kernel reads.
      bytes = (this.paramBlocks - 1) * UNIFORM_DYNAMIC_STRIDE + UNIFORM_BUFFER_SIZE;
      queue.writeBuffer(this.paramsBuffer, 0, scratch, 0, bytes);
      writes = 1;
    } else {
      for (let rank = 0; rank < this.paramBlocks; rank++) {
        const base = rank * UNIFORM_DYNAMIC_STRIDE;
        queue.writeBuffer(this.paramsBuffer, base, scratch, base, UNIFORM_BUFFER_SIZE);
      }
      writes = this.paramBlocks;
      bytes = this.paramBlocks * UNIFORM_BUFFER_SIZE;
    }
    const prof = this.cpuProfiler;
    if (prof) {
      prof.inc('encode.writeBuffers', writes);
      prof.inc('encode.writeBytes', bytes);
    }
  }

  private fillParamsBlock0(inputSignal: number, inputSlot: number, globalPressure: number): void {
    const view = this.paramsView;
    view.setUint32(0, this.particleCount, true);
    view.setUint32(4, this.capacity, true);
    view.setUint32(8, this.maxK, true);
    view.setUint32(12, 0, true);
    view.setUint32(16, (this.timestep + this.encodeTimestepAhead) >>> 0, true);
    view.setUint32(20, this.seed, true);
    view.setUint32(24, this.clampInteger(this.config.Qmax, 0, UINT32_MAX), true);
    view.setUint32(28, this.clampInteger(this.config.Q_in_max, 0, UINT32_MAX), true);
    view.setUint32(32, this.clampInteger(this.config.delta_q, 0, UINT32_MAX), true);
    view.setFloat32(36, inputSignal, true);
    view.setFloat32(40, globalPressure, true);
    view.setFloat32(44, this.config.Lx, true);
    view.setFloat32(48, this.config.Ly, true);
    view.setFloat32(52, this.config.R_s_min, true);
    view.setFloat32(56, this.config.R_s_max, true);
    view.setFloat32(60, this.config.communication_alpha, true);
    view.setFloat32(64, this.config.dt, true);
    view.setFloat32(68, EPSILON, true);
    view.setFloat32(72, this.config.beta, true);
    view.setFloat32(76, this.config.lambda, true);
    view.setUint32(80, Math.max(0, inputSlot) >>> 0, true);
    view.setUint32(84, this.gridCountX >>> 0, true);
    view.setUint32(88, this.gridCountY >>> 0, true);
    view.setFloat32(92, this.gridCellSize, true);
    view.setFloat32(96, this.config.P_min, true);
    view.setFloat32(100, this.config.P_max, true);
    view.setFloat32(104, this.config.pressure_gamma, true);
    view.setUint32(108, 0, true); // Phase 20: params.halted
  }

  private encodeRole(role: ParticleState['role']): number {
    if (role === 'input') return ROLE_INPUT;
    if (role === 'output') return ROLE_OUTPUT;
    return ROLE_INTERNAL;
  }

  private hashParticleId(id: string): number {
    // FNV-1a gives a stable identity-derived 32-bit token without making the
    // logical string ID equivalent to the physical slot index.
    let hash = 2166136261 >>> 0;
    for (let i = 0; i < id.length; i++) {
      hash ^= id.charCodeAt(i);
      hash = Math.imul(hash, 16777619) >>> 0;
    }
    return hash >>> 0;
  }

  private clampInteger(value: number, min: number, max: number): number {
    if (!Number.isFinite(value)) return min;
    return Math.min(max, Math.max(min, Math.round(value))) >>> 0;
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }

  private periodicDistance(a: { x: number; y: number }, b: { x: number; y: number }): number {
    const dx = this.periodicDeltaComponent(b.x - a.x, this.config.Lx);
    const dy = this.periodicDeltaComponent(b.y - a.y, this.config.Ly);
    return Math.hypot(dx, dy);
  }

  private periodicDeltaComponent(delta: number, size: number): number {
    return delta - size * Math.round(delta / size);
  }

  private wrap(v: { x: number; y: number }): { x: number; y: number } {
    return {
      x: v.x - Math.floor(v.x / this.config.Lx) * this.config.Lx,
      y: v.y - Math.floor(v.y / this.config.Ly) * this.config.Ly,
    };
  }
}

// ---------------------------------------------------------------------------
// WGSL shaders
// ---------------------------------------------------------------------------

const COMMON = /* wgsl */ `
struct Params {
  activeCount: u32,
  capacity: u32,
  maxK: u32,
  rank: u32,
  timestep: u32,
  seed: u32,
  qmax: u32,
  qinMax: u32,
  deltaQ: u32,
  inputSignal: f32,
  globalPressure: f32,
  lx: f32,
  ly: f32,
  rsMin: f32,
  rsMax: f32,
  communicationAlpha: f32,
  dt: f32,
  epsilon: f32,
  beta: f32,
  lambda: f32,
  inputSlot: u32,
  gridCountX: u32,
  gridCountY: u32,
  gridCellSize: f32,
  pMin: f32,
  pMax: f32,
  pressureGamma: f32,
  // Phase 20: nonzero = this timestep is a no-op (every kernel returns immediately). Written 0 by the CPU; in pipelined mode a GPU copy
  // of the halt flag overwrites it at the start of the step, so a step submitted behind a non-quiet step cannot modify any state.
  halted: u32,
};

@group(0) @binding(0) var<uniform> params: Params;

fn jsRound(x: f32) -> f32 {
  return floor(x + 0.5);
}

fn torusDelta(delta: f32, extent: f32) -> f32 {
  return delta - extent * jsRound(delta / extent);
}

fn wrapCoordinate(x: f32, extent: f32) -> f32 {
  return x - floor(x / extent) * extent;
}

fn periodicDelta(a: vec2<f32>, b: vec2<f32>) -> vec2<f32> {
  return vec2<f32>(
    torusDelta(b.x - a.x, params.lx),
    torusDelta(b.y - a.y, params.ly),
  );
}

fn feature(value: f32, scale: f32) -> f32 {
  return clamp(value / scale, 0.0, 1.0);
}

fn mixHash(x0: u32) -> u32 {
  var x = x0;
  x ^= x >> 16u;
  x *= 0x7feb352du;
  x ^= x >> 15u;
  x *= 0x846ca68bu;
  x ^= x >> 16u;
  return x;
}

fn random01(idHash: u32, rank: u32) -> f32 {
  let seed = params.seed ^ idHash ^ (params.timestep * 0x9e3779b9u) ^ (rank * 0x85ebca6bu);
  return f32(mixHash(seed) & 0x00ffffffu) / 16777216.0;
}
`;

export const SHADER_GRID_CLEAR = /* wgsl */ `${COMMON}
@group(0) @binding(1) var<storage, read_write> cellHead: array<atomic<u32>>;

@compute @workgroup_size(${WORKGROUP_SIZE})
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (params.halted != 0u) { return; }
  let cell = gid.x;
  let cellCount = params.gridCountX * params.gridCountY;
  if (cell >= cellCount) { return; }
  atomicStore(&cellHead[cell], 0xffffffffu);
}
`;

export const SHADER_GRID_BUILD = /* wgsl */ `${COMMON}
@group(0) @binding(1) var<storage, read> positions: array<vec2<f32>>;
@group(0) @binding(2) var<storage, read_write> cellHead: array<atomic<u32>>;
@group(0) @binding(3) var<storage, read_write> particleNext: array<u32>;

@compute @workgroup_size(${WORKGROUP_SIZE})
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (params.halted != 0u) { return; }
  let i = gid.x;
  if (i >= params.activeCount) { return; }

  let px = wrapCoordinate(positions[i].x, params.lx);
  let py = wrapCoordinate(positions[i].y, params.ly);

  let cx = min(u32(floor(px / params.gridCellSize)), params.gridCountX - 1u);
  let cy = min(u32(floor(py / params.gridCellSize)), params.gridCountY - 1u);
  let cell = cy * params.gridCountX + cx;

  let oldHead = atomicExchange(&cellHead[cell], i);
  particleNext[i] = oldHead;
}
`;

const SHADER_CHARGE_PROCESS = `${COMMON}
@group(0) @binding(1) var<storage, read> chargeIn: array<u32>;
@group(0) @binding(2) var<storage, read> incomingCharge: array<u32>;
@group(0) @binding(3) var<storage, read> role: array<u32>;
@group(0) @binding(4) var<storage, read> thetaQ: array<u32>;
@group(0) @binding(5) var<storage, read> amplification: array<f32>;
@group(0) @binding(6) var<storage, read_write> qResidual: array<u32>;
@group(0) @binding(7) var<storage, read_write> activeFlags: array<u32>;
@group(0) @binding(8) var<storage, read_write> qOut: array<u32>;

@compute @workgroup_size(${WORKGROUP_SIZE})
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (params.halted != 0u) { return; }
  let i = gid.x;
  if (i >= params.activeCount) {return;}

  let inputCharge = select(0u, min(params.qinMax, u32(jsRound(f32(params.qinMax) * params.inputSignal))), i == params.inputSlot);

  let qPre = chargeIn[i] + incomingCharge[i] + inputCharge;
  let theta = thetaQ[i];
  let isActive = qPre >= theta;
  activeFlags[i] = select(0u, 1u, isActive);

  let produced = select(0.0, jsRound(amplification[i] * f32(theta)), isActive);
  qOut[i] = u32(clamp(produced, 0.0, 4294967295.0));
  var residual = qPre;

  if (isActive) {
    residual = qPre - theta;
  }
  
  qResidual[i] = residual;
}
`;

const SHADER_CHARGE_FINALIZE = /* wgsl */ `${COMMON}
@group(0) @binding(1) var<storage, read> qResidual: array<u32>;
@group(0) @binding(2) var<storage, read_write> chargeOut: array<u32>;

@compute @workgroup_size(${WORKGROUP_SIZE})
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (params.halted != 0u) { return; }
  let i = gid.x;
  if (i >= params.activeCount) { return; }

  let residual = qResidual[i];
  let postDecay = select(0u, residual - min(residual, params.deltaQ), residual > 0u);
  chargeOut[i] = min(params.qmax, postDecay);
}
`;

const SHADER_PRESSURE = /* wgsl */ `${COMMON}
@group(0) @binding(1) var<storage, read> charges: array<u32>;
@group(0) @binding(2) var<storage, read> role: array<u32>;
@group(0) @binding(3) var<storage, read_write> pressureOut: array<f32>;

@compute @workgroup_size(1)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (params.halted != 0u) { return; }
  if (gid.x != 0u) { return; }

  // params.globalPressure >= 0 means setGlobalError() supplied an explicit
  // error value. Otherwise derive the error from Q_n of output particles.
  var error = params.globalPressure;
  if (error < 0.0) {
    var outputCharge = 0.0;
    var outputCount = 0.0;
    for (var i = 0u; i < params.activeCount; i++) {
      if (role[i] == ${ROLE_OUTPUT}u) {
        outputCharge += f32(charges[i]);
        outputCount += 1.0;
      }
    }
    if (outputCount == 0.0) {
      error = 0.0;
    } else {
      error = 1.0 - min(1.0, outputCharge / (outputCount * f32(params.qmax)));
    }
  }

  pressureOut[0] = params.pMin +
    (params.pMax - params.pMin) * pow(error, params.pressureGamma);
}
`;

const SHADER_COMMUNICATION_SELECT = /* wgsl */ `${COMMON}
@group(0) @binding(1) var<storage, read> positions: array<vec2<f32>>;
@group(0) @binding(2) var<storage, read> velocities: array<vec2<f32>>;
@group(0) @binding(3) var<storage, read> role: array<u32>;
@group(0) @binding(4) var<storage, read> idHash: array<u32>;
@group(0) @binding(5) var<storage, read> targetRs: array<f32>;
@group(0) @binding(6) var<storage, read> targetA: array<f32>;
@group(0) @binding(7) var<storage, read> sourceRc: array<f32>;
@group(0) @binding(8) var<storage, read> sourceK: array<u32>;
@group(0) @binding(9) var<storage, read> omegaR: array<f32>;
@group(0) @binding(10) var<storage, read> omegaA: array<f32>;
@group(0) @binding(11) var<storage, read> omegaV: array<f32>;
@group(0) @binding(12) var<storage, read> activeFlags: array<u32>;
@group(0) @binding(13) var<storage, read_write> cellHead: array<atomic<u32>>;
@group(0) @binding(14) var<storage, read> particleNext: array<u32>;
@group(0) @binding(15) var<storage, read_write> selectedTargets: array<u32>;
@group(0) @binding(16) var<storage, read_write> selectedCount: array<u32>;

fn score(source: u32, targetIndex: u32) -> f32 {
  return omegaR[source] * feature(targetRs[targetIndex], params.rsMax)
    + omegaA[source] * feature(targetA[targetIndex], 10.0)
    + omegaV[source] * feature(length(velocities[targetIndex]), 10.0);
}

fn isSelected(source: u32, targetIndex: u32) -> bool {
  let base = source * params.maxK;
  for (var r = 0u; r < params.rank; r++) {
    if (selectedTargets[base + r] == targetIndex) { return true; }
  }
  return false;
}

fn wrappedCell(c: i32, count: u32) -> u32 {
  let m = i32(count);
  var x = c % m;
  if (x < 0) { x += m; }
  return u32(x);
}

@compute @workgroup_size(${WORKGROUP_SIZE})
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (params.halted != 0u) { return; }
  let i = gid.x;
  if (i >= params.activeCount || params.maxK == 0u) { return; }

  let writeIndex = i * params.maxK + params.rank;
  selectedTargets[writeIndex] = 0xffffffffu;

  if (activeFlags[i] == 0u || role[i] == 2u || params.rank >= sourceK[i]) { return; }

  let cx = i32(min(u32(floor(positions[i].x / params.gridCellSize)), params.gridCountX - 1u));
  let cy = i32(min(u32(floor(positions[i].y / params.gridCellSize)), params.gridCountY - 1u));

  let sourceRange = sourceRc[i];
  let sourceRangeSquared = sourceRange * sourceRange;

  var maxScore = 0.0;
  for (var oy = -1; oy <= 1; oy++) {
    if (params.gridCountY == 1u && oy != 0) { continue; }
    if (params.gridCountY == 2u && oy == 1) { continue; }
    for (var ox = -1; ox <= 1; ox++) {
      if (params.gridCountX == 1u && ox != 0) { continue; }
      if (params.gridCountX == 2u && ox == 1) { continue; }

      let nx = wrappedCell(cx + ox, params.gridCountX);
      let ny = wrappedCell(cy + oy, params.gridCountY);
      let cell = ny * params.gridCountX + nx;
      
      var j = atomicLoad(&cellHead[cell]);

      for (var hop = 0u; hop < params.activeCount; hop++) {
        if (j == 0xffffffffu) {
            break;
        }
        if (j >= params.activeCount) {
            break;
        }

        if (j != i && role[j] != ${ROLE_INPUT}u && !isSelected(i, j)) {
          let delta = periodicDelta(positions[i], positions[j]);
          let d2 = dot(delta, delta);
          if (d2 <= sourceRangeSquared) {
            maxScore = max(maxScore, score(i, j));
          }
        }

        let next = particleNext[j];
        if (next == j) {
            break;
        }
        j = next;
      }
    }
  }

  var totalWeight = 0.0;
  for (var oy = -1; oy <= 1; oy++) {
    if (params.gridCountY == 1u && oy != 0) { continue; }
    if (params.gridCountY == 2u && oy == 1) { continue; }
    for (var ox = -1; ox <= 1; ox++) {
      if (params.gridCountX == 1u && ox != 0) { continue; }
      if (params.gridCountX == 2u && ox == 1) { continue; }

      let nx = wrappedCell(cx + ox, params.gridCountX);
      let ny = wrappedCell(cy + oy, params.gridCountY);
      let cell = ny * params.gridCountX + nx;
      var j = atomicLoad(&cellHead[cell]);

      for (var hop = 0u; hop < params.activeCount; hop++) {
        if (j == 0xffffffffu) {
            break;
        }
        if (j >= params.activeCount) {
            break;
        }

        if (j != i && role[j] != ${ROLE_INPUT}u && !isSelected(i, j)) {
          let delta = periodicDelta(positions[i], positions[j]);
          let d2 = dot(delta, delta);
          if (d2 <= sourceRangeSquared) {
            totalWeight += exp(params.communicationAlpha * (score(i, j) - maxScore));
          }
        }

        let next = particleNext[j];
        if (next == j) {
            break;
        }
        j = next;
      }
    }
  }

  if (!(totalWeight > 0.0)) { return; }

  let sample = random01(idHash[i], params.rank) * totalWeight;
  var cumulative = 0.0;
  var chosen = 0xffffffffu;

  for (var oy = -1; oy <= 1; oy++) {
    if (params.gridCountY == 1u && oy != 0) { continue; }
    if (params.gridCountY == 2u && oy == 1) { continue; }
    for (var ox = -1; ox <= 1; ox++) {
      if (params.gridCountX == 1u && ox != 0) { continue; }
      if (params.gridCountX == 2u && ox == 1) { continue; }

      let nx = wrappedCell(cx + ox, params.gridCountX);
      let ny = wrappedCell(cy + oy, params.gridCountY);
      let cell = ny * params.gridCountX + nx;
      var j = atomicLoad(&cellHead[cell]);

      for (var hop = 0u; hop < params.activeCount; hop++) {
        if (j == 0xffffffffu) {
            break;
        }
        if (j >= params.activeCount) {
            break;
        }

        if (j != i && role[j] != ${ROLE_INPUT}u && !isSelected(i, j)) {
          let delta = periodicDelta(positions[i], positions[j]);
          let d2 = dot(delta, delta);
          if (d2 <= sourceRangeSquared) {
            let weight = exp(params.communicationAlpha * (score(i, j) - maxScore));
            cumulative += weight;
            if (sample < cumulative) {
              chosen = j;
              break;
            }
          }
        }

        let next = particleNext[j];
        if (next == j) {
            break;
        }
        j = next;
      }
      if (chosen != 0xffffffffu) { break; }
    }
    if (chosen != 0xffffffffu) { break; }
  }

  selectedTargets[writeIndex] = chosen;
  if (chosen != 0xffffffffu) {
    selectedCount[i] = selectedCount[i] + 1u;
  }
}
`;

const SHADER_COMMUNICATION_TRANSMIT = /* wgsl */ `${COMMON}
@group(0) @binding(1) var<storage, read> qOut: array<u32>;
@group(0) @binding(2) var<storage, read> selectedTargets: array<u32>;
@group(0) @binding(3) var<storage, read_write> incomingNext: array<atomic<u32>>;
@group(0) @binding(4) var<storage, read_write> eventCount: atomic<u32>;
@group(0) @binding(5) var<storage, read_write> eventSender: array<u32>;
@group(0) @binding(6) var<storage, read_write> eventTarget: array<u32>;

@compute @workgroup_size(${WORKGROUP_SIZE})
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (params.halted != 0u) { return; }
  let sender = gid.x;
  if (sender >= params.activeCount || params.maxK == 0u || params.rank >= params.maxK) { return; }

  let targetIndex = selectedTargets[sender * params.maxK + params.rank];
  if (targetIndex == 0xffffffffu) { return; }

  atomicAdd(&incomingNext[targetIndex], qOut[sender]);

  let eventIndex = atomicAdd(&eventCount, 1u);
  if (eventIndex < params.activeCount * params.maxK) {
    eventSender[eventIndex] = sender;
    eventTarget[eventIndex] = targetIndex;
  }
}
`;

const SHADER_LOCAL_SUCCESS = /* wgsl */ `${COMMON}
@group(0) @binding(1) var<storage, read> incomingPrevious: array<u32>;
@group(0) @binding(2) var<storage, read> activeFlags: array<u32>;
@group(0) @binding(3) var<storage, read> selectedCount: array<u32>;
@group(0) @binding(4) var<storage, read_write> successful: array<u32>;

@compute @workgroup_size(${WORKGROUP_SIZE})
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (params.halted != 0u) { return; }
  let i = gid.x;
  if (i >= params.activeCount) { return; }

  let received = incomingPrevious[i] > 0u || (i == params.inputSlot && params.inputSignal > 0.0);
  let hasTargets = selectedCount[i] > 0u;
  successful[i] = select(0u, 1u, received && activeFlags[i] != 0u && hasTargets);
}
`;

const SHADER_HEALTH_UPDATE = /* wgsl */ `${COMMON}
@group(0) @binding(1) var<storage, read> healthIn: array<f32>;
@group(0) @binding(2) var<storage, read> role: array<u32>;
@group(0) @binding(3) var<storage, read> hmax: array<f32>;
@group(0) @binding(4) var<storage, read> successful: array<u32>;
@group(0) @binding(5) var<storage, read> pressure: array<f32>;
@group(0) @binding(6) var<storage, read_write> healthOut: array<f32>;

@compute @workgroup_size(${WORKGROUP_SIZE})
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (params.halted != 0u) { return; }
  let i = gid.x;
  if (i >= params.activeCount) { return; }

  if (role[i] != 0u) {
    healthOut[i] = healthIn[i];
    return;
  }

  let reward = select(0.0, 1.0, successful[i] != 0u);
  healthOut[i] = clamp(
    healthIn[i] + params.beta * reward - params.lambda * pressure[0],
    0.0,
    hmax[i],
  );
}
`;

/** Phase 17: exported only so kernel-selftest.ts can compile the exact shipped WGSL. */
export const SHADER_DEATH_COMPACTION = /* wgsl */ `${COMMON}
@group(0) @binding(1) var<storage, read> healthOut: array<f32>;
@group(0) @binding(2) var<storage, read> role: array<u32>;
@group(0) @binding(3) var<storage, read_write> deathCount: array<u32>;
@group(0) @binding(4) var<storage, read_write> deathSlots: array<u32>;
@compute @workgroup_size(${WORKGROUP_SIZE})
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (params.halted != 0u) { return; }
  if (gid.x != 0u) { return; }
  var count = 0u;
  for (var i = 0u; i < params.activeCount; i++) {
    if (role[i] == ${ROLE_INTERNAL}u && healthOut[i] <= 0.0) {
      deathSlots[count] = i;
      count++;
    }
  }
  deathCount[0] = count;
}
`;

/**
 * Phase 17: parallel, stable replacement for SHADER_DEATH_COMPACTION. ONE workgroup walks the particles in tiles of
 * WORKGROUP_SIZE; each tile does an inclusive Hillis-Steele scan of the "dies" flags in workgroup memory and writes each
 * dying slot at base + (inclusive scan - 1). Because tiles are processed in order and the scan is positional, the output is
 * identical to the serial loop: same deathCount, same ascending deathSlots, no atomics, no dependence on thread scheduling.
 * All barriers are in uniform control flow (loop bounds derive from the uniform params.activeCount).
 */
export const SHADER_DEATH_COMPACTION_PARALLEL = /* wgsl */ `${COMMON}
@group(0) @binding(1) var<storage, read> healthOut: array<f32>;
@group(0) @binding(2) var<storage, read> role: array<u32>;
@group(0) @binding(3) var<storage, read_write> deathCount: array<u32>;
@group(0) @binding(4) var<storage, read_write> deathSlots: array<u32>;
var<workgroup> scanBuf: array<u32, ${WORKGROUP_SIZE}>;
@compute @workgroup_size(${WORKGROUP_SIZE})
fn main(@builtin(local_invocation_index) lid: u32) {
  if (params.halted != 0u) { return; }
  let n = params.activeCount;
  var base = 0u;
  for (var tile = 0u; tile < n; tile += ${WORKGROUP_SIZE}u) {
    let i = tile + lid;
    var flag = 0u;
    if (i < n && role[i] == ${ROLE_INTERNAL}u && healthOut[i] <= 0.0) {
      flag = 1u;
    }
    scanBuf[lid] = flag;
    workgroupBarrier();
    for (var offset = 1u; offset < ${WORKGROUP_SIZE}u; offset = offset << 1u) {
      var addend = 0u;
      if (lid >= offset) {
        addend = scanBuf[lid - offset];
      }
      workgroupBarrier();
      scanBuf[lid] = scanBuf[lid] + addend;
      workgroupBarrier();
    }
    let inclusive = scanBuf[lid];
    let tileTotal = scanBuf[${WORKGROUP_SIZE - 1}u];
    if (flag == 1u) {
      deathSlots[base + inclusive - 1u] = i;
    }
    base += tileTotal;
    workgroupBarrier();
  }
  if (lid == 0u) {
    deathCount[0] = base;
  }
}
`;

/**
 * Phase 19: blocked, stable death compaction (see DeathCompactionMode). Exactly one workgroup (the production dispatch is 1).
 *   1. invocation t owns particles [t*chunk, min((t+1)*chunk, n)), chunk = ceil(n / 256), and counts its dying particles;
 *   2. the 256 counts are scanned once (Hillis-Steele, barriers in uniform control flow: constant trip count);
 *   3. if the total is 0 the kernel stores deathCount = 0 and returns (the common case: no second pass over the data);
 *   4. otherwise invocation t writes its dying particles at deathSlots[exclusivePrefix(t) + k] in ascending particle order.
 * Chunks are contiguous and processed in invocation order, so the output equals the serial loop's: same count, same ascending slots,
 * no atomics, no dependence on thread scheduling.
 */
export const SHADER_DEATH_COMPACTION_BLOCKED = /* wgsl */ `${COMMON}
@group(0) @binding(1) var<storage, read> healthOut: array<f32>;
@group(0) @binding(2) var<storage, read> role: array<u32>;
@group(0) @binding(3) var<storage, read_write> deathCount: array<u32>;
@group(0) @binding(4) var<storage, read_write> deathSlots: array<u32>;
var<workgroup> chunkCounts: array<u32, 256>;
@compute @workgroup_size(256)
fn main(@builtin(local_invocation_index) lid: u32) {
  if (params.halted != 0u) { return; }
  let n = params.activeCount;
  let chunk = (n + 255u) / 256u;
  let first = min(lid * chunk, n);
  let last = min(first + chunk, n);

  var count = 0u;
  for (var i = first; i < last; i++) {
    if (role[i] == ${ROLE_INTERNAL}u && healthOut[i] <= 0.0) {
      count++;
    }
  }
  chunkCounts[lid] = count;
  workgroupBarrier();

  for (var offset = 1u; offset < 256u; offset = offset << 1u) {
    var addend = 0u;
    if (lid >= offset) {
      addend = chunkCounts[lid - offset];
    }
    workgroupBarrier();
    chunkCounts[lid] = chunkCounts[lid] + addend;
    workgroupBarrier();
  }

  let total = chunkCounts[255];
  if (lid == 0u) {
    deathCount[0] = total;
  }
  if (count == 0u) { return; }

  var slot = chunkCounts[lid] - count;
  for (var i = first; i < last; i++) {
    if (role[i] == ${ROLE_INTERNAL}u && healthOut[i] <= 0.0) {
      deathSlots[slot] = i;
      slot++;
    }
  }
}
`;

/**
 * Phase 20: last pass of an executed pipelined step. Sets the GPU halt flag when this step produced a death or a reproduction candidate (the same
 * predicate the CPU uses to decide that the step is non-quiet). A step that was itself halted (params.halted != 0) returns before touching anything,
 * so the flag stays set until the CPU clears it.
 */
export const SHADER_HALT_UPDATE = /* wgsl */ `${COMMON}
@group(0) @binding(1) var<storage, read> deathCount: array<u32>;
@group(0) @binding(2) var<storage, read> candidateCount: array<u32>;
@group(0) @binding(3) var<storage, read_write> halt: array<u32>;
@compute @workgroup_size(1)
fn main() {
  if (params.halted != 0u) { return; }
  if (deathCount[0] > 0u || candidateCount[0] > 0u) {
    halt[0] = 1u;
  }
}
`;

const SHADER_REPRODUCTION_COMPACTION = /* wgsl */ `${COMMON}
@group(0) @binding(1) var<storage, read> positions: array<vec2<f32>>;
@group(0) @binding(2) var<storage, read> velocities: array<vec2<f32>>;
@group(0) @binding(3) var<storage, read> healthIn: array<f32>;
@group(0) @binding(4) var<storage, read> healthOut: array<f32>;
@group(0) @binding(5) var<storage, read> role: array<u32>;
@group(0) @binding(6) var<storage, read> mateThreshold: array<f32>;
@group(0) @binding(7) var<storage, read> successful: array<u32>;
@group(0) @binding(8) var<storage, read_write> candidateCount: array<u32>;
@group(0) @binding(9) var<storage, read_write> candidateGeometry: array<vec4<f32>>;
@group(0) @binding(10) var<storage, read_write> candidateSlots: array<u32>;
@compute @workgroup_size(${WORKGROUP_SIZE})
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (params.halted != 0u) { return; }
  if (gid.x != 0u) { return; }
  var count = 0u;
  for (var i = 0u; i < params.activeCount; i++) {
    let eligible = role[i] == ${ROLE_INTERNAL}u && healthIn[i] >= mateThreshold[i] && successful[i] != 0u && healthOut[i] > 0.0;
    if (!eligible) { continue; }
    candidateSlots[count] = i;
    candidateGeometry[count] = vec4<f32>(positions[i].x, positions[i].y, velocities[i].x, velocities[i].y);
    count++;
  }
  candidateCount[0] = count;
}
`;

export const shaderForce = (workgroupSize: number): string => /* wgsl */ `${COMMON}
@group(0) @binding(1) var<storage, read> positions: array<vec2<f32>>;
@group(0) @binding(2) var<storage, read> velocities: array<vec2<f32>>;
@group(0) @binding(3) var<storage, read> charges: array<u32>;
@group(0) @binding(4) var<storage, read> role: array<u32>;
@group(0) @binding(5) var<storage, read> targetRs: array<f32>;
@group(0) @binding(6) var<storage, read> targetA: array<f32>;
@group(0) @binding(7) var<storage, read> omegaR: array<f32>;
@group(0) @binding(8) var<storage, read> omegaA: array<f32>;
@group(0) @binding(9) var<storage, read> omegaV: array<f32>;
@group(0) @binding(10) var<storage, read_write> cellHead: array<atomic<u32>>;
@group(0) @binding(11) var<storage, read> particleNext: array<u32>;
@group(0) @binding(12) var<storage, read_write> force: array<vec2<f32>>;

fn wrappedCell(c: i32, count: u32) -> u32 {
  let m = i32(count);
  var x = c % m;
  if (x < 0) { x += m; }
  return u32(x);
}

@compute @workgroup_size(${workgroupSize})
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (params.halted != 0u) { return; }
  let i = gid.x;
  if (i >= params.activeCount) { return; }

  if (role[i] != 0u) {
    force[i] = vec2<f32>(0.0, 0.0);
    return;
  }

  let q = f32(charges[i]);
  let range = params.rsMin + (params.rsMax - params.rsMin) * (q / f32(params.qmax));
  let rangeSquared = range * range;
  if (!(range > 0.0)) {
    force[i] = vec2<f32>(0.0, 0.0);
    return;
  }

  let cx = i32(min(u32(floor(positions[i].x / params.gridCellSize)), params.gridCountX - 1u));
  let cy = i32(min(u32(floor(positions[i].y / params.gridCellSize)), params.gridCountY - 1u));
  var fx = 0.0;
  var fy = 0.0;

  for (var oy = -1; oy <= 1; oy++) {
    if (params.gridCountY == 1u && oy != 0) { continue; }
    if (params.gridCountY == 2u && oy == 1) { continue; }
    for (var ox = -1; ox <= 1; ox++) {
      if (params.gridCountX == 1u && ox != 0) { continue; }
      if (params.gridCountX == 2u && ox == 1) { continue; }

      let nx = wrappedCell(cx + ox, params.gridCountX);
      let ny = wrappedCell(cy + oy, params.gridCountY);
      let cell = ny * params.gridCountX + nx;
      var j = atomicLoad(&cellHead[cell]);

      for (var hop = 0u; hop < params.activeCount; hop++) {
        if (j == 0xffffffffu) {
            break;
        }
        if (j >= params.activeCount) {
            break;
        }

        if (i != j) {
          let delta = periodicDelta(positions[i], positions[j]);
          let distanceSquared = dot(delta, delta);

          if (distanceSquared > 0.0 && distanceSquared <= rangeSquared) {
            let distance = sqrt(distanceSquared);

            let spatialScore = omegaR[i] * feature(targetRs[j], params.rsMax)
              + omegaA[i] * feature(targetA[j], 10.0)
              + omegaV[i] * feature(length(velocities[j]), 10.0);

            let magnitude = spatialScore * (1.0 - distance / range);
            let forceFactor = magnitude / (distance + params.epsilon);
            fx += forceFactor * delta.x;
            fy += forceFactor * delta.y;
          }
        }

        let next = particleNext[j];
        if (next == j) {
            break;
        }
        j = next;
      }
    }
  }

  force[i] = vec2<f32>(fx, fy);
}
`;

// ---------------------------------------------------------------------------
// Phase 18 — cell-sorted grid force.
//
// Pass order: clearBuffer(cellCount) -> sortCount -> sortScan -> sortScatter -> force (sorted variants).
// The cell of a particle is computed exactly as SHADER_GRID_BUILD does (wrap, floor, clamp to the last cell), so the
// sorted layout and the linked-list grid always agree on cell membership.
// ---------------------------------------------------------------------------
const SORT_CELL_FN = /* wgsl */ `
fn sortCellOf(p: vec2<f32>) -> u32 {
  let px = wrapCoordinate(p.x, params.lx);
  let py = wrapCoordinate(p.y, params.ly);
  let cx = min(u32(floor(px / params.gridCellSize)), params.gridCountX - 1u);
  let cy = min(u32(floor(py / params.gridCellSize)), params.gridCountY - 1u);
  return cy * params.gridCountX + cx;
}
`;

export const SHADER_SORT_COUNT = /* wgsl */ `${COMMON}${SORT_CELL_FN}
@group(0) @binding(1) var<storage, read> positions: array<vec2<f32>>;
@group(0) @binding(2) var<storage, read_write> cellCount: array<atomic<u32>>;

@compute @workgroup_size(${WORKGROUP_SIZE})
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (params.halted != 0u) { return; }
  let i = gid.x;
  if (i >= params.activeCount) { return; }
  atomicAdd(&cellCount[sortCellOf(positions[i])], 1u);
}
`;

/**
 * Exclusive prefix sum of the per-cell counts, by ONE workgroup of 256 invocations: each invocation serially sums a
 * contiguous chunk of cells, the 256 chunk sums are scanned (Hillis-Steele, barriers between phases), then each
 * invocation writes the starts of its chunk. cellStart[cells] receives the total (so a cell's range is always
 * [cellStart[c], cellStart[c + 1])). The counters are re-zeroed here so sortScatter can reuse them as cursors.
 * One workgroup is enough: cells <= MAX_GRID_CELLS (262144) means at most 1024 serial additions per invocation, and
 * typical grids (14 x 14 cells at N = 10000) are one cell per invocation.
 */
export const SHADER_SORT_SCAN = /* wgsl */ `${COMMON}
@group(0) @binding(1) var<storage, read_write> cellCount: array<atomic<u32>>;
@group(0) @binding(2) var<storage, read_write> cellStart: array<u32>;

var<workgroup> chunkSums: array<u32, 256>;

@compute @workgroup_size(256)
fn main(@builtin(local_invocation_index) lid: u32) {
  if (params.halted != 0u) { return; }
  let cells = params.gridCountX * params.gridCountY;
  let chunk = (cells + 255u) / 256u;
  let first = min(lid * chunk, cells);
  let last = min(first + chunk, cells);

  var total = 0u;
  for (var c = first; c < last; c++) {
    total += atomicLoad(&cellCount[c]);
  }
  chunkSums[lid] = total;
  workgroupBarrier();

  for (var offset = 1u; offset < 256u; offset <<= 1u) {
    var addend = 0u;
    if (lid >= offset) { addend = chunkSums[lid - offset]; }
    workgroupBarrier();
    chunkSums[lid] = chunkSums[lid] + addend;
    workgroupBarrier();
  }

  var run = 0u;
  if (lid > 0u) { run = chunkSums[lid - 1u]; }
  for (var c = first; c < last; c++) {
    let n = atomicLoad(&cellCount[c]);
    cellStart[c] = run;
    run += n;
    atomicStore(&cellCount[c], 0u);
  }
  if (lid == 255u) { cellStart[cells] = chunkSums[255u]; }
}
`;

/**
 * Scatter: slot = cellStart[cell] + cursor++. Also pre-computes, ONCE per particle instead of once per (particle,
 * neighbour) pair, the three loop-invariant neighbour features of the force law:
 *   sortedGeo = (x, y, feature(Rs, rsMax), feature(A, 10)),  sortedFv = feature(|v|, 10)
 * using the very same feature()/length() expressions as the linked-list kernel.
 */
export const SHADER_SORT_SCATTER = /* wgsl */ `${COMMON}${SORT_CELL_FN}
@group(0) @binding(1) var<storage, read> positions: array<vec2<f32>>;
@group(0) @binding(2) var<storage, read> velocities: array<vec2<f32>>;
@group(0) @binding(3) var<storage, read> targetRs: array<f32>;
@group(0) @binding(4) var<storage, read> targetA: array<f32>;
@group(0) @binding(5) var<storage, read> cellStart: array<u32>;
@group(0) @binding(6) var<storage, read_write> cellCursor: array<atomic<u32>>;
@group(0) @binding(7) var<storage, read_write> sortedIndex: array<u32>;
@group(0) @binding(8) var<storage, read_write> sortedGeo: array<vec4<f32>>;
@group(0) @binding(9) var<storage, read_write> sortedFv: array<f32>;

@compute @workgroup_size(${WORKGROUP_SIZE})
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (params.halted != 0u) { return; }
  let i = gid.x;
  if (i >= params.activeCount) { return; }
  let p = positions[i];
  let cell = sortCellOf(p);
  let slot = cellStart[cell] + atomicAdd(&cellCursor[cell], 1u);
  sortedIndex[slot] = i;
  sortedGeo[slot] = vec4<f32>(p.x, p.y, feature(targetRs[i], params.rsMax), feature(targetA[i], 10.0));
  sortedFv[slot] = feature(length(velocities[i]), 10.0);
}
`;

/**
 * Cell-sorted force (bindings: 0 params, 1 charges, 2 role, 3..5 omegaR/A/V, 6 force, 7 cellStart, 8 sortedIndex, 9 sortedGeo, 10 sortedFv;
 * 10 storage buffers, fewer than the linked-list kernel's 12). Thread s handles the particle stored in sorted slot s, so the threads of a workgroup share cells
 * (uniform trip counts, the same neighbour ranges, cache-friendly). Everything after the candidate enumeration is the
 * Phase 5..17 arithmetic: same range, same distance test, same (1 - d/range)/(d + eps) law, same score expression.
 * `cull` additionally skips a neighbour cell when the distance from the particle to the cell rectangle already exceeds the
 * range (+1e-4 cell sizes of slack against f32 rounding of cell assignment). The rectangle edges account for the
 * wider last cell and for the periodic images of the wrapped cells; it is enabled only when both axes have >= 4 cells.
 */
export const shaderForceSorted = (workgroupSize: number, cull: boolean): string => /* wgsl */ `${COMMON}
@group(0) @binding(1) var<storage, read> charges: array<u32>;
@group(0) @binding(2) var<storage, read> role: array<u32>;
@group(0) @binding(3) var<storage, read> omegaR: array<f32>;
@group(0) @binding(4) var<storage, read> omegaA: array<f32>;
@group(0) @binding(5) var<storage, read> omegaV: array<f32>;
@group(0) @binding(6) var<storage, read_write> force: array<vec2<f32>>;
@group(0) @binding(7) var<storage, read> cellStart: array<u32>;
@group(0) @binding(8) var<storage, read> sortedIndex: array<u32>;
@group(0) @binding(9) var<storage, read> sortedGeo: array<vec4<f32>>;
@group(0) @binding(10) var<storage, read> sortedFv: array<f32>;

fn wrappedCell(c: i32, count: u32) -> u32 {
  let m = i32(count);
  var x = c % m;
  if (x < 0) { x += m; }
  return u32(x);
}

fn cellLower(k: i32, count: u32, cs: f32, extent: f32) -> f32 {
  if (k < 0) { return f32(count - 1u) * cs - extent; }
  return f32(k) * cs;
}

fn cellUpper(k: i32, count: u32, cs: f32, extent: f32) -> f32 {
  if (k < 0) { return 0.0; }
  let last = i32(count) - 1;
  if (k == last) { return extent; }
  if (k > last) { return extent + cs; }
  return f32(k + 1) * cs;
}

fn axisGap(p: f32, lower: f32, upper: f32) -> f32 {
  return max(max(lower - p, p - upper), 0.0);
}

@compute @workgroup_size(${workgroupSize})
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (params.halted != 0u) { return; }
  let s = gid.x;
  if (s >= params.activeCount) { return; }
  let i = sortedIndex[s];

  if (role[i] != 0u) {
    force[i] = vec2<f32>(0.0, 0.0);
    return;
  }

  let q = f32(charges[i]);
  let range = params.rsMin + (params.rsMax - params.rsMin) * (q / f32(params.qmax));
  let rangeSquared = range * range;
  if (!(range > 0.0)) {
    force[i] = vec2<f32>(0.0, 0.0);
    return;
  }

  let pos = sortedGeo[s].xy;
  let cx = i32(min(u32(floor(pos.x / params.gridCellSize)), params.gridCountX - 1u));
  let cy = i32(min(u32(floor(pos.y / params.gridCellSize)), params.gridCountY - 1u));
  let wR = omegaR[i];
  let wA = omegaA[i];
  let wV = omegaV[i];
  let cullEnabled = ${cull ? 'params.gridCountX >= 4u && params.gridCountY >= 4u' : 'false'};
  let reach = range + 0.0001 * params.gridCellSize;
  let reachSquared = reach * reach;
  var fx = 0.0;
  var fy = 0.0;

  for (var oy = -1; oy <= 1; oy++) {
    if (params.gridCountY == 1u && oy != 0) { continue; }
    if (params.gridCountY == 2u && oy == 1) { continue; }
    var rowGap = 0.0;
    if (cullEnabled) {
      let ky = cy + oy;
      rowGap = axisGap(
        pos.y,
        cellLower(ky, params.gridCountY, params.gridCellSize, params.ly),
        cellUpper(ky, params.gridCountY, params.gridCellSize, params.ly),
      );
    }
    for (var ox = -1; ox <= 1; ox++) {
      if (params.gridCountX == 1u && ox != 0) { continue; }
      if (params.gridCountX == 2u && ox == 1) { continue; }
      if (cullEnabled) {
        let kx = cx + ox;
        let colGap = axisGap(
          pos.x,
          cellLower(kx, params.gridCountX, params.gridCellSize, params.lx),
          cellUpper(kx, params.gridCountX, params.gridCellSize, params.lx),
        );
        if (colGap * colGap + rowGap * rowGap > reachSquared) { continue; }
      }

      let nx = wrappedCell(cx + ox, params.gridCountX);
      let ny = wrappedCell(cy + oy, params.gridCountY);
      let cell = ny * params.gridCountX + nx;
      let begin = cellStart[cell];
      let end = cellStart[cell + 1u];

      for (var k = begin; k < end; k++) {
        if (k == s) { continue; }
        let g = sortedGeo[k];
        let delta = periodicDelta(pos, g.xy);
        let distanceSquared = dot(delta, delta);

        if (distanceSquared > 0.0 && distanceSquared <= rangeSquared) {
          let distance = sqrt(distanceSquared);
          let spatialScore = wR * g.z + wA * g.w + wV * sortedFv[k];
          let magnitude = spatialScore * (1.0 - distance / range);
          let forceFactor = magnitude / (distance + params.epsilon);
          fx += forceFactor * delta.x;
          fy += forceFactor * delta.y;
        }
      }
    }
  }

  force[i] = vec2<f32>(fx, fy);
}
`;

const SHADER_FORCE_ALL_PAIRS = /* wgsl */ `${COMMON}
@group(0) @binding(1) var<storage, read> positions: array<vec2<f32>>;
@group(0) @binding(2) var<storage, read> velocities: array<vec2<f32>>;
@group(0) @binding(3) var<storage, read> charges: array<u32>;
@group(0) @binding(4) var<storage, read> role: array<u32>;
@group(0) @binding(5) var<storage, read> targetRs: array<f32>;
@group(0) @binding(6) var<storage, read> targetA: array<f32>;
@group(0) @binding(7) var<storage, read> omegaR: array<f32>;
@group(0) @binding(8) var<storage, read> omegaA: array<f32>;
@group(0) @binding(9) var<storage, read> omegaV: array<f32>;
@group(0) @binding(10) var<storage, read_write> force: array<vec2<f32>>;

@compute @workgroup_size(${WORKGROUP_SIZE})
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (params.halted != 0u) { return; }
  let i = gid.x;
  if (i >= params.activeCount) { return; }

  if (role[i] != 0u) {
    force[i] = vec2<f32>(0.0, 0.0);
    return;
  }

  let q = f32(charges[i]);

  let range =
    params.rsMin +
    (params.rsMax - params.rsMin) *
    (q / f32(params.qmax));

  if (!(range > 0.0)) {
    force[i] = vec2<f32>(0.0, 0.0);
    return;
  }

  var fx = 0.0;
  var fy = 0.0;

  // Exact all-pairs equivalent of the CPU reference:
  // every particle j is considered, then the spatial range
  // and periodic distance decide whether it contributes.
  for (var j = 0u; j < params.activeCount; j++) {
    if (j == i) {
      continue;
    }

    let delta = periodicDelta(
      positions[i],
      positions[j]
    );

    let distance = length(delta);

    if (distance == 0.0 || distance > range) {
      continue;
    }

    let spatialScore =
      omegaR[i] * feature(targetRs[j], params.rsMax) +
      omegaA[i] * feature(targetA[j], 10.0) +
      omegaV[i] * feature(length(velocities[j]), 10.0);

    let magnitude =
      spatialScore *
      (1.0 - distance / range);

    let forceFactor =
      magnitude /
      (distance + params.epsilon);

    fx += forceFactor * delta.x;
    fy += forceFactor * delta.y;
  }

  force[i] = vec2<f32>(fx, fy);
}
`;

const SHADER_MECHANICS = /* wgsl */ `${COMMON}
@group(0) @binding(1) var<storage, read> positionsIn: array<vec2<f32>>;
@group(0) @binding(2) var<storage, read> velocitiesIn: array<vec2<f32>>;
@group(0) @binding(3) var<storage, read> force: array<vec2<f32>>;
@group(0) @binding(4) var<storage, read> role: array<u32>;
@group(0) @binding(5) var<storage, read> mass: array<f32>;
@group(0) @binding(6) var<storage, read> gamma: array<f32>;
@group(0) @binding(7) var<storage, read_write> positionsOut: array<vec2<f32>>;
@group(0) @binding(8) var<storage, read_write> velocitiesOut: array<vec2<f32>>;

@compute @workgroup_size(${WORKGROUP_SIZE})
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (params.halted != 0u) { return; }
  let i = gid.x;
  if (i >= params.activeCount) { return; }

  if (role[i] != 0u) {
    positionsOut[i] = positionsIn[i];
    velocitiesOut[i] = vec2<f32>(0.0, 0.0);
    return;
  }

  let v = velocitiesIn[i];
  let acceleration = (force[i] - gamma[i] * v) / mass[i];
  let nextV = v + params.dt * acceleration;
  let nextP = positionsIn[i] + params.dt * nextV;

  positionsOut[i] = vec2<f32>(
    wrapCoordinate(nextP.x, params.lx),
    wrapCoordinate(nextP.y, params.ly),
  );
  velocitiesOut[i] = nextV;
}
`;