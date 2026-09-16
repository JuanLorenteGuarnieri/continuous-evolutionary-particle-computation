import { MFMConfig } from './MFMConfig.js';
import { ExperimentConfig } from './ExperimentConfig.js';
export interface ExperimentManifestData {
    readonly version: string;
    readonly experimentId: string;
    readonly description: string;
    readonly mfmConfig: MFMConfig;
    readonly experimentConfig: ExperimentConfig;
    readonly inputSignal: Record<string, unknown>;
    readonly outputReadout: Record<string, unknown>;
    readonly duration: number;
    readonly checkpointInterval: number;
    readonly metricsToCollect: string[];
}
export declare class ExperimentManifest implements ExperimentManifestData {
    readonly version: string;
    readonly experimentId: string;
    readonly description: string;
    readonly mfmConfig: MFMConfig;
    readonly experimentConfig: ExperimentConfig;
    readonly inputSignal: Record<string, unknown>;
    readonly outputReadout: Record<string, unknown>;
    readonly duration: number;
    readonly checkpointInterval: number;
    readonly metricsToCollect: string[];
    constructor(data?: Partial<ExperimentManifestData>);
    static validate(obj: unknown): obj is ExperimentManifestData;
    validate(): void;
    toJSON(): object;
    static fromJSON(obj: any): ExperimentManifest;
}
