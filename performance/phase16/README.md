# Phase 16 benchmark artifacts

Nothing here is GPU time. The sandbox that produced these files has no usable GPU: its only WebGPU adapter is
Chromium/Dawn on SwiftShader with `maxStorageBuffersPerShaderStage = 10`, and CEPC's kernels require 16, so the real
stepper cannot run in a browser here. See `docs/phases/16-phase16-webgpu-command-resource-optimization.md` for what each
file proves and what it cannot.

| File | What it is | Command |
| --- | --- | --- |
| `sync-accounting-phase15-stepper.json` | Frozen Phase 15 stepper under the Phase 16 harness (device-boundary counts) | `pnpm run benchmark:sync -- --stepper <phase15 MfmWebGPUStepper.ts> --out ...` |
| `sync-accounting-phase16.json` | Phase 16 defaults (bind-group cache on, per-block parameter writes) | `pnpm run benchmark:sync -- --out ...` |
| `sync-accounting-phase16-cache-off.json` | `--bind-group-cache off` | |
| `sync-accounting-phase16-packed.json` | `--pack-params on` | |
| `cpu-orchestration/round{1,2,3}-*.json` | JS-only host cost under a no-op GPU, interleaved A/B rounds | `node ... tools/bench/cpu-orchestration.mjs [--bind-group-cache on\|off]` |
| `dawn-render-check/{phase15,phase16}.json` | Real Chromium/Dawn run of `RenderPipeline` (bind-group count, validation errors, `destroy()`); harness in `harness/` | sandbox-only, see below |
| `comparison.json` | Programmatic Phase 15 -> Phase 16 summary derived from the files above | |

Schemas are the Phase 14/15 ones (`cepc-sync-accounting/1`, `cepc-cpu-orchestration/1`); Phase 16 only ADDED fields
(`commandEncoders`, `dispatches`, `clearBufferCalls`, `copyBufferCalls`, an `orchestration` block) and, with
`--dispatch-traces`, per-step `disp`/`dispN` digests.

`dawn-render-check/harness/*.mjs` were run with esbuild + Playwright from a sandbox without pnpm/vite
(`node build-render.mjs <repo-root> <outdir> && node run-render.mjs <outdir>`); they hard-code the sandbox's global
`node_modules` path and are reproduction aids, not part of CI.

## Real-hardware A/B (still to be run)

```bash
pnpm install && pnpm exec playwright install chromium --with-deps
pnpm --filter @cepc/react-ui build && pnpm --filter @cepc/react-ui exec vite preview --port 4173 &
for k in 1 2 3 4 5; do   # interleave A/B, same machine, AC power
  for cfg in "--bind-group-cache off" "--bind-group-cache on" "--bind-group-cache on --pack-params on"; do
    node tools/bench/benchmark-webgpu.mjs --base-url http://localhost:4173/continuous-evolutionary-particle-computation/ --sizes 100,200,500,1000,2000 --steps 60 --warmup 20 $cfg --out performance/phase16/webgpu-<label>-run$k.json
  done
done
```

## Phase 17 note

Until Phase 17 the benchmark page's worker did not forward the `orchestration` option, so the `--bind-group-cache` / `--pack-params` CLI switches could not reach the stepper in a browser run (fixed in Phase 17; effective options are now recorded in `result.method.orchestration`). The real-hardware A/B described above has still not been run and is carried as a Phase 16 debt in `docs/phases/17-phase17-gpu-kernel-optimization.md`.

