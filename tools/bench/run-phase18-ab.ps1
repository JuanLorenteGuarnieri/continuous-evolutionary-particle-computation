<#
 Phase 18 A/B of the grid-force kernel (Windows PowerShell 5.1 / PowerShell 7). Real GPU only.

 Prerequisites: same as run-phase17-ab.ps1 (fresh `pnpm run build`, `vite preview` left running). Rebuild after pulling these
 changes: the kernel switch lives in the worker bundle.

   .\tools\bench\run-phase18-ab.ps1 -Headed -BaseUrl http://localhost:4180/continuous-evolutionary-particle-computation/

 Steps:
   1. On-device self-test: death-compaction variants (Phase 17) AND the Phase 18 force kernels. The sorted kernels are compared with the
      linked-list kernel on identical populations (1..14 cells per axis, several charge ranges) and the counting-sort layout is verified.
      The script aborts if it fails: do not benchmark a kernel that did not pass on this GPU.
   2. Rounds are INTERLEAVED across configurations, each compared against the same untouched baseline (the Phase 17 final state):
        ab-linked          --force-kernel linked-list   (Phase 17 final state; the stepper default)
        ab-sorted          --force-kernel sorted
        ab-sorted-culled   --force-kernel sorted-culled
   3. Same methodology as Phase 17: variants baseline (render on) and renderDisabled (compute isolation), GPU timestamps on,
      sizes 200..10000, 100 measured steps, 30 warm-up steps, 5 rounds.
 Output: performance/phase18/webgpu-<config>-run<k>.json   Compare with:
   node tools/bench/compare-gpu-profiles.mjs --dir performance/phase18 --baseline ab-linked --candidate ab-sorted --candidate ab-sorted-culled
 NOTE: the sorted kernels add three passes (sortCount, sortScan, sortScatter). The comparison tool's total GPU time includes them; when
 reading per-pass rows compare 'force' + sortCount + sortScan + sortScatter against the baseline 'force'.
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
New-Item -ItemType Directory -Force -Path 'performance/phase18' | Out-Null
$common = @('--base-url', $BaseUrl, '--real-gpu', '--backends', 'WebGPU', '--steps-per-frame', '1', '--sizes', $Sizes,
            '--steps', $Steps, '--warmup', $Warmup, '--variants', 'baseline,renderDisabled')
if ($Headed) { $common += '--headed' }

if (-not $SkipSelfTest) {
  Write-Host '=== kernel self-test (death compaction + Phase 18 force kernels on this GPU)'
  $selfArgs = @('--base-url', $BaseUrl, '--real-gpu', '--selftest', '--out', 'performance/phase18/kernel-selftest.json')
  if ($Headed) { $selfArgs += '--headed' }
  & node tools/bench/benchmark-webgpu.mjs @selfArgs
  if ($LASTEXITCODE -ne 0) { throw 'kernel self-test FAILED - do not benchmark. See performance/phase18/kernel-selftest.json' }
}

$configs = [ordered]@{
  'ab-linked'        = @('--force-kernel', 'linked-list')
  'ab-sorted'        = @('--force-kernel', 'sorted')
  'ab-sorted-culled' = @('--force-kernel', 'sorted-culled')
}
for ($k = 1; $k -le $Rounds; $k++) {
  foreach ($name in $configs.Keys) {
    $out = "performance/phase18/webgpu-$name-run$k.json"
    Write-Host "=== round $k / $Rounds : $name -> $out"
    & node tools/bench/benchmark-webgpu.mjs @common @($configs[$name]) --out $out
    if ($LASTEXITCODE -ne 0) { throw "benchmark failed ($name, round $k)" }
  }
}
Write-Host 'Done. node tools/bench/compare-gpu-profiles.mjs --dir performance/phase18 --baseline ab-linked --candidate ab-sorted --candidate ab-sorted-culled'
