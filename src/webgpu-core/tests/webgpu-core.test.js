import { describe, it, expect } from 'vitest';
describe('WebGPU core', () => {
    it('buffers serialize', async () => {
        const { serializeParticles } = await import('../src/buffers.js');
        const buf = serializeParticles([]);
        expect(buf).toBeInstanceOf(Float32Array);
    });
});
