 # Experiment Manifests
 
 This directory contains JSON manifests for Stage IV experiments as defined in `docs/phases/10-phase10.md`.
 
 Each manifest specifies the configuration for a particular experiment, including the MFM configuration, input signals, readout configuration, duration, and metrics to collect.
 
 ## Usage
 
 Manifests can be loaded using the `loadManifest` function from `@cepc/experiment-api`:
 
 ```ts
 import { loadManifest } from '@cepc/experiment-api';
 import { ExperimentRunner } from '@cepc/experiment-api';
 
 const manifest = loadManifest('configs/experiments/P0-manifest.json');
 const runner = new ExperimentRunner(manifest);
 const result = await runner.run();
 console.log(result);
 ```
 
 ## Available Experiments
 
 - P0-manifest.json: Fixed non-evolving medium
 - P1-manifest.json: Health and death dynamics
 - P2-manifest.json: Local reproduction without mutation
 - P3-manifest.json: Mutation enabled
 - P4-manifest.json: Global error-modulated turnover
 - DelayMemory-manifest.json: Delay reconstruction memory task
 - XORParity-manifest.json: XOR/parity logic gate
 - NARMA10-manifest.json: NARMA-10 nonlinear autoregressive moving average
 - MackeyGlass-manifest.json: Mackey-Glass chaotic time series prediction
 - Lorenz-manifest.json: Lorenz chaotic system prediction
 - RegimeClassification-manifest.json: Controlled frequency/regime classification
 - ABABamanifest.json: A→B→A sequence learning
 - Drift-manifest.json: Gradual drift in input statistics
 - AbruptShifts-manifest.json: Abrupt shifts in input statistics
 - DamageRecovery-manifest.json: Damage and recovery simulations
 
 All manifests follow the schema defined in `src/shared-config/src/ExperimentManifest.ts`.
