import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { MFMConfig, PopulationState, Genome, ParticleState } from '@cepc/shared-config';
import { MfmCpuReference } from '@cepc/cpu-reference';

function loadJson(path: string) {
  return JSON.parse(readFileSync(path, 'utf-8'));
}

describe('Behavioral Tests', () => {
  it('one-step exact', () => {
    const data = loadJson('tests/behavioral/data/one-step-exact.json');
    const cfg = new MFMConfig(data.config);
    const pop = new PopulationState();
    for (const [id, g] of Object.entries(data.population.genomes)) {
      pop.addParticle(id, new Genome(g as any), new ParticleState((data.population.particles[id] as any)));
    }
    const sim = new MfmCpuReference(cfg, pop, data.config.seed);
    const next = sim.step();
    const state = next.particles.get('p1')!;
    const expected = data.expected.p1;
    expect(state.charge).toBe(expected.charge);
  });
});
