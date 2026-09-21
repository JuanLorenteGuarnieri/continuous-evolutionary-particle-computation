import { RandomLike } from './types.js';
export interface GenomeData {
    readonly version: string;
    readonly H_max: number;
    readonly theta_q: number;
    readonly A: number;
    readonly K: number;
    readonly R_c: number;
    readonly m: number;
    readonly gamma: number;
    readonly R_s: number;
    readonly omega_R: number;
    readonly omega_A: number;
    readonly omega_v: number;
}
export declare class Genome implements GenomeData {
    readonly version: string;
    readonly H_max: number;
    readonly theta_q: number;
    readonly A: number;
    readonly K: number;
    readonly R_c: number;
    readonly m: number;
    readonly gamma: number;
    readonly R_s: number;
    readonly omega_R: number;
    readonly omega_A: number;
    readonly omega_v: number;
    constructor(data?: Partial<GenomeData> & {
        version?: string;
    });
    static validate(obj: unknown): obj is GenomeData;
    private validate;
    clone(): Genome;
    mutate(rng: RandomLike, rate?: number): Genome;
    crossover(other: Genome, rng: RandomLike): Genome;
    toJSON(): GenomeData;
    static fromJSON(obj: unknown): Genome;
}
