export type Vector2 = {
    x: number;
    y: number;
};
export declare function add(a: Vector2, b: Vector2): Vector2;
export declare function sub(a: Vector2, b: Vector2): Vector2;
export declare function scale(a: Vector2, s: number): Vector2;
export declare function len(a: Vector2): number;
export declare function normalize(a: Vector2): Vector2;
export declare function wrap(v: Vector2, Lx: number, Ly: number): Vector2;
export declare function periodicDelta(a: Vector2, b: Vector2, Lx: number, Ly: number): Vector2;
export declare function periodicDistance(a: Vector2, b: Vector2, Lx: number, Ly: number): number;
