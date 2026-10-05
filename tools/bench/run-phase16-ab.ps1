<#
 Phase 16 hardware A/B (Windows PowerShell 5.1 / PowerShell 7).

 Prerequisites (two terminals, repo root):
   1) pnpm install ; pnpm exec playwright install chromium
      pnpm run build
      pnpm --filter ./src/react-ui exec vite preview --port 4173      # leave this running
   2) .\tools\bench\run-phase16-ab.ps1                                  # this script

 Interleaves the three configurations round by round (rotating the order each round) so thermal drift and
 background load hit every configuration equally. Results: performance/phase16/webgpu-<config>-run<k>.json
 Then: node tools/bench/summarize-ab.mjs
#>
param(
  [int]$Rounds = 5,
  [string]$BaseUrl = 'http://localhost:4173/continuous-evolutionary-particle-computation/',
  [string]$Sizes = '200,500,1000,2000',
  [int]$Steps = 60,
  [int]$Warmup = 20,
  [switch]$FullMatrix,   # also run the render/metrics/timestamp A/B variants (much slower)
  [switch]$Headed        # show the browser window (try this if headless gets no GPU adapter)
)
$ErrorActionPreference = 'Stop'

$configs = @(
  @{ Label = 'cache-off';       Args = @('--bind-group-cache', 'off') },
  @{ Label = 'cache-on';        Args = @('--bind-group-cache', 'on') },
  @{ Label = 'cache-on-packed'; Args = @('--bind-group-cache', 'on', '--pack-params', 'on') }
)

New-Item -ItemType Directory -Force -Path 'performance/phase16' | Out-Null

for ($k = 1; $k -le $Rounds; $k++) {
  # rotate the order each round: (0,1,2) (1,2,0) (2,0,1) ...
  $order = 0..($configs.Count - 1) | ForEach-Object { ($_ + $k - 1) % $configs.Count }
  foreach ($i in $order) {
    $c = $configs[$i]
    $out = "performance/phase16/webgpu-$($c.Label)-run$k.json"
    Write-Host "=== round $k / $Rounds : $($c.Label) -> $out"
    $cli = @(
      'tools/bench/benchmark-webgpu.mjs',
      '--base-url', $BaseUrl,
      '--real-gpu',
      '--backends', 'WebGPU',
      '--steps-per-frame', '1',
      '--sizes', $Sizes,
      '--steps', $Steps,
      '--warmup', $Warmup,
      '--out', $out
    ) + $c.Args
    if (-not $FullMatrix) { $cli += '--skip-ab' }
    if ($Headed) { $cli += '--headed' }
    & node @cli
    if ($LASTEXITCODE -ne 0) { throw "benchmark-webgpu.mjs failed (exit $LASTEXITCODE) for $($c.Label) round $k" }
  }
}
Write-Host "Done. Summarize with: node tools/bench/summarize-ab.mjs"
