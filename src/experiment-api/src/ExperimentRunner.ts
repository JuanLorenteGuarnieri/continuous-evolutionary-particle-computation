 import { ExperimentManifest } from '@cepc/shared-config';
 import { MfmCpuReference } from '@cepc/cpu-reference';
 import { MetricsCollector } from './MetricsCollector.js';
 import { PopulationState, Genome, ParticleState, ParticleID } from '@cepc/shared-config';
 
export interface ExperimentResult {
  manifestId: string;
  steps: number;
  metrics: Record<string, number[]>;
  finalPopulation: PopulationState;
  config: Record<string, unknown>;
}
 
export class ExperimentRunner {
  private metricsCollector = new MetricsCollector();

  constructor(private manifest: ExperimentManifest, private backend: 'cpu' | 'gpu' = 'cpu') {}

  private createInitialPopulation(): PopulationState {
     const config = this.manifest.mfmConfig;
     const population = new PopulationState();
 
     const count = Math.min(config.Nmax, 16);
     const spacing = Math.min(config.Lx, config.Ly) / 5;
     const startX = (config.Lx - spacing * (Math.sqrt(count) - 1)) / 2;
     const startY = (config.Ly - spacing * (Math.sqrt(count) - 1)) / 2;
 
     let idx = 0;
     for (let y = 0; y < Math.sqrt(count); y++) {
       for (let x = 0; x < Math.sqrt(count); x++) {
         const id = `particle-${idx}` as ParticleID;
         const genome = new Genome({
           Hmax: 100,
           theta_q: 10,
           A: 2,
           K: 4,
           Rc: 1.0,
           m: 1.0,
           gamma: 0.1,
           Rs: 1.0,
           omega_R: 0.5,
           omega_A: 0.5,
           omega_v: 0.5
         });
         const state = new ParticleState({
           version: '3.0.0',
           position: { x: startX + x * spacing, y: startY + y * spacing },
           velocity: { x: 0, y: 0 },
           health: 100,
           charge: 0,
           senderSet: new Set(),
           prevSenderSet: new Set()
         });
 
         population.addParticle(id, genome.clone(), state);
         idx++;
       }
     }
 
     return population;
   }
 
  async run(): Promise<ExperimentResult> {
    const config = this.manifest.mfmConfig;
    const initialPopulation = this.createInitialPopulation();
    let simulation;
    if (this.backend === 'cpu') {
      simulation = new MfmCpuReference(config, initialPopulation, config.seed);
    } else {
      // GPU backend placeholder: use CPU for now
      simulation = new MfmCpuReference(config, initialPopulation, config.seed);
    }
 
     // Run simulation for duration steps
     for (let step = 0; step < this.manifest.duration; step++) {
       simulation.step();
 
       // Collect metrics every checkpointInterval
       if (step % this.manifest.checkpointInterval === 0) {
         const state = simulation.getState();
         const population = state.population as PopulationState;
         const count = population.particles.size;
         let totalHealth = 0;
         let totalCharge = 0;
         for (const [id, p] of population.particles) {
           totalHealth += p.health;
           totalCharge += p.charge;
         }
         this.metricsCollector.record('populationCount', count);
         this.metricsCollector.record('avgHealth', count > 0 ? totalHealth / count : 0);
         this.metricsCollector.record('totalCharge', totalCharge);
       }
     }
 
     const finalState = simulation.getState();
    const result: ExperimentResult = {
      manifestId: this.manifest.experimentId,
      steps: this.manifest.duration,
      metrics: this.metricsCollector.getMetrics(),
      finalPopulation: finalState.population as PopulationState,
      config: {
        mfmConfig: this.manifest.mfmConfig,
        experimentConfig: this.manifest.experimentConfig
      }
    };

    return result;
  }
 
  async runSweep(params: Record<string, unknown>): Promise<unknown> {
    return { swept: true };
  }

  async runReplicates(n: number): Promise<unknown[]> {
    const results = [];
    for (let i = 0; i < n; i++) {
      const res = await this.run();
      results.push(res);
    }
    return results;
  }
  exportResult(result: ExperimentResult, format: 'json' | 'csv' = 'json'): string {
    if (format === 'json') {
      return JSON.stringify({
        manifestId: result.manifestId,
        steps: result.steps,
        metrics: result.metrics,
        config: {
          mfmConfig: result.config.mfmConfig.toJSON(),
          experimentConfig: result.config.experimentConfig.toJSON()
        }
      });
    } else {
      // Simple CSV export: flatten metrics
      const keys = Object.keys(result.metrics);
      let csv = 'metric,' + keys.join(',') + '\n';
      const maxLen = Math.max(...keys.map(k => result.metrics[k].length));
      for (let i = 0; i < maxLen; i++) {
        const row = [i.toString()];
        for (const k of keys) {
          row.push(result.metrics[k][i] ?? '');
        }
        csv += row.join(',') + '\n';
      }
      return csv;
    }
  }
}
