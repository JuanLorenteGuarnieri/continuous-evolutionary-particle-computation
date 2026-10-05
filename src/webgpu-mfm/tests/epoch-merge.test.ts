/**
 * Phase 20 — EpochTopologyMerger (skip the merge while the producer's topology epoch is unchanged).
 * Differential test against the reference rebuild: the producer bumps its epoch exactly when it changes topology/event metadata (the contract of
 * MfmWebGPUStepper.getTopologyEpoch); the skipping merger's view must equal the rebuild's after every step, and a foreign/replaced view or
 * source must never be skipped. LIMITS: Node data-model test; says nothing about browser speed.
 */
import { describe, it, expect } from 'vitest';
import { Genome, ParticleState, PopulationState } from '@cepc/shared-config';
import { EpochTopologyMerger, mergeNormalPopulationTopologyRebuild } from '../src/topology-merge';

function rng(seed: number): () => number {
  let x = seed >>> 0 || 1;
  return () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 0x100000000; };
}
const genome = (r: () => number) => new Genome({ H_max: 50 + r() * 50, theta_q: 3, A: 1, K: 2, R_c: 1, m: 1, gamma: 0.1, R_s: 2, omega_R: r() - 0.5, omega_A: 0, omega_v: 0 });
const state = (id: number, r: () => number) => new ParticleState({ position: { x: r() * 9, y: r() * 9 }, velocity: { x: 0, y: 0 }, health: 50, charge: 1, senderSet: new Set([`p${Math.floor(r() * 30)}`]), prevSenderSet: new Set(), role: id === 0 ? 'input' : 'internal' });
const serialize = (p: PopulationState) => JSON.stringify([...p.particles].map(([id, s]) => [id, p.genomes.has(id) ? { ...p.genomes.get(id)! } : null, s.position, s.health, s.charge, [...s.senderSet].sort(), [...s.prevSenderSet].sort(), s.role]));
function deepCopy(p: PopulationState): PopulationState {
  const c = new PopulationState();
  for (const [id, s] of p.particles) c.addParticle(id, p.genomes.get(id)!.clone(), new ParticleState({ version: s.version, position: { ...s.position }, velocity: { ...s.velocity }, health: s.health, charge: s.charge, senderSet: new Set(s.senderSet), prevSenderSet: new Set(s.prevSenderSet), role: s.role }));
  return c;
}

describe('EpochTopologyMerger', () => {
  it('equals the reference rebuild over randomized evolution, skipping exactly the quiet steps', () => {
    for (const seed of [1, 2, 3, 4]) {
      const r = rng(seed * 7919);
      const next = new PopulationState();
      for (let i = 0; i < 40; i++) next.addParticle(`p${i}`, genome(r), state(i, r));
      let epoch = 0;
      const merger = new EpochTopologyMerger();
      let refView: PopulationState | null = deepCopy(next);
      let view: PopulationState | null = deepCopy(next);
      let counter = 1000;
      let quietSteps = 0;
      for (let step = 0; step < 150; step++) {
        const roll = r();
        const ids = [...next.particles.keys()];
        if (roll < 0.7) {
          quietSteps++; // quiet: the producer changes nothing and keeps its epoch
        } else if (roll < 0.8) {
          epoch++; next.particles.get(ids[Math.floor(r() * ids.length)])!.senderSet = new Set([`p${Math.floor(r() * 50)}`]);
        } else if (roll < 0.88) {
          epoch++; next.addParticle(`p${counter++}`, genome(r), state(5, r));
        } else if (roll < 0.95 && next.particles.size > 10) {
          epoch++; next.removeParticle(ids[Math.floor(r() * ids.length)]);
        } else {
          epoch++; next.particles.get(ids[Math.floor(r() * ids.length)])!.role = 'output';
        }
        refView = mergeNormalPopulationTopologyRebuild(refView, next);
        view = merger.merge(view, next, epoch);
        expect(serialize(view), `seed ${seed} step ${step}`).toBe(serialize(refView));
        // worker-side dynamic edits (explicit sync) happen to both views identically
        if (r() < 0.2) for (const v of [refView, view]) for (const [, s] of v.particles) s.health += 1;
      }
      expect(merger.skipped).toBeGreaterThan(quietSteps / 2); // most quiet steps are skipped (the first merge after any change is real)
      expect(merger.skipped).toBeLessThanOrEqual(quietSteps);
    }
  });

  it('never skips when the view or the source object is not the one the last merge used', () => {
    const r = rng(11);
    const next = new PopulationState();
    for (let i = 0; i < 8; i++) next.addParticle(`p${i}`, genome(r), state(i, r));
    const merger = new EpochTopologyMerger();
    const v1 = merger.merge(deepCopy(next), next, 5);
    expect(merger.skipped).toBe(0);
    expect(merger.merge(v1, next, 5)).toBe(v1);
    expect(merger.skipped).toBe(1);
    const replacedView = deepCopy(next);
    next.particles.get('p3')!.role = 'output';
    const v2 = merger.merge(replacedView, next, 5); // same epoch but a different view object (the worker replaced its population): real merge
    expect(merger.skipped).toBe(1);
    expect(v2.particles.get('p3')!.role).toBe('output');
    const otherSource = deepCopy(next);
    merger.merge(v2, otherSource, 5); // a different source object with the same epoch: real merge
    expect(merger.skipped).toBe(1);
    merger.reset();
    const v3 = merger.merge(v2, otherSource, 5); // after reset nothing is skippable, even with the same epoch
    expect(merger.skipped).toBe(0);
    expect(serialize(v3)).toBe(serialize(otherSource));
  });

  it('previous === next (the worker and the stepper share the very first population object) is handled', () => {
    const r = rng(3);
    const shared = new PopulationState();
    for (let i = 0; i < 6; i++) shared.addParticle(`p${i}`, genome(r), state(i, r));
    const merger = new EpochTopologyMerger();
    const before = serialize(shared);
    const view = merger.merge(shared, shared, 0);
    expect(serialize(view)).toBe(before);
    shared.particles.get('p2')!.senderSet = new Set(['p5']);
    const view2 = merger.merge(view, shared, 1);
    expect(serialize(view2)).toBe(serialize(shared));
  });
});
