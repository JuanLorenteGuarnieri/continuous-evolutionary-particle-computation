// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
export class MfmWebGPUStepper {
  constructor(private device: GPUDevice) {}
  async init() {}
  async step() {}
  async saveState() { return {}; }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async loadState(_state: Record<string, unknown>) {}
}
export type WebGPUMFMConfig = {
  Lx: number;
  Ly: number;
  Nmax: number;
};
