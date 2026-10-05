<#
 Phase 20 A/B (Windows PowerShell 5.1 / PowerShell 7). Real GPU only. Interleaved rounds, same methodology as Phases 17-19
 (variants baseline [render ON] and renderDisabled, GPU timestamps on, sizes 200..10000, 100 measured + 30 warm-up steps).

 Defaults of the current build: force sorted-culled, deathCompaction blocked, topologyMerge epoch, metricsMode lagged, quietFastPath on, pipelineDepth 1.

 Step 0 (once): raw await latency + pipelining probe, then the on-device self-test (halt guard / halt-update / force / death-compaction kernels).
 Configs (each differs from the baseline in ONE factor, except the last):
   p19    Phase 19 final state:  merge incremental, metrics blocking, quiet fast path off, depth 1   (the baseline)
   quiet  + quiet fast path on                                   (lazy snapshot, no map copies)
   epoch  + quiet fast path on + merge epoch                     (skip the worker merge on quiet steps)
   lag    + quiet fast path on + merge epoch + metrics lagged    (no per-frame metrics await)
   pipe2  lag + pipeline depth 2                                 (optimistic pipelining; OPT-IN, unverified on hardware)
 Output: performance/phase20/webgpu-<config>-run<k>.json ; compare with
   node tools/bench/compare-gpu-profiles.mjs --dir performance/phase20 --baseline ab-p19 --candidate ab-quiet --candidate ab-epoch --candidate ab-lag --candidate ab-pipe2
 NOTE: the benchmark result of every config now carries `finalMetrics` (committed-state invariants), `pipelineDiscards` and `topologyMergesSkipped`;
 per-pass GPU timestamps are not recorded while pipelined (gpu.* is empty for pipe2), wall-clock fields are the comparison there.
 Rebuild first: pnpm run build, restart vite preview.
#>
param(
  [int]$Rounds = 5,
  [string]$BaseUrl = 'http://localhost:4173/continuous-evolutionary-particle-computation/',
  [string]$Sizes = '200,500,1000,2000,5000,10000',
  [int]$Steps = 100,
  [int]$Warmup = 30,
  [switch]$Headed,
  [switch]$SkipProbes
)
$ErrorActionPreference = 'Stop'
New-Item -ItemType Directory -Force -Path 'performance/phase20' | Out-Null
$common = @('--base-url', $BaseUrl, '--real-gpu', '--backends', 'WebGPU', '--steps-per-frame', '1', '--sizes', $Sizes,
            '--steps', $Steps, '--warmup', $Warmup, '--variants', 'baseline,renderDisabled')
if ($Headed) { $common += '--headed' }

if (-not $SkipProbes) {
  Write-Host '=== await-latency probe (raw mapAsync latency; does pipelining overlap it?)'
  $probe = @('--base-url', $BaseUrl, '--real-gpu', '--await-latency', '--out', 'performance/phase20/await-latency.json')
  if ($Headed) { $probe += '--headed' }
  & node tools/bench/benchmark-webgpu.mjs @probe
  if ($LASTEXITCODE -ne 0) { throw 'await-latency probe failed' }
  Write-Host '=== kernel self-test (halt guard, halt-update, force, death compaction)'
  $self = @('--base-url', $BaseUrl, '--real-gpu', '--selftest', '--out', 'performance/phase20/kernel-selftest.json')
  if ($Headed) { $self += '--headed' }
  & node tools/bench/benchmark-webgpu.mjs @self
  if ($LASTEXITCODE -ne 0) { throw 'kernel self-test FAILED - do not benchmark. See performance/phase20/kernel-selftest.json' }
}

$configs = [ordered]@{
  'ab-p19'   = @('--topology-merge', 'incremental', '--metrics-mode', 'blocking', '--quiet-fast-path', 'off', '--pipeline-depth', '1')
  'ab-quiet' = @('--topology-merge', 'incremental', '--metrics-mode', 'blocking', '--quiet-fast-path', 'on',  '--pipeline-depth', '1')
  'ab-epoch' = @('--topology-merge', 'epoch',       '--metrics-mode', 'blocking', '--quiet-fast-path', 'on',  '--pipeline-depth', '1')
  'ab-lag'   = @('--topology-merge', 'epoch',       '--metrics-mode', 'lagged',   '--quiet-fast-path', 'on',  '--pipeline-depth', '1')
  'ab-pipe2' = @('--topology-merge', 'epoch',       '--metrics-mode', 'lagged',   '--quiet-fast-path', 'on',  '--pipeline-depth', '2')
}
for ($k = 1; $k -le $Rounds; $k++) {
  foreach ($name in $configs.Keys) {
    $out = "performance/phase20/webgpu-$name-run$k.json"
    Write-Host "=== round $k / $Rounds : $name -> $out"
    & node tools/bench/benchmark-webgpu.mjs @common @($configs[$name]) --out $out
    if ($LASTEXITCODE -ne 0) { throw "benchmark failed ($name, round $k)" }
  }
}
Write-Host 'Done. node tools/bench/compare-gpu-profiles.mjs --dir performance/phase20 --baseline ab-p19 --candidate ab-quiet --candidate ab-epoch --candidate ab-lag --candidate ab-pipe2'
