// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
export class WebGPUContext {
  private context: GPUCanvasContext | null = null;
  private device: GPUDevice | null = null;

  public async init(canvas: HTMLCanvasElement | OffscreenCanvas) {
    if (!navigator.gpu) throw new Error('WebGPU not supported');
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) throw new Error('No adapter');
    const device = await adapter.requestDevice();

    const context = canvas.getContext('webgpu');
    if (!context) throw new Error('WebGPU context unavailable');
    const format = navigator.gpu.getPreferredCanvasFormat();
    context.configure({
      device,
      format,
      alphaMode: 'opaque'
    });

    this.context = context;
    this.device = device;

    return { adapter, device, context, format };
  }

  public destroy(): void {
    this.context = null;
    this.device = null;
  }
}

export type GPUBufferUsage = number;

export const createBuffer = (device: GPUDevice, size: number, usage: GPUBufferUsage) => {
  return device.createBuffer({ size, usage });
};

export const createBindGroupLayout = (device: GPUDevice, entries: GPUBindGroupLayoutEntry[]): GPUBindGroupLayout => {
  return device.createBindGroupLayout({ entries });
};

export const createBindGroup = (device: GPUDevice, layout: GPUBindGroupLayout, entries: GPUBindGroupEntry[]): GPUBindGroup => {
  return device.createBindGroup({ layout, entries });
};

export const createPipelineLayout = (device: GPUDevice, bindGroupLayouts: GPUBindGroupLayout[]): GPUPipelineLayout => {
  return device.createPipelineLayout({ bindGroupLayouts });
};

