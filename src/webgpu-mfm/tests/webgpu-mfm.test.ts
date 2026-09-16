import { describe, it, expect } from 'vitest';
describe('WebGPU MFM', () => {
  it('stepper exists', () => {
    const { MfmWebGPUStepper } = await import('../src/MfmWebGPUStepper.js');
    expect(MfmWebGPUStepper).toBeDefined();
  });
});
