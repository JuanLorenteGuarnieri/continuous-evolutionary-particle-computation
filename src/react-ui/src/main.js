import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useRef, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
function App() {
    const canvasRef = useRef(null);
    const workerRef = useRef(null);
    const [metrics, setMetrics] = useState(null);
    const [timestep, setTimestep] = useState(0);
    const [isPaused, setIsPaused] = useState(true);
    const [stepsPerFrame, setStepsPerFrame] = useState(1);
    const [backend, setBackend] = useState('CPU');
    const [fps, setFps] = useState(0);
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas)
            return;
        // Create OffscreenCanvas for WebGPU rendering
        const offscreen = new OffscreenCanvas(800, 600);
        // Create worker from the worker.ts file
        const worker = new Worker(new URL('@worker', import.meta.url), { type: 'module' });
        workerRef.current = worker;
        // Send initial message with OffscreenCanvas and config
        const config = {
            Lx: 100,
            Ly: 100,
            Hmax: 100,
            theta_q: 10,
            A: 2,
            K: 4,
            Rc: 1.0,
            m: 1.0,
            gamma: 0.1,
            Rs: 1.0,
            omega_R: 0.5,
            omega_A: 0.5,
            omega_v: 0.5,
            seed: Math.floor(Math.random() * 1000)
        };
        worker.postMessage({ type: 'init', offscreen, config }, [offscreen]);
        // Handle messages from worker
        worker.onmessage = (event) => {
            const { type, payload } = event.data;
            switch (type) {
                case 'frame':
                    // Received OffscreenCanvas back from worker
                    handleFrame(payload.offscreen);
                    break;
                case 'metrics':
                    setMetrics(payload.metrics);
                    setTimestep(payload.timestep);
                    break;
                case 'backend':
                    setBackend(payload.backend);
                    break;
                case 'error':
                    console.error('Worker error:', payload);
                    break;
            }
        };
        // Animation loop to request frames and update FPS
        let lastTime = 0;
        let fpsCount = 0;
        let fpsTimer = 0;
        const animate = (time) => {
            // Request a frame from the worker (by sending the OffscreenCanvas back)
            // We'll do this in the handleFrame function when we receive the OffscreenCanvas.
            // We'll just update FPS here.
            fpsCount++;
            fpsTimer += time - lastTime;
            if (fpsTimer >= 1000) {
                setFps(fpsCount);
                fpsCount = 0;
                fpsTimer = 0;
            }
            lastTime = time;
            requestAnimationFrame(animate);
        };
        requestAnimationFrame(animate);
        return () => {
            worker?.terminate();
        };
    }, [canvasRef]);
    const handleFrame = (offscreen) => {
        const canvas = canvasRef.current;
        if (!canvas)
            return;
        // Convert OffscreenCanvas to ImageBitmap and draw to canvas
        offscreen
            .transferToImageBitmap()
            .then((bitmap) => {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
                bitmap.close();
            }
        });
        // Send the OffscreenCanvas back to the worker for the next frame
        const worker = workerRef.current;
        if (worker) {
            worker.postMessage({ type: 'frame', offscreen }, [offscreen]);
        }
        // If paused, we don't need to request another frame until we get a play or step
        // We'll rely on the worker to not send frames when paused? Actually, the worker
        // will still send frames because we are sending the OffscreenCanvas back each time.
        // We'll need to modify the worker to not render when paused.
        // We'll handle that in the worker by checking isPaused.
    };
    const handlePlay = () => {
        setIsPaused(false);
        workerRef.current?.postMessage({ type: 'play' });
    };
    const handlePause = () => {
        setIsPaused(true);
        workerRef.current?.postMessage({ type: 'pause' });
    };
    const handleStep = () => {
        workerRef.current?.postMessage({ type: 'step' });
    };
    const handleReset = () => {
        workerRef.current?.postMessage({ type: 'reset' });
    };
    const handleSpeedChange = (e) => {
        const value = parseInt(e.target.value, 10);
        setStepsPerFrame(isNaN(value) ? 1 : value);
        workerRef.current?.postMessage({ type: 'setSpeed', payload: { stepsPerFrame: value } });
    };
    return (_jsxs("div", { style: { padding: '20px', fontFamily: 'sans-serif' }, children: [_jsx("h1", { children: "CEPC Simulation" }), _jsxs("div", { style: { display: 'flex', gap: '20px', alignItems: 'center', marginBottom: '20px' }, children: [_jsx("div", { children: _jsx("canvas", { ref: canvasRef, width: 800, height: 600, style: { border: '1px solid #ccc' } }) }), _jsxs("div", { style: { width: '300px' }, children: [_jsxs("div", { children: [_jsx("button", { onClick: handlePlay, disabled: !isPaused, children: "\u25B6\uFE0F Play" }), _jsx("button", { onClick: handlePause, disabled: isPaused, children: "\u23F8\uFE0F Pause" }), _jsx("button", { onClick: handleStep, disabled: !isPaused, children: "\u23ED\uFE0F Step" }), _jsx("button", { onClick: handleReset, children: "\uD83D\uDD04 Reset" })] }), _jsx("div", { style: { marginTop: '10px' }, children: _jsxs("label", { children: ["Speed (steps per frame):", ' ', _jsx("input", { type: "range", min: 1, max: 100, value: stepsPerFrame, onChange: handleSpeedChange }), ' ', stepsPerFrame] }) }), _jsxs("div", { style: { marginTop: '10px' }, children: [_jsxs("div", { children: ["Backend: ", backend] }), _jsxs("div", { children: ["Timestep: ", timestep] }), metrics && (_jsxs(_Fragment, { children: [_jsxs("div", { children: ["Particles: ", metrics.count] }), _jsxs("div", { children: ["Total Health: ", metrics.healthSum.toFixed(2)] }), _jsxs("div", { children: ["Total Charge: ", metrics.chargeSum.toFixed(0)] }), _jsxs("div", { children: ["Avg Health: ", (metrics.healthSum / metrics.count).toFixed(2)] }), _jsxs("div", { children: ["Avg Charge: ", (metrics.chargeSum / metrics.count).toFixed(2)] })] })), _jsxs("div", { children: ["FPS: ", fps] })] })] })] })] }));
}
const root = createRoot(document.getElementById('root'));
root.render(_jsx(App, {}));
