// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
export class MetricsReducer {
   private device: GPUDevice;
   private pipeline: GPUComputePipeline | null = null;
   private bindGroupLayout: GPUBindGroupLayout | null = null;
   private bindGroup: GPUBindGroup | null = null;
   private resultBuffer: GPUBuffer | null = null;
   private healthBuffer: GPUBuffer | null = null;
   private chargeBuffer: GPUBuffer | null = null;
  private countBuffer: GPUBuffer | null = null;
   private particleCount: number = 0;

   constructor(device: GPUDevice) {
     this.device = device;
   }

   async init() {
     const shaderModule = this.device.createShaderModule({
       code: `
         @group(0) @binding(0) var<storage, read> healthBuf: array<f32>;
         @group(0) @binding(1) var<storage, read> chargeBuf: array<f32>;
         @group(0) @binding(2) var<storage, read_write> result: array<f32>;
 
         @group(0) @binding(3) var<uniform> params: Params;
 
         struct Params {
           count: u32,
         };

         @compute @workgroup_size(256)
         fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
           let idx = gid.x;
           if (idx >= params.count) {
             return;
           }
           let health = healthBuf[idx];
           let charge = chargeBuf[idx];
           // Floating-point atomics are not supported by WGSL. Write one
           // independent result pair per particle and reduce it on the CPU.
           result[idx * 2u] = health;
           result[idx * 2u + 1u] = charge;
         }
       `
     });

     this.bindGroupLayout = this.device.createBindGroupLayout({
       entries: [
         {
           binding: 0,
           visibility: GPUShaderStage.COMPUTE,
           buffer: { type: 'read-only-storage' }
         },
         {
           binding: 1,
           visibility: GPUShaderStage.COMPUTE,
           buffer: { type: 'read-only-storage' }
         },
         {
           binding: 2,
           visibility: GPUShaderStage.COMPUTE,
           buffer: { type: 'storage' }
         },
         {
           binding: 3,
           visibility: GPUShaderStage.COMPUTE,
           buffer: { type: 'uniform' }
         }
       ]
     });

     this.pipeline = this.device.createComputePipeline({
       layout: this.device.createPipelineLayout({ bindGroupLayouts: [this.bindGroupLayout!] }),
       compute: {
         module: shaderModule,
         entryPoint: 'main'
       }
     });

   }

   setBuffers(healthBuffer: GPUBuffer, chargeBuffer: GPUBuffer, particleCount: number) {
     this.healthBuffer = healthBuffer;
     this.chargeBuffer = chargeBuffer;
     this.particleCount = particleCount;

     this.resultBuffer?.destroy();
     this.resultBuffer = this.device.createBuffer({
       size: Math.max(1, this.particleCount * 2) * 4,
       usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
     });
 
     if (this.bindGroup) {
       this.bindGroup = null;
     }

     if (!this.bindGroup) {
       this.countBuffer = this.device.createBuffer({
         size: 4,
         usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
       });

       this.bindGroup = this.device.createBindGroup({
         layout: this.bindGroupLayout!,
         entries: [
           { binding: 0, resource: { buffer: this.healthBuffer! } },
           { binding: 1, resource: { buffer: this.chargeBuffer! } },
           { binding: 2, resource: { buffer: this.resultBuffer! } },
           { binding: 3, resource: { buffer: this.countBuffer } }
         ]
       });
     }
 
     // Update the particle count uniform
     const countData = new Uint32Array([this.particleCount]);
     this.device.queue.writeBuffer(this.countBuffer!, 0, countData);
   }

   async computeMetrics(): Promise<{ count: number; healthSum: number; chargeSum: number }> {
     if (!this.pipeline || !this.bindGroup || !this.resultBuffer) {
       throw new Error('MetricsReducer not initialized');
     }

     const commandEncoder = this.device.createCommandEncoder();
     const pass = commandEncoder.beginComputePass();
     pass.setPipeline(this.pipeline);
     pass.setBindGroup(0, this.bindGroup!);
     pass.dispatchWorkgroups(Math.ceil(this.particleCount / 256));
     pass.end();

     // Copy per-particle results to a staging buffer for reading.
     const resultSize = Math.max(1, this.particleCount * 2) * 4;
     const stagingBuffer = this.device.createBuffer({
       size: resultSize,
       usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
     });
     commandEncoder.copyBuffer(this.resultBuffer, 0, stagingBuffer, 0, resultSize);

     const gpuAsync = this.device.queue.submit([commandEncoder.finish()]);
     await gpuAsync;

     await stagingBuffer.mapAsync(GPUMapMode.READ);
     const array = new Float32Array(stagingBuffer.getMappedRange());
     let healthSum = 0;
     let chargeSum = 0;
     for (let index = 0; index < this.particleCount; index++) {
       healthSum += array[index * 2];
       chargeSum += array[index * 2 + 1];
     }
     const count = this.particleCount;
     stagingBuffer.unmap();
     stagingBuffer.destroy();

     return { count, healthSum, chargeSum };
   }

   destroy() {
     this.healthBuffer?.destroy();
     this.chargeBuffer?.destroy();
    this.countBuffer?.destroy();
     this.resultBuffer?.destroy();
     this.pipeline?.destroy();
     this.bindGroupLayout?.destroy();
     this.bindGroup?.destroy();
   }
 }
