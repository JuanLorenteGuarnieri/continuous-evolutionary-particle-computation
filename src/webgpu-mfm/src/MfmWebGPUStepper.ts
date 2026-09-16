export class MfmWebGPUStepper {
  constructor(private device: GPUDevice) {}
  async init() {}
  async step() {}
  async saveState() { return {}; }
  async loadState(state: Record<string, unknown>) {}
}
export type WebGPUMFMConfig = {
  Lx: number;
  Ly: number;
  Nmax: number;
};
