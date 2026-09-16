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
export declare class ParticleState implements ParticleStateData {
    readonly version: string;
    readonly position: Vector2;
    readonly velocity: Vector2;
    readonly health: number;
    readonly charge: number;
    readonly senderSet: Set<ParticleID>;
    readonly prevSenderSet: Set<ParticleID>;
    constructor(data?: Partial<ParticleStateData>);
    static validate(obj: unknown): obj is ParticleStateData;
    private validate;
    reset(): ParticleState;
    isValid(Qmax?: number, Hmax?: number): boolean;
    toJSON(): object;
    static fromJSON(obj: Record<string, unknown>): ParticleState;
}
