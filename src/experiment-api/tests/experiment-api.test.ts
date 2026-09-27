import { describe, it, expect } from 'vitest';
import { ExperimentRunner } from '../src/ExperimentRunner.ts';
import { MetricsCollector } from '../src/MetricsCollector.ts';
import { MFMConfig, ExperimentConfig, ExperimentManifest } from '@cepc/shared-config';
describe('Experiment API', () => {
  it('runner creates result', async () => {
    const manifest = new ExperimentManifest({
      experimentId: 'test',
      description: '',
      mfmConfig: new MFMConfig(),
      experimentConfig: new ExperimentConfig(),
      duration: 10,
      checkpointInterval: 1,
      metricsToCollect: []
    });
    const runner = new ExperimentRunner(manifest);
    const res = await runner.run();
    expect(res.manifestId).toBe('test');
  });
  it('metrics collector records', () => {
    const mc = new MetricsCollector();
    mc.record('readout', 1.2);
    expect(mc.getMetrics().readout).toEqual([1.2]);
  });
});