import { MFMConfig } from './MFMConfig.js';
import { ExperimentConfig } from './ExperimentConfig.js';
export class ExperimentManifest {
    version;
    experimentId;
    description;
    mfmConfig;
    experimentConfig;
    inputSignal;
    outputReadout;
    duration;
    checkpointInterval;
    metricsToCollect;
    constructor(data = {}) {
        this.version = data.version ?? '3.0.0';
        this.experimentId = data.experimentId ?? '';
        this.description = data.description ?? '';
        this.mfmConfig = data.mfmConfig ?? new MFMConfig();
        this.experimentConfig = data.experimentConfig ?? new ExperimentConfig();
        this.inputSignal = data.inputSignal ?? {};
        this.outputReadout = data.outputReadout ?? {};
        this.duration = data.duration ?? 1000;
        this.checkpointInterval = data.checkpointInterval ?? 100;
        this.metricsToCollect = data.metricsToCollect ?? [];
        this.validate();
    }
    static validate(obj) {
        if (typeof obj !== 'object' || obj === null)
            return false;
        const o = obj;
        return (typeof o.version === 'string' &&
            typeof o.experimentId === 'string' && o.experimentId.length > 0 &&
            typeof o.description === 'string' &&
            o.mfmConfig instanceof MFMConfig &&
            o.experimentConfig instanceof ExperimentConfig &&
            typeof o.inputSignal === 'object' &&
            typeof o.outputReadout === 'object' &&
            typeof o.duration === 'number' && o.duration > 0 &&
            typeof o.checkpointInterval === 'number' && o.checkpointInterval > 0 &&
            Array.isArray(o.metricsToCollect));
    }
    validate() {
        if (!this.mfmConfig)
            throw new Error('mfmConfig required');
        if (!this.experimentConfig)
            throw new Error('experimentConfig required');
        if (!this.experimentId)
            throw new Error('experimentId required');
    }
    toJSON() {
        return {
            version: this.version,
            experimentId: this.experimentId,
            description: this.description,
            mfmConfig: this.mfmConfig.toJSON(),
            experimentConfig: this.experimentConfig.toJSON(),
            inputSignal: this.inputSignal,
            outputReadout: this.outputReadout,
            duration: this.duration,
            checkpointInterval: this.checkpointInterval,
            metricsToCollect: this.metricsToCollect,
        };
    }
    static fromJSON(obj) {
        if (typeof obj !== 'object' || obj === null)
            throw new Error('Invalid ExperimentManifest JSON');
        const o = obj;
        const mfmValue = o.mfmConfig;
        const expValue = o.experimentConfig;
        if (!MFMConfig.validate(mfmValue)) {
            throw new Error('Invalid MFMConfig JSON');
        }
        if (!ExperimentConfig.validate(expValue)) {
            throw new Error('Invalid ExperimentConfig JSON');
        }
        return new ExperimentManifest({
            version: typeof o.version === 'string' ? o.version : undefined,
            experimentId: typeof o.experimentId === 'string' ? o.experimentId : undefined,
            description: typeof o.description === 'string' ? o.description : undefined,
            mfmConfig: MFMConfig.fromJSON(mfmValue),
            experimentConfig: ExperimentConfig.fromJSON(expValue),
            inputSignal: typeof o.inputSignal === 'object' && o.inputSignal !== null ? o.inputSignal : {},
            outputReadout: typeof o.outputReadout === 'object' && o.outputReadout !== null ? o.outputReadout : {},
            duration: typeof o.duration === 'number' ? o.duration : undefined,
            checkpointInterval: typeof o.checkpointInterval === 'number' ? o.checkpointInterval : undefined,
            metricsToCollect: Array.isArray(o.metricsToCollect) ? o.metricsToCollect.filter((v) => typeof v === 'string') : undefined,
        });
    }
}
