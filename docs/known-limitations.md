# Known Limitations

## Browser Constraints

- Maximum population size in browser: ~1e5 particles on typical hardware
- WebGPU required: Supported browsers: Chrome, Edge (WebGPU enabled)
- Memory usage: < 512 MB for WebGPU backend

## Performance

- Performance degrades for very long simulations; use checkpointing
- Numerical divergence may occur for extreme parameter regimes

## Offline Use

- Requires WebGPU-capable browser; no offline support

## Workarounds

- Reduce population size
- Use CPU fallback
- Enable checkpointing
