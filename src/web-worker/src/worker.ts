 import { MfmCpuReference } from '@cepc/cpu-reference';
 import { WebGPUContext, createBuffer } from '@cepc/webgpu-core';
 import { RenderPipeline } from '@cepc/webgpu-core';
 import { MetricsReducer } from '@cepc/webgpu-core';
 import { ParticleState, PopulationState, Genome, MFMConfig, ParticleID } from '@cepc/shared-config';
 
 // Worker state
 let offscreen: OffscreenCanvas | null = null;
 let isPaused = false;
 let stepsPerFrame = 1;
 let timestep = 0;
 
 let simulation: MfmCpuReference | null = null;
 let webgpuContext: WebGPUContext | null = null;
 let renderPipeline: RenderPipeline | null = null;
 let metricsReducer: MetricsReducer | null = null;
 
 let positionBuffer: GPUBuffer | null = null;
 let offsetBuffer: GPUBuffer | null = null;
 let healthBuffer: GPUBuffer | null = null;
 let chargeBuffer: GPUBuffer | null = null;
 let particleCount = 0;
 
 let device: GPUDevice | null = null;
 
 // Initialize everything
 async function initialize(config: MFMConfig) {
   // Create simulation
   const initialPopulation = createInitialPopulation(config);
   simulation = new MfmCpuReference(config, initialPopulation);
 
   // Initialize WebGPU context
   webgpuContext = new WebGPUContext();
   const gpu = await webgpuContext.init(offscreen!);
   const { device: dev, format } = gpu;
   device = dev;
 
   // Initialize render pipeline
   renderPipeline = new RenderPipeline(device);
   await renderPipeline.init(format);
 
   // Initialize metrics reducer
   metricsReducer = new MetricsReducer(device);
   await metricsReducer.init();
 
   // Initialize buffers
   initializeBuffers();
 
   // Render initial frame and send back OffscreenCanvas
   await renderAndSendBack();
 }
 
 function createInitialPopulation(config: MFMConfig): PopulationState {
   const population = new PopulationState();
 
   // Create a few particles in a grid
   const count = 16; // 4x4 grid
   const spacing = Math.min(config.Lx, config.Ly) / 5;
   const startX = (config.Lx - spacing * (Math.sqrt(count) - 1)) / 2;
   const startY = (config.Ly - spacing * (Math.sqrt(count) - 1)) / 2;
 
   let idx = 0;
   for (let y = 0; y < Math.sqrt(count); y++) {
     for (let x = 0; x < Math.sqrt(count); x++) {
       const id = `particle-${idx}` as ParticleID;
       const genome = new Genome({
         Hmax: config.Hmax ?? 100,
         theta_q: config.theta_q ?? 10,
         A: config.A ?? 2,
         K: config.K ?? 4,
         Rc: config.Rc ?? 1.0,
         m: config.m ?? 1.0,
         gamma: config.gamma ?? 0.1,
         Rs: config.Rs ?? 1.0,
         omega_R: config.omega_R ?? 0.5,
         omega_A: config.omega_A ?? 0.5,
         omega_v: config.omega_v ?? 0.5
       });
       const state = new ParticleState({
         version: '3.0.0',
         position: { x: startX + x * spacing, y: startY + y * spacing },
         velocity: { x: 0, y: 0 },
         health: config.Hmax ?? 100,
         charge: 0,
         senderSet: new Set(),
         prevSenderSet: new Set()
       });
 
       population.addParticle(id, genome.clone(), state);
       idx++;
     }
   }
 
   return population;
 }
 
 function initializeBuffers() {
   if (!simulation) return;
   const pop = simulation.getState().population as PopulationState;
   particleCount = pop.particles.size;
 
   // Create and fill buffers
   const positions = new Float32Array(particleCount * 2);
   const healths = new Float32Array(particleCount);
   const charges = new Float32Array(particleCount);
 
   let i = 0;
   for (const [id, state] of pop.particles) {
     positions[i * 2] = state.position.x;
     positions[i * 2 + 1] = state.position.y;
     healths[i] = state.health;
     charges[i] = state.charge;
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
     if (metricsReducer) metricsReducer.setBuffers(healthBuffer, chargeBuffer, particleCount);
 
     // Create offset buffer for a quad (6 vertices per particle)
     offsetBuffer = createOffsetBuffer(particleCount);
 
     // Set initial uniforms (we'll update these later if needed)
     if (renderPipeline) {
       renderPipeline.setUniforms(
         config.Hmax ?? 100,
         config.Qmax ?? 100,
         0.01, // baseSize
         0.02  // sizeScale
       );
     }
   }
 }
 
 function createOffsetBuffer(count: number): GPUBuffer {
   // Each particle gets 6 vertices for a quad (two triangles)
   // We'll define the offsets for a unit square centered at origin
   const offsets = new Float32Array([
     -0.5, -0.5, // v0
      0.5, -0.5, // v1
      0.5,  0.5, // v2
     -0.5, -0.5, // v0 (again)
      0.5,  0.5, // v2 (again)
     -0.5,  0.5  // v3
   ].flat());
   // Repeat for each particle
   const repeated = new Float32Array(count * offsets.length);
   for (let i = 0; i < count; i++) {
     repeated.set(offsets, i * offsets.length);
   }
   return createBuffer(device!, repeated.byteLength, GPUBufferUsage.STORAGE | GPUBufferUsage.VERTEX);
 }
 
 async function renderAndSendBack() {
   if (!offscreen || !device || !renderPipeline) return;
 
   const context = offscreen.getContext('webgpu');
   if (!context) return;
 
   const textureView = context.getCurrentTexture().createView();
   const commandEncoder = device.createCommandEncoder();
 
   // Clear screen with a color that changes with timestep for debugging
   const r = 0.1 + (timestep % 100) / 1000 * 0.8;
   const g = 0.1;
   const b = 0.1;
 
   const pass = commandEncoder.beginRenderPass({
     colorAttachments: [{
       view: textureView,
       loadOp: 'clear',
       storeOp: 'store',
       clearValue: { r, g, b, a: 1.0 }
     }]
   });
 
   pass.end();
 
   const gpuAsync = device.queue.submit([commandEncoder.finish()]);
 
   // Wait for GPU to finish before transferring back
   await gpuAsync;
 
   // Send OffscreenCanvas back to main thread
   self.postMessage({ type: 'frame', offscreen }, [offscreen]);
   offscreen = null; // We've transferred it away
 }
 
 // Message handling from main thread
 self.onmessage = async (event: MessageEvent) => {
   const { type, payload } = event.data;
 
   if (type === 'init') {
     offscreen = payload.offscreen;
     await initialize(payload.config);
     return;
   }
 
   if (!offscreen) return; // Not initialized yet
 
   switch (type) {
     case 'frame':
       // Main thread is sending the OffscreenCanvas back for us to render the next frame
       // We'll render and send it back
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
         simulation?.step();
         timestep++;
         updateParticleBuffers();
         // Render and send back immediately for the step
         await renderAndSendBack();
       }
       break;
     case 'reset':
       isPaused = false;
       timestep = 0;
       if (simulation) {
         simulation.population = createInitialPopulation(simulation.config);
         updateParticleBuffers();
         await renderAndSendBack();
       }
       break;
     case 'setSpeed':
       stepsPerFrame = payload.stepsPerFrame;
       break;
   }
 };
 
 function updateParticleBuffers() {
   if (!simulation) return;
   const pop = simulation.getState().population as PopulationState;
   const positions = new Float32Array(particleCount * 2);
   const healths = new Float32Array(particleCount);
   const charges = new Float32Array(particleCount);
 
   let i = 0;
   for (const [id, state] of pop.particles) {
     positions[i * 2] = state.position.x;
     positions[i * 2 + 1] = state.position.y;
     healths[i] = state.health;
     charges[i] = state.charge;
     i++;
   }
 
   if (positionBuffer) device.queue.writeBuffer(positionBuffer, 0, positions);
   if (healthBuffer) device.queue.writeBuffer(healthBuffer, 0, healths);
   if (chargeBuffer) device.queue.writeBuffer(chargeBuffer, 0, charges);
 
   // Update metrics reducer buffers (same buffers)
   if (metricsReducer) metricsReducer.setBuffers(healthBuffer, chargeBuffer, particleCount);
 }
 
 // End of worker
