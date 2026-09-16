export class WebGPUContext {
  public async init(canvas: HTMLCanvasElement | OffscreenCanvas) {
    if (!navigator.gpu) throw new Error('WebGPU not supported');
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) throw new Error('No adapter');
    const device = await adapter.requestDevice();
    
    // Configure the canvas for WebGPU
    const context = canvas.getContext('webgpu');
    const format = navigator.gpu.getPreferredCanvasFormat();
    context.configure({
      device,
      format,
      alphaMode: 'opaque'
    });
    
    return { adapter, device, context, format };
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

