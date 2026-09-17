# Phase 12: Public Research Release

## Objective

Publish the Continuous Evolutionary Particle Computation (CEPC) simulator as a reproducible scientific web application. This phase transforms the validated implementation into a public, user‑friendly research platform that can be accessed via GitHub Pages, with clear documentation, presets, and reproducibility guarantees.

## Goals

- Make the simulator accessible to external researchers via a public URL.
- Provide a complete, versioned release that includes the model specification, implementation, experiment runner, and documentation.
- Ensure reproducibility: users can run the same experiments with the same seed and configuration and obtain identical results.
- Deliver a polished user experience with preset experiments, clear instructions, and export capabilities.
- Document known limitations and version history.

## Detailed Tasks

### 1. Final Documentation

 - Update the top‑level `README.md` with:
   - A concise overview of CEPC and its scientific goals.
   - A link to the public GitHub Pages URL.
   - Instructions for running the simulator locally (if desired).
   - A summary of the validated parameter range and performance envelope (referencing the validation report from Phase 11).
   - Links to the model specification, implementation details, and experiment instructions.
 - Create a `docs/user-guide.md` (or update the existing developer guide) that explains:
   - How to use the web UI (play/pause, speed control, debug overlays).
   - How to select and configure experiments.
   - How to export results and metadata.
   - How to interpret metrics (charge flow, population dynamics, error, etc.).
 - Create a `docs/reproducibility.md` that details:
   - How seeds are handled.
   - How to save and load checkpoints.
   - How to export experiment manifests and results for external analysis.
   - How to verify reproducibility (e.g., by comparing outputs with the validation report).
 - Ensure all documentation is version‑controlled and linked from the repository root.

### 2. Model Specification Link

 - Add a clear link to the frozen MFM v3 specification in the repository (e.g., `docs/Minimal_Formal_Model_v3.md`).
 - Provide a brief summary of the model’s key invariants and the fact that the implementation must never diverge from the spec.
 - Include a reference to the `MFM-to-Code Traceability Matrix` in `docs/Reference_Implementation.md` to show how each MFM element maps to code.

### 3. Reproducibility Instructions

 - Document how to run a deterministic simulation:
   - Choose a seed (explicit in the UI or manifest).
   - Select an experiment manifest.
   - Run the simulation and record the output.
   - Verify that the same seed and manifest produce identical results across runs.
 - Provide example commands (if the user wants to run locally) and UI steps for the browser.
 - Explain how to export the experiment manifest and results as JSON for external analysis.
 - Mention that the model version and git commit hash are recorded in the UI and in exported metadata.

### 4. Preset Experiments

 - Curate a set of preset experiments that showcase the capabilities of the platform:
   - Basic P0‑P4 protocols (from Stage IV).
   - Memory tasks (delay memory, XOR/parity).
   - Nonlinear tasks (NARMA‑10, Mackey‑Glass, Lorenz).
   - Continual learning (A→B→A, drift, abrupt shifts).
   - Robustness (damage/recovery).
 - For each preset, provide:
   - A short description of the scientific question.
   - The experiment manifest (JSON/YAML) stored in `experiments/presets/`.
   - Expected results or typical behavior (e.g., “the system should learn to predict the input after ~10k steps”).
 - Ensure the presets can be loaded with a single click in the UI.

### 5. README and Release Notes

 - Update the repository `README.md` with a clear “Public Release” section.
 - Add release notes for the first public version (e.g., v0.1.0) summarizing:
   - Implemented features (MFM v3, CPU reference, C++ oracle, WebGPU backend, experiment runner).
   - Validation status (reference Phase 11 validation report).
   - Known limitations (e.g., maximum population size in browser, GPU memory constraints).
   - Future work (e.g., additional experiments, performance optimizations).
 - Include badges for build status, test coverage, and validation status.

### 6. GitHub Pages Deployment

 - Configure GitHub Actions to build the static web application and deploy it to GitHub Pages.
 - Ensure the Vite `base` path is set correctly for the repository (e.g., `/continuous-evolutionary-particle-computation/`).
 - Verify that the deployment workflow:
   - Installs dependencies (`pnpm install`).
   - Runs tests and linting.
   - Builds the WebGPU/React UI (`pnpm run build`).
   - Deploys the `dist/` folder to the `gh-pages` branch or uses the `actions/deploy-pages` action.
 - Add a manual trigger for deployment (`workflow_dispatch`) and protect the `main` branch with required checks.
 - Test the deployment on a preview environment before merging to `main`.

### 7. Experiment Export

 - Ensure the UI allows users to export:
   - The experiment manifest (JSON).
   - Simulation results (metrics, trajectories, checkpoints).
   - Metadata (model version, git commit hash, seed, configuration).
 - Provide a download button that packages the exported data into a zip file.
 - Validate that the exported data can be re‑imported and reproduced locally.

### 8. Version Manifest

 - Create a `version.json` (or similar) that records:
   - Model version (e.g., MFM v3.0.0).
   - Software version (e.g., cepec‑v0.1.0).
   - Git commit hash.
   - Build timestamp.
   - Validation report version.
 - Load this manifest in the UI and display it in an “About” dialog.
 - Ensure the manifest is updated automatically during the build process.

### 9. Known Limitations

 - Document the current limitations of the public release:
   - Maximum population size supported in the browser (e.g., ~1e5 particles on typical hardware).
   - GPU memory constraints and WebGPU compatibility (list supported browsers).
   - Performance degradation for very long simulations (suggest checkpointing).
   - Any known numerical divergences between CPU and GPU backends for extreme parameter regimes.
   - Lack of support for offline use (requires WebGPU‑capable browser).
 - Provide guidance on how to work around these limitations (e.g., reduce population size, use CPU fallback).

### 10. Final Testing and Quality Assurance

 - Perform end‑to‑end testing of the public release:
   - Load the public URL.
   - Run each preset experiment.
   - Verify that the UI is responsive and that metrics are displayed correctly.
   - Export results and verify that they can be re‑imported.
   - Check that the version manifest is displayed correctly.
 - Run the validation harness one final time to ensure that the released build matches the validated implementation.
 - Conduct a manual accessibility check (e.g., keyboard navigation, screen reader compatibility) if resources allow.

## Deliverables

 - Updated `README.md` with public release information.
 - User guide (`docs/user-guide.md`) and reproducibility guide (`docs/reproducibility.md`).
 - Preset experiments in `experiments/presets/` with corresponding manifests.
 - GitHub Pages deployment workflow (`.github/workflows/deploy.yml`) that builds and deploys the static site.
 - Experiment export functionality in the UI.
 - Version manifest (`version.json`) and “About” dialog in the UI.
 - Known limitations documentation.
 - Final validation report referencing the public release.

## Acceptance Criteria (Exit Conditions for Phase 12)

The following must succeed:

```bash
# Build and deploy the public site
pnpm install
pnpm run build
pnpm run test
pnpm run lint
# Deploy to GitHub Pages (via CI)
```

Specifically:
 - The public URL (e.g., https://<org>.github.io/continuous-evolutionary-particle-computation/) loads the simulator without errors.
 - All preset experiments can be loaded and run with a single click.
 - The UI displays the model version, software version, and git commit hash.
 - Users can export the experiment manifest and results as a zip file.
 - The exported data can be re‑imported and reproduced with the same seed.
 - The documentation (README, user guide, reproducibility guide) is complete and linked from the repository root.
 - The validation report from Phase 11 is linked and indicates that the released build is validated.
 - Known limitations are documented and visible to users.

## Dependencies and Tool Versions (inherited from previous phases)

 - Node.js: >=18.x (LTS)
 - pnpm: >=8.x
 - TypeScript: >=5.0
 - Vite: >=5.0
 - WebGPU: supported browser (Chrome, Edge, etc.)
 - GitHub Actions: for CI/CD

## Notes for Future Work

 - Consider adding user accounts or experiment sharing features in a future release.
 - Additional experiments can be added as new presets without changing the core code.
 - Performance optimizations may be pursued in a separate phase, but any changes must be validated against the reference implementations.
 - The public release should be versioned (semantic versioning) and each release should be accompanied by a validation report.

## Checklist

 - [ ] README updated with public release information
 - [ ] User guide and reproducibility guide written
 - [ ] Model specification linked and summarized
 - [ ] Reproducibility instructions documented
 - [ ] Preset experiments curated and stored in `experiments/presets/`
 - [ ] Release notes created for v0.1.0
 - [ ] GitHub Pages deployment workflow configured and tested
 - [ ] Experiment export functionality implemented in UI
 - [ ] Version manifest created and displayed in UI
 - [ ] Known limitations documented
 - [ ] Final end‑to‑end testing performed
 - [ ] Acceptance criteria checks pass

---

*This plan is derived from the Implementation Phases section (32) of the Reference Implementation and the broader documentation in `/docs/` (especially the Reference Implementation phases and the public release requirements). It is intended to be executed after Phase 11 (Scientific Validation and Performance Characterization) is complete and marks the final step of Stage V.*
