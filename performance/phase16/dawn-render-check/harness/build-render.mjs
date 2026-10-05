import { createRequire } from 'node:module';
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
const require = createRequire('/home/claude/.npm-global/lib/node_modules/tsx/');
const esbuild = require('esbuild');
const [root, out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const entry = path.join(out, 'entry.js');
writeFileSync(entry, `
import { RenderPipeline } from ${JSON.stringify(path.join(root, 'src/webgpu-core/src/render-pipeline.ts'))};
window.runRenderCheck = async () => {
  const out = { protoDestroy: {}, errors: [] };
  for (const n of ['GPUBuffer','GPUTexture','GPUQuerySet','GPURenderPipeline','GPUComputePipeline','GPUBindGroup','GPUBindGroupLayout','GPUDevice'])
    out.protoDestroy[n] = typeof globalThis[n]?.prototype?.destroy;
  const adapter = await navigator.gpu.requestAdapter();
  const device = await adapter.requestDevice();
  device.addEventListener('uncapturederror', (e) => out.errors.push('uncaptured: ' + e.error.message));
  let bgCalls = 0;
  const orig = device.createBindGroup.bind(device);
  device.createBindGroup = (d) => { bgCalls++; return orig(d); };
  device.pushErrorScope('validation');
  const format = 'rgba8unorm';
  const target = device.createTexture({ size: [32, 32], format, usage: GPUTextureUsage.RENDER_ATTACHMENT });
  const rp = new RenderPipeline(device);
  await rp.init(format);
  const N = 16;
  const mkRole = () => device.createBuffer({ size: 256, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
  const mk = (role) => ({
    positions: device.createBuffer({ size: 256, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST }),
    health: device.createBuffer({ size: 256, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST }),
    charge: device.createBuffer({ size: 256, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST }),
    role,
  });
  const frame = (s) => {
    rp.setParticleBuffers({ positions: s.positions, health: s.health, charge: s.charge, role: s.role, particleCount: N });
    rp.setUniforms(100, 100, 4, 1, 0, 0, 1, 10, 10);
    const enc = device.createCommandEncoder();
    rp.render(enc, target.createView(), N);
    device.queue.submit([enc.finish()]);
  };
  // Phase A: ping-pong between two buffer sets (what the stepper hands the renderer every step)
  const roleA = mkRole(); let g0 = mk(roleA), g1 = mk(roleA);
  for (let i = 0; i < 20; i++) frame(i % 2 === 0 ? g0 : g1);
  out.afterPingPong = { frames: 20, deviceCreateBindGroup: bgCalls, rendererCounter: rp.bindGroupsCreated ?? null };
  // Phase B: data buffers recreated (old ones destroyed first, as the stepper does)
  for (const b of [g0.positions, g0.health, g0.charge, g1.positions, g1.health, g1.charge, roleA]) b.destroy();
  const roleB = mkRole(); const h0 = mk(roleB), h1 = mk(roleB);
  for (let i = 0; i < 6; i++) frame(i % 2 === 0 ? h0 : h1);
  out.afterRecreate = { frames: 6, deviceCreateBindGroup: bgCalls };
  await device.queue.onSubmittedWorkDone();
  out.validationError = (await device.popErrorScope())?.message ?? null;
  // Phase C: destroy()
  try { rp.destroy(); out.destroy = 'ok'; } catch (e) { out.destroy = e.name + ': ' + e.message; }
  return out;
};`);
await esbuild.build({ entryPoints: [entry], bundle: true, format: 'esm', outfile: path.join(out, 'check.js'), logLevel: 'error', target: 'es2022', absWorkingDir: root,
  plugins: [{ name: 'p', setup(b) { b.onResolve({ filter: /^\.\.?\/.*\.js$/ }, (a) => { const ts = path.resolve(a.resolveDir, a.path.replace(/\.js$/, '.ts')); return require('node:fs').existsSync(ts) ? { path: ts } : null; }); } }] });
writeFileSync(path.join(out, 'index.html'), '<!doctype html><script type="module" src="./check.js"></script>');
