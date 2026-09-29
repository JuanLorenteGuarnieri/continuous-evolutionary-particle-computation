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
      // Chromium WebGPU flags. Requirements have shifted across Chromium
      // releases (WebGPU has been unflagged for many platforms since ~M113,
      // but headless + some Linux/software-rendering configurations still
      // need these). Harmless no-ops when already unflagged.
      '--enable-unsafe-webgpu',
      '--enable-features=Vulkan,UseSkiaRenderer',
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--ignore-gpu-blocklist',
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
      abVariants: args.skipAb ? ['baseline'] : ['baseline', 'renderDisabled', 'metricsDisabled', 'gpuTimestampsDisabled'],
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

    await page.goto(new URL('benchmark.html', args.baseUrl).toString(), { waitUntil: 'load' });
    await page.evaluate(() => window.__cepcReady);

    for (const backend of args.backends) {
      await setBackend(page, backend);
      for (const particleCount of args.sizes) {
        const variants = [
          { name: 'baseline', renderEnabled: true, metricsEnabled: true, gpuTimestamps: true, stepsPerFrame: 1 },
        ];
        if (!args.skipAb) {
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
        const effectiveVariants = backend === 'CPU' ? variants.slice(0, 1) : variants;

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
