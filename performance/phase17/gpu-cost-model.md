# GPU cost model — tag "baseline"

Adapters: intel gen-9 0x1916 Intel(R) HD Graphics 520

### N = 200  (3 rounds, median across rounds)

step 6.101 ms (p95 9.405, p99 22.502) | 100.6 steps/s | 20111 particle-steps/s | GPU sum 0.713 ms (11.7% of step) | GPU span 0.742 ms, idle gaps 0.029 ms

| pass | mean ms | min..max ms | p50 ms | p95 ms | % of GPU sum | dispatches/step | workgroups/dispatch (static) |
|---|---:|---|---:|---:|---:|---:|---|
| force | 0.363 | 0.363..0.363 | 0.361 | 0.370 | 51.0 | 1.0 | 2 |
| deathCompaction | 0.207 | 0.206..0.207 | 0.205 | 0.212 | 29.0 | 1.0 | 2 |
| gridClear | 0.024 | 0.024..0.024 | 0.024 | 0.025 | 3.4 | 1.0 | ceil(cells/128) |
| chargeProcess | 0.016 | 0.016..0.017 | 0.016 | 0.017 | 2.3 | 1.0 | 2 |
| communicationSelect | 0.016 | 0.015..0.016 | 0.016 | 0.017 | 2.2 | 1.0 | 2 |
| mechanics | 0.015 | 0.015..0.015 | 0.015 | 0.016 | 2.1 | 1.0 | 2 |
| localSuccess | 0.015 | 0.015..0.015 | 0.015 | 0.015 | 2.1 | 1.0 | 2 |
| communicationTransmit | 0.015 | 0.015..0.015 | 0.014 | 0.016 | 2.1 | 1.0 | 2 |
| healthUpdate | 0.014 | 0.014..0.014 | 0.014 | 0.015 | 2.0 | 1.0 | 2 |
| chargeFinalize | 0.011 | 0.011..0.012 | 0.011 | 0.012 | 1.6 | 1.0 | 2 |
| gridBuild | 0.011 | 0.011..0.011 | 0.011 | 0.011 | 1.5 | 1.0 | 2 |
| pressure | 0.006 | 0.006..0.007 | 0.006 | 0.007 | 0.9 | 1.0 | 1 |

| group | mean ms | % of GPU sum |
|---|---:|---:|
| force | 0.363 | 51.0 |
| compaction | 0.207 | 29.0 |
| grid | 0.035 | 4.9 |
| communication | 0.030 | 4.2 |
| localSuccessAndHealth | 0.029 | 4.0 |
| charge | 0.028 | 4.0 |
| mechanics | 0.015 | 2.1 |
| pressure | 0.006 | 0.9 |

Timestamp instrumentation overhead: 6.101 ms vs 5.247 ms without (16.3%, 3 pair(s)).

### N = 500  (3 rounds, median across rounds)

step 7.646 ms (p95 11.305, p99 14.145) | 58.9 steps/s | 29462 particle-steps/s | GPU sum 1.614 ms (21.0% of step) | GPU span 1.645 ms, idle gaps 0.031 ms

| pass | mean ms | min..max ms | p50 ms | p95 ms | % of GPU sum | dispatches/step | workgroups/dispatch (static) |
|---|---:|---|---:|---:|---:|---:|---|
| force | 0.969 | 0.958..0.973 | 0.941 | 1.018 | 59.8 | 1.0 | 4 |
| deathCompaction | 0.498 | 0.486..0.505 | 0.478 | 0.522 | 31.1 | 1.0 | 4 |
| gridClear | 0.024 | 0.024..0.025 | 0.024 | 0.026 | 1.5 | 1.0 | ceil(cells/128) |
| chargeProcess | 0.017 | 0.017..0.017 | 0.016 | 0.018 | 1.1 | 1.0 | 4 |
| communicationTransmit | 0.017 | 0.016..0.017 | 0.016 | 0.017 | 1.0 | 1.0 | 4 |
| mechanics | 0.016 | 0.016..0.016 | 0.015 | 0.028 | 1.0 | 1.0 | 4 |
| communicationSelect | 0.016 | 0.016..0.017 | 0.015 | 0.018 | 1.0 | 1.0 | 4 |
| localSuccess | 0.015 | 0.015..0.016 | 0.015 | 0.016 | 0.9 | 1.0 | 4 |
| healthUpdate | 0.015 | 0.014..0.016 | 0.014 | 0.016 | 0.9 | 1.0 | 4 |
| chargeFinalize | 0.012 | 0.012..0.013 | 0.012 | 0.013 | 0.7 | 1.0 | 4 |
| gridBuild | 0.011 | 0.011..0.011 | 0.011 | 0.011 | 0.7 | 1.0 | 4 |
| pressure | 0.006 | 0.006..0.007 | 0.006 | 0.007 | 0.4 | 1.0 | 1 |

| group | mean ms | % of GPU sum |
|---|---:|---:|
| force | 0.969 | 59.8 |
| compaction | 0.498 | 31.1 |
| grid | 0.035 | 2.2 |
| communication | 0.032 | 2.0 |
| localSuccessAndHealth | 0.030 | 1.8 |
| charge | 0.029 | 1.8 |
| mechanics | 0.016 | 1.0 |
| pressure | 0.006 | 0.4 |

Timestamp instrumentation overhead: 7.646 ms vs 6.327 ms without (20.8%, 3 pair(s)).

### N = 1000  (3 rounds, median across rounds)

step 8.627 ms (p95 11.400, p99 13.414) | 84.5 steps/s | 84517 particle-steps/s | GPU sum 2.707 ms (31.5% of step) | GPU span 2.737 ms, idle gaps 0.030 ms

| pass | mean ms | min..max ms | p50 ms | p95 ms | % of GPU sum | dispatches/step | workgroups/dispatch (static) |
|---|---:|---|---:|---:|---:|---:|---|
| force | 1.574 | 1.564..1.579 | 1.546 | 1.635 | 58.1 | 1.0 | 8 |
| deathCompaction | 0.976 | 0.947..0.982 | 0.960 | 1.008 | 36.0 | 1.0 | 8 |
| gridClear | 0.024 | 0.024..0.025 | 0.024 | 0.031 | 0.9 | 1.0 | ceil(cells/128) |
| mechanics | 0.018 | 0.018..0.018 | 0.018 | 0.019 | 0.7 | 1.0 | 8 |
| chargeProcess | 0.017 | 0.017..0.018 | 0.017 | 0.024 | 0.6 | 1.0 | 8 |
| communicationTransmit | 0.017 | 0.015..0.018 | 0.017 | 0.028 | 0.6 | 1.0 | 8 |
| communicationSelect | 0.017 | 0.016..0.039 | 0.014 | 0.027 | 0.6 | 1.0 | 8 |
| healthUpdate | 0.016 | 0.016..0.016 | 0.015 | 0.027 | 0.6 | 1.0 | 8 |
| localSuccess | 0.016 | 0.015..0.016 | 0.015 | 0.027 | 0.6 | 1.0 | 8 |
| chargeFinalize | 0.013 | 0.013..0.014 | 0.012 | 0.014 | 0.5 | 1.0 | 8 |
| gridBuild | 0.012 | 0.012..0.012 | 0.011 | 0.015 | 0.4 | 1.0 | 8 |
| pressure | 0.007 | 0.007..0.007 | 0.006 | 0.011 | 0.3 | 1.0 | 1 |

| group | mean ms | % of GPU sum |
|---|---:|---:|
| force | 1.574 | 58.1 |
| compaction | 0.976 | 36.0 |
| grid | 0.036 | 1.3 |
| communication | 0.034 | 1.2 |
| localSuccessAndHealth | 0.032 | 1.2 |
| charge | 0.031 | 1.1 |
| mechanics | 0.018 | 0.7 |
| pressure | 0.007 | 0.3 |

Timestamp instrumentation overhead: 8.627 ms vs 8.953 ms without (-3.6%, 3 pair(s)).

### N = 2000  (3 rounds, median across rounds)

step 12.788 ms (p95 15.415, p99 17.200) | 62.5 steps/s | 124906 particle-steps/s | GPU sum 4.032 ms (31.5% of step) | GPU span 4.063 ms, idle gaps 0.032 ms

| pass | mean ms | min..max ms | p50 ms | p95 ms | % of GPU sum | dispatches/step | workgroups/dispatch (static) |
|---|---:|---|---:|---:|---:|---:|---|
| force | 1.968 | 1.965..1.986 | 1.963 | 2.052 | 48.8 | 1.0 | 16 |
| deathCompaction | 1.895 | 1.890..1.912 | 1.891 | 1.950 | 47.0 | 1.0 | 16 |
| gridClear | 0.025 | 0.024..0.025 | 0.024 | 0.037 | 0.6 | 1.0 | ceil(cells/128) |
| mechanics | 0.024 | 0.023..0.024 | 0.022 | 0.036 | 0.6 | 1.0 | 16 |
| chargeProcess | 0.020 | 0.020..0.021 | 0.018 | 0.032 | 0.5 | 1.0 | 16 |
| healthUpdate | 0.018 | 0.017..0.019 | 0.017 | 0.030 | 0.4 | 1.0 | 16 |
| communicationSelect | 0.018 | 0.018..0.018 | 0.017 | 0.030 | 0.4 | 1.0 | 16 |
| communicationTransmit | 0.017 | 0.017..0.018 | 0.015 | 0.030 | 0.4 | 1.0 | 16 |
| localSuccess | 0.017 | 0.015..0.017 | 0.015 | 0.029 | 0.4 | 1.0 | 16 |
| chargeFinalize | 0.014 | 0.013..0.014 | 0.013 | 0.026 | 0.3 | 1.0 | 16 |
| gridBuild | 0.013 | 0.013..0.014 | 0.013 | 0.014 | 0.3 | 1.0 | 16 |
| pressure | 0.007 | 0.007..0.007 | 0.006 | 0.007 | 0.2 | 1.0 | 1 |

| group | mean ms | % of GPU sum |
|---|---:|---:|
| force | 1.968 | 48.8 |
| compaction | 1.895 | 47.0 |
| grid | 0.038 | 0.9 |
| communication | 0.036 | 0.9 |
| localSuccessAndHealth | 0.035 | 0.9 |
| charge | 0.033 | 0.8 |
| mechanics | 0.024 | 0.6 |
| pressure | 0.007 | 0.2 |

Timestamp instrumentation overhead: 12.788 ms vs 12.841 ms without (-0.4%, 3 pair(s)).
