export interface ExperimentConfigData {
    readonly version: string;
    readonly duration: number;
    readonly checkpointInterval: number;
    readonly errorMeasure: string;
    readonly readout: Record<string, unknown>;
}
export declare class ExperimentConfig implements ExperimentConfigData {
    readonly version: string;
    readonly duration: number;
    readonly checkpointInterval: number;
    readonly errorMeasure: string;
    readonly readout: Record<string, unknown>;
    constructor(data?: Partial<ExperimentConfigData>);
    static validate(obj: unknown): obj is ExperimentConfigData;
    validate(): void;
    toJSON(): ExperimentConfigData;
    static fromJSON(obj: Record<string, unknown>): ExperimentConfig;
}
