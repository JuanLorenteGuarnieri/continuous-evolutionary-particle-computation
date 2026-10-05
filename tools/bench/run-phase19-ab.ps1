<#
 Phase 19 A/B (Windows PowerShell 5.1 / PowerShell 7). Real GPU only.

 What it compares (rounds INTERLEAVED, same methodology as Phases 17/18: variants baseline [render ON] and renderDisabled, GPU timestamps on,
 sizes 200..10000, 100 measured + 30 warm-up steps):
   ab-base    --topology-merge rebuild      --death-compaction parallel   (Phase 18 final state: the baseline)
   ab-merge   --topology-merge incremental  --death-compaction parallel   (worker-side merge only)
   ab-death   --topology-merge rebuild      --death-compaction blocked    (death compaction only)
   ab-both    --topology-merge incremental  --death-compaction blocked
 The force kernel is the new default (sorted-culled) in all four.

 NEW in the data: the render-ON variant now records the GPU time of the render pass (gpu.renderMs and a 'render' label) and the CPU
 section worker.mergeTopologyMs. Compute sums (gpu.sumMs/spanMs) keep their Phase 14-18 meaning (compute passes only).

 Prerequisites: fresh `pnpm run build`, `vite preview` running (see run-phase18-ab.ps1).
   .\tools\bench\run-phase19-ab.ps1 -Headed -BaseUrl http://localhost:4180/continuous-evolutionary-particle-computation/
 Output: performance/phase19/webgpu-<config>-run<k>.json ; compare with
   node tools/bench/compare-gpu-profiles.mjs --dir performance/phase19 --baseline ab-base --candidate ab-merge --candidate ab-death --candidate ab-both
#>
param(
  [int]$Rounds = 5,
  [string]$BaseUrl = 'http://localhost:4173/continuous-evolutionary-particle-computation/',
  [string]$Sizes = '200,500,1000,2000,5000,10000',
  [int]$Steps = 100,
  [int]$Warmup = 30,
  [switch]$Headed,
  [switch]$SkipSelfTest
)
$ErrorActionPreference = 'Stop'
New-Item -ItemType Directory -Force -Path 'performance/phase19' | Out-Null
$common = @('--base-url', $BaseUrl, '--real-gpu', '--backends', 'WebGPU', '--steps-per-frame', '1', '--sizes', $Sizes,
            '--steps', $Steps, '--warmup', $Warmup, '--variants', 'baseline,renderDisabled')
if ($Headed) { $common += '--headed' }

if (-not $SkipSelfTest) {
  Write-Host '=== kernel self-test (death compaction serial/parallel/blocked + force kernels on this GPU)'
  $selfArgs = @('--base-url', $BaseUrl, '--real-gpu', '--selftest', '--out', 'performance/phase19/kernel-selftest.json')
  if ($Headed) { $selfArgs += '--headed' }
  & node tools/bench/benchmark-webgpu.mjs @selfArgs
  if ($LASTEXITCODE -ne 0) { throw 'kernel self-test FAILED - do not benchmark. See performance/phase19/kernel-selftest.json' }
}

$configs = [ordered]@{
  'ab-base'  = @('--topology-merge', 'rebuild',     '--death-compaction', 'parallel')
  'ab-merge' = @('--topology-merge', 'incremental', '--death-compaction', 'parallel')
  'ab-death' = @('--topology-merge', 'rebuild',     '--death-compaction', 'blocked')
  'ab-both'  = @('--topology-merge', 'incremental', '--death-compaction', 'blocked')
}
for ($k = 1; $k -le $Rounds; $k++) {
  foreach ($name in $configs.Keys) {
    $out = "performance/phase19/webgpu-$name-run$k.json"
    Write-Host "=== round $k / $Rounds : $name -> $out"
    & node tools/bench/benchmark-webgpu.mjs @common @($configs[$name]) --out $out
    if ($LASTEXITCODE -ne 0) { throw "benchmark failed ($name, round $k)" }
  }
}
Write-Host 'Done. node tools/bench/compare-gpu-profiles.mjs --dir performance/phase19 --baseline ab-base --candidate ab-merge --candidate ab-death --candidate ab-both'
