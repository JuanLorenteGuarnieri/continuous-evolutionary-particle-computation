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
  readonly Q_in_max: number;
  readonly delta_q: number;
  readonly beta: number;
  readonly lambda: number;
  readonly P_min: number;
  readonly P_max: number;
  readonly pressure_gamma: number;
  readonly R_mate: number;
  readonly H_mate: number;
  readonly H_birth: number;
  readonly mate_radius_percent: number;
  readonly mate_health_percent: number;
  readonly birth_health_percent: number;
  readonly mating_probability: number;
  readonly communication_alpha: number;
  readonly Hmax: number;
  readonly theta_q: number;
  readonly A: number;
  readonly K: number;
  readonly Rc: number;
  readonly m: number;
  readonly gamma: number;
  readonly Rs: number;
  readonly omega_R: number;
  readonly omega_A: number;
  readonly omega_v: number;
  readonly genome_variation: number;
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
  public readonly Q_in_max: number;
  public readonly delta_q: number;
  public readonly beta: number;
  public readonly lambda: number;
  public readonly P_min: number;
  public readonly P_max: number;
  public readonly pressure_gamma: number;
  public readonly R_mate: number;
  public readonly H_mate: number;
  public readonly H_birth: number;
  public readonly mate_radius_percent: number;
  public readonly mate_health_percent: number;
  public readonly birth_health_percent: number;
  public readonly mating_probability: number;
  public readonly communication_alpha: number;
  public readonly Hmax: number;
  public readonly theta_q: number;
  public readonly A: number;
  public readonly K: number;
  public readonly Rc: number;
  public readonly m: number;
  public readonly gamma: number;
  public readonly Rs: number;
  public readonly omega_R: number;
  public readonly omega_A: number;
  public readonly omega_v: number;
  public readonly genome_variation: number;

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
    this.Q_in_max = data.Q_in_max ?? this.Qmax;
    this.delta_q = data.delta_q ?? 0;
    this.beta = data.beta ?? 1;
    this.lambda = data.lambda ?? 0.1;
    this.P_min = data.P_min ?? 0;
    this.P_max = data.P_max ?? 1;
    this.pressure_gamma = data.pressure_gamma ?? 1;
    this.R_mate = data.R_mate ?? 1;
    this.H_mate = data.H_mate ?? 50;
    this.H_birth = data.H_birth ?? 1;
    this.mate_radius_percent = data.mate_radius_percent ?? 1;
    this.mate_health_percent = data.mate_health_percent ?? 1;
    this.birth_health_percent = data.birth_health_percent ?? 0.02;
    this.mating_probability = data.mating_probability ?? 0.01;
    this.communication_alpha = data.communication_alpha ?? 1;
    this.Hmax = data.Hmax ?? 100;
    this.theta_q = data.theta_q ?? 10;
    this.A = data.A ?? 2;
    this.K = data.K ?? 4;
    this.Rc = data.Rc ?? 1;
    this.m = data.m ?? 1;
    this.gamma = data.gamma ?? 0.1;
    this.Rs = data.Rs ?? 1;
    this.omega_R = data.omega_R ?? 0.5;
    this.omega_A = data.omega_A ?? 0.5;
    this.omega_v = data.omega_v ?? 0.5;
    this.genome_variation = data.genome_variation ?? 0.05;
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

  public static fromJSON(obj: unknown): MFMConfig {
    if (!MFMConfig.validate(obj)) throw new Error('Invalid MFMConfig JSON');
    return new MFMConfig(obj as unknown as Record<string, unknown>);
  }
}
