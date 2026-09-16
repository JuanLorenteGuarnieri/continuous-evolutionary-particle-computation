export class MfmWebGPUStepper {
  constructor(private device: GPUDevice) {}
  async init() {}
  async step() {}
  async saveState() { return {}; }
  async loadState(state: any) {}
}
export type WebGPUMFMConfig = {
  Lx: number;
  Ly: number;
  Nmax: number;
};
