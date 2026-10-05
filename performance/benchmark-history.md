# Benchmark history (Phases 14 → 17) and what is comparable

| Phase | Artifacts | Contains GPU time? | Comparable to Phase 17? |
| --- | --- | --- | --- |
| 14 | `performance/phase14/cpu-reference.json` (CPU reference), instrumentation | No | No: CPU only |
| 15 | `performance/phase15/*` (device-boundary / synchronization accounting, CPU orchestration) | No | Counts of readbacks/syncs only; no timings of GPU passes |
| 16 | `performance/phase16/*` (sync accounting, JS-only orchestration under a no-op GPU, Dawn/SwiftShader render check, software-rendered `webgpu-*.json`) | No (`gpu:null`, `adapterInfo:null`) | No. The hardware A/B it listed was never run |
| 17 | `performance/phase17/*` (hardware: Intel HD Graphics 520, GPU timestamps) | **Yes** | This is the first GPU baseline; Phase 17 before → after is the comparable pair |

Rules for future phases: compare only runs with the same device, browser, matrix and variants; report the effective `method.orchestration` / `method.kernels` recorded in each result; use medians over ≥ 5 interleaved rounds; treat GPU timestamps as the primary metric for kernel work (they were reproducible to ≈ 1–3 % between rounds, whereas end-to-end frame time on this machine had outlier rounds up to 82 ms). Phase 17 baseline for Phase 18: `performance/phase17/gpu-cost-model-final.md` and `webgpu-ab-death-parallel-run*.json`.
