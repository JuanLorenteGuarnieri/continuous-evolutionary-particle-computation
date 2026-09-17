import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { MFMConfig, PopulationState, Genome, ParticleState } from '@cepc/shared-config';
import { MfmCpuReference } from '@cepc/cpu-reference';

function loadJson(path: string) {
  return JSON.parse(readFileSync(path, 'utf-8'));
}

const manifest = loadJson('tests/behavioral/test-manifest.json');

describe('Behavioral Tests', () => {
  for (const family of manifest.testFamilies) {
    it(`${family.id}`, () => {
      const data = loadJson(`tests/behavioral/${family.dataFile}`);
      const cfg = new MFMConfig(data.config);
      const pop = new PopulationState();
      for (const [id, g] of Object.entries(data.population.genomes)) {
        pop.addParticle(id, new Genome(g as any), new ParticleState((data.population.particles[id] as any)));
      }
      const sim = new MfmCpuReference(cfg, pop, data.config.seed ?? cfg.seed);
      const steps = data.steps ?? 1;
      for (let i = 0; i < steps; i++) {
        sim.step();
      }
      for (const [pid, exp] of Object.entries(data.expected)) {
        const state = sim.getState().population.particles.get(pid);
        expect(state?.charge).toBe(exp.charge);
        if (exp.health !== undefined) {
          expect(state?.health).toBe(exp.health);
        }
     }
   });
 }
});
