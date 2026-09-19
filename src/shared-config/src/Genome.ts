import { RandomLike } from './types.js';

export interface GenomeData {
  readonly version: string;
  readonly H_max: number;
  readonly theta_q: number;
  readonly A: number;
  readonly K: number;
  readonly R_c: number;
  readonly m: number;
  readonly gamma: number;
  readonly R_s: number;
  readonly omega_R: number;
  readonly omega_A: number;
  readonly omega_v: number;
}

export class Genome implements GenomeData {
  public readonly version: string;
  public readonly H_max: number;
  public readonly theta_q: number;
  public readonly A: number;
  public readonly K: number;
  public readonly R_c: number;
  public readonly m: number;
  public readonly gamma: number;
  public readonly R_s: number;
  public readonly omega_R: number;
  public readonly omega_A: number;
  public readonly omega_v: number;

  constructor(data: Partial<GenomeData> & { version?: string } = {}) {
    this.version = data.version ?? '3.0.0';
    this.H_max = data.H_max ?? 100;
    this.theta_q = data.theta_q ?? 1;
    this.A = data.A ?? 1;
    this.K = data.K ?? 1;
    this.R_c = data.R_c ?? 1;
    this.m = data.m ?? 1;
    this.gamma = data.gamma ?? 0.1;
    this.R_s = data.R_s ?? 1;
    this.omega_R = data.omega_R ?? 0;
    this.omega_A = data.omega_A ?? 0;
    this.omega_v = data.omega_v ?? 0;
    this.validate();
  }

  public static validate(obj: unknown): obj is GenomeData {
    if (typeof obj !== 'object' || obj === null) return false;
    const o = obj as Record<string, unknown>;
    return (
      typeof o.version === 'string' &&
      typeof o.H_max === 'number' && o.H_max > 0 &&
      typeof o.theta_q === 'number' && o.theta_q > 0 &&
      typeof o.A === 'number' && o.A > 0 &&
      typeof o.K === 'number' && o.K > 0 &&
      typeof o.R_c === 'number' && o.R_c > 0 &&
      typeof o.m === 'number' && o.m > 0 &&
      typeof o.gamma === 'number' && o.gamma >= 0 &&
      typeof o.R_s === 'number' && o.R_s > 0 &&
      typeof o.omega_R === 'number' &&
      typeof o.omega_A === 'number' &&
      typeof o.omega_v === 'number'
    );
  }

  private validate(): void {
    if (!Genome.validate(this)) {
      throw new Error('Invalid Genome data');
    }
  }

  public clone(): Genome {
    return new Genome({ ...this });
  }

  public mutate(rng: RandomLike, rate = 0.1): Genome {
    const mutated = {
      version: this.version,
      H_max: this.H_max,
      theta_q: this.theta_q,
      A: this.A,
      K: this.K,
      R_c: this.R_c,
      m: this.m,
      gamma: this.gamma,
      R_s: this.R_s,
      omega_R: this.omega_R,
      omega_A: this.omega_A,
      omega_v: this.omega_v,
    };
    const perturb = (v: number, scale = 0.1) => v * (1 + (rng.nextFloat() - 0.5) * scale);
    if (rng.nextFloat() < rate) mutated.H_max = Math.max(1, perturb(this.H_max));
    if (rng.nextFloat() < rate) mutated.theta_q = Math.max(1, Math.round(perturb(this.theta_q)));
    if (rng.nextFloat() < rate) mutated.A = Math.max(0.01, perturb(this.A));
    if (rng.nextFloat() < rate) mutated.K = Math.max(1, Math.round(perturb(this.K)));
    if (rng.nextFloat() < rate) mutated.R_c = Math.max(0.01, perturb(this.R_c));
    if (rng.nextFloat() < rate) mutated.m = Math.max(0.01, perturb(this.m));
    if (rng.nextFloat() < rate) mutated.gamma = Math.max(0, perturb(this.gamma));
    if (rng.nextFloat() < rate) mutated.R_s = Math.max(0.01, perturb(this.R_s));
    if (rng.nextFloat() < rate) mutated.omega_R = perturb(this.omega_R);
    if (rng.nextFloat() < rate) mutated.omega_A = perturb(this.omega_A);
    if (rng.nextFloat() < rate) mutated.omega_v = perturb(this.omega_v);
    return new Genome(mutated);
  }

  public crossover(other: Genome, rng: RandomLike): Genome {
    const continuousMix = (a: number, b: number) => {
      const alpha = rng.nextFloat();
      return alpha * a + (1 - alpha) * b;
    };
    const discreteMix = (a: number, b: number) => rng.nextFloat() < 0.5 ? a : b;
    return new Genome({
      version: '3.0.0',
      H_max: continuousMix(this.H_max, other.H_max),
      theta_q: discreteMix(this.theta_q, other.theta_q),
      A: continuousMix(this.A, other.A),
      K: discreteMix(this.K, other.K),
      R_c: continuousMix(this.R_c, other.R_c),
      m: continuousMix(this.m, other.m),
      gamma: continuousMix(this.gamma, other.gamma),
      R_s: continuousMix(this.R_s, other.R_s),
      omega_R: continuousMix(this.omega_R, other.omega_R),
      omega_A: continuousMix(this.omega_A, other.omega_A),
      omega_v: continuousMix(this.omega_v, other.omega_v),
    });
  }

  public toJSON(): GenomeData {
    return { ...this };
  }

  public static fromJSON(obj: unknown): Genome {
    if (!Genome.validate(obj)) throw new Error('Invalid Genome JSON');
    return new Genome(obj as GenomeData);
  }
}
