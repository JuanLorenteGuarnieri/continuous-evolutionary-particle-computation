import { ParticleID } from './types.js';
import { Genome } from './Genome.js';
import { ParticleState } from './ParticleState.js';

export interface PopulationStateData {
  readonly version: string;
  readonly genomes: Map<ParticleID, Genome>;
  readonly particles: Map<ParticleID, ParticleState>;
}

export class PopulationState implements PopulationStateData {
  public readonly version: string;
  public genomes: Map<ParticleID, Genome>;
  public particles: Map<ParticleID, ParticleState>;

  constructor(data: Partial<PopulationStateData> = {}) {
    this.version = data.version ?? '3.0.0';
    this.genomes = data.genomes ? new Map(data.genomes) : new Map();
    this.particles = data.particles ? new Map(data.particles) : new Map();
    this.validate();
  }

  public static validate(obj: unknown): obj is PopulationStateData {
    if (typeof obj !== 'object' || obj === null) return false;
    const o = obj as Record<string, unknown>;
    return (
      typeof o.version === 'string' &&
      o.genomes instanceof Map &&
      o.particles instanceof Map
    );
  }

  private validate(): void {
    for (const id of this.particles.keys()) {
      if (!this.genomes.has(id)) {
        throw new Error(`Particle ${id} missing genome`);
      }
    }
  }

  public addParticle(id: ParticleID, genome: Genome, state: ParticleState): void {
    this.genomes.set(id, genome);
    this.particles.set(id, state);
  }

  public removeParticle(id: ParticleID): void {
    this.genomes.delete(id);
    this.particles.delete(id);
  }

  public getParticle(id: ParticleID): { genome: Genome; state: ParticleState } | undefined {
    const g = this.genomes.get(id);
    const s = this.particles.get(id);
    if (g && s) return { genome: g, state: s };
    return undefined;
  }

  public forEachParticle(fn: (id: ParticleID, genome: Genome, state: ParticleState) => void): void {
    for (const [id, state] of this.particles) {
      const genome = this.genomes.get(id);
      if (genome) fn(id, genome, state);
    }
  }

  public toJSON(): object {
    return {
      version: this.version,
      genomes: Array.from(this.genomes.entries()).map(([id, g]) => [id, g.toJSON()]),
      particles: Array.from(this.particles.entries()).map(([id, p]) => [id, p.toJSON()]),
    };
  }

  public static fromJSON(obj: Record<string, unknown>): PopulationState {
    const genomes = new Map<ParticleID, Genome>();
    for (const [id, g] of obj.genomes ?? []) {
      genomes.set(id, Genome.fromJSON(g));
    }
    const particles = new Map<ParticleID, ParticleState>();
    for (const [id, p] of obj.particles ?? []) {
      particles.set(id, ParticleState.fromJSON(p));
    }
    return new PopulationState({ version: obj.version, genomes, particles });
  }
}
