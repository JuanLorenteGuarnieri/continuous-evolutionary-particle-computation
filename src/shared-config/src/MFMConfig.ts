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

export class MFMConfig implements MFMConfigData {
  public readonly version: string;
  public readonly Lx: number;
  public readonly Ly: number;
  public readonly Nmax: number;
  public readonly dt: number;
  public readonly seed: number;
  public readonly Qmax: number;
  public readonly R_s_min: number;
  public readonly R_s_max: number;
  public readonly boundary: 'periodic';

  constructor(data: Partial<MFMConfigData> = {}) {
    this.version = data.version ?? '3.0.0';
    this.Lx = data.Lx ?? 100;
    this.Ly = data.Ly ?? 100;
    this.Nmax = data.Nmax ?? 1000;
    this.dt = data.dt ?? 0.1;
    this.seed = data.seed ?? 0;
    this.Qmax = data.Qmax ?? 1000;
    this.R_s_min = data.R_s_min ?? 0.5;
    this.R_s_max = data.R_s_max ?? 5.0;
    this.boundary = data.boundary ?? 'periodic';
    this.validate();
  }

  public static validate(obj: unknown): obj is MFMConfigData {
    if (typeof obj !== 'object' || obj === null) return false;
    const o = obj as Record<string, unknown>;
    return (
      typeof o.version === 'string' &&
      typeof o.Lx === 'number' && o.Lx > 0 &&
      typeof o.Ly === 'number' && o.Ly > 0 &&
      typeof o.Nmax === 'number' && o.Nmax > 0 &&
      typeof o.dt === 'number' && o.dt > 0 &&
      typeof o.seed === 'number' &&
      typeof o.Qmax === 'number' && o.Qmax > 0 &&
      typeof o.R_s_min === 'number' && o.R_s_min >= 0 &&
      typeof o.R_s_max === 'number' && o.R_s_max >= o.R_s_min &&
      o.boundary === 'periodic'
    );
  }

  public validate(): void {
    if (!MFMConfig.validate(this)) {
      throw new Error('Invalid MFMConfig');
    }
  }

  public toJSON(): MFMConfigData {
    return { ...this };
  }

  public static fromJSON(obj: any): MFMConfig {
    if (!MFMConfig.validate(obj)) throw new Error('Invalid MFMConfig JSON');
    return new MFMConfig(obj);
  }
}
