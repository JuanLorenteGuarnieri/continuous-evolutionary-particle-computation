// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
export class WebGPUContext {
    context = null;
    device = null;
    async init(canvas) {
        if (!navigator.gpu)
            throw new Error('WebGPU not supported');
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter)
            throw new Error('No adapter');
        const device = await adapter.requestDevice();
        const context = canvas.getContext('webgpu');
        if (!context)
            throw new Error('WebGPU context unavailable');
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
    destroy() {
        this.context = null;
        this.device = null;
    }
}
export const createBuffer = (device, size, usage) => {
    return device.createBuffer({ size, usage });
};
export const createBindGroupLayout = (device, entries) => {
    return device.createBindGroupLayout({ entries });
};
export const createBindGroup = (device, layout, entries) => {
    return device.createBindGroup({ layout, entries });
};
export const createPipelineLayout = (device, bindGroupLayouts) => {
    return device.createPipelineLayout({ bindGroupLayouts });
};
