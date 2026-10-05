import { describe, it, expect } from 'vitest';
describe('WebGPU MFM', () => {
    it('stepper exists', async () => {
        const { MfmWebGPUStepper } = await import('../src/MfmWebGPUStepper.ts');
        expect(MfmWebGPUStepper).toBeDefined();
    });
});
