/// <reference lib="webworker" />
/// <reference lib="dom" />
import { MfmCpuReference } from '@cepc/cpu-reference';
import { RenderPipeline } from '@cepc/webgpu-core';
import { MetricsReducer } from '@cepc/webgpu-core';
import { ParticleState, PopulationState, Genome, MFMConfig, ParticleID } from '@cepc/shared-config';
import { MfmWebGPUStepper, CpuSectionProfiler, aggregateCpuRecords } from '@cepc/webgpu-mfm';
import { createBenchmarkScenario } from '@cepc/shared-config';
import type { BenchmarkParameters } from '@cepc/shared-config';

type GPUCanvasContext = {
  configure(options: { device: GPUDevice; format: string; alphaMode?: string }): void;
  getCurrentTexture(): { createView(): GPUTextureView };
};

type WorkerGPUAdapter = {
  readonly limits: {
    readonly maxStorageBuffersPerShaderStage: number;
  };
  // Phase 14: feature-detect timestamp-query support before requesting it.
  // GPUSupportedFeatures is Set-like; `has()` is all this file relies on.
  readonly features?: { has(name: string): boolean };
  requestDevice(descriptor?: {
    requiredLimits?: {
      maxStorageBuffersPerShaderStage?: number;
    };
    requiredFeatures?: string[];
  }): Promise<GPUDevice>;
};

type WorkerGPU = {
  requestAdapter(options?: { powerPreference?: 'low-power' | 'high-performance' }): Promise<WorkerGPUAdapter | null>;
  getPreferredCanvasFormat(): string;
};

type WorkerNavigatorWithGPU = Navigator & {
  gpu?: WorkerGPU;
};

const workerScope = self as typeof self & {
  postMessage(message: unknown, transfer?: Transferable[]): void;
};

// Worker state
let offscreen: OffscreenCanvas | null = null;
let webgpuCanvas: OffscreenCanvas | null = null;
let isPaused = false;
let stepsPerFrame = 1;
let timestep = 0;
let lastRenderTime = 0;
let workerFps = 0;
let inputSignal = 0;
let backend: 'CPU' | 'WebGPU' = 'CPU';

 let simulation: MfmCpuReference | MfmWebGPUStepper | null = null;  
 let population: PopulationState | null = null;
 let renderPipeline: RenderPipeline | null = null;
 let metricsReducer: MetricsReducer | null = null;

  
 let device: GPUDevice | null = null;
 let webgpuReady = false;
let webgpuContext: GPUCanvasContext | null = null;
const globalError = 5.5;
let frameInFlight = false;

// Phase 14 instrumentation. Both are no-ops unless a benchmark run or
// 'setProfiling' explicitly turns them on; the disabled cost is one
// module-level null check per instrumented site.
let workerProfiler: CpuSectionProfiler | null = null;
let benchmarkRunning = false;

let currentConfig: MFMConfig | null = null;
let initializationRandomState = 1;
let camera = { x: 0, y: 0, zoom: 1 };
let pointer = { x: 0.5, y: 0.5, inside: false };
let grabbedIds: string[] = [];
let grabAnchor: { x: number; y: number } | null = null;
let grabRangePercent = 0.05;
let inspectedTemplate: { role: 'internal' | 'input' | 'output'; genome: Record<string, unknown> } | null = null;

function nextRandom(): number {
  let value = initializationRandomState;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  initializationRandomState = value >>> 0;
  return initializationRandomState / 0xffffffff;
}

function randomBetween(min: number, max: number): number {
  return min + (max - min) * nextRandom();
}

function wrapCoordinate(value: number, size: number): number {
  return ((value % size) + size) % size;
}

function pointerToWorld(): { x: number; y: number } | null {
  if (!currentConfig || !pointer.inside) return null;
  const width = currentConfig.Lx / camera.zoom;
  const height = currentConfig.Ly / camera.zoom;
  return {
    x: wrapCoordinate(camera.x - width / 2 + pointer.x * width, currentConfig.Lx),
    y: wrapCoordinate(camera.y - height / 2 + pointer.y * height, currentConfig.Ly),
  };
}

function resetCamera(): void {
  if (!currentConfig) return;
  camera = { x: currentConfig.Lx / 2, y: currentConfig.Ly / 2, zoom: 1 };
}

function moveCamera(dx: number, dy: number): void {
  if (!currentConfig) return;
  const width = currentConfig.Lx / camera.zoom;
  const height = currentConfig.Ly / camera.zoom;
  camera.x = wrapCoordinate(camera.x + dx * width, currentConfig.Lx);
  camera.y = wrapCoordinate(camera.y + dy * height, currentConfig.Ly);
}

function changeZoom(delta: number): void {
  if (!currentConfig) return;
  const anchor = pointer.inside ? pointer : { x: 0.5, y: 0.5 };
  const oldWidth = currentConfig.Lx / camera.zoom;
  const oldHeight = currentConfig.Ly / camera.zoom;
  const anchoredWorld = {
    x: wrapCoordinate(camera.x - oldWidth / 2 + anchor.x * oldWidth, currentConfig.Lx),
    y: wrapCoordinate(camera.y - oldHeight / 2 + anchor.y * oldHeight, currentConfig.Ly),
  };
  camera.zoom = Math.max(1, Math.min(10, camera.zoom + delta));
  const newWidth = currentConfig.Lx / camera.zoom;
  const newHeight = currentConfig.Ly / camera.zoom;
  camera.x = wrapCoordinate(anchoredWorld.x - (anchor.x - 0.5) * newWidth, currentConfig.Lx);
  camera.y = wrapCoordinate(anchoredWorld.y - (anchor.y - 0.5) * newHeight, currentConfig.Ly);
}

function updateRenderUniforms(): void {
  if (!renderPipeline || !currentConfig) return;
  renderPipeline.setUniforms(currentConfig.Hmax, currentConfig.Qmax, 0.01, 0.02, camera.x, camera.y, camera.zoom, currentConfig.Lx, currentConfig.Ly);
}

function varied(value: number, variation: number, minimum: number): number {
  // Relative noise is symmetric around the base value and preserves its sign.
  return Math.max(minimum, value * (1 + randomBetween(-variation, variation)));
}

/**
 * 5G-H — Keep the worker-side PopulationState as a persistent topology view
 * instead of treating it as a per-timestep mirror of GPU dynamic state.
 *
 * WebGPU remains authoritative for position/velocity/health/charge. A normal
 * synchronization may change particle membership, genome and role, but it must
 * not overwrite dynamic state for particles that already existed in the CPU
 * view. Full synchronization is still used by exceptional paths that genuinely
 * need an exact CPU snapshot.
 */
function mergeNormalPopulationTopology(nextPopulation: PopulationState): PopulationState {
  if (!population) return nextPopulation;

  const merged = new PopulationState();

  for (const [id, nextState] of nextPopulation.particles) {
    const genome = nextPopulation.genomes.get(id);
    if (!genome) continue;

    const previousState = population.particles.get(id);

    if (!previousState) {
      // New particles need an initial CPU view. This is birth/topology data,
      // not a per-timestep mirror of an already-existing GPU particle.
      merged.addParticle(id, genome.clone(), new ParticleState({
        version: nextState.version,
        position: { ...nextState.position },
        velocity: { ...nextState.velocity },
        health: nextState.health,
        charge: nextState.charge,
        senderSet: new Set(nextState.senderSet),
        prevSenderSet: new Set(nextState.prevSenderSet),
        role: nextState.role,
      }));
      continue;
    }

    // Existing particles keep the last explicitly synchronized dynamic state.
    // Only topology/event metadata is refreshed on the normal path.
    merged.addParticle(id, genome.clone(), new ParticleState({
      version: previousState.version,
      position: { ...previousState.position },
      velocity: { ...previousState.velocity },
      health: previousState.health,
      charge: previousState.charge,
      senderSet: new Set(nextState.senderSet),
      prevSenderSet: new Set(nextState.prevSenderSet),
      role: nextState.role,
    }));
  }

  return merged;
}

/**
 * 5G-I — Explicit synchronization contract.
 *
 * The worker no longer treats synchronization as an implicit side effect of
 * every simulation step. Callers must choose the required consistency level:
 *
 *   normal   -> topology/event view produced by finishNormalSync()
 *   partial  -> requested subset, when the GPU stepper exposes a partial API
 *   full     -> exact CPU snapshot of the complete dynamic state
 *   onDemand -> partial when available, otherwise an explicit full fallback
 *
 * The optional partial method is feature-detected so this worker remains
 * compatible with the current 5G-G stepper while defining the 5G-I boundary.
 */
type WebGPUSyncMode = 'normal' | 'partial' | 'full' | 'onDemand';
type WebGPUSyncField =
  | 'topology'
  | 'position'
  | 'velocity'
  | 'health'
  | 'charge'
  | 'dynamic';

type WebGPUSyncRequest = {
  mode: WebGPUSyncMode;
  fields?: WebGPUSyncField[];
  particleIds?: ParticleID[];
  reason?: string;
};

type WebGPUSyncResult = {
  requestedMode: WebGPUSyncMode;
  appliedMode: WebGPUSyncMode;
  fallback: boolean;
  reason?: string;
};

async function syncWebGPUState(request: WebGPUSyncRequest): Promise<WebGPUSyncResult> {
  if (!(simulation instanceof MfmWebGPUStepper)) {
    return {
      requestedMode: request.mode,
      appliedMode: 'full',
      fallback: true,
      reason: 'WebGPU simulation is not active',
    };
  }

  if (request.mode === 'normal') {
    // Normal synchronization is completed by encodeAndSubmitWebGPUStep(),
    // because finishNormalSync() belongs to the encoded timestep transaction.
    return {
      requestedMode: request.mode,
      appliedMode: 'normal' as WebGPUSyncResult['appliedMode'],
      fallback: false,
      reason: request.reason,
    };
  }

  const stepper = simulation as unknown as {
    syncPartialCpuState?: (request: {
      fields?: WebGPUSyncField[];
      particleIds?: ParticleID[];
      reason?: string;
    }) => Promise<void>;
  };

  const wantsPartial = request.mode === 'partial' || request.mode === 'onDemand';
  if (wantsPartial && typeof stepper.syncPartialCpuState === 'function') {
    await stepper.syncPartialCpuState({
      fields: request.fields,
      particleIds: request.particleIds,
      reason: request.reason,
    });
    population = simulation.getPopulation();
    return {
      requestedMode: request.mode,
      appliedMode: 'partial',
      fallback: false,
      reason: request.reason,
    };
  }

  // Current 5G-G compatibility path: the installed stepper exposes full
  // synchronization but not a selective readback API yet. Keep the fallback
  // explicit rather than silently pretending a partial readback happened.
  await simulation.syncFullCpuState();
  population = simulation.getPopulation();
  return {
    requestedMode: request.mode,
    appliedMode: 'full',
    fallback: wantsPartial,
    reason: wantsPartial
      ? `${request.reason ?? 'on-demand synchronization'}: partial API unavailable; full snapshot used`
      : request.reason,
  };
}

async function syncFullWebGPUState(reason = 'explicit full synchronization'): Promise<void> {
  await syncWebGPUState({ mode: 'full', reason });
}

async function advanceSimulationStep(): Promise<void> {
  if (!simulation) return;
  injectInputSignal();
  setGlobalErrorInSimulation();
  const wp = workerProfiler;
  const t = wp ? wp.now() : 0;
  await simulation.step();
  wp?.since('worker.headlessStepMs', t);
  population = simulation.getPopulation();
  timestep++;
}

/** Phase 3: one GPU simulation timestep + render pass in one command submit. */
async function encodeAndSubmitWebGPUStep(): Promise<void> {
  if (!(simulation instanceof MfmWebGPUStepper) || !device || !renderPipeline || !webgpuCanvas) return;

  injectInputSignal();
  setGlobalErrorInSimulation();

  // 5G-C render path:
  //
  // The simulation owns the authoritative position/velocity buffers. The
  // renderer must consume the exact write-side buffers produced by this step,
  // without waiting for a CPU readback of positions.
  //
  // Compute and render are encoded into the SAME command buffer. WebGPU
  // preserves their submission order, so the render pass observes the writes
  // performed by the compute passes in this timestep.
  const wp = workerProfiler;
  const commandEncoder = device.createCommandEncoder({
    label: `cepc-frame-step-${timestep}`,
  });
  const tEncode = wp ? wp.now() : 0;
  const encoded = await simulation.encodeStep(commandEncoder);
  wp?.since('worker.encodeStepMs', tEncode);

  const tRenderEncode = wp ? wp.now() : 0;
  renderPipeline.setParticleBuffers(encoded.renderState);

  const renderContext = webgpuContext;
  if (!renderContext) return;
  renderPipeline.render(
    commandEncoder,
    renderContext.getCurrentTexture().createView() as GPUTextureView,
    encoded.renderState.particleCount,
  );
  wp?.since('worker.renderEncodeMs', tRenderEncode);

  const tSubmit = wp ? wp.now() : 0;
  device.queue.submit([commandEncoder.finish()]);
  simulation.notifyStepSubmitted();
  wp?.since('worker.submitMs', tSubmit);
  // OffscreenCanvas.transferToImageBitmap() must observe the completed render
  // work. Waiting here also makes the simulation/render/frame hand-off
  // deterministic instead of relying on implicit queue completion.
  const tWait = wp ? wp.now() : 0;
  await device.queue.onSubmittedWorkDone();
  if (wp) {
    wp.since('worker.onSubmittedWorkDoneMs', tWait);
    wp.inc('worker.onSubmittedWorkDoneCalls');
  }

  // 5G-H: normal synchronization updates only population topology/event
  // metadata. Positions, velocities, health and charge remain GPU-owned.
  const tFinish = wp ? wp.now() : 0;
  const normalPopulation = await encoded.finishNormalSync();
  wp?.since('worker.finishNormalSyncMs', tFinish);
  population = mergeNormalPopulationTopology(normalPopulation);
  timestep++;

}

/**
 * Phase 14: headless per-step path for the WebGPU backend (encode + submit +
 * normal sync, no render pass, no onSubmittedWorkDone wait). Mirrors
 * `advanceSimulationStep()` for the CPU backend so the two backends can be
 * A/B compared with rendering removed from the critical path. Never used by
 * the interactive app; only by 'runBenchmark' with renderEnabled=false.
 */
async function advanceHeadlessWebGPUStep(): Promise<void> {
  if (!(simulation instanceof MfmWebGPUStepper)) return;
  injectInputSignal();
  setGlobalErrorInSimulation();
  const wp = workerProfiler;
  const t = wp ? wp.now() : 0;
  population = await simulation.step();
  wp?.since('worker.headlessStepMs', t);
  timestep++;
}

// Add method to inject input into simulation
function injectInputSignal(): void {
  if (simulation && typeof inputSignal === 'number') {
    // MfmCpuReference does not expose an input-injection method. Keep this
    // optional so workers using versions that support it remain compatible.
    const injectInput = (simulation as unknown as {
      injectInput?: (value: number) => void;
    }).injectInput;
    if (typeof injectInput === 'function') {
      injectInput.call(simulation, inputSignal);
    }
  }
}


// Add method to set global error in simulation
function setGlobalErrorInSimulation(): void {
  if (!simulation) return;

  const setGlobalError = (simulation as unknown as {
    setGlobalError?: (error: number) => void;
  }).setGlobalError;

  if (typeof setGlobalError === 'function') {
    setGlobalError.call(simulation, globalError);
  }
}

// Initialize everything
async function initialize(config: MFMConfig) {
  const configRecord = config as unknown as Record<string, unknown>;
  if (typeof configRecord.inputSignal === 'number') {
    inputSignal = Math.max(0, Math.min(1, configRecord.inputSignal));
  }
  initializationRandomState = (config.seed >>> 0) || 1;
  if (configRecord && configRecord.backend === 'string') {
    const maybe = configRecord.backend as 'CPU' | 'WebGPU';
    if (maybe === 'CPU' || maybe === 'WebGPU') {
      backend = maybe;
    }
  }
  const maxParticlesValue =
    typeof configRecord.maxParticles === 'number'
      ? Number(configRecord.maxParticles)
      : config.Nmax;

  currentConfig = new MFMConfig({
    ...config,
    Nmax: maxParticlesValue,
  });
  resetCamera();

  const initialPopulation = createInitialPopulation(currentConfig);
  population = initialPopulation;
  timestep = 0;

  // WebGPU setup must run BEFORE constructing the GPU simulation, because
  // the GPUDevice is acquired asynchronously from the worker's navigator.gpu.
  await setupRenderBackend();
  recreateSimulationForBackend();

  // Render initial frame and send back OffscreenCanvas
  await renderAndSendBack();
}
 
function createInitialPopulation(config: MFMConfig): PopulationState {
  const population = new PopulationState();
  const configRecord = config as unknown as Record<string, unknown>;
  const variation = Math.max(0, Math.min(1, config.genome_variation));
  const totalCount = Math.max(3, Math.floor(Number(
    typeof configRecord.maxParticles === 'number' ? configRecord.maxParticles : config.Nmax
  )));
  const internalCount = Math.max(1, totalCount - 2);
  const cols = Math.ceil(Math.sqrt(internalCount));
  const rows = Math.ceil(internalCount / cols);
  const spacing = Math.min(config.Lx, config.Ly) / 5;
  const startX = (config.Lx - spacing * (cols - 1)) / 2;
  const startY = (config.Ly - spacing * (rows - 1)) / 2;
  const makeGenome = (vary: boolean) => new Genome({
    H_max: vary ? varied(config.Hmax, variation, 1) : config.Hmax,
    theta_q: vary ? Math.max(1, Math.round(varied(config.theta_q, variation, 1))) : config.theta_q,
    A: vary ? varied(config.A, variation, 0.01) : config.A,
    K: vary ? Math.max(1, Math.round(varied(config.K, variation, 1))) : config.K,
    R_c: vary ? varied(config.Rc, variation, 0.01) : config.Rc,
    m: vary ? varied(config.m, variation, 0.01) : config.m,
    gamma: vary ? varied(config.gamma, variation, 0) : config.gamma,
    R_s: vary ? varied(config.Rs, variation, 0.01) : config.Rs,
    omega_R: vary ? varied(config.omega_R, variation, -Infinity) : config.omega_R,
    omega_A: vary ? varied(config.omega_A, variation, -Infinity) : config.omega_A,
    omega_v: vary ? varied(config.omega_v, variation, -Infinity) : config.omega_v,
  });
  const add = (id: string, role: 'internal' | 'input' | 'output', x: number, y: number) => {
    const genome = makeGenome(role === 'internal');
    const speed = role === 'internal' ? randomBetween(0.05, 0.2) : 0;
    const angle = randomBetween(0, Math.PI * 2);
    population.addParticle(id as ParticleID, genome, new ParticleState({
      version: '3.0.0',
      position: role === 'internal' ? { x: randomBetween(0, config.Lx), y: randomBetween(0, config.Ly) } : { x, y },
      velocity: { x: speed * Math.cos(angle), y: speed * Math.sin(angle) },
      health: genome.H_max, charge: 0, senderSet: new Set(), prevSenderSet: new Set(), role,
    }));
  };
  add('input-0', 'input', config.Lx * 0.25, config.Ly * 0.25);
  add('output-0', 'output', config.Lx * 0.75, config.Ly * 0.75);
  let index = 0;
  for (let y = 0; y < rows && index < internalCount; y++) {
    for (let x = 0; x < cols && index < internalCount; x++) {
      add(`particle-${index}`, 'internal', startX + x * spacing, startY + y * spacing);
      index++;
    }
  }
  return population;
}

function setSimulationPopulation(nextPopulation: PopulationState): void {
  if (!simulation) return;

  const setPopulation = (simulation as unknown as {
    setPopulation?: (population: PopulationState) => void;
  }).setPopulation;

  if (typeof setPopulation === 'function') {
    setPopulation.call(simulation, nextPopulation);
  }
}

function createInteractiveParticle(position: { x: number; y: number }): void {
  if (!currentConfig || !population || !simulation || population.particles.size >= currentConfig.Nmax) return;
  const genome = new Genome(inspectedTemplate?.genome ?? {
    H_max: currentConfig.Hmax,
    theta_q: currentConfig.theta_q,
    A: currentConfig.A,
    K: currentConfig.K,
    R_c: currentConfig.Rc,
    m: currentConfig.m,
    gamma: currentConfig.gamma,
    R_s: currentConfig.Rs,
    omega_R: currentConfig.omega_R,
    omega_A: currentConfig.omega_A,
    omega_v: currentConfig.omega_v,
  });
  const id = `interactive-${timestep}-${population.particles.size}`;
  population.addParticle(id, genome, new ParticleState({
    position,
    velocity: { x: 0, y: 0 },
    health: genome.H_max,
    charge: 0,
    senderSet: new Set(),
    prevSenderSet: new Set(),
    role: inspectedTemplate?.role ?? 'internal',
  }));
  setSimulationPopulation(population);
}

async function inspectNearestParticle(): Promise<void> {
  await syncFullWebGPUState();

  const world = pointerToWorld();
  if (!world || !population || !currentConfig) return;
  let nearest: { id: string; state: ParticleState; genome: Genome } | null = null;
  let nearestDistance = Infinity;
  for (const [id, state] of population.particles) {
    const genome = population.genomes.get(id);
    if (!genome) continue;
    const dx = Math.min(Math.abs(state.position.x - world.x), currentConfig.Lx - Math.abs(state.position.x - world.x));
    const dy = Math.min(Math.abs(state.position.y - world.y), currentConfig.Ly - Math.abs(state.position.y - world.y));
    const distance = Math.hypot(dx, dy);
    if (distance < nearestDistance) {
      nearest = { id, state, genome };
      nearestDistance = distance;
    }
  }
  if (!nearest) return;
  inspectedTemplate = { role: nearest.state.role, genome: nearest.genome.toJSON() as unknown as Record<string, unknown> };
  workerScope.postMessage({
    type: 'particleInspection',
    payload: {
      id: nearest.id,
      role: nearest.state.role,
      position: { ...nearest.state.position },
      velocity: { ...nearest.state.velocity },
      health: nearest.state.health,
      charge: nearest.state.charge,
      senderSet: Array.from(nearest.state.senderSet),
      prevSenderSet: Array.from(nearest.state.prevSenderSet),
      genome: nearest.genome.toJSON(),
    },
  });
}

async function beginGrab(): Promise<void> {
  await syncFullWebGPUState();

  const world = pointerToWorld();
  if (!world || !population || !currentConfig) return;
  const radius = Math.min(currentConfig.Lx, currentConfig.Ly) * grabRangePercent;
  grabbedIds = [];
  grabAnchor = world;
  for (const [id, state] of population.particles) {
    const dx = state.position.x - world.x;
    const dy = state.position.y - world.y;
    const wrappedDx = Math.min(Math.abs(dx), currentConfig.Lx - Math.abs(dx));
    const wrappedDy = Math.min(Math.abs(dy), currentConfig.Ly - Math.abs(dy));
    if (Math.hypot(wrappedDx, wrappedDy) <= radius) grabbedIds.push(id);
  }
}

function updateGrab(): void {
  const world = pointerToWorld();
  if (!world || !grabAnchor || !population || !simulation || !currentConfig) return;
  const dx = world.x - grabAnchor.x;
  const dy = world.y - grabAnchor.y;
  for (const id of grabbedIds) {
    const state = population.particles.get(id);
    if (!state || state.role !== 'internal') continue;
    state.position = {
      x: wrapCoordinate(state.position.x + dx, currentConfig.Lx),
      y: wrapCoordinate(state.position.y + dy, currentConfig.Ly),
    };
    state.velocity = { x: 0, y: 0 };
  }
  grabAnchor = world;
  setSimulationPopulation(population);
}

function endGrab(): void {
  grabbedIds = [];
  grabAnchor = null;
}

function getInterfaceCharge(role: 'input' | 'output'): number {
  if (!population) return 0;
  let charge = 0;
  for (const [, state] of population.particles) {
    if (state.role === role) charge += state.charge;
  }
  return charge;
}

function worldToCanvas(x: number, y: number): { x: number; y: number } | null {
  if (!currentConfig || !offscreen) return null;
  const width = currentConfig.Lx / camera.zoom;
  const height = currentConfig.Ly / camera.zoom;
  const dx = ((x - (camera.x - width / 2) + currentConfig.Lx) % currentConfig.Lx) / width;
  const dy = ((y - (camera.y - height / 2) + currentConfig.Ly) % currentConfig.Ly) / height;
  return { x: dx * offscreen.width, y: dy * offscreen.height };
}

function renderCpuFrame(): void {
  if (!offscreen || !population) return;
  const ctx = offscreen.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, offscreen.width, offscreen.height);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, offscreen.width, offscreen.height);

  for (const [id, state] of population.particles) {
    const canvasPosition = worldToCanvas(state.position.x, state.position.y);
    if (!canvasPosition) continue;
    const { x, y } = canvasPosition;
    const healthRatio = Math.max(0, Math.min(1, state.health / (population.genomes.get(id)?.H_max ?? 100)));
    const radius = state.role === 'internal' ? 2 : 6;
    if (state.role === 'input') ctx.fillStyle = '#00e5ff';
    else if (state.role === 'output') ctx.fillStyle = '#9b5cff';
    else {
      const red = Math.round(255 * (1 - healthRatio));
      const green = Math.round(255 * healthRatio);
      ctx.fillStyle = `rgb(${red}, ${green}, 0)`;
    }
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  const bitmap = offscreen.transferToImageBitmap();
  workerScope.postMessage({ type: 'frame', payload: { offscreen: bitmap } }, [bitmap]);
}

let renderAndSendBackInFlight: Promise<void> | null = null;

/**
 * Wait until the current render/simulation presentation operation has fully
 * released its WebGPU resources. Lifecycle operations such as reset, reinit
 * and backend switching must not destroy a stepper while renderAndSendBack()
 * is waiting on a readback mapAsync().
 */
async function waitForRenderAndSendBackIdle(): Promise<void> {
  const operation = renderAndSendBackInFlight;
  if (operation) {
    await operation;
  }
}

async function renderAndSendBack() {
  // Worker message handlers are asynchronous and may overlap: a frame request
  // can arrive while a step/reset/inspect handler is still rendering. Serialize
  // the whole render operation so a second caller cannot reach encodeStep()
  // while the previous caller still owns the in-flight GPU step.
  if (renderAndSendBackInFlight) {
    await renderAndSendBackInFlight;
    return;
  }

  const operation = (async () => {
    if (!offscreen) return;

  // WebGPU is an atomic simulation+render path. 5G-C deliberately keeps
  // dynamic positions on the GPU, so never advance a WebGPU simulation via
  // the CPU/2D renderer while the WebGPU renderer is still initializing.
  if (backend === 'WebGPU' && simulation instanceof MfmWebGPUStepper) {
    if (!device) return;
    if (!webgpuReady || !renderPipeline || !webgpuContext) {
      const ready = await ensureWebGPURendererReady();
      if (!ready) {
        // Keep the GPU simulation active even when the WebGPU canvas renderer
        // is unavailable. This is an exceptional compatibility path: obtain
        // a full CPU snapshot only for rendering the fallback frame.
        await syncFullWebGPUState('CPU fallback rendering');
        renderCpuFrame();
        return;
      }
    }

    const context = webgpuContext;
    if (!context || !renderPipeline || !webgpuCanvas) return;

    const now = performance.now();
    if (lastRenderTime > 0) workerFps = 1000 / (now - lastRenderTime);
    lastRenderTime = now;

    if (!isPaused && simulation instanceof MfmWebGPUStepper) {
      for (let i = 0; i < stepsPerFrame; i++) {
        await encodeAndSubmitWebGPUStep();
      }
    } else if (simulation instanceof MfmWebGPUStepper) {
      const current = simulation.getRenderState();
      renderPipeline.setParticleBuffers(current);
      const commandEncoder = device.createCommandEncoder({ label: 'cepc-render-only' });
      renderPipeline.render(commandEncoder, context.getCurrentTexture().createView() as GPUTextureView);
      device.queue.submit([commandEncoder.finish()]);
      await device.queue.onSubmittedWorkDone();
    }

    const bitmap = webgpuCanvas.transferToImageBitmap();
    workerScope.postMessage({ type: 'frame', payload: { offscreen: bitmap } }, [bitmap]);

    if (metricsReducer) {
      try {
        const current = simulation instanceof MfmWebGPUStepper ? simulation.getRenderState() : null;
        if (current) metricsReducer.setBuffers(current.health, current.charge, current.particleCount);
        const metrics = await metricsReducer.computeMetrics();
        // 5G-F made charge GPU-authoritative and the GPU charge buffers are
        // Uint32Array-backed. Do not derive charge metrics from the stale CPU
        // PopulationState or from a reducer that may reinterpret the buffer as
        // f32. Read only the authoritative 4 B/particle charge array and merge
        // the three charge statistics into the otherwise GPU-reduced metrics.
        const chargeMetrics = await simulation.readChargeMetrics();
        self.postMessage({
          type: 'metrics',
          payload: {
            metrics: {
              ...metrics,
              chargeSum: chargeMetrics.totalCharge,
              avgCharge: current?.particleCount ? chargeMetrics.totalCharge / current.particleCount : 0,
              inputCharge: chargeMetrics.inputCharge,
              outputCharge: chargeMetrics.outputCharge,
            },
            timestep,
            workerFps,
          },
        });
      } catch {
        // Metrics are ancillary to the simulation/render critical path.
      }
    }
    return;
  }

  // Explicit CPU backend only. A WebGPU simulation never reaches this path:
  // if its renderer is not ready, the branch above waits instead.
  if (backend !== 'CPU') return;

  if (!isPaused && simulation && population) {
    for (let i = 0; i < stepsPerFrame; i++) await advanceSimulationStep();
  }

    renderCpuFrame();

    // Compute FPS (optional)
    const now = performance.now();
    if (lastRenderTime > 0) {
      workerFps = 1000 / (now - lastRenderTime);
    }
    lastRenderTime = now;

    // Send simple metrics (count, health sum, charge sum, avg, min, max)
    if (population) {
      let count = 0;
      let healthSum = 0;
      let chargeSum = 0;
      let minHealth = Infinity;
      let maxHealth = -Infinity;
      let minCharge = Infinity;
      let maxCharge = -Infinity;
      for (const [, state] of population.particles) {
        count++;
        healthSum += state.health;
        chargeSum += state.charge;
        if (state.health < minHealth) minHealth = state.health;
        if (state.health > maxHealth) maxHealth = state.health;
        if (state.charge < minCharge) minCharge = state.charge;
        if (state.charge > maxCharge) maxCharge = state.charge;
      }
      const metrics = {
        count,
        healthSum,
        chargeSum,
        avgHealth: count ? healthSum / count : 0,
        avgCharge: count ? chargeSum / count : 0,
        minHealth: isFinite(minHealth) ? minHealth : 0,
        maxHealth: isFinite(maxHealth) ? maxHealth : 0,
        minCharge: isFinite(minCharge) ? minCharge : 0,
        maxCharge: isFinite(maxCharge) ? maxCharge : 0,
        inputCharge: getInterfaceCharge('input'),
        outputCharge: getInterfaceCharge('output')
      };
      self.postMessage({ type: 'metrics', payload: { metrics, timestep, workerFps } });
    }

  })();

  renderAndSendBackInFlight = operation;
  try {
    await operation;
  } finally {
    if (renderAndSendBackInFlight === operation) {
      renderAndSendBackInFlight = null;
    }
  }
}


// ---------------------------------------------------------------------------
// Phase 14 — benchmark harness
// ---------------------------------------------------------------------------
//
// Runs the *real* per-step path (the same functions the interactive app
// uses) against a deterministic scenario, with CPU/GPU instrumentation
// enabled only for the duration of the run. Bypasses renderAndSendBack()
// and the 'frame' canvas protocol entirely: the benchmark does not need a
// displayed frame, only the same encode/submit/sync work the app performs.
//
// A run replaces the worker's current population/config/simulation (mirrors
// what 'setBackend' already does when switching backends) and disposes the
// previous GPU simulation first so that repeated runs in one worker/page
// session do not leak GPUBuffers/pipelines.

interface BenchmarkRunOptions {
  particleCount: number;
  capacity?: number;
  density?: number;
  seed?: number;
  steps: number;
  warmupSteps: number;
  stepsPerFrame: number;
  renderEnabled: boolean;
  metricsEnabled: boolean;
  gpuTimestamps: boolean;
  parameterOverrides?: Partial<BenchmarkParameters>;
}

async function describeAdapter(): Promise<Record<string, unknown> | null> {
  try {
    const info = (device as unknown as { adapterInfo?: Record<string, unknown> })?.adapterInfo;
    if (!info) return null;
    // GPUAdapterInfo fields are individually optional depending on the
    // implementation; copy only what is present rather than assuming a shape.
    return {
      vendor: info.vendor ?? null,
      architecture: info.architecture ?? null,
      device: info.device ?? null,
      description: info.description ?? null,
    };
  } catch {
    return null;
  }
}

async function runBenchmark(options: BenchmarkRunOptions): Promise<Record<string, unknown>> {
  if (benchmarkRunning) {
    throw new Error('A benchmark run is already in progress in this worker');
  }
  benchmarkRunning = true;
  try {
    const scenario = createBenchmarkScenario({
      particleCount: options.particleCount,
      capacity: options.capacity,
      density: options.density,
      seed: options.seed,
      overrides: options.parameterOverrides,
    });

    disposeSimulation();
    currentConfig = scenario.config;
    population = scenario.population;
    timestep = 0;
    recreateSimulationForBackend();

    const usingWebGPU = simulation instanceof MfmWebGPUStepper;
    if (options.renderEnabled && usingWebGPU) {
      const ready = await ensureWebGPURendererReady();
      if (!ready) {
        throw new Error('WebGPU renderer is not ready; cannot benchmark with renderEnabled=true');
      }
    }

    let profilingInfo = { cpu: true, gpuTimestamps: false, gpuTimestampsSupported: false };
    if (usingWebGPU) {
      profilingInfo = (simulation as MfmWebGPUStepper).enableProfiling({
        cpu: true,
        gpuTimestamps: options.gpuTimestamps,
      });
    }
    workerProfiler = new CpuSectionProfiler();

    const stepOnce = async (): Promise<void> => {
      if (usingWebGPU) {
        if (options.renderEnabled) await encodeAndSubmitWebGPUStep();
        else await advanceHeadlessWebGPUStep();
      } else {
        await advanceSimulationStep();
      }
    };

    for (let i = 0; i < options.warmupSteps; i++) {
      for (let j = 0; j < options.stepsPerFrame; j++) await stepOnce();
    }
    if (usingWebGPU) {
      await (simulation as MfmWebGPUStepper).resetProfiling();
    }
    workerProfiler.reset();

    const t0 = performance.now();
    for (let i = 0; i < options.steps; i++) {
      const wp = workerProfiler;
      const tFrame = wp.now();
      for (let j = 0; j < options.stepsPerFrame; j++) await stepOnce();
      wp.since('worker.frameStepsMs', tFrame);

      if (options.metricsEnabled && usingWebGPU && metricsReducer) {
        const tMetrics = wp.now();
        try {
          const stepper = simulation as MfmWebGPUStepper;
          const current = stepper.getRenderState();
          metricsReducer.setBuffers(current.health, current.charge, current.particleCount);
          await metricsReducer.computeMetrics();
          await stepper.readChargeMetrics();
        } catch {
          // A metrics failure should not abort the benchmark run; the frame
          // is simply not counted in the metrics timing for this iteration.
        }
        wp.since('worker.metricsMs', tMetrics);
      }
      wp.commitStep();
    }
    const wallMs = performance.now() - t0;

    if (usingWebGPU) {
      await (simulation as MfmWebGPUStepper).collectGpuTimings();
    }

    const cpuAggregate = aggregateCpuRecords(workerProfiler.getRecords());
    const stepperReport = usingWebGPU ? (simulation as MfmWebGPUStepper).getProfilingReport() : null;

    if (usingWebGPU) {
      await (simulation as MfmWebGPUStepper).disableProfiling();
    }
    workerProfiler = null;

    const totalSteps = options.steps * options.stepsPerFrame;
    const frameWallMs = cpuAggregate.sections.find((section) => section.section === 'worker.frameStepsMs')
      ?.perStepMs ?? null;

    return {
      schemaVersion: 1,
      kind: 'webgpu-worker',
      generatedAt: new Date().toISOString(),
      environment: {
        backend,
        userAgent:
          (self as unknown as { navigator?: { userAgent?: string } }).navigator?.userAgent ?? 'unknown',
        adapterInfo: usingWebGPU ? await describeAdapter() : null,
      },
      method: {
        particleCount: scenario.particleCount,
        capacity: scenario.capacity,
        density: scenario.density,
        domain: { Lx: scenario.Lx, Ly: scenario.Ly },
        seed: scenario.seed,
        steps: options.steps,
        stepsPerFrame: options.stepsPerFrame,
        warmupSteps: options.warmupSteps,
        renderEnabled: options.renderEnabled,
        metricsEnabled: options.metricsEnabled,
        gpuTimestampsRequested: options.gpuTimestamps,
        gpuTimestampsSupported: profilingInfo.gpuTimestampsSupported,
        gpuTimestampsEnabled: profilingInfo.gpuTimestamps,
      },
      wallMs,
      stepsPerSecond: totalSteps / (wallMs / 1000),
      // Uses the *initial* particle count as a proxy; see cpu.counters for
      // population.deaths / population.births / population.structureChanged
      // to judge how much the population actually drifted during the run.
      particleStepsPerSecond: (totalSteps * scenario.particleCount) / (wallMs / 1000),
      frameWallMs,
      cpu: cpuAggregate,
      gpu: stepperReport?.gpu ?? null,
      gpuTimestamps: stepperReport?.gpuTimestamps ?? null,
      stepperCpu: stepperReport?.cpu ?? null,
    };
  } finally {
    benchmarkRunning = false;
  }
}

// Message handling from main thread
self.onmessage = async (event: MessageEvent) => {
  const data = event.data ?? {};
  const { type } = data;
  const payload = data.payload ?? data;

  if (type === 'init') {
    if (!payload?.offscreen || !payload?.config) return;
    offscreen = payload.offscreen;
    webgpuCanvas = payload.webgpuCanvas ?? null;
    if (!offscreen) return;
    await initialize(payload.config);
    return;
  }

  if (!offscreen) return; // Not initialized yet

  switch (type) {
    case 'frame':
      // main.tsx may post one frame request per animation frame while the
      // worker is still awaiting GPU readback. Drop stale requests instead
      // of accumulating extra simulation/render operations.
      if (frameInFlight) break;
      frameInFlight = true;
      try {
        await renderAndSendBack();
      } finally {
        frameInFlight = false;
      }
      break;
    case 'pause':
      isPaused = true;
      break;
    case 'play':
      isPaused = false;
      break;
    case 'step':
      if (isPaused) {
        if (backend === 'WebGPU' && simulation instanceof MfmWebGPUStepper) {
          // Manual stepping uses the same atomic GPU+render path as the frame
          // loop; its normal sync is topology-only under 5G-H.
          await encodeAndSubmitWebGPUStep();
        } else {
          await advanceSimulationStep();
        }
        await renderAndSendBack();
      }
      break;
    case 'reset':
      isPaused = false;
      timestep = 0;
      if (currentConfig) {
        // A frame can be concurrently waiting in GPU readback (mapAsync).
        // Never destroy the stepper/readback buffers until that operation has
        // completely finished and unmapped its staging buffers.
        await waitForRenderAndSendBackIdle();
        disposeSimulation();
        initializationRandomState = (currentConfig.seed >>> 0) || 1;
        population = createInitialPopulation(currentConfig);
        recreateSimulationForBackend();
        timestep = 0;
              await renderAndSendBack();
      }
      break;
    case 'setSpeed':
      stepsPerFrame = payload.stepsPerFrame;
      break;
    case 'updateConfig':
    case 'reinit':
      if (currentConfig && payload) {
        const merged: Record<string, unknown> = { ...currentConfig as unknown as Record<string, unknown>, ...payload };
        if (typeof merged.maxParticles === 'number') {
          merged.Nmax = Number(merged.maxParticles);
        }
        currentConfig = new MFMConfig({
          ...(currentConfig as unknown as Record<string, unknown>),
          ...(merged as Record<string, unknown>),
          Nmax: Number(merged.Nmax ?? currentConfig.Nmax),
        });
        resetCamera();
        simulation?.setConfig(currentConfig);

        if (renderPipeline) {
          updateRenderUniforms();
        }
        if (type === 'reinit') {
          isPaused = false;
          timestep = 0;
          // Reinitialization replaces the GPU stepper. Wait for any active
          // frame/readback before destroying its staging buffers.
          await waitForRenderAndSendBackIdle();
          disposeSimulation();
          initializationRandomState = (currentConfig.seed >>> 0) || 1;
          population = createInitialPopulation(currentConfig);
          recreateSimulationForBackend();
                  await renderAndSendBack();
        }
      }
      break; 
    case 'setInput': 
    if (payload && typeof payload.u === 'number') { 
      inputSignal = payload.u; 
    } 
    break;
    case 'pointer':
      if (payload && typeof payload.x === 'number' && typeof payload.y === 'number') {
        pointer = { x: payload.x, y: payload.y, inside: payload.inside !== false };
        updateGrab();
      }
      break;
    case 'cameraPan':
      moveCamera(Number(payload?.dx ?? 0), Number(payload?.dy ?? 0));
      updateRenderUniforms();
      break;
    case 'cameraZoom':
      changeZoom(Number(payload?.delta ?? 0));
      updateRenderUniforms();
      break;
    case 'cameraReset':
      resetCamera();
      updateRenderUniforms();
      break;
    case 'createParticle': {
      const world = pointerToWorld();
      if (world) createInteractiveParticle(world);
      break;
    }
    case 'inspectParticle':
      await inspectNearestParticle();
      break;
    case 'grabStart':
      grabRangePercent = Math.max(0.005, Math.min(0.5, Number(payload?.rangePercent ?? grabRangePercent)));
      await beginGrab();
      break;
    case 'grabEnd':
      endGrab();
      break;
    case 'grabRange':
      grabRangePercent = Math.max(0.005, Math.min(0.5, grabRangePercent + Number(payload?.delta ?? 0)));
      break;
    case 'sync': {
      if (!(simulation instanceof MfmWebGPUStepper)) break;
      const requestedMode = payload?.mode as WebGPUSyncMode;
      if (!['normal', 'partial', 'full', 'onDemand'].includes(requestedMode)) break;
      const result = await syncWebGPUState({
        mode: requestedMode,
        fields: Array.isArray(payload?.fields) ? payload.fields : undefined,
        particleIds: Array.isArray(payload?.particleIds) ? payload.particleIds : undefined,
        reason: typeof payload?.reason === 'string' ? payload.reason : undefined,
      });
      self.postMessage({ type: 'sync', payload: result });
      break;
    }
    case 'setBackend':
      if (payload?.backend === 'CPU' || payload?.backend === 'WebGPU') {
        const requestedBackend = payload.backend as 'CPU' | 'WebGPU';

        // Preserve the latest simulation state before destroying the old GPU
        // simulation/device during a backend transition.
        if (simulation instanceof MfmWebGPUStepper) {
          // Backend switching is an explicit full-synchronization boundary.
          await syncFullWebGPUState('backend transition');
        } else if (simulation) {
          population = simulation.getPopulation();
        }

        backend = requestedBackend;

        if (offscreen && currentConfig && population) {
          // Backend switching destroys the current simulation and therefore
          // must be serialized with an active render/readback operation.
          await waitForRenderAndSendBackIdle();
          disposeSimulation();
          await setupRenderBackend();
          recreateSimulationForBackend();
                  await renderAndSendBack();
        }

        self.postMessage({
          type: 'backend',
          payload: {
            backend,
            activeBackend: simulation instanceof MfmWebGPUStepper ? 'WebGPU' : 'CPU',
            webgpuReady,
          },
        });
      }
      break;
    case 'runBenchmark': {
      // Phase 14: dedicated benchmark run. See runBenchmark() above. Not part
      // of the interactive app's normal message flow.
      const options = payload as Partial<BenchmarkRunOptions> & { particleCount?: number };
      try {
        if (typeof options?.particleCount !== 'number') {
          throw new Error("runBenchmark requires payload.particleCount");
        }
        const result = await runBenchmark({
          particleCount: options.particleCount,
          capacity: options.capacity,
          density: options.density,
          seed: options.seed,
          steps: options.steps ?? 20,
          warmupSteps: options.warmupSteps ?? 5,
          stepsPerFrame: options.stepsPerFrame ?? 1,
          renderEnabled: options.renderEnabled ?? true,
          metricsEnabled: options.metricsEnabled ?? true,
          gpuTimestamps: options.gpuTimestamps ?? true,
          parameterOverrides: options.parameterOverrides,
        });
        self.postMessage({ type: 'benchmarkResult', payload: result });
      } catch (error) {
        self.postMessage({
          type: 'benchmarkError',
          payload: { message: error instanceof Error ? error.message : String(error) },
        });
      }
      break;
    }
  } 
}; 
 
function disposeSimulation(): void {
  const current = simulation;
  simulation = null;
  if (current && current instanceof MfmWebGPUStepper) {
    current.destroy();
  }
}

function recreateSimulationForBackend(): void {
  if (!currentConfig || !population) return;

  // Keep WebGPU simulation selected as soon as a GPUDevice exists. Rendering
  // may still be initializing; renderAndSendBack() will wait/retry the WebGPU
  // presentation path instead of falling back to a CPU renderer with stale
  // positions. This preserves GPU simulation ownership from 5G-C.
  if (backend === 'WebGPU' && device !== null) {
    simulation = new MfmWebGPUStepper(device, currentConfig, population);
    return;
  }

  // CPU is both the explicit CPU backend and the automatic fallback when
  // WebGPU initialization is unavailable or fails.
  simulation = new MfmCpuReference(currentConfig, population);
}

function disposeWebGPUResources() {
  webgpuReady = false;
  webgpuContext = null;
  if (renderPipeline) {
    renderPipeline.destroy();
    renderPipeline = null;
  }
  if (metricsReducer) {
    metricsReducer.destroy();
    metricsReducer = null;
  }
  device = null;
}

async function setupRenderBackend() {
  // The GPUDevice is a simulation resource, while the WebGPU canvas context
  // is only a rendering resource. They must not be coupled.
  disposeWebGPUResources();

  if (!offscreen || !currentConfig || !population) {
    return;
  }

  if (backend !== 'WebGPU') {
    webgpuReady = false;
    const ctx2d = offscreen.getContext('2d');
    if (!ctx2d) {
      console.error('OffscreenCanvas does not support 2D context');
    }
    return;
  }

  try {
    console.log('Initializing WebGPU device in worker...');

    // Obtain the canvas context before configuring it. The context is an
    // OffscreenCanvas-owned rendering object and must remain the same object
    // for the lifetime of the configured canvas. We intentionally do not call
    // getContext('2d') anywhere on this WebGPU canvas.
    webgpuContext = webgpuCanvas?.getContext('webgpu') as unknown as GPUCanvasContext | null;
    if (!webgpuContext) {
      throw new Error('OffscreenCanvas.getContext(\'webgpu\') returned null');
    }

    const gpu = (navigator as WorkerNavigatorWithGPU).gpu;
    if (!gpu) {
      throw new Error('navigator.gpu is unavailable in this worker');
    }

    const adapter = await gpu.requestAdapter({
      powerPreference: 'high-performance',
    });
    if (!adapter) {
      throw new Error('navigator.gpu.requestAdapter() returned null');
    }

    // MfmWebGPUStepper uses 16 storage buffers in the communication-select
    // pipeline and 12 in the force pipeline. WebGPU's default portable limit
    // is commonly 8, so explicitly request the higher limit only when this
    // adapter advertises that it supports it.
    const requiredStorageBuffers = 16;
    const supportedStorageBuffers =
      Number(adapter.limits?.maxStorageBuffersPerShaderStage ?? 0);

    if (supportedStorageBuffers < requiredStorageBuffers) {
      throw new Error(
        `WebGPU adapter supports only ${supportedStorageBuffers} storage buffers per shader stage; CEPC requires ${requiredStorageBuffers}.`,
      );
    }

    // Phase 14: request 'timestamp-query' only when the adapter advertises it.
    // Requesting an unsupported feature makes requestDevice() reject, so this
    // must be feature-detected rather than requested unconditionally. When
    // unsupported, GpuPassTimestampProfiler self-reports unavailable and the
    // benchmark harness falls back to CPU-only timing (see profiling.ts).
    const supportsTimestampQuery = adapter.features?.has('timestamp-query') ?? false;

    device = await adapter.requestDevice({
      requiredLimits: {
        maxStorageBuffersPerShaderStage: requiredStorageBuffers,
      },
      requiredFeatures: supportsTimestampQuery ? ['timestamp-query'] : [],
    });
    if (!device) {
      throw new Error('requestDevice() returned no GPUDevice');
    }
    console.log(`WebGPU timestamp-query support: ${supportsTimestampQuery ? 'available' : 'unavailable'}.`);

    // From this point on, GPU simulation is available independently of the
    // canvas presentation path. Do not throw away the device if rendering
    // initialization fails.
    console.log(
      `WebGPU GPUDevice acquired successfully (storage buffers/stage: ${requiredStorageBuffers}).`,
    );

    // Metrics are ancillary to the simulation, so a metrics initialization
    // failure must not disable the GPU backend.
    try {
      metricsReducer = new MetricsReducer(device);
      await metricsReducer.init();
    } catch (metricsError) {
      console.warn('WebGPU metrics initialization failed; continuing without GPU metrics.', metricsError);
      if (metricsReducer) {
        metricsReducer.destroy();
        metricsReducer = null;
      }
    }

    // Rendering is initialized separately from the GPU simulation. If the
    // canvas/render pipeline is temporarily unavailable, keep the GPUDevice
    // alive and retry on the next frame. Do not create a 2D context here: a
    // canvas context is exclusive, so doing so would prevent later WebGPU
    // initialization from succeeding.
    await ensureWebGPURendererReady();
  } catch (e) {
    console.warn('WebGPU device initialization failed; falling back to CPU simulation:', e);
    disposeWebGPUResources();
  }
}

/**
 * Initialize/retry only the WebGPU presentation path. The GPUDevice is kept
 * alive across rendering failures so the selected WebGPU simulation backend
 * is not silently replaced by CPU simulation.
 */
async function ensureWebGPURendererReady(): Promise<boolean> {
  if (backend !== 'WebGPU' || !webgpuCanvas || !device) return false;
  if (webgpuReady && renderPipeline) return true;

  try {
    const gpu = (navigator as WorkerNavigatorWithGPU).gpu;
    if (!gpu) return false;

    const canvasContext = webgpuContext ?? (webgpuCanvas.getContext('webgpu') as unknown as GPUCanvasContext | null);
    if (!canvasContext) {
      console.warn('OffscreenCanvas.getContext(\'webgpu\') returned null; waiting before advancing GPU simulation.');
      webgpuContext = null;
      return false;
    }
    webgpuContext = canvasContext;

    const format = gpu.getPreferredCanvasFormat();
    canvasContext.configure({
      device,
      format,
      alphaMode: 'premultiplied',
    });

    const nextPipeline = new RenderPipeline(device);
    await nextPipeline.init(format);
    renderPipeline = nextPipeline;
    webgpuReady = true;

    // Make the first bind group valid immediately.
    updateRenderUniforms();
    return true;
  } catch (renderError) {
    console.warn('WebGPU renderer is not ready; GPU simulation will wait before advancing.', renderError);
    if (renderPipeline) {
      renderPipeline.destroy();
      renderPipeline = null;
    }
    webgpuReady = false;
    return false;
  }
}

// ## Assumptions
// - The simulation uses \MfmCpuReference\ for CPU backend or \MfmWebGPUStepper\ for WebGPU backend.
// - WebGPU is used for simulation (when WebGPU backend is selected), rendering, and metrics computation.
// - Particle count does not change during backend switch (only config changes via `updateConfig`/`reinit` affect it).
 
 // End of worker




