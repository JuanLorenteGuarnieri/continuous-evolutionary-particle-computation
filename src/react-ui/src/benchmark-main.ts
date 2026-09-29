/// <reference types="vite/client" />

// Phase 14 benchmark harness bootstrap.
//
// Intentionally does not import React or main.tsx: it only needs the same
// worker the interactive app uses. The worker module (`@worker`, aliased in
// vite.config.ts to src/web-worker/src/worker.ts) is shared verbatim, so this
// harness measures the exact same code path as the app, not a reimplementation.
import { createBenchmarkScenario } from '@cepc/shared-config';

type Backend = 'CPU' | 'WebGPU';

interface RunBenchmarkOptions {
  particleCount: number;
  capacity?: number;
  density?: number;
  seed?: number;
  steps?: number;
  warmupSteps?: number;
  stepsPerFrame?: number;
  renderEnabled?: boolean;
  metricsEnabled?: boolean;
  gpuTimestamps?: boolean;
}

declare global {
  interface Window {
    __cepcReady?: Promise<void>;
    __cepcRunBenchmark?: (options: RunBenchmarkOptions) => Promise<Record<string, unknown>>;
    __cepcSetBackend?: (backend: Backend) => Promise<void>;
    __cepcBackend?: Backend;
  }
}

const statusEl = document.getElementById('status');
function setStatus(text: string): void {
  if (statusEl) statusEl.textContent = text;
  console.log('[cepc-benchmark]', text);
}

const params = new URLSearchParams(location.search);
const initialBackend: Backend = params.get('backend') === 'CPU' ? 'CPU' : 'WebGPU';

// The worker requires an 'init' message with *some* population before
// 'runBenchmark' can replace it. 64 particles keeps startup cheap; the real
// scenario for each measured run is created fresh by the worker's
// createBenchmarkScenario() call inside runBenchmark().
const bootScenario = createBenchmarkScenario({ particleCount: 64, seed: 1 });

const offscreen = new OffscreenCanvas(800, 600);
const webgpuCanvas = new OffscreenCanvas(800, 600);

const worker = new Worker(new URL('@worker', import.meta.url), { type: 'module' });
window.__cepcBackend = initialBackend;

let readyResolve: () => void;
const readyPromise = new Promise<void>((resolve) => {
  readyResolve = resolve;
});
window.__cepcReady = readyPromise;

let pendingBenchmark: {
  resolve: (value: Record<string, unknown>) => void;
  reject: (error: Error) => void;
} | null = null;
let sawFirstFrame = false;

worker.onerror = (event) => {
  setStatus(`worker error: ${event.message}`);
  console.error('[cepc-benchmark] worker error', event);
};

worker.onmessage = (event: MessageEvent) => {
  const { type, payload } = (event.data ?? {}) as { type?: string; payload?: unknown };
  if (type === 'frame') {
    if (!sawFirstFrame) {
      sawFirstFrame = true;
      setStatus('worker ready');
      readyResolve();
    }
    return;
  }
  if (type === 'benchmarkResult') {
    setStatus('benchmark run complete');
    pendingBenchmark?.resolve(payload as Record<string, unknown>);
    pendingBenchmark = null;
    return;
  }
  if (type === 'benchmarkError') {
    const message = (payload as { message?: string })?.message ?? 'unknown benchmark error';
    setStatus(`benchmark run failed: ${message}`);
    pendingBenchmark?.reject(new Error(message));
    pendingBenchmark = null;
    return;
  }
};

worker.postMessage(
  {
    type: 'init',
    offscreen,
    webgpuCanvas,
    config: { ...bootScenario.workerConfig, backend: initialBackend },
  },
  [offscreen, webgpuCanvas],
);

window.__cepcRunBenchmark = (options: RunBenchmarkOptions): Promise<Record<string, unknown>> => {
  if (pendingBenchmark) {
    return Promise.reject(new Error('A benchmark run is already pending'));
  }
  setStatus(`running benchmark: N=${options.particleCount}...`);
  return new Promise<Record<string, unknown>>((resolve, reject) => {
    pendingBenchmark = { resolve, reject };
    worker.postMessage({ type: 'runBenchmark', payload: options });
  });
};

// Switching backend mirrors the app's 'setBackend' message. Exposed so a
// single page/worker session can benchmark both backends without a reload.
window.__cepcSetBackend = (backend: Backend): Promise<void> => {
  window.__cepcBackend = backend;
  return new Promise<void>((resolve) => {
    const onMessage = (event: MessageEvent) => {
      const { type } = (event.data ?? {}) as { type?: string };
      if (type === 'backend') {
        worker.removeEventListener('message', onMessage);
        resolve();
      }
    };
    worker.addEventListener('message', onMessage);
    worker.postMessage({ type: 'setBackend', payload: { backend } });
  });
};

setStatus('worker created, awaiting init...');
