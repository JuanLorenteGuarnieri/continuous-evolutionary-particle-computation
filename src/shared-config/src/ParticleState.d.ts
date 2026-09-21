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
export declare class ParticleState implements ParticleStateData {
    version: string;
    position: Vector2;
    velocity: Vector2;
    health: number;
    charge: number;
    senderSet: Set<ParticleID>;
    prevSenderSet: Set<ParticleID>;
    role: ParticleRole;
    constructor(data?: Partial<ParticleStateData>);
    static validate(obj: unknown): obj is ParticleStateData;
    private validate;
    reset(): ParticleState;
    isValid(Qmax?: number, Hmax?: number): boolean;
    toJSON(): object;
    static fromJSON(obj: unknown): ParticleState;
}
