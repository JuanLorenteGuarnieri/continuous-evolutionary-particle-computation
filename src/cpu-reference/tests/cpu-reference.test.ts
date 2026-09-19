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

  it('updates dynamic particle position and wraps it periodically', () => {
    const cfg = new MFMConfig({ Lx:10, Ly:10, Nmax:10, dt:1, seed:1 });
    const pop = new PopulationState();
    const g = new Genome({ H_max:10, theta_q:5, A:2, gamma:0, omega_R:0, omega_A:0, omega_v:0 });
    pop.addParticle('p1', g, new ParticleState({
      position:{x:9.5,y:2}, velocity:{x:1,y:0}, health:5, charge:0,
    }));
    const next = new MfmCpuReference(cfg, pop, 42).step();
    const state = next.particles.get('p1');

    expect(state?.position.x).toBeGreaterThanOrEqual(0);
    expect(state?.position.x).toBeLessThan(10);
    expect(state?.position.x).not.toBeCloseTo(9.5);
    expect(state?.position.y).toBeCloseTo(2);
    expect(state?.velocity.x).toBeGreaterThan(0);
  });

  it('keeps interface particles fixed and delivers input on the next step', () => {
    const cfg = new MFMConfig({ Lx:10, Ly:10, Nmax:10, dt:1, Qmax:5, Q_in_max:5, seed:1 });
    const pop = new PopulationState();
    const inputGenome = new Genome({ H_max:10, theta_q:1, A:1, K:1, R_c:2, gamma:0 });
    const outputGenome = new Genome({ H_max:10, theta_q:5, A:1, K:1, R_c:0.1, gamma:0 });
    pop.addParticle('input', inputGenome, new ParticleState({
      position:{x:1,y:1}, velocity:{x:4,y:2}, health:10, charge:0, role:'input',
    }));
    pop.addParticle('output', outputGenome, new ParticleState({
      position:{x:2,y:1}, velocity:{x:4,y:2}, health:10, charge:0, role:'output',
    }));
    const sim = new MfmCpuReference(cfg, pop, 42);
    sim.injectInput(1);
    const first = sim.step();
    const second = sim.step();

    expect(first.particles.get('input')?.position).toEqual({ x:1, y:1 });
    expect(first.particles.get('output')?.position).toEqual({ x:2, y:1 });
    expect(first.particles.get('output')?.charge).toBe(0);
    expect(second.particles.get('output')?.charge).toBe(1);
  });

  it('applies global pressure as gradual health loss', () => {
    const cfg = new MFMConfig({ Lx:10, Ly:10, Nmax:10, dt:0.1, lambda:0.1, P_min:1, P_max:1, seed:1 });
    const pop = new PopulationState();
    const genome = new Genome({ H_max:10, theta_q:5, A:2 });
    pop.addParticle('p1', genome, new ParticleState({ position:{x:1,y:1}, health:5, charge:0 }));
    const sim = new MfmCpuReference(cfg, pop, 42);
    const next = sim.step();

    expect(next.particles.get('p1')?.health).toBeCloseTo(4.9);
  });

  it('keeps input as a non-receiving interface and output as a non-sender', () => {
    const cfg = new MFMConfig({ Lx:10, Ly:10, Nmax:10, Qmax:10, dt:0.1, seed:1 });
    const pop = new PopulationState();
    const genome = new Genome({ H_max:10, theta_q:1, A:2, K:1, R_c:5 });
    pop.addParticle('input', genome, new ParticleState({ position:{x:1,y:1}, health:10, charge:0, role:'input' }));
    pop.addParticle('output', genome, new ParticleState({ position:{x:2,y:1}, health:10, charge:1, role:'output' }));
    pop.addParticle('internal', genome, new ParticleState({ position:{x:1,y:2}, health:10, charge:1, role:'internal' }));
    const sim = new MfmCpuReference(cfg, pop, 42);
    const first = sim.step();
    const second = sim.step();

    expect(first.particles.get('input')?.charge).toBe(0);
    expect(second.particles.get('input')?.charge).toBe(0);
    expect(first.particles.get('internal')?.charge).toBe(0);
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
    sim2.step();
    const a = sim1.getState();
    const b = sim2.getState();
    expect(a.timestep).toBe(b.timestep);
  });
});
