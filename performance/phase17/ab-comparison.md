## ab-death-parallel vs ab-baseline  [variant: baseline]  (kernels: {"deathCompaction":"parallel"}; rounds 5 vs 5)

### N = 200  (5 baseline / 5 candidate rounds, medians)

| metric | baseline | candidate | delta % | verdict |
|---|---:|---:|---:|---|
| step ms (mean) | 5.199 | 4.951 | -4.8 | within noise |
| step ms (p95) | 6.605 | 6.205 | -6.1 | within noise |
| particle-steps/s | 23733 | 24546 | 3.4 | within noise |
| GPU sum ms | 0.722 | 0.567 | -21.5 | lower (beyond noise) |
| pass gridClear | 0.025 | 0.024 | -1.0 | within noise |
| pass gridBuild | 0.011 | 0.011 | 0.2 | within noise |
| pass chargeProcess | 0.017 | 0.016 | -0.1 | within noise |
| pass chargeFinalize | 0.012 | 0.012 | 0.1 | within noise |
| pass pressure | 0.007 | 0.007 | -0.3 | within noise |
| pass communicationSelect | 0.015 | 0.015 | 2.1 | within noise |
| pass communicationTransmit | 0.016 | 0.016 | 0.2 | within noise |
| pass localSuccess | 0.015 | 0.015 | 1.1 | within noise |
| pass healthUpdate | 0.014 | 0.014 | 0.9 | within noise |
| pass force | 0.367 | 0.366 | -0.4 | within noise |
| pass mechanics | 0.015 | 0.015 | -1.2 | within noise |
| pass deathCompaction | 0.208 | 0.052 | -75.0 | lower (beyond noise) |

### N = 500  (5 baseline / 5 candidate rounds, medians)

| metric | baseline | candidate | delta % | verdict |
|---|---:|---:|---:|---|
| step ms (mean) | 7.432 | 6.774 | -8.9 | within noise |
| step ms (p95) | 9.325 | 8.910 | -4.5 | within noise |
| particle-steps/s | 45310 | 46275 | 2.1 | within noise |
| GPU sum ms | 1.584 | 1.166 | -26.4 | lower (beyond noise) |
| pass gridClear | 0.025 | 0.025 | -0.0 | within noise |
| pass gridBuild | 0.011 | 0.011 | 0.4 | within noise |
| pass chargeProcess | 0.017 | 0.017 | 0.4 | within noise |
| pass chargeFinalize | 0.012 | 0.012 | -1.0 | within noise |
| pass pressure | 0.006 | 0.006 | 1.2 | within noise |
| pass communicationSelect | 0.016 | 0.016 | 0.7 | within noise |
| pass communicationTransmit | 0.016 | 0.016 | 2.0 | within noise |
| pass localSuccess | 0.015 | 0.015 | 0.4 | within noise |
| pass healthUpdate | 0.014 | 0.015 | 1.1 | within noise |
| pass force | 0.949 | 0.951 | 0.2 | within noise |
| pass mechanics | 0.016 | 0.016 | -0.8 | within noise |
| pass deathCompaction | 0.481 | 0.065 | -86.5 | lower (beyond noise) |

### N = 1000  (5 baseline / 5 candidate rounds, medians)

| metric | baseline | candidate | delta % | verdict |
|---|---:|---:|---:|---|
| step ms (mean) | 8.840 | 7.571 | -14.4 | within noise |
| step ms (p95) | 11.305 | 9.725 | -14.0 | within noise |
| particle-steps/s | 83340 | 91600 | 9.9 | within noise |
| GPU sum ms | 2.670 | 1.804 | -32.4 | lower (beyond noise) |
| pass gridClear | 0.025 | 0.025 | -0.1 | within noise |
| pass gridBuild | 0.012 | 0.012 | 0.6 | within noise |
| pass chargeProcess | 0.018 | 0.018 | 0.3 | within noise |
| pass chargeFinalize | 0.013 | 0.013 | 1.8 | within noise |
| pass pressure | 0.007 | 0.007 | -4.2 | within noise |
| pass communicationSelect | 0.017 | 0.017 | 0.2 | within noise |
| pass communicationTransmit | 0.017 | 0.016 | -4.3 | within noise |
| pass localSuccess | 0.016 | 0.016 | 1.4 | within noise |
| pass healthUpdate | 0.016 | 0.016 | -1.6 | within noise |
| pass force | 1.557 | 1.556 | -0.1 | within noise |
| pass mechanics | 0.018 | 0.018 | -1.3 | within noise |
| pass deathCompaction | 0.963 | 0.091 | -90.5 | lower (beyond noise) |

### N = 2000  (5 baseline / 5 candidate rounds, medians)

| metric | baseline | candidate | delta % | verdict |
|---|---:|---:|---:|---|
| step ms (mean) | 12.990 | 11.184 | -13.9 | lower (beyond noise) |
| step ms (p95) | 15.520 | 13.625 | -12.2 | within noise |
| particle-steps/s | 122647 | 139189 | 13.5 | higher (beyond noise) |
| GPU sum ms | 4.025 | 2.268 | -43.7 | lower (beyond noise) |
| pass gridClear | 0.025 | 0.025 | 0.9 | within noise |
| pass gridBuild | 0.014 | 0.013 | -1.9 | within noise |
| pass chargeProcess | 0.020 | 0.020 | -0.7 | within noise |
| pass chargeFinalize | 0.014 | 0.013 | -2.6 | within noise |
| pass pressure | 0.007 | 0.007 | -1.6 | within noise |
| pass communicationSelect | 0.019 | 0.017 | -6.9 | within noise |
| pass communicationTransmit | 0.017 | 0.018 | 3.5 | within noise |
| pass localSuccess | 0.016 | 0.016 | 3.2 | within noise |
| pass healthUpdate | 0.017 | 0.017 | -0.2 | within noise |
| pass force | 1.957 | 1.948 | -0.5 | within noise |
| pass mechanics | 0.024 | 0.024 | 3.3 | within noise |
| pass deathCompaction | 1.896 | 0.149 | -92.1 | lower (beyond noise) |

### N = 5000  (5 baseline / 5 candidate rounds, medians)

| metric | baseline | candidate | delta % | verdict |
|---|---:|---:|---:|---|
| step ms (mean) | 25.586 | 23.645 | -7.6 | within noise |
| step ms (p95) | 29.410 | 37.025 | 25.9 | within noise |
| particle-steps/s | 173112 | 184026 | 6.3 | within noise |
| GPU sum ms | 9.588 | 5.047 | -47.4 | lower (beyond noise) |
| pass gridClear | 0.025 | 0.025 | 1.2 | within noise |
| pass gridBuild | 0.030 | 0.029 | -2.5 | within noise |
| pass chargeProcess | 0.028 | 0.027 | -4.5 | within noise |
| pass chargeFinalize | 0.017 | 0.016 | -1.1 | within noise |
| pass pressure | 0.007 | 0.007 | -1.5 | within noise |
| pass communicationSelect | 0.022 | 0.021 | -2.3 | lower (beyond noise) |
| pass communicationTransmit | 0.020 | 0.020 | -3.7 | within noise |
| pass localSuccess | 0.017 | 0.017 | 1.5 | within noise |
| pass healthUpdate | 0.023 | 0.023 | -2.6 | within noise |
| pass force | 4.585 | 4.519 | -1.4 | within noise |
| pass mechanics | 0.036 | 0.036 | -1.6 | within noise |
| pass deathCompaction | 4.777 | 0.307 | -93.6 | lower (beyond noise) |

### N = 10000  (5 baseline / 5 candidate rounds, medians)

| metric | baseline | candidate | delta % | verdict |
|---|---:|---:|---:|---|
| step ms (mean) | 53.982 | 44.967 | -16.7 | within noise |
| step ms (p95) | 71.130 | 59.340 | -16.6 | within noise |
| particle-steps/s | 167235 | 198918 | 18.9 | within noise |
| GPU sum ms | 19.171 | 10.190 | -46.8 | lower (beyond noise) |
| pass gridClear | 0.026 | 0.026 | 1.6 | within noise |
| pass gridBuild | 0.048 | 0.047 | -2.0 | within noise |
| pass chargeProcess | 0.035 | 0.034 | -1.0 | within noise |
| pass chargeFinalize | 0.023 | 0.022 | -3.0 | within noise |
| pass pressure | 0.007 | 0.006 | -2.0 | within noise |
| pass communicationSelect | 0.023 | 0.024 | 0.8 | within noise |
| pass communicationTransmit | 0.023 | 0.024 | 3.3 | within noise |
| pass localSuccess | 0.020 | 0.020 | -0.7 | within noise |
| pass healthUpdate | 0.033 | 0.032 | -1.1 | within noise |
| pass force | 9.368 | 9.318 | -0.5 | within noise |
| pass mechanics | 0.059 | 0.059 | -1.1 | within noise |
| pass deathCompaction | 9.503 | 0.582 | -93.9 | lower (beyond noise) |

## ab-force-wg32 vs ab-baseline  [variant: baseline]  (kernels: {"forceWorkgroupSize":32}; rounds 5 vs 5)

### N = 200  (5 baseline / 5 candidate rounds, medians)

| metric | baseline | candidate | delta % | verdict |
|---|---:|---:|---:|---|
| step ms (mean) | 5.199 | 5.095 | -2.0 | within noise |
| step ms (p95) | 6.605 | 6.805 | 3.0 | within noise |
| particle-steps/s | 23733 | 24117 | 1.6 | within noise |
| GPU sum ms | 0.722 | 0.715 | -1.0 | within noise |
| pass gridClear | 0.025 | 0.025 | 0.2 | within noise |
| pass gridBuild | 0.011 | 0.011 | 1.5 | within noise |
| pass chargeProcess | 0.017 | 0.017 | 0.1 | within noise |
| pass chargeFinalize | 0.012 | 0.012 | 1.2 | within noise |
| pass pressure | 0.007 | 0.006 | -4.5 | within noise |
| pass communicationSelect | 0.015 | 0.015 | 3.3 | within noise |
| pass communicationTransmit | 0.016 | 0.015 | -4.9 | within noise |
| pass localSuccess | 0.015 | 0.015 | 1.1 | within noise |
| pass healthUpdate | 0.014 | 0.014 | -2.1 | within noise |
| pass force | 0.367 | 0.365 | -0.7 | within noise |
| pass mechanics | 0.015 | 0.015 | -2.8 | lower (beyond noise) |
| pass deathCompaction | 0.208 | 0.206 | -0.9 | within noise |

### N = 500  (5 baseline / 5 candidate rounds, medians)

| metric | baseline | candidate | delta % | verdict |
|---|---:|---:|---:|---|
| step ms (mean) | 7.432 | 6.330 | -14.8 | within noise |
| step ms (p95) | 9.325 | 8.005 | -14.2 | within noise |
| particle-steps/s | 45310 | 50500 | 11.5 | within noise |
| GPU sum ms | 1.584 | 1.572 | -0.8 | within noise |
| pass gridClear | 0.025 | 0.024 | -0.9 | within noise |
| pass gridBuild | 0.011 | 0.011 | 0.7 | within noise |
| pass chargeProcess | 0.017 | 0.017 | -0.8 | within noise |
| pass chargeFinalize | 0.012 | 0.012 | -0.9 | within noise |
| pass pressure | 0.006 | 0.006 | -0.4 | within noise |
| pass communicationSelect | 0.016 | 0.017 | 2.1 | within noise |
| pass communicationTransmit | 0.016 | 0.016 | 1.7 | within noise |
| pass localSuccess | 0.015 | 0.015 | 0.6 | within noise |
| pass healthUpdate | 0.014 | 0.015 | 0.1 | within noise |
| pass force | 0.949 | 0.940 | -0.9 | within noise |
| pass mechanics | 0.016 | 0.016 | -1.3 | within noise |
| pass deathCompaction | 0.481 | 0.481 | -0.1 | within noise |

### N = 1000  (5 baseline / 5 candidate rounds, medians)

| metric | baseline | candidate | delta % | verdict |
|---|---:|---:|---:|---|
| step ms (mean) | 8.840 | 9.346 | 5.7 | within noise |
| step ms (p95) | 11.305 | 11.700 | 3.5 | within noise |
| particle-steps/s | 83340 | 78070 | -6.3 | within noise |
| GPU sum ms | 2.670 | 2.657 | -0.5 | within noise |
| pass gridClear | 0.025 | 0.024 | -1.0 | within noise |
| pass gridBuild | 0.012 | 0.012 | 1.0 | within noise |
| pass chargeProcess | 0.018 | 0.018 | -1.7 | within noise |
| pass chargeFinalize | 0.013 | 0.013 | -1.1 | within noise |
| pass pressure | 0.007 | 0.006 | -7.2 | within noise |
| pass communicationSelect | 0.017 | 0.016 | -3.9 | within noise |
| pass communicationTransmit | 0.017 | 0.016 | -2.6 | within noise |
| pass localSuccess | 0.016 | 0.015 | -2.1 | within noise |
| pass healthUpdate | 0.016 | 0.016 | -1.7 | within noise |
| pass force | 1.557 | 1.549 | -0.5 | within noise |
| pass mechanics | 0.018 | 0.018 | -2.4 | within noise |
| pass deathCompaction | 0.963 | 0.956 | -0.7 | within noise |

### N = 2000  (5 baseline / 5 candidate rounds, medians)

| metric | baseline | candidate | delta % | verdict |
|---|---:|---:|---:|---|
| step ms (mean) | 12.990 | 14.371 | 10.6 | within noise |
| step ms (p95) | 15.520 | 24.105 | 55.3 | within noise |
| particle-steps/s | 122647 | 111161 | -9.4 | within noise |
| GPU sum ms | 4.025 | 4.028 | 0.1 | within noise |
| pass gridClear | 0.025 | 0.025 | -0.7 | within noise |
| pass gridBuild | 0.014 | 0.013 | -1.1 | within noise |
| pass chargeProcess | 0.020 | 0.020 | -1.3 | within noise |
| pass chargeFinalize | 0.014 | 0.014 | -0.3 | within noise |
| pass pressure | 0.007 | 0.006 | -5.7 | within noise |
| pass communicationSelect | 0.019 | 0.017 | -10.6 | within noise |
| pass communicationTransmit | 0.017 | 0.017 | -1.9 | within noise |
| pass localSuccess | 0.016 | 0.016 | -0.2 | within noise |
| pass healthUpdate | 0.017 | 0.017 | -1.7 | within noise |
| pass force | 1.957 | 1.962 | 0.3 | within noise |
| pass mechanics | 0.024 | 0.024 | 0.6 | within noise |
| pass deathCompaction | 1.896 | 1.903 | 0.4 | within noise |

### N = 5000  (5 baseline / 5 candidate rounds, medians)

| metric | baseline | candidate | delta % | verdict |
|---|---:|---:|---:|---|
| step ms (mean) | 25.586 | 26.069 | 1.9 | within noise |
| step ms (p95) | 29.410 | 29.645 | 0.8 | within noise |
| particle-steps/s | 173112 | 168175 | -2.9 | within noise |
| GPU sum ms | 9.588 | 9.460 | -1.3 | within noise |
| pass gridClear | 0.025 | 0.026 | 2.0 | within noise |
| pass gridBuild | 0.030 | 0.030 | 0.5 | within noise |
| pass chargeProcess | 0.028 | 0.027 | -5.0 | within noise |
| pass chargeFinalize | 0.017 | 0.016 | -0.6 | within noise |
| pass pressure | 0.007 | 0.007 | -0.6 | within noise |
| pass communicationSelect | 0.022 | 0.021 | -2.5 | within noise |
| pass communicationTransmit | 0.020 | 0.019 | -5.6 | within noise |
| pass localSuccess | 0.017 | 0.016 | -1.4 | within noise |
| pass healthUpdate | 0.023 | 0.023 | -3.4 | within noise |
| pass force | 4.585 | 4.533 | -1.1 | within noise |
| pass mechanics | 0.036 | 0.036 | -0.1 | within noise |
| pass deathCompaction | 4.777 | 4.711 | -1.4 | within noise |

### N = 10000  (5 baseline / 5 candidate rounds, medians)

| metric | baseline | candidate | delta % | verdict |
|---|---:|---:|---:|---|
| step ms (mean) | 53.982 | 53.944 | -0.1 | within noise |
| step ms (p95) | 71.130 | 69.120 | -2.8 | within noise |
| particle-steps/s | 167235 | 164968 | -1.4 | within noise |
| GPU sum ms | 19.171 | 19.026 | -0.8 | within noise |
| pass gridClear | 0.026 | 0.026 | 1.0 | within noise |
| pass gridBuild | 0.048 | 0.048 | -0.7 | within noise |
| pass chargeProcess | 0.035 | 0.034 | -1.4 | within noise |
| pass chargeFinalize | 0.023 | 0.022 | -2.1 | within noise |
| pass pressure | 0.007 | 0.006 | -4.3 | within noise |
| pass communicationSelect | 0.023 | 0.023 | -0.4 | within noise |
| pass communicationTransmit | 0.023 | 0.023 | 1.7 | within noise |
| pass localSuccess | 0.020 | 0.020 | -2.2 | within noise |
| pass healthUpdate | 0.033 | 0.033 | 0.1 | within noise |
| pass force | 9.368 | 9.331 | -0.4 | within noise |
| pass mechanics | 0.059 | 0.059 | -1.0 | within noise |
| pass deathCompaction | 9.503 | 9.429 | -0.8 | within noise |

## ab-force-wg64 vs ab-baseline  [variant: baseline]  (kernels: {"forceWorkgroupSize":64}; rounds 5 vs 5)

### N = 200  (5 baseline / 5 candidate rounds, medians)

| metric | baseline | candidate | delta % | verdict |
|---|---:|---:|---:|---|
| step ms (mean) | 5.199 | 5.103 | -1.8 | within noise |
| step ms (p95) | 6.605 | 6.700 | 1.4 | within noise |
| particle-steps/s | 23733 | 24012 | 1.2 | within noise |
| GPU sum ms | 0.722 | 0.713 | -1.3 | within noise |
| pass gridClear | 0.025 | 0.024 | -1.0 | within noise |
| pass gridBuild | 0.011 | 0.011 | -2.3 | within noise |
| pass chargeProcess | 0.017 | 0.016 | -1.2 | within noise |
| pass chargeFinalize | 0.012 | 0.012 | -0.7 | within noise |
| pass pressure | 0.007 | 0.006 | -6.9 | within noise |
| pass communicationSelect | 0.015 | 0.015 | 1.2 | within noise |
| pass communicationTransmit | 0.016 | 0.015 | -4.4 | within noise |
| pass localSuccess | 0.015 | 0.015 | -0.1 | within noise |
| pass healthUpdate | 0.014 | 0.014 | -0.1 | within noise |
| pass force | 0.367 | 0.364 | -1.0 | within noise |
| pass mechanics | 0.015 | 0.015 | -1.2 | within noise |
| pass deathCompaction | 0.208 | 0.206 | -0.7 | within noise |

### N = 500  (5 baseline / 5 candidate rounds, medians)

| metric | baseline | candidate | delta % | verdict |
|---|---:|---:|---:|---|
| step ms (mean) | 7.432 | 6.433 | -13.4 | within noise |
| step ms (p95) | 9.325 | 8.405 | -9.9 | within noise |
| particle-steps/s | 45310 | 49875 | 10.1 | within noise |
| GPU sum ms | 1.584 | 1.595 | 0.7 | within noise |
| pass gridClear | 0.025 | 0.024 | -1.0 | within noise |
| pass gridBuild | 0.011 | 0.011 | 0.2 | within noise |
| pass chargeProcess | 0.017 | 0.017 | -2.4 | within noise |
| pass chargeFinalize | 0.012 | 0.012 | -0.0 | within noise |
| pass pressure | 0.006 | 0.006 | -1.6 | within noise |
| pass communicationSelect | 0.016 | 0.017 | 5.8 | within noise |
| pass communicationTransmit | 0.016 | 0.016 | 0.6 | within noise |
| pass localSuccess | 0.015 | 0.015 | 1.3 | within noise |
| pass healthUpdate | 0.014 | 0.014 | -0.4 | within noise |
| pass force | 0.949 | 0.959 | 1.0 | within noise |
| pass mechanics | 0.016 | 0.016 | -1.6 | within noise |
| pass deathCompaction | 0.481 | 0.488 | 1.4 | within noise |

### N = 1000  (5 baseline / 5 candidate rounds, medians)

| metric | baseline | candidate | delta % | verdict |
|---|---:|---:|---:|---|
| step ms (mean) | 8.840 | 8.410 | -4.9 | within noise |
| step ms (p95) | 11.305 | 10.500 | -7.1 | within noise |
| particle-steps/s | 83340 | 85881 | 3.0 | within noise |
| GPU sum ms | 2.670 | 2.696 | 1.0 | within noise |
| pass gridClear | 0.025 | 0.025 | 0.7 | within noise |
| pass gridBuild | 0.012 | 0.012 | -0.0 | within noise |
| pass chargeProcess | 0.018 | 0.018 | 1.4 | within noise |
| pass chargeFinalize | 0.013 | 0.013 | 0.1 | within noise |
| pass pressure | 0.007 | 0.007 | -5.6 | within noise |
| pass communicationSelect | 0.017 | 0.017 | 1.9 | within noise |
| pass communicationTransmit | 0.017 | 0.017 | 2.1 | within noise |
| pass localSuccess | 0.016 | 0.016 | -0.3 | within noise |
| pass healthUpdate | 0.016 | 0.016 | -0.0 | within noise |
| pass force | 1.557 | 1.571 | 0.9 | within noise |
| pass mechanics | 0.018 | 0.018 | -2.2 | within noise |
| pass deathCompaction | 0.963 | 0.960 | -0.3 | within noise |

### N = 2000  (5 baseline / 5 candidate rounds, medians)

| metric | baseline | candidate | delta % | verdict |
|---|---:|---:|---:|---|
| step ms (mean) | 12.990 | 13.022 | 0.2 | within noise |
| step ms (p95) | 15.520 | 15.410 | -0.7 | within noise |
| particle-steps/s | 122647 | 120729 | -1.6 | within noise |
| GPU sum ms | 4.025 | 4.051 | 0.6 | within noise |
| pass gridClear | 0.025 | 0.025 | 1.1 | within noise |
| pass gridBuild | 0.014 | 0.014 | 1.0 | within noise |
| pass chargeProcess | 0.020 | 0.020 | 0.8 | within noise |
| pass chargeFinalize | 0.014 | 0.014 | 0.3 | within noise |
| pass pressure | 0.007 | 0.007 | 2.1 | within noise |
| pass communicationSelect | 0.019 | 0.017 | -5.9 | within noise |
| pass communicationTransmit | 0.017 | 0.018 | 4.4 | within noise |
| pass localSuccess | 0.016 | 0.016 | -0.3 | within noise |
| pass healthUpdate | 0.017 | 0.017 | -2.4 | within noise |
| pass force | 1.957 | 1.973 | 0.8 | within noise |
| pass mechanics | 0.024 | 0.023 | -1.1 | within noise |
| pass deathCompaction | 1.896 | 1.904 | 0.5 | within noise |

### N = 5000  (5 baseline / 5 candidate rounds, medians)

| metric | baseline | candidate | delta % | verdict |
|---|---:|---:|---:|---|
| step ms (mean) | 25.586 | 25.893 | 1.2 | within noise |
| step ms (p95) | 29.410 | 29.905 | 1.7 | within noise |
| particle-steps/s | 173112 | 170999 | -1.2 | within noise |
| GPU sum ms | 9.588 | 9.548 | -0.4 | within noise |
| pass gridClear | 0.025 | 0.026 | 3.8 | within noise |
| pass gridBuild | 0.030 | 0.029 | -1.3 | within noise |
| pass chargeProcess | 0.028 | 0.027 | -5.2 | within noise |
| pass chargeFinalize | 0.017 | 0.016 | -0.4 | within noise |
| pass pressure | 0.007 | 0.007 | -0.8 | within noise |
| pass communicationSelect | 0.022 | 0.021 | -4.4 | within noise |
| pass communicationTransmit | 0.020 | 0.019 | -4.5 | within noise |
| pass localSuccess | 0.017 | 0.016 | -0.9 | within noise |
| pass healthUpdate | 0.023 | 0.023 | -2.3 | within noise |
| pass force | 4.585 | 4.562 | -0.5 | within noise |
| pass mechanics | 0.036 | 0.036 | -0.7 | within noise |
| pass deathCompaction | 4.777 | 4.752 | -0.5 | within noise |

### N = 10000  (5 baseline / 5 candidate rounds, medians)

| metric | baseline | candidate | delta % | verdict |
|---|---:|---:|---:|---|
| step ms (mean) | 53.982 | 53.150 | -1.5 | within noise |
| step ms (p95) | 71.130 | 67.335 | -5.3 | within noise |
| particle-steps/s | 167235 | 170439 | 1.9 | within noise |
| GPU sum ms | 19.171 | 19.205 | 0.2 | within noise |
| pass gridClear | 0.026 | 0.026 | 1.3 | within noise |
| pass gridBuild | 0.048 | 0.049 | 0.8 | within noise |
| pass chargeProcess | 0.035 | 0.035 | -0.2 | within noise |
| pass chargeFinalize | 0.023 | 0.022 | -4.1 | within noise |
| pass pressure | 0.007 | 0.006 | -5.6 | lower (beyond noise) |
| pass communicationSelect | 0.023 | 0.023 | -1.4 | within noise |
| pass communicationTransmit | 0.023 | 0.024 | 1.9 | within noise |
| pass localSuccess | 0.020 | 0.020 | -0.1 | within noise |
| pass healthUpdate | 0.033 | 0.033 | -0.9 | within noise |
| pass force | 9.368 | 9.296 | -0.8 | within noise |
| pass mechanics | 0.059 | 0.058 | -2.5 | within noise |
| pass deathCompaction | 9.503 | 9.542 | 0.4 | within noise |

## ab-force-wg256 vs ab-baseline  [variant: baseline]  (kernels: {"forceWorkgroupSize":256}; rounds 5 vs 5)

### N = 200  (5 baseline / 5 candidate rounds, medians)

| metric | baseline | candidate | delta % | verdict |
|---|---:|---:|---:|---|
| step ms (mean) | 5.199 | 5.528 | 6.3 | within noise |
| step ms (p95) | 6.605 | 7.305 | 10.6 | within noise |
| particle-steps/s | 23733 | 22361 | -5.8 | within noise |
| GPU sum ms | 0.722 | 0.839 | 16.2 | higher (beyond noise) |
| pass gridClear | 0.025 | 0.024 | -2.1 | within noise |
| pass gridBuild | 0.011 | 0.011 | -0.9 | within noise |
| pass chargeProcess | 0.017 | 0.017 | 0.3 | within noise |
| pass chargeFinalize | 0.012 | 0.011 | -1.6 | within noise |
| pass pressure | 0.007 | 0.006 | -5.9 | within noise |
| pass communicationSelect | 0.015 | 0.015 | 1.3 | within noise |
| pass communicationTransmit | 0.016 | 0.015 | -4.3 | within noise |
| pass localSuccess | 0.015 | 0.015 | -1.1 | within noise |
| pass healthUpdate | 0.014 | 0.014 | -1.4 | within noise |
| pass force | 0.367 | 0.489 | 33.0 | higher (beyond noise) |
| pass mechanics | 0.015 | 0.015 | 0.2 | within noise |
| pass deathCompaction | 0.208 | 0.207 | -0.5 | within noise |

### N = 500  (5 baseline / 5 candidate rounds, medians)

| metric | baseline | candidate | delta % | verdict |
|---|---:|---:|---:|---|
| step ms (mean) | 7.432 | 7.203 | -3.1 | within noise |
| step ms (p95) | 9.325 | 9.000 | -3.5 | within noise |
| particle-steps/s | 45310 | 47371 | 4.5 | within noise |
| GPU sum ms | 1.584 | 1.842 | 16.3 | higher (beyond noise) |
| pass gridClear | 0.025 | 0.025 | 0.1 | within noise |
| pass gridBuild | 0.011 | 0.011 | -1.5 | within noise |
| pass chargeProcess | 0.017 | 0.017 | -2.6 | within noise |
| pass chargeFinalize | 0.012 | 0.012 | -1.5 | within noise |
| pass pressure | 0.006 | 0.006 | -0.5 | within noise |
| pass communicationSelect | 0.016 | 0.016 | -1.3 | within noise |
| pass communicationTransmit | 0.016 | 0.017 | 6.0 | within noise |
| pass localSuccess | 0.015 | 0.015 | 1.0 | within noise |
| pass healthUpdate | 0.014 | 0.015 | 0.7 | within noise |
| pass force | 0.949 | 1.212 | 27.7 | higher (beyond noise) |
| pass mechanics | 0.016 | 0.016 | -0.9 | within noise |
| pass deathCompaction | 0.481 | 0.481 | 0.1 | within noise |

### N = 1000  (5 baseline / 5 candidate rounds, medians)

| metric | baseline | candidate | delta % | verdict |
|---|---:|---:|---:|---|
| step ms (mean) | 8.840 | 10.159 | 14.9 | within noise |
| step ms (p95) | 11.305 | 11.215 | -0.8 | within noise |
| particle-steps/s | 83340 | 74538 | -10.6 | within noise |
| GPU sum ms | 2.670 | 3.044 | 14.0 | higher (beyond noise) |
| pass gridClear | 0.025 | 0.024 | -1.0 | within noise |
| pass gridBuild | 0.012 | 0.012 | -1.0 | within noise |
| pass chargeProcess | 0.018 | 0.018 | 0.5 | within noise |
| pass chargeFinalize | 0.013 | 0.013 | -2.5 | within noise |
| pass pressure | 0.007 | 0.007 | -5.9 | within noise |
| pass communicationSelect | 0.017 | 0.016 | -1.8 | within noise |
| pass communicationTransmit | 0.017 | 0.016 | -1.8 | within noise |
| pass localSuccess | 0.016 | 0.015 | -2.9 | within noise |
| pass healthUpdate | 0.016 | 0.016 | 3.7 | within noise |
| pass force | 1.557 | 1.936 | 24.3 | higher (beyond noise) |
| pass mechanics | 0.018 | 0.019 | 1.6 | within noise |
| pass deathCompaction | 0.963 | 0.949 | -1.4 | within noise |

### N = 2000  (5 baseline / 5 candidate rounds, medians)

| metric | baseline | candidate | delta % | verdict |
|---|---:|---:|---:|---|
| step ms (mean) | 12.990 | 12.796 | -1.5 | within noise |
| step ms (p95) | 15.520 | 15.625 | 0.7 | within noise |
| particle-steps/s | 122647 | 123916 | 1.0 | within noise |
| GPU sum ms | 4.025 | 4.232 | 5.1 | higher (beyond noise) |
| pass gridClear | 0.025 | 0.025 | 2.0 | within noise |
| pass gridBuild | 0.014 | 0.014 | 2.5 | within noise |
| pass chargeProcess | 0.020 | 0.020 | -0.3 | within noise |
| pass chargeFinalize | 0.014 | 0.013 | -0.6 | within noise |
| pass pressure | 0.007 | 0.007 | -2.8 | within noise |
| pass communicationSelect | 0.019 | 0.018 | -5.5 | within noise |
| pass communicationTransmit | 0.017 | 0.018 | 2.1 | within noise |
| pass localSuccess | 0.016 | 0.016 | 2.7 | within noise |
| pass healthUpdate | 0.017 | 0.018 | 3.9 | within noise |
| pass force | 1.957 | 2.160 | 10.4 | higher (beyond noise) |
| pass mechanics | 0.024 | 0.023 | -2.2 | within noise |
| pass deathCompaction | 1.896 | 1.899 | 0.2 | within noise |

### N = 5000  (5 baseline / 5 candidate rounds, medians)

| metric | baseline | candidate | delta % | verdict |
|---|---:|---:|---:|---|
| step ms (mean) | 25.586 | 25.704 | 0.5 | within noise |
| step ms (p95) | 29.410 | 30.935 | 5.2 | within noise |
| particle-steps/s | 173112 | 172551 | -0.3 | within noise |
| GPU sum ms | 9.588 | 9.535 | -0.6 | within noise |
| pass gridClear | 0.025 | 0.025 | 0.7 | within noise |
| pass gridBuild | 0.030 | 0.029 | -0.6 | within noise |
| pass chargeProcess | 0.028 | 0.027 | -4.5 | within noise |
| pass chargeFinalize | 0.017 | 0.016 | -1.1 | within noise |
| pass pressure | 0.007 | 0.006 | -4.7 | within noise |
| pass communicationSelect | 0.022 | 0.022 | 0.4 | within noise |
| pass communicationTransmit | 0.020 | 0.020 | 0.9 | within noise |
| pass localSuccess | 0.017 | 0.017 | -0.4 | within noise |
| pass healthUpdate | 0.023 | 0.023 | -1.1 | within noise |
| pass force | 4.585 | 4.596 | 0.2 | within noise |
| pass mechanics | 0.036 | 0.036 | 0.3 | within noise |
| pass deathCompaction | 4.777 | 4.720 | -1.2 | within noise |

### N = 10000  (5 baseline / 5 candidate rounds, medians)

| metric | baseline | candidate | delta % | verdict |
|---|---:|---:|---:|---|
| step ms (mean) | 53.982 | 54.830 | 1.6 | within noise |
| step ms (p95) | 71.130 | 72.400 | 1.8 | within noise |
| particle-steps/s | 167235 | 166036 | -0.7 | within noise |
| GPU sum ms | 19.171 | 19.476 | 1.6 | higher (beyond noise) |
| pass gridClear | 0.026 | 0.026 | 2.4 | within noise |
| pass gridBuild | 0.048 | 0.048 | -0.1 | within noise |
| pass chargeProcess | 0.035 | 0.036 | 2.6 | within noise |
| pass chargeFinalize | 0.023 | 0.023 | -1.0 | within noise |
| pass pressure | 0.007 | 0.006 | -0.6 | within noise |
| pass communicationSelect | 0.023 | 0.023 | 0.4 | within noise |
| pass communicationTransmit | 0.023 | 0.024 | 3.3 | within noise |
| pass localSuccess | 0.020 | 0.020 | -0.8 | within noise |
| pass healthUpdate | 0.033 | 0.033 | -0.2 | within noise |
| pass force | 9.368 | 9.702 | 3.6 | higher (beyond noise) |
| pass mechanics | 0.059 | 0.059 | -1.3 | within noise |
| pass deathCompaction | 9.503 | 9.488 | -0.2 | within noise |

## ab-death-parallel vs ab-baseline  [variant: renderDisabled]  (kernels: {"deathCompaction":"parallel"}; rounds 5 vs 5)

### N = 200  (5 baseline / 5 candidate rounds, medians)

| metric | baseline | candidate | delta % | verdict |
|---|---:|---:|---:|---|
| step ms (mean) | 4.003 | 3.843 | -4.0 | within noise |
| step ms (p95) | 4.815 | 5.310 | 10.3 | within noise |
| particle-steps/s | 27556 | 27782 | 0.8 | within noise |
| GPU sum ms | 0.727 | 0.570 | -21.6 | lower (beyond noise) |
| pass gridClear | 0.024 | 0.025 | 1.8 | within noise |
| pass gridBuild | 0.014 | 0.014 | -2.1 | within noise |
| pass chargeProcess | 0.018 | 0.017 | -3.4 | within noise |
| pass chargeFinalize | 0.012 | 0.012 | -0.9 | within noise |
| pass pressure | 0.006 | 0.006 | -1.1 | within noise |
| pass communicationSelect | 0.016 | 0.016 | -1.0 | within noise |
| pass communicationTransmit | 0.015 | 0.016 | 2.7 | within noise |
| pass localSuccess | 0.015 | 0.015 | -2.2 | within noise |
| pass healthUpdate | 0.014 | 0.014 | -0.2 | within noise |
| pass force | 0.367 | 0.366 | -0.4 | within noise |
| pass mechanics | 0.015 | 0.015 | -1.6 | within noise |
| pass deathCompaction | 0.206 | 0.052 | -75.0 | lower (beyond noise) |

### N = 500  (5 baseline / 5 candidate rounds, medians)

| metric | baseline | candidate | delta % | verdict |
|---|---:|---:|---:|---|
| step ms (mean) | 4.574 | 4.385 | -4.1 | within noise |
| step ms (p95) | 6.105 | 5.715 | -6.4 | within noise |
| particle-steps/s | 62120 | 62980 | 1.4 | within noise |
| GPU sum ms | 1.573 | 1.170 | -25.6 | lower (beyond noise) |
| pass gridClear | 0.024 | 0.025 | 2.7 | within noise |
| pass gridBuild | 0.014 | 0.014 | -2.7 | within noise |
| pass chargeProcess | 0.017 | 0.017 | 1.1 | within noise |
| pass chargeFinalize | 0.012 | 0.012 | 2.2 | within noise |
| pass pressure | 0.006 | 0.007 | 4.6 | within noise |
| pass communicationSelect | 0.016 | 0.016 | 1.2 | within noise |
| pass communicationTransmit | 0.015 | 0.016 | 9.0 | higher (beyond noise) |
| pass localSuccess | 0.015 | 0.015 | -1.5 | within noise |
| pass healthUpdate | 0.014 | 0.014 | -1.4 | within noise |
| pass force | 0.942 | 0.954 | 1.3 | within noise |
| pass mechanics | 0.016 | 0.016 | -2.2 | within noise |
| pass deathCompaction | 0.481 | 0.065 | -86.6 | lower (beyond noise) |

### N = 1000  (5 baseline / 5 candidate rounds, medians)

| metric | baseline | candidate | delta % | verdict |
|---|---:|---:|---:|---|
| step ms (mean) | 5.054 | 4.471 | -11.5 | within noise |
| step ms (p95) | 6.305 | 5.600 | -11.2 | within noise |
| particle-steps/s | 123305 | 130412 | 5.8 | within noise |
| GPU sum ms | 2.690 | 1.822 | -32.3 | lower (beyond noise) |
| pass gridClear | 0.027 | 0.025 | -4.6 | within noise |
| pass gridBuild | 0.015 | 0.015 | -0.9 | within noise |
| pass chargeProcess | 0.019 | 0.018 | -4.2 | within noise |
| pass chargeFinalize | 0.013 | 0.013 | -3.5 | within noise |
| pass pressure | 0.007 | 0.006 | -5.7 | within noise |
| pass communicationSelect | 0.017 | 0.016 | -3.9 | within noise |
| pass communicationTransmit | 0.016 | 0.017 | 3.3 | within noise |
| pass localSuccess | 0.015 | 0.015 | 0.8 | within noise |
| pass healthUpdate | 0.015 | 0.015 | 0.0 | within noise |
| pass force | 1.557 | 1.561 | 0.2 | within noise |
| pass mechanics | 0.018 | 0.018 | 1.1 | within noise |
| pass deathCompaction | 0.969 | 0.095 | -90.2 | lower (beyond noise) |

### N = 2000  (5 baseline / 5 candidate rounds, medians)

| metric | baseline | candidate | delta % | verdict |
|---|---:|---:|---:|---|
| step ms (mean) | 6.897 | 5.267 | -23.6 | lower (beyond noise) |
| step ms (p95) | 8.105 | 6.905 | -14.8 | within noise |
| particle-steps/s | 201005 | 238749 | 18.8 | higher (beyond noise) |
| GPU sum ms | 4.046 | 2.261 | -44.1 | lower (beyond noise) |
| pass gridClear | 0.025 | 0.025 | -2.0 | within noise |
| pass gridBuild | 0.016 | 0.016 | -3.0 | within noise |
| pass chargeProcess | 0.020 | 0.019 | -4.0 | within noise |
| pass chargeFinalize | 0.014 | 0.013 | -4.3 | within noise |
| pass pressure | 0.007 | 0.006 | -6.4 | within noise |
| pass communicationSelect | 0.017 | 0.017 | -2.5 | within noise |
| pass communicationTransmit | 0.017 | 0.017 | 1.4 | within noise |
| pass localSuccess | 0.015 | 0.015 | 0.7 | within noise |
| pass healthUpdate | 0.017 | 0.017 | -0.2 | within noise |
| pass force | 1.974 | 1.947 | -1.3 | within noise |
| pass mechanics | 0.024 | 0.024 | 1.3 | within noise |
| pass deathCompaction | 1.894 | 0.146 | -92.3 | lower (beyond noise) |

### N = 5000  (5 baseline / 5 candidate rounds, medians)

| metric | baseline | candidate | delta % | verdict |
|---|---:|---:|---:|---|
| step ms (mean) | 12.599 | 7.925 | -37.1 | lower (beyond noise) |
| step ms (p95) | 13.615 | 9.030 | -33.7 | within noise |
| particle-steps/s | 318552 | 454339 | 42.6 | within noise |
| GPU sum ms | 9.519 | 5.100 | -46.4 | lower (beyond noise) |
| pass gridClear | 0.025 | 0.025 | -1.1 | within noise |
| pass gridBuild | 0.033 | 0.032 | -1.6 | within noise |
| pass chargeProcess | 0.027 | 0.026 | -4.5 | within noise |
| pass chargeFinalize | 0.016 | 0.017 | 1.1 | within noise |
| pass pressure | 0.007 | 0.006 | -3.9 | within noise |
| pass communicationSelect | 0.021 | 0.021 | 0.5 | within noise |
| pass communicationTransmit | 0.020 | 0.019 | -3.8 | within noise |
| pass localSuccess | 0.017 | 0.017 | -1.6 | within noise |
| pass healthUpdate | 0.023 | 0.023 | -3.1 | within noise |
| pass force | 4.550 | 4.563 | 0.3 | within noise |
| pass mechanics | 0.036 | 0.037 | 3.1 | within noise |
| pass deathCompaction | 4.744 | 0.307 | -93.5 | lower (beyond noise) |

### N = 10000  (5 baseline / 5 candidate rounds, medians)

| metric | baseline | candidate | delta % | verdict |
|---|---:|---:|---:|---|
| step ms (mean) | 23.077 | 14.104 | -38.9 | within noise |
| step ms (p95) | 24.155 | 15.225 | -37.0 | within noise |
| particle-steps/s | 381825 | 581463 | 52.3 | within noise |
| GPU sum ms | 19.180 | 10.287 | -46.4 | lower (beyond noise) |
| pass gridClear | 0.025 | 0.025 | 2.3 | within noise |
| pass gridBuild | 0.051 | 0.051 | -0.5 | within noise |
| pass chargeProcess | 0.036 | 0.035 | -1.8 | within noise |
| pass chargeFinalize | 0.023 | 0.022 | -0.7 | within noise |
| pass pressure | 0.006 | 0.006 | -1.7 | within noise |
| pass communicationSelect | 0.023 | 0.024 | 0.7 | within noise |
| pass communicationTransmit | 0.024 | 0.024 | 0.4 | within noise |
| pass localSuccess | 0.020 | 0.020 | -0.4 | within noise |
| pass healthUpdate | 0.033 | 0.033 | 0.2 | within noise |
| pass force | 9.361 | 9.408 | 0.5 | within noise |
| pass mechanics | 0.060 | 0.059 | -2.3 | within noise |
| pass deathCompaction | 9.498 | 0.586 | -93.8 | lower (beyond noise) |

## ab-force-wg32 vs ab-baseline  [variant: renderDisabled]  (kernels: {"forceWorkgroupSize":32}; rounds 5 vs 5)

### N = 200  (5 baseline / 5 candidate rounds, medians)

| metric | baseline | candidate | delta % | verdict |
|---|---:|---:|---:|---|
| step ms (mean) | 4.003 | 4.020 | 0.4 | within noise |
| step ms (p95) | 4.815 | 5.100 | 5.9 | within noise |
| particle-steps/s | 27556 | 27793 | 0.9 | within noise |
| GPU sum ms | 0.727 | 0.722 | -0.6 | within noise |
| pass gridClear | 0.024 | 0.024 | -0.4 | within noise |
| pass gridBuild | 0.014 | 0.014 | 1.0 | within noise |
| pass chargeProcess | 0.018 | 0.017 | -0.9 | within noise |
| pass chargeFinalize | 0.012 | 0.012 | -0.8 | within noise |
| pass pressure | 0.006 | 0.006 | -1.2 | within noise |
| pass communicationSelect | 0.016 | 0.015 | -6.7 | within noise |
| pass communicationTransmit | 0.015 | 0.016 | 2.1 | within noise |
| pass localSuccess | 0.015 | 0.015 | -2.3 | within noise |
| pass healthUpdate | 0.014 | 0.014 | 0.4 | within noise |
| pass force | 0.367 | 0.366 | -0.4 | within noise |
| pass mechanics | 0.015 | 0.015 | -0.9 | within noise |
| pass deathCompaction | 0.206 | 0.207 | 0.4 | within noise |

### N = 500  (5 baseline / 5 candidate rounds, medians)

| metric | baseline | candidate | delta % | verdict |
|---|---:|---:|---:|---|
| step ms (mean) | 4.574 | 4.245 | -7.2 | lower (beyond noise) |
| step ms (p95) | 6.105 | 5.510 | -9.7 | lower (beyond noise) |
| particle-steps/s | 62120 | 66854 | 7.6 | within noise |
| GPU sum ms | 1.573 | 1.574 | 0.1 | within noise |
| pass gridClear | 0.024 | 0.025 | 1.6 | within noise |
| pass gridBuild | 0.014 | 0.014 | -1.6 | within noise |
| pass chargeProcess | 0.017 | 0.017 | -0.8 | within noise |
| pass chargeFinalize | 0.012 | 0.012 | 3.1 | within noise |
| pass pressure | 0.006 | 0.006 | 1.7 | within noise |
| pass communicationSelect | 0.016 | 0.016 | -1.3 | within noise |
| pass communicationTransmit | 0.015 | 0.017 | 12.7 | within noise |
| pass localSuccess | 0.015 | 0.015 | -0.3 | within noise |
| pass healthUpdate | 0.014 | 0.014 | 0.2 | within noise |
| pass force | 0.942 | 0.942 | 0.1 | within noise |
| pass mechanics | 0.016 | 0.016 | -0.2 | within noise |
| pass deathCompaction | 0.481 | 0.481 | 0.1 | within noise |

### N = 1000  (5 baseline / 5 candidate rounds, medians)

| metric | baseline | candidate | delta % | verdict |
|---|---:|---:|---:|---|
| step ms (mean) | 5.054 | 6.174 | 22.2 | within noise |
| step ms (p95) | 6.305 | 7.500 | 19.0 | within noise |
| particle-steps/s | 123305 | 103864 | -15.8 | within noise |
| GPU sum ms | 2.690 | 2.690 | 0.0 | within noise |
| pass gridClear | 0.027 | 0.025 | -7.6 | within noise |
| pass gridBuild | 0.015 | 0.015 | -0.9 | within noise |
| pass chargeProcess | 0.019 | 0.019 | -1.2 | within noise |
| pass chargeFinalize | 0.013 | 0.013 | -4.2 | within noise |
| pass pressure | 0.007 | 0.006 | -5.7 | within noise |
| pass communicationSelect | 0.017 | 0.017 | -3.6 | within noise |
| pass communicationTransmit | 0.016 | 0.017 | 1.8 | within noise |
| pass localSuccess | 0.015 | 0.015 | 0.6 | within noise |
| pass healthUpdate | 0.015 | 0.015 | 1.2 | within noise |
| pass force | 1.557 | 1.560 | 0.2 | within noise |
| pass mechanics | 0.018 | 0.018 | -0.2 | within noise |
| pass deathCompaction | 0.969 | 0.971 | 0.2 | within noise |

### N = 2000  (5 baseline / 5 candidate rounds, medians)

| metric | baseline | candidate | delta % | verdict |
|---|---:|---:|---:|---|
| step ms (mean) | 6.897 | 7.341 | 6.4 | within noise |
| step ms (p95) | 8.105 | 8.900 | 9.8 | within noise |
| particle-steps/s | 201005 | 184077 | -8.4 | within noise |
| GPU sum ms | 4.046 | 4.008 | -0.9 | within noise |
| pass gridClear | 0.025 | 0.025 | -0.4 | within noise |
| pass gridBuild | 0.016 | 0.017 | 2.1 | within noise |
| pass chargeProcess | 0.020 | 0.019 | -3.3 | within noise |
| pass chargeFinalize | 0.014 | 0.013 | -3.7 | within noise |
| pass pressure | 0.007 | 0.007 | -1.0 | within noise |
| pass communicationSelect | 0.017 | 0.016 | -4.5 | within noise |
| pass communicationTransmit | 0.017 | 0.017 | 3.0 | within noise |
| pass localSuccess | 0.015 | 0.015 | -0.7 | within noise |
| pass healthUpdate | 0.017 | 0.017 | -1.8 | within noise |
| pass force | 1.974 | 1.955 | -0.9 | within noise |
| pass mechanics | 0.024 | 0.023 | -2.1 | within noise |
| pass deathCompaction | 1.894 | 1.882 | -0.6 | within noise |

### N = 5000  (5 baseline / 5 candidate rounds, medians)

| metric | baseline | candidate | delta % | verdict |
|---|---:|---:|---:|---|
| step ms (mean) | 12.599 | 12.880 | 2.2 | within noise |
| step ms (p95) | 13.615 | 14.305 | 5.1 | higher (beyond noise) |
| particle-steps/s | 318552 | 303822 | -4.6 | within noise |
| GPU sum ms | 9.519 | 9.530 | 0.1 | within noise |
| pass gridClear | 0.025 | 0.025 | -0.9 | within noise |
| pass gridBuild | 0.033 | 0.032 | -2.5 | within noise |
| pass chargeProcess | 0.027 | 0.027 | -1.9 | within noise |
| pass chargeFinalize | 0.016 | 0.017 | 4.2 | within noise |
| pass pressure | 0.007 | 0.007 | 0.3 | within noise |
| pass communicationSelect | 0.021 | 0.021 | -2.7 | within noise |
| pass communicationTransmit | 0.020 | 0.020 | -1.2 | within noise |
| pass localSuccess | 0.017 | 0.017 | -2.8 | within noise |
| pass healthUpdate | 0.023 | 0.023 | -0.8 | within noise |
| pass force | 4.550 | 4.561 | 0.3 | within noise |
| pass mechanics | 0.036 | 0.037 | 2.6 | within noise |
| pass deathCompaction | 4.744 | 4.748 | 0.1 | within noise |

### N = 10000  (5 baseline / 5 candidate rounds, medians)

| metric | baseline | candidate | delta % | verdict |
|---|---:|---:|---:|---|
| step ms (mean) | 23.077 | 23.349 | 1.2 | within noise |
| step ms (p95) | 24.155 | 25.050 | 3.7 | within noise |
| particle-steps/s | 381825 | 376152 | -1.5 | within noise |
| GPU sum ms | 19.180 | 19.289 | 0.6 | within noise |
| pass gridClear | 0.025 | 0.025 | -1.0 | within noise |
| pass gridBuild | 0.051 | 0.050 | -1.4 | within noise |
| pass chargeProcess | 0.036 | 0.036 | -0.4 | within noise |
| pass chargeFinalize | 0.023 | 0.022 | -0.7 | within noise |
| pass pressure | 0.006 | 0.006 | 0.2 | within noise |
| pass communicationSelect | 0.023 | 0.023 | -0.1 | within noise |
| pass communicationTransmit | 0.024 | 0.024 | 2.7 | within noise |
| pass localSuccess | 0.020 | 0.020 | -1.0 | within noise |
| pass healthUpdate | 0.033 | 0.033 | -1.1 | within noise |
| pass force | 9.361 | 9.417 | 0.6 | within noise |
| pass mechanics | 0.060 | 0.062 | 2.6 | within noise |
| pass deathCompaction | 9.498 | 9.568 | 0.7 | within noise |

## ab-force-wg64 vs ab-baseline  [variant: renderDisabled]  (kernels: {"forceWorkgroupSize":64}; rounds 5 vs 5)

### N = 200  (5 baseline / 5 candidate rounds, medians)

| metric | baseline | candidate | delta % | verdict |
|---|---:|---:|---:|---|
| step ms (mean) | 4.003 | 4.423 | 10.5 | within noise |
| step ms (p95) | 4.815 | 5.700 | 18.4 | within noise |
| particle-steps/s | 27556 | 25694 | -6.8 | within noise |
| GPU sum ms | 0.727 | 0.723 | -0.6 | within noise |
| pass gridClear | 0.024 | 0.025 | 4.1 | within noise |
| pass gridBuild | 0.014 | 0.014 | 0.6 | within noise |
| pass chargeProcess | 0.018 | 0.017 | -0.3 | within noise |
| pass chargeFinalize | 0.012 | 0.012 | 0.6 | within noise |
| pass pressure | 0.006 | 0.007 | 0.5 | within noise |
| pass communicationSelect | 0.016 | 0.016 | -1.5 | within noise |
| pass communicationTransmit | 0.015 | 0.016 | 4.9 | within noise |
| pass localSuccess | 0.015 | 0.015 | -2.9 | within noise |
| pass healthUpdate | 0.014 | 0.014 | -0.4 | within noise |
| pass force | 0.367 | 0.366 | -0.4 | within noise |
| pass mechanics | 0.015 | 0.015 | -1.2 | within noise |
| pass deathCompaction | 0.206 | 0.206 | -0.1 | within noise |

### N = 500  (5 baseline / 5 candidate rounds, medians)

| metric | baseline | candidate | delta % | verdict |
|---|---:|---:|---:|---|
| step ms (mean) | 4.574 | 4.324 | -5.5 | within noise |
| step ms (p95) | 6.105 | 5.810 | -4.8 | within noise |
| particle-steps/s | 62120 | 65920 | 6.1 | within noise |
| GPU sum ms | 1.573 | 1.589 | 1.0 | within noise |
| pass gridClear | 0.024 | 0.025 | 4.1 | within noise |
| pass gridBuild | 0.014 | 0.014 | 2.6 | within noise |
| pass chargeProcess | 0.017 | 0.017 | -0.8 | within noise |
| pass chargeFinalize | 0.012 | 0.012 | 2.9 | within noise |
| pass pressure | 0.006 | 0.006 | -0.5 | within noise |
| pass communicationSelect | 0.016 | 0.016 | -0.4 | within noise |
| pass communicationTransmit | 0.015 | 0.016 | 9.2 | higher (beyond noise) |
| pass localSuccess | 0.015 | 0.015 | -0.6 | within noise |
| pass healthUpdate | 0.014 | 0.014 | -1.9 | within noise |
| pass force | 0.942 | 0.951 | 1.0 | within noise |
| pass mechanics | 0.016 | 0.015 | -3.2 | lower (beyond noise) |
| pass deathCompaction | 0.481 | 0.482 | 0.3 | within noise |

### N = 1000  (5 baseline / 5 candidate rounds, medians)

| metric | baseline | candidate | delta % | verdict |
|---|---:|---:|---:|---|
| step ms (mean) | 5.054 | 5.028 | -0.5 | within noise |
| step ms (p95) | 6.305 | 6.000 | -4.8 | within noise |
| particle-steps/s | 123305 | 123839 | 0.4 | within noise |
| GPU sum ms | 2.690 | 2.693 | 0.1 | within noise |
| pass gridClear | 0.027 | 0.026 | -3.1 | within noise |
| pass gridBuild | 0.015 | 0.015 | -0.2 | within noise |
| pass chargeProcess | 0.019 | 0.018 | -3.8 | within noise |
| pass chargeFinalize | 0.013 | 0.013 | 2.6 | within noise |
| pass pressure | 0.007 | 0.007 | 1.1 | within noise |
| pass communicationSelect | 0.017 | 0.017 | 1.2 | within noise |
| pass communicationTransmit | 0.016 | 0.017 | 3.7 | within noise |
| pass localSuccess | 0.015 | 0.015 | 2.4 | within noise |
| pass healthUpdate | 0.015 | 0.015 | 0.7 | within noise |
| pass force | 1.557 | 1.568 | 0.7 | within noise |
| pass mechanics | 0.018 | 0.018 | -0.0 | within noise |
| pass deathCompaction | 0.969 | 0.967 | -0.3 | within noise |

### N = 2000  (5 baseline / 5 candidate rounds, medians)

| metric | baseline | candidate | delta % | verdict |
|---|---:|---:|---:|---|
| step ms (mean) | 6.897 | 6.776 | -1.8 | within noise |
| step ms (p95) | 8.105 | 8.120 | 0.2 | within noise |
| particle-steps/s | 201005 | 198669 | -1.2 | within noise |
| GPU sum ms | 4.046 | 4.065 | 0.5 | within noise |
| pass gridClear | 0.025 | 0.027 | 4.8 | within noise |
| pass gridBuild | 0.016 | 0.016 | -1.0 | within noise |
| pass chargeProcess | 0.020 | 0.020 | -0.6 | within noise |
| pass chargeFinalize | 0.014 | 0.014 | 0.1 | within noise |
| pass pressure | 0.007 | 0.007 | 3.4 | within noise |
| pass communicationSelect | 0.017 | 0.018 | 2.2 | within noise |
| pass communicationTransmit | 0.017 | 0.017 | 0.7 | within noise |
| pass localSuccess | 0.015 | 0.015 | -0.8 | within noise |
| pass healthUpdate | 0.017 | 0.017 | -0.8 | within noise |
| pass force | 1.974 | 1.984 | 0.5 | within noise |
| pass mechanics | 0.024 | 0.023 | -1.7 | within noise |
| pass deathCompaction | 1.894 | 1.906 | 0.6 | within noise |

### N = 5000  (5 baseline / 5 candidate rounds, medians)

| metric | baseline | candidate | delta % | verdict |
|---|---:|---:|---:|---|
| step ms (mean) | 12.599 | 12.765 | 1.3 | within noise |
| step ms (p95) | 13.615 | 14.205 | 4.3 | higher (beyond noise) |
| particle-steps/s | 318552 | 312735 | -1.8 | within noise |
| GPU sum ms | 9.519 | 9.562 | 0.5 | within noise |
| pass gridClear | 0.025 | 0.025 | -1.3 | within noise |
| pass gridBuild | 0.033 | 0.032 | -3.2 | within noise |
| pass chargeProcess | 0.027 | 0.027 | 0.7 | within noise |
| pass chargeFinalize | 0.016 | 0.017 | 0.7 | within noise |
| pass pressure | 0.007 | 0.007 | -2.5 | within noise |
| pass communicationSelect | 0.021 | 0.021 | -2.0 | within noise |
| pass communicationTransmit | 0.020 | 0.020 | -1.5 | within noise |
| pass localSuccess | 0.017 | 0.017 | -0.9 | within noise |
| pass healthUpdate | 0.023 | 0.023 | -2.1 | within noise |
| pass force | 4.550 | 4.578 | 0.6 | within noise |
| pass mechanics | 0.036 | 0.036 | 0.5 | within noise |
| pass deathCompaction | 4.744 | 4.760 | 0.3 | within noise |

### N = 10000  (5 baseline / 5 candidate rounds, medians)

| metric | baseline | candidate | delta % | verdict |
|---|---:|---:|---:|---|
| step ms (mean) | 23.077 | 23.296 | 0.9 | within noise |
| step ms (p95) | 24.155 | 25.120 | 4.0 | within noise |
| particle-steps/s | 381825 | 376294 | -1.4 | within noise |
| GPU sum ms | 19.180 | 19.212 | 0.2 | within noise |
| pass gridClear | 0.025 | 0.025 | 0.4 | within noise |
| pass gridBuild | 0.051 | 0.049 | -3.4 | within noise |
| pass chargeProcess | 0.036 | 0.035 | -1.6 | within noise |
| pass chargeFinalize | 0.023 | 0.023 | -0.0 | within noise |
| pass pressure | 0.006 | 0.006 | -0.9 | within noise |
| pass communicationSelect | 0.023 | 0.024 | 1.0 | within noise |
| pass communicationTransmit | 0.024 | 0.024 | 0.2 | within noise |
| pass localSuccess | 0.020 | 0.020 | -1.5 | within noise |
| pass healthUpdate | 0.033 | 0.033 | -1.4 | within noise |
| pass force | 9.361 | 9.364 | 0.0 | within noise |
| pass mechanics | 0.060 | 0.059 | -1.5 | within noise |
| pass deathCompaction | 9.498 | 9.540 | 0.4 | within noise |

## ab-force-wg256 vs ab-baseline  [variant: renderDisabled]  (kernels: {"forceWorkgroupSize":256}; rounds 5 vs 5)

### N = 200  (5 baseline / 5 candidate rounds, medians)

| metric | baseline | candidate | delta % | verdict |
|---|---:|---:|---:|---|
| step ms (mean) | 4.003 | 4.332 | 8.2 | within noise |
| step ms (p95) | 4.815 | 5.400 | 12.1 | within noise |
| particle-steps/s | 27556 | 26918 | -2.3 | within noise |
| GPU sum ms | 0.727 | 0.845 | 16.2 | higher (beyond noise) |
| pass gridClear | 0.024 | 0.024 | 0.3 | within noise |
| pass gridBuild | 0.014 | 0.014 | -2.4 | within noise |
| pass chargeProcess | 0.018 | 0.017 | -2.8 | within noise |
| pass chargeFinalize | 0.012 | 0.012 | -2.1 | within noise |
| pass pressure | 0.006 | 0.006 | -1.2 | within noise |
| pass communicationSelect | 0.016 | 0.015 | -3.1 | within noise |
| pass communicationTransmit | 0.015 | 0.015 | 0.9 | within noise |
| pass localSuccess | 0.015 | 0.015 | -2.8 | within noise |
| pass healthUpdate | 0.014 | 0.014 | -0.4 | within noise |
| pass force | 0.367 | 0.489 | 33.1 | higher (beyond noise) |
| pass mechanics | 0.015 | 0.015 | 0.4 | within noise |
| pass deathCompaction | 0.206 | 0.207 | 0.4 | within noise |

### N = 500  (5 baseline / 5 candidate rounds, medians)

| metric | baseline | candidate | delta % | verdict |
|---|---:|---:|---:|---|
| step ms (mean) | 4.574 | 4.541 | -0.7 | within noise |
| step ms (p95) | 6.105 | 6.105 | 0.0 | within noise |
| particle-steps/s | 62120 | 64499 | 3.8 | within noise |
| GPU sum ms | 1.573 | 1.844 | 17.2 | higher (beyond noise) |
| pass gridClear | 0.024 | 0.024 | 0.1 | within noise |
| pass gridBuild | 0.014 | 0.014 | -3.0 | within noise |
| pass chargeProcess | 0.017 | 0.017 | -2.3 | within noise |
| pass chargeFinalize | 0.012 | 0.012 | 0.0 | within noise |
| pass pressure | 0.006 | 0.006 | 0.4 | within noise |
| pass communicationSelect | 0.016 | 0.016 | -2.2 | within noise |
| pass communicationTransmit | 0.015 | 0.015 | 4.0 | within noise |
| pass localSuccess | 0.015 | 0.015 | -0.8 | within noise |
| pass healthUpdate | 0.014 | 0.014 | -1.2 | within noise |
| pass force | 0.942 | 1.212 | 28.7 | higher (beyond noise) |
| pass mechanics | 0.016 | 0.016 | -1.3 | within noise |
| pass deathCompaction | 0.481 | 0.482 | 0.2 | within noise |

### N = 1000  (5 baseline / 5 candidate rounds, medians)

| metric | baseline | candidate | delta % | verdict |
|---|---:|---:|---:|---|
| step ms (mean) | 5.054 | 5.889 | 16.5 | within noise |
| step ms (p95) | 6.305 | 7.000 | 11.0 | within noise |
| particle-steps/s | 123305 | 111744 | -9.4 | within noise |
| GPU sum ms | 2.690 | 3.070 | 14.1 | higher (beyond noise) |
| pass gridClear | 0.027 | 0.026 | -2.4 | within noise |
| pass gridBuild | 0.015 | 0.015 | -0.5 | within noise |
| pass chargeProcess | 0.019 | 0.018 | -3.0 | within noise |
| pass chargeFinalize | 0.013 | 0.013 | -0.4 | within noise |
| pass pressure | 0.007 | 0.007 | -2.4 | within noise |
| pass communicationSelect | 0.017 | 0.016 | -4.2 | within noise |
| pass communicationTransmit | 0.016 | 0.017 | 1.5 | within noise |
| pass localSuccess | 0.015 | 0.015 | 2.9 | within noise |
| pass healthUpdate | 0.015 | 0.015 | 1.9 | within noise |
| pass force | 1.557 | 1.948 | 25.1 | higher (beyond noise) |
| pass mechanics | 0.018 | 0.019 | 4.9 | within noise |
| pass deathCompaction | 0.969 | 0.959 | -1.1 | within noise |

### N = 2000  (5 baseline / 5 candidate rounds, medians)

| metric | baseline | candidate | delta % | verdict |
|---|---:|---:|---:|---|
| step ms (mean) | 6.897 | 6.711 | -2.7 | within noise |
| step ms (p95) | 8.105 | 7.720 | -4.8 | within noise |
| particle-steps/s | 201005 | 205044 | 2.0 | within noise |
| GPU sum ms | 4.046 | 4.227 | 4.5 | higher (beyond noise) |
| pass gridClear | 0.025 | 0.025 | -2.0 | within noise |
| pass gridBuild | 0.016 | 0.016 | -4.1 | within noise |
| pass chargeProcess | 0.020 | 0.020 | -2.3 | within noise |
| pass chargeFinalize | 0.014 | 0.015 | 7.0 | within noise |
| pass pressure | 0.007 | 0.007 | 2.7 | within noise |
| pass communicationSelect | 0.017 | 0.018 | 3.5 | within noise |
| pass communicationTransmit | 0.017 | 0.018 | 8.2 | within noise |
| pass localSuccess | 0.015 | 0.015 | 0.6 | within noise |
| pass healthUpdate | 0.017 | 0.017 | -0.8 | within noise |
| pass force | 1.974 | 2.156 | 9.2 | higher (beyond noise) |
| pass mechanics | 0.024 | 0.023 | -3.1 | within noise |
| pass deathCompaction | 1.894 | 1.898 | 0.2 | within noise |

### N = 5000  (5 baseline / 5 candidate rounds, medians)

| metric | baseline | candidate | delta % | verdict |
|---|---:|---:|---:|---|
| step ms (mean) | 12.599 | 12.640 | 0.3 | within noise |
| step ms (p95) | 13.615 | 13.815 | 1.5 | within noise |
| particle-steps/s | 318552 | 318552 | 0.0 | within noise |
| GPU sum ms | 9.519 | 9.609 | 0.9 | within noise |
| pass gridClear | 0.025 | 0.025 | 0.3 | within noise |
| pass gridBuild | 0.033 | 0.033 | 0.8 | within noise |
| pass chargeProcess | 0.027 | 0.026 | -4.5 | within noise |
| pass chargeFinalize | 0.016 | 0.017 | 1.9 | within noise |
| pass pressure | 0.007 | 0.006 | -3.9 | within noise |
| pass communicationSelect | 0.021 | 0.020 | -3.5 | within noise |
| pass communicationTransmit | 0.020 | 0.020 | -3.0 | within noise |
| pass localSuccess | 0.017 | 0.017 | -3.0 | within noise |
| pass healthUpdate | 0.023 | 0.023 | -1.3 | within noise |
| pass force | 4.550 | 4.629 | 1.7 | higher (beyond noise) |
| pass mechanics | 0.036 | 0.037 | 2.8 | within noise |
| pass deathCompaction | 4.744 | 4.757 | 0.3 | within noise |

### N = 10000  (5 baseline / 5 candidate rounds, medians)

| metric | baseline | candidate | delta % | verdict |
|---|---:|---:|---:|---|
| step ms (mean) | 23.077 | 23.457 | 1.6 | within noise |
| step ms (p95) | 24.155 | 25.405 | 5.2 | within noise |
| particle-steps/s | 381825 | 375460 | -1.7 | within noise |
| GPU sum ms | 19.180 | 19.574 | 2.1 | higher (beyond noise) |
| pass gridClear | 0.025 | 0.025 | 0.2 | within noise |
| pass gridBuild | 0.051 | 0.050 | -2.2 | within noise |
| pass chargeProcess | 0.036 | 0.035 | -2.4 | within noise |
| pass chargeFinalize | 0.023 | 0.022 | -1.0 | within noise |
| pass pressure | 0.006 | 0.006 | -0.7 | within noise |
| pass communicationSelect | 0.023 | 0.024 | 0.5 | within noise |
| pass communicationTransmit | 0.024 | 0.024 | 0.7 | within noise |
| pass localSuccess | 0.020 | 0.020 | -0.7 | within noise |
| pass healthUpdate | 0.033 | 0.033 | -0.8 | within noise |
| pass force | 9.361 | 9.752 | 4.2 | higher (beyond noise) |
| pass mechanics | 0.060 | 0.061 | 1.9 | within noise |
| pass deathCompaction | 9.498 | 9.523 | 0.3 | within noise |
