import { ExperimentManifest } from '@cepc/shared-config';
export interface ExperimentResult {
  manifestId: string;
  steps: number;
  metrics: Record<string, number[]>;
}
export class ExperimentRunner {
  constructor(private manifest: ExperimentManifest) {}
  async run(): Promise<ExperimentResult> {
    return {
      manifestId: this.manifest.experimentId,
      steps: this.manifest.duration,
      metrics: {}
    };
  }
  async runSweep(params: any): Promise<any> { return {}; }
  async runReplicates(n: number): Promise<any> { return {}; }
}
