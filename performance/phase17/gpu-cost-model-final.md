# GPU cost model — tag "ab-death-parallel"

Adapters: intel gen-9 0x1916 Intel(R) HD Graphics 520

### N = 200  (5 rounds, median across rounds)

step 4.951 ms (p95 6.205, p99 7.811) | 122.7 steps/s | 24546 particle-steps/s | GPU sum 0.567 ms (11.5% of step) | GPU span 0.596 ms, idle gaps 0.029 ms

| pass | mean ms | min..max ms | p50 ms | p95 ms | % of GPU sum | dispatches/step | workgroups/dispatch (static) |
|---|---:|---|---:|---:|---:|---:|---|
| force | 0.366 | 0.363..0.368 | 0.362 | 0.382 | 64.9 | 1.0 | 2 |
| deathCompaction | 0.052 | 0.051..0.053 | 0.050 | 0.061 | 9.2 | 1.0 | 2 |
| gridClear | 0.024 | 0.024..0.025 | 0.024 | 0.030 | 4.4 | 1.0 | ceil(cells/128) |
| chargeProcess | 0.016 | 0.016..0.017 | 0.016 | 0.018 | 2.9 | 1.0 | 2 |
| communicationTransmit | 0.016 | 0.015..0.016 | 0.016 | 0.018 | 2.9 | 1.0 | 2 |
| communicationSelect | 0.015 | 0.015..0.016 | 0.016 | 0.017 | 2.7 | 1.0 | 2 |
| localSuccess | 0.015 | 0.015..0.016 | 0.014 | 0.019 | 2.6 | 1.0 | 2 |
| mechanics | 0.015 | 0.014..0.015 | 0.014 | 0.018 | 2.6 | 1.0 | 2 |
| healthUpdate | 0.014 | 0.014..0.015 | 0.013 | 0.019 | 2.5 | 1.0 | 2 |
| chargeFinalize | 0.012 | 0.011..0.012 | 0.011 | 0.013 | 2.1 | 1.0 | 2 |
| gridBuild | 0.011 | 0.011..0.012 | 0.011 | 0.013 | 2.0 | 1.0 | 2 |
| pressure | 0.007 | 0.006..0.007 | 0.006 | 0.008 | 1.2 | 1.0 | 1 |

| group | mean ms | % of GPU sum |
|---|---:|---:|
| force | 0.366 | 64.9 |
| compaction | 0.052 | 9.2 |
| grid | 0.035 | 6.3 |
| communication | 0.031 | 5.6 |
| localSuccessAndHealth | 0.029 | 5.2 |
| charge | 0.028 | 5.0 |
| mechanics | 0.015 | 2.6 |
| pressure | 0.007 | 1.2 |

### N = 500  (5 rounds, median across rounds)

step 6.774 ms (p95 8.910, p99 17.899) | 92.5 steps/s | 46275 particle-steps/s | GPU sum 1.166 ms (17.1% of step) | GPU span 1.197 ms, idle gaps 0.030 ms

| pass | mean ms | min..max ms | p50 ms | p95 ms | % of GPU sum | dispatches/step | workgroups/dispatch (static) |
|---|---:|---|---:|---:|---:|---:|---|
| force | 0.951 | 0.940..0.957 | 0.941 | 1.001 | 81.5 | 1.0 | 4 |
| deathCompaction | 0.065 | 0.064..0.067 | 0.064 | 0.072 | 5.6 | 1.0 | 4 |
| gridClear | 0.025 | 0.024..0.026 | 0.024 | 0.028 | 2.1 | 1.0 | ceil(cells/128) |
| chargeProcess | 0.017 | 0.017..0.018 | 0.016 | 0.020 | 1.5 | 1.0 | 4 |
| communicationSelect | 0.016 | 0.016..0.017 | 0.017 | 0.019 | 1.4 | 1.0 | 4 |
| communicationTransmit | 0.016 | 0.015..0.017 | 0.016 | 0.017 | 1.4 | 1.0 | 4 |
| mechanics | 0.016 | 0.016..0.017 | 0.015 | 0.018 | 1.4 | 1.0 | 4 |
| localSuccess | 0.015 | 0.015..0.016 | 0.015 | 0.016 | 1.3 | 1.0 | 4 |
| healthUpdate | 0.015 | 0.014..0.015 | 0.014 | 0.015 | 1.3 | 1.0 | 4 |
| chargeFinalize | 0.012 | 0.012..0.013 | 0.012 | 0.013 | 1.0 | 1.0 | 4 |
| gridBuild | 0.011 | 0.011..0.012 | 0.011 | 0.013 | 1.0 | 1.0 | 4 |
| pressure | 0.006 | 0.006..0.007 | 0.006 | 0.007 | 0.6 | 1.0 | 1 |

| group | mean ms | % of GPU sum |
|---|---:|---:|
| force | 0.951 | 81.5 |
| compaction | 0.065 | 5.6 |
| grid | 0.036 | 3.1 |
| communication | 0.032 | 2.8 |
| localSuccessAndHealth | 0.030 | 2.6 |
| charge | 0.030 | 2.5 |
| mechanics | 0.016 | 1.4 |
| pressure | 0.006 | 0.6 |

### N = 1000  (5 rounds, median across rounds)

step 7.571 ms (p95 9.725, p99 10.406) | 91.6 steps/s | 91600 particle-steps/s | GPU sum 1.804 ms (23.9% of step) | GPU span 1.835 ms, idle gaps 0.030 ms

| pass | mean ms | min..max ms | p50 ms | p95 ms | % of GPU sum | dispatches/step | workgroups/dispatch (static) |
|---|---:|---|---:|---:|---:|---:|---|
| force | 1.556 | 1.547..1.558 | 1.552 | 1.618 | 86.2 | 1.0 | 8 |
| deathCompaction | 0.091 | 0.091..0.092 | 0.089 | 0.104 | 5.1 | 1.0 | 8 |
| gridClear | 0.025 | 0.024..0.026 | 0.024 | 0.037 | 1.4 | 1.0 | ceil(cells/128) |
| mechanics | 0.018 | 0.018..0.019 | 0.018 | 0.024 | 1.0 | 1.0 | 8 |
| chargeProcess | 0.018 | 0.018..0.019 | 0.017 | 0.030 | 1.0 | 1.0 | 8 |
| communicationSelect | 0.017 | 0.016..0.017 | 0.016 | 0.026 | 0.9 | 1.0 | 8 |
| communicationTransmit | 0.016 | 0.016..0.017 | 0.014 | 0.027 | 0.9 | 1.0 | 8 |
| localSuccess | 0.016 | 0.015..0.016 | 0.015 | 0.028 | 0.9 | 1.0 | 8 |
| healthUpdate | 0.016 | 0.015..0.017 | 0.015 | 0.021 | 0.9 | 1.0 | 8 |
| chargeFinalize | 0.013 | 0.013..0.014 | 0.012 | 0.025 | 0.7 | 1.0 | 8 |
| gridBuild | 0.012 | 0.011..0.013 | 0.011 | 0.019 | 0.7 | 1.0 | 8 |
| pressure | 0.007 | 0.006..0.007 | 0.006 | 0.009 | 0.4 | 1.0 | 1 |

| group | mean ms | % of GPU sum |
|---|---:|---:|
| force | 1.556 | 86.2 |
| compaction | 0.091 | 5.1 |
| grid | 0.036 | 2.0 |
| communication | 0.032 | 1.8 |
| charge | 0.032 | 1.8 |
| localSuccessAndHealth | 0.032 | 1.7 |
| mechanics | 0.018 | 1.0 |
| pressure | 0.007 | 0.4 |

### N = 2000  (5 rounds, median across rounds)

step 11.184 ms (p95 13.625, p99 15.747) | 69.6 steps/s | 139189 particle-steps/s | GPU sum 2.268 ms (20.3% of step) | GPU span 2.301 ms, idle gaps 0.033 ms

| pass | mean ms | min..max ms | p50 ms | p95 ms | % of GPU sum | dispatches/step | workgroups/dispatch (static) |
|---|---:|---|---:|---:|---:|---:|---|
| force | 1.948 | 1.942..1.985 | 1.936 | 2.047 | 85.9 | 1.0 | 16 |
| deathCompaction | 0.149 | 0.147..0.153 | 0.144 | 0.164 | 6.6 | 1.0 | 16 |
| gridClear | 0.025 | 0.024..0.026 | 0.024 | 0.037 | 1.1 | 1.0 | ceil(cells/128) |
| mechanics | 0.024 | 0.024..0.026 | 0.022 | 0.036 | 1.1 | 1.0 | 16 |
| chargeProcess | 0.020 | 0.019..0.021 | 0.018 | 0.032 | 0.9 | 1.0 | 16 |
| communicationTransmit | 0.018 | 0.016..0.019 | 0.017 | 0.029 | 0.8 | 1.0 | 16 |
| communicationSelect | 0.017 | 0.017..0.018 | 0.015 | 0.029 | 0.8 | 1.0 | 16 |
| healthUpdate | 0.017 | 0.017..0.018 | 0.016 | 0.027 | 0.8 | 1.0 | 16 |
| localSuccess | 0.016 | 0.016..0.017 | 0.015 | 0.029 | 0.7 | 1.0 | 16 |
| gridBuild | 0.013 | 0.013..0.014 | 0.012 | 0.024 | 0.6 | 1.0 | 16 |
| chargeFinalize | 0.013 | 0.013..0.014 | 0.012 | 0.026 | 0.6 | 1.0 | 16 |
| pressure | 0.007 | 0.007..0.008 | 0.006 | 0.008 | 0.3 | 1.0 | 1 |

| group | mean ms | % of GPU sum |
|---|---:|---:|
| force | 1.948 | 85.9 |
| compaction | 0.149 | 6.6 |
| grid | 0.038 | 1.7 |
| communication | 0.035 | 1.5 |
| charge | 0.034 | 1.5 |
| localSuccessAndHealth | 0.034 | 1.5 |
| mechanics | 0.024 | 1.1 |
| pressure | 0.007 | 0.3 |

### N = 5000  (5 rounds, median across rounds)

step 23.645 ms (p95 37.025, p99 81.324) | 36.8 steps/s | 184026 particle-steps/s | GPU sum 5.047 ms (21.3% of step) | GPU span 5.081 ms, idle gaps 0.035 ms

| pass | mean ms | min..max ms | p50 ms | p95 ms | % of GPU sum | dispatches/step | workgroups/dispatch (static) |
|---|---:|---|---:|---:|---:|---:|---|
| force | 4.519 | 4.494..4.527 | 4.507 | 4.658 | 89.5 | 1.0 | 40 |
| deathCompaction | 0.307 | 0.306..0.310 | 0.301 | 0.331 | 6.1 | 1.0 | 40 |
| mechanics | 0.036 | 0.035..0.037 | 0.034 | 0.048 | 0.7 | 1.0 | 40 |
| gridBuild | 0.029 | 0.028..0.031 | 0.027 | 0.041 | 0.6 | 1.0 | 40 |
| chargeProcess | 0.027 | 0.025..0.027 | 0.024 | 0.038 | 0.5 | 1.0 | 40 |
| gridClear | 0.025 | 0.024..0.026 | 0.024 | 0.033 | 0.5 | 1.0 | ceil(cells/128) |
| healthUpdate | 0.023 | 0.022..0.023 | 0.022 | 0.028 | 0.5 | 1.0 | 40 |
| communicationSelect | 0.021 | 0.021..0.021 | 0.021 | 0.032 | 0.4 | 1.0 | 40 |
| communicationTransmit | 0.020 | 0.019..0.021 | 0.020 | 0.021 | 0.4 | 1.0 | 40 |
| localSuccess | 0.017 | 0.016..0.017 | 0.016 | 0.020 | 0.3 | 1.0 | 40 |
| chargeFinalize | 0.016 | 0.016..0.042 | 0.015 | 0.023 | 0.3 | 1.0 | 40 |
| pressure | 0.007 | 0.006..0.007 | 0.006 | 0.009 | 0.1 | 1.0 | 1 |

| group | mean ms | % of GPU sum |
|---|---:|---:|
| force | 4.519 | 89.5 |
| compaction | 0.307 | 6.1 |
| grid | 0.054 | 1.1 |
| charge | 0.043 | 0.9 |
| communication | 0.040 | 0.8 |
| localSuccessAndHealth | 0.040 | 0.8 |
| mechanics | 0.036 | 0.7 |
| pressure | 0.007 | 0.1 |

### N = 10000  (5 rounds, median across rounds)

step 44.967 ms (p95 59.340, p99 70.548) | 19.9 steps/s | 198918 particle-steps/s | GPU sum 10.190 ms (22.7% of step) | GPU span 10.230 ms, idle gaps 0.039 ms

| pass | mean ms | min..max ms | p50 ms | p95 ms | % of GPU sum | dispatches/step | workgroups/dispatch (static) |
|---|---:|---|---:|---:|---:|---:|---|
| force | 9.318 | 9.241..9.352 | 9.251 | 9.586 | 91.4 | 1.0 | 79 |
| deathCompaction | 0.582 | 0.578..0.589 | 0.574 | 0.629 | 5.7 | 1.0 | 79 |
| mechanics | 0.059 | 0.058..0.059 | 0.055 | 0.078 | 0.6 | 1.0 | 79 |
| gridBuild | 0.047 | 0.047..0.050 | 0.044 | 0.058 | 0.5 | 1.0 | 79 |
| chargeProcess | 0.034 | 0.034..0.035 | 0.031 | 0.047 | 0.3 | 1.0 | 79 |
| healthUpdate | 0.032 | 0.032..0.033 | 0.031 | 0.041 | 0.3 | 1.0 | 79 |
| gridClear | 0.026 | 0.025..0.026 | 0.024 | 0.037 | 0.3 | 1.0 | ceil(cells/128) |
| communicationTransmit | 0.024 | 0.023..0.025 | 0.024 | 0.026 | 0.2 | 1.0 | 79 |
| communicationSelect | 0.024 | 0.023..0.024 | 0.024 | 0.026 | 0.2 | 1.0 | 79 |
| chargeFinalize | 0.022 | 0.022..0.023 | 0.021 | 0.025 | 0.2 | 1.0 | 79 |
| localSuccess | 0.020 | 0.019..0.021 | 0.019 | 0.025 | 0.2 | 1.0 | 79 |
| pressure | 0.006 | 0.006..0.007 | 0.006 | 0.007 | 0.1 | 1.0 | 1 |

| group | mean ms | % of GPU sum |
|---|---:|---:|
| force | 9.318 | 91.4 |
| compaction | 0.582 | 5.7 |
| grid | 0.073 | 0.7 |
| mechanics | 0.059 | 0.6 |
| charge | 0.057 | 0.6 |
| localSuccessAndHealth | 0.052 | 0.5 |
| communication | 0.048 | 0.5 |
| pressure | 0.006 | 0.1 |
