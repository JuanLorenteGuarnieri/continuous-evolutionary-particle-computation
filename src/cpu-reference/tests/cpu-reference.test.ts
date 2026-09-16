import { describe, it, expect } from 'vitest';
import { MFMConfig, Genome, ParticleState, PopulationState } from '@cepc/shared-config';
import { MfmCpuReference } from '../src/MfmCpuReference.js';
import { periodicDistance } from '../src/vector2d.js';

describe('vector2d', () => {
  it('periodic distance wraps', () => {
    const d = periodicDistance({x:0,y:0},{x:9,y:0},10,10);
    expect(d).toBeCloseTo(1);
  });
});

describe('MfmCpuReference', () => {
  it('steps without error', () => {
    const cfg = new MFMConfig({ Lx:10, Ly:10, Nmax:10, dt:0.1, seed:1 });
    const pop = new PopulationState();
    const g = new Genome({ H_max:10, theta_q:5, A:2 });
    const s = new ParticleState({ position:{x:1,y:1}, velocity:{x:0,y:0}, health:5, charge:6 });
    pop.addParticle('p1', g, s);
    const sim = new MfmCpuReference(cfg, pop, 42);
    const next = sim.step();
    expect(next.particles.size).toBe(1);
  });

  it('deterministic replay', () => {
    const cfg = new MFMConfig({ Lx:10, Ly:10, Nmax:10, dt:0.1, seed:7 });
    const pop = new PopulationState();
    const g = new Genome({ H_max:10, theta_q:5, A:2 });
    const s = new ParticleState({ position:{x:2,y:2}, velocity:{x:0.1,y:0}, health:5, charge:10 });
    pop.addParticle('p1', g, s);
    const sim1 = new MfmCpuReference(cfg, pop, 99);
    sim1.step();
    const saved = sim1.getState();
    sim1.step();
    const sim2 = new MfmCpuReference(cfg, pop, 99);
    sim2.step();
    sim2.setState(saved);
    const a = sim1.getState();
    const b = sim2.getState();
    expect(a.timestep).toBe(b.timestep);
  });
});
