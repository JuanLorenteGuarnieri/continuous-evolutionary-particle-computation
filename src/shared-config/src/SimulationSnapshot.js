import { Genome } from './Genome.js';
import { ParticleState } from './ParticleState.js';
export class SimulationSnapshot {
    version;
    timestep;
    genomes;
    particleStates;
    globalMetrics;
    constructor(data = {}) {
        this.version = data.version ?? '3.0.0';
        this.timestep = data.timestep ?? 0;
        this.genomes = data.genomes ? new Map(data.genomes) : new Map();
        this.particleStates = data.particleStates ? new Map(data.particleStates) : new Map();
        this.globalMetrics = data.globalMetrics;
    }
    static validate(obj) {
        if (typeof obj !== 'object' || obj === null)
            return false;
        const o = obj;
        return (typeof o.version === 'string' &&
            typeof o.timestep === 'number' &&
            o.genomes instanceof Map &&
            o.particleStates instanceof Map);
    }
    toJSON() {
        return {
            version: this.version,
            timestep: this.timestep,
            genomes: Array.from(this.genomes.entries()).map(([id, g]) => [id, g.toJSON()]),
            particleStates: Array.from(this.particleStates.entries()).map(([id, p]) => [id, p.toJSON()]),
            globalMetrics: this.globalMetrics,
        };
    }
    static fromJSON(obj) {
        if (typeof obj !== 'object' || obj === null)
            throw new Error('Invalid SimulationSnapshot JSON');
        const o = obj;
        const genomes = new Map();
        const genomeEntries = Array.isArray(o.genomes) ? o.genomes : [];
        for (const entry of genomeEntries) {
            if (!Array.isArray(entry) || entry.length !== 2)
                continue;
            const [id, g] = entry;
            if (Genome.validate(g)) {
                genomes.set(id, Genome.fromJSON(g));
            }
        }
        const states = new Map();
        const stateEntries = Array.isArray(o.particleStates) ? o.particleStates : [];
        for (const entry of stateEntries) {
            if (!Array.isArray(entry) || entry.length !== 2)
                continue;
            const [id, p] = entry;
            if (ParticleState.validate(p)) {
                states.set(id, ParticleState.fromJSON(p));
            }
        }
        return new SimulationSnapshot({
            version: typeof o.version === 'string' ? o.version : undefined,
            timestep: typeof o.timestep === 'number' ? o.timestep : undefined,
            genomes,
            particleStates: states,
            globalMetrics: typeof o.globalMetrics === 'object' && o.globalMetrics !== null ? o.globalMetrics : undefined,
        });
    }
}
