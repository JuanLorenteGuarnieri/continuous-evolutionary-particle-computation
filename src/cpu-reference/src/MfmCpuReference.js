import { ParticleState, PopulationState } from '@cepc/shared-config';
import { XorShift32 } from './prng.js';
import { wrap, add, scale } from './vector2d.js';
export class MfmCpuReference {
    config;
    population;
    rng;
    timestep = 0;
    constructor(config, population, seed) {
        this.config = config;
        this.population = population;
        this.rng = new XorShift32(seed ?? config.seed);
    }
    step() {
        // 1. Domain already handled via periodicDistance
        // 2. Input quantization - placeholder
        // 3. Charge reception - already in state
        // 4-6 Threshold, processing, decay
        const newPop = new PopulationState();
        for (const [id, state] of this.population.particles) {
            const genome = this.population.genomes.get(id);
            const qPre = state.charge;
            const act = qPre >= genome.theta_q ? 1 : 0;
            const qOut = act ? genome.A * genome.theta_q : 0;
            const qRes = Math.max(0, qPre - genome.theta_q * act);
            const qPost = Math.max(0, Math.min(this.config.Qmax, qRes));
            const newState = new ParticleState({
                version: state.version,
                position: state.position,
                velocity: state.velocity,
                health: state.health,
                charge: qPost,
                senderSet: new Set(),
                prevSenderSet: state.senderSet,
            });
            newPop.addParticle(id, genome.clone(), newState);
        }
        // 7. Communication neighborhood and target selection simplified
        // For phase 2 stub, keep population unchanged for mechanics
        // 13-14 Mechanics
        for (const [id, state] of newPop.particles) {
            const genome = newPop.genomes.get(id);
            // simple damping
            const v = {
                x: state.velocity.x * Math.exp(-this.config.dt * 0.1),
                y: state.velocity.y * Math.exp(-this.config.dt * 0.1),
            };
            const pos = wrap(add(state.position, scale(v, this.config.dt)), this.config.Lx, this.config.Ly);
            const newState = new ParticleState({
                version: state.version,
                position: pos,
                velocity: v,
                health: state.health,
                charge: state.charge,
                senderSet: state.senderSet,
                prevSenderSet: state.prevSenderSet,
            });
            newPop.particles.set(id, newState);
        }
        this.population = newPop;
        this.timestep++;
        return this.population;
    }
    run(steps) {
        const traj = [];
        for (let i = 0; i < steps; i++) {
            traj.push(this.step());
        }
        return traj;
    }
    getState() {
        return {
            timestep: this.timestep,
            population: this.population.toJSON(),
            rngState: this.rng.getState?.(),
        };
    }
    setState(state) {
        this.timestep = state.timestep ?? 0;
        this.population = PopulationState.fromJSON(state.population);
        if (state.rngState && this.rng.setState) {
            this.rng.setState(state.rngState);
        }
    }
}
//# sourceMappingURL=MfmCpuReference.js.map