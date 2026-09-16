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

  public static fromJSON(obj: any): SimulationSnapshot {
    const genomes = new Map<ParticleID, Genome>();
    for (const [id, g] of obj.genomes ?? []) {
      genomes.set(id, Genome.fromJSON(g));
    }
    const states = new Map<ParticleID, ParticleState>();
    for (const [id, p] of obj.particleStates ?? []) {
      states.set(id, ParticleState.fromJSON(p));
    }
    return new SimulationSnapshot({
      version: obj.version,
      timestep: obj.timestep,
      genomes,
      particleStates: states,
      globalMetrics: obj.globalMetrics,
    });
  }
}
