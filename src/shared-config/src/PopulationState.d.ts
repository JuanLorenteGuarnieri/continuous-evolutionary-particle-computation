import { ParticleID } from './types';
import { Genome } from './Genome';
import { ParticleState } from './ParticleState';
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
    static fromJSON(obj: unknown): PopulationState;
}
