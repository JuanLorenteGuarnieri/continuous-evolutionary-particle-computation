# GPU cost model — tag "ab-baseline"

Adapters: intel gen-9 0x1916 Intel(R) HD Graphics 520

### N = 200  (5 rounds, median across rounds)

step 5.199 ms (p95 6.605, p99 7.003) | 118.7 steps/s | 23733 particle-steps/s | GPU sum 0.722 ms (14.0% of step) | GPU span 0.752 ms, idle gaps 0.029 ms

| pass | mean ms | min..max ms | p50 ms | p95 ms | % of GPU sum | dispatches/step | workgroups/dispatch (static) |
|---|---:|---|---:|---:|---:|---:|---|
| force | 0.367 | 0.362..0.381 | 0.361 | 0.389 | 50.9 | 1.0 | 2 |
| deathCompaction | 0.208 | 0.206..0.210 | 0.205 | 0.215 | 28.8 | 1.0 | 2 |
| gridClear | 0.025 | 0.024..0.025 | 0.024 | 0.027 | 3.4 | 1.0 | ceil(cells/128) |
| chargeProcess | 0.017 | 0.016..0.018 | 0.016 | 0.018 | 2.3 | 1.0 | 2 |
| communicationTransmit | 0.016 | 0.015..0.016 | 0.016 | 0.017 | 2.2 | 1.0 | 2 |
| mechanics | 0.015 | 0.015..0.015 | 0.015 | 0.016 | 2.1 | 1.0 | 2 |
| communicationSelect | 0.015 | 0.015..0.015 | 0.014 | 0.017 | 2.1 | 1.0 | 2 |
| localSuccess | 0.015 | 0.015..0.016 | 0.014 | 0.015 | 2.1 | 1.0 | 2 |
| healthUpdate | 0.014 | 0.014..0.015 | 0.014 | 0.019 | 2.0 | 1.0 | 2 |
| chargeFinalize | 0.012 | 0.011..0.012 | 0.011 | 0.013 | 1.6 | 1.0 | 2 |
| gridBuild | 0.011 | 0.011..0.012 | 0.011 | 0.012 | 1.5 | 1.0 | 2 |
| pressure | 0.007 | 0.006..0.007 | 0.006 | 0.007 | 0.9 | 1.0 | 1 |

| group | mean ms | % of GPU sum |
|---|---:|---:|
| force | 0.367 | 50.9 |
| compaction | 0.208 | 28.8 |
| grid | 0.036 | 4.9 |
| communication | 0.031 | 4.3 |
| localSuccessAndHealth | 0.029 | 4.0 |
| charge | 0.028 | 3.9 |
| mechanics | 0.015 | 2.1 |
| pressure | 0.007 | 0.9 |

### N = 500  (5 rounds, median across rounds)

step 7.432 ms (p95 9.325, p99 13.460) | 90.6 steps/s | 45310 particle-steps/s | GPU sum 1.584 ms (21.1% of step) | GPU span 1.614 ms, idle gaps 0.030 ms

| pass | mean ms | min..max ms | p50 ms | p95 ms | % of GPU sum | dispatches/step | workgroups/dispatch (static) |
|---|---:|---|---:|---:|---:|---:|---|
| force | 0.949 | 0.939..0.957 | 0.941 | 0.952 | 59.9 | 1.0 | 4 |
| deathCompaction | 0.481 | 0.480..0.483 | 0.479 | 0.489 | 30.4 | 1.0 | 4 |
| gridClear | 0.025 | 0.024..0.026 | 0.024 | 0.025 | 1.5 | 1.0 | ceil(cells/128) |
| chargeProcess | 0.017 | 0.017..0.021 | 0.016 | 0.018 | 1.1 | 1.0 | 4 |
| communicationSelect | 0.016 | 0.016..0.017 | 0.017 | 0.018 | 1.0 | 1.0 | 4 |
| mechanics | 0.016 | 0.016..0.016 | 0.015 | 0.018 | 1.0 | 1.0 | 4 |
| communicationTransmit | 0.016 | 0.015..0.017 | 0.016 | 0.017 | 1.0 | 1.0 | 4 |
| localSuccess | 0.015 | 0.015..0.016 | 0.015 | 0.016 | 1.0 | 1.0 | 4 |
| healthUpdate | 0.014 | 0.014..0.015 | 0.014 | 0.015 | 0.9 | 1.0 | 4 |
| chargeFinalize | 0.012 | 0.012..0.013 | 0.012 | 0.013 | 0.8 | 1.0 | 4 |
| gridBuild | 0.011 | 0.011..0.013 | 0.011 | 0.012 | 0.7 | 1.0 | 4 |
| pressure | 0.006 | 0.006..0.007 | 0.006 | 0.007 | 0.4 | 1.0 | 1 |

| group | mean ms | % of GPU sum |
|---|---:|---:|
| force | 0.949 | 59.9 |
| compaction | 0.481 | 30.4 |
| grid | 0.036 | 2.3 |
| communication | 0.032 | 2.0 |
| localSuccessAndHealth | 0.030 | 1.9 |
| charge | 0.029 | 1.9 |
| mechanics | 0.016 | 1.0 |
| pressure | 0.006 | 0.4 |

### N = 1000  (5 rounds, median across rounds)

step 8.840 ms (p95 11.305, p99 13.489) | 83.3 steps/s | 83340 particle-steps/s | GPU sum 2.670 ms (31.0% of step) | GPU span 2.700 ms, idle gaps 0.030 ms

| pass | mean ms | min..max ms | p50 ms | p95 ms | % of GPU sum | dispatches/step | workgroups/dispatch (static) |
|---|---:|---|---:|---:|---:|---:|---|
| force | 1.557 | 1.532..1.598 | 1.542 | 1.628 | 58.2 | 1.0 | 8 |
| deathCompaction | 0.963 | 0.947..0.982 | 0.957 | 0.997 | 35.9 | 1.0 | 8 |
| gridClear | 0.025 | 0.024..0.026 | 0.024 | 0.035 | 0.9 | 1.0 | ceil(cells/128) |
| mechanics | 0.018 | 0.018..0.019 | 0.018 | 0.023 | 0.7 | 1.0 | 8 |
| chargeProcess | 0.018 | 0.018..0.019 | 0.017 | 0.030 | 0.7 | 1.0 | 8 |
| communicationTransmit | 0.017 | 0.016..0.017 | 0.016 | 0.021 | 0.6 | 1.0 | 8 |
| communicationSelect | 0.017 | 0.015..0.017 | 0.016 | 0.021 | 0.6 | 1.0 | 8 |
| healthUpdate | 0.016 | 0.016..0.016 | 0.015 | 0.021 | 0.6 | 1.0 | 8 |
| localSuccess | 0.016 | 0.015..0.016 | 0.015 | 0.022 | 0.6 | 1.0 | 8 |
| chargeFinalize | 0.013 | 0.013..0.013 | 0.012 | 0.026 | 0.5 | 1.0 | 8 |
| gridBuild | 0.012 | 0.012..0.013 | 0.011 | 0.017 | 0.4 | 1.0 | 8 |
| pressure | 0.007 | 0.007..0.007 | 0.006 | 0.009 | 0.3 | 1.0 | 1 |

| group | mean ms | % of GPU sum |
|---|---:|---:|
| force | 1.557 | 58.2 |
| compaction | 0.963 | 35.9 |
| grid | 0.036 | 1.4 |
| communication | 0.033 | 1.2 |
| localSuccessAndHealth | 0.032 | 1.2 |
| charge | 0.031 | 1.2 |
| mechanics | 0.018 | 0.7 |
| pressure | 0.007 | 0.3 |

### N = 2000  (5 rounds, median across rounds)

step 12.990 ms (p95 15.520, p99 21.112) | 61.3 steps/s | 122647 particle-steps/s | GPU sum 4.025 ms (31.0% of step) | GPU span 4.058 ms, idle gaps 0.033 ms

| pass | mean ms | min..max ms | p50 ms | p95 ms | % of GPU sum | dispatches/step | workgroups/dispatch (static) |
|---|---:|---|---:|---:|---:|---:|---|
| force | 1.957 | 1.919..1.992 | 1.947 | 2.018 | 48.6 | 1.0 | 16 |
| deathCompaction | 1.896 | 1.857..1.915 | 1.888 | 1.972 | 47.1 | 1.0 | 16 |
| gridClear | 0.025 | 0.025..0.027 | 0.024 | 0.037 | 0.6 | 1.0 | ceil(cells/128) |
| mechanics | 0.024 | 0.024..0.025 | 0.022 | 0.036 | 0.6 | 1.0 | 16 |
| chargeProcess | 0.020 | 0.019..0.021 | 0.018 | 0.031 | 0.5 | 1.0 | 16 |
| communicationSelect | 0.019 | 0.017..0.019 | 0.017 | 0.031 | 0.5 | 1.0 | 16 |
| healthUpdate | 0.017 | 0.017..0.018 | 0.016 | 0.023 | 0.4 | 1.0 | 16 |
| communicationTransmit | 0.017 | 0.016..0.019 | 0.017 | 0.027 | 0.4 | 1.0 | 16 |
| localSuccess | 0.016 | 0.015..0.016 | 0.015 | 0.026 | 0.4 | 1.0 | 16 |
| chargeFinalize | 0.014 | 0.013..0.014 | 0.013 | 0.025 | 0.3 | 1.0 | 16 |
| gridBuild | 0.014 | 0.013..0.015 | 0.013 | 0.021 | 0.3 | 1.0 | 16 |
| pressure | 0.007 | 0.006..0.007 | 0.006 | 0.010 | 0.2 | 1.0 | 1 |

| group | mean ms | % of GPU sum |
|---|---:|---:|
| force | 1.957 | 48.6 |
| compaction | 1.896 | 47.1 |
| grid | 0.038 | 1.0 |
| communication | 0.036 | 0.9 |
| localSuccessAndHealth | 0.033 | 0.8 |
| charge | 0.033 | 0.8 |
| mechanics | 0.024 | 0.6 |
| pressure | 0.007 | 0.2 |

### N = 5000  (5 rounds, median across rounds)

step 25.586 ms (p95 29.410, p99 32.607) | 34.6 steps/s | 173112 particle-steps/s | GPU sum 9.588 ms (37.3% of step) | GPU span 9.623 ms, idle gaps 0.035 ms

| pass | mean ms | min..max ms | p50 ms | p95 ms | % of GPU sum | dispatches/step | workgroups/dispatch (static) |
|---|---:|---|---:|---:|---:|---:|---|
| deathCompaction | 4.777 | 4.696..4.786 | 4.753 | 4.927 | 49.8 | 1.0 | 40 |
| force | 4.585 | 4.517..4.595 | 4.563 | 4.723 | 47.8 | 1.0 | 40 |
| mechanics | 0.036 | 0.035..0.038 | 0.034 | 0.049 | 0.4 | 1.0 | 40 |
| gridBuild | 0.030 | 0.028..0.032 | 0.027 | 0.042 | 0.3 | 1.0 | 40 |
| chargeProcess | 0.028 | 0.027..0.028 | 0.024 | 0.038 | 0.3 | 1.0 | 40 |
| gridClear | 0.025 | 0.025..0.028 | 0.024 | 0.037 | 0.3 | 1.0 | ceil(cells/128) |
| healthUpdate | 0.023 | 0.023..0.024 | 0.022 | 0.035 | 0.2 | 1.0 | 40 |
| communicationSelect | 0.022 | 0.021..0.022 | 0.021 | 0.033 | 0.2 | 1.0 | 40 |
| communicationTransmit | 0.020 | 0.019..0.020 | 0.020 | 0.030 | 0.2 | 1.0 | 40 |
| localSuccess | 0.017 | 0.016..0.017 | 0.016 | 0.022 | 0.2 | 1.0 | 40 |
| chargeFinalize | 0.017 | 0.016..0.018 | 0.015 | 0.029 | 0.2 | 1.0 | 40 |
| pressure | 0.007 | 0.006..0.007 | 0.006 | 0.008 | 0.1 | 1.0 | 1 |

| group | mean ms | % of GPU sum |
|---|---:|---:|
| compaction | 4.777 | 49.8 |
| force | 4.585 | 47.8 |
| grid | 0.055 | 0.6 |
| charge | 0.044 | 0.5 |
| communication | 0.042 | 0.4 |
| localSuccessAndHealth | 0.040 | 0.4 |
| mechanics | 0.036 | 0.4 |
| pressure | 0.007 | 0.1 |

### N = 10000  (5 rounds, median across rounds)

step 53.982 ms (p95 71.130, p99 83.599) | 16.7 steps/s | 167235 particle-steps/s | GPU sum 19.171 ms (35.5% of step) | GPU span 19.210 ms, idle gaps 0.039 ms

| pass | mean ms | min..max ms | p50 ms | p95 ms | % of GPU sum | dispatches/step | workgroups/dispatch (static) |
|---|---:|---|---:|---:|---:|---:|---|
| deathCompaction | 9.503 | 9.419..9.530 | 9.412 | 9.724 | 49.6 | 1.0 | 79 |
| force | 9.368 | 9.265..9.391 | 9.287 | 9.584 | 48.9 | 1.0 | 79 |
| mechanics | 0.059 | 0.057..0.063 | 0.055 | 0.079 | 0.3 | 1.0 | 79 |
| gridBuild | 0.048 | 0.047..0.049 | 0.044 | 0.058 | 0.3 | 1.0 | 79 |
| chargeProcess | 0.035 | 0.034..0.036 | 0.032 | 0.047 | 0.2 | 1.0 | 79 |
| healthUpdate | 0.033 | 0.032..0.034 | 0.031 | 0.044 | 0.2 | 1.0 | 79 |
| gridClear | 0.026 | 0.025..0.028 | 0.024 | 0.037 | 0.1 | 1.0 | ceil(cells/128) |
| communicationSelect | 0.023 | 0.023..0.025 | 0.022 | 0.026 | 0.1 | 1.0 | 79 |
| communicationTransmit | 0.023 | 0.023..0.023 | 0.024 | 0.025 | 0.1 | 1.0 | 79 |
| chargeFinalize | 0.023 | 0.023..0.024 | 0.022 | 0.036 | 0.1 | 1.0 | 79 |
| localSuccess | 0.020 | 0.020..0.021 | 0.019 | 0.024 | 0.1 | 1.0 | 79 |
| pressure | 0.007 | 0.006..0.007 | 0.006 | 0.007 | 0.0 | 1.0 | 1 |

| group | mean ms | % of GPU sum |
|---|---:|---:|
| compaction | 9.503 | 49.6 |
| force | 9.368 | 48.9 |
| grid | 0.073 | 0.4 |
| mechanics | 0.059 | 0.3 |
| charge | 0.057 | 0.3 |
| localSuccessAndHealth | 0.053 | 0.3 |
| communication | 0.047 | 0.2 |
| pressure | 0.007 | 0.0 |
