/**
 * Phase 19 — TopologyMerger (incremental) must be observationally equivalent to the reference rebuild
 * (mergeNormalPopulationTopologyRebuild, the pre-Phase-19 worker implementation).
 *
 * The test evolves a "stepper-side" population through randomized steps (set changes, role changes, births, deaths, genome object
 * replacement, id reordering, an id without genome, a foreign previous view) and, after every step, merges it into two independent
 * worker views, one per implementation, with identical worker-side dynamic-state edits in between (as a full sync would make).
 * Views must serialize identically (ids in order, genomes by value, dynamic state, sender sets by content) and the incremental
 * view must never alias the stepper's Sets or Genomes.
 *
 * LIMITS (be explicit): this proves equivalence for the data model and the transitions generated here, under assumption (A1) of
 * src/topology-merge.ts (genome objects are replaced, not mutated). It measures nothing about speed on the GPU/browser.
 */
import { describe, it, expect } from 'vitest';
import { Genome, ParticleState, PopulationState } from '@cepc/shared-config';
import { TopologyMerger, mergeNormalPopulationTopologyRebuild } from '../src/topology-merge';

function rng(seed: number): () => number {
  let x = seed >>> 0 || 1;
  return () => {
    x ^= x << 13; x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5; x >>>= 0;
    return x / 0x100000000;
  };
}

const makeGenome = (r: () => number): Genome =>
  new Genome({ H_max: 50 + r() * 100, theta_q: 1 + Math.floor(r() * 10), A: 0.5 + r(), K: 1 + Math.floor(r() * 4), R_c: 0.5 + r(), m: 0.5 + r(), gamma: r(), R_s: 0.5 + r() * 4, omega_R: r() - 0.5, omega_A: r() - 0.5, omega_v: r() - 0.5 });

const roles = ['internal', 'input', 'output'] as const;

function makeState(id: number, r: () => number): ParticleState {
  return new ParticleState({
    position: { x: r() * 50, y: r() * 50 },
    velocity: { x: r() - 0.5, y: r() - 0.5 },
    health: r() * 100,
    charge: Math.floor(r() * 100),
    senderSet: new Set(Array.from({ length: Math.floor(r() * 3) }, () => `p${Math.floor(r() * 40)}`)),
    prevSenderSet: new Set(Array.from({ length: Math.floor(r() * 3) }, () => `p${Math.floor(r() * 40)}`)),
    role: id < 2 ? roles[id + 1] : 'internal',
  });
}

function build(n: number, r: () => number): PopulationState {
  const p = new PopulationState();
  for (let i = 0; i < n; i++) p.addParticle(`p${i}`, makeGenome(r), makeState(i, r));
  return p;
}

function deepCopy(p: PopulationState): PopulationState {
  const c = new PopulationState();
  for (const [id, s] of p.particles) {
    c.addParticle(id, p.genomes.get(id)!.clone(), new ParticleState({
      version: s.version, position: { ...s.position }, velocity: { ...s.velocity }, health: s.health, charge: s.charge,
      senderSet: new Set(s.senderSet), prevSenderSet: new Set(s.prevSenderSet), role: s.role,
    }));
  }
  return c;
}

const serialize = (p: PopulationState): string =>
  JSON.stringify([...p.particles].map(([id, s]) => [
    id,
    p.genomes.has(id) ? { ...p.genomes.get(id)! } : null,
    s.version, s.position, s.velocity, s.health, s.charge, [...s.senderSet].sort(), [...s.prevSenderSet].sort(), s.role,
  ]));

/** The stepper-side population evolves; `next` keeps object identity between steps (as the real stepper's does). */
function evolve(next: PopulationState, r: () => number, step: number, counter: { id: number }, kind: string): void {
  const ids = [...next.particles.keys()];
  const pick = () => ids[Math.floor(r() * ids.length)];
  switch (kind) {
    case 'sets': // sender metadata changes on some particles (replaced Sets, like the stepper does)
      for (let k = 0; k < Math.max(1, ids.length / 5); k++) {
        const s = next.particles.get(pick())!;
        s.senderSet = new Set(Array.from({ length: Math.floor(r() * 4) }, () => `p${Math.floor(r() * 60)}`));
        if (r() < 0.5) s.prevSenderSet = new Set(s.senderSet);
      }
      break;
    case 'noop':
      break;
    case 'role':
      next.particles.get(pick())!.role = roles[Math.floor(r() * 3)];
      break;
    case 'birth':
      for (let k = 0; k < 1 + Math.floor(r() * 3); k++) {
        const id = `p${counter.id++}`;
        next.addParticle(id, makeGenome(r), makeState(99, r));
      }
      break;
    case 'death':
      for (let k = 0; k < 1 + Math.floor(r() * 3); k++) if (next.particles.size > 5) next.removeParticle(pick());
      break;
    case 'replace-genome': {
      const id = pick();
      next.genomes.set(id, makeGenome(r)); // a DIFFERENT object with different values
      break;
    }
    case 'reorder': {
      const entries = [...next.particles].reverse();
      const genomes = new Map(next.genomes);
      next.particles.clear();
      next.genomes.clear();
      for (const [id, s] of entries) next.addParticle(id, genomes.get(id)!, s);
      break;
    }
    case 'missing-genome': {
      next.genomes.delete(pick()); // the rebuild skips ids without genome
      break;
    }
  }
  void step;
}

function checkNoAliasing(view: PopulationState, next: PopulationState): void {
  for (const [id, s] of view.particles) {
    const n = next.particles.get(id);
    if (n) {
      expect(s.senderSet === n.senderSet).toBe(false);
      expect(s.prevSenderSet === n.prevSenderSet).toBe(false);
    }
    const g = next.genomes.get(id);
    if (g) expect(view.genomes.get(id) === g).toBe(false);
  }
}

describe('TopologyMerger equals the reference rebuild', () => {
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    it(`randomized evolution, seed ${seed}`, () => {
      const r = rng(seed * 104729);
      const counter = { id: 1000 };
      const next = build(40, r);
      const refView0 = deepCopy(next);
      let refView: PopulationState | null = refView0;
      const merger = new TopologyMerger();
      let incView: PopulationState | null = deepCopy(next);
      const kinds = ['noop', 'sets', 'sets', 'noop', 'role', 'birth', 'death', 'replace-genome', 'reorder', 'sets', 'noop', 'missing-genome', 'noop'];
      for (let step = 0; step < 120; step++) {
        const kind = kinds[Math.floor(r() * kinds.length)];
        evolve(next, r, step, counter, kind);
        refView = mergeNormalPopulationTopologyRebuild(refView, next);
        incView = merger.merge(incView, next);
        expect(serialize(incView), `seed ${seed} step ${step} (${kind})`).toBe(serialize(refView));
        checkNoAliasing(incView, next);

        // identical worker-side dynamic-state edit in both views (what an explicit full sync / interaction would do)
        if (r() < 0.3) {
          for (const view of [refView, incView]) {
            const rr = rng(step * 31 + seed);
            for (const [, s] of view.particles) {
              s.position = { x: rr() * 50, y: rr() * 50 };
              s.health = rr() * 100;
              s.charge = Math.floor(rr() * 100);
            }
          }
        }
        // mutating the stepper's Sets in place afterwards must not reach the worker view
        const probe = [...next.particles.values()][0];
        if (probe) {
          const before = serialize(incView);
          probe.senderSet.add('p-probe');
          expect(serialize(incView)).toBe(before);
          probe.senderSet.delete('p-probe');
        }
      }
    });
  }

  it('first merge from a null previous view returns the next population itself (as the reference does)', () => {
    const next = build(5, rng(9));
    expect(new TopologyMerger().merge(null, next)).toBe(next);
    expect(mergeNormalPopulationTopologyRebuild(null, next)).toBe(next);
  });

  it('steady state with unchanged ids and genomes is an in-place update (no new maps); births/deaths are structural', () => {
    const r = rng(77);
    const counter = { id: 5000 };
    const next = build(30, r);
    const merger = new TopologyMerger();
    let view: PopulationState | null = deepCopy(next);
    view = merger.merge(view, next); // first merge: clones genomes (memo empty) -> structural
    expect(merger.structuralMerges).toBe(1);
    const maps = [view.particles, view.genomes];
    for (let i = 0; i < 20; i++) {
      evolve(next, r, i, counter, i % 2 ? 'sets' : 'role');
      view = merger.merge(view, next);
    }
    expect(merger.inPlaceMerges).toBe(20);
    expect(merger.structuralMerges).toBe(1);
    expect(view.particles).toBe(maps[0]);
    expect(view.genomes).toBe(maps[1]);
    evolve(next, r, 0, counter, 'birth');
    view = merger.merge(view, next);
    expect(merger.structuralMerges).toBe(2);
    expect(view.particles).not.toBe(maps[0]);
  });

  it('a foreign previous view (genomes the merger never cloned) is handled by the structural path, never by a stale shortcut', () => {
    const r = rng(5);
    const next = build(10, r);
    const merger = new TopologyMerger();
    const foreign = deepCopy(next);
    const out = merger.merge(foreign, next);
    expect(serialize(out)).toBe(serialize(mergeNormalPopulationTopologyRebuild(deepCopy(next), next)));
    expect(merger.structuralMerges).toBe(1);
  });
});
