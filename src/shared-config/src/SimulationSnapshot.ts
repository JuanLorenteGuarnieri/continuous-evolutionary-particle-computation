import { Genome } from './Genome.js';
import { ParticleState } from './ParticleState.js';
import { ParticleID } from './types.js';

export interface SimulationSnapshotData {
  readonly version: string;
  readonly timestep: number;
  readonly genomes: Map<ParticleID, Genome>;
  readonly particleStates: Map<ParticleID, ParticleState>;
  readonly globalMetrics?: Record<string, unknown>;
}

export class SimulationSnapshot implements SimulationSnapshotData {
  public readonly version: string;
  public readonly timestep: number;
  public readonly genomes: Map<ParticleID, Genome>;
  public readonly particleStates: Map<ParticleID, ParticleState>;
  public readonly globalMetrics?: Record<string, unknown>;

  constructor(data: Partial<SimulationSnapshotData> = {}) {
    this.version = data.version ?? '3.0.0';
    this.timestep = data.timestep ?? 0;
    this.genomes = data.genomes ? new Map(data.genomes) : new Map();
    this.particleStates = data.particleStates ? new Map(data.particleStates) : new Map();
    this.globalMetrics = data.globalMetrics;
  }

  public static validate(obj: unknown): boolean {
    if (typeof obj !== 'object' || obj === null) return false;
    const o = obj as Record<string, unknown>;
    return (
      typeof o.version === 'string' &&
      typeof o.timestep === 'number' &&
      o.genomes instanceof Map &&
      o.particleStates instanceof Map
    );
  }

  public toJSON(): object {
    return {
      version: this.version,
      timestep: this.timestep,
      genomes: Array.from(this.genomes.entries()).map(([id, g]) => [id, g.toJSON()]),
      particleStates: Array.from(this.particleStates.entries()).map(([id, p]) => [id, p.toJSON()]),
      globalMetrics: this.globalMetrics,
    };
  }

  public static fromJSON(obj: unknown): SimulationSnapshot {
    if (typeof obj !== 'object' || obj === null) throw new Error('Invalid SimulationSnapshot JSON');

    const o = obj as Record<string, unknown>;
    const genomes = new Map<ParticleID, Genome>();
    const genomeEntries = Array.isArray(o.genomes) ? o.genomes : [];
    for (const entry of genomeEntries) {
      if (!Array.isArray(entry) || entry.length !== 2) continue;
      const [id, g] = entry as [ParticleID, unknown];
      if (Genome.validate(g)) {
        genomes.set(id, Genome.fromJSON(g));
      }
    }

    const states = new Map<ParticleID, ParticleState>();
    const stateEntries = Array.isArray(o.particleStates) ? o.particleStates : [];
    for (const entry of stateEntries) {
      if (!Array.isArray(entry) || entry.length !== 2) continue;
      const [id, p] = entry as [ParticleID, unknown];
      if (ParticleState.validate(p)) {
        states.set(id, ParticleState.fromJSON(p));
      }
    }

    return new SimulationSnapshot({
      version: typeof o.version === 'string' ? o.version : undefined,
      timestep: typeof o.timestep === 'number' ? o.timestep : undefined,
      genomes,
      particleStates: states,
      globalMetrics: typeof o.globalMetrics === 'object' && o.globalMetrics !== null ? o.globalMetrics as Record<string, unknown> : undefined,
    });
  }
}
