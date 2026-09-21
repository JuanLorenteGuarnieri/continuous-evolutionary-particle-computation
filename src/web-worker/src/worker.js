/// <reference lib="webworker" />
/// <reference lib="dom" />
import { MfmCpuReference } from '@cepc/cpu-reference';
import { WebGPUContext, createBuffer } from '@cepc/webgpu-core';
import { RenderPipeline } from '@cepc/webgpu-core';
import { MetricsReducer } from '@cepc/webgpu-core';
import { ParticleState, PopulationState, Genome, MFMConfig } from '@cepc/shared-config';
import { MfmWebGPUStepper } from '../../webgpu-mfm/src';
const workerScope = self;
// Worker state
let offscreen = null;
let isPaused = false;
let stepsPerFrame = 1;
let timestep = 0;
let lastRenderTime = 0;
let workerFps = 0;
let inputSignal = 0;
let backend = 'CPU';
let simulation = null;
let population = null;
let webgpuContext = null;
let renderPipeline = null;
let metricsReducer = null;
let positionBuffer = null;
let offsetBuffer = null;
let healthBuffer = null;
let chargeBuffer = null;
let particleCount = 0;
let device = null;
let webgpuReady = false;
const globalError = 0;
let currentConfig = null;
let initializationRandomState = 1;
let camera = { x: 0, y: 0, zoom: 1 };
let pointer = { x: 0.5, y: 0.5, inside: false };
let grabbedIds = [];
let grabAnchor = null;
let grabRangePercent = 0.05;
let inspectedTemplate = null;
function nextRandom() {
    let value = initializationRandomState;
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    initializationRandomState = value >>> 0;
    return initializationRandomState / 0xffffffff;
}
function randomBetween(min, max) {
    return min + (max - min) * nextRandom();
}
function wrapCoordinate(value, size) {
    return ((value % size) + size) % size;
}
function pointerToWorld() {
    if (!currentConfig || !pointer.inside)
        return null;
    const width = currentConfig.Lx / camera.zoom;
    const height = currentConfig.Ly / camera.zoom;
    return {
        x: wrapCoordinate(camera.x - width / 2 + pointer.x * width, currentConfig.Lx),
        y: wrapCoordinate(camera.y - height / 2 + pointer.y * height, currentConfig.Ly),
    };
}
function resetCamera() {
    if (!currentConfig)
        return;
    camera = { x: currentConfig.Lx / 2, y: currentConfig.Ly / 2, zoom: 1 };
}
function moveCamera(dx, dy) {
    if (!currentConfig)
        return;
    const width = currentConfig.Lx / camera.zoom;
    const height = currentConfig.Ly / camera.zoom;
    camera.x = wrapCoordinate(camera.x + dx * width, currentConfig.Lx);
    camera.y = wrapCoordinate(camera.y + dy * height, currentConfig.Ly);
}
function changeZoom(delta) {
    if (!currentConfig)
        return;
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
function updateRenderUniforms() {
    if (!renderPipeline || !currentConfig)
        return;
    renderPipeline.setUniforms(currentConfig.Hmax, currentConfig.Qmax, 0.01, 0.02, camera.x, camera.y, camera.zoom, currentConfig.Lx, currentConfig.Ly);
}
function varied(value, variation, minimum) {
    // Relative noise is symmetric around the base value and preserves its sign.
    return Math.max(minimum, value * (1 + randomBetween(-variation, variation)));
}
async function advanceSimulationStep() {
    if (!simulation)
        return;
    injectInputSignal();
    setGlobalErrorInSimulation();
    await simulation.step();
    population = simulation.getPopulation();
    timestep++;
    syncRenderBuffers();
}
// Add method to inject input into simulation
function injectInputSignal() {
    if (simulation && typeof inputSignal === 'number') {
        // MfmCpuReference does not expose an input-injection method. Keep this
        // optional so workers using versions that support it remain compatible.
        const injectInput = simulation.injectInput;
        if (typeof injectInput === 'function') {
            injectInput.call(simulation, inputSignal);
        }
    }
}
// Add method to set global error in simulation
function setGlobalErrorInSimulation() {
    if (simulation) {
        simulation.setGlobalError(globalError);
    }
}
// Initialize everything
async function initialize(config) {
    const configRecord = config;
    if (typeof configRecord.inputSignal === 'number') {
        inputSignal = Math.max(0, Math.min(1, configRecord.inputSignal));
    }
    initializationRandomState = (config.seed >>> 0) || 1;
    if (configRecord && configRecord.backend === 'string') {
        const maybe = configRecord.backend;
        if (maybe === 'CPU' || maybe === 'WebGPU') {
            backend = maybe;
        }
    }
    const maxParticlesValue = typeof configRecord.maxParticles === 'number'
        ? Number(configRecord.maxParticles)
        : config.Nmax;
    currentConfig = new MFMConfig({
        ...config,
        Nmax: maxParticlesValue,
    });
    resetCamera();
    const initialPopulation = createInitialPopulation(currentConfig);
    population = initialPopulation;
    if (backend === 'WebGPU' && device !== null) {
        simulation = new MfmWebGPUStepper(device, currentConfig, initialPopulation);
    }
    else {
        simulation = new MfmCpuReference(currentConfig, initialPopulation);
    }
    timestep = 0;
    // Initialize WebGPU context only if backend is WebGPU
    await setupRenderBackend();
    // Render initial frame and send back OffscreenCanvas
    await renderAndSendBack();
}
function createInitialPopulation(config) {
    const population = new PopulationState();
    const configRecord = config;
    const variation = Math.max(0, Math.min(1, config.genome_variation));
    const totalCount = Math.max(3, Math.floor(Number(typeof configRecord.maxParticles === 'number' ? configRecord.maxParticles : config.Nmax)));
    const internalCount = Math.max(1, totalCount - 2);
    const cols = Math.ceil(Math.sqrt(internalCount));
    const rows = Math.ceil(internalCount / cols);
    const spacing = Math.min(config.Lx, config.Ly) / 5;
    const startX = (config.Lx - spacing * (cols - 1)) / 2;
    const startY = (config.Ly - spacing * (rows - 1)) / 2;
    const makeGenome = (vary) => new Genome({
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
    const add = (id, role, x, y) => {
        const genome = makeGenome(role === 'internal');
        const speed = role === 'internal' ? randomBetween(0.05, 0.2) : 0;
        const angle = randomBetween(0, Math.PI * 2);
        population.addParticle(id, genome, new ParticleState({
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
function createInteractiveParticle(position) {
    if (!currentConfig || !population || !simulation || population.particles.size >= currentConfig.Nmax)
        return;
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
    simulation.setPopulation(population);
    syncRenderBuffers();
}
function inspectNearestParticle() {
    const world = pointerToWorld();
    if (!world || !population || !currentConfig)
        return;
    let nearest = null;
    let nearestDistance = Infinity;
    for (const [id, state] of population.particles) {
        const genome = population.genomes.get(id);
        if (!genome)
            continue;
        const dx = Math.min(Math.abs(state.position.x - world.x), currentConfig.Lx - Math.abs(state.position.x - world.x));
        const dy = Math.min(Math.abs(state.position.y - world.y), currentConfig.Ly - Math.abs(state.position.y - world.y));
        const distance = Math.hypot(dx, dy);
        if (distance < nearestDistance) {
            nearest = { id, state, genome };
            nearestDistance = distance;
        }
    }
    if (!nearest)
        return;
    inspectedTemplate = { role: nearest.state.role, genome: nearest.genome.toJSON() };
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
function beginGrab() {
    const world = pointerToWorld();
    if (!world || !population || !currentConfig)
        return;
    const radius = Math.min(currentConfig.Lx, currentConfig.Ly) * grabRangePercent;
    grabbedIds = [];
    grabAnchor = world;
    for (const [id, state] of population.particles) {
        const dx = state.position.x - world.x;
        const dy = state.position.y - world.y;
        const wrappedDx = Math.min(Math.abs(dx), currentConfig.Lx - Math.abs(dx));
        const wrappedDy = Math.min(Math.abs(dy), currentConfig.Ly - Math.abs(dy));
        if (Math.hypot(wrappedDx, wrappedDy) <= radius)
            grabbedIds.push(id);
    }
}
function updateGrab() {
    const world = pointerToWorld();
    if (!world || !grabAnchor || !population || !simulation || !currentConfig)
        return;
    const dx = world.x - grabAnchor.x;
    const dy = world.y - grabAnchor.y;
    for (const id of grabbedIds) {
        const state = population.particles.get(id);
        if (!state || state.role !== 'internal')
            continue;
        state.position = {
            x: wrapCoordinate(state.position.x + dx, currentConfig.Lx),
            y: wrapCoordinate(state.position.y + dy, currentConfig.Ly),
        };
        state.velocity = { x: 0, y: 0 };
    }
    grabAnchor = world;
    simulation.setPopulation(population);
    syncRenderBuffers();
}
function endGrab() {
    grabbedIds = [];
    grabAnchor = null;
}
function initializeBuffers() {
    if (!currentConfig)
        return;
    if (!population)
        return;
    const pop = population;
    particleCount = pop.particles.size;
    // Create and fill buffers
    const positions = new Float32Array(particleCount * 2);
    const healths = new Float32Array(particleCount);
    const charges = new Float32Array(particleCount);
    const roles = new Float32Array(particleCount);
    let i = 0;
    for (const [, state] of pop.particles) {
        positions[i * 2] = state.position.x;
        positions[i * 2 + 1] = state.position.y;
        healths[i] = state.health;
        charges[i] = state.charge;
        roles[i] = state.role === 'input' ? 1 : state.role === 'output' ? 2 : 0;
        i++;
    }
    if (device) {
        positionBuffer = createBuffer(device, positions.byteLength, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.VERTEX);
        healthBuffer = createBuffer(device, healths.byteLength, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.VERTEX);
        chargeBuffer = createBuffer(device, charges.byteLength, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.VERTEX);
        device.queue.writeBuffer(positionBuffer, 0, positions);
        device.queue.writeBuffer(healthBuffer, 0, healths);
        device.queue.writeBuffer(chargeBuffer, 0, charges);
        // Set buffers in metrics reducer
        if (metricsReducer)
            metricsReducer.setBuffers(healthBuffer, chargeBuffer, particleCount);
        // Create offset buffer for a quad (6 vertices per particle)
        offsetBuffer = createOffsetBuffer(device, particleCount);
        // Set initial uniforms (we'll update these later if needed)
        if (renderPipeline && currentConfig) {
            updateRenderUniforms();
            // Feed initial particle data to render pipeline
            // Build interleaved position+offset vertex data
            const positionsForRender = new Float32Array(particleCount * 12); // 6 verts * 2 comps
            const offsetsForRender = new Float32Array(particleCount * 12);
            // Offsets are per-vertex unit quad
            const quad = new Float32Array([-0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, -0.5, 0.5, 0.5, -0.5, 0.5]);
            for (let i = 0; i < particleCount; i++) {
                for (let v = 0; v < 6; v++) {
                    positionsForRender[i * 12 + v * 2] = positions[i * 2];
                    positionsForRender[i * 12 + v * 2 + 1] = positions[i * 2 + 1];
                    offsetsForRender[i * 12 + v * 2] = quad[v * 2];
                    offsetsForRender[i * 12 + v * 2 + 1] = quad[v * 2 + 1];
                }
            }
            renderPipeline.setParticleData(positionsForRender, offsetsForRender, healths, charges, roles);
        }
    }
}
function createOffsetBuffer(device, count) {
    // Each particle gets 6 vertices for a quad (two triangles)
    // We'll define the offsets for a unit square centered at origin
    const offsets = new Float32Array([
        -0.5, -0.5, // v0
        0.5, -0.5, // v1
        0.5, 0.5, // v2
        -0.5, -0.5, // v0 (again)
        0.5, 0.5, // v2 (again)
        -0.5, 0.5 // v3
    ].flat());
    // Repeat for each particle
    const repeated = new Float32Array(count * offsets.length);
    for (let i = 0; i < count; i++) {
        repeated.set(offsets, i * offsets.length);
    }
    return createBuffer(device, repeated.byteLength, GPUBufferUsage.STORAGE | GPUBufferUsage.VERTEX);
}
function getInterfaceCharge(role) {
    if (!population)
        return 0;
    let charge = 0;
    for (const [, state] of population.particles) {
        if (state.role === role)
            charge += state.charge;
    }
    return charge;
}
function worldToCanvas(x, y) {
    if (!currentConfig || !offscreen)
        return null;
    const width = currentConfig.Lx / camera.zoom;
    const height = currentConfig.Ly / camera.zoom;
    const dx = ((x - (camera.x - width / 2) + currentConfig.Lx) % currentConfig.Lx) / width;
    const dy = ((y - (camera.y - height / 2) + currentConfig.Ly) % currentConfig.Ly) / height;
    return { x: dx * offscreen.width, y: dy * offscreen.height };
}
async function renderAndSendBack() {
    if (!offscreen)
        return;
    // Advance simulation if playing
    if (!isPaused && simulation && population) {
        for (let i = 0; i < stepsPerFrame; i++) {
            await advanceSimulationStep();
        }
    }
    if (webgpuReady) {
        // Existing WebGPU rendering path
        if (!device || !renderPipeline)
            return;
        const context = offscreen.getContext('webgpu');
        if (!context)
            return;
        const now = performance.now();
        if (lastRenderTime > 0) {
            const delta = now - lastRenderTime;
            workerFps = 1000 / delta;
        }
        lastRenderTime = now;
        const textureView = context.getCurrentTexture().createView();
        const commandEncoder = device.createCommandEncoder();
        // Always update render pipeline with current particle data
        if (population && renderPipeline) {
            const pop = population;
            const positions = new Float32Array(particleCount * 2);
            const healths = new Float32Array(particleCount);
            const charges = new Float32Array(particleCount);
            const roles = new Float32Array(particleCount);
            let i = 0;
            for (const [, state] of pop.particles) {
                positions[i * 2] = state.position.x;
                positions[i * 2 + 1] = state.position.y;
                healths[i] = state.health;
                charges[i] = state.charge;
                roles[i] = state.role === 'input' ? 1 : state.role === 'output' ? 2 : 0;
                i++;
            }
            const positionsForRender = new Float32Array(particleCount * 12);
            const offsetsForRender = new Float32Array(particleCount * 12);
            const quad = new Float32Array([-0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, -0.5, 0.5, 0.5, -0.5, 0.5]);
            for (let p = 0; p < particleCount; p++) {
                for (let v = 0; v < 6; v++) {
                    positionsForRender[p * 12 + v * 2] = positions[p * 2];
                    positionsForRender[p * 12 + v * 2 + 1] = positions[p * 2 + 1];
                    offsetsForRender[p * 12 + v * 2] = quad[v * 2];
                    offsetsForRender[p * 12 + v * 2 + 1] = quad[v * 2 + 1];
                }
            }
            renderPipeline.setParticleData(positionsForRender, offsetsForRender, healths, charges, roles);
        }
        // Use RenderPipeline to draw particles
        renderPipeline.render(commandEncoder, textureView, particleCount);
        const gpuAsync = device.queue.submit([commandEncoder.finish()]);
        await gpuAsync;
        // Send frame snapshot with payload expected by main.tsx
        const bitmap = offscreen.transferToImageBitmap();
        workerScope.postMessage({ type: 'frame', payload: { offscreen: bitmap } }, [bitmap]);
        // Send metrics
        if (metricsReducer) {
            try {
                const metrics = await metricsReducer.computeMetrics();
                self.postMessage({ type: 'metrics', payload: { metrics: { ...metrics, inputCharge: getInterfaceCharge('input'), outputCharge: getInterfaceCharge('output') }, timestep, workerFps } });
            }
            catch (e) {
                // ignore metrics errors
            }
        }
    }
    else {
        // CPU fallback rendering using 2D canvas
        const ctx = offscreen.getContext('2d');
        if (!ctx)
            return;
        // Clear background (black)
        ctx.clearRect(0, 0, offscreen.width, offscreen.height);
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, offscreen.width, offscreen.height);
        // Draw particles as simple circles
        if (population) {
            for (const [id, state] of population.particles) {
                const canvasPosition = worldToCanvas(state.position.x, state.position.y);
                if (!canvasPosition)
                    continue;
                const { x, y } = canvasPosition;
                const healthRatio = Math.max(0, Math.min(1, state.health / (population.genomes.get(id)?.H_max ?? 100)));
                const radius = state.role === 'internal' ? 2 : 6;
                if (state.role === 'input') {
                    ctx.fillStyle = '#00e5ff';
                }
                else if (state.role === 'output') {
                    ctx.fillStyle = '#9b5cff';
                }
                else {
                    const red = Math.round(255 * (1 - healthRatio));
                    const green = Math.round(255 * healthRatio);
                    ctx.fillStyle = `rgb(${red}, ${green}, 0)`;
                }
                ctx.beginPath();
                ctx.arc(x, y, radius, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        // Compute FPS (optional)
        const now = performance.now();
        if (lastRenderTime > 0) {
            workerFps = 1000 / (now - lastRenderTime);
        }
        lastRenderTime = now;
        // Send frame bitmap
        const bitmap = offscreen.transferToImageBitmap();
        workerScope.postMessage({ type: 'frame', payload: { offscreen: bitmap } }, [bitmap]);
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
                if (state.health < minHealth)
                    minHealth = state.health;
                if (state.health > maxHealth)
                    maxHealth = state.health;
                if (state.charge < minCharge)
                    minCharge = state.charge;
                if (state.charge > maxCharge)
                    maxCharge = state.charge;
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
    }
}
// Message handling from main thread
self.onmessage = async (event) => {
    const data = event.data ?? {};
    const { type } = data;
    const payload = data.payload ?? data;
    if (type === 'init') {
        if (!payload?.offscreen || !payload?.config)
            return;
        offscreen = payload.offscreen;
        await initialize(payload.config);
        return;
    }
    if (!offscreen)
        return; // Not initialized yet
    switch (type) {
        case 'frame':
            await renderAndSendBack();
            break;
        case 'pause':
            isPaused = true;
            break;
        case 'play':
            isPaused = false;
            break;
        case 'step':
            if (isPaused) {
                await advanceSimulationStep();
                await renderAndSendBack();
            }
            break;
        case 'reset':
            isPaused = false;
            timestep = 0;
            if (currentConfig) {
                population = createInitialPopulation(currentConfig);
                if (backend === 'WebGPU' && device !== null) {
                    simulation = new MfmWebGPUStepper(device, currentConfig, population);
                }
                else {
                    simulation = new MfmCpuReference(currentConfig, population);
                }
                timestep = 0;
                syncRenderBuffers();
                await renderAndSendBack();
            }
            break;
        case 'setSpeed':
            stepsPerFrame = payload.stepsPerFrame;
            break;
        case 'updateConfig':
        case 'reinit':
            if (currentConfig && payload) {
                const merged = { ...currentConfig, ...payload };
                if (typeof merged.maxParticles === 'number') {
                    merged.Nmax = Number(merged.maxParticles);
                }
                currentConfig = new MFMConfig({
                    ...currentConfig,
                    ...merged,
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
                    population = createInitialPopulation(currentConfig);
                    if (backend === 'WebGPU' && device !== null) {
                        simulation = new MfmWebGPUStepper(device, currentConfig, population);
                    }
                    else {
                        simulation = new MfmCpuReference(currentConfig, population);
                    }
                    syncRenderBuffers();
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
            if (world)
                createInteractiveParticle(world);
            break;
        }
        case 'inspectParticle':
            inspectNearestParticle();
            break;
        case 'grabStart':
            grabRangePercent = Math.max(0.005, Math.min(0.5, Number(payload?.rangePercent ?? grabRangePercent)));
            beginGrab();
            break;
        case 'grabEnd':
            endGrab();
            break;
        case 'grabRange':
            grabRangePercent = Math.max(0.005, Math.min(0.5, grabRangePercent + Number(payload?.delta ?? 0)));
            break;
        case 'setBackend':
            if (payload && payload.backend) {
                backend = payload.backend;
                // Reconfigure rendering backend without losing simulation state
                if (offscreen && currentConfig) {
                    await setupRenderBackend();
                }
                self.postMessage({ type: 'backend', payload: { backend } });
            }
            break;
    }
};
function syncRenderBuffers() {
    if (!population)
        return;
    if (device && population.particles.size !== particleCount) {
        if (positionBuffer)
            positionBuffer.destroy();
        if (healthBuffer)
            healthBuffer.destroy();
        if (chargeBuffer)
            chargeBuffer.destroy();
        if (offsetBuffer)
            offsetBuffer.destroy();
        positionBuffer = null;
        healthBuffer = null;
        chargeBuffer = null;
        offsetBuffer = null;
        initializeBuffers();
        return;
    }
    updateParticleBuffers();
}
function updateParticleBuffers() {
    if (!positionBuffer || !healthBuffer || !chargeBuffer)
        return;
    if (!population)
        return;
    const pop = population;
    const positions = new Float32Array(particleCount * 2);
    const healths = new Float32Array(particleCount);
    const charges = new Float32Array(particleCount);
    let i = 0;
    for (const [, state] of pop.particles) {
        positions[i * 2] = state.position.x;
        positions[i * 2 + 1] = state.position.y;
        healths[i] = state.health;
        charges[i] = state.charge;
        i++;
    }
    if (positionBuffer)
        device.queue.writeBuffer(positionBuffer, 0, positions);
    if (healthBuffer)
        device.queue.writeBuffer(healthBuffer, 0, healths);
    if (chargeBuffer)
        device.queue.writeBuffer(chargeBuffer, 0, charges);
    // Update metrics reducer buffers (same buffers) 
    if (metricsReducer)
        metricsReducer.setBuffers(healthBuffer, chargeBuffer, particleCount);
}
function disposeWebGPUResources() {
    if (positionBuffer) {
        positionBuffer.destroy();
        positionBuffer = null;
    }
    if (healthBuffer) {
        healthBuffer.destroy();
        healthBuffer = null;
    }
    if (chargeBuffer) {
        chargeBuffer.destroy();
        chargeBuffer = null;
    }
    if (offsetBuffer) {
        offsetBuffer.destroy();
        offsetBuffer = null;
    }
    if (renderPipeline) {
        renderPipeline.destroy();
        renderPipeline = null;
    }
    if (metricsReducer) {
        metricsReducer.destroy();
        metricsReducer = null;
    }
    if (webgpuContext) {
        webgpuContext.destroy();
        webgpuContext = null;
    }
    device = null;
}
async function setupRenderBackend() {
    // Dispose existing WebGPU resources
    disposeWebGPUResources();
    if (!offscreen || !currentConfig || !population) {
        // Not initialized yet
        return;
    }
    if (backend === 'WebGPU' && device !== null) {
        try {
            webgpuContext = new WebGPUContext();
            const gpu = await webgpuContext.init(offscreen);
            const { device: dev, format } = gpu;
            device = dev;
            // Initialize render pipeline
            renderPipeline = new RenderPipeline(device);
            await renderPipeline.init(format);
            // Initialize metrics reducer
            metricsReducer = new MetricsReducer(device);
            await metricsReducer.init();
            // Initialize buffers (requires current particle data)
            initializeBuffers();
            webgpuReady = true;
        }
        catch (e) {
            console.warn("WebGPU initialization failed falling back to CPU rendering:", e);
            disposeWebGPUResources();
            // Ensure 2D context for CPU fallback
            const ctx2d = offscreen.getContext('2d');
            if (!ctx2d) {
                console.error("OffscreenCanvas does not support 2D context either");
            }
            webgpuReady = false;
        }
    }
    else {
        // CPU backend: skip WebGPU setup
        webgpuReady = false;
        // Ensure 2D context for drawing
        const ctx2d = offscreen.getContext('2d');
        if (!ctx2d) {
            console.error("OffscreenCanvas does not support 2D context");
        }
    }
}
// ## Assumptions
// - The simulation uses \MfmCpuReference\ for CPU backend or \MfmWebGPUStepper\ for WebGPU backend.
// - WebGPU is used for simulation (when WebGPU backend is selected), rendering, and metrics computation.
// - Particle count does not change during backend switch (only config changes via `updateConfig`/`reinit` affect it).
// End of worker
