## ab-sorted vs ab-linked  [variant: baseline]  (kernels: {"forceKernel":"sorted"}; rounds 5 vs 5)

### N = 200  (5 baseline / 5 candidate rounds, medians)

| metric | baseline | candidate | delta % | verdict |
|---|---:|---:|---:|---|
| step ms (mean) | 6.925 | 5.764 | -16.8 | within noise |
| step ms (p95) | 10.340 | 7.100 | -31.3 | within noise |
| particle-steps/s | 17721 | 20991 | 18.5 | within noise |
| GPU sum ms | 0.573 | 0.551 | -3.9 | within noise |
| pass gridClear | 0.025 | 0.025 | 0.7 | within noise |
| pass gridBuild | 0.011 | 0.011 | 0.9 | within noise |
| pass chargeProcess | 0.017 | 0.017 | -0.3 | within noise |
| pass chargeFinalize | 0.012 | 0.012 | 0.4 | within noise |
| pass pressure | 0.006 | 0.007 | 5.8 | within noise |
| pass communicationSelect | 0.015 | 0.015 | 1.5 | within noise |
| pass communicationTransmit | 0.016 | 0.015 | -2.4 | within noise |
| pass localSuccess | 0.015 | 0.015 | 0.4 | within noise |
| pass healthUpdate | 0.014 | 0.015 | 3.4 | within noise |
| pass force | 0.364 | 0.256 | -29.8 | lower (beyond noise) |
| pass mechanics | 0.015 | 0.016 | 0.7 | within noise |
| pass deathCompaction | 0.053 | 0.054 | 0.4 | within noise |
| pass sortCount | n/a | 0.019 | n/a | n/a |
| pass sortScan | n/a | 0.043 | n/a | n/a |
| pass sortScatter | n/a | 0.031 | n/a | n/a |

### N = 500  (5 baseline / 5 candidate rounds, medians)

| metric | baseline | candidate | delta % | verdict |
|---|---:|---:|---:|---|
| step ms (mean) | 8.357 | 6.120 | -26.8 | within noise |
| step ms (p95) | 12.910 | 7.620 | -41.0 | within noise |
| particle-steps/s | 40132 | 51245 | 27.7 | within noise |
| GPU sum ms | 1.221 | 0.941 | -23.0 | lower (beyond noise) |
| pass gridClear | 0.025 | 0.027 | 7.3 | within noise |
| pass gridBuild | 0.011 | 0.012 | 7.3 | within noise |
| pass chargeProcess | 0.018 | 0.018 | -0.9 | within noise |
| pass chargeFinalize | 0.014 | 0.013 | -7.2 | within noise |
| pass pressure | 0.007 | 0.007 | 0.6 | within noise |
| pass communicationSelect | 0.017 | 0.017 | -2.6 | within noise |
| pass communicationTransmit | 0.017 | 0.017 | 1.1 | within noise |
| pass localSuccess | 0.017 | 0.017 | 0.8 | within noise |
| pass healthUpdate | 0.015 | 0.016 | 3.7 | within noise |
| pass force | 0.987 | 0.604 | -38.8 | lower (beyond noise) |
| pass mechanics | 0.017 | 0.017 | -0.7 | within noise |
| pass deathCompaction | 0.071 | 0.071 | 0.3 | within noise |
| pass sortCount | n/a | 0.021 | n/a | n/a |
| pass sortScan | n/a | 0.045 | n/a | n/a |
| pass sortScatter | n/a | 0.035 | n/a | n/a |

### N = 1000  (5 baseline / 5 candidate rounds, medians)

| metric | baseline | candidate | delta % | verdict |
|---|---:|---:|---:|---|
| step ms (mean) | 10.179 | 7.672 | -24.6 | within noise |
| step ms (p95) | 15.010 | 9.710 | -35.3 | within noise |
| particle-steps/s | 70378 | 88417 | 25.6 | within noise |
| GPU sum ms | 1.873 | 1.161 | -38.0 | lower (beyond noise) |
| pass gridClear | 0.028 | 0.027 | -2.6 | within noise |
| pass gridBuild | 0.012 | 0.012 | 5.4 | within noise |
| pass chargeProcess | 0.019 | 0.020 | 3.2 | within noise |
| pass chargeFinalize | 0.014 | 0.013 | -4.2 | within noise |
| pass pressure | 0.007 | 0.007 | 3.7 | within noise |
| pass communicationSelect | 0.018 | 0.017 | -6.0 | within noise |
| pass communicationTransmit | 0.018 | 0.017 | -4.1 | within noise |
| pass localSuccess | 0.016 | 0.016 | -2.3 | within noise |
| pass healthUpdate | 0.016 | 0.016 | -1.3 | within noise |
| pass force | 1.600 | 0.795 | -50.3 | lower (beyond noise) |
| pass mechanics | 0.020 | 0.020 | 0.7 | within noise |
| pass deathCompaction | 0.099 | 0.100 | 0.9 | within noise |
| pass sortCount | n/a | 0.020 | n/a | n/a |
| pass sortScan | n/a | 0.045 | n/a | n/a |
| pass sortScatter | n/a | 0.037 | n/a | n/a |

### N = 2000  (5 baseline / 5 candidate rounds, medians)

| metric | baseline | candidate | delta % | verdict |
|---|---:|---:|---:|---|
| step ms (mean) | 10.872 | 10.848 | -0.2 | within noise |
| step ms (p95) | 13.505 | 13.205 | -2.2 | within noise |
| particle-steps/s | 135768 | 137231 | 1.1 | within noise |
| GPU sum ms | 2.400 | 1.237 | -48.5 | lower (beyond noise) |
| pass gridClear | 0.028 | 0.026 | -8.0 | within noise |
| pass gridBuild | 0.015 | 0.014 | -5.7 | within noise |
| pass chargeProcess | 0.024 | 0.021 | -10.6 | within noise |
| pass chargeFinalize | 0.016 | 0.014 | -11.4 | within noise |
| pass pressure | 0.008 | 0.007 | -13.9 | within noise |
| pass communicationSelect | 0.019 | 0.018 | -7.3 | within noise |
| pass communicationTransmit | 0.019 | 0.017 | -11.4 | within noise |
| pass localSuccess | 0.017 | 0.016 | -2.1 | within noise |
| pass healthUpdate | 0.019 | 0.018 | -3.0 | within noise |
| pass force | 2.043 | 0.783 | -61.7 | lower (beyond noise) |
| pass mechanics | 0.026 | 0.027 | 2.9 | within noise |
| pass deathCompaction | 0.157 | 0.158 | 0.5 | within noise |
| pass sortCount | n/a | 0.021 | n/a | n/a |
| pass sortScan | n/a | 0.046 | n/a | n/a |
| pass sortScatter | n/a | 0.044 | n/a | n/a |

### N = 5000  (5 baseline / 5 candidate rounds, medians)

| metric | baseline | candidate | delta % | verdict |
|---|---:|---:|---:|---|
| step ms (mean) | 20.517 | 18.296 | -10.8 | within noise |
| step ms (p95) | 23.940 | 25.650 | 7.1 | within noise |
| particle-steps/s | 205187 | 226091 | 10.2 | within noise |
| GPU sum ms | 5.318 | 2.121 | -60.1 | lower (beyond noise) |
| pass gridClear | 0.027 | 0.028 | 4.3 | within noise |
| pass gridBuild | 0.038 | 0.031 | -17.0 | within noise |
| pass chargeProcess | 0.033 | 0.028 | -15.8 | within noise |
| pass chargeFinalize | 0.019 | 0.017 | -9.9 | within noise |
| pass pressure | 0.008 | 0.007 | -5.6 | within noise |
| pass communicationSelect | 0.022 | 0.021 | -5.6 | within noise |
| pass communicationTransmit | 0.021 | 0.021 | -2.2 | within noise |
| pass localSuccess | 0.019 | 0.018 | -4.0 | within noise |
| pass healthUpdate | 0.027 | 0.025 | -7.1 | within noise |
| pass force | 4.730 | 1.396 | -70.5 | lower (beyond noise) |
| pass mechanics | 0.039 | 0.040 | 1.7 | within noise |
| pass deathCompaction | 0.328 | 0.328 | 0.2 | within noise |
| pass sortCount | n/a | 0.033 | n/a | n/a |
| pass sortScan | n/a | 0.047 | n/a | n/a |
| pass sortScatter | n/a | 0.074 | n/a | n/a |

### N = 10000  (5 baseline / 5 candidate rounds, medians)

| metric | baseline | candidate | delta % | verdict |
|---|---:|---:|---:|---|
| step ms (mean) | 40.602 | 35.921 | -11.5 | within noise |
| step ms (p95) | 52.325 | 49.415 | -5.6 | within noise |
| particle-steps/s | 216962 | 240460 | 10.8 | within noise |
| GPU sum ms | 10.489 | 3.870 | -63.1 | lower (beyond noise) |
| pass gridClear | 0.029 | 0.029 | 1.1 | within noise |
| pass gridBuild | 0.057 | 0.055 | -2.7 | within noise |
| pass chargeProcess | 0.040 | 0.037 | -5.6 | within noise |
| pass chargeFinalize | 0.024 | 0.024 | 0.4 | within noise |
| pass pressure | 0.007 | 0.007 | -1.2 | within noise |
| pass communicationSelect | 0.026 | 0.025 | -3.3 | within noise |
| pass communicationTransmit | 0.025 | 0.025 | -1.2 | within noise |
| pass localSuccess | 0.022 | 0.022 | -1.7 | within noise |
| pass healthUpdate | 0.037 | 0.036 | -2.7 | within noise |
| pass force | 9.551 | 2.724 | -71.5 | lower (beyond noise) |
| pass mechanics | 0.062 | 0.065 | 4.0 | within noise |
| pass deathCompaction | 0.601 | 0.604 | 0.6 | within noise |
| pass sortCount | n/a | 0.046 | n/a | n/a |
| pass sortScan | n/a | 0.048 | n/a | n/a |
| pass sortScatter | n/a | 0.111 | n/a | n/a |

## ab-sorted-culled vs ab-linked  [variant: baseline]  (kernels: {"forceKernel":"sorted-culled"}; rounds 5 vs 5)

### N = 200  (5 baseline / 5 candidate rounds, medians)

| metric | baseline | candidate | delta % | verdict |
|---|---:|---:|---:|---|
| step ms (mean) | 6.925 | 5.802 | -16.2 | within noise |
| step ms (p95) | 10.340 | 7.000 | -32.3 | within noise |
| particle-steps/s | 17721 | 21286 | 20.1 | within noise |
| GPU sum ms | 0.573 | 0.551 | -3.9 | within noise |
| pass gridClear | 0.025 | 0.025 | 0.6 | within noise |
| pass gridBuild | 0.011 | 0.011 | 1.9 | within noise |
| pass chargeProcess | 0.017 | 0.017 | 1.8 | within noise |
| pass chargeFinalize | 0.012 | 0.012 | 1.5 | within noise |
| pass pressure | 0.006 | 0.006 | 1.9 | within noise |
| pass communicationSelect | 0.015 | 0.016 | 2.0 | within noise |
| pass communicationTransmit | 0.016 | 0.015 | -3.1 | within noise |
| pass localSuccess | 0.015 | 0.016 | 3.9 | within noise |
| pass healthUpdate | 0.014 | 0.014 | 2.1 | within noise |
| pass force | 0.364 | 0.255 | -30.1 | lower (beyond noise) |
| pass mechanics | 0.015 | 0.016 | 1.4 | within noise |
| pass deathCompaction | 0.053 | 0.054 | 1.3 | within noise |
| pass sortCount | n/a | 0.019 | n/a | n/a |
| pass sortScan | n/a | 0.042 | n/a | n/a |
| pass sortScatter | n/a | 0.031 | n/a | n/a |

### N = 500  (5 baseline / 5 candidate rounds, medians)

| metric | baseline | candidate | delta % | verdict |
|---|---:|---:|---:|---|
| step ms (mean) | 8.357 | 6.049 | -27.6 | within noise |
| step ms (p95) | 12.910 | 7.400 | -42.7 | within noise |
| particle-steps/s | 40132 | 51366 | 28.0 | within noise |
| GPU sum ms | 1.221 | 0.945 | -22.6 | lower (beyond noise) |
| pass gridClear | 0.025 | 0.027 | 5.9 | within noise |
| pass gridBuild | 0.011 | 0.013 | 16.3 | within noise |
| pass chargeProcess | 0.018 | 0.019 | 9.5 | within noise |
| pass chargeFinalize | 0.014 | 0.014 | -0.9 | within noise |
| pass pressure | 0.007 | 0.007 | 1.0 | within noise |
| pass communicationSelect | 0.017 | 0.017 | -2.2 | within noise |
| pass communicationTransmit | 0.017 | 0.017 | 1.2 | within noise |
| pass localSuccess | 0.017 | 0.017 | 2.4 | within noise |
| pass healthUpdate | 0.015 | 0.016 | 4.4 | within noise |
| pass force | 0.987 | 0.604 | -38.8 | lower (beyond noise) |
| pass mechanics | 0.017 | 0.018 | 1.3 | within noise |
| pass deathCompaction | 0.071 | 0.071 | 1.0 | within noise |
| pass sortCount | n/a | 0.020 | n/a | n/a |
| pass sortScan | n/a | 0.045 | n/a | n/a |
| pass sortScatter | n/a | 0.036 | n/a | n/a |

### N = 1000  (5 baseline / 5 candidate rounds, medians)

| metric | baseline | candidate | delta % | verdict |
|---|---:|---:|---:|---|
| step ms (mean) | 10.179 | 7.221 | -29.1 | within noise |
| step ms (p95) | 15.010 | 8.810 | -41.3 | within noise |
| particle-steps/s | 70378 | 91617 | 30.2 | within noise |
| GPU sum ms | 1.873 | 0.985 | -47.4 | lower (beyond noise) |
| pass gridClear | 0.028 | 0.027 | -1.8 | within noise |
| pass gridBuild | 0.012 | 0.013 | 13.0 | within noise |
| pass chargeProcess | 0.019 | 0.020 | 5.0 | within noise |
| pass chargeFinalize | 0.014 | 0.014 | 0.3 | within noise |
| pass pressure | 0.007 | 0.007 | 2.0 | within noise |
| pass communicationSelect | 0.018 | 0.017 | -7.2 | within noise |
| pass communicationTransmit | 0.018 | 0.018 | 0.9 | within noise |
| pass localSuccess | 0.016 | 0.017 | 3.2 | within noise |
| pass healthUpdate | 0.016 | 0.017 | 2.7 | within noise |
| pass force | 1.600 | 0.611 | -61.8 | lower (beyond noise) |
| pass mechanics | 0.020 | 0.020 | 0.4 | within noise |
| pass deathCompaction | 0.099 | 0.098 | -1.5 | within noise |
| pass sortCount | n/a | 0.021 | n/a | n/a |
| pass sortScan | n/a | 0.046 | n/a | n/a |
| pass sortScatter | n/a | 0.037 | n/a | n/a |

### N = 2000  (5 baseline / 5 candidate rounds, medians)

| metric | baseline | candidate | delta % | verdict |
|---|---:|---:|---:|---|
| step ms (mean) | 10.872 | 10.189 | -6.3 | within noise |
| step ms (p95) | 13.505 | 12.810 | -5.1 | within noise |
| particle-steps/s | 135768 | 142025 | 4.6 | within noise |
| GPU sum ms | 2.400 | 1.051 | -56.2 | lower (beyond noise) |
| pass gridClear | 0.028 | 0.029 | 1.1 | within noise |
| pass gridBuild | 0.015 | 0.014 | -3.4 | within noise |
| pass chargeProcess | 0.024 | 0.022 | -9.7 | within noise |
| pass chargeFinalize | 0.016 | 0.014 | -8.7 | within noise |
| pass pressure | 0.008 | 0.007 | -11.0 | within noise |
| pass communicationSelect | 0.019 | 0.018 | -7.3 | within noise |
| pass communicationTransmit | 0.019 | 0.018 | -5.9 | within noise |
| pass localSuccess | 0.017 | 0.017 | -0.9 | within noise |
| pass healthUpdate | 0.019 | 0.018 | -2.6 | within noise |
| pass force | 2.043 | 0.598 | -70.7 | lower (beyond noise) |
| pass mechanics | 0.026 | 0.025 | -3.7 | within noise |
| pass deathCompaction | 0.157 | 0.156 | -0.7 | within noise |
| pass sortCount | n/a | 0.021 | n/a | n/a |
| pass sortScan | n/a | 0.047 | n/a | n/a |
| pass sortScatter | n/a | 0.044 | n/a | n/a |

### N = 5000  (5 baseline / 5 candidate rounds, medians)

| metric | baseline | candidate | delta % | verdict |
|---|---:|---:|---:|---|
| step ms (mean) | 20.517 | 17.482 | -14.8 | within noise |
| step ms (p95) | 23.940 | 23.375 | -2.4 | within noise |
| particle-steps/s | 205187 | 231406 | 12.8 | within noise |
| GPU sum ms | 5.318 | 1.581 | -70.3 | lower (beyond noise) |
| pass gridClear | 0.027 | 0.026 | -2.5 | within noise |
| pass gridBuild | 0.038 | 0.038 | 1.9 | within noise |
| pass chargeProcess | 0.033 | 0.027 | -17.8 | within noise |
| pass chargeFinalize | 0.019 | 0.018 | -8.2 | within noise |
| pass pressure | 0.008 | 0.007 | -10.1 | within noise |
| pass communicationSelect | 0.022 | 0.023 | 1.2 | within noise |
| pass communicationTransmit | 0.021 | 0.021 | -2.8 | within noise |
| pass localSuccess | 0.019 | 0.018 | -2.1 | within noise |
| pass healthUpdate | 0.027 | 0.026 | -2.2 | within noise |
| pass force | 4.730 | 0.838 | -82.3 | lower (beyond noise) |
| pass mechanics | 0.039 | 0.039 | -0.0 | within noise |
| pass deathCompaction | 0.328 | 0.333 | 1.5 | within noise |
| pass sortCount | n/a | 0.033 | n/a | n/a |
| pass sortScan | n/a | 0.047 | n/a | n/a |
| pass sortScatter | n/a | 0.073 | n/a | n/a |

### N = 10000  (5 baseline / 5 candidate rounds, medians)

| metric | baseline | candidate | delta % | verdict |
|---|---:|---:|---:|---|
| step ms (mean) | 40.602 | 34.219 | -15.7 | within noise |
| step ms (p95) | 52.325 | 47.075 | -10.0 | within noise |
| particle-steps/s | 216962 | 253878 | 17.0 | within noise |
| GPU sum ms | 10.489 | 2.785 | -73.4 | lower (beyond noise) |
| pass gridClear | 0.029 | 0.028 | -1.1 | within noise |
| pass gridBuild | 0.057 | 0.054 | -5.4 | within noise |
| pass chargeProcess | 0.040 | 0.037 | -5.5 | within noise |
| pass chargeFinalize | 0.024 | 0.024 | -2.1 | within noise |
| pass pressure | 0.007 | 0.007 | -1.3 | within noise |
| pass communicationSelect | 0.026 | 0.025 | -1.2 | within noise |
| pass communicationTransmit | 0.025 | 0.025 | -1.1 | within noise |
| pass localSuccess | 0.022 | 0.022 | -2.4 | within noise |
| pass healthUpdate | 0.037 | 0.037 | -0.6 | within noise |
| pass force | 9.551 | 1.636 | -82.9 | lower (beyond noise) |
| pass mechanics | 0.062 | 0.066 | 5.6 | within noise |
| pass deathCompaction | 0.601 | 0.608 | 1.2 | within noise |
| pass sortCount | n/a | 0.047 | n/a | n/a |
| pass sortScan | n/a | 0.048 | n/a | n/a |
| pass sortScatter | n/a | 0.114 | n/a | n/a |

## ab-sorted vs ab-linked  [variant: renderDisabled]  (kernels: {"forceKernel":"sorted"}; rounds 5 vs 5)

### N = 200  (5 baseline / 5 candidate rounds, medians)

| metric | baseline | candidate | delta % | verdict |
|---|---:|---:|---:|---|
| step ms (mean) | 5.331 | 4.378 | -17.9 | within noise |
| step ms (p95) | 7.915 | 5.305 | -33.0 | within noise |
| particle-steps/s | 21556 | 25836 | 19.9 | within noise |
| GPU sum ms | 0.572 | 0.588 | 2.8 | within noise |
| pass gridClear | 0.025 | 0.026 | 2.0 | within noise |
| pass gridBuild | 0.014 | 0.015 | 3.4 | within noise |
| pass chargeProcess | 0.017 | 0.020 | 13.6 | within noise |
| pass chargeFinalize | 0.012 | 0.013 | 7.6 | within noise |
| pass pressure | 0.007 | 0.008 | 18.9 | within noise |
| pass communicationSelect | 0.015 | 0.018 | 17.1 | within noise |
| pass communicationTransmit | 0.016 | 0.017 | 8.8 | within noise |
| pass localSuccess | 0.015 | 0.016 | 5.9 | within noise |
| pass healthUpdate | 0.014 | 0.015 | 3.0 | within noise |
| pass force | 0.369 | 0.265 | -28.3 | lower (beyond noise) |
| pass mechanics | 0.016 | 0.016 | 3.7 | within noise |
| pass deathCompaction | 0.054 | 0.056 | 4.4 | within noise |
| pass sortCount | n/a | 0.020 | n/a | n/a |
| pass sortScan | n/a | 0.046 | n/a | n/a |
| pass sortScatter | n/a | 0.032 | n/a | n/a |

### N = 500  (5 baseline / 5 candidate rounds, medians)

| metric | baseline | candidate | delta % | verdict |
|---|---:|---:|---:|---|
| step ms (mean) | 5.252 | 4.409 | -16.1 | within noise |
| step ms (p95) | 7.705 | 5.300 | -31.2 | within noise |
| particle-steps/s | 56073 | 64078 | 14.3 | within noise |
| GPU sum ms | 1.224 | 0.946 | -22.7 | lower (beyond noise) |
| pass gridClear | 0.025 | 0.025 | 3.0 | within noise |
| pass gridBuild | 0.014 | 0.015 | 0.9 | within noise |
| pass chargeProcess | 0.017 | 0.020 | 13.4 | within noise |
| pass chargeFinalize | 0.012 | 0.014 | 11.5 | within noise |
| pass pressure | 0.006 | 0.008 | 21.8 | within noise |
| pass communicationSelect | 0.016 | 0.018 | 12.2 | within noise |
| pass communicationTransmit | 0.016 | 0.017 | 6.6 | within noise |
| pass localSuccess | 0.015 | 0.016 | 4.6 | within noise |
| pass healthUpdate | 0.015 | 0.015 | 5.6 | within noise |
| pass force | 0.974 | 0.605 | -37.9 | lower (beyond noise) |
| pass mechanics | 0.017 | 0.017 | 1.7 | within noise |
| pass deathCompaction | 0.070 | 0.069 | -1.1 | within noise |
| pass sortCount | n/a | 0.020 | n/a | n/a |
| pass sortScan | n/a | 0.046 | n/a | n/a |
| pass sortScatter | n/a | 0.034 | n/a | n/a |

### N = 1000  (5 baseline / 5 candidate rounds, medians)

| metric | baseline | candidate | delta % | verdict |
|---|---:|---:|---:|---|
| step ms (mean) | 5.286 | 4.542 | -14.1 | within noise |
| step ms (p95) | 7.905 | 5.505 | -30.4 | within noise |
| particle-steps/s | 110084 | 126358 | 14.8 | within noise |
| GPU sum ms | 1.869 | 1.158 | -38.0 | lower (beyond noise) |
| pass gridClear | 0.026 | 0.026 | 0.2 | within noise |
| pass gridBuild | 0.015 | 0.014 | -2.3 | within noise |
| pass chargeProcess | 0.019 | 0.020 | 5.7 | within noise |
| pass chargeFinalize | 0.014 | 0.014 | -4.8 | within noise |
| pass pressure | 0.011 | 0.008 | -19.7 | within noise |
| pass communicationSelect | 0.018 | 0.019 | 9.6 | within noise |
| pass communicationTransmit | 0.017 | 0.018 | 9.8 | within noise |
| pass localSuccess | 0.016 | 0.016 | -2.3 | within noise |
| pass healthUpdate | 0.019 | 0.017 | -13.7 | within noise |
| pass force | 1.598 | 0.786 | -50.8 | lower (beyond noise) |
| pass mechanics | 0.020 | 0.020 | -3.1 | within noise |
| pass deathCompaction | 0.098 | 0.098 | 0.5 | within noise |
| pass sortCount | n/a | 0.020 | n/a | n/a |
| pass sortScan | n/a | 0.045 | n/a | n/a |
| pass sortScatter | n/a | 0.036 | n/a | n/a |

### N = 2000  (5 baseline / 5 candidate rounds, medians)

| metric | baseline | candidate | delta % | verdict |
|---|---:|---:|---:|---|
| step ms (mean) | 5.723 | 4.614 | -19.4 | within noise |
| step ms (p95) | 7.010 | 5.710 | -18.5 | within noise |
| particle-steps/s | 211104 | 243962 | 15.6 | within noise |
| GPU sum ms | 2.358 | 1.232 | -47.7 | lower (beyond noise) |
| pass gridClear | 0.026 | 0.025 | -2.6 | within noise |
| pass gridBuild | 0.016 | 0.017 | 2.0 | within noise |
| pass chargeProcess | 0.021 | 0.021 | -1.5 | within noise |
| pass chargeFinalize | 0.016 | 0.014 | -10.1 | within noise |
| pass pressure | 0.012 | 0.007 | -43.9 | within noise |
| pass communicationSelect | 0.017 | 0.018 | 3.3 | within noise |
| pass communicationTransmit | 0.017 | 0.019 | 11.1 | within noise |
| pass localSuccess | 0.018 | 0.016 | -10.5 | within noise |
| pass healthUpdate | 0.020 | 0.019 | -6.6 | within noise |
| pass force | 2.021 | 0.770 | -61.9 | lower (beyond noise) |
| pass mechanics | 0.025 | 0.025 | 0.1 | within noise |
| pass deathCompaction | 0.153 | 0.154 | 1.1 | within noise |
| pass sortCount | n/a | 0.020 | n/a | n/a |
| pass sortScan | n/a | 0.043 | n/a | n/a |
| pass sortScatter | n/a | 0.043 | n/a | n/a |

### N = 5000  (5 baseline / 5 candidate rounds, medians)

| metric | baseline | candidate | delta % | verdict |
|---|---:|---:|---:|---|
| step ms (mean) | 8.800 | 5.775 | -34.4 | lower (beyond noise) |
| step ms (p95) | 10.100 | 7.000 | -30.7 | within noise |
| particle-steps/s | 394477 | 523013 | 32.6 | higher (beyond noise) |
| GPU sum ms | 5.189 | 2.094 | -59.7 | lower (beyond noise) |
| pass gridClear | 0.026 | 0.027 | 2.0 | within noise |
| pass gridBuild | 0.034 | 0.037 | 9.1 | within noise |
| pass chargeProcess | 0.034 | 0.030 | -10.6 | within noise |
| pass chargeFinalize | 0.017 | 0.017 | 3.8 | within noise |
| pass pressure | 0.007 | 0.007 | 5.5 | within noise |
| pass communicationSelect | 0.022 | 0.023 | 1.8 | within noise |
| pass communicationTransmit | 0.022 | 0.021 | -5.4 | within noise |
| pass localSuccess | 0.021 | 0.018 | -12.2 | within noise |
| pass healthUpdate | 0.028 | 0.025 | -10.9 | within noise |
| pass force | 4.616 | 1.366 | -70.4 | lower (beyond noise) |
| pass mechanics | 0.039 | 0.039 | 2.0 | within noise |
| pass deathCompaction | 0.316 | 0.325 | 2.9 | within noise |
| pass sortCount | n/a | 0.033 | n/a | n/a |
| pass sortScan | n/a | 0.046 | n/a | n/a |
| pass sortScatter | n/a | 0.072 | n/a | n/a |

### N = 10000  (5 baseline / 5 candidate rounds, medians)

| metric | baseline | candidate | delta % | verdict |
|---|---:|---:|---:|---|
| step ms (mean) | 15.237 | 8.003 | -47.5 | lower (beyond noise) |
| step ms (p95) | 17.000 | 9.700 | -42.9 | within noise |
| particle-steps/s | 521458 | 846095 | 62.3 | higher (beyond noise) |
| GPU sum ms | 10.357 | 3.790 | -63.4 | lower (beyond noise) |
| pass gridClear | 0.027 | 0.026 | -2.2 | within noise |
| pass gridBuild | 0.056 | 0.055 | -0.4 | within noise |
| pass chargeProcess | 0.039 | 0.038 | -1.4 | within noise |
| pass chargeFinalize | 0.025 | 0.025 | -1.8 | within noise |
| pass pressure | 0.007 | 0.007 | -5.6 | within noise |
| pass communicationSelect | 0.026 | 0.026 | -1.4 | within noise |
| pass communicationTransmit | 0.026 | 0.027 | 4.9 | within noise |
| pass localSuccess | 0.022 | 0.021 | -1.2 | within noise |
| pass healthUpdate | 0.037 | 0.036 | -1.8 | within noise |
| pass force | 9.413 | 2.669 | -71.6 | lower (beyond noise) |
| pass mechanics | 0.064 | 0.066 | 3.6 | within noise |
| pass deathCompaction | 0.618 | 0.591 | -4.4 | within noise |
| pass sortCount | n/a | 0.045 | n/a | n/a |
| pass sortScan | n/a | 0.047 | n/a | n/a |
| pass sortScatter | n/a | 0.109 | n/a | n/a |

## ab-sorted-culled vs ab-linked  [variant: renderDisabled]  (kernels: {"forceKernel":"sorted-culled"}; rounds 5 vs 5)

### N = 200  (5 baseline / 5 candidate rounds, medians)

| metric | baseline | candidate | delta % | verdict |
|---|---:|---:|---:|---|
| step ms (mean) | 5.331 | 4.365 | -18.1 | within noise |
| step ms (p95) | 7.915 | 5.300 | -33.0 | within noise |
| particle-steps/s | 21556 | 26045 | 20.8 | within noise |
| GPU sum ms | 0.572 | 0.586 | 2.4 | within noise |
| pass gridClear | 0.025 | 0.025 | -0.2 | within noise |
| pass gridBuild | 0.014 | 0.014 | 1.9 | within noise |
| pass chargeProcess | 0.017 | 0.020 | 13.3 | within noise |
| pass chargeFinalize | 0.012 | 0.013 | 7.2 | within noise |
| pass pressure | 0.007 | 0.008 | 18.1 | within noise |
| pass communicationSelect | 0.015 | 0.019 | 21.8 | within noise |
| pass communicationTransmit | 0.016 | 0.019 | 17.4 | within noise |
| pass localSuccess | 0.015 | 0.016 | 6.1 | within noise |
| pass healthUpdate | 0.014 | 0.015 | 0.8 | within noise |
| pass force | 0.369 | 0.262 | -28.9 | lower (beyond noise) |
| pass mechanics | 0.016 | 0.016 | 2.6 | within noise |
| pass deathCompaction | 0.054 | 0.056 | 4.0 | within noise |
| pass sortCount | n/a | 0.020 | n/a | n/a |
| pass sortScan | n/a | 0.046 | n/a | n/a |
| pass sortScatter | n/a | 0.032 | n/a | n/a |

### N = 500  (5 baseline / 5 candidate rounds, medians)

| metric | baseline | candidate | delta % | verdict |
|---|---:|---:|---:|---|
| step ms (mean) | 5.252 | 4.408 | -16.1 | within noise |
| step ms (p95) | 7.705 | 5.800 | -24.7 | within noise |
| particle-steps/s | 56073 | 62830 | 12.1 | within noise |
| GPU sum ms | 1.224 | 0.952 | -22.2 | lower (beyond noise) |
| pass gridClear | 0.025 | 0.025 | 4.0 | within noise |
| pass gridBuild | 0.014 | 0.014 | 0.0 | within noise |
| pass chargeProcess | 0.017 | 0.020 | 14.7 | within noise |
| pass chargeFinalize | 0.012 | 0.013 | 6.6 | within noise |
| pass pressure | 0.006 | 0.008 | 23.8 | within noise |
| pass communicationSelect | 0.016 | 0.020 | 23.8 | higher (beyond noise) |
| pass communicationTransmit | 0.016 | 0.018 | 12.0 | within noise |
| pass localSuccess | 0.015 | 0.016 | 7.6 | within noise |
| pass healthUpdate | 0.015 | 0.015 | 4.8 | within noise |
| pass force | 0.974 | 0.608 | -37.6 | lower (beyond noise) |
| pass mechanics | 0.017 | 0.017 | 2.8 | within noise |
| pass deathCompaction | 0.070 | 0.070 | -0.4 | within noise |
| pass sortCount | n/a | 0.020 | n/a | n/a |
| pass sortScan | n/a | 0.046 | n/a | n/a |
| pass sortScatter | n/a | 0.035 | n/a | n/a |

### N = 1000  (5 baseline / 5 candidate rounds, medians)

| metric | baseline | candidate | delta % | verdict |
|---|---:|---:|---:|---|
| step ms (mean) | 5.286 | 4.381 | -17.1 | within noise |
| step ms (p95) | 7.905 | 5.315 | -32.8 | within noise |
| particle-steps/s | 110084 | 126678 | 15.1 | within noise |
| GPU sum ms | 1.869 | 0.991 | -47.0 | lower (beyond noise) |
| pass gridClear | 0.026 | 0.026 | -0.6 | within noise |
| pass gridBuild | 0.015 | 0.016 | 7.0 | within noise |
| pass chargeProcess | 0.019 | 0.020 | 7.2 | within noise |
| pass chargeFinalize | 0.014 | 0.013 | -6.7 | within noise |
| pass pressure | 0.011 | 0.007 | -31.4 | within noise |
| pass communicationSelect | 0.018 | 0.019 | 8.7 | within noise |
| pass communicationTransmit | 0.017 | 0.017 | 3.4 | within noise |
| pass localSuccess | 0.016 | 0.017 | 0.9 | within noise |
| pass healthUpdate | 0.019 | 0.017 | -13.5 | within noise |
| pass force | 1.598 | 0.615 | -61.5 | lower (beyond noise) |
| pass mechanics | 0.020 | 0.020 | -1.1 | within noise |
| pass deathCompaction | 0.098 | 0.096 | -1.2 | within noise |
| pass sortCount | n/a | 0.021 | n/a | n/a |
| pass sortScan | n/a | 0.045 | n/a | n/a |
| pass sortScatter | n/a | 0.036 | n/a | n/a |

### N = 2000  (5 baseline / 5 candidate rounds, medians)

| metric | baseline | candidate | delta % | verdict |
|---|---:|---:|---:|---|
| step ms (mean) | 5.723 | 4.682 | -18.2 | within noise |
| step ms (p95) | 7.010 | 5.705 | -18.6 | within noise |
| particle-steps/s | 211104 | 236798 | 12.2 | within noise |
| GPU sum ms | 2.358 | 1.050 | -55.4 | lower (beyond noise) |
| pass gridClear | 0.026 | 0.025 | -2.3 | within noise |
| pass gridBuild | 0.016 | 0.016 | 0.6 | within noise |
| pass chargeProcess | 0.021 | 0.022 | 4.5 | within noise |
| pass chargeFinalize | 0.016 | 0.015 | -1.7 | within noise |
| pass pressure | 0.012 | 0.008 | -33.8 | within noise |
| pass communicationSelect | 0.017 | 0.020 | 15.3 | within noise |
| pass communicationTransmit | 0.017 | 0.019 | 15.1 | within noise |
| pass localSuccess | 0.018 | 0.017 | -4.1 | within noise |
| pass healthUpdate | 0.020 | 0.019 | -4.6 | within noise |
| pass force | 2.021 | 0.595 | -70.6 | lower (beyond noise) |
| pass mechanics | 0.025 | 0.025 | 1.9 | within noise |
| pass deathCompaction | 0.153 | 0.153 | 0.1 | within noise |
| pass sortCount | n/a | 0.022 | n/a | n/a |
| pass sortScan | n/a | 0.046 | n/a | n/a |
| pass sortScatter | n/a | 0.043 | n/a | n/a |

### N = 5000  (5 baseline / 5 candidate rounds, medians)

| metric | baseline | candidate | delta % | verdict |
|---|---:|---:|---:|---|
| step ms (mean) | 8.800 | 5.066 | -42.4 | lower (beyond noise) |
| step ms (p95) | 10.100 | 6.105 | -39.6 | within noise |
| particle-steps/s | 394477 | 563317 | 42.8 | higher (beyond noise) |
| GPU sum ms | 5.189 | 1.558 | -70.0 | lower (beyond noise) |
| pass gridClear | 0.026 | 0.027 | 2.7 | within noise |
| pass gridBuild | 0.034 | 0.036 | 7.3 | within noise |
| pass chargeProcess | 0.034 | 0.031 | -8.2 | within noise |
| pass chargeFinalize | 0.017 | 0.017 | 0.7 | within noise |
| pass pressure | 0.007 | 0.007 | 4.8 | within noise |
| pass communicationSelect | 0.022 | 0.022 | -0.1 | within noise |
| pass communicationTransmit | 0.022 | 0.022 | -1.5 | within noise |
| pass localSuccess | 0.021 | 0.018 | -11.1 | within noise |
| pass healthUpdate | 0.028 | 0.026 | -9.0 | within noise |
| pass force | 4.616 | 0.836 | -81.9 | lower (beyond noise) |
| pass mechanics | 0.039 | 0.040 | 3.7 | within noise |
| pass deathCompaction | 0.316 | 0.321 | 1.7 | within noise |
| pass sortCount | n/a | 0.033 | n/a | n/a |
| pass sortScan | n/a | 0.046 | n/a | n/a |
| pass sortScatter | n/a | 0.072 | n/a | n/a |

### N = 10000  (5 baseline / 5 candidate rounds, medians)

| metric | baseline | candidate | delta % | verdict |
|---|---:|---:|---:|---|
| step ms (mean) | 15.237 | 6.961 | -54.3 | lower (beyond noise) |
| step ms (p95) | 17.000 | 8.205 | -51.7 | within noise |
| particle-steps/s | 521458 | 927300 | 77.8 | higher (beyond noise) |
| GPU sum ms | 10.357 | 2.754 | -73.4 | lower (beyond noise) |
| pass gridClear | 0.027 | 0.027 | 1.1 | within noise |
| pass gridBuild | 0.056 | 0.059 | 5.9 | within noise |
| pass chargeProcess | 0.039 | 0.040 | 2.3 | within noise |
| pass chargeFinalize | 0.025 | 0.028 | 11.2 | within noise |
| pass pressure | 0.007 | 0.007 | 3.2 | within noise |
| pass communicationSelect | 0.026 | 0.027 | 2.9 | within noise |
| pass communicationTransmit | 0.026 | 0.025 | -5.1 | within noise |
| pass localSuccess | 0.022 | 0.022 | 2.9 | within noise |
| pass healthUpdate | 0.037 | 0.037 | 1.3 | within noise |
| pass force | 9.413 | 1.609 | -82.9 | lower (beyond noise) |
| pass mechanics | 0.064 | 0.066 | 3.6 | within noise |
| pass deathCompaction | 0.618 | 0.596 | -3.5 | within noise |
| pass sortCount | n/a | 0.044 | n/a | n/a |
| pass sortScan | n/a | 0.046 | n/a | n/a |
| pass sortScatter | n/a | 0.111 | n/a | n/a |
