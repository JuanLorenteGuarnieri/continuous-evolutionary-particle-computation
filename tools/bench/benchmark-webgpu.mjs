#!/usr/bin/env node
/**
 * Phase 14 — WebGPU benchmark runner (Playwright).
 *
 * Drives the *real* application through the dedicated benchmark harness page
 * (src/react-ui/benchmark.html + benchmark-main.ts) in an actual Chromium
 * instance, using the worker's `runBenchmark` message (see worker.ts). This
 * measures the production code path, not a reimplementation.
 *
 * REQUIRES A ONE-TIME SETUP THIS SANDBOX CANNOT PERFORM (no network, no GPU):
 *   pnpm install
 *   pnpm exec playwright install chromium --with-deps
 *
 * Then, from the repository root, with the app already built and served:
 *   pnpm run build --filter @cepc/react-ui        # or: pnpm --filter @cepc/react-ui build
 *   pnpm --filter @cepc/react-ui exec vite preview --port 4173
 *   node tools/bench/benchmark-webgpu.mjs \
 *     --base-url http://localhost:4173/continuous-evolutionary-particle-computation/
 *
 * Or against the dev server (faster to start, includes Vite dev-mode overhead
 * in the numbers, so treat dev-server results as directional, not baseline):
 *   pnpm --filter @cepc/react-ui exec vite --port 5173
 *   node tools/bench/benchmark-webgpu.mjs --base-url http://localhost:5173/
 *
 * Chromium's WebGPU support (particularly headless + timestamp-query) varies
 * by version and platform; if a run fails or times out, first confirm WebGPU
 * works in that Chromium build at all (chrome://gpu) before assuming a CEPC
 * bug. See the "gpuTimestampsSupported" field in each result: false means the
 * browser/adapter did not grant the 'timestamp-query' feature, not that
 * something is broken.
 *
 * Options:
 *   --base-url <url>        required; must include the GH Pages base path
 *                            when testing a production build (see vite.config.ts)
 *   --sizes 1000,5000,10000  particle counts (default 1000,5000,10000)
 *   --steps 30                measured steps per configuration (default 30)
 *   --warmup 10                warm-up steps (default 10)
 *   --backends WebGPU,CPU     backends to test (default WebGPU,CPU)
 *   --steps-per-frame 1,4     stepsPerFrame values to sweep for WebGPU (default 1,4)
 *   --skip-ab                 only run the baseline configuration (faster smoke run)
 *   --headed                  run non-headless (useful for local debugging)
 *   --force-kernel <mode>      Phase 18: grid-force kernel linked-list (default) | sorted | sorted-culled (see ForceKernelMode)
 *   --await-latency            Phase 20: measure raw mapAsync/onSubmittedWorkDone latency and whether pipelined submissions overlap it (writes report.awaitLatency)
 *   --metrics-mode <mode>      Phase 20: blocking (Phase 15-19) | lagged (default; non-blocking one-frame-lagged metrics)
 *   --pipeline-depth 1|2       Phase 20: normal-sync steps kept in flight by step() (1 = Phase 19 behaviour, default)
 *   --quiet-fast-path on|off   Phase 20: skip O(N) CPU work on quiet steps (default on)
 *   --topology-merge <mode>    Phase 19/20: worker merge of the normal-sync population: rebuild (pre-Phase-19) | incremental | epoch (default: incremental + skip while the stepper topology epoch is unchanged)
 *   --bind-group-cache on|off  Phase 16: reuse bind groups across timesteps (default: stepper default = on)
 *   --pack-params on|off       Phase 16: one packed params writeBuffer instead of one per rank block (default off)
 *   --no-sandbox               pass --no-sandbox to Chromium (needed when running as root, e.g. in containers)
 *   --real-gpu                 launch Chromium WITHOUT the software-rendering flags (--use-angle=swiftshader, --use-gl=angle,
 *                              Vulkan feature) and with --enable-webgpu-developer-features (unquantized timestamp queries).
 *                              Use this for any run meant to measure real hardware; then check environment.adapterInfo in the JSON.
 *   --out <file>              JSON output path (default performance/phase14/webgpu-benchmark.json)
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

function parseArgs(argv) {
  const args = {
    baseUrl: null,
    sizes: [1000, 5000, 10000],
    steps: 30,
    warmup: 10,
    backends: ['WebGPU', 'CPU'],
    stepsPerFrame: [1, 4],
    skipAb: false,
    headed: false,
    out: 'performance/phase14/webgpu-benchmark.json',
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === '--base-url') args.baseUrl = next();
    else if (a === '--sizes') args.sizes = next().split(',').map(Number);
    else if (a === '--steps') args.steps = Number(next());
    else if (a === '--warmup') args.warmup = Number(next());
    else if (a === '--backends') args.backends = next().split(',');
    else if (a === '--steps-per-frame') args.stepsPerFrame = next().split(',').map(Number);
    else if (a === '--skip-ab') args.skipAb = true;
    else if (a === '--headed') args.headed = true;
    else if (a === '--no-sandbox') args.noSandbox = true;
    else if (a === '--real-gpu') args.realGpu = true;
    else if (a === '--bind-group-cache') (args.orchestration ??= {}).bindGroupCache = next() !== 'off';
    else if (a === '--pack-params') (args.orchestration ??= {}).packParamWrites = next() === 'on';
    else if (a === '--death-compaction') {
      const mode = next();
      if (!['serial', 'parallel', 'blocked'].includes(mode)) throw new Error('--death-compaction expects serial|parallel|blocked');
      (args.kernels ??= {}).deathCompaction = mode;
    } else if (a === '--force-workgroup-size') {
      const size = Number(next());
      if (![32, 64, 128, 256].includes(size)) throw new Error('--force-workgroup-size expects 32|64|128|256');
      (args.kernels ??= {}).forceWorkgroupSize = size;
    } else if (a === '--force-kernel') {
      const mode = next();
      if (!['linked-list', 'sorted', 'sorted-culled'].includes(mode)) throw new Error('--force-kernel expects linked-list|sorted|sorted-culled');
      (args.kernels ??= {}).forceKernel = mode;
    } else if (a === '--await-latency') args.awaitLatency = true;
    else if (a === '--metrics-mode') {
      const mode = next();
      if (!['blocking', 'lagged'].includes(mode)) throw new Error('--metrics-mode expects blocking|lagged');
      args.metricsMode = mode;
    } else if (a === '--pipeline-depth') {
      const depth = Number(next());
      if (depth !== 1 && depth !== 2) throw new Error('--pipeline-depth expects 1|2');
      (args.orchestration ??= {}).pipelineDepth = depth;
    } else if (a === '--quiet-fast-path') {
      const v = next();
      if (v !== 'on' && v !== 'off') throw new Error('--quiet-fast-path expects on|off');
      (args.orchestration ??= {}).quietFastPath = v === 'on';
    } else if (a === '--topology-merge') {
      const mode = next();
      if (!['rebuild', 'incremental', 'epoch'].includes(mode)) throw new Error('--topology-merge expects rebuild|incremental|epoch');
      args.topologyMerge = mode;
    } else if (a === '--variants') args.variants = next().split(',');
    else if (a === '--selftest') args.selftest = true;
    else if (a === '--out') args.out = next();
    else throw new Error(`Unknown option ${a}`);
  }
  if (!args.baseUrl) throw new Error('--base-url is required, e.g. http://localhost:4173/continuous-evolutionary-particle-computation/');
  if (!args.baseUrl.endsWith('/')) args.baseUrl += '/';
  return args;
}

/** One 'runBenchmark' call against the already-loaded benchmark.html page. */
async function runOne(page, options) {
  return page.evaluate(async (opts) => {
    // eslint-disable-next-line no-undef -- window.__cepcRunBenchmark is defined by benchmark-main.ts
    return window.__cepcRunBenchmark(opts);
  }, options);
}

async function setBackend(page, backend) {
  await page.evaluate(async (b) => {
    // eslint-disable-next-line no-undef
    return window.__cepcSetBackend(b);
  }, backend);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const browser = await chromium.launch({
    headless: !args.headed,
    args: [
      ...(args.noSandbox ? ['--no-sandbox'] : []),
      // Chromium WebGPU flags. Requirements have shifted across Chromium
      // releases (WebGPU has been unflagged for many platforms since ~M113,
      // but headless + some Linux/software-rendering configurations still
      // need these). Harmless no-ops when already unflagged.
      '--enable-unsafe-webgpu',
      '--ignore-gpu-blocklist',
      ...(args.realGpu
        ? // Phase 16: real hardware. Do not force software GL/ANGLE; let Dawn pick the native backend (D3D12/Metal/Vulkan).
          ['--enable-webgpu-developer-features']
        : ['--enable-features=Vulkan,UseSkiaRenderer', '--use-gl=angle', '--use-angle=swiftshader']),
    ],
  });

  const report = {
    schemaVersion: 1,
    kind: 'webgpu-benchmark-matrix',
    generatedAt: new Date().toISOString(),
    baseUrl: args.baseUrl,
    browser: await browser.version(),
    method: {
      sizes: args.sizes,
      steps: args.steps,
      warmupSteps: args.warmup,
      backends: args.backends,
      stepsPerFrameSweep: args.stepsPerFrame,
      abVariants: args.variants ?? (args.skipAb ? ['baseline'] : ['baseline', 'renderDisabled', 'metricsDisabled', 'gpuTimestampsDisabled']),
      // Phase 16 (additive): requested orchestration switches; null = stepper defaults.
      orchestration: args.orchestration ?? null,
      // Phase 17 (additive): requested GPU kernel variants; null = Phase 16 kernels (serial death compaction, force workgroup 128).
      kernels: args.kernels ?? null,
      // Phase 19 (additive): requested worker topology-merge mode; null = 'incremental'.
      topologyMerge: args.topologyMerge ?? null,
      metricsMode: args.metricsMode ?? null,
      // Phase 16 (additive): true when Chromium was launched without the software-rendering flags.
      realGpuFlags: Boolean(args.realGpu),
    },
    runs: [],
    errors: [],
  };

  try {
    const page = await browser.newPage();
    page.on('console', (message) => {
      if (message.type() === 'error') console.error('[page]', message.text());
    });
    page.on('pageerror', (error) => console.error('[page error]', error));

    const benchmarkUrl = new URL('benchmark.html', args.baseUrl).toString();
    const response = await page.goto(benchmarkUrl, { waitUntil: 'load' });
    if (!response || !response.ok()) {
      throw new Error(`Loading ${benchmarkUrl} returned HTTP ${response ? response.status() : 'no response'}. Is the preview server running and is --base-url correct?`);
    }
    // Fail fast with a diagnosable message if the page is not the benchmark harness (e.g. a stale/missing dist/benchmark.html makes
    // `vite preview` fall back to index.html, so the window.__cepc* hooks never exist).
    try {
      await page.waitForFunction(() => typeof window.__cepcSetBackend === 'function' && typeof window.__cepcRunBenchmark === 'function', undefined, { timeout: 20000 });
    } catch {
      const title = await page.title();
      throw new Error(
        `${benchmarkUrl} loaded (title: "${title}") but the benchmark hooks (window.__cepcSetBackend/__cepcRunBenchmark) were not defined. ` +
          'Expected title "CEPC Phase 14 Benchmark Harness". Likely causes: dist/ was built before benchmark.html existed or is stale (rebuild with `pnpm run build`), ' +
          'the server on this port is not `vite preview` of this repo, or benchmark-main.ts threw during load (check the [page error] lines above).',
      );
    }
    await page.evaluate(() => window.__cepcReady);

    if (args.awaitLatency) {
      // Phase 20: raw mapAsync / onSubmittedWorkDone latency and pipelining probe (await-latency.ts), no CEPC code involved.
      console.log('Running the await-latency probe...');
      const probe = await page.evaluate(() => window.__cepcRunAwaitLatency());
      report.awaitLatency = probe;
      console.log(`  adapter: ${probe.adapter ? `${probe.adapter.vendor} ${probe.adapter.description}` : 'unknown'}`);
      console.log(`  onSubmittedWorkDone median ${probe.onSubmittedWorkDone.medianMs.toFixed(2)} ms (p95 ${probe.onSubmittedWorkDone.p95Ms.toFixed(2)})`);
      console.log(`  copy + mapAsync    median ${probe.copyMap.medianMs.toFixed(2)} ms (p95 ${probe.copyMap.p95Ms.toFixed(2)}, min ${probe.copyMap.minMs.toFixed(2)})`);
      for (const c of probe.computeCopyMap) console.log(`  compute(work=${c.work}) + copy + mapAsync median ${c.stats.medianMs.toFixed(2)} ms`);
      for (const p of probe.pipelinedPerStep) console.log(`  work=${p.work} depth ${p.depth}: ${p.perStepMs.toFixed(2)} ms per step`);
    }

    if (args.selftest) {
      // Phase 17: exact-output check of the death-compaction kernel variants on the real device (kernel-selftest.ts).
      console.log('Running kernel self-test (death compaction variants; Phase 18 force-kernel variants vs brute force)...');
      const selfTest = await page.evaluate(() => window.__cepcRunKernelSelfTest());
      report.selfTest = selfTest;
      console.log(`  adapter: ${selfTest.adapter ? `${selfTest.adapter.vendor} ${selfTest.adapter.description}` : 'unknown'}`);
      console.log(`  ${selfTest.cases.length} cases; ${selfTest.passed ? 'PASSED' : 'FAILED'}`);
      if (Array.isArray(selfTest.pipelineCases)) console.log(`  pipeline guard: ${selfTest.pipelineCases.filter((c) => c.passed).length}/${selfTest.pipelineCases.length} cases passed`);
      for (const failure of selfTest.failures) console.error('  FAIL: ' + failure);
      if (!selfTest.passed) process.exitCode = 1;
    }

    for (const backend of args.selftest || args.awaitLatency ? [] : args.backends) {
      await setBackend(page, backend);
      for (const particleCount of args.sizes) {
        const variants = [
          { name: 'baseline', renderEnabled: true, metricsEnabled: true, gpuTimestamps: true, stepsPerFrame: 1 },
        ];
        if (!args.skipAb || args.variants) {
          variants.push(
            { name: 'renderDisabled', renderEnabled: false, metricsEnabled: true, gpuTimestamps: true, stepsPerFrame: 1 },
            { name: 'metricsDisabled', renderEnabled: true, metricsEnabled: false, gpuTimestamps: true, stepsPerFrame: 1 },
            { name: 'gpuTimestampsDisabled', renderEnabled: true, metricsEnabled: true, gpuTimestamps: false, stepsPerFrame: 1 },
          );
          for (const stepsPerFrame of args.stepsPerFrame) {
            if (stepsPerFrame === 1) continue; // already covered by baseline
            variants.push({
              name: `stepsPerFrame-${stepsPerFrame}`,
              renderEnabled: true,
              metricsEnabled: true,
              gpuTimestamps: true,
              stepsPerFrame,
            });
          }
        }
        // CPU backend does not implement render/metrics/gpuTimestamps toggles
        // (they are no-ops there); only the baseline variant is meaningful.
        const selectedVariants = args.variants ? variants.filter((v) => args.variants.includes(v.name)) : variants;
        const effectiveVariants = backend === 'CPU' ? selectedVariants.slice(0, 1) : selectedVariants;

        for (const variant of effectiveVariants) {
          const label = `${backend} N=${particleCount} ${variant.name}`;
          try {
            console.log(`Running ${label}...`);
            const result = await runOne(page, {
              particleCount,
              steps: args.steps,
              warmupSteps: args.warmup,
              renderEnabled: variant.renderEnabled,
              metricsEnabled: variant.metricsEnabled,
              gpuTimestamps: variant.gpuTimestamps,
              stepsPerFrame: variant.stepsPerFrame,
              ...(args.orchestration ? { orchestration: args.orchestration } : {}),
              ...(args.kernels ? { kernels: args.kernels } : {}),
              ...(args.topologyMerge ? { topologyMerge: args.topologyMerge } : {}),
              ...(args.metricsMode ? { metricsMode: args.metricsMode } : {}),
            });
            report.runs.push({ backend, particleCount, variant: variant.name, result });
            console.log(
              `  ${label}: ${result.stepsPerSecond?.toFixed(1)} steps/s, ` +
                `${result.particleStepsPerSecond?.toFixed(0)} particle-steps/s`,
            );
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.error(`  ${label} FAILED: ${message}`);
            report.errors.push({ backend, particleCount, variant: variant.name, message });
          }
        }
      }
    }
  } finally {
    await browser.close();
  }

  const outPath = resolve(args.out);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(report, null, 2) + '\n');
  console.log(`Wrote ${outPath}`);
  if (report.errors.length > 0) {
    console.error(`${report.errors.length} run(s) failed; see the "errors" field.`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
