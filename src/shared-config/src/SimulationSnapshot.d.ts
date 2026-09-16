import { Genome } from './Genome.js';
import { ParticleState } from './ParticleState.js';
import { ParticleID } from './types.js';
export interface SimulationSnapshotData {
    readonly version: string;
    readonly timestep: number;
    readonly genomes: Map<ParticleID, Genome>;
    readonly particleStates: Map<ParticleID, ParticleState>;
    readonly globalMetrics?: Record<string, unknown>;
}
export declare class SimulationSnapshot implements SimulationSnapshotData {
    readonly version: string;
    readonly timestep: number;
    readonly genomes: Map<ParticleID, Genome>;
    readonly particleStates: Map<ParticleID, ParticleState>;
    readonly globalMetrics?: Record<string, unknown>;
    constructor(data?: Partial<SimulationSnapshotData>);
    static validate(obj: unknown): boolean;
    toJSON(): object;
    static fromJSON(obj: Record<string, unknown>): SimulationSnapshot;
}
