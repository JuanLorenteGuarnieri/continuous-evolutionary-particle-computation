 # Reproducibility Guide
 
 ## Seeds and Determinism
 Each experiment manifest contains a `seed` in `mfmConfig.seed`. The same seed and manifest produce identical results across runs.
 
 ## Saving and Loading Checkpoints
 Checkpoints can be saved via the UI or programmatically. The checkpoint includes population state, timestep, and RNG state.
 
 ## Exporting Manifests and Results
 Exported packages contain:
 - `manifest.json`: experiment configuration
 - `results.json`: metrics and trajectories
 - `metadata.json`: model version, git commit hash, seed, build timestamp
 
 ## Verifying Reproducibility
 1. Load the exported manifest.
 2. Run with the same seed.
 3. Compare output charges and metrics. They should match exactly for CPU backend and be statistically equivalent for GPU.
 
 ## Versioning
 The version manifest `version.json` records model version, software version, git commit, and validation report version. This is displayed in the About dialog.
