export class MFMConfig {
    version;
    Lx;
    Ly;
    Nmax;
    dt;
    seed;
    Qmax;
    R_s_min;
    R_s_max;
    boundary;
    Q_in_max;
    delta_q;
    beta;
    lambda;
    P_min;
    P_max;
    pressure_gamma;
    R_mate;
    H_mate;
    H_birth;
    mate_radius_percent;
    mate_health_percent;
    birth_health_percent;
    mating_probability;
    communication_alpha;
    Hmax;
    theta_q;
    A;
    K;
    Rc;
    m;
    gamma;
    Rs;
    omega_R;
    omega_A;
    omega_v;
    genome_variation;
    constructor(data = {}) {
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
    static validate(obj) {
        if (typeof obj !== 'object' || obj === null)
            return false;
        const o = obj;
        return (typeof o.version === 'string' &&
            typeof o.Lx === 'number' && o.Lx > 0 &&
            typeof o.Ly === 'number' && o.Ly > 0 &&
            typeof o.Nmax === 'number' && o.Nmax > 0 &&
            typeof o.dt === 'number' && o.dt > 0 &&
            typeof o.seed === 'number' &&
            typeof o.Qmax === 'number' && o.Qmax > 0 &&
            typeof o.R_s_min === 'number' && o.R_s_min >= 0 &&
            typeof o.R_s_max === 'number' && o.R_s_max >= o.R_s_min &&
            o.boundary === 'periodic');
    }
    validate() {
        if (!MFMConfig.validate(this)) {
            throw new Error('Invalid MFMConfig');
        }
    }
    toJSON() {
        return { ...this };
    }
    static fromJSON(obj) {
        if (!MFMConfig.validate(obj))
            throw new Error('Invalid MFMConfig JSON');
        return new MFMConfig(obj);
    }
}
