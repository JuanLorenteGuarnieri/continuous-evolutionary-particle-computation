# performance/phase17 — Phase 17 GPU kernel optimization artifacts

All files come from ONE device: Intel HD Graphics 520, Chrome 153.0.8010.12, `--real-gpu`, GPU timestamps on. Report: `docs/phases/17-phase17-gpu-kernel-optimization.md`.

| File | What it is |
| --- | --- |
| `webgpu-baseline-run{1..3}.json` | First hardware baseline (Phase 16 kernels), N ≤ 2000, all four A/B variants; `run-phase17-baseline.ps1` |
| `gpu-cost-model.{md,json}` | Cost model of that 3-round baseline (`summarize-gpu-profile.mjs`) |
| `webgpu-ab-<config>-run{1..5}.json` | Interleaved A/B, N = 200…10000, variants baseline + renderDisabled; configs `ab-baseline` (serial + force 128), `ab-death-parallel`, `ab-force-wg32/64/256`; `run-phase17-ab.ps1` |
| `gpu-cost-model-ab-baseline.{md,json}` | Cost model BEFORE (Phase 16 kernels), 5 rounds |
| `gpu-cost-model-final.{md,json}` | Cost model AFTER (death compaction parallel = shipped default), 5 rounds |
| `ab-comparison.{md,json}` | Candidate vs baseline per N, per pass, with noise verdicts (`compare-gpu-profiles.mjs`) |
| `kernel-selftest.json` | On-device exact-output check of both death-compaction kernels: 56/56 passed |
| `ledger.json` | Performance ledger: accepted / rejected / deferred |

Schema: the Phase 14–16 benchmark schema; Phase 17 only ADDED `method.kernels` (requested) and `result.method.kernels` (effective, `null` on the CPU backend) and the `selfTest` block.
