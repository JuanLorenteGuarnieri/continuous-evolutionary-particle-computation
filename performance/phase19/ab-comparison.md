## ab-merge vs ab-base  [variant: baseline]  (kernels: {"deathCompaction":"parallel"}; rounds 5 vs 5)

### N = 200  (5 baseline / 5 candidate rounds, medians)

| metric | baseline | candidate | delta % | verdict |
|---|---:|---:|---:|---|
| step ms (mean) | 4.870 | 4.379 | -10.1 | lower (beyond noise) |
| step ms (p95) | 6.100 | 5.220 | -14.4 | within noise |
| particle-steps/s | 24307 | 25887 | 6.5 | higher (beyond noise) |
| GPU sum ms | 0.572 | 0.567 | -0.9 | within noise |
| pass gridClear | 0.026 | 0.025 | -3.5 | within noise |
| pass gridBuild | 0.012 | 0.012 | -1.6 | within noise |
| pass chargeProcess | 0.018 | 0.017 | -3.6 | within noise |
| pass chargeFinalize | 0.012 | 0.013 | 1.1 | within noise |
| pass pressure | 0.007 | 0.007 | -0.9 | within noise |
| pass communicationSelect | 0.016 | 0.016 | 3.0 | within noise |
| pass communicationTransmit | 0.016 | 0.016 | -1.7 | within noise |
| pass localSuccess | 0.016 | 0.016 | -1.3 | within noise |
| pass healthUpdate | 0.015 | 0.015 | -2.7 | within noise |
| pass sortCount | 0.020 | 0.020 | -2.9 | within noise |
| pass sortScan | 0.045 | 0.045 | -0.8 | within noise |
| pass sortScatter | 0.034 | 0.033 | -3.0 | within noise |
| pass force | 0.258 | 0.259 | 0.4 | within noise |
| pass mechanics | 0.016 | 0.016 | -1.0 | within noise |
| pass deathCompaction | 0.058 | 0.056 | -2.1 | within noise |
| pass render | 0.000 | 0.000 | n/a | n/a |

### N = 500  (5 baseline / 5 candidate rounds, medians)

| metric | baseline | candidate | delta % | verdict |
|---|---:|---:|---:|---|
| step ms (mean) | 6.480 | 4.802 | -25.9 | lower (beyond noise) |
| step ms (p95) | 8.510 | 6.310 | -25.9 | within noise |
| particle-steps/s | 50150 | 62445 | 24.5 | higher (beyond noise) |
| GPU sum ms | 0.902 | 0.916 | 1.5 | within noise |
| pass gridClear | 0.025 | 0.025 | 0.7 | within noise |
| pass gridBuild | 0.011 | 0.012 | 1.3 | within noise |
| pass chargeProcess | 0.017 | 0.018 | 5.4 | within noise |
| pass chargeFinalize | 0.012 | 0.012 | 1.3 | within noise |
| pass pressure | 0.007 | 0.007 | 3.7 | within noise |
| pass communicationSelect | 0.016 | 0.017 | 5.8 | within noise |
| pass communicationTransmit | 0.016 | 0.016 | -0.8 | within noise |
| pass localSuccess | 0.016 | 0.016 | 1.0 | within noise |
| pass healthUpdate | 0.015 | 0.015 | 0.3 | within noise |
| pass sortCount | 0.020 | 0.020 | 0.8 | within noise |
| pass sortScan | 0.042 | 0.043 | 2.9 | within noise |
| pass sortScatter | 0.033 | 0.034 | 2.1 | within noise |
| pass force | 0.590 | 0.594 | 0.8 | within noise |
| pass mechanics | 0.016 | 0.016 | 0.9 | within noise |
| pass deathCompaction | 0.067 | 0.069 | 2.9 | within noise |
| pass render | 0.000 | 0.000 | n/a | n/a |

### N = 1000  (5 baseline / 5 candidate rounds, medians)

| metric | baseline | candidate | delta % | verdict |
|---|---:|---:|---:|---|
| step ms (mean) | 6.758 | 4.477 | -33.8 | lower (beyond noise) |
| step ms (p95) | 8.300 | 5.400 | -34.9 | lower (beyond noise) |
| particle-steps/s | 98804 | 130191 | 31.8 | higher (beyond noise) |
| GPU sum ms | 0.984 | 0.976 | -0.8 | lower (beyond noise) |
| pass gridClear | 0.027 | 0.026 | -4.6 | lower (beyond noise) |
| pass gridBuild | 0.013 | 0.012 | -5.7 | within noise |
| pass chargeProcess | 0.020 | 0.018 | -6.0 | within noise |
| pass chargeFinalize | 0.013 | 0.013 | -4.7 | lower (beyond noise) |
| pass pressure | 0.007 | 0.007 | -3.2 | within noise |
| pass communicationSelect | 0.017 | 0.017 | -3.3 | within noise |
| pass communicationTransmit | 0.017 | 0.017 | 1.2 | within noise |
| pass localSuccess | 0.017 | 0.016 | -3.8 | within noise |
| pass healthUpdate | 0.018 | 0.017 | -5.5 | within noise |
| pass sortCount | 0.021 | 0.020 | -4.1 | within noise |
| pass sortScan | 0.046 | 0.045 | -3.1 | within noise |
| pass sortScatter | 0.037 | 0.036 | -2.0 | within noise |
| pass force | 0.609 | 0.607 | -0.4 | within noise |
| pass mechanics | 0.020 | 0.020 | 0.1 | within noise |
| pass deathCompaction | 0.100 | 0.098 | -1.4 | within noise |
| pass render | 0.000 | 0.000 | n/a | n/a |

### N = 2000  (5 baseline / 5 candidate rounds, medians)

| metric | baseline | candidate | delta % | verdict |
|---|---:|---:|---:|---|
| step ms (mean) | 8.850 | 4.839 | -45.3 | lower (beyond noise) |
| step ms (p95) | 10.700 | 5.900 | -44.9 | lower (beyond noise) |
| particle-steps/s | 161095 | 247280 | 53.5 | higher (beyond noise) |
| GPU sum ms | 1.055 | 1.031 | -2.2 | lower (beyond noise) |
| pass gridClear | 0.027 | 0.026 | -2.9 | within noise |
| pass gridBuild | 0.015 | 0.014 | -5.7 | within noise |
| pass chargeProcess | 0.022 | 0.021 | -7.7 | within noise |
| pass chargeFinalize | 0.015 | 0.014 | -6.7 | lower (beyond noise) |
| pass pressure | 0.008 | 0.007 | -7.5 | within noise |
| pass communicationSelect | 0.019 | 0.018 | -6.7 | lower (beyond noise) |
| pass communicationTransmit | 0.019 | 0.018 | -5.8 | within noise |
| pass localSuccess | 0.017 | 0.017 | -0.4 | within noise |
| pass healthUpdate | 0.020 | 0.019 | -4.6 | within noise |
| pass sortCount | 0.022 | 0.021 | -5.0 | within noise |
| pass sortScan | 0.047 | 0.045 | -4.4 | lower (beyond noise) |
| pass sortScatter | 0.045 | 0.043 | -5.5 | within noise |
| pass force | 0.601 | 0.589 | -2.1 | within noise |
| pass mechanics | 0.026 | 0.025 | -2.6 | within noise |
| pass deathCompaction | 0.157 | 0.155 | -1.2 | within noise |
| pass render | 0.000 | 0.000 | n/a | n/a |

### N = 5000  (5 baseline / 5 candidate rounds, medians)

| metric | baseline | candidate | delta % | verdict |
|---|---:|---:|---:|---|
| step ms (mean) | 16.238 | 6.213 | -61.7 | lower (beyond noise) |
| step ms (p95) | 17.610 | 7.015 | -60.2 | lower (beyond noise) |
| particle-steps/s | 250828 | 527927 | 110.5 | higher (beyond noise) |
| GPU sum ms | 1.543 | 1.520 | -1.4 | within noise |
| pass gridClear | 0.027 | 0.026 | -2.6 | lower (beyond noise) |
| pass gridBuild | 0.032 | 0.030 | -4.6 | within noise |
| pass chargeProcess | 0.029 | 0.027 | -5.9 | lower (beyond noise) |
| pass chargeFinalize | 0.018 | 0.017 | -8.7 | lower (beyond noise) |
| pass pressure | 0.008 | 0.007 | -6.9 | within noise |
| pass communicationSelect | 0.022 | 0.021 | -4.7 | within noise |
| pass communicationTransmit | 0.021 | 0.020 | -0.9 | within noise |
| pass localSuccess | 0.019 | 0.018 | -2.3 | within noise |
| pass healthUpdate | 0.027 | 0.026 | -4.6 | within noise |
| pass sortCount | 0.034 | 0.033 | -2.8 | within noise |
| pass sortScan | 0.048 | 0.046 | -4.0 | lower (beyond noise) |
| pass sortScatter | 0.074 | 0.071 | -4.5 | within noise |
| pass force | 0.827 | 0.827 | 0.0 | within noise |
| pass mechanics | 0.039 | 0.038 | -2.0 | within noise |
| pass deathCompaction | 0.319 | 0.313 | -1.9 | within noise |
| pass render | 0.000 | 0.000 | n/a | n/a |

### N = 10000  (5 baseline / 5 candidate rounds, medians)

| metric | baseline | candidate | delta % | verdict |
|---|---:|---:|---:|---|
| step ms (mean) | 32.632 | 9.861 | -69.8 | lower (beyond noise) |
| step ms (p95) | 43.740 | 12.005 | -72.6 | lower (beyond noise) |
| particle-steps/s | 265632 | 741840 | 179.3 | higher (beyond noise) |
| GPU sum ms | 2.735 | 2.717 | -0.7 | within noise |
| pass gridClear | 0.027 | 0.026 | -2.3 | within noise |
| pass gridBuild | 0.050 | 0.049 | -2.4 | within noise |
| pass chargeProcess | 0.041 | 0.038 | -6.1 | lower (beyond noise) |
| pass chargeFinalize | 0.027 | 0.025 | -6.7 | within noise |
| pass pressure | 0.007 | 0.007 | -1.8 | within noise |
| pass communicationSelect | 0.027 | 0.025 | -5.8 | within noise |
| pass communicationTransmit | 0.026 | 0.025 | -3.7 | within noise |
| pass localSuccess | 0.024 | 0.023 | -4.1 | within noise |
| pass healthUpdate | 0.040 | 0.038 | -6.1 | lower (beyond noise) |
| pass sortCount | 0.045 | 0.044 | -1.2 | within noise |
| pass sortScan | 0.047 | 0.047 | -1.7 | within noise |
| pass sortScatter | 0.111 | 0.109 | -1.1 | within noise |
| pass force | 1.621 | 1.617 | -0.2 | within noise |
| pass mechanics | 0.061 | 0.063 | 3.0 | within noise |
| pass deathCompaction | 0.580 | 0.578 | -0.3 | within noise |
| pass render | 0.000 | 0.000 | n/a | n/a |

## ab-death vs ab-base  [variant: baseline]  (kernels: {"deathCompaction":"blocked"}; rounds 5 vs 5)

### N = 200  (5 baseline / 5 candidate rounds, medians)

| metric | baseline | candidate | delta % | verdict |
|---|---:|---:|---:|---|
| step ms (mean) | 4.870 | 4.829 | -0.8 | within noise |
| step ms (p95) | 6.100 | 5.700 | -6.6 | within noise |
| particle-steps/s | 24307 | 24248 | -0.2 | within noise |
| GPU sum ms | 0.572 | 0.565 | -1.2 | within noise |
| pass gridClear | 0.026 | 0.026 | -1.3 | within noise |
| pass gridBuild | 0.012 | 0.012 | 1.2 | within noise |
| pass chargeProcess | 0.018 | 0.018 | 1.3 | within noise |
| pass chargeFinalize | 0.012 | 0.013 | 2.4 | within noise |
| pass pressure | 0.007 | 0.007 | 1.6 | within noise |
| pass communicationSelect | 0.016 | 0.016 | -0.5 | within noise |
| pass communicationTransmit | 0.016 | 0.016 | -3.8 | within noise |
| pass localSuccess | 0.016 | 0.016 | -0.4 | within noise |
| pass healthUpdate | 0.015 | 0.015 | -0.6 | within noise |
| pass sortCount | 0.020 | 0.020 | -1.0 | within noise |
| pass sortScan | 0.045 | 0.046 | 2.4 | within noise |
| pass sortScatter | 0.034 | 0.033 | -1.0 | within noise |
| pass force | 0.258 | 0.258 | 0.2 | within noise |
| pass mechanics | 0.016 | 0.016 | 0.3 | within noise |
| pass deathCompaction | 0.058 | 0.052 | -9.8 | lower (beyond noise) |
| pass render | 0.000 | 0.000 | n/a | n/a |

### N = 500  (5 baseline / 5 candidate rounds, medians)

| metric | baseline | candidate | delta % | verdict |
|---|---:|---:|---:|---|
| step ms (mean) | 6.480 | 6.566 | 1.3 | within noise |
| step ms (p95) | 8.510 | 8.800 | 3.4 | within noise |
| particle-steps/s | 50150 | 50030 | -0.2 | within noise |
| GPU sum ms | 0.902 | 0.880 | -2.4 | lower (beyond noise) |
| pass gridClear | 0.025 | 0.025 | -0.9 | within noise |
| pass gridBuild | 0.011 | 0.011 | -2.5 | within noise |
| pass chargeProcess | 0.017 | 0.017 | 1.2 | within noise |
| pass chargeFinalize | 0.012 | 0.012 | -0.6 | within noise |
| pass pressure | 0.007 | 0.007 | 0.1 | within noise |
| pass communicationSelect | 0.016 | 0.016 | 0.9 | within noise |
| pass communicationTransmit | 0.016 | 0.016 | -0.5 | within noise |
| pass localSuccess | 0.016 | 0.015 | -2.0 | within noise |
| pass healthUpdate | 0.015 | 0.015 | -0.3 | within noise |
| pass sortCount | 0.020 | 0.019 | -2.2 | within noise |
| pass sortScan | 0.042 | 0.042 | -0.5 | within noise |
| pass sortScatter | 0.033 | 0.032 | -2.7 | within noise |
| pass force | 0.590 | 0.588 | -0.3 | within noise |
| pass mechanics | 0.016 | 0.016 | 1.4 | within noise |
| pass deathCompaction | 0.067 | 0.049 | -26.8 | lower (beyond noise) |
| pass render | 0.000 | 0.000 | n/a | n/a |

### N = 1000  (5 baseline / 5 candidate rounds, medians)

| metric | baseline | candidate | delta % | verdict |
|---|---:|---:|---:|---|
| step ms (mean) | 6.758 | 6.755 | -0.0 | within noise |
| step ms (p95) | 8.300 | 8.210 | -1.1 | within noise |
| particle-steps/s | 98804 | 97828 | -1.0 | within noise |
| GPU sum ms | 0.984 | 0.946 | -3.9 | lower (beyond noise) |
| pass gridClear | 0.027 | 0.026 | -1.5 | within noise |
| pass gridBuild | 0.013 | 0.013 | -2.1 | within noise |
| pass chargeProcess | 0.020 | 0.020 | 0.6 | within noise |
| pass chargeFinalize | 0.013 | 0.014 | 1.8 | within noise |
| pass pressure | 0.007 | 0.007 | -2.3 | within noise |
| pass communicationSelect | 0.017 | 0.017 | -2.6 | within noise |
| pass communicationTransmit | 0.017 | 0.017 | -0.4 | within noise |
| pass localSuccess | 0.017 | 0.017 | -0.6 | within noise |
| pass healthUpdate | 0.018 | 0.018 | 0.8 | within noise |
| pass sortCount | 0.021 | 0.021 | -1.7 | within noise |
| pass sortScan | 0.046 | 0.047 | 1.6 | within noise |
| pass sortScatter | 0.037 | 0.037 | 1.3 | within noise |
| pass force | 0.609 | 0.617 | 1.2 | within noise |
| pass mechanics | 0.020 | 0.020 | -1.4 | within noise |
| pass deathCompaction | 0.100 | 0.055 | -45.3 | lower (beyond noise) |
| pass render | 0.000 | 0.000 | n/a | n/a |

### N = 2000  (5 baseline / 5 candidate rounds, medians)

| metric | baseline | candidate | delta % | verdict |
|---|---:|---:|---:|---|
| step ms (mean) | 8.850 | 8.990 | 1.6 | within noise |
| step ms (p95) | 10.700 | 10.910 | 2.0 | within noise |
| particle-steps/s | 161095 | 158667 | -1.5 | within noise |
| GPU sum ms | 1.055 | 0.958 | -9.2 | lower (beyond noise) |
| pass gridClear | 0.027 | 0.027 | -0.4 | within noise |
| pass gridBuild | 0.015 | 0.015 | -2.5 | within noise |
| pass chargeProcess | 0.022 | 0.022 | -2.1 | within noise |
| pass chargeFinalize | 0.015 | 0.014 | -2.0 | within noise |
| pass pressure | 0.008 | 0.007 | -2.0 | within noise |
| pass communicationSelect | 0.019 | 0.018 | -5.9 | within noise |
| pass communicationTransmit | 0.019 | 0.018 | -4.2 | within noise |
| pass localSuccess | 0.017 | 0.017 | 1.3 | within noise |
| pass healthUpdate | 0.020 | 0.019 | -4.4 | within noise |
| pass sortCount | 0.022 | 0.021 | -1.2 | within noise |
| pass sortScan | 0.047 | 0.047 | -0.4 | within noise |
| pass sortScatter | 0.045 | 0.044 | -2.6 | within noise |
| pass force | 0.601 | 0.600 | -0.2 | within noise |
| pass mechanics | 0.026 | 0.025 | -4.0 | within noise |
| pass deathCompaction | 0.157 | 0.059 | -62.0 | lower (beyond noise) |
| pass render | 0.000 | 0.000 | n/a | n/a |

### N = 5000  (5 baseline / 5 candidate rounds, medians)

| metric | baseline | candidate | delta % | verdict |
|---|---:|---:|---:|---|
| step ms (mean) | 16.238 | 16.009 | -1.4 | within noise |
| step ms (p95) | 17.610 | 17.200 | -2.3 | within noise |
| particle-steps/s | 250828 | 251636 | 0.3 | within noise |
| GPU sum ms | 1.543 | 1.295 | -16.1 | lower (beyond noise) |
| pass gridClear | 0.027 | 0.027 | 0.1 | within noise |
| pass gridBuild | 0.032 | 0.031 | -2.2 | within noise |
| pass chargeProcess | 0.029 | 0.028 | -2.3 | within noise |
| pass chargeFinalize | 0.018 | 0.018 | -2.2 | within noise |
| pass pressure | 0.008 | 0.007 | -3.3 | within noise |
| pass communicationSelect | 0.022 | 0.022 | -0.1 | within noise |
| pass communicationTransmit | 0.021 | 0.021 | 1.6 | within noise |
| pass localSuccess | 0.019 | 0.019 | 0.8 | within noise |
| pass healthUpdate | 0.027 | 0.027 | -0.3 | within noise |
| pass sortCount | 0.034 | 0.033 | -0.4 | within noise |
| pass sortScan | 0.048 | 0.047 | -1.8 | within noise |
| pass sortScatter | 0.074 | 0.072 | -2.2 | within noise |
| pass force | 0.827 | 0.824 | -0.3 | within noise |
| pass mechanics | 0.039 | 0.039 | 0.2 | within noise |
| pass deathCompaction | 0.319 | 0.078 | -75.6 | lower (beyond noise) |
| pass render | 0.000 | 0.000 | n/a | n/a |

### N = 10000  (5 baseline / 5 candidate rounds, medians)

| metric | baseline | candidate | delta % | verdict |
|---|---:|---:|---:|---|
| step ms (mean) | 32.632 | 31.727 | -2.8 | within noise |
| step ms (p95) | 43.740 | 42.470 | -2.9 | within noise |
| particle-steps/s | 265632 | 271946 | 2.4 | within noise |
| GPU sum ms | 2.735 | 2.247 | -17.8 | lower (beyond noise) |
| pass gridClear | 0.027 | 0.027 | -1.5 | within noise |
| pass gridBuild | 0.050 | 0.049 | -2.4 | within noise |
| pass chargeProcess | 0.041 | 0.040 | -2.2 | within noise |
| pass chargeFinalize | 0.027 | 0.026 | -3.3 | within noise |
| pass pressure | 0.007 | 0.007 | -0.5 | within noise |
| pass communicationSelect | 0.027 | 0.025 | -4.6 | within noise |
| pass communicationTransmit | 0.026 | 0.025 | -3.2 | within noise |
| pass localSuccess | 0.024 | 0.023 | -2.0 | within noise |
| pass healthUpdate | 0.040 | 0.039 | -2.2 | lower (beyond noise) |
| pass sortCount | 0.045 | 0.045 | 0.2 | within noise |
| pass sortScan | 0.047 | 0.046 | -2.7 | within noise |
| pass sortScatter | 0.111 | 0.111 | 0.4 | within noise |
| pass force | 1.621 | 1.615 | -0.4 | within noise |
| pass mechanics | 0.061 | 0.062 | 1.6 | within noise |
| pass deathCompaction | 0.580 | 0.103 | -82.2 | lower (beyond noise) |
| pass render | 0.000 | 0.000 | n/a | n/a |

## ab-both vs ab-base  [variant: baseline]  (kernels: {"deathCompaction":"blocked"}; rounds 5 vs 5)

### N = 200  (5 baseline / 5 candidate rounds, medians)

| metric | baseline | candidate | delta % | verdict |
|---|---:|---:|---:|---|
| step ms (mean) | 4.870 | 4.432 | -9.0 | lower (beyond noise) |
| step ms (p95) | 6.100 | 5.315 | -12.9 | within noise |
| particle-steps/s | 24307 | 25419 | 4.6 | higher (beyond noise) |
| GPU sum ms | 0.572 | 0.563 | -1.6 | within noise |
| pass gridClear | 0.026 | 0.025 | -3.0 | within noise |
| pass gridBuild | 0.012 | 0.012 | -1.1 | within noise |
| pass chargeProcess | 0.018 | 0.019 | 2.3 | within noise |
| pass chargeFinalize | 0.012 | 0.012 | -0.5 | within noise |
| pass pressure | 0.007 | 0.007 | -4.1 | within noise |
| pass communicationSelect | 0.016 | 0.016 | 1.4 | within noise |
| pass communicationTransmit | 0.016 | 0.016 | -0.5 | within noise |
| pass localSuccess | 0.016 | 0.016 | -0.9 | within noise |
| pass healthUpdate | 0.015 | 0.015 | -2.6 | within noise |
| pass sortCount | 0.020 | 0.020 | -2.4 | within noise |
| pass sortScan | 0.045 | 0.046 | 1.4 | within noise |
| pass sortScatter | 0.034 | 0.033 | -3.0 | within noise |
| pass force | 0.258 | 0.258 | 0.1 | within noise |
| pass mechanics | 0.016 | 0.016 | 1.2 | within noise |
| pass deathCompaction | 0.058 | 0.052 | -10.5 | lower (beyond noise) |
| pass render | 0.000 | 0.000 | n/a | n/a |

### N = 500  (5 baseline / 5 candidate rounds, medians)

| metric | baseline | candidate | delta % | verdict |
|---|---:|---:|---:|---|
| step ms (mean) | 6.480 | 5.085 | -21.5 | lower (beyond noise) |
| step ms (p95) | 8.510 | 7.270 | -14.6 | within noise |
| particle-steps/s | 50150 | 58734 | 17.1 | higher (beyond noise) |
| GPU sum ms | 0.902 | 0.886 | -1.8 | within noise |
| pass gridClear | 0.025 | 0.024 | -1.5 | within noise |
| pass gridBuild | 0.011 | 0.011 | -0.4 | within noise |
| pass chargeProcess | 0.017 | 0.017 | 2.5 | within noise |
| pass chargeFinalize | 0.012 | 0.012 | 0.9 | within noise |
| pass pressure | 0.007 | 0.007 | 2.7 | within noise |
| pass communicationSelect | 0.016 | 0.016 | 0.9 | within noise |
| pass communicationTransmit | 0.016 | 0.016 | 2.8 | within noise |
| pass localSuccess | 0.016 | 0.015 | -0.4 | within noise |
| pass healthUpdate | 0.015 | 0.015 | 1.0 | within noise |
| pass sortCount | 0.020 | 0.020 | -0.5 | within noise |
| pass sortScan | 0.042 | 0.042 | -0.2 | within noise |
| pass sortScatter | 0.033 | 0.033 | -0.8 | within noise |
| pass force | 0.590 | 0.589 | -0.2 | within noise |
| pass mechanics | 0.016 | 0.016 | -0.1 | within noise |
| pass deathCompaction | 0.067 | 0.049 | -26.1 | lower (beyond noise) |
| pass render | 0.000 | 0.000 | n/a | n/a |

### N = 1000  (5 baseline / 5 candidate rounds, medians)

| metric | baseline | candidate | delta % | verdict |
|---|---:|---:|---:|---|
| step ms (mean) | 6.758 | 4.518 | -33.1 | lower (beyond noise) |
| step ms (p95) | 8.300 | 5.600 | -32.5 | lower (beyond noise) |
| particle-steps/s | 98804 | 125408 | 26.9 | higher (beyond noise) |
| GPU sum ms | 0.984 | 0.942 | -4.3 | lower (beyond noise) |
| pass gridClear | 0.027 | 0.026 | -3.7 | within noise |
| pass gridBuild | 0.013 | 0.012 | -4.1 | within noise |
| pass chargeProcess | 0.020 | 0.019 | -2.5 | within noise |
| pass chargeFinalize | 0.013 | 0.013 | -1.3 | within noise |
| pass pressure | 0.007 | 0.007 | -1.9 | within noise |
| pass communicationSelect | 0.017 | 0.017 | -2.5 | within noise |
| pass communicationTransmit | 0.017 | 0.017 | -1.3 | within noise |
| pass localSuccess | 0.017 | 0.017 | -2.2 | within noise |
| pass healthUpdate | 0.018 | 0.017 | -3.4 | within noise |
| pass sortCount | 0.021 | 0.020 | -2.6 | within noise |
| pass sortScan | 0.046 | 0.045 | -1.9 | within noise |
| pass sortScatter | 0.037 | 0.036 | -1.0 | within noise |
| pass force | 0.609 | 0.617 | 1.2 | within noise |
| pass mechanics | 0.020 | 0.019 | -4.0 | within noise |
| pass deathCompaction | 0.100 | 0.055 | -45.1 | lower (beyond noise) |
| pass render | 0.000 | 0.000 | n/a | n/a |

### N = 2000  (5 baseline / 5 candidate rounds, medians)

| metric | baseline | candidate | delta % | verdict |
|---|---:|---:|---:|---|
| step ms (mean) | 8.850 | 4.797 | -45.8 | lower (beyond noise) |
| step ms (p95) | 10.700 | 5.705 | -46.7 | lower (beyond noise) |
| particle-steps/s | 161095 | 246975 | 53.3 | higher (beyond noise) |
| GPU sum ms | 1.055 | 0.942 | -10.7 | lower (beyond noise) |
| pass gridClear | 0.027 | 0.026 | -3.9 | lower (beyond noise) |
| pass gridBuild | 0.015 | 0.014 | -7.0 | within noise |
| pass chargeProcess | 0.022 | 0.021 | -7.5 | within noise |
| pass chargeFinalize | 0.015 | 0.014 | -6.6 | lower (beyond noise) |
| pass pressure | 0.008 | 0.007 | -6.8 | within noise |
| pass communicationSelect | 0.019 | 0.018 | -7.5 | lower (beyond noise) |
| pass communicationTransmit | 0.019 | 0.018 | -5.8 | within noise |
| pass localSuccess | 0.017 | 0.017 | -1.5 | within noise |
| pass healthUpdate | 0.020 | 0.019 | -5.1 | within noise |
| pass sortCount | 0.022 | 0.021 | -2.0 | within noise |
| pass sortScan | 0.047 | 0.046 | -3.0 | lower (beyond noise) |
| pass sortScatter | 0.045 | 0.044 | -2.7 | within noise |
| pass force | 0.601 | 0.596 | -1.0 | within noise |
| pass mechanics | 0.026 | 0.024 | -6.2 | within noise |
| pass deathCompaction | 0.157 | 0.060 | -61.9 | lower (beyond noise) |
| pass render | 0.000 | 0.000 | n/a | n/a |

### N = 5000  (5 baseline / 5 candidate rounds, medians)

| metric | baseline | candidate | delta % | verdict |
|---|---:|---:|---:|---|
| step ms (mean) | 16.238 | 6.208 | -61.8 | lower (beyond noise) |
| step ms (p95) | 17.610 | 6.800 | -61.4 | lower (beyond noise) |
| particle-steps/s | 250828 | 515730 | 105.6 | higher (beyond noise) |
| GPU sum ms | 1.543 | 1.280 | -17.0 | lower (beyond noise) |
| pass gridClear | 0.027 | 0.026 | -2.5 | lower (beyond noise) |
| pass gridBuild | 0.032 | 0.030 | -4.3 | within noise |
| pass chargeProcess | 0.029 | 0.028 | -4.0 | within noise |
| pass chargeFinalize | 0.018 | 0.017 | -9.3 | within noise |
| pass pressure | 0.008 | 0.007 | -5.8 | within noise |
| pass communicationSelect | 0.022 | 0.022 | -2.2 | within noise |
| pass communicationTransmit | 0.021 | 0.021 | 0.7 | within noise |
| pass localSuccess | 0.019 | 0.018 | -0.5 | within noise |
| pass healthUpdate | 0.027 | 0.025 | -5.0 | within noise |
| pass sortCount | 0.034 | 0.033 | -3.2 | lower (beyond noise) |
| pass sortScan | 0.048 | 0.045 | -5.5 | lower (beyond noise) |
| pass sortScatter | 0.074 | 0.070 | -4.6 | lower (beyond noise) |
| pass force | 0.827 | 0.824 | -0.4 | within noise |
| pass mechanics | 0.039 | 0.037 | -3.1 | within noise |
| pass deathCompaction | 0.319 | 0.076 | -76.1 | lower (beyond noise) |
| pass render | 0.000 | 0.000 | n/a | n/a |

### N = 10000  (5 baseline / 5 candidate rounds, medians)

| metric | baseline | candidate | delta % | verdict |
|---|---:|---:|---:|---|
| step ms (mean) | 32.632 | 8.573 | -73.7 | lower (beyond noise) |
| step ms (p95) | 43.740 | 10.105 | -76.9 | lower (beyond noise) |
| particle-steps/s | 265632 | 828226 | 211.8 | higher (beyond noise) |
| GPU sum ms | 2.735 | 2.241 | -18.1 | lower (beyond noise) |
| pass gridClear | 0.027 | 0.027 | -1.8 | within noise |
| pass gridBuild | 0.050 | 0.049 | -2.1 | within noise |
| pass chargeProcess | 0.041 | 0.038 | -7.6 | lower (beyond noise) |
| pass chargeFinalize | 0.027 | 0.025 | -8.7 | lower (beyond noise) |
| pass pressure | 0.007 | 0.007 | -2.2 | within noise |
| pass communicationSelect | 0.027 | 0.025 | -5.7 | within noise |
| pass communicationTransmit | 0.026 | 0.025 | -3.1 | within noise |
| pass localSuccess | 0.024 | 0.023 | -5.2 | within noise |
| pass healthUpdate | 0.040 | 0.038 | -4.4 | lower (beyond noise) |
| pass sortCount | 0.045 | 0.044 | -0.8 | within noise |
| pass sortScan | 0.047 | 0.045 | -4.2 | lower (beyond noise) |
| pass sortScatter | 0.111 | 0.109 | -1.7 | within noise |
| pass force | 1.621 | 1.621 | -0.0 | within noise |
| pass mechanics | 0.061 | 0.062 | 2.0 | within noise |
| pass deathCompaction | 0.580 | 0.102 | -82.4 | lower (beyond noise) |
| pass render | 0.000 | 0.000 | n/a | n/a |

## ab-merge vs ab-base  [variant: renderDisabled]  (kernels: {"deathCompaction":"parallel"}; rounds 5 vs 5)

### N = 200  (5 baseline / 5 candidate rounds, medians)

| metric | baseline | candidate | delta % | verdict |
|---|---:|---:|---:|---|
| step ms (mean) | 4.190 | 4.139 | -1.2 | within noise |
| step ms (p95) | 4.905 | 4.710 | -4.0 | within noise |
| particle-steps/s | 25924 | 26052 | 0.5 | within noise |
| GPU sum ms | 0.590 | 0.586 | -0.7 | within noise |
| pass gridClear | 0.027 | 0.026 | -2.3 | lower (beyond noise) |
| pass gridBuild | 0.016 | 0.015 | -3.0 | within noise |
| pass chargeProcess | 0.019 | 0.019 | -2.5 | within noise |
| pass chargeFinalize | 0.014 | 0.014 | 0.7 | within noise |
| pass pressure | 0.008 | 0.009 | 3.4 | within noise |
| pass communicationSelect | 0.018 | 0.017 | -1.3 | within noise |
| pass communicationTransmit | 0.018 | 0.017 | -4.3 | within noise |
| pass localSuccess | 0.017 | 0.017 | -1.4 | within noise |
| pass healthUpdate | 0.018 | 0.017 | -6.7 | within noise |
| pass sortCount | 0.022 | 0.022 | 3.9 | within noise |
| pass sortScan | 0.047 | 0.045 | -2.7 | within noise |
| pass sortScatter | 0.033 | 0.033 | 0.5 | within noise |
| pass force | 0.260 | 0.258 | -0.8 | within noise |
| pass mechanics | 0.016 | 0.016 | -0.9 | within noise |
| pass deathCompaction | 0.058 | 0.057 | -1.1 | within noise |

### N = 500  (5 baseline / 5 candidate rounds, medians)

| metric | baseline | candidate | delta % | verdict |
|---|---:|---:|---:|---|
| step ms (mean) | 4.061 | 4.223 | 4.0 | within noise |
| step ms (p95) | 5.005 | 5.705 | 14.0 | within noise |
| particle-steps/s | 70225 | 68540 | -2.4 | within noise |
| GPU sum ms | 0.921 | 0.905 | -1.8 | lower (beyond noise) |
| pass gridClear | 0.026 | 0.025 | -4.0 | lower (beyond noise) |
| pass gridBuild | 0.014 | 0.014 | -0.6 | within noise |
| pass chargeProcess | 0.017 | 0.018 | 1.8 | within noise |
| pass chargeFinalize | 0.013 | 0.013 | 1.9 | within noise |
| pass pressure | 0.007 | 0.007 | 4.3 | within noise |
| pass communicationSelect | 0.018 | 0.018 | 3.4 | within noise |
| pass communicationTransmit | 0.017 | 0.017 | -3.8 | within noise |
| pass localSuccess | 0.016 | 0.016 | 0.8 | within noise |
| pass healthUpdate | 0.015 | 0.015 | -0.5 | within noise |
| pass sortCount | 0.020 | 0.020 | -0.3 | within noise |
| pass sortScan | 0.042 | 0.041 | -3.0 | within noise |
| pass sortScatter | 0.032 | 0.032 | -0.2 | within noise |
| pass force | 0.591 | 0.586 | -0.8 | lower (beyond noise) |
| pass mechanics | 0.016 | 0.016 | -2.6 | within noise |
| pass deathCompaction | 0.074 | 0.067 | -8.8 | within noise |

### N = 1000  (5 baseline / 5 candidate rounds, medians)

| metric | baseline | candidate | delta % | verdict |
|---|---:|---:|---:|---|
| step ms (mean) | 4.292 | 4.229 | -1.5 | within noise |
| step ms (p95) | 4.805 | 4.705 | -2.1 | within noise |
| particle-steps/s | 128436 | 130005 | 1.2 | within noise |
| GPU sum ms | 0.997 | 0.989 | -0.8 | within noise |
| pass gridClear | 0.026 | 0.025 | -3.5 | within noise |
| pass gridBuild | 0.016 | 0.015 | -4.2 | within noise |
| pass chargeProcess | 0.020 | 0.019 | -3.3 | within noise |
| pass chargeFinalize | 0.015 | 0.016 | 8.6 | within noise |
| pass pressure | 0.010 | 0.010 | 5.0 | within noise |
| pass communicationSelect | 0.018 | 0.019 | 6.0 | within noise |
| pass communicationTransmit | 0.018 | 0.018 | 3.4 | within noise |
| pass localSuccess | 0.018 | 0.016 | -7.7 | within noise |
| pass healthUpdate | 0.018 | 0.018 | -3.0 | within noise |
| pass sortCount | 0.022 | 0.021 | -5.3 | within noise |
| pass sortScan | 0.046 | 0.046 | -1.1 | within noise |
| pass sortScatter | 0.037 | 0.036 | -1.9 | within noise |
| pass force | 0.610 | 0.615 | 0.8 | within noise |
| pass mechanics | 0.021 | 0.020 | -4.7 | within noise |
| pass deathCompaction | 0.098 | 0.098 | -0.2 | within noise |

### N = 2000  (5 baseline / 5 candidate rounds, medians)

| metric | baseline | candidate | delta % | verdict |
|---|---:|---:|---:|---|
| step ms (mean) | 4.244 | 4.106 | -3.3 | within noise |
| step ms (p95) | 4.805 | 4.810 | 0.1 | within noise |
| particle-steps/s | 259707 | 268097 | 3.2 | within noise |
| GPU sum ms | 1.054 | 1.048 | -0.6 | within noise |
| pass gridClear | 0.027 | 0.025 | -6.9 | within noise |
| pass gridBuild | 0.018 | 0.016 | -11.1 | within noise |
| pass chargeProcess | 0.022 | 0.022 | 0.2 | within noise |
| pass chargeFinalize | 0.018 | 0.018 | -3.3 | within noise |
| pass pressure | 0.009 | 0.009 | 1.0 | within noise |
| pass communicationSelect | 0.019 | 0.021 | 5.6 | within noise |
| pass communicationTransmit | 0.018 | 0.019 | 4.2 | within noise |
| pass localSuccess | 0.017 | 0.017 | -2.9 | within noise |
| pass healthUpdate | 0.019 | 0.019 | -2.2 | within noise |
| pass sortCount | 0.022 | 0.021 | -4.2 | within noise |
| pass sortScan | 0.045 | 0.045 | -1.2 | within noise |
| pass sortScatter | 0.044 | 0.043 | -1.6 | within noise |
| pass force | 0.592 | 0.592 | 0.0 | within noise |
| pass mechanics | 0.025 | 0.025 | -2.7 | within noise |
| pass deathCompaction | 0.155 | 0.155 | 0.3 | within noise |

### N = 5000  (5 baseline / 5 candidate rounds, medians)

| metric | baseline | candidate | delta % | verdict |
|---|---:|---:|---:|---|
| step ms (mean) | 4.584 | 4.416 | -3.7 | within noise |
| step ms (p95) | 5.800 | 5.210 | -10.2 | within noise |
| particle-steps/s | 625391 | 644662 | 3.1 | within noise |
| GPU sum ms | 1.544 | 1.547 | 0.2 | within noise |
| pass gridClear | 0.027 | 0.025 | -6.6 | within noise |
| pass gridBuild | 0.034 | 0.034 | 0.6 | within noise |
| pass chargeProcess | 0.032 | 0.034 | 6.9 | higher (beyond noise) |
| pass chargeFinalize | 0.017 | 0.020 | 14.2 | within noise |
| pass pressure | 0.007 | 0.007 | 2.0 | within noise |
| pass communicationSelect | 0.024 | 0.022 | -7.6 | within noise |
| pass communicationTransmit | 0.022 | 0.021 | -2.4 | within noise |
| pass localSuccess | 0.020 | 0.018 | -6.2 | within noise |
| pass healthUpdate | 0.026 | 0.026 | -0.6 | within noise |
| pass sortCount | 0.033 | 0.033 | -0.5 | within noise |
| pass sortScan | 0.046 | 0.045 | -2.8 | within noise |
| pass sortScatter | 0.071 | 0.071 | -0.2 | within noise |
| pass force | 0.829 | 0.830 | 0.2 | within noise |
| pass mechanics | 0.039 | 0.038 | -2.5 | within noise |
| pass deathCompaction | 0.313 | 0.314 | 0.2 | within noise |

### N = 10000  (5 baseline / 5 candidate rounds, medians)

| metric | baseline | candidate | delta % | verdict |
|---|---:|---:|---:|---|
| step ms (mean) | 6.270 | 6.321 | 0.8 | within noise |
| step ms (p95) | 7.600 | 7.405 | -2.6 | within noise |
| particle-steps/s | 1040366 | 1021346 | -1.8 | within noise |
| GPU sum ms | 2.733 | 2.729 | -0.1 | within noise |
| pass gridClear | 0.027 | 0.026 | -1.2 | within noise |
| pass gridBuild | 0.058 | 0.059 | 2.3 | within noise |
| pass chargeProcess | 0.039 | 0.040 | 4.1 | within noise |
| pass chargeFinalize | 0.027 | 0.026 | -3.0 | within noise |
| pass pressure | 0.007 | 0.007 | 1.9 | within noise |
| pass communicationSelect | 0.026 | 0.025 | -1.4 | within noise |
| pass communicationTransmit | 0.025 | 0.025 | -2.4 | within noise |
| pass localSuccess | 0.022 | 0.022 | 1.1 | within noise |
| pass healthUpdate | 0.038 | 0.037 | -0.3 | within noise |
| pass sortCount | 0.044 | 0.044 | -0.5 | within noise |
| pass sortScan | 0.045 | 0.046 | 1.7 | within noise |
| pass sortScatter | 0.107 | 0.109 | 1.7 | within noise |
| pass force | 1.620 | 1.604 | -1.0 | within noise |
| pass mechanics | 0.065 | 0.066 | 2.0 | within noise |
| pass deathCompaction | 0.586 | 0.592 | 1.1 | within noise |

## ab-death vs ab-base  [variant: renderDisabled]  (kernels: {"deathCompaction":"blocked"}; rounds 5 vs 5)

### N = 200  (5 baseline / 5 candidate rounds, medians)

| metric | baseline | candidate | delta % | verdict |
|---|---:|---:|---:|---|
| step ms (mean) | 4.190 | 4.185 | -0.1 | within noise |
| step ms (p95) | 4.905 | 4.610 | -6.0 | within noise |
| particle-steps/s | 25924 | 26199 | 1.1 | within noise |
| GPU sum ms | 0.590 | 0.575 | -2.5 | within noise |
| pass gridClear | 0.027 | 0.026 | -2.1 | within noise |
| pass gridBuild | 0.016 | 0.015 | -1.8 | within noise |
| pass chargeProcess | 0.019 | 0.019 | -3.7 | within noise |
| pass chargeFinalize | 0.014 | 0.014 | -4.1 | within noise |
| pass pressure | 0.008 | 0.009 | 9.7 | within noise |
| pass communicationSelect | 0.018 | 0.017 | -6.0 | within noise |
| pass communicationTransmit | 0.018 | 0.018 | 0.2 | within noise |
| pass localSuccess | 0.017 | 0.016 | -3.5 | within noise |
| pass healthUpdate | 0.018 | 0.017 | -7.4 | within noise |
| pass sortCount | 0.022 | 0.023 | 5.5 | within noise |
| pass sortScan | 0.047 | 0.046 | -1.5 | within noise |
| pass sortScatter | 0.033 | 0.033 | 1.1 | within noise |
| pass force | 0.260 | 0.258 | -0.6 | within noise |
| pass mechanics | 0.016 | 0.016 | -1.2 | within noise |
| pass deathCompaction | 0.058 | 0.051 | -10.9 | lower (beyond noise) |

### N = 500  (5 baseline / 5 candidate rounds, medians)

| metric | baseline | candidate | delta % | verdict |
|---|---:|---:|---:|---|
| step ms (mean) | 4.061 | 4.250 | 4.7 | within noise |
| step ms (p95) | 5.005 | 5.800 | 15.9 | within noise |
| particle-steps/s | 70225 | 67304 | -4.2 | within noise |
| GPU sum ms | 0.921 | 0.893 | -3.0 | within noise |
| pass gridClear | 0.026 | 0.025 | -1.5 | within noise |
| pass gridBuild | 0.014 | 0.014 | 1.2 | within noise |
| pass chargeProcess | 0.017 | 0.018 | 3.0 | within noise |
| pass chargeFinalize | 0.013 | 0.013 | 1.5 | within noise |
| pass pressure | 0.007 | 0.007 | 3.9 | within noise |
| pass communicationSelect | 0.018 | 0.018 | 3.2 | within noise |
| pass communicationTransmit | 0.017 | 0.019 | 7.7 | within noise |
| pass localSuccess | 0.016 | 0.015 | -0.8 | within noise |
| pass healthUpdate | 0.015 | 0.015 | 0.4 | within noise |
| pass sortCount | 0.020 | 0.020 | 0.0 | within noise |
| pass sortScan | 0.042 | 0.042 | -0.8 | within noise |
| pass sortScatter | 0.032 | 0.033 | 1.9 | within noise |
| pass force | 0.591 | 0.590 | -0.1 | within noise |
| pass mechanics | 0.016 | 0.016 | -1.4 | within noise |
| pass deathCompaction | 0.074 | 0.050 | -32.2 | lower (beyond noise) |

### N = 1000  (5 baseline / 5 candidate rounds, medians)

| metric | baseline | candidate | delta % | verdict |
|---|---:|---:|---:|---|
| step ms (mean) | 4.292 | 4.333 | 1.0 | within noise |
| step ms (p95) | 4.805 | 5.515 | 14.8 | within noise |
| particle-steps/s | 128436 | 128304 | -0.1 | within noise |
| GPU sum ms | 0.997 | 0.961 | -3.6 | lower (beyond noise) |
| pass gridClear | 0.026 | 0.026 | -0.9 | within noise |
| pass gridBuild | 0.016 | 0.016 | -2.6 | within noise |
| pass chargeProcess | 0.020 | 0.020 | 2.6 | within noise |
| pass chargeFinalize | 0.015 | 0.015 | -1.4 | within noise |
| pass pressure | 0.010 | 0.010 | 7.6 | within noise |
| pass communicationSelect | 0.018 | 0.017 | -5.0 | within noise |
| pass communicationTransmit | 0.018 | 0.018 | 2.8 | within noise |
| pass localSuccess | 0.018 | 0.018 | 0.2 | within noise |
| pass healthUpdate | 0.018 | 0.019 | 3.7 | within noise |
| pass sortCount | 0.022 | 0.022 | -0.1 | within noise |
| pass sortScan | 0.046 | 0.045 | -1.7 | within noise |
| pass sortScatter | 0.037 | 0.036 | -2.0 | within noise |
| pass force | 0.610 | 0.611 | 0.2 | within noise |
| pass mechanics | 0.021 | 0.021 | -1.6 | within noise |
| pass deathCompaction | 0.098 | 0.056 | -43.5 | lower (beyond noise) |

### N = 2000  (5 baseline / 5 candidate rounds, medians)

| metric | baseline | candidate | delta % | verdict |
|---|---:|---:|---:|---|
| step ms (mean) | 4.244 | 4.302 | 1.4 | within noise |
| step ms (p95) | 4.805 | 5.100 | 6.1 | within noise |
| particle-steps/s | 259707 | 257666 | -0.8 | within noise |
| GPU sum ms | 1.054 | 0.962 | -8.8 | lower (beyond noise) |
| pass gridClear | 0.027 | 0.026 | -1.5 | within noise |
| pass gridBuild | 0.018 | 0.017 | -5.2 | within noise |
| pass chargeProcess | 0.022 | 0.022 | 0.4 | within noise |
| pass chargeFinalize | 0.018 | 0.018 | -1.3 | within noise |
| pass pressure | 0.009 | 0.009 | -0.4 | within noise |
| pass communicationSelect | 0.019 | 0.019 | -2.4 | within noise |
| pass communicationTransmit | 0.018 | 0.020 | 8.4 | within noise |
| pass localSuccess | 0.017 | 0.019 | 6.7 | within noise |
| pass healthUpdate | 0.019 | 0.020 | 4.8 | within noise |
| pass sortCount | 0.022 | 0.023 | 7.5 | within noise |
| pass sortScan | 0.045 | 0.047 | 2.6 | within noise |
| pass sortScatter | 0.044 | 0.044 | 0.5 | within noise |
| pass force | 0.592 | 0.589 | -0.4 | within noise |
| pass mechanics | 0.025 | 0.026 | 1.2 | within noise |
| pass deathCompaction | 0.155 | 0.061 | -60.5 | lower (beyond noise) |

### N = 5000  (5 baseline / 5 candidate rounds, medians)

| metric | baseline | candidate | delta % | verdict |
|---|---:|---:|---:|---|
| step ms (mean) | 4.584 | 4.831 | 5.4 | within noise |
| step ms (p95) | 5.800 | 6.300 | 8.6 | within noise |
| particle-steps/s | 625391 | 605327 | -3.2 | within noise |
| GPU sum ms | 1.544 | 1.308 | -15.3 | lower (beyond noise) |
| pass gridClear | 0.027 | 0.027 | 0.9 | within noise |
| pass gridBuild | 0.034 | 0.034 | 0.2 | within noise |
| pass chargeProcess | 0.032 | 0.034 | 5.5 | within noise |
| pass chargeFinalize | 0.017 | 0.017 | -0.6 | within noise |
| pass pressure | 0.007 | 0.007 | -0.1 | within noise |
| pass communicationSelect | 0.024 | 0.023 | -4.3 | within noise |
| pass communicationTransmit | 0.022 | 0.021 | -3.7 | within noise |
| pass localSuccess | 0.020 | 0.020 | 0.4 | within noise |
| pass healthUpdate | 0.026 | 0.028 | 6.5 | within noise |
| pass sortCount | 0.033 | 0.033 | -0.7 | within noise |
| pass sortScan | 0.046 | 0.046 | 0.1 | within noise |
| pass sortScatter | 0.071 | 0.071 | 0.2 | within noise |
| pass force | 0.829 | 0.829 | -0.1 | within noise |
| pass mechanics | 0.039 | 0.039 | -1.5 | within noise |
| pass deathCompaction | 0.313 | 0.077 | -75.5 | lower (beyond noise) |

### N = 10000  (5 baseline / 5 candidate rounds, medians)

| metric | baseline | candidate | delta % | verdict |
|---|---:|---:|---:|---|
| step ms (mean) | 6.270 | 6.441 | 2.7 | within noise |
| step ms (p95) | 7.600 | 7.210 | -5.1 | within noise |
| particle-steps/s | 1040366 | 1006036 | -3.3 | within noise |
| GPU sum ms | 2.733 | 2.262 | -17.2 | lower (beyond noise) |
| pass gridClear | 0.027 | 0.026 | -0.9 | within noise |
| pass gridBuild | 0.058 | 0.056 | -3.2 | within noise |
| pass chargeProcess | 0.039 | 0.038 | -2.4 | within noise |
| pass chargeFinalize | 0.027 | 0.028 | 6.1 | within noise |
| pass pressure | 0.007 | 0.007 | 0.1 | within noise |
| pass communicationSelect | 0.026 | 0.026 | 1.0 | within noise |
| pass communicationTransmit | 0.025 | 0.024 | -4.0 | within noise |
| pass localSuccess | 0.022 | 0.022 | -2.1 | within noise |
| pass healthUpdate | 0.038 | 0.037 | -0.4 | within noise |
| pass sortCount | 0.044 | 0.044 | -1.1 | within noise |
| pass sortScan | 0.045 | 0.045 | -0.3 | within noise |
| pass sortScatter | 0.107 | 0.107 | -0.8 | within noise |
| pass force | 1.620 | 1.625 | 0.3 | within noise |
| pass mechanics | 0.065 | 0.064 | -0.7 | within noise |
| pass deathCompaction | 0.586 | 0.106 | -81.9 | lower (beyond noise) |

## ab-both vs ab-base  [variant: renderDisabled]  (kernels: {"deathCompaction":"blocked"}; rounds 5 vs 5)

### N = 200  (5 baseline / 5 candidate rounds, medians)

| metric | baseline | candidate | delta % | verdict |
|---|---:|---:|---:|---|
| step ms (mean) | 4.190 | 4.121 | -1.6 | within noise |
| step ms (p95) | 4.905 | 4.705 | -4.1 | within noise |
| particle-steps/s | 25924 | 26427 | 1.9 | within noise |
| GPU sum ms | 0.590 | 0.582 | -1.4 | within noise |
| pass gridClear | 0.027 | 0.026 | -1.2 | within noise |
| pass gridBuild | 0.016 | 0.015 | -4.1 | within noise |
| pass chargeProcess | 0.019 | 0.019 | -0.8 | within noise |
| pass chargeFinalize | 0.014 | 0.014 | -1.7 | within noise |
| pass pressure | 0.008 | 0.009 | 11.3 | within noise |
| pass communicationSelect | 0.018 | 0.017 | -3.1 | within noise |
| pass communicationTransmit | 0.018 | 0.017 | -3.4 | within noise |
| pass localSuccess | 0.017 | 0.017 | -1.8 | within noise |
| pass healthUpdate | 0.018 | 0.016 | -12.4 | within noise |
| pass sortCount | 0.022 | 0.021 | -2.9 | within noise |
| pass sortScan | 0.047 | 0.047 | -0.1 | within noise |
| pass sortScatter | 0.033 | 0.033 | -0.3 | within noise |
| pass force | 0.260 | 0.257 | -0.8 | within noise |
| pass mechanics | 0.016 | 0.016 | -2.4 | within noise |
| pass deathCompaction | 0.058 | 0.052 | -10.5 | lower (beyond noise) |

### N = 500  (5 baseline / 5 candidate rounds, medians)

| metric | baseline | candidate | delta % | verdict |
|---|---:|---:|---:|---|
| step ms (mean) | 4.061 | 4.137 | 1.9 | within noise |
| step ms (p95) | 5.005 | 5.265 | 5.2 | within noise |
| particle-steps/s | 70225 | 69367 | -1.2 | within noise |
| GPU sum ms | 0.921 | 0.887 | -3.7 | lower (beyond noise) |
| pass gridClear | 0.026 | 0.025 | -4.3 | within noise |
| pass gridBuild | 0.014 | 0.014 | 1.4 | within noise |
| pass chargeProcess | 0.017 | 0.017 | -1.3 | within noise |
| pass chargeFinalize | 0.013 | 0.013 | -1.6 | within noise |
| pass pressure | 0.007 | 0.007 | 0.8 | within noise |
| pass communicationSelect | 0.018 | 0.016 | -6.3 | within noise |
| pass communicationTransmit | 0.017 | 0.016 | -8.6 | within noise |
| pass localSuccess | 0.016 | 0.015 | -0.5 | within noise |
| pass healthUpdate | 0.015 | 0.015 | -1.0 | within noise |
| pass sortCount | 0.020 | 0.019 | -1.4 | within noise |
| pass sortScan | 0.042 | 0.041 | -2.7 | within noise |
| pass sortScatter | 0.032 | 0.032 | -0.6 | within noise |
| pass force | 0.591 | 0.585 | -0.9 | within noise |
| pass mechanics | 0.016 | 0.016 | -1.9 | within noise |
| pass deathCompaction | 0.074 | 0.049 | -33.2 | lower (beyond noise) |

### N = 1000  (5 baseline / 5 candidate rounds, medians)

| metric | baseline | candidate | delta % | verdict |
|---|---:|---:|---:|---|
| step ms (mean) | 4.292 | 4.277 | -0.3 | within noise |
| step ms (p95) | 4.805 | 4.800 | -0.1 | within noise |
| particle-steps/s | 128436 | 127681 | -0.6 | within noise |
| GPU sum ms | 0.997 | 0.956 | -4.1 | lower (beyond noise) |
| pass gridClear | 0.026 | 0.027 | 2.4 | within noise |
| pass gridBuild | 0.016 | 0.016 | -0.6 | within noise |
| pass chargeProcess | 0.020 | 0.020 | 2.8 | within noise |
| pass chargeFinalize | 0.015 | 0.016 | 7.4 | within noise |
| pass pressure | 0.010 | 0.010 | 7.9 | within noise |
| pass communicationSelect | 0.018 | 0.018 | -2.3 | within noise |
| pass communicationTransmit | 0.018 | 0.019 | 5.7 | within noise |
| pass localSuccess | 0.018 | 0.018 | -0.3 | within noise |
| pass healthUpdate | 0.018 | 0.018 | 0.0 | within noise |
| pass sortCount | 0.022 | 0.023 | 5.9 | within noise |
| pass sortScan | 0.046 | 0.046 | -0.7 | within noise |
| pass sortScatter | 0.037 | 0.037 | 1.2 | within noise |
| pass force | 0.610 | 0.609 | -0.1 | within noise |
| pass mechanics | 0.021 | 0.021 | 0.2 | within noise |
| pass deathCompaction | 0.098 | 0.057 | -42.0 | lower (beyond noise) |

### N = 2000  (5 baseline / 5 candidate rounds, medians)

| metric | baseline | candidate | delta % | verdict |
|---|---:|---:|---:|---|
| step ms (mean) | 4.244 | 4.324 | 1.9 | within noise |
| step ms (p95) | 4.805 | 4.800 | -0.1 | within noise |
| particle-steps/s | 259707 | 251509 | -3.2 | within noise |
| GPU sum ms | 1.054 | 0.957 | -9.3 | lower (beyond noise) |
| pass gridClear | 0.027 | 0.026 | -1.6 | within noise |
| pass gridBuild | 0.018 | 0.018 | -1.5 | within noise |
| pass chargeProcess | 0.022 | 0.022 | 1.9 | within noise |
| pass chargeFinalize | 0.018 | 0.017 | -5.8 | within noise |
| pass pressure | 0.009 | 0.008 | -8.4 | within noise |
| pass communicationSelect | 0.019 | 0.020 | 1.5 | within noise |
| pass communicationTransmit | 0.018 | 0.019 | 6.3 | within noise |
| pass localSuccess | 0.017 | 0.019 | 7.0 | within noise |
| pass healthUpdate | 0.019 | 0.020 | 2.7 | within noise |
| pass sortCount | 0.022 | 0.022 | 0.5 | within noise |
| pass sortScan | 0.045 | 0.045 | -0.4 | within noise |
| pass sortScatter | 0.044 | 0.045 | 1.8 | within noise |
| pass force | 0.592 | 0.590 | -0.3 | within noise |
| pass mechanics | 0.025 | 0.026 | 1.6 | within noise |
| pass deathCompaction | 0.155 | 0.061 | -60.6 | lower (beyond noise) |

### N = 5000  (5 baseline / 5 candidate rounds, medians)

| metric | baseline | candidate | delta % | verdict |
|---|---:|---:|---:|---|
| step ms (mean) | 4.584 | 4.555 | -0.6 | within noise |
| step ms (p95) | 5.800 | 5.405 | -6.8 | within noise |
| particle-steps/s | 625391 | 619732 | -0.9 | within noise |
| GPU sum ms | 1.544 | 1.313 | -15.0 | lower (beyond noise) |
| pass gridClear | 0.027 | 0.027 | -0.0 | within noise |
| pass gridBuild | 0.034 | 0.035 | 3.0 | within noise |
| pass chargeProcess | 0.032 | 0.033 | 3.8 | within noise |
| pass chargeFinalize | 0.017 | 0.018 | 2.5 | within noise |
| pass pressure | 0.007 | 0.007 | 2.2 | within noise |
| pass communicationSelect | 0.024 | 0.023 | -1.0 | within noise |
| pass communicationTransmit | 0.022 | 0.022 | 1.1 | within noise |
| pass localSuccess | 0.020 | 0.020 | 3.8 | within noise |
| pass healthUpdate | 0.026 | 0.029 | 8.9 | within noise |
| pass sortCount | 0.033 | 0.033 | -0.9 | within noise |
| pass sortScan | 0.046 | 0.046 | -1.4 | within noise |
| pass sortScatter | 0.071 | 0.073 | 1.8 | within noise |
| pass force | 0.829 | 0.832 | 0.3 | within noise |
| pass mechanics | 0.039 | 0.038 | -2.5 | within noise |
| pass deathCompaction | 0.313 | 0.076 | -75.6 | lower (beyond noise) |

### N = 10000  (5 baseline / 5 candidate rounds, medians)

| metric | baseline | candidate | delta % | verdict |
|---|---:|---:|---:|---|
| step ms (mean) | 6.270 | 6.493 | 3.6 | within noise |
| step ms (p95) | 7.600 | 7.505 | -1.2 | within noise |
| particle-steps/s | 1040366 | 997407 | -4.1 | within noise |
| GPU sum ms | 2.733 | 2.269 | -17.0 | lower (beyond noise) |
| pass gridClear | 0.027 | 0.027 | 0.3 | within noise |
| pass gridBuild | 0.058 | 0.058 | -0.2 | within noise |
| pass chargeProcess | 0.039 | 0.038 | -1.3 | within noise |
| pass chargeFinalize | 0.027 | 0.027 | 0.9 | within noise |
| pass pressure | 0.007 | 0.007 | -1.6 | within noise |
| pass communicationSelect | 0.026 | 0.027 | 6.5 | within noise |
| pass communicationTransmit | 0.025 | 0.026 | 3.3 | within noise |
| pass localSuccess | 0.022 | 0.022 | 1.2 | within noise |
| pass healthUpdate | 0.038 | 0.037 | -0.6 | within noise |
| pass sortCount | 0.044 | 0.044 | 0.7 | within noise |
| pass sortScan | 0.045 | 0.046 | 2.4 | within noise |
| pass sortScatter | 0.107 | 0.109 | 1.9 | within noise |
| pass force | 1.620 | 1.624 | 0.3 | within noise |
| pass mechanics | 0.065 | 0.064 | -0.1 | within noise |
| pass deathCompaction | 0.586 | 0.105 | -82.0 | lower (beyond noise) |
