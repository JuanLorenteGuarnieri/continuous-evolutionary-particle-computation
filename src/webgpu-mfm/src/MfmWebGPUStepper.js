// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
export class MfmWebGPUStepper {
    device;
    constructor(device, config, population) {
        this.device = device;
        this.device = device;
        this.config = config;
        this.population = population;
        this.timestep = 0;
        // GPU resources will be initialized in init()
        this.init();
    }
    bindGroupLayout = null;
    bindGroup = null;
    pipeline = null;
    // Config and state
    config;
    population;
    timestep;
    // Particle data buffers
    positionBuffer = null;
    velocityBuffer = null;
    healthBuffer = null;
    chargeBuffer = null;
    roleBuffer = null;
    // Genome buffers
    genomeHMaxBuffer = null;
    genomeThetaQBuffer = null;
    genomeABuffer = null;
    genomeKBuffer = null;
    genomeRcBuffer = null;
    genomeMBuffer = null;
    genomeGammaBuffer = null;
    genomeRsBuffer = null;
    genomeOmegaRBuffer = null;
    genomeOmegaABuffer = null;
    genomeOmegaVBuffer = null;
    // Derived data
    particleCount = 0;
    async init() {
        // Initialize GPU buffers and pipelines
        await this.createBuffers();
        await this.createPipelines();
    }
    async createBuffers() {
        if (!this.population)
            return;
        const pop = this.population;
        this.particleCount = pop.particles.size;
        // Create buffers for particle data
        // We'll use separate buffers for each attribute (Structure of Arrays approach)
        const byteSize = this.particleCount * 4; // 4 bytes per float32
        // Position buffer (x, y)
        this.positionBuffer = this.device.createBuffer({
            size: byteSize * 2,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
        });
        // Velocity buffer (x, y)
        this.velocityBuffer = this.device.createBuffer({
            size: byteSize * 2,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
        });
        // Health buffer
        this.healthBuffer = this.device.createBuffer({
            size: byteSize,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
        });
        // Charge buffer
        this.chargeBuffer = this.device.createBuffer({
            size: byteSize,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
        });
        // Role buffer (0=internal, 1=input, 2=output)
        this.roleBuffer = this.device.createBuffer({
            size: byteSize,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
        });
        // Genome buffers
        this.genomeHMaxBuffer = this.device.createBuffer({
            size: byteSize,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
        });
        this.genomeThetaQBuffer = this.device.createBuffer({
            size: byteSize,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
        });
        this.genomeABuffer = this.device.createBuffer({
            size: byteSize,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
        });
        this.genomeKBuffer = this.device.createBuffer({
            size: byteSize,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
        });
        this.genomeRcBuffer = this.device.createBuffer({
            size: byteSize,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
        });
        this.genomeMBuffer = this.device.createBuffer({
            size: byteSize,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
        });
        this.genomeGammaBuffer = this.device.createBuffer({
            size: byteSize,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
        });
        this.genomeRsBuffer = this.device.createBuffer({
            size: byteSize,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
        });
        this.genomeOmegaRBuffer = this.device.createBuffer({
            size: byteSize,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
        });
        this.genomeOmegaABuffer = this.device.createBuffer({
            size: byteSize,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
        });
        this.genomeOmegaVBuffer = this.device.createBuffer({
            size: byteSize,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
        });
        // Upload initial data to buffers
        await this.uploadInitialData();
    }
    async uploadInitialData() {
        if (this.particleCount === 0 || !this.population)
            return;
        // Create temporary arrays to hold data
        const positions = new Float32Array(this.particleCount * 2);
        const velocities = new Float32Array(this.particleCount * 2);
        const healths = new Float32Array(this.particleCount);
        const charges = new Float32Array(this.particleCount);
        const roles = new Float32Array(this.particleCount);
        const genomeHMax = new Float32Array(this.particleCount);
        const genomeThetaQ = new Float32Array(this.particleCount);
        const genomeA = new Float32Array(this.particleCount);
        const genomeK = new Float32Array(this.particleCount);
        const genomeRc = new Float32Array(this.particleCount);
        const genomeM = new Float32Array(this.particleCount);
        const genomeGamma = new Float32Array(this.particleCount);
        const genomeRs = new Float32Array(this.particleCount);
        const genomeOmegaR = new Float32Array(this.particleCount);
        const genomeOmegaA = new Float32Array(this.particleCount);
        const genomeOmegaV = new Float32Array(this.particleCount);
        // Extract data from population
        let i = 0;
        for (const [id, state] of this.population.particles) {
            const genome = this.population.genomes.get(id);
            if (!genome)
                continue;
            positions[i * 2] = state.position.x;
            positions[i * 2 + 1] = state.position.y;
            velocities[i * 2] = state.velocity.x;
            velocities[i * 2 + 1] = state.velocity.y;
            healths[i] = state.health;
            charges[i] = state.charge;
            roles[i] = state.role === 'input' ? 1 : state.role === 'output' ? 2 : 0;
            genomeHMax[i] = genome.H_max;
            genomeThetaQ[i] = genome.theta_q;
            genomeA[i] = genome.A;
            genomeK[i] = genome.K;
            genomeRc[i] = genome.R_c;
            genomeM[i] = genome.m;
            genomeGamma[i] = genome.gamma;
            genomeRs[i] = genome.R_s;
            genomeOmegaR[i] = genome.omega_R;
            genomeOmegaA[i] = genome.omega_A;
            genomeOmegaV[i] = genome.omega_v;
            i++;
        }
        // Write data to buffers
        if (this.positionBuffer)
            this.device.queue.writeBuffer(this.positionBuffer, 0, positions);
        if (this.velocityBuffer)
            this.device.queue.writeBuffer(this.velocityBuffer, 0, velocities);
        if (this.healthBuffer)
            this.device.queue.writeBuffer(this.healthBuffer, 0, healths);
        if (this.chargeBuffer)
            this.device.queue.writeBuffer(this.chargeBuffer, 0, charges);
        if (this.roleBuffer)
            this.device.queue.writeBuffer(this.roleBuffer, 0, roles);
        if (this.genomeHMaxBuffer)
            this.device.queue.writeBuffer(this.genomeHMaxBuffer, 0, genomeHMax);
        if (this.genomeThetaQBuffer)
            this.device.queue.writeBuffer(this.genomeThetaQBuffer, 0, genomeThetaQ);
        if (this.genomeABuffer)
            this.device.queue.writeBuffer(this.genomeABuffer, 0, genomeA);
        if (this.genomeKBuffer)
            this.device.queue.writeBuffer(this.genomeKBuffer, 0, genomeK);
        if (this.genomeRcBuffer)
            this.device.queue.writeBuffer(this.genomeRcBuffer, 0, genomeRc);
        if (this.genomeMBuffer)
            this.device.queue.writeBuffer(this.genomeMBuffer, 0, genomeM);
        if (this.genomeGammaBuffer)
            this.device.queue.writeBuffer(this.genomeGammaBuffer, 0, genomeGamma);
        if (this.genomeRsBuffer)
            this.device.queue.writeBuffer(this.genomeRsBuffer, 0, genomeRs);
        if (this.genomeOmegaRBuffer)
            this.device.queue.writeBuffer(this.genomeOmegaRBuffer, 0, genomeOmegaR);
        if (this.genomeOmegaABuffer)
            this.device.queue.writeBuffer(this.genomeOmegaABuffer, 0, genomeOmegaA);
        if (this.genomeOmegaVBuffer)
            this.device.queue.writeBuffer(this.genomeOmegaVBuffer, 0, genomeOmegaV);
    }
    async createPipelines() {
        // Create bind group layout
        const bindGroupLayoutEntries = [];
        // Add entries for each buffer
        // We'll add them in a specific order that must match the shader
        const bufferNames = [
            'positionBuffer', 'velocityBuffer', 'healthBuffer', 'chargeBuffer', 'roleBuffer',
            'genomeHMaxBuffer', 'genomeThetaQBuffer', 'genomeABuffer', 'genomeKBuffer',
            'genomeRcBuffer', 'genomeMBuffer', 'genomeGammaBuffer', 'genomeRsBuffer',
            'genomeOmegaRBuffer', 'genomeOmegaABuffer', 'genomeOmegaVBuffer'
        ];
        bufferNames.forEach((name, index) => {
            bindGroupLayoutEntries.push({
                binding: index,
                visibility: GPUShaderStage.COMPUTE,
                buffer: { type: 'read-only-storage' },
            });
        });
        // Also add buffers for output (we'll need storage buffers for writing)
        // For now, we'll use the same buffers for read-write (not ideal but simple)
        // In a real implementation, we'd use double buffering
        bufferNames.forEach((name, index) => {
            bindGroupLayoutEntries.push({
                binding: index + bufferNames.length,
                visibility: GPUShaderStage.COMPUTE,
                buffer: { type: 'storage' },
            });
        });
        this.bindGroupLayout = this.device.createBindGroupLayout({
            entries: bindGroupLayoutEntries,
        });
        // Create bind group
        const bindGroupEntries = [];
        bufferNames.forEach((name, index) => {
            const buffer = this[name];
            if (buffer) {
                bindGroupEntries.push({
                    binding: index,
                    resource: { buffer },
                });
            }
        });
        bufferNames.forEach((name, index) => {
            const buffer = this[name];
            if (buffer) {
                bindGroupEntries.push({
                    binding: index + bufferNames.length,
                    resource: { buffer },
                });
            }
        });
        this.bindGroup = this.device.createBindGroup({
            layout: this.bindGroupLayout,
            entries: bindGroupEntries,
        });
        // Create compute pipeline
        const shaderModule = this.device.createShaderModule({
            code: `
        // Simple pass-through shader for testing
        @group(0) @binding(0) var<storage, read> positionIn: array<vec2<f32>>;
        @group(0) @binding(1) var<storage, read> velocityIn: array<vec2<f32>>;
        @group(0) @binding(2) var<storage, read> healthIn: array<f32>;
        @group(0) @binding(3) var<storage, read> chargeIn: array<f32>;
        @group(0) @binding(4) var<storage, read> roleIn: array<f32>;
        @group(0) @binding(5) var<storage, read> genomeHMaxIn: array<f32>;
        @group(0) @binding(6) var<storage, read> genomeThetaQIn: array<f32>;
        @group(0) @binding(7) var<storage, read> genomeAIn: array<f32>;
        @group(0) @binding(8) var<storage, read> genomeKIn: array<f32>;
        @group(0) @binding(9) var<storage, read> genomeRcIn: array<f32>;
        @group(0) @binding(10) var<storage, read> genomeMIn: array<f32>;
        @group(0) @binding(11) var<storage, read> genomeGammaIn: array<f32>;
        @group(0) @binding(12) var<storage, read> genomeRsIn: array<f32>;
        @group(0) @binding(13) var<storage, read> genomeOmegaRIn: array<f32>;
        @group(0) @binding(14) var<storage, read> genomeOmegaAIn: array<f32>;
        @group(0) @binding(15) var<storage, read> genomeOmegaVIn: array<f32>;
        
        @group(0) @binding(16) var<storage, read_write> positionOut: array<vec2<f32>>;
        @group(0) @binding(17) var<storage, read_write> velocityOut: array<vec2<f32>>;
        @group(0) @binding(18) var<storage, read_write> healthOut: array<f32>;
        @group(0) @binding(19) var<storage, read_write> chargeOut: array<f32>;
        @group(0) @binding(20) var<storage, read_write> roleOut: array<f32>;
        @group(0) @binding(21) var<storage, read_write> genomeHMaxOut: array<f32>;
        @group(0) @binding(22) var<storage, read_write> genomeThetaQOut: array<f32>;
        @group(0) @binding(23) var<storage, read_write> genomeAOut: array<f32>;
        @group(0) @binding(24) var<storage, read_write> genomeKOut: array<f32>;
        @group(0) @binding(25) var<storage, read_write> genomeRcOut: array<f32>;
        @group(0) @binding(26) var<storage, read_write> genomeMOut: array<f32>;
        @group(0) @binding(27) var<storage, read_write> genomeGammaOut: array<f32>;
        @group(0) @binding(28) var<storage, read_write> genomeRsOut: array<f32>;
        @group(0) @binding(29) var<storage, read_write> genomeOmegaROut: array<f32>;
        @group(0) @binding(30) var<storage, read_write> genomeOmegaAOut: array<f32>;
        @group(0) @binding(31) var<storage, read_write> genomeOmegaVOut: array<f32>;
        
        @compute @workgroup_size(64)
        fn main(@builtin(global_invocation_id) id: vec3<u32>) {
          let i = id.x;
          let n = arrayLength(&positionIn);
          if (i >= n) { return; }
          
          positionOut[i] = positionIn[i];
          velocityOut[i] = velocityIn[i];
          healthOut[i] = healthIn[i];
          chargeOut[i] = chargeIn[i];
          roleOut[i] = roleIn[i];
          genomeHMaxOut[i] = genomeHMaxIn[i];
          genomeThetaQOut[i] = genomeThetaQIn[i];
          genomeAOut[i] = genomeAIn[i];
          genomeKOut[i] = genomeKIn[i];
          genomeRcOut[i] = genomeRcIn[i];
          genomeMOut[i] = genomeMIn[i];
          genomeGammaOut[i] = genomeGammaIn[i];
          genomeRsOut[i] = genomeRsIn[i];
          genomeOmegaROut[i] = genomeOmegaRIn[i];
          genomeOmegaAOut[i] = genomeOmegaAIn[i];
          genomeOmegaVOut[i] = genomeOmegaVIn[i];
        }
      `,
        });
        this.pipeline = this.device.createComputePipeline({
            layout: this.device.createPipelineLayout({
                bindGroupLayouts: [this.bindGroupLayout],
            }),
            compute: {
                module: shaderModule,
                entryPoint: 'main',
            },
        });
    }
    async step() {
        if (!this.pipeline || !this.bindGroup || this.particleCount === 0) {
            return this.population;
        }
        // Create command encoder
        const commandEncoder = this.device.createCommandEncoder();
        // Begin compute pass
        const passEncoder = commandEncoder.beginComputePass();
        passEncoder.setPipeline(this.pipeline);
        passEncoder.setBindGroup(0, this.bindGroup);
        // Dispatch workgroups
        const workgroupSize = 64;
        const workgroupCount = Math.ceil(this.particleCount / workgroupSize);
        passEncoder.dispatchWorkgroups(workgroupCount);
        passEncoder.end();
        // Submit commands
        const commandBuffer = commandEncoder.finish();
        this.device.queue.submit([commandBuffer]);
        // Wait for GPU to complete (for simplicity)
        // In a real implementation, we might want to use fences or overlap with rendering
        await this.device.queue.onSubmittedWorkDone();
        // Increment timestep
        this.timestep++;
        // For now, return the same population (since our shader is pass-through)
        // In a real implementation, we would read back the data or update internal state
        return this.population;
    }
    getPopulation() {
        return this.population;
    }
    getConfig() {
        return this.config;
    }
    setConfig(config) {
        this.config = config;
    }
    setPopulation(population) {
        this.population = population;
    }
    injectInput(value) {
        // TODO: Implement input injection
    }
    setGlobalError(error) {
        // TODO: Implement global error setting
    }
    async saveState() {
        // TODO: Implement state saving
        return {};
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async loadState(_state) {
        // TODO: Implement state loading
    }
}
