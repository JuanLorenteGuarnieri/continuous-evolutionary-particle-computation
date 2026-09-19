import { Vector2, ParticleID } from './types.js';

export type ParticleRole = 'internal' | 'input' | 'output';

export interface ParticleStateData {
  readonly version: string;
  readonly position: Vector2;
  readonly velocity: Vector2;
  readonly health: number;
  readonly charge: number;
  readonly senderSet: Set<ParticleID>;
  readonly prevSenderSet: Set<ParticleID>;
  readonly role: ParticleRole;
}

export class ParticleState implements ParticleStateData {
  public version: string;
  public position: Vector2;
  public velocity: Vector2;
  public health: number;
  public charge: number;
  public senderSet: Set<ParticleID>;
  public prevSenderSet: Set<ParticleID>;
  public role: ParticleRole;

  constructor(data: Partial<ParticleStateData> = {}) {
    this.version = data.version ?? '3.0.0';
    this.position = data.position ?? { x: 0, y: 0 };
    this.velocity = data.velocity ?? { x: 0, y: 0 };
    this.health = data.health ?? 0;
    this.charge = data.charge ?? 0;
    this.senderSet = data.senderSet ? new Set(data.senderSet) : new Set();
    this.prevSenderSet = data.prevSenderSet ? new Set(data.prevSenderSet) : new Set();
    this.role = data.role ?? 'internal';
    this.validate();
  }

  public static validate(obj: unknown): obj is ParticleStateData {
    if (typeof obj !== 'object' || obj === null) return false;
    const o = obj as Record<string, unknown>;
   return (
     typeof o.version === 'string' &&
     typeof o.position === 'object' && o.position !== null &&
      typeof (o.position as Record<string, unknown>).x === 'number' && typeof (o.position as Record<string, unknown>).y === 'number' &&
     typeof o.velocity === 'object' && o.velocity !== null &&
      typeof (o.velocity as Record<string, unknown>).x === 'number' && typeof (o.velocity as Record<string, unknown>).y === 'number' &&
     typeof o.health === 'number' && o.health >= 0 &&
      typeof o.charge === 'number' && Number.isInteger(o.charge) && o.charge >= 0 &&
      (o.senderSet instanceof Set || Array.isArray(o.senderSet)) &&
      (o.prevSenderSet instanceof Set || Array.isArray(o.prevSenderSet))
    );
  }

  private validate(): void {
    if (this.charge < 0 || !Number.isInteger(this.charge)) {
      throw new Error('charge must be non-negative integer');
    }
    if (this.health < 0) {
      throw new Error('health must be >=0');
    }
  }

  public reset(): ParticleState {
    return new ParticleState({
      version: this.version,
      position: { x: 0, y: 0 },
      velocity: { x: 0, y: 0 },
      health: 0,
      charge: 0,
      senderSet: new Set(),
      prevSenderSet: new Set(),
      role: this.role,
    });
  }

  public isValid(Qmax = Number.MAX_SAFE_INTEGER, Hmax = Number.MAX_SAFE_INTEGER): boolean {
    return (
      this.charge >= 0 && this.charge <= Qmax &&
      this.health >= 0 && this.health <= Hmax
    );
  }

  public toJSON(): object {
    return {
      version: this.version,
      position: this.position,
      velocity: this.velocity,
      health: this.health,
      charge: this.charge,
      senderSet: Array.from(this.senderSet),
      prevSenderSet: Array.from(this.prevSenderSet),
      role: this.role,
    };
  }

  public static fromJSON(obj: unknown): ParticleState {
    if (typeof obj !== 'object' || obj === null) throw new Error('Invalid ParticleState JSON');

    const o = obj as Record<string, unknown>;
    const position = o.position;
    const velocity = o.velocity;
    const senderSet = o.senderSet;
    const prevSenderSet = o.prevSenderSet;

    if (
      typeof o.version !== 'string' ||
      typeof position !== 'object' || position === null ||
      typeof (position as Record<string, unknown>).x !== 'number' ||
      typeof (position as Record<string, unknown>).y !== 'number' ||
      typeof velocity !== 'object' || velocity === null ||
      typeof (velocity as Record<string, unknown>).x !== 'number' ||
      typeof (velocity as Record<string, unknown>).y !== 'number' ||
      typeof o.health !== 'number' ||
      typeof o.charge !== 'number' ||
      !Array.isArray(senderSet) ||
      !Array.isArray(prevSenderSet)
    ) {
      throw new Error('Invalid ParticleState JSON');
    }

    return new ParticleState({
      version: o.version,
      position: position as Vector2,
      velocity: velocity as Vector2,
      health: o.health,
      charge: o.charge,
      senderSet: new Set(senderSet as ParticleID[]),
      prevSenderSet: new Set(prevSenderSet as ParticleID[]),
      role: o.role === 'input' || o.role === 'output' ? o.role : 'internal',
    });
  }
}
