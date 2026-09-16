import { ParticleID } from './types.js';
import { Genome } from './Genome.js';
import { ParticleState } from './ParticleState.js';
export interface PopulationStateData {
    readonly version: string;
    readonly genomes: Map<ParticleID, Genome>;
    readonly particles: Map<ParticleID, ParticleState>;
}
export declare class PopulationState implements PopulationStateData {
    readonly version: string;
    genomes: Map<ParticleID, Genome>;
    particles: Map<ParticleID, ParticleState>;
    constructor(data?: Partial<PopulationStateData>);
    static validate(obj: unknown): obj is PopulationStateData;
    private validate;
    addParticle(id: ParticleID, genome: Genome, state: ParticleState): void;
    removeParticle(id: ParticleID): void;
    getParticle(id: ParticleID): {
        genome: Genome;
        state: ParticleState;
    } | undefined;
    forEachParticle(fn: (id: ParticleID, genome: Genome, state: ParticleState) => void): void;
    toJSON(): object;
    static fromJSON(obj: Record<string, unknown>): PopulationState;
}
