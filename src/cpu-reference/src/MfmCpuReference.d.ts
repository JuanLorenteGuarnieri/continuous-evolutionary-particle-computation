import { MFMConfig, PopulationState } from '@cepc/shared-config';
export declare class MfmCpuReference {
    private config;
    private population;
    private rng;
    private timestep;
    constructor(config: MFMConfig, population: PopulationState, seed?: number);
    step(): PopulationState;
    run(steps: number): PopulationState[];
    getState(): unknown;
    setState(state: Record<string, unknown>): void;
}
