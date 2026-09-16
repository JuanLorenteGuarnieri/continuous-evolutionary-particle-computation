export interface ExperimentConfigData {
  readonly version: string;
  readonly duration: number;
  readonly checkpointInterval: number;
  readonly errorMeasure: string;
  readonly readout: Record<string, unknown>;
}

export class ExperimentConfig implements ExperimentConfigData {
  public readonly version: string;
  public readonly duration: number;
  public readonly checkpointInterval: number;
  public readonly errorMeasure: string;
  public readonly readout: Record<string, unknown>;

  constructor(data: Partial<ExperimentConfigData> = {}) {
    this.version = data.version ?? '3.0.0';
    this.duration = data.duration ?? 1000;
    this.checkpointInterval = data.checkpointInterval ?? 100;
    this.errorMeasure = data.errorMeasure ?? 'mse';
    this.readout = data.readout ?? {};
    this.validate();
  }

  public static validate(obj: unknown): obj is ExperimentConfigData {
    if (typeof obj !== 'object' || obj === null) return false;
    const o = obj as Record<string, unknown>;
    return (
      typeof o.version === 'string' &&
      typeof o.duration === 'number' && o.duration > 0 &&
      typeof o.checkpointInterval === 'number' && o.checkpointInterval > 0 &&
      typeof o.errorMeasure === 'string' &&
      typeof o.readout === 'object' && o.readout !== null
    );
  }

  public validate(): void {
    if (!ExperimentConfig.validate(this)) {
      throw new Error('Invalid ExperimentConfig');
    }
  }

  public toJSON(): ExperimentConfigData {
    return { ...this };
  }

  public static fromJSON(obj: Record<string, unknown>): ExperimentConfig {
    if (!ExperimentConfig.validate(obj)) throw new Error('Invalid ExperimentConfig JSON');
    return new ExperimentConfig(obj);
  }
}
