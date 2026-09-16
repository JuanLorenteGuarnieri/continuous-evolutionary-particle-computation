import { Vector2, ParticleID } from './types.js';

export interface ParticleStateData {
  readonly version: string;
  readonly position: Vector2;
  readonly velocity: Vector2;
  readonly health: number;
  readonly charge: number;
  readonly senderSet: Set<ParticleID>;
  readonly prevSenderSet: Set<ParticleID>;
}

export class ParticleState implements ParticleStateData {
  public readonly version: string;
  public readonly position: Vector2;
  public readonly velocity: Vector2;
  public readonly health: number;
  public readonly charge: number;
  public readonly senderSet: Set<ParticleID>;
  public readonly prevSenderSet: Set<ParticleID>;

  constructor(data: Partial<ParticleStateData> = {}) {
    this.version = data.version ?? '3.0.0';
    this.position = data.position ?? { x: 0, y: 0 };
    this.velocity = data.velocity ?? { x: 0, y: 0 };
    this.health = data.health ?? 0;
    this.charge = data.charge ?? 0;
    this.senderSet = data.senderSet ? new Set(data.senderSet) : new Set();
    this.prevSenderSet = data.prevSenderSet ? new Set(data.prevSenderSet) : new Set();
    this.validate();
  }

  public static validate(obj: unknown): obj is ParticleStateData {
    if (typeof obj !== 'object' || obj === null) return false;
    const o = obj as Record<string, unknown>;
    return (
      typeof o.version === 'string' &&
      typeof o.position === 'object' && o.position !== null &&
      typeof (o.position as any).x === 'number' && typeof (o.position as any).y === 'number' &&
      typeof o.velocity === 'object' && o.velocity !== null &&
      typeof (o.velocity as any).x === 'number' && typeof (o.velocity as any).y === 'number' &&
      typeof o.health === 'number' && o.health >= 0 &&
      typeof o.charge === 'number' && Number.isInteger(o.charge) && o.charge >= 0 &&
      o.senderSet instanceof Set &&
      o.prevSenderSet instanceof Set
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
    };
  }

  public static fromJSON(obj: any): ParticleState {
    return new ParticleState({
      version: obj.version,
      position: obj.position,
      velocity: obj.velocity,
      health: obj.health,
      charge: obj.charge,
      senderSet: new Set(obj.senderSet ?? []),
      prevSenderSet: new Set(obj.prevSenderSet ?? []),
    });
  }
}
