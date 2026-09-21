// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
export class RenderPipeline {
    device;
    pipeline = null;
    bindGroupLayout = null;
    bindGroup = null;
    uniformBuffer = null;
    vertexBuffer = null;
    instanceBuffer = null;
    vertexBufferSize = 0;
    instanceBufferSize = 0;
    constructor(device) {
        this.device = device;
    }
    async init(format) {
        const shaderModule = this.device.createShaderModule({
            code: `
         struct ParticleInput {
           @location(0) position: vec2<f32>,
           @location(1) offset: vec2<f32>,
           @location(2) health: f32,
           @location(3) charge: f32,
           @location(4) role: f32,
         };

        struct ParticleOutput {
          @builtin(position) position: vec4<f32>,
          @location(0) color: vec4<f32>,
          @location(1) size: f32,
        };

         struct Params {
           healthMax: f32,
           chargeMax: f32,
           baseSize: f32,
           sizeScale: f32,
             cameraX: f32,
             cameraY: f32,
             zoom: f32,
             domainWidth: f32,
             domainHeight: f32,
         };

         @group(0) @binding(0) var<uniform> params: Params;

         @vertex
         fn vertexMain(input: ParticleInput) -> ParticleOutput {
           let roleScale = select(1.0, 3.0, input.role > 0.5);
           let pos = input.position + input.offset * roleScale;
           let viewSize = vec2<f32>(params.domainWidth, params.domainHeight) / params.zoom;
           let viewOrigin = vec2<f32>(params.cameraX, params.cameraY) - viewSize / 2.0;
           let ndc = ((pos - viewOrigin) / viewSize) * 2.0 - vec2<f32>(1.0, 1.0);
           let clipPos = vec4<f32>(ndc.x, -ndc.y, 0.0, 1.0);
           var output: ParticleOutput;
           output.position = clipPos;

           // Map health to color (red to green)
           let healthNorm = clamp(input.health / params.healthMax, 0.0, 1.0);
           var color = mix(vec3<f32>(1.0, 0.0, 0.0), vec3<f32>(0.0, 1.0, 0.0), healthNorm);
           if (input.role == 1.0) {
             color = vec3<f32>(0.0, 0.9, 1.0);
           } else if (input.role == 2.0) {
             color = vec3<f32>(0.61, 0.36, 1.0);
           }
           output.color = vec4<f32>(color, 1.0);

           // Map charge to size
           output.size = params.baseSize + input.charge * params.sizeScale;

           return output;
         }

        @fragment
        fn fragmentMain(input: ParticleOutput) -> @location(0) vec4<f32> {
          // Simple circle effect - fade out towards edges
          // Simple output - gl_FragCoord is not available in WGSL
          return vec4<f32>(input.color.rgb, 1.0);
        }
       `
        });
        this.bindGroupLayout = this.device.createBindGroupLayout({
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                    buffer: { type: 'uniform' }
                },
                {
                    binding: 1,
                    visibility: GPUShaderStage.VERTEX,
                    buffer: { type: 'read-only-storage' }
                },
                {
                    binding: 2,
                    visibility: GPUShaderStage.VERTEX,
                    buffer: { type: 'read-only-storage' }
                }
            ]
        });
        this.pipeline = this.device.createRenderPipeline({
            layout: this.device.createPipelineLayout({ bindGroupLayouts: [this.bindGroupLayout] }),
            vertex: {
                module: shaderModule,
                entryPoint: 'vertexMain',
                buffers: [
                    {
                        arrayStride: 16, // position (2 floats) + offset (2 floats) = 4 floats = 16 bytes
                        stepMode: 'vertex',
                        attributes: [
                            { shaderLocation: 0, offset: 0, format: 'float32x2' }, // position
                            { shaderLocation: 1, offset: 8, format: 'float32x2' }, // offset
                        ]
                    },
                    {
                        arrayStride: 12,
                        stepMode: 'instance',
                        attributes: [
                            { shaderLocation: 2, offset: 0, format: 'float32' }, // health
                            { shaderLocation: 3, offset: 4, format: 'float32' }, // charge
                            { shaderLocation: 4, offset: 8, format: 'float32' },
                        ]
                    }
                ]
            },
            fragment: {
                module: shaderModule,
                entryPoint: 'fragmentMain',
                targets: [{ format }]
            },
            primitive: { topology: 'triangle-list' },
            depthStencil: undefined
        });
    }
    setParticleData(positions, offsets, health, charge, role) {
        // Interleave position and offset because both attributes share buffer 0.
        const vertexData = new Float32Array(positions.length + offsets.length);
        for (let i = 0; i < positions.length / 2; i++) {
            vertexData[i * 4] = positions[i * 2];
            vertexData[i * 4 + 1] = positions[i * 2 + 1];
            vertexData[i * 4 + 2] = offsets[i * 2];
            vertexData[i * 4 + 3] = offsets[i * 2 + 1];
        }
        if (!this.vertexBuffer || this.vertexBufferSize !== vertexData.byteLength) {
            this.vertexBuffer?.destroy();
            this.bindGroup?.destroy();
            this.bindGroup = null;
            this.vertexBuffer = this.device.createBuffer({
                size: vertexData.byteLength,
                usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.VERTEX
            });
            this.vertexBufferSize = vertexData.byteLength;
        }
        this.device.queue.writeBuffer(this.vertexBuffer, 0, vertexData);
        // Interleave per-instance values so all attributes share one instance stride.
        const instanceData = new Float32Array(health.length * 3);
        for (let i = 0; i < health.length; i++) {
            instanceData[i * 3] = health[i];
            instanceData[i * 3 + 1] = charge[i];
            instanceData[i * 3 + 2] = role[i];
        }
        // Update instance buffer with health, charge, and role.
        if (!this.instanceBuffer || this.instanceBufferSize !== instanceData.byteLength) {
            this.instanceBuffer?.destroy();
            this.bindGroup?.destroy();
            this.bindGroup = null;
            this.instanceBuffer = this.device.createBuffer({
                size: instanceData.byteLength,
                usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.VERTEX
            });
            this.instanceBufferSize = instanceData.byteLength;
        }
        this.device.queue.writeBuffer(this.instanceBuffer, 0, instanceData);
        // The storage buffers must exist before the bind group is created.
        this.createBindGroup();
    }
    createBindGroup() {
        if (this.bindGroup || !this.bindGroupLayout || !this.uniformBuffer || !this.vertexBuffer || !this.instanceBuffer)
            return;
        this.bindGroup = this.device.createBindGroup({
            layout: this.bindGroupLayout,
            entries: [
                { binding: 0, resource: { buffer: this.uniformBuffer } },
                { binding: 1, resource: { buffer: this.vertexBuffer } },
                { binding: 2, resource: { buffer: this.instanceBuffer } }
            ]
        });
    }
    setUniforms(healthMax, chargeMax, baseSize, sizeScale, cameraX = 50, cameraY = 50, zoom = 1, domainWidth = 100, domainHeight = 100) {
        if (!this.uniformBuffer) {
            this.uniformBuffer = this.device.createBuffer({
                size: 12 * 4,
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
            });
        }
        this.createBindGroup();
        const data = new Float32Array([
            healthMax, chargeMax, baseSize, sizeScale,
            cameraX, cameraY, zoom, domainWidth, domainHeight, 0, 0, 0,
        ]);
        this.device.queue.writeBuffer(this.uniformBuffer, 0, data);
    }
    render(commandEncoder, textureView, particleCount) {
        if (!this.pipeline)
            return;
        const renderPass = commandEncoder.beginRenderPass({
            colorAttachments: [{
                    view: textureView,
                    loadOp: 'clear',
                    storeOp: 'store',
                    clearValue: { r: 0.1, g: 0.1, b: 0.1, a: 1.0 }
                }]
        });
        renderPass.setPipeline(this.pipeline);
        if (this.bindGroup)
            renderPass.setBindGroup(0, this.bindGroup);
        renderPass.setVertexBuffer(0, this.vertexBuffer);
        renderPass.setVertexBuffer(1, this.instanceBuffer);
        renderPass.draw(6, particleCount); // 6 vertices per instance (quad)
        renderPass.end();
    }
    destroy() {
        this.vertexBuffer?.destroy();
        this.instanceBuffer?.destroy();
        this.vertexBufferSize = 0;
        this.instanceBufferSize = 0;
        this.uniformBuffer?.destroy();
        this.pipeline?.destroy();
        this.bindGroupLayout?.destroy();
        this.bindGroup?.destroy();
    }
}
