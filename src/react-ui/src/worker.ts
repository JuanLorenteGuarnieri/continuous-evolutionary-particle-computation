/// <reference types='vite/client' />

let offscreen: OffscreenCanvas | null = null;
let ctx: OffscreenCanvasRenderingContext2D | null = null;
let isPaused = false;
let stepsPerFrame = 1;
let timestep = 0;
let backend: 'CPU' | 'WebGPU' = 'CPU';
let maxParticles = 200;
let maxSpeed = 0.01;
let interactionRange = 1.0;
let particles: {x:number;y:number;vx:number;vy:number;life:number}[] = [];

// Mock metrics
const mockMetrics = {
  count: 100,
  healthSum: 500.0,
  chargeSum: 25.0
};

// Handle incoming messages
self.onmessage = (event: MessageEvent) => {
  const { type, payload } = event.data;
  
  switch (type) {
    case 'init':
      // Initialize with the provided OffscreenCanvas and config
      // Main thread sends { type: 'init', offscreen, config } without payload wrapper
      offscreen = event.data.offscreen as OffscreenCanvas;
      if (offscreen) {
        ctx = offscreen.getContext('2d');
      }
      if (event.data.config?.maxParticles) {
        maxParticles = event.data.config.maxParticles;
      }
      if (event.data.config?.maxSpeed) maxSpeed = event.data.config.maxSpeed;
      if (event.data.config?.maxRange) interactionRange = event.data.config.maxRange;
      if (event.data.config?.backend) backend = event.data.config.backend;
      // Initialize particles
      initParticles();
      // Ignore config for now in this mock implementation
      break;
      
    case 'frame':
      // Receive OffscreenCanvas back from main (kept for compatibility, but not used with ImageBitmap flow)
      if (event.data.offscreen) {
        offscreen = event.data.offscreen as OffscreenCanvas;
        ctx = offscreen?.getContext('2d') ?? null;
      }
      break;
      
   case 'play':
     isPaused = false;
     // Send metrics update
      self.postMessage({ type: 'metrics', payload: { metrics: { ...mockMetrics, count: particles.length }, timestep } });
      break;
      
    case 'pause':
      isPaused = true;
      break;
      
    case 'step':
      // Advance simulation by one step (respect stepsPerFrame? step usually advances one frame)
      timestep += 1;
      // Update particle positions and life
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        // Wrap around torus [0,1)
        p.x = (p.x + 1) % 1;
        p.y = (p.y + 1) % 1;
        p.life += 0.5;
      }
      // Send metrics update
      self.postMessage({
        type: 'metrics',
        payload: {
          metrics: {
            ...mockMetrics,
            healthSum: mockMetrics.healthSum + timestep * 0.1,
            chargeSum: mockMetrics.chargeSum + timestep * 0.01,
            count: particles.length
          },
          timestep
        }
      });
      // Render and send frame if OffscreenCanvas available
      if (offscreen && ctx) {
        ctx.fillStyle = '#0a0a12';
        ctx.fillRect(0, 0, offscreen.width, offscreen.height);
        for (const p of particles) {
          const px = p.x * offscreen.width;
          const py = p.y * offscreen.height;
          const hue = ((timestep + p.life) * 0.5) % 360;
          ctx.fillStyle = `hsl(${hue}, 80%, 60%)`;
          ctx.beginPath();
          ctx.arc(px, py, 3, 0, Math.PI * 2);
          ctx.fill();
        }
        const bitmap = offscreen.transferToImageBitmap();
        self.postMessage({ type: 'frame', payload: { offscreen: bitmap } }, { transfer: [bitmap] });
      }
      break;
      
    case 'reset':
      timestep = 0;
      initParticles();
      break;
      
    case 'setSpeed':
      if (payload?.stepsPerFrame) {
        stepsPerFrame = payload.stepsPerFrame;
      }
      break;
    case 'setMaxParticles':
      if (payload?.maxParticles) {
        maxParticles = payload.maxParticles;
        initParticles();
      }
      break;
    case 'setMaxSpeed':
      if (payload?.maxSpeed) maxSpeed = payload.maxSpeed;
      break;
    case 'setMaxRange':
      if (payload?.maxRange) {
        interactionRange = payload.maxRange;
      }
      break;
    case 'setBackend':
      if (payload?.backend) {
        backend = payload.backend;
        self.postMessage({ type: 'backend', payload: { backend } });
      }
      break;
      
    default:
      console.error('Unknown message type from main thread:', type);
  }
};

function initParticles() {
  particles = [];
  for (let i = 0; i < maxParticles; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * maxSpeed;
    particles.push({
      x: Math.random(),
      y: Math.random(),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: Math.random() * 100
    });
  }
}

// Periodically send metrics when not paused
setInterval(() => {
  if (!isPaused && offscreen) {
    for (let s = 0; s < stepsPerFrame; s++) {
      timestep += 1;
      // Update particles
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        // Wrap around torus [0,1)
        p.x = (p.x + 1) % 1;
        p.y = (p.y + 1) % 1;
        p.life += 0.5;
      }
    }
    // Update particles
    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.x = (p.x + 1) % 1;
      p.y = (p.y + 1) % 1;
    }
    self.postMessage({
      type: 'metrics',
      payload: {
        metrics: {
          ...mockMetrics,
          healthSum: mockMetrics.healthSum + timestep * 0.1,
          chargeSum: mockMetrics.chargeSum + timestep * 0.01,
          count: particles.length
        },
        timestep
      }
    });
    
    // Also send frame for rendering
    if (offscreen && ctx) {
      // Draw static background
      ctx.fillStyle = '#0a0a12';
      ctx.fillRect(0, 0, offscreen.width, offscreen.height);
      
      // Draw particles
      for (const p of particles) {
        const px = p.x * offscreen.width;
        const py = p.y * offscreen.height;
        const hue = ((timestep + p.life) * 0.5) % 360;
        ctx.fillStyle = `hsl(${hue}, 80%, 60%)`;
        ctx.beginPath();
        ctx.arc(px, py, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      
      const bitmap = offscreen.transferToImageBitmap();
      // Main thread expects { type, payload } format with offscreen key (now ImageBitmap)
      self.postMessage({ type: 'frame', payload: { offscreen: bitmap } }, { transfer: [bitmap] });
    }
  }
}, 100); // 10 updates per second

// Expose backend info
// Main thread expects { type, payload } format
self.postMessage({ type: 'backend', payload: { backend } });



