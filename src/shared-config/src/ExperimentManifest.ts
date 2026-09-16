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

export class ExperimentManifest implements ExperimentManifestData {
  public readonly version: string;
  public readonly experimentId: string;
  public readonly description: string;
  public readonly mfmConfig: MFMConfig;
  public readonly experimentConfig: ExperimentConfig;
  public readonly inputSignal: Record<string, unknown>;
  public readonly outputReadout: Record<string, unknown>;
  public readonly duration: number;
  public readonly checkpointInterval: number;
  public readonly metricsToCollect: string[];

  constructor(data: Partial<ExperimentManifestData> = {}) {
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

  public static validate(obj: unknown): obj is ExperimentManifestData {
    if (typeof obj !== 'object' || obj === null) return false;
    const o = obj as Record<string, unknown>;
    return (
      typeof o.version === 'string' &&
      typeof o.experimentId === 'string' && o.experimentId.length > 0 &&
      typeof o.description === 'string' &&
      o.mfmConfig instanceof MFMConfig &&
      o.experimentConfig instanceof ExperimentConfig &&
      typeof o.inputSignal === 'object' &&
      typeof o.outputReadout === 'object' &&
      typeof o.duration === 'number' && o.duration > 0 &&
      typeof o.checkpointInterval === 'number' && o.checkpointInterval > 0 &&
      Array.isArray(o.metricsToCollect)
    );
  }

  public validate(): void {
    if (!this.mfmConfig) throw new Error('mfmConfig required');
    if (!this.experimentConfig) throw new Error('experimentConfig required');
    if (!this.experimentId) throw new Error('experimentId required');
  }

  public toJSON(): object {
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

  public static fromJSON(obj: any): ExperimentManifest {
    const mfm = MFMConfig.fromJSON(obj.mfmConfig);
    const exp = ExperimentConfig.fromJSON(obj.experimentConfig);
    return new ExperimentManifest({
      version: obj.version,
      experimentId: obj.experimentId,
      description: obj.description,
      mfmConfig: mfm,
      experimentConfig: exp,
      inputSignal: obj.inputSignal,
      outputReadout: obj.outputReadout,
      duration: obj.duration,
      checkpointInterval: obj.checkpointInterval,
      metricsToCollect: obj.metricsToCollect,
    });
  }
}
