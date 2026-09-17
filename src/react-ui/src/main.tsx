import React, { useRef, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const [metrics, setMetrics] = useState<{ count: number; healthSum: number; chargeSum: number } | null>(null);
  const [timestep, setTimestep] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [stepsPerFrame, setStepsPerFrame] = useState(1);
  const [backend, setBackend] = useState('CPU');
  const [fps, setFps] = useState(0);
  const [showHud, setShowHud] = useState(true);
  const [maxParticles, setMaxParticles] = useState(200);
  const [maxSpeed, setMaxSpeed] = useState(0.01);
  const [maxRange, setMaxRange] = useState(1.0);
  const [selectedBackend, setSelectedBackend] = useState<'CPU'|'WebGPU'>('CPU');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvasRef.current) return;
    const offscreen = new OffscreenCanvas(800, 600);
    const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    workerRef.current = worker;

    const config = {
      Lx: 100, Ly: 100, Hmax: 100, theta_q: 10, A: 2, K: 4, Rc: 1.0, m: 1.0, gamma: 0.1,
      Rs: 1.0, omega_R: 0.5, omega_A: 0.5, omega_v: 0.5, seed: Math.floor(Math.random() * 1000),
      maxParticles,
      maxSpeed,
      maxRange,
      backend: selectedBackend
    };
    worker.postMessage({ type: 'init', offscreen, config }, [offscreen]);

    worker.onmessage = (event: MessageEvent) => {
      const { type, payload } = event.data;
      switch (type) {
        case 'frame': handleFrame(payload.offscreen); break;
        case 'metrics': setMetrics(payload.metrics); setTimestep(payload.timestep); break;
        case 'backend': setBackend(payload.backend); break;
        case 'error': console.error('Worker error:', payload); break;
      }
    };

    let lastTime = 0, fpsCount = 0, fpsTimer = 0;
    const animate = (time: number) => {
      fpsCount++; fpsTimer += time - lastTime;
      if (fpsTimer >= 1000) { setFps(fpsCount); fpsCount = 0; fpsTimer = 0; }
      lastTime = time; requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
    return () => { worker?.terminate(); };
  }, []);

  // Responsive canvas size
  useEffect(() => {
    const updateSize = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.floor(window.innerWidth * dpr);
        canvas.height = Math.floor(window.innerHeight * dpr);
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  const handleFrame = (bitmap: ImageBitmap) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const cw = canvas.clientWidth, ch = canvas.clientHeight;
      const bw = bitmap.width, bh = bitmap.height;
      const scale = Math.min(cw / bw, ch / bh);
      const dw = bw * scale, dh = bh * scale;
      const dx = (cw - dw) / 2, dy = (ch - dh) / 2;
      ctx.drawImage(bitmap, dx, dy, dw, dh);
      bitmap.close();
    }
  };

  const handlePlay = () => { setIsPaused(false); workerRef.current?.postMessage({ type: 'play' }); };
  const handlePause = () => { setIsPaused(true); workerRef.current?.postMessage({ type: 'pause' }); };
  const handleStep = () => { workerRef.current?.postMessage({ type: 'step' }); };
  const handleReset = () => { workerRef.current?.postMessage({ type: 'reset' }); };
  const handleSpeedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    setStepsPerFrame(isNaN(value) ? 1 : value);
    workerRef.current?.postMessage({ type: 'setSpeed', payload: { stepsPerFrame: value } });
  };

  const handleMaxParticlesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    const v = isNaN(value) ? maxParticles : value;
    setMaxParticles(v);
    workerRef.current?.postMessage({ type: 'setMaxParticles', payload: { maxParticles: v } });
  };

  const handleMaxSpeedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    setMaxSpeed(isNaN(v) ? 0.01 : v);
    workerRef.current?.postMessage({ type: 'setMaxSpeed', payload: { maxSpeed: v } });
  };

  const handleMaxRangeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    setMaxRange(isNaN(v) ? 1.0 : v);
    workerRef.current?.postMessage({ type: 'setMaxRange', payload: { maxRange: v } });
  };

  const handleBackendChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const v = e.target.value as 'CPU'|'WebGPU';
    setSelectedBackend(v);
    workerRef.current?.postMessage({ type: 'setBackend', payload: { backend: v } });
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#050508', color: '#e8e8f0', fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif', overflow: 'hidden' }}>
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100vw', height: '100vh', display: 'block', background: '#000' }} />

      <button
        onClick={() => setShowHud(s => !s)}
        style={{
          position: 'absolute', top: 16, right: 16, zIndex: 20,
          background: 'rgba(15,15,25,0.7)', backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255,255,255,0.12)', color: '#e8e8f0',
          borderRadius: 12, padding: '8px 12px', cursor: 'pointer', fontSize: 14,
        }}
        title="Toggle HUD"
      >
        {showHud ? 'Hide HUD' : 'Show HUD'}
      </button>

      {showHud && (
        <div style={{ position: 'absolute', top: 16, right: 16, zIndex: 10, background: 'rgba(15,15,25,0.55)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '16px 20px', boxShadow: '0 8px 30px rgba(0,0,0,0.45)', minWidth: 280, maxWidth: 'min(380px, 90vw)' }}>
          <h1 style={{ margin: '0 0 12px 0', fontSize: 20, fontWeight: 600, letterSpacing: 0.2 }}>CEPC Simulation</h1>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            <button onClick={handlePlay} disabled={!isPaused} style={{ flex: '1 1 auto', padding: '8px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)', color: '#e8e8f0', cursor: 'pointer', opacity: !isPaused ? 0.5 : 1 }}>▶ Play</button>
            <button onClick={handlePause} disabled={isPaused} style={{ flex: '1 1 auto', padding: '8px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)', color: '#e8e8f0', cursor: 'pointer', opacity: isPaused ? 0.5 : 1 }}>⏸ Pause</button>
            <button onClick={handleStep} disabled={!isPaused} style={{ flex: '1 1 auto', padding: '8px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)', color: '#e8e8f0', cursor: 'pointer', opacity: !isPaused ? 0.5 : 1 }}>⏭ Step</button>
            <button onClick={handleReset} style={{ flex: '1 1 auto', padding: '8px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)', color: '#e8e8f0', cursor: 'pointer' }}>⟲ Reset</button>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 13, opacity: 0.85 }}>
              Speed: <input type="number" value={stepsPerFrame} onChange={(e)=>{const v=parseInt(e.target.value,10); if(!isNaN(v)){setStepsPerFrame(v); workerRef.current?.postMessage({type:"setSpeed",payload:{stepsPerFrame:v}});}}} style={{width:"80px",background:"rgba(255,255,255,0.06)",color:"#e8e8f0",border:"1px solid rgba(255,255,255,0.12)",borderRadius:6,padding:"4px 6px",marginRight:8}}/>
              <input type="range" min={1} max={100} value={Math.min(100, Math.max(1, stepsPerFrame))} onChange={handleSpeedChange} style={{ width: '100%', marginTop: 6, accentColor: '#7aa2ff' }} />
            </label>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 13, opacity: 0.85 }}>
              Max particles: <input type="number" value={maxParticles} onChange={(e)=>{const v=parseInt(e.target.value,10); if(!isNaN(v)){setMaxParticles(v); workerRef.current?.postMessage({type:'setMaxParticles',payload:{maxParticles:v}});}}} style={{width:'80px',background:'rgba(255,255,255,0.06)',color:'#e8e8f0',border:'1px solid rgba(255,255,255,0.12)',borderRadius:6,padding:'4px 6px',marginRight:8}}/>
              <input type="range" min={0} max={100} value={Math.min(100, Math.max(0, Math.log10(Math.max(1, maxParticles))/5*100))} onChange={(e)=>{const t=parseFloat(e.target.value)/100; const v=Math.round(Math.pow(10,5*t)); setMaxParticles(v); workerRef.current?.postMessage({type:'setMaxParticles',payload:{maxParticles:v}});}} style={{ width: '100%', marginTop: 6, accentColor: '#7aa2ff' }} />
            </label>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 13, opacity: 0.85 }}>
              Max speed: <input type="number" step="0.001" value={maxSpeed} onChange={(e)=>{const v=parseFloat(e.target.value); if(!isNaN(v)){setMaxSpeed(v); workerRef.current?.postMessage({type:"setMaxSpeed",payload:{maxSpeed:v}});}}} style={{width:"80px",background:"rgba(255,255,255,0.06)",color:"#e8e8f0",border:"1px solid rgba(255,255,255,0.12)",borderRadius:6,padding:"4px 6px",marginRight:8}}/>
              <input type="range" min={0.001} max={0.05} step={0.001} value={Math.min(0.05, Math.max(0.001, maxSpeed))} onChange={handleMaxSpeedChange} style={{ width: '100%', marginTop: 6, accentColor: '#7aa2ff' }} />
            </label>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 13, opacity: 0.85 }}>
              Interaction range: <input type="number" step="0.01" value={maxRange} onChange={(e)=>{const v=parseFloat(e.target.value); if(!isNaN(v)){setMaxRange(v); workerRef.current?.postMessage({type:"setMaxRange",payload:{maxRange:v}});}}} style={{width:"80px",background:"rgba(255,255,255,0.06)",color:"#e8e8f0",border:"1px solid rgba(255,255,255,0.12)",borderRadius:6,padding:"4px 6px",marginRight:8}}/>
              <input type="range" min={0.1} max={5.0} step={0.01} value={Math.min(5.0, Math.max(0.1, maxRange))} onChange={handleMaxRangeChange} style={{ width: '100%', marginTop: 6, accentColor: '#7aa2ff' }} />
            </label>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 13, opacity: 0.85 }}>
              Backend
              <select value={selectedBackend} onChange={handleBackendChange} style={{ width: '100%', marginTop: 6, background: 'rgba(255,255,255,0.06)', color: '#e8e8f0', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '6px' }}>
                <option value="CPU">CPU</option>
                <option value="WebGPU">WebGPU</option>
              </select>
            </label>
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.6, opacity: 0.95 }}>
           <div>Step: <strong>{timestep}</strong></div>
           <div>Backend: <strong>{backend}</strong></div>
           <div>FPS: <strong>{fps}</strong></div>
            {metrics && (
              <>
                <div>Particles: <strong>{metrics.count}</strong></div>
                <div>Total Health: <strong>{metrics.healthSum.toFixed(2)}</strong></div>
                <div>Total Charge: <strong>{metrics.chargeSum.toFixed(0)}</strong></div>
                <div>Avg Health: <strong>{(metrics.healthSum / metrics.count).toFixed(2)}</strong></div>
                <div>Avg Charge: <strong>{(metrics.chargeSum / metrics.count).toFixed(2)}</strong></div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const root = createRoot(document.getElementById('root')!);
root.render(<App />);

// End of main.tsx

