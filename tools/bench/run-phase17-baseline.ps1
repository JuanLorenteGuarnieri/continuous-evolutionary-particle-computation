<#
 Phase 17 hardware baseline (Windows PowerShell 5.1 / PowerShell 7).

 GPU timestamps need no extra flag: benchmark-webgpu.mjs already requests them in every WebGPU variant. They are only GRANTED on a real
 adapter, so this script always passes --real-gpu (native D3D12/Metal/Vulkan + --enable-webgpu-developer-features for unquantized timestamps).

 Prerequisites (two terminals, repo root):
   1) pnpm install ; pnpm exec playwright install chromium
      pnpm run build
      pnpm --filter ./src/react-ui exec vite preview --port 4173      # leave running
   2) .\tools\bench\run-phase17-baseline.ps1 -Headed                     # try -Headed first; headless often gets no real adapter
   3) node tools/bench/summarize-gpu-profile.mjs --md performance/phase17/gpu-cost-model.md --json performance/phase17/gpu-cost-model.json

 Rounds are repeated so the summarizer can show noise. The full A/B matrix (render off / metrics off / timestamps off) is ON by default
 because the timestamps-off variant is what measures instrumentation overhead; use -SkipAb for a quick smoke run.
 Uses the default orchestration settings (no --bind-group-cache / --pack-params overrides). Kernel variants are pinned with -DeathCompaction
 (default 'serial' = the Phase 16 kernels) so this script keeps reproducing the Phase 17 BASELINE after Candidate 1 became the shipped default;
 pass -DeathCompaction parallel to measure the final state.
 Output: performance/phase17/webgpu-<Tag>-run<k>.json
#>
param(
  [int]$Rounds = 3,
  [string]$Tag = 'baseline',
  [string]$BaseUrl = 'http://localhost:4173/continuous-evolutionary-particle-computation/',
  [string]$Sizes = '1000,5000,10000,20000',
  [int]$Steps = 100,
  [int]$Warmup = 30,
  [ValidateSet('serial', 'parallel')][string]$DeathCompaction = 'serial',
  [switch]$SkipAb,
  [switch]$Headed
)
$ErrorActionPreference = 'Stop'
New-Item -ItemType Directory -Force -Path 'performance/phase17' | Out-Null
for ($k = 1; $k -le $Rounds; $k++) {
  $out = "performance/phase17/webgpu-$Tag-run$k.json"
  Write-Host "=== round $k / $Rounds -> $out"
  $cli = @('tools/bench/benchmark-webgpu.mjs', '--base-url', $BaseUrl, '--real-gpu', '--backends', 'WebGPU',
           '--steps-per-frame', '1', '--sizes', $Sizes, '--steps', $Steps, '--warmup', $Warmup, '--out', $out)
  if ($SkipAb) { $cli += '--skip-ab' }
  if ($Headed) { $cli += '--headed' }
  & node @cli
  if ($LASTEXITCODE -ne 0) { throw "benchmark-webgpu.mjs failed (exit $LASTEXITCODE) round $k" }
}
Write-Host "Done. Then: node tools/bench/summarize-gpu-profile.mjs --md performance/phase17/gpu-cost-model.md --json performance/phase17/gpu-cost-model.json"
