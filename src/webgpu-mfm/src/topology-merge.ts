/**
 * Phase 19 — merge of the stepper's normal-sync PopulationState into the worker's CPU population view.
 *
 * Background [source]: after every rendered step the worker receives the stepper's PopulationState (topology/event metadata only;
 * position/velocity/health/charge stay GPU-owned) and merges it into its own view: existing particles keep the last explicitly
 * synchronised dynamic state, and take senderSet / prevSenderSet / role from the new population; new particles are copied in whole;
 * dead ones disappear. Until Phase 18 this was done by REBUILDING the whole population every step: a Genome.clone(), a ParticleState
 * with two position/velocity object copies and two Set copies per particle, plus two Map insertions. The headless benchmark path
 * (`simulation.step()`) does not do this at all.
 *
 * `mergeNormalPopulationTopologyRebuild` is the Phase 5G-H / Phase 18 implementation, kept verbatim as the REFERENCE (and as the
 * `rebuild` mode for A/B). `TopologyMerger` is the incremental implementation. They are observationally equivalent:
 *   - same particle ids, in the same (insertion) order, same genomes (by value), same dynamic state, same sender sets (by content),
 *   - the result never aliases the stepper's objects (Sets are copied, genomes are cloned),
 * and differ only in object identity and allocation: unchanged data is not re-created.
 *
 * Equivalence assumptions (checked by tests/topology-merge.test.ts, documented here because the incremental path relies on them):
 *   (A1) A Genome object of the stepper's population is not mutated in place; a different genome for the same id is a different
 *        object. (The stepper only ever replaces genomes, and `Genome` has no setters.) The merger re-clones whenever it sees an
 *        object it has not cloned before, so a replaced genome is picked up exactly as the rebuild would.
 *   - The merger validates every shortcut against the previous view (genome clone identity, id order, sizes) and falls back to a
 *     rebuild of the structure whenever anything differs, so a stale or foreign `previous` can never yield a wrong result.
 */
import { Genome, ParticleState, PopulationState } from '@cepc/shared-config';

/**
 * 'rebuild' = pre-Phase-19 reference; 'incremental' = Phase 19 in-place merge every step; 'epoch' = 'incremental' plus (in the worker) skipping the
 * merge entirely while the stepper's topology epoch is unchanged (Phase 20).
 */
export type TopologyMergeMode = 'rebuild' | 'incremental' | 'epoch';

/** Reference implementation: identical to the worker's pre-Phase-19 `mergeNormalPopulationTopology`. */
export function mergeNormalPopulationTopologyRebuild(
  previous: PopulationState | null,
  nextPopulation: PopulationState,
): PopulationState {
  if (!previous) return nextPopulation;

  const merged = new PopulationState();

  for (const [id, nextState] of nextPopulation.particles) {
    const genome = nextPopulation.genomes.get(id);
    if (!genome) continue;

    const previousState = previous.particles.get(id);

    if (!previousState) {
      // New particles need an initial CPU view. This is birth/topology data,
      // not a per-timestep mirror of an already-existing GPU particle.
      merged.addParticle(
        id,
        genome.clone(),
        new ParticleState({
          version: nextState.version,
          position: { ...nextState.position },
          velocity: { ...nextState.velocity },
          health: nextState.health,
          charge: nextState.charge,
          senderSet: new Set(nextState.senderSet),
          prevSenderSet: new Set(nextState.prevSenderSet),
          role: nextState.role,
        }),
      );
      continue;
    }

    // Existing particles keep the last explicitly synchronized dynamic state.
    // Only topology/event metadata is refreshed on the normal path.
    merged.addParticle(
      id,
      genome.clone(),
      new ParticleState({
        version: previousState.version,
        position: { ...previousState.position },
        velocity: { ...previousState.velocity },
        health: previousState.health,
        charge: previousState.charge,
        senderSet: new Set(nextState.senderSet),
        prevSenderSet: new Set(nextState.prevSenderSet),
        role: nextState.role,
      }),
    );
  }

  return merged;
}

function sameContent(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  if (a.size !== b.size) return false;
  for (const item of b) if (!a.has(item)) return false;
  return true;
}

/**
 * Incremental merge. Owns one WeakMap (stepper genome object -> the clone placed in the merged view) so that a genome is cloned
 * once per object instead of once per step. Create one per worker; it carries no other state, and a stale memo cannot cause a wrong
 * result (see the validation in `merge`).
 */
export class TopologyMerger {
  private readonly clones = new WeakMap<Genome, Genome>();

  /** Number of merges that were pure in-place updates (no structural change); exposed for tests/benchmarks. */
  public inPlaceMerges = 0;
  /** Number of merges that had to rebuild the maps (births, deaths, reordering, foreign previous view). */
  public structuralMerges = 0;

  public merge(previous: PopulationState | null, next: PopulationState): PopulationState {
    if (!previous) return next;
    if (this.tryInPlace(previous, next)) {
      this.inPlaceMerges++;
      return previous;
    }
    this.structuralMerges++;
    return this.rebuildStructure(previous, next);
  }

  private cloneOf(genome: Genome): Genome {
    let clone = this.clones.get(genome);
    if (!clone) {
      clone = genome.clone();
      this.clones.set(genome, clone);
    }
    return clone;
  }

  /**
   * Fast path: the same ids in the same order, every id has a genome in `next`, and `previous` already holds exactly the clone of
   * that genome. Then the rebuild would produce an equal population, so only role / sender sets can have changed; update them in
   * place (Sets are reassigned only when their content differs, and always to a fresh copy, never to the stepper's Set).
   * Returns false, having changed NOTHING, when any condition fails.
   */
  private tryInPlace(previous: PopulationState, next: PopulationState): boolean {
    if (previous.particles.size !== next.particles.size) return false;
    if (previous.genomes.size !== previous.particles.size) return false;

    // Pass 1: validate without mutating.
    const previousIds = previous.particles.keys();
    for (const [id] of next.particles) {
      const expected = previousIds.next();
      if (expected.done || expected.value !== id) return false;
      const genome = next.genomes.get(id);
      if (!genome) return false;
      const memo = this.clones.get(genome);
      if (!memo || previous.genomes.get(id) !== memo) return false;
    }

    // Pass 2: apply.
    for (const [id, nextState] of next.particles) {
      const state = previous.particles.get(id)!;
      state.role = nextState.role;
      if (!sameContent(state.senderSet, nextState.senderSet)) state.senderSet = new Set(nextState.senderSet);
      if (!sameContent(state.prevSenderSet, nextState.prevSenderSet)) state.prevSenderSet = new Set(nextState.prevSenderSet);
    }
    return true;
  }

  /** Structural change: new maps in `next`'s order, but existing states are updated and reused instead of re-created. */
  private rebuildStructure(previous: PopulationState, next: PopulationState): PopulationState {
    const merged = new PopulationState();
    for (const [id, nextState] of next.particles) {
      const genome = next.genomes.get(id);
      if (!genome) continue;
      const previousState = previous.particles.get(id);

      if (!previousState) {
        merged.addParticle(
          id,
          this.cloneOf(genome),
          new ParticleState({
            version: nextState.version,
            position: { ...nextState.position },
            velocity: { ...nextState.velocity },
            health: nextState.health,
            charge: nextState.charge,
            senderSet: new Set(nextState.senderSet),
            prevSenderSet: new Set(nextState.prevSenderSet),
            role: nextState.role,
          }),
        );
        continue;
      }

      previousState.role = nextState.role;
      if (!sameContent(previousState.senderSet, nextState.senderSet)) previousState.senderSet = new Set(nextState.senderSet);
      if (!sameContent(previousState.prevSenderSet, nextState.prevSenderSet)) previousState.prevSenderSet = new Set(nextState.prevSenderSet);
      merged.addParticle(id, this.cloneOf(genome), previousState);
    }
    return merged;
  }
}

/**
 * Phase 20 ('epoch' mode). Wraps TopologyMerger and skips the merge entirely when it provably would be a no-op: the producer's topology epoch is
 * unchanged since the last merge, the producer's population object is the same, and the consumer's view is exactly the object the last merge
 * returned. Contract on the producer (MfmWebGPUStepper.getTopologyEpoch): the epoch changes whenever its population's membership, roles or
 * sender sets can have changed; if it did not change, `next` is observationally identical to what it was at the last merge. Anything unexpected
 * (a different view or source object) falls through to a real merge, so a stale epoch can never be applied to a foreign view.
 */
export class EpochTopologyMerger {
  public readonly merger = new TopologyMerger();
  public skipped = 0;
  private last: { epoch: number; source: PopulationState; view: PopulationState } | null = null;

  public merge(previous: PopulationState | null, next: PopulationState, epoch: number): PopulationState {
    const last = this.last;
    if (previous && last && last.epoch === epoch && last.source === next && last.view === previous) {
      this.skipped++;
      return previous;
    }
    const view = this.merger.merge(previous, next);
    this.last = { epoch, source: next, view };
    return view;
  }

  public reset(): void {
    this.last = null;
    this.skipped = 0;
  }
}
