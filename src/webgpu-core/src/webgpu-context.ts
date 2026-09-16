export class WebGPUContext {
  public async init() {
    if (!navigator.gpu) throw new Error('WebGPU not supported');
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) throw new Error('No adapter');
    const device = await adapter.requestDevice();
    return { adapter, device };
  }
}
export type GPUBufferUsage = number;
export const createBuffer = (device: GPUDevice, size: number, usage: GPUBufferUsage) => {
  return device.createBuffer({ size, usage });
};
