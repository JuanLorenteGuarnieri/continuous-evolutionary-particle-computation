import { Genome } from './Genome.js';
import { ParticleState } from './ParticleState.js';
export class PopulationState {
    version;
    genomes;
    particles;
    constructor(data = {}) {
        this.version = data.version ?? '3.0.0';
        this.genomes = data.genomes ? new Map(data.genomes) : new Map();
        this.particles = data.particles ? new Map(data.particles) : new Map();
        this.validate();
    }
    static validate(obj) {
        if (typeof obj !== 'object' || obj === null)
            return false;
        const o = obj;
        return (typeof o.version === 'string' &&
            o.genomes instanceof Map &&
            o.particles instanceof Map);
    }
    validate() {
        for (const id of this.particles.keys()) {
            if (!this.genomes.has(id)) {
                throw new Error(`Particle ${id} missing genome`);
            }
        }
    }
    addParticle(id, genome, state) {
        this.genomes.set(id, genome);
        this.particles.set(id, state);
    }
    removeParticle(id) {
        this.genomes.delete(id);
        this.particles.delete(id);
    }
    getParticle(id) {
        const g = this.genomes.get(id);
        const s = this.particles.get(id);
        if (g && s)
            return { genome: g, state: s };
        return undefined;
    }
    forEachParticle(fn) {
        for (const [id, state] of this.particles) {
            const genome = this.genomes.get(id);
            if (genome)
                fn(id, genome, state);
        }
    }
    toJSON() {
        return {
            version: this.version,
            genomes: Array.from(this.genomes.entries()).map(([id, g]) => [id, g.toJSON()]),
            particles: Array.from(this.particles.entries()).map(([id, p]) => [id, p.toJSON()]),
        };
    }
    static fromJSON(obj) {
        const genomes = new Map();
        for (const [id, g] of obj.genomes ?? []) {
            genomes.set(id, Genome.fromJSON(g));
        }
        const particles = new Map();
        for (const [id, p] of obj.particles ?? []) {
            particles.set(id, ParticleState.fromJSON(p));
        }
        return new PopulationState({ version: obj.version, genomes, particles });
    }
}
//# sourceMappingURL=PopulationState.js.map