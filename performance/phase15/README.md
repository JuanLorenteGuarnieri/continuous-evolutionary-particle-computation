# performance/phase15

Machine-readable Phase 15 outputs. None of them is a GPU timing.

| File | Schema | Meaning |
|---|---|---|
| `sync-accounting-phase14-baseline.json` | `cepc-sync-accounting/1` (`"timed": false`) | Structural sync counts of the **unmodified Phase 14 stepper** (worker sequence incl. its post-submit `onSubmittedWorkDone`) on a software GPUDevice. |
| `sync-accounting-phase15.json` | `cepc-sync-accounting/1` | Same matrix, Phase 15 stepper. |
| `cpu-orchestration-phase14-baseline.json`, `cpu-orchestration-phase15.json` | `cepc-cpu-orchestration/1` | CPU-only JavaScript time of a quiet step under a no-op software GPU (Node). Not GPU time. |

Regenerate (repository root):

```
pnpm run benchmark:sync -- --label phase15
pnpm run benchmark:sync -- --stepper <path-to-phase14>/src/webgpu-mfm/src/MfmWebGPUStepper.ts \
    --label phase14-baseline --wait-after-submit true
node --no-warnings --experimental-strip-types --experimental-loader=./tools/bench/ts-prefer-loader.mjs \
    tools/bench/cpu-orchestration.mjs --label phase15
```

Real-GPU results (Phase 14 schema, `tools/bench/benchmark-webgpu.mjs`) belong next to these as `webgpu-<label>-run<k>.json`.
