export class ExperimentConfig {
    version;
    duration;
    checkpointInterval;
    errorMeasure;
    readout;
    constructor(data = {}) {
        this.version = data.version ?? '3.0.0';
        this.duration = data.duration ?? 1000;
        this.checkpointInterval = data.checkpointInterval ?? 100;
        this.errorMeasure = data.errorMeasure ?? 'mse';
        this.readout = data.readout ?? {};
        this.validate();
    }
    static validate(obj) {
        if (typeof obj !== 'object' || obj === null)
            return false;
        const o = obj;
        return (typeof o.version === 'string' &&
            typeof o.duration === 'number' && o.duration > 0 &&
            typeof o.checkpointInterval === 'number' && o.checkpointInterval > 0 &&
            typeof o.errorMeasure === 'string' &&
            typeof o.readout === 'object' && o.readout !== null);
    }
    validate() {
        if (!ExperimentConfig.validate(this)) {
            throw new Error('Invalid ExperimentConfig');
        }
    }
    toJSON() {
        return { ...this };
    }
    static fromJSON(obj) {
        if (!ExperimentConfig.validate(obj))
            throw new Error('Invalid ExperimentConfig JSON');
        return new ExperimentConfig(obj);
    }
}
//# sourceMappingURL=ExperimentConfig.js.map