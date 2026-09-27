import { describe, it, expect } from 'vitest';
import { Genome, ParticleState, PopulationState, MFMConfig, ExperimentConfig, SimulationSnapshot, ExperimentManifest } from '../src/index';

describe('Genome', () => {
  it('creates valid genome', () => {
    const g = new Genome({ H_max: 10, theta_q: 2 });
    expect(g.H_max).toBe(10);
    expect(g.version).toBe('3.0.0');
  });
  it('rejects invalid data', () => {
    expect(() => new Genome({ H_max: -1 } as any)).toThrow();
  });
  it('clone works', () => {
    const g = new Genome();
    const c = g.clone();
    expect(c.H_max).toBe(g.H_max);
  });
  it('mutate returns valid genome', () => {
    const rng = { nextFloat: () => 0.5 };
    const g = new Genome();
    const m = g.mutate(rng);
    expect(Genome.validate(m)).toBe(true);
  });
});

describe('ParticleState', () => {
  it('validates charge', () => {
    const s = new ParticleState({ charge: 5, health: 10 });
    expect(s.isValid()).toBe(true);
  });
  it('rejects negative charge', () => {
    expect(() => new ParticleState({ charge: -1 } as any)).toThrow();
  });
});

describe('PopulationState', () => {
  it('validates presence of genome', () => {
    const pop = new PopulationState();
    const g = new Genome();
    const s = new ParticleState();
    pop.addParticle('p1', g, s);
    expect(pop.getParticle('p1')).toBeDefined();
  });
});

describe('MFMConfig', () => {
  it('valid config', () => {
    const cfg = new MFMConfig({ Lx: 10, Ly: 10, Nmax: 100, dt: 0.1 });
    expect(cfg.Lx).toBe(10);
  });
  it('rejects zero dt', () => {
    expect(() => new MFMConfig({ dt: 0 } as any)).toThrow();
  });
});

describe('Serialization', () => {
  it('Genome roundtrip', () => {
    const g = new Genome({ H_max: 20 });
    const json = g.toJSON();
    const g2 = Genome.fromJSON(json);
    expect(g2.H_max).toBe(20);
  });
  it('ParticleState roundtrip', () => {
    const s = new ParticleState({ charge: 3 });
    const json = s.toJSON();
    const s2 = ParticleState.fromJSON(json);
    expect(s2.charge).toBe(3);
  });
});