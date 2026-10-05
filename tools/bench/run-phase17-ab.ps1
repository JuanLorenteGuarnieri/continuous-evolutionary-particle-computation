<#
 Phase 17 A/B kernel experiments (Windows PowerShell 5.1 / PowerShell 7). Real GPU only.

 Prerequisites: same as run-phase17-baseline.ps1 (fresh `pnpm run build`, `vite preview --port 4173 --strictPort` left running).
 IMPORTANT: rebuild after pulling these changes - the kernel switches live in the worker bundle.

   .\tools\bench\run-phase17-ab.ps1 -Headed -BaseUrl http://localhost:4180/continuous-evolutionary-particle-computation/

 Steps:
   1. On-device exact-output self-test of the death-compaction variants (aborts the script if it fails).
   2. Rounds are INTERLEAVED across configurations (round 1: every config, round 2: every config, ...) so thermal drift / background load
      hits all configurations alike. One mechanism per configuration, each compared against the same untouched baseline:
        ab-baseline          Phase 16 kernels: --death-compaction serial --force-workgroup-size 128 (explicit, because the
                             shipped default became 'parallel' when Candidate 1 was accepted)
        ab-death-parallel    --death-compaction parallel            (the Phase 17 default)
        ab-force-wg32/64/256 --force-workgroup-size 32|64|256       (with the Phase 16 serial death compaction, one mechanism each)
   3. Variants baseline (render on) and renderDisabled (compute isolation), GPU timestamps on.
 Output: performance/phase17/webgpu-<config>-run<k>.json   Compare with:
   node tools/bench/compare-gpu-profiles.mjs --baseline ab-baseline --candidate ab-death-parallel --candidate ab-force-wg64 ...
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
New-Item -ItemType Directory -Force -Path 'performance/phase17' | Out-Null
$common = @('--base-url', $BaseUrl, '--real-gpu', '--backends', 'WebGPU', '--steps-per-frame', '1', '--sizes', $Sizes,
            '--steps', $Steps, '--warmup', $Warmup, '--variants', 'baseline,renderDisabled')
if ($Headed) { $common += '--headed' }

if (-not $SkipSelfTest) {
  Write-Host '=== kernel self-test (serial vs parallel death compaction on this GPU)'
  $selfArgs = @('--base-url', $BaseUrl, '--real-gpu', '--selftest', '--out', 'performance/phase17/kernel-selftest.json')
  if ($Headed) { $selfArgs += '--headed' }
  & node tools/bench/benchmark-webgpu.mjs @selfArgs
  if ($LASTEXITCODE -ne 0) { throw 'kernel self-test FAILED - do not benchmark the parallel kernel. See performance/phase17/kernel-selftest.json' }
}

$configs = [ordered]@{
  'ab-baseline'       = @('--death-compaction', 'serial', '--force-workgroup-size', '128')
  'ab-death-parallel' = @('--death-compaction', 'parallel', '--force-workgroup-size', '128')
  'ab-force-wg32'     = @('--death-compaction', 'serial', '--force-workgroup-size', '32')
  'ab-force-wg64'     = @('--death-compaction', 'serial', '--force-workgroup-size', '64')
  'ab-force-wg256'    = @('--death-compaction', 'serial', '--force-workgroup-size', '256')
}
for ($k = 1; $k -le $Rounds; $k++) {
  foreach ($name in $configs.Keys) {
    $out = "performance/phase17/webgpu-$name-run$k.json"
    Write-Host "=== round $k / $Rounds : $name -> $out"
    & node tools/bench/benchmark-webgpu.mjs @common @($configs[$name]) --out $out
    if ($LASTEXITCODE -ne 0) { throw "benchmark failed ($name, round $k)" }
  }
}
Write-Host 'Done. node tools/bench/compare-gpu-profiles.mjs --baseline ab-baseline --candidate ab-death-parallel --candidate ab-force-wg32 --candidate ab-force-wg64 --candidate ab-force-wg256'
