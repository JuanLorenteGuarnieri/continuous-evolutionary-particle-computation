const DEBUG_PROFILING = false;
/// <reference types="vite/client" />
import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
const defaultBindings = {
    panUp: 'w', panDown: 's', panLeft: 'a', panRight: 'd',
    zoomIn: '+', zoomOut: '-', togglePause: ' ', reset: 'Backspace',
    resetView: 'r', step: 'Enter', create: 'c', grab: 'g', inspect: 'i',
};
/**
 * Tab button.
 *
 * Defined outside App so React keeps the same component type
 * between renders. This is important for preserving focus,
 * pointer capture and interaction state.
 */
function TabButton({ id, label, activeTab, setActiveTab, }) {
    return (<button onClick={() => setActiveTab(id)} style={{
            flex: 1,
            padding: '6px 8px',
            borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.12)',
            background: activeTab === id
                ? 'rgba(122,162,255,0.2)'
                : 'rgba(255,255,255,0.06)',
            color: '#e8e8f0',
            cursor: 'pointer',
            fontSize: 12,
        }}>
      {label}
    </button>);
}
/**
 * Generic numeric parameter control.
 *
 * Defined outside App so changing App state does not create
 * a new component type and destroy the active <input>.
 */
function Param({ label, desc, value, setValue, configKey, min, max, step, reinit = false, postConfig, }) {
    const handleChange = (newValue) => {
        if (Number.isNaN(newValue))
            return;
        setValue(newValue);
        postConfig({ [configKey]: newValue }, reinit);
    };
    return (<div style={{ marginBottom: 10 }}>
      <div style={{
            fontSize: 12,
            opacity: 0.9,
            display: 'flex',
            justifyContent: 'space-between',
        }}>
        <span>{label}</span>

        <span style={{
            opacity: 0.6,
            fontSize: 11,
        }}>
          {desc}
        </span>
      </div>

      <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginTop: 4,
        }}>
        {/* Slider */}
        <input type="range" min={min} max={max} step={step} value={value} onChange={(event) => {
            handleChange(parseFloat(event.target.value));
        }} style={{
            flex: 1,
            accentColor: '#7aa2ff',
        }}/>

        {/* Numeric input */}
        <input type="number" min={min} max={max} value={value} step={step} onChange={(event) => {
            handleChange(parseFloat(event.target.value));
        }} style={{
            width: 80,
            background: 'rgba(255,255,255,0.06)',
            color: '#e8e8f0',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 6,
            padding: '4px 6px',
        }}/>
      </div>

      <div style={{
            fontSize: 10,
            opacity: 0.5,
            marginTop: 2,
        }}>
        {value.toFixed(step < 1 ? 3 : 0)}
      </div>
    </div>);
}
/**
 * External input signal control.
 *
 * Kept outside App for the same reason as Param.
 */
function InputControl({ value, setValue, postInput, }) {
    const handleChange = (newValue) => {
        if (Number.isNaN(newValue))
            return;
        const clamped = Math.max(0, Math.min(1, newValue));
        setValue(clamped);
        postInput(clamped);
    };
    return (<div style={{ marginBottom: 10 }}>
      <div style={{
            fontSize: 12,
            opacity: 0.9,
            display: 'flex',
            justifyContent: 'space-between',
        }}>
        <span>Input signal (u)</span>

        <span style={{
            opacity: 0.6,
            fontSize: 11,
        }}>
          [0,1] normalized
        </span>
      </div>

      <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginTop: 4,
        }}>
        {/* Slider */}
        <input type="range" min={0} max={1} step={0.01} value={value} onChange={(event) => {
            handleChange(parseFloat(event.target.value));
        }} style={{
            flex: 1,
            accentColor: '#7aa2ff',
        }}/>

        {/* Numeric input */}
        <input type="number" min={0} max={1} value={value} step={0.01} onChange={(event) => {
            handleChange(parseFloat(event.target.value));
        }} style={{
            width: 80,
            background: 'rgba(255,255,255,0.06)',
            color: '#e8e8f0',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 6,
            padding: '4px 6px',
        }}/>
      </div>

      <div style={{
            fontSize: 10,
            opacity: 0.5,
            marginTop: 2,
        }}>
        {value.toFixed(3)}
      </div>
    </div>);
}
function App() {
    const canvasRef = useRef(null);
    const workerRef = useRef(null);
    // Metrics / runtime state
    const [metrics, setMetrics] = useState(null);
    const [timestep, setTimestep] = useState(0);
    // Keep UI state synchronized with worker.ts V1:
    // worker starts with isPaused = true.
    const [isPaused, setIsPaused] = useState(false);
    const [stepsPerFrame, setStepsPerFrame] = useState(1);
    const [backend, setBackend] = useState('CPU');
    const [fps, setFps] = useState(0);
    const [workerFps, setWorkerFps] = useState(0);
    const [showHud, setShowHud] = useState(true);
    const [activeTab, setActiveTab] = useState('sim');
    const [particleInspection, setParticleInspection] = useState(null);
    const [bindings, setBindings] = useState(defaultBindings);
    const bindingsRef = useRef(bindings);
    const pressedKeysRef = useRef(new Set());
    const grabbingRef = useRef(false);
    const grabRangeRef = useRef(0.05);
    const uiFpsSamplesRef = useRef([]);
    const workerFpsSamplesRef = useRef([]);
    const fpsUpdateTimerRef = useRef(null);
    // Simulation
    const [maxParticles, setMaxParticles] = useState(200);
    const [seed, setSeed] = useState(42);
    const [selectedBackend, setSelectedBackend] = useState('CPU');
    const [inputSignal, setInputSignal] = useState(0.05);
    const inputSignalRef = useRef(inputSignal);
    // Model
    const [Lx, setLx] = useState(10);
    const [Ly, setLy] = useState(10);
    const [dt, setDt] = useState(0.1);
    const [Qmax, setQmax] = useState(100);
    const [RsMin, setRsMin] = useState(0.5);
    const [RsMax, setRsMax] = useState(5.0);
    // Genome
    const [Hmax, setHmax] = useState(50);
    const [theta_q, setTheta_q] = useState(10);
    const [A, setA] = useState(1);
    const [K, setK] = useState(1);
    const [Rc, setRc] = useState(1.0);
    const [m, setM] = useState(1.0);
    const [gamma, setGamma] = useState(0.8);
    const [Rs, setRs] = useState(1.0);
    const [omega_R, setOmega_R] = useState(0.1);
    const [omega_A, setOmega_A] = useState(-0.5);
    const [omega_v, setOmega_v] = useState(-0.5);
    const [genomeVariation, setGenomeVariation] = useState(0.35);
    const [mateRadiusPercent, setMateRadiusPercent] = useState(80);
    const [mateHealthPercent, setMateHealthPercent] = useState(90);
    const [birthHealthPercent, setBirthHealthPercent] = useState(10);
    const [matingProbability, setMatingProbability] = useState(0.01);
    const [communicationAlpha, setCommunicationAlpha] = useState(1);
    useEffect(() => {
        bindingsRef.current = bindings;
    }, [bindings]);
    useEffect(() => {
        inputSignalRef.current = inputSignal;
    }, [inputSignal]);
    const postPointer = (clientX, clientY) => {
        const canvas = canvasRef.current;
        if (!canvas)
            return;
        const rect = canvas.getBoundingClientRect();
        const canvasX = clientX - rect.left;
        const canvasY = clientY - rect.top;
        const canvasAspect = rect.width / rect.height;
        const simulationAspect = 800 / 600;
        const renderedWidth = canvasAspect >= simulationAspect
            ? rect.height * simulationAspect
            : rect.width;
        const renderedHeight = canvasAspect >= simulationAspect
            ? rect.height
            : rect.width / simulationAspect;
        const renderedLeft = (rect.width - renderedWidth) / 2;
        const renderedTop = (rect.height - renderedHeight) / 2;
        const renderedX = canvasX - renderedLeft;
        const renderedY = canvasY - renderedTop;
        const insideCanvas = canvasX >= 0 && canvasX <= rect.width && canvasY >= 0 && canvasY <= rect.height;
        const insideSimulation = renderedX >= 0 && renderedX <= renderedWidth && renderedY >= 0 && renderedY <= renderedHeight;
        workerRef.current?.postMessage({ type: 'pointer', payload: {
                x: renderedX / renderedWidth,
                y: renderedY / renderedHeight,
                inside: insideCanvas && insideSimulation,
            } });
    };
    const handlePointerMove = (event) => postPointer(event.clientX, event.clientY);
    useEffect(() => {
        const handleWindowPointerMove = (event) => postPointer(event.clientX, event.clientY);
        const handleWindowPointerLeave = () => workerRef.current?.postMessage({ type: 'pointer', payload: { x: 0, y: 0, inside: false } });
        window.addEventListener('mousemove', handleWindowPointerMove);
        window.addEventListener('mouseout', handleWindowPointerLeave);
        return () => {
            window.removeEventListener('mousemove', handleWindowPointerMove);
            window.removeEventListener('mouseout', handleWindowPointerLeave);
        };
    }, []);
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas)
            return;
        const handleWheel = (event) => {
            event.preventDefault();
            const delta = event.deltaY < 0 ? 1 : -1;
            if (grabbingRef.current) {
                grabRangeRef.current = Math.max(0.005, Math.min(0.5, grabRangeRef.current + delta * 0.01));
                workerRef.current?.postMessage({
                    type: 'grabRange',
                    payload: {
                        delta: delta * 0.01,
                    },
                });
            }
            else {
                workerRef.current?.postMessage({
                    type: 'cameraZoom',
                    payload: {
                        delta,
                    },
                });
            }
        };
        canvas.addEventListener('wheel', handleWheel, { passive: false });
        return () => {
            canvas.removeEventListener('wheel', handleWheel);
        };
    }, []);
    /**
     * Initialize the worker once.
     */
    useEffect(() => {
        if (!canvasRef.current)
            return;
        // Keep rendering contexts isolated: an OffscreenCanvas can only own one
        // context type. WebGPU and CPU/2D rendering therefore use separate
        // OffscreenCanvas instances, allowing backend switching without losing
        // the WebGPU context.
        const offscreen = new OffscreenCanvas(800, 600);
        const webgpuCanvas = new OffscreenCanvas(800, 600);
        const worker = new Worker(new URL('@worker', import.meta.url), { type: 'module' });
        worker.onerror = (e) => {
            console.error('Worker error:', e);
            console.log('Worker script URL:', worker);
        };
        workerRef.current = worker;
        const config = {
            Lx,
            Ly,
            dt,
            Qmax,
            R_s_min: RsMin,
            R_s_max: RsMax,
            maxParticles,
            seed,
            Hmax,
            theta_q,
            A,
            K,
            Rc,
            m,
            gamma,
            Rs,
            omega_R,
            omega_A,
            omega_v,
            backend: selectedBackend,
            Q_in_max: 50,
            inputSignal: inputSignalRef.current,
            genome_variation: genomeVariation,
            mate_radius_percent: mateRadiusPercent / 100,
            mate_health_percent: mateHealthPercent / 100,
            birth_health_percent: birthHealthPercent / 100,
            mating_probability: matingProbability,
            communication_alpha: communicationAlpha,
        };
        worker.postMessage({
            type: 'init',
            offscreen,
            webgpuCanvas,
            config,
        }, [offscreen, webgpuCanvas]);
        worker.postMessage({
            type: 'setBackend',
            payload: { backend: selectedBackend },
        });
        worker.onmessage = (event) => {
            const { type, payload } = event.data;
            switch (type) {
                case 'frame':
                    if (payload?.offscreen) {
                        handleFrame(payload.offscreen);
                    }
                    break;
                case 'metrics':
                    setMetrics(payload.metrics);
                    setTimestep(payload.timestep);
                    if (payload.workerFps !== undefined &&
                        Number.isFinite(payload.workerFps) &&
                        payload.workerFps > 0) {
                        workerFpsSamplesRef.current.push(payload.workerFps);
                    }
                    break;
                case 'particleInspection':
                    setParticleInspection(payload);
                    setActiveTab('particle');
                    break;
                case 'backend':
                    setBackend(payload.backend);
                    break;
                case 'error':
                    console.error('Worker error:', payload);
                    break;
                default:
                    console.warn('Unknown message from worker:', type);
                    break;
            }
        };
        fpsUpdateTimerRef.current = window.setInterval(() => {
            const uiSamples = uiFpsSamplesRef.current;
            const workerSamples = workerFpsSamplesRef.current;
            if (uiSamples.length > 0) {
                const uiAverage = uiSamples.reduce((sum, value) => sum + value, 0) / uiSamples.length;
                setFps(+uiAverage.toFixed(1));
            }
            if (workerSamples.length > 0) {
                const workerAverage = workerSamples.reduce((sum, value) => sum + value, 0) / workerSamples.length;
                setWorkerFps(workerAverage);
            }
            uiFpsSamplesRef.current = [];
            workerFpsSamplesRef.current = [];
        }, 500);
        let lastTime = 0;
        let animationFrameId = 0;
        const animate = (time) => {
            if (lastTime > 0) {
                const delta = time - lastTime;
                if (delta > 0) {
                    const instantFps = 1000 / delta;
                    uiFpsSamplesRef.current.push(instantFps);
                }
            }
            lastTime = time;
            const activeBindings = bindingsRef.current;
            const pressedKeys = pressedKeysRef.current;
            const dx = (pressedKeys.has(activeBindings.panRight.toLowerCase()) ? 1 : 0) -
                (pressedKeys.has(activeBindings.panLeft.toLowerCase()) ? 1 : 0);
            const dy = (pressedKeys.has(activeBindings.panDown.toLowerCase()) ? 1 : 0) -
                (pressedKeys.has(activeBindings.panUp.toLowerCase()) ? 1 : 0);
            if (dx !== 0 || dy !== 0) {
                workerRef.current?.postMessage({ type: 'cameraPan', payload: { dx: dx * 0.018, dy: dy * 0.018 } });
            }
            // Request next frame from worker
            workerRef.current?.postMessage({ type: 'frame' });
            animationFrameId = requestAnimationFrame(animate);
        };
        animationFrameId = requestAnimationFrame(animate);
        return () => {
            cancelAnimationFrame(animationFrameId);
            if (fpsUpdateTimerRef.current !== null) {
                window.clearInterval(fpsUpdateTimerRef.current);
                fpsUpdateTimerRef.current = null;
            }
            uiFpsSamplesRef.current = [];
            workerFpsSamplesRef.current = [];
            worker.terminate();
            if (workerRef.current === worker) {
                workerRef.current = null;
            }
        };
    }, [
        A,
        Hmax,
        K,
        Lx,
        Ly,
        Qmax,
        Rc,
        Rs,
        RsMax,
        RsMin,
        dt,
        gamma,
        m,
        maxParticles,
        omega_A,
        omega_R,
        omega_v,
        seed,
        selectedBackend,
        theta_q,
        genomeVariation,
        mateRadiusPercent,
        mateHealthPercent,
        birthHealthPercent,
        matingProbability,
        communicationAlpha,
    ]);
    /**
     * Keep the visible canvas synchronized with the window size.
     */
    useEffect(() => {
        const updateSize = () => {
            const canvas = canvasRef.current;
            if (!canvas)
                return;
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            canvas.width = Math.floor(window.innerWidth * dpr);
            canvas.height = Math.floor(window.innerHeight * dpr);
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            }
        };
        updateSize();
        window.addEventListener('resize', updateSize);
        return () => {
            window.removeEventListener('resize', updateSize);
        };
    }, []);
    /**
     * Draw a received ImageBitmap on the visible canvas.
     */
    const handleFrame = (bitmap) => {
        const profileStart = performance.now();
        const canvas = canvasRef.current;
        if (!canvas) {
            bitmap.close();
            return;
        }
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            bitmap.close();
            return;
        }
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const cw = canvas.clientWidth;
        const ch = canvas.clientHeight;
        const bw = bitmap.width;
        const bh = bitmap.height;
        const scale = Math.min(cw / bw, ch / bh);
        const dw = bw * scale;
        const dh = bh * scale;
        const dx = (cw - dw) / 2;
        const dy = (ch - dh) / 2;
        ctx.drawImage(bitmap, dx, dy, dw, dh);
        bitmap.close();
        if (DEBUG_PROFILING) {
            console.log('[CEPC][main][profiling] handleFrame', { elapsedMs: performance.now() - profileStart, bitmapWidth: bw, bitmapHeight: bh });
        }
    };
    /**
     * Send a configuration update to the worker.
     */
    const postConfig = (partial, reinit = false) => {
        setIsPaused(false);
        workerRef.current?.postMessage({
            type: reinit
                ? 'reinit'
                : 'updateConfig',
            payload: partial,
        });
    };
    /**
     * Send an external input signal to the worker.
     */
    const postInput = (value) => {
        workerRef.current?.postMessage({
            type: 'setInput',
            payload: {
                u: value,
            },
        });
    };
    /**
     * Playback controls.
     */
    const handlePlay = () => {
        setIsPaused(false);
        workerRef.current?.postMessage({
            type: 'play',
        });
    };
    const handlePause = () => {
        setIsPaused(true);
        workerRef.current?.postMessage({
            type: 'pause',
        });
    };
    const handleStep = () => {
        workerRef.current?.postMessage({
            type: 'step',
        });
    };
    const handleReset = () => {
        setIsPaused(false);
        workerRef.current?.postMessage({
            type: 'reset',
        });
        setTimestep(0);
    };
    /**
     * Playback speed.
     */
    const handleStepsPerFrameChange = (value) => {
        if (!Number.isFinite(value))
            return;
        const clamped = Math.max(1, Math.floor(value));
        setStepsPerFrame(clamped);
        workerRef.current?.postMessage({
            type: 'setSpeed',
            payload: {
                stepsPerFrame: clamped,
            },
        });
    };
    useEffect(() => {
        const isTypingTarget = (target) => {
            const element = target;
            return element?.tagName === 'INPUT' || element?.tagName === 'SELECT' || element?.tagName === 'TEXTAREA';
        };
        const matches = (event, binding) => binding === ' ' ? event.code === 'Space' : event.key.toLowerCase() === binding.toLowerCase();
        const onKeyDown = (event) => {
            if (isTypingTarget(event.target))
                return;
            const active = bindingsRef.current;
            if (matches(event, active.panUp) || matches(event, active.panDown) || matches(event, active.panLeft) || matches(event, active.panRight)) {
                event.preventDefault();
                pressedKeysRef.current.add(event.key.toLowerCase());
            }
            else if (matches(event, active.zoomIn) || event.key === '=') {
                event.preventDefault();
                workerRef.current?.postMessage({ type: 'cameraZoom', payload: { delta: 1 } });
            }
            else if (matches(event, active.zoomOut)) {
                event.preventDefault();
                workerRef.current?.postMessage({ type: 'cameraZoom', payload: { delta: -1 } });
            }
            else if (matches(event, active.togglePause) && !event.repeat) {
                event.preventDefault();
                (isPaused ? handlePlay : handlePause)();
            }
            else if (matches(event, active.reset) && !event.repeat) {
                event.preventDefault();
                handleReset();
            }
            else if (matches(event, active.resetView) && !event.repeat) {
                event.preventDefault();
                resetView();
            }
            else if (matches(event, active.step) && !event.repeat) {
                event.preventDefault();
                handleStep();
            }
            else if (matches(event, active.create) && !event.repeat) {
                event.preventDefault();
                workerRef.current?.postMessage({ type: 'createParticle' });
            }
            else if (matches(event, active.inspect) && !event.repeat) {
                event.preventDefault();
                workerRef.current?.postMessage({ type: 'inspectParticle' });
            }
            else if (matches(event, active.grab) && !event.repeat) {
                event.preventDefault();
                grabbingRef.current = true;
                workerRef.current?.postMessage({ type: 'grabStart', payload: { rangePercent: grabRangeRef.current } });
            }
        };
        const onKeyUp = (event) => {
            pressedKeysRef.current.delete(event.key.toLowerCase());
            if (matches(event, bindingsRef.current.grab)) {
                grabbingRef.current = false;
                workerRef.current?.postMessage({ type: 'grabEnd' });
            }
        };
        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);
        return () => { window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp); };
    });
    const resetView = () => workerRef.current?.postMessage({ type: 'cameraReset' });
    const closeParticleInspection = () => {
        setParticleInspection(null);
        setActiveTab('sim');
    };
    const copyParticleInspection = async () => {
        if (!particleInspection)
            return;
        await navigator.clipboard.writeText(JSON.stringify(particleInspection, null, 2));
    };
    const setBinding = (name, value) => {
        setBindings((current) => ({ ...current, [name]: value || defaultBindings[name] }));
    };
    return (<div style={{
            position: 'fixed',
            inset: 0,
            background: '#050508',
            color: '#e8e8f0',
            fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
            overflow: 'hidden',
        }}>
      <style>{`
        .cepc-scroll {
          scrollbar-color: rgba(122, 162, 255, 0.75) rgba(255, 255, 255, 0.06);
          scrollbar-width: thin;
        }
        .cepc-scroll::-webkit-scrollbar { width: 8px; }
        .cepc-scroll::-webkit-scrollbar-track { background: rgba(255, 255, 255, 0.06); border-radius: 8px; }
        .cepc-scroll::-webkit-scrollbar-thumb { background: rgba(122, 162, 255, 0.75); border-radius: 8px; }
      `}</style>
      {/* Simulation canvas */}
      <canvas ref={canvasRef} onMouseMove={handlePointerMove} onContextMenu={(event) => event.preventDefault()} style={{
            position: 'absolute',
            inset: 0,
            width: '100vw',
            height: '100vh',
            display: 'block',
            background: '#000',
        }}/>

      {/* HUD toggle */}
      <button onClick={() => setShowHud((visible) => !visible)} style={{
            position: 'absolute',
            top: 16,
            right: 16,
            zIndex: 20,
            background: 'rgba(15,15,25,0.7)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.12)',
            color: '#e8e8f0',
            borderRadius: 12,
            padding: '8px 12px',
            cursor: 'pointer',
            fontSize: 14,
        }}>
        {showHud
            ? 'Hide HUD'
            : 'Show HUD'}
     </button>

      {/* Metrics panel top left */}
      {showHud && (<div style={{
                position: 'absolute',
                top: 16,
                left: 16,
                zIndex: 10,
                background: 'rgba(15,15,25,0.55)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 16,
                padding: '12px 16px',
                boxShadow: '0 8px 30px rgba(0,0,0,0.45)',
                fontSize: 13,
                lineHeight: 1.6,
                opacity: 0.95,
                minWidth: 150,
            }}>
          <div>Step: <strong>{timestep}</strong></div>
          <div>Backend: <strong>{backend}</strong></div>
          <div>UI FPS: <strong>{fps}</strong></div>
          <div>Worker FPS: <strong>{workerFps.toFixed(1)}</strong></div>
          {metrics && (<>
              <div>Particles: <strong>{metrics.count ?? '-'}</strong></div>
              <div>Total Health: <strong>{metrics.healthSum?.toFixed(2) ?? '-'}</strong></div>
              <div>Total Charge: <strong>{metrics.chargeSum?.toFixed(0) ?? '-'}</strong></div>
              <div>Input Charge: <strong>{metrics.inputCharge?.toFixed(0) ?? '-'}</strong></div>
              <div>Output Charge: <strong>{metrics.outputCharge?.toFixed(0) ?? '-'}</strong></div>
            </>)}
        </div>)}

     {showHud && (<div style={{
                position: 'absolute',
                top: 16,
                right: 16,
                zIndex: 10,
                background: 'rgba(15,15,25,0.55)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 16,
                padding: '16px 20px',
                boxShadow: '0 8px 30px rgba(0,0,0,0.45)',
                width: 'min(460px, 94vw)',
            }}>
          <h1 style={{
                margin: '0 0 12px 0',
                fontSize: 20,
                fontWeight: 600,
            }}>
            CEPC Simulation
          </h1>

          {/* Tabs */}
          <div style={{
                display: 'flex',
                gap: 8,
                marginBottom: 12,
            }}>
            <TabButton id="sim" label="Simulación" activeTab={activeTab} setActiveTab={setActiveTab}/>

            <TabButton id="model" label="Modelo" activeTab={activeTab} setActiveTab={setActiveTab}/>

            <TabButton id="genome" label="Genotipo" activeTab={activeTab} setActiveTab={setActiveTab}/>

            <TabButton id="controls" label="Controles" activeTab={activeTab} setActiveTab={setActiveTab}/>

            {particleInspection && (<TabButton id="particle" label="Partícula" activeTab={activeTab} setActiveTab={setActiveTab}/>)}
          </div>

          {/* Export button */}
          <div style={{ marginBottom: 12 }}>
            <button onClick={handleExport} className="cepc-scroll" style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid rgba(255,255,255,0.12)',
                background: 'rgba(255,255,255,0.06)',
                color: '#e8e8f0',
                cursor: 'pointer',
                fontSize: 12,
            }}>
              Export Results
            </button>
          </div>

          {/* Playback controls */}
          <div style={{
                display: 'flex',
                gap: 8,
                flexWrap: 'wrap',
                marginBottom: 12,
            }}>
            <button onClick={handlePlay} disabled={!isPaused} style={{
                flex: '1 1 auto',
                padding: '8px 12px',
                borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.12)',
                background: 'rgba(255,255,255,0.06)',
                color: '#e8e8f0',
                cursor: 'pointer',
                opacity: !isPaused ? 0.5 : 1,
            }}>
              ▶ Play
            </button>

            <button onClick={handlePause} disabled={isPaused} style={{
                flex: '1 1 auto',
                padding: '8px 12px',
                borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.12)',
                background: 'rgba(255,255,255,0.06)',
                color: '#e8e8f0',
                cursor: 'pointer',
                opacity: isPaused ? 0.5 : 1,
            }}>
              ⏸ Pause
            </button>

            <button onClick={handleStep} disabled={!isPaused} style={{
                flex: '1 1 auto',
                padding: '8px 12px',
                borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.12)',
                background: 'rgba(255,255,255,0.06)',
                color: '#e8e8f0',
                cursor: 'pointer',
                opacity: !isPaused ? 0.5 : 1,
            }}>
              ⏭ Step
            </button>

            <button onClick={handleReset} style={{
                flex: '1 1 auto',
                padding: '8px 12px',
                borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.12)',
                background: 'rgba(255,255,255,0.06)',
                color: '#e8e8f0',
                cursor: 'pointer',
            }}>
              ⟲ Reset
            </button>
          </div>

          {/* Simulation tab */}
          {activeTab === 'sim' && (<>
              <div style={{
                    marginBottom: 12,
                }}>
                <Param label="Max particles" desc="Capacidad poblacional Nmax" value={maxParticles} setValue={setMaxParticles} configKey="maxParticles" postConfig={postConfig} min={10} max={1000} step={10} reinit={true}/>

                <Param label="Seed" desc="Reproducibilidad PRNG" value={seed} setValue={setSeed} configKey="seed" postConfig={postConfig} min={0} max={100000} step={1} reinit={true}/>

                <InputControl value={inputSignal} setValue={setInputSignal} postInput={postInput}/>

                <label style={{
                    fontSize: 13,
                    opacity: 0.85,
                    display: 'block',
                    marginTop: 8,
                }}>
                  Backend

                  <select value={selectedBackend} onChange={(event) => {
                    const value = event.target
                        .value;
                    setSelectedBackend(value);
                    workerRef.current?.postMessage({
                        type: 'setBackend',
                        payload: {
                            backend: value,
                        },
                    });
                }} style={{
                    width: '100%',
                    marginTop: 6,
                    background: 'rgba(255,255,255,0.06)',
                    color: '#e8e8f0',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: 8,
                    padding: '6px',
                }}>
                    <option value="CPU">
                      CPU
                    </option>

                    <option value="WebGPU">
                      WebGPU
                    </option>
                  </select>
                </label>

                {/* Optional steps-per-frame control */}
                <Param label="Steps per frame" desc="Pasos de simulación por actualización" value={stepsPerFrame} setValue={handleStepsPerFrameChange} configKey="stepsPerFrame" postConfig={() => { }} min={1} max={100} step={1} reinit={false}/>
              </div>
            </>)}

          {/* Model tab */}
          {activeTab === 'model' && (<div style={{
                    marginBottom: 12,
                    maxHeight: '320px',
                    overflow: 'auto',
                }}>
              <Param label="Lx" desc="Ancho dominio toroidal" value={Lx} setValue={setLx} configKey="Lx" postConfig={postConfig} min={5} max={500} step={1} reinit={true}/>

              <Param label="Ly" desc="Alto dominio toroidal" value={Ly} setValue={setLy} configKey="Ly" postConfig={postConfig} min={5} max={500} step={1} reinit={true}/>

              <Param label="dt" desc="Paso temporal integración" value={dt} setValue={setDt} configKey="dt" postConfig={postConfig} min={0.01} max={0.5} step={0.01} reinit={false}/>

              <Param label="Qmax" desc="Cap carga máxima" value={Qmax} setValue={setQmax} configKey="Qmax" postConfig={postConfig} min={100} max={5000} step={100} reinit={false}/>

             <Param label="R_s min" desc="Rango espacial mínimo" value={RsMin} setValue={setRsMin} configKey="R_s_min" postConfig={postConfig} min={0.1} max={5} step={0.1} reinit={false}/>

              <Param label="R_s max" desc="Rango espacial máximo" value={RsMax} setValue={setRsMax} configKey="R_s_max" postConfig={postConfig} min={1} max={50} step={0.5} reinit={false}/>

              <Param label="Radio de apareamiento" desc="% del menor Rc parental" value={mateRadiusPercent} setValue={setMateRadiusPercent} configKey="mate_radius_percent" postConfig={postConfig} min={0} max={200} step={1}/>
              <Param label="Salud mínima para aparear" desc="% de Hmax parental" value={mateHealthPercent} setValue={setMateHealthPercent} configKey="mate_health_percent" postConfig={postConfig} min={0} max={100} step={1}/>
              <Param label="Salud inicial de descendencia" desc="% de Hmax del hijo" value={birthHealthPercent} setValue={setBirthHealthPercent} configKey="birth_health_percent" postConfig={postConfig} min={0} max={100} step={1}/>
              <Param label="Probabilidad de apareamiento" desc="mating_probability" value={matingProbability} setValue={setMatingProbability} configKey="mating_probability" postConfig={postConfig} min={0} max={1} step={0.01}/>
              <Param label="Intensidad softmax" desc="0 uniforme · alto selectivo" value={communicationAlpha} setValue={setCommunicationAlpha} configKey="communication_alpha" postConfig={postConfig} min={0} max={10} step={0.1}/>

              <Param label="Variación genómica" desc="Variación inicial relativa de partículas internas" value={genomeVariation} setValue={setGenomeVariation} configKey="genome_variation" postConfig={postConfig} min={0} max={0.5} step={0.01} reinit={true}/>
            </div>)}

          {activeTab === 'controls' && (<div className="cepc-scroll" style={{ marginBottom: 12, maxHeight: '360px', overflow: 'auto' }}>
              <button onClick={resetView} style={{ width: '100%', padding: '8px 12px', marginBottom: 12, borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)', color: '#e8e8f0', cursor: 'pointer' }}>
                Restaurar vista
              </button>
              <Param label="Radio de agarre" desc="Porcentaje del dominio al pulsar G" value={grabRangeRef.current * 100} setValue={(value) => { grabRangeRef.current = Math.max(0.5, Math.min(50, value)) / 100; }} configKey="grabRangePercent" postConfig={() => { }} min={0.5} max={50} step={0.5}/>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px', gap: 8, alignItems: 'center', fontSize: 12 }}>
                {Object.keys(defaultBindings).map((name) => (<React.Fragment key={name}>
                    <label htmlFor={`binding-${name}`}>{name}</label>
                    <input id={`binding-${name}`} value={bindings[name]} maxLength={12} onChange={(event) => setBinding(name, event.target.value)} style={{ width: 80, background: 'rgba(255,255,255,0.06)', color: '#e8e8f0', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, padding: '4px 6px' }}/>
                  </React.Fragment>))}
              </div>
              <button onClick={() => setBindings(defaultBindings)} style={{ width: '100%', padding: '8px 12px', marginTop: 12, borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)', color: '#e8e8f0', cursor: 'pointer' }}>
                Restaurar teclas
              </button>
            </div>)}

          {activeTab === 'particle' && particleInspection && (<div className="cepc-scroll" style={{ marginBottom: 12, maxHeight: '360px', overflow: 'auto' }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <button onClick={closeParticleInspection} style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)', color: '#e8e8f0', cursor: 'pointer' }}>
                  Cerrar
                </button>
                <button onClick={copyParticleInspection} style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(122,162,255,0.2)', color: '#e8e8f0', cursor: 'pointer' }}>
                  Copiar datos
                </button>
              </div>
              <div style={{ fontSize: 12, lineHeight: 1.7 }}>
                <div>ID: <strong>{particleInspection.id}</strong></div>
                <div>Rol: <strong>{particleInspection.role}</strong></div>
                <div>Posición: <strong>{particleInspection.position.x.toFixed(3)}, {particleInspection.position.y.toFixed(3)}</strong></div>
                <div>Velocidad: <strong>{particleInspection.velocity.x.toFixed(3)}, {particleInspection.velocity.y.toFixed(3)}</strong></div>
                <div>Salud: <strong>{particleInspection.health.toFixed(3)}</strong></div>
                <div>Carga: <strong>{particleInspection.charge}</strong></div>
                <div>Remitentes actuales: <strong>{particleInspection.senderSet.join(', ') || '-'}</strong></div>
                <div>Remitentes previos: <strong>{particleInspection.prevSenderSet.join(', ') || '-'}</strong></div>
              </div>
              <h3 style={{ fontSize: 13, margin: '14px 0 6px' }}>Genoma</h3>
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 11, color: '#b9c9ff' }}>
                {JSON.stringify(particleInspection.genome, null, 2)}
              </pre>
            </div>)}

          {/* Genome tab */}
          {activeTab === 'genome' && (<div className="cepc-scroll" style={{
                    marginBottom: 12,
                    maxHeight: '320px',
                    overflow: 'auto',
                }}>
              <Param label="Hmax" desc="Salud máxima por partícula" value={Hmax} setValue={setHmax} configKey="Hmax" postConfig={postConfig} min={10} max={500} step={1} reinit={true}/>

              <Param label="theta_q" desc="Umbral de activación carga" value={theta_q} setValue={setTheta_q} configKey="theta_q" postConfig={postConfig} min={1} max={100} step={1} reinit={true}/>

              <Param label="A" desc="Factor multiplicativo carga" value={A} setValue={setA} configKey="A" postConfig={postConfig} min={0.5} max={10} step={0.1} reinit={true}/>

              <Param label="K" desc="Máx targets comunicación" value={K} setValue={setK} configKey="K" postConfig={postConfig} min={1} max={20} step={1} reinit={true}/>

              <Param label="Rc" desc="Radio comunicación" value={Rc} setValue={setRc} configKey="Rc" postConfig={postConfig} min={0.1} max={20} step={0.1} reinit={true}/>

              <Param label="m" desc="Masa partícula" value={m} setValue={setM} configKey="m" postConfig={postConfig} min={0.1} max={10} step={0.1} reinit={true}/>

              <Param label="gamma" desc="Amortiguamiento" value={gamma} setValue={setGamma} configKey="gamma" postConfig={postConfig} min={0} max={1} step={0.01} reinit={true}/>

              <Param label="Rs" desc="Rango espacial base gen" value={Rs} setValue={setRs} configKey="Rs" postConfig={postConfig} min={0.1} max={20} step={0.1} reinit={true}/>

              <Param label="omega_R" desc="Peso preferencia Rc" value={omega_R} setValue={setOmega_R} configKey="omega_R" postConfig={postConfig} min={-2} max={2} step={0.1} reinit={true}/>

              <Param label="omega_A" desc="Peso preferencia A" value={omega_A} setValue={setOmega_A} configKey="omega_A" postConfig={postConfig} min={-2} max={2} step={0.1} reinit={true}/>

              <Param label="omega_v" desc="Peso preferencia velocidad" value={omega_v} setValue={setOmega_v} configKey="omega_v" postConfig={postConfig} min={-2} max={2} step={0.1} reinit={true}/>
            </div>)}
        </div>)}
    </div>);
}
const root = createRoot(document.getElementById('root'));
/* Add the export handler function */
const handleExport = () => {
    // Implementation would export manifest, metrics, and metadata
    // Per user guide: "Click the export button to download a zip containing:
    // - Experiment manifest (JSON)
    // - Metrics (CSV/JSON)
    // - Metadata (model version, git commit, seed)"
    alert('Export functionality would be implemented here per the user guide');
};
root.render(<App />);
