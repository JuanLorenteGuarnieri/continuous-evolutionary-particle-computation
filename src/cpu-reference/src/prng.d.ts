export interface PRNG {
    nextFloat(): number;
    nextInt(max: number): number;
    clone(): PRNG;
}
export declare class XorShift32 implements PRNG {
    private state;
    constructor(seed?: number);
    private nextUInt;
    nextFloat(): number;
    nextInt(max: number): number;
    clone(): PRNG;
    getState(): number;
    setState(s: number): void;
}
