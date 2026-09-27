# User Guide

## Overview

 CEPC is a web-based simulator for Continuous Evolutionary Particle Computation. This guide explains how to use the UI and interpret results.

## Using the Web UI

- **Play/Pause**: Start or pause the simulation.
- **Step**: Advance one step when paused.
- **Reset**: Reload initial configuration.
- **Speed**: Adjust steps per frame.
- **Metrics**: Population count, average health, total charge, and FPS are displayed in real time.
- **Backend Indicator**: Shows CPU or WebGPU backend.

## Selecting Experiments

 Preset experiments are available in `experiments/presets/`. Load a manifest via the UI or programmatically:

 ```ts
 import { loadManifest } from '@cepc/experiment-api';
 const manifest = loadManifest('experiments/presets/P0-manifest.json');
 ```

## Exporting Results

 Click the export button to download a zip containing:

- Experiment manifest (JSON)
- Metrics (CSV/JSON)
- Metadata (model version, git commit, seed)

## Interpreting Metrics

- **Charge flow**: Total charge reflects computational resource usage.
- **Population dynamics**: Births/deaths indicate evolutionary pressure.
- **Error**: Prediction error for readout tasks.

 See `docs/reproducibility.md` for reproducibility details.
