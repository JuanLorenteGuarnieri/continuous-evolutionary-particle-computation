export class Genome {
    version;
    H_max;
    theta_q;
    A;
    K;
    R_c;
    m;
    gamma;
    R_s;
    omega_R;
    omega_A;
    omega_v;
    constructor(data = {}) {
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
    static validate(obj) {
        if (typeof obj !== 'object' || obj === null)
            return false;
        const o = obj;
        return (typeof o.version === 'string' &&
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
            typeof o.omega_v === 'number');
    }
    validate() {
        if (!Genome.validate(this)) {
            throw new Error('Invalid Genome data');
        }
    }
    clone() {
        return new Genome({ ...this });
    }
    mutate(rng, rate = 0.1) {
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
        const perturb = (v, scale = 0.1) => v * (1 + (rng.nextFloat() - 0.5) * scale);
        if (rng.nextFloat() < rate)
            mutated.H_max = Math.max(1, perturb(this.H_max));
        if (rng.nextFloat() < rate)
            mutated.theta_q = Math.max(1, Math.round(perturb(this.theta_q)));
        if (rng.nextFloat() < rate)
            mutated.A = Math.max(0.01, perturb(this.A));
        if (rng.nextFloat() < rate)
            mutated.K = Math.max(1, Math.round(perturb(this.K)));
        if (rng.nextFloat() < rate)
            mutated.R_c = Math.max(0.01, perturb(this.R_c));
        if (rng.nextFloat() < rate)
            mutated.m = Math.max(0.01, perturb(this.m));
        if (rng.nextFloat() < rate)
            mutated.gamma = Math.max(0, perturb(this.gamma));
        if (rng.nextFloat() < rate)
            mutated.R_s = Math.max(0.01, perturb(this.R_s));
        if (rng.nextFloat() < rate)
            mutated.omega_R = perturb(this.omega_R);
        if (rng.nextFloat() < rate)
            mutated.omega_A = perturb(this.omega_A);
        if (rng.nextFloat() < rate)
            mutated.omega_v = perturb(this.omega_v);
        return new Genome(mutated);
    }
    crossover(other, rng) {
        const mix = (a, b) => rng.nextFloat() < 0.5 ? a : b;
        return new Genome({
            version: '3.0.0',
            H_max: mix(this.H_max, other.H_max),
            theta_q: mix(this.theta_q, other.theta_q),
            A: mix(this.A, other.A),
            K: mix(this.K, other.K),
            R_c: mix(this.R_c, other.R_c),
            m: mix(this.m, other.m),
            gamma: mix(this.gamma, other.gamma),
            R_s: mix(this.R_s, other.R_s),
            omega_R: mix(this.omega_R, other.omega_R),
            omega_A: mix(this.omega_A, other.omega_A),
            omega_v: mix(this.omega_v, other.omega_v),
        });
    }
    toJSON() {
        return { ...this };
    }
    static fromJSON(obj) {
        if (!Genome.validate(obj))
            throw new Error('Invalid Genome JSON');
        return new Genome(obj);
    }
}
//# sourceMappingURL=Genome.js.map