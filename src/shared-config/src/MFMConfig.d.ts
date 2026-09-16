export interface MFMConfigData {
    readonly version: string;
    readonly Lx: number;
    readonly Ly: number;
    readonly Nmax: number;
    readonly dt: number;
    readonly seed: number;
    readonly Qmax: number;
    readonly R_s_min: number;
    readonly R_s_max: number;
    readonly boundary: 'periodic';
}
export declare class MFMConfig implements MFMConfigData {
    readonly version: string;
    readonly Lx: number;
    readonly Ly: number;
    readonly Nmax: number;
    readonly dt: number;
    readonly seed: number;
    readonly Qmax: number;
    readonly R_s_min: number;
    readonly R_s_max: number;
    readonly boundary: 'periodic';
    constructor(data?: Partial<MFMConfigData>);
    static validate(obj: unknown): obj is MFMConfigData;
    validate(): void;
    toJSON(): MFMConfigData;
    static fromJSON(obj: any): MFMConfig;
}
