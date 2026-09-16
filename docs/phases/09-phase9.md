# Phase 9: GPU Metrics, Rendering and Realtime Loop

## Objective

Create the public interactive simulation.

## Goals

- Implement a render pipeline that visualizes the particle simulation using WebGPU.
- Define particle visual encoding (e.g., color, size) based on particle state (health, charge, etc.).
- Implement metrics reductions to collect and display key simulation metrics (e.g., population count, average health, charge distribution).
- Decouple the simulation loop from the render loop to allow independent control of simulation speed and render frame rate.
- Provide interactive controls for pause, step, and reset.
- Implement speed control to adjust the number of simulation steps per render frame.
- Add debug overlays to show internal state (e.g., backend indicator showing whether CPU or GPU backend is active).
- Ensure the simulation remains interactive and responsive.

## Detailed Tasks

### 1. Render Pipeline Setup

- Create the WebGPU render pipeline within the GPU backend package (`src/webgpu-core`).
- Set up the swap chain, render pass, and output to an OffscreenCanvas (or canvas) that is displayed in the React UI.
- Configure the render pipeline to accept vertex buffers (positions) and instance attributes (for per-particle visual encoding).

### 2. Particle Visual Encoding

- Define a mapping from particle dynamic state (health, charge, etc.) to visual attributes (color, radius, opacity).
- Create a buffer for visual attributes that is updated each simulation step (or derived in the shader).
- Implement the vertex shader to transform positions to clip space and pass visual attributes to the fragment shader.
- Implement the fragment shader to output the particle color (e.g., as circles or sprites).

### 3. Metrics Reductions

- Identify key metrics to display: population count, average health, total charge, etc.
- Implement reduction kernels in WebGPU to compute these metrics from the particle buffers.
- Ensure metrics are read back to the CPU (or made available via uniform buffers) for display in the UI.
- Update the metrics at a reasonable frequency (e.g., every simulation step or every N steps).

### 4. Simulation/Render Decoupling

- Separate the simulation tick rate from the render frame rate.
- Allow the simulation to run multiple steps per render frame (configurable via speed control).
- Ensure that the render loop only reads the simulation state (positions, etc.) after the simulation step(s) for that frame are complete.
- Use double-buffering or synchronization to avoid tearing or inconsistent state.

### 5. Interactive Controls

- Implement pause/step/reset buttons in the React UI that send commands to the simulation worker.
- Pause: halt the simulation loop.
- Step: advance the simulation by a fixed number of steps (e.g., one step) when paused.
- Reset: reload the initial configuration and restart the simulation from step 0.

### 6. Speed Control

- Add a slider or input control to set the number of simulation steps per render frame.
- Update the simulation loop to use this value to determine how many steps to execute before rendering.

### 7. Debug Overlays

- Create an overlay that displays the current backend (CPU reference or GPU WebGPU) and other debugging information (e.g., current simulation step, FPS).
- Optionally, add overlays to visualize internal buffers (e.g., charge distribution) for debugging.

### 8. Backend Indicator

- Ensure the UI shows which backend is currently active (CPU or GPU) and switches automatically if WebGPU is not available.
- Provide a way to manually select the backend for testing (optional).

### 9. Integration with Experiment API

- Ensure that the render loop and controls work seamlessly with the experiment API (to be implemented in later phases) so that experiments can be run and visualized.

### 10. Testing and Validation

- Write unit tests for the render pipeline components (shader compilation, pipeline creation).
- Write integration tests that verify the simulation renders correctly (e.g., snapshot testing or checking that the canvas is not empty).
- Validate that the visual encoding correctly represents the particle state (e.g., by comparing with known states).

## Deliverables

- A functional WebGPU render pipeline in `src/webgpu-core`.
- Updated simulation worker (`src/web-worker`) that handles render commands and decouples simulation from rendering.
- A React UI (`src/react-ui`) with controls for pause, step, reset, speed, and a display for metrics and backend indicator.
- Updated experiment API (if needed) to support visualization.
- Documentation updates in `docs/` (e.g., in the developer guide) explaining the rendering architecture.

## Acceptance Criteria (Exit Conditions for Phase 9)

The following conditions must be met:

1. The application can be built and run locally (`pnpm install`, `pnpm dev` or equivalent).
2. The simulation initializes and renders particles on the canvas.
3. The simulation can be paused, stepped, and reset via the UI.
4. The simulation speed can be adjusted, and the number of steps per frame changes accordingly.
5. The backend indicator correctly shows whether the CPU or GPU backend is active.
6. Key metrics (population, health, charge) are displayed and update in real time.
7. The simulation remains interactive (UI responsive) even when running at high simulation speeds.
8. All existing tests continue to pass (no regressions).

## Dependencies and Tool Versions (as of phase 9)

- Inherit from Phase 0: Node.js, pnpm, TypeScript, Vitest, ESLint, Prettier, etc.
- For WebGPU: No additional dependencies beyond the browser API (but we rely on the user's browser supporting WebGPU; we have a CPU fallback).
- For rendering: We may use a library like `@webgpu/types` for TypeScript definitions, but the implementation is raw WebGPU.

## Notes for Future Phases

- Phase 10 will implement the experiment runner, which will rely on the visualization and controls built in this phase.
- Ensure that the simulation worker API is stable and well-defined for the experiment API to control.
- Consider performance optimizations for the render pipeline (e.g., instanced rendering, efficient attribute updates) in later phases if needed.
- The CPU fallback should also support the same visualization (using the CPU reference backend) so that the UI works regardless of backend.

## Checklist

- [ ] WebGPU render pipeline created and integrated.
- [ ] Particle visual encoding implemented.
- [ ] Metrics reductions and display working.
- [ ] Simulation/render decoupling implemented.
- [ ] Pause/step/reset controls functional.
- [ ] Speed control functional.
- [ ] Debug overlays and backend indicator implemented.
- [ ] Integration with experiment API (placeholder) verified.
- [ ] Unit and integration tests passing.
- [ ] Acceptance criteria met in local development environment.

--- 

*This plan is derived from the Implementation Phases section (32) of the Reference Implementation and the broader documentation in `/docs/`. It is intended to be executed after the successful completion of Phase 8.*
