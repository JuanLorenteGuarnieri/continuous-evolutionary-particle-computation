# Performance Optimization

This document outlines performance optimization strategies for the CEPC platform.

## WebGPU Optimization

### Compute Shader Optimization
- Optimal workgroup sizes (typically 64, 128, or 256 threads)
- Minimize memory bandwidth usage
- Use shared memory for frequent data access
- Reduce register pressure
- Coalesced memory access patterns

### Algorithm Optimization
- Spatial hashing for neighbor search (O(N) vs O(N²))
- Early exit conditions in shaders
- Loop unrolling where beneficial
- Constant optimization

## JavaScript/Web Worker Optimization

### Data Transfer
- Use transferable objects (ArrayBuffer) to avoid data copying
- Batch updates to reduce message passing overhead
- Use structured cloning efficiently

### React Optimization
- Memoize expensive computations with useMemo and useCallback
- Virtual scrolling for large lists of particles
- ShouldComponentUpdate or React.memo for pure components
- Lazy loading of non-critical components

## Memory Management
- Object pooling for frequently allocated/deallocated objects
- Efficient data structures for particle storage
- Minimize garbage collection pressure
- Dispose of WebGPU resources properly

## Device Adaptive Quality
- Detect device capabilities and adjust simulation quality
- Reduce particle count on low-end devices
- Lower simulation resolution when needed
- Fallback to CPU rendering if WebGPU performance is inadequate

## Profiling Tools
- Chrome DevTools Performance tab
- WebGPU Inspector (when available)
- Frame rate monitoring
- Memory usage tracking
- GPU utilization metrics

## Phase 17 - GPU kernel optimization (hardware GPU timing)

First hardware GPU baseline and A/B (Intel HD Graphics 520): see docs/phases/17-phase17-gpu-kernel-optimization.md, performance/phase17/README.md and performance/benchmark-history.md.

- Death compaction runs a parallel stable-scan kernel by default (KernelOptions.deathCompaction); the Phase 16 serial kernel remains selectable (--death-compaction serial). GPU time of that pass fell 75-94 %.
- Regression guard for that kernel on a real GPU: node tools/bench/benchmark-webgpu.mjs --selftest --real-gpu --headed --base-url <preview url> --out performance/phase17/kernel-selftest.json (exact-output check, exits non-zero on any mismatch).
- Reproduce the A/B: tools/bench/run-phase17-ab.ps1; compare with tools/bench/compare-gpu-profiles.mjs; summarize with tools/bench/summarize-gpu-profile.mjs.

