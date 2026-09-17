// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
export class RenderPipeline {
   private device: GPUDevice;
   private pipeline: GPURenderPipeline | null = null;
   private bindGroupLayout: GPUBindGroupLayout | null = null;
   private bindGroup: GPUBindGroup | null = null;
   private vertexBuffer: GPUBuffer | null = null;
   private instanceBuffer: GPUBuffer | null = null;

   constructor(device: GPUDevice) {
     this.device = device;
   }

   async init(format: GPUTextureFormat) {
     const shaderModule = this.device.createShaderModule({
       code: `
         struct ParticleInput {
           @location(0) position: vec2<f32>;
           @location(1) offset: vec2<f32>;
           @location(2) health: f32;
           @location(3) charge: f32;
         };

         struct ParticleOutput {
           @builtin(position) position: vec4<f32>;
           @location(0) color: vec4<f32>;
           @location(1) size: f32;
         };

         @group(0) @binding(0) var<uniform> params: Params;

         struct Params {
           healthMax: f32;
           chargeMax: f32;
           baseSize: f32;
           sizeScale: f32;
         };

         @vertex
         fn vertexMain(input: ParticleInput) -> ParticleOutput {
           let pos = vec2<f32>(input.position + input.offset);
           // Convert to clip space (-1 to 1)
           let clipPos = vec4<f32>(pos, 0.0, 1.0);
           var output: ParticleOutput;
           output.position = clipPos;

           // Map health to color (red to green)
           let healthNorm = clamp(input.health / params.healthMax, 0.0, 1.0);
           let color = mix(vec3<f32>(1.0, 0.0, 0.0), vec3<f32>(0.0, 1.0, 0.0), healthNorm);
           output.color = vec4<f32>(color, 1.0);

           // Map charge to size
           output.size = params.baseSize + input.charge * params.sizeScale;

           return output;
         }

         @fragment
         fn fragmentMain(input: ParticleOutput) -> @location(0) vec4<f32> {
           // Simple circle effect - fade out towards edges
           let coords = vec2<f32>(gl_FragCoord.xy) - input.position.xy;
           let dist = length(coords);
           let alpha = smoothstep(0.0, input.size * 0.5, dist);
           return vec4<f32>(input.color.rgb, input.color.a * (1.0 - alpha));
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
       layout: this.device.createPipelineLayout({ bindGroupLayouts: [this.bindGroupLayout!] }),
       vertex: {
         module: shaderModule,
         entryPoint: 'vertexMain',
         buffers: [
           {
             arrayStride: 16, // position (2 floats) + offset (2 floats) = 4 floats = 16 bytes
             attributes: [
               { shaderLocation: 0, offset: 0, format: 'float32x2' }, // position
               { shaderLocation: 1, offset: 8, format: 'float32x2' }, // offset
             ]
           },
           {
             arrayStride: 8, // health (float) + charge (float) = 2 floats = 8 bytes
             attributes: [
               { shaderLocation: 2, offset: 0, format: 'float32' }, // health
               { shaderLocation: 3, offset: 4, format: 'float32' }, // charge
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

   setParticleData(positions: Float32Array, offsets: Float32Array, health: Float32Array, charge: Float32Array) {
     // Update vertex buffers with particle data (position and offset)
     if (!this.vertexBuffer) {
       this.vertexBuffer = this.device.createBuffer({
         size: positions.byteLength + offsets.byteLength,
         usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.VERTEX
       });
     }

     this.device.queue.writeBuffer(this.vertexBuffer, 0, positions);
     this.device.queue.writeBuffer(this.vertexBuffer, positions.byteLength, offsets);

     // Update instance buffer with health and charge
     if (!this.instanceBuffer) {
       this.instanceBuffer = this.device.createBuffer({
         size: health.byteLength + charge.byteLength,
         usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.VERTEX
       });
     }

     this.device.queue.writeBuffer(this.instanceBuffer, 0, health);
     this.device.queue.writeBuffer(this.instanceBuffer, health.byteLength, charge);
   }

   setUniforms(healthMax: number, chargeMax: number, baseSize: number, sizeScale: number) {
     if (!this.bindGroup) {
       const uniformBuffer = this.device.createBuffer({
         size: 4 * 4, // 4 floats
         usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
       });

       this.bindGroup = this.device.createBindGroup({
         layout: this.bindGroupLayout!,
         entries: [
           { binding: 0, resource: { buffer: uniformBuffer } },
           { binding: 1, resource: { buffer: this.vertexBuffer! } },
           { binding: 2, resource: { buffer: this.instanceBuffer! } }
         ]
       });
     }

     const data = new Float32Array([healthMax, chargeMax, baseSize, sizeScale]);
     this.device.queue.writeBuffer(this.bindGroup!.getResource(0).buffer, 0, data);
   }

   render(commandEncoder: GPUCommandEncoder, textureView: GPUTextureView, particleCount: number) {
     if (!this.pipeline) return;

     const renderPass = commandEncoder.beginRenderPass({
       colorAttachments: [{
         view: textureView,
         loadOp: 'clear',
         storeOp: 'store',
         clearValue: { r: 0.1, g: 0.1, b: 0.1, a: 1.0 }
       }]
     });

     renderPass.setPipeline(this.pipeline);
     renderPass.setVertexBuffer(0, this.vertexBuffer!);
     renderPass.setVertexBuffer(1, this.instanceBuffer!);
     renderPass.draw(6, particleCount); // 6 vertices per instance (quad)
     renderPass.end();
   }

   destroy() {
     this.vertexBuffer?.destroy();
     this.instanceBuffer?.destroy();
     this.pipeline?.destroy();
     this.bindGroupLayout?.destroy();
     this.bindGroup?.destroy();
   }
 }
