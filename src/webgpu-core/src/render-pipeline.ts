// Phase 3 renderer: consumes simulation-owned GPU buffers and can be encoded
// into the caller's command encoder. Rendering is kept deliberately close to
// the CPU Canvas2D renderer used by worker.ts:
//   - black background
//   - internal particles: radius 2 px
//   - input/output particles: radius 6 px
//   - circular particles (not quads)
//   - identical particle colours
//   - fixed 800x600 render surface, as agreed for this renderer
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
export interface RenderParticleState {
  positions: GPUBuffer;
  health: GPUBuffer;
  charge: GPUBuffer;
  role: GPUBuffer;
  particleCount: number;
}

export class RenderPipeline {
  private device: GPUDevice;
  private pipeline: GPURenderPipeline | null = null;
  private bindGroupLayout: GPUBindGroupLayout | null = null;
  private bindGroup: GPUBindGroup | null = null;
  private uniformBuffer: GPUBuffer | null = null;
  private positionsBuffer: GPUBuffer | null = null;
  private healthBuffer: GPUBuffer | null = null;
  private chargeBuffer: GPUBuffer | null = null;
  private roleBuffer: GPUBuffer | null = null;
  private boundParticleCount = 0;
  /**
   * Phase 16: bind-group memo. The stepper hands the renderer the write-side ping-pong buffers, which
   * alternate every step, so Phase 15 recreated this bind group on every rendered step although only two
   * distinct states exist. KEY: identity of (positions, health, charge, role) (the uniform buffer is constant
   * for a pipeline's life). SIZE: at most 2 entries (oldest evicted). INVALIDATION: the stepper recreates all of its
   * data buffers together, role included, so a new role buffer drops the whole memo before any lookup; destroy()
   * and creating the uniform buffer drop it too. A lookup compares identities, so an entry can only be returned
   * for exactly the buffers it was built from.
   */
  private bindGroupMemo: Array<{
    positions: GPUBuffer;
    health: GPUBuffer;
    charge: GPUBuffer;
    role: GPUBuffer;
    group: GPUBindGroup;
  }> = [];
  /** Phase 16: createBindGroup() calls issued to the device (hit-rate evidence for tests/benchmarks). */
  public bindGroupsCreated = 0;

  constructor(device: GPUDevice) {
    this.device = device;
  }

  async init(format) {
        const shaderModule = this.device.createShaderModule({ code: `
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

      struct ParticleOutput {
        @builtin(position) position: vec4<f32>,
        @location(0) color: vec4<f32>,
        @location(1) localPosition: vec2<f32>,
      };

      @group(0) @binding(0) var<uniform> params: Params;
      @group(0) @binding(1) var<storage, read> positions: array<vec2<f32>>;
      @group(0) @binding(2) var<storage, read> health: array<f32>;
      @group(0) @binding(3) var<storage, read> charge: array<f32>;
      @group(0) @binding(4) var<storage, read> role: array<u32>;

      // A six-vertex quad is used only as the rasterisation envelope.
      // The fragment shader cuts it to an actual circle.
      fn quad(vertexIndex: u32) -> vec2<f32> {
        switch (vertexIndex) {
          case 0u: { return vec2<f32>(-1.0, -1.0); }
          case 1u: { return vec2<f32>( 1.0, -1.0); }
          case 2u: { return vec2<f32>( 1.0,  1.0); }
          case 3u: { return vec2<f32>(-1.0, -1.0); }
          case 4u: { return vec2<f32>( 1.0,  1.0); }
          default: { return vec2<f32>(-1.0,  1.0); }
        }
      }

      
      fn wrapCoordinate(value: f32, domainSize: f32) -> f32 {
          return value - floor(value / domainSize) * domainSize;
      }

      @vertex
      fn vertexMain(
        @builtin(vertex_index) vertexIndex: u32,
        @builtin(instance_index) particleIndex: u32,
      ) -> ParticleOutput {
        let local = quad(vertexIndex);
        let particleRole = role[particleIndex];

        // Match worker.ts exactly:
        //   internal -> radius 2
        //   input/output -> radius 6
        let radiusPx = select(2.0, 6.0, particleRole > 0u);

        // The render target is fixed at 800x600. Convert pixel radius to NDC.
        let pixelToNdc = vec2<f32>(2.0 / 800.0, 2.0 / 600.0);
        let halfExtentNdc = radiusPx * pixelToNdc;

        let viewSize = vec2<f32>(params.domainWidth, params.domainHeight) / params.zoom;
        let viewOrigin = vec2<f32>(params.cameraX, params.cameraY) - viewSize / 2.0;

        let relativePosition = vec2<f32>(
            wrapCoordinate(
                positions[particleIndex].x - viewOrigin.x,
                params.domainWidth
            ),
            wrapCoordinate(
                positions[particleIndex].y - viewOrigin.y,
                params.domainHeight
            )
        );

        let ndc = (relativePosition / viewSize) * 2.0 - vec2<f32>(1.0, 1.0);

        var output: ParticleOutput;
        output.position = vec4<f32>(
          ndc.x + local.x * halfExtentNdc.x,
          -ndc.y + local.y * halfExtentNdc.y,
          0.0,
          1.0
        );
        output.localPosition = local;

        let healthNorm = clamp(health[particleIndex] / params.healthMax, 0.0, 1.0);

        var color: vec3<f32>;
        if (particleRole == 1u) {
          // Canvas2D: #00e5ff
          color = vec3<f32>(0.0, 229 / 255.0, 1.0);
        } else if (particleRole == 2u) {
          // Canvas2D: #9b5cff
          color = vec3<f32>(155.0 / 255.0, 92.0 / 255.0, 1.0);
        } else {
          // Canvas2D computes integer RGB values with Math.round().
          let red = floor(255.0 * (1.0 - healthNorm) + 0.5) / 255.0;
          let green = floor(255.0 * healthNorm + 0.5) / 255.0;
          color = vec3<f32>(red, green, 0.0);
        }

        output.color = vec4<f32>(color, 1.0);
        return output;
      }

      @fragment
      fn fragmentMain(input: ParticleOutput) -> @location(0) vec4<f32> {
        // Turn the rasterised quad into a circle.
        // This is intentionally hard-edged: the CPU renderer's visible
        // particle extent is defined by the 2/6 px Canvas2D arc radius.
        if (dot(input.localPosition, input.localPosition) > 1.0) {
          discard;
        }
        return input.color;
      }
    ` });

    this.bindGroupLayout = this.device.createBindGroupLayout({ entries: [
      { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
      { binding: 1, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } },
      { binding: 2, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } },
      { binding: 3, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } },
      { binding: 4, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } },
    ] });

    this.pipeline = this.device.createRenderPipeline({
      layout: this.device.createPipelineLayout({ bindGroupLayouts: [this.bindGroupLayout] }),
      vertex: {
        module: shaderModule,
        entryPoint: 'vertexMain',
      },
      fragment: {
        module: shaderModule,
        entryPoint: 'fragmentMain',
        targets: [{ format }],
      },
      primitive: {
        topology: 'triangle-list',
      },
    });
  }

  /**
   * Bind the simulation-owned GPU render state directly.
   *
   * This is intentionally a zero-copy hand-off: the renderer stores the GPU
   * buffer handles and never receives a CPU particle array.
   */
  setParticleBuffers(state: RenderParticleState): void {
    const { positions, health, charge, role, particleCount } = state;
    // A new role buffer means the data buffers were recreated: every memoized group is stale.
    if (this.roleBuffer !== role) this.bindGroupMemo.length = 0;
    const changed =
      this.positionsBuffer !== positions ||
      this.healthBuffer !== health ||
      this.chargeBuffer !== charge ||
      this.roleBuffer !== role ||
      this.boundParticleCount !== particleCount;

    this.positionsBuffer = positions;
    this.healthBuffer = health;
    this.chargeBuffer = charge;
    this.roleBuffer = role;
    this.boundParticleCount = particleCount;

    if (changed) this.bindGroup = null;
    this.createBindGroup();
  }

  setUniforms(
    healthMax: number,
    chargeMax: number,
    baseSize: number,
    sizeScale: number,
    cameraX: number,
    cameraY: number,
    zoom: number,
    domainWidth: number,
    domainHeight: number,
  ): void {
    if (!this.uniformBuffer) {
      this.uniformBuffer = this.device.createBuffer({
        size: 12 * 4,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });
      this.bindGroup = null;
      this.bindGroupMemo.length = 0;
    }

    this.createBindGroup();
    this.device.queue.writeBuffer(this.uniformBuffer, 0, new Float32Array([
      healthMax,
      chargeMax,
      baseSize,
      sizeScale,
      cameraX,
      cameraY,
      zoom,
      domainWidth,
      domainHeight,
      0,
      0,
      0,
    ]));
  }

  private createBindGroup(): void {
    if (
      this.bindGroup ||
      !this.bindGroupLayout ||
      !this.uniformBuffer ||
      !this.positionsBuffer ||
      !this.healthBuffer ||
      !this.chargeBuffer ||
      !this.roleBuffer
    ) {
      return;
    }

    for (const entry of this.bindGroupMemo) {
      if (
        entry.positions === this.positionsBuffer &&
        entry.health === this.healthBuffer &&
        entry.charge === this.chargeBuffer &&
        entry.role === this.roleBuffer
      ) {
        this.bindGroup = entry.group;
        return;
      }
    }

    const group = this.device.createBindGroup({
      layout: this.bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuffer } },
        { binding: 1, resource: { buffer: this.positionsBuffer } },
        { binding: 2, resource: { buffer: this.healthBuffer } },
        { binding: 3, resource: { buffer: this.chargeBuffer } },
        { binding: 4, resource: { buffer: this.roleBuffer } },
      ],
    });
    this.bindGroupsCreated++;
    this.bindGroup = group;
    if (this.bindGroupMemo.length >= 2) this.bindGroupMemo.shift();
    this.bindGroupMemo.push({
      positions: this.positionsBuffer,
      health: this.healthBuffer,
      charge: this.chargeBuffer,
      role: this.roleBuffer,
      group,
    });
  }

  /**
   * Render the currently bound simulation state.
   * Phase 19: optional `timestampWrites` (a GPURenderPassTimestampWrites) lets the caller measure this pass on the GPU.
   */
  render(
    commandEncoder: GPUCommandEncoder,
    textureView: GPUTextureView,
    particleCount = this.boundParticleCount,
    timestampWrites?: { querySet: GPUQuerySet; beginningOfPassWriteIndex?: number; endOfPassWriteIndex?: number },
  ): void {
    if (!this.pipeline || !this.bindGroup) return;

    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [{
        view: textureView,
        loadOp: 'clear',
        storeOp: 'store',
        // CPU renderer clears to pure black.
        clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
      }],
      ...(timestampWrites ? { timestampWrites } : {}),
    });

    renderPass.setPipeline(this.pipeline);
    renderPass.setBindGroup(0, this.bindGroup);
    renderPass.draw(6, particleCount);
    renderPass.end();
  }

  destroy(): void {
    // Phase 16: GPURenderPipeline and GPUBindGroupLayout have no destroy() in WebGPU (only GPUBuffer,
    // GPUTexture, GPUQuerySet and GPUDevice do). The Phase 15 calls to them threw a TypeError (hidden by the
    // file's @ts-nocheck) after the uniform buffer was destroyed and before the fields below were cleared.
    this.bindGroupMemo.length = 0;
    this.uniformBuffer?.destroy();
    this.bindGroup = null;
    this.uniformBuffer = null;
    this.pipeline = null;
    this.bindGroupLayout = null;
    this.positionsBuffer = null;
    this.healthBuffer = null;
    this.chargeBuffer = null;
    this.roleBuffer = null;
  }
}
