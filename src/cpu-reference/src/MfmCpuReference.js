import { ParticleState, PopulationState } from '@cepc/shared-config';
import { XorShift32 } from './prng';
import { periodicDelta, periodicDistance, wrap } from './vector2d';
const EPSILON = 1e-6;
let DEBUG_MFM_CPU_PROFILING = false;
const cpuProfileStats = new Map();
function setMfmCpuProfilingEnabled(enabled) {
    DEBUG_MFM_CPU_PROFILING = enabled;
    if (!enabled)
        cpuProfileStats.clear();
}
function cpuProfileRecord(label, elapsedMs) {
    if (!DEBUG_MFM_CPU_PROFILING)
        return;
    const current = cpuProfileStats.get(label) ?? { total: 0, count: 0, min: Infinity, max: -Infinity };
    current.total += elapsedMs;
    current.count += 1;
    current.min = Math.min(current.min, elapsedMs);
    current.max = Math.max(current.max, elapsedMs);
    cpuProfileStats.set(label, current);
}
function cpuProfileFlush(timestep, particleCount) {
    if (!DEBUG_MFM_CPU_PROFILING || timestep % 30 !== 0)
        return;
    const summary = {};
    for (const [label, value] of cpuProfileStats) {
        summary[label] = { avg: value.total / value.count, min: value.min, max: value.max, samples: value.count };
    }
    console.log('[CEPC][MfmCPU][profiling]', { timestep, particleCount, summary });
    cpuProfileStats.clear();
}
export class MfmCpuReference {
    config;
    population;
    rng;
    timestep = 0;
    pendingInputSignal = null;
    pendingError = null;
    incomingChargeMap = new Map();
    incomingSendersMap = new Map();
    constructor(config, population, seed) {
        this.config = config;
        this.population = population;
        this.rng = new XorShift32(seed ?? config.seed);
    }
    getConfig() { return this.config; }
    getPopulation() { return this.population; }
    setConfig(config) { this.config = config; }
    setPopulation(population) { this.population = population; }
    setProfilingEnabled(enabled) {
        setMfmCpuProfilingEnabled(enabled);
    }
    injectInput(value) {
        this.pendingInputSignal = Math.max(0, Math.min(1, value));
    }
    setGlobalError(error) {
        this.pendingError = Math.max(0, Math.min(1, error));
    }
    step() {
        const stepStart = performance.now();
        const snapshotStart = performance.now();
        const snapshot = this.takeSnapshot();
        cpuProfileRecord('cpu.snapshot', performance.now() - snapshotStart);
        const inputMap = this.buildInputMap(snapshot);
        const nextCharges = new Map();
        const nextSenders = new Map();
        const events = new Map();
        const nextStates = new Map();
        const nextGenomes = new Map();
        const evolutionStart = performance.now();
        for (const item of snapshot) {
            const { id, state, genome } = item;
            const receivedCharge = this.incomingChargeMap.get(id) ?? 0;
            const receivedSenders = this.incomingSendersMap.get(id) ?? new Set();
            const qPre = state.charge + receivedCharge + (inputMap.get(id) ?? 0);
            const active = qPre >= genome.theta_q;
            const qOut = active ? Math.max(0, Math.round(genome.A * genome.theta_q)) : 0;
            const targets = active ? this.selectTargets(item, snapshot) : [];
            for (const target of targets) {
                nextCharges.set(target.id, (nextCharges.get(target.id) ?? 0) + qOut);
                const senders = nextSenders.get(target.id) ?? new Set();
                senders.add(id);
                nextSenders.set(target.id, senders);
            }
            const residual = qPre - (active ? genome.theta_q : 0);
            const charge = Math.round(Math.min(this.config.Qmax, Math.max(0, residual - this.config.delta_q)));
            const received = receivedCharge > 0 || (inputMap.get(id) ?? 0) > 0;
            const event = { success: received && active && targets.length > 0, targets: new Set(targets.map(target => target.id)) };
            events.set(id, event);
            nextGenomes.set(id, genome.clone());
            nextStates.set(id, new ParticleState({
                version: state.version,
                position: { ...state.position },
                velocity: { ...state.velocity },
                health: state.health,
                charge,
                senderSet: nextSenders.get(id) ?? new Set(),
                prevSenderSet: new Set(receivedSenders),
                role: state.role,
            }));
        }
        const pressure = this.computePressure(snapshot);
        for (const item of snapshot) {
            const nextState = nextStates.get(item.id);
            if (!nextState)
                continue;
            const protectedParticle = item.state.role !== 'internal';
            const event = events.get(item.id);
            const health = protectedParticle
                ? item.state.health
                : this.clip(item.state.health + this.config.beta * (event?.success ? 1 : 0) - this.config.lambda * pressure, 0, item.genome.H_max);
            nextState.health = health;
            if (!protectedParticle && health <= 0) {
                nextStates.delete(item.id);
                nextGenomes.delete(item.id);
            }
        }
        for (const [id, state] of nextStates) {
            state.senderSet = new Set(nextSenders.get(id) ?? []);
        }
        this.applyMechanics(snapshot, nextStates);
        this.addOffspring(snapshot, nextStates, nextGenomes, events);
        const nextPopulation = new PopulationState();
        for (const [id, state] of nextStates) {
            const genome = nextGenomes.get(id);
            if (genome)
                nextPopulation.addParticle(id, genome, state);
        }
        this.population = nextPopulation;
        this.incomingChargeMap = nextCharges;
        this.incomingSendersMap = nextSenders;
        this.timestep++;
        cpuProfileRecord('cpu.evolution+reproduction', performance.now() - evolutionStart);
        cpuProfileRecord('cpu.step.total', performance.now() - stepStart);
        cpuProfileFlush(this.timestep, snapshot.length);
        return nextPopulation;
    }
    run(steps) {
        const trajectory = [];
        for (let i = 0; i < steps; i++)
            trajectory.push(this.step());
        return trajectory;
    }
    getState() {
        return {
            timestep: this.timestep,
            population: this.population.toJSON(),
            rngState: this.rng.getState(),
            pendingInputSignal: this.pendingInputSignal,
            pendingError: this.pendingError,
            incomingCharges: Array.from(this.incomingChargeMap.entries()),
            incomingSenders: Array.from(this.incomingSendersMap.entries()).map(([id, senders]) => [id, Array.from(senders)]),
        };
    }
    setState(state) {
        this.timestep = typeof state.timestep === 'number' ? state.timestep : 0;
        this.population = PopulationState.fromJSON(state.population);
        if (typeof state.rngState === 'number')
            this.rng.setState(state.rngState);
        this.pendingInputSignal = typeof state.pendingInputSignal === 'number' ? state.pendingInputSignal : null;
        this.pendingError = typeof state.pendingError === 'number' ? state.pendingError : null;
        this.incomingChargeMap = new Map(Array.isArray(state.incomingCharges)
            ? state.incomingCharges.filter((entry) => Array.isArray(entry) && typeof entry[0] === 'string' && typeof entry[1] === 'number')
            : []);
        this.incomingSendersMap = new Map(Array.isArray(state.incomingSenders)
            ? state.incomingSenders.filter((entry) => Array.isArray(entry) && typeof entry[0] === 'string' && Array.isArray(entry[1])).map(([id, senders]) => [id, new Set(senders.filter((sender) => typeof sender === 'string'))])
            : []);
    }
    takeSnapshot() {
        const snapshot = [];
        for (const [id, state] of this.population.particles) {
            const genome = this.population.genomes.get(id);
            if (genome)
                snapshot.push({ id, state, genome });
        }
        return snapshot;
    }
    buildInputMap(snapshot) {
        const inputMap = new Map();
        if (this.pendingInputSignal === null)
            return inputMap;
        const input = snapshot.find(item => item.state.role === 'input') ?? snapshot[0];
        if (input)
            inputMap.set(input.id, Math.round(this.config.Q_in_max * this.pendingInputSignal));
        this.pendingInputSignal = null;
        return inputMap;
    }
    selectTargets(sender, snapshot) {
        if (sender.state.role === 'output')
            return [];
        const remaining = snapshot.filter(item => item.id !== sender.id && periodicDistance(sender.state.position, item.state.position, this.config.Lx, this.config.Ly) <= sender.genome.R_c);
        const selected = [];
        const count = Math.min(Math.max(0, Math.floor(sender.genome.K)), remaining.length);
        for (let i = 0; i < count; i++) {
            const scores = remaining.map(item => sender.genome.omega_R * this.feature(item.genome.R_s, this.config.R_s_max) +
                sender.genome.omega_A * this.feature(item.genome.A, 10) +
                sender.genome.omega_v * this.feature(Math.hypot(item.state.velocity.x, item.state.velocity.y), 10));
            const maxScore = Math.max(...scores, 0);
            const weights = scores.map(score => Math.exp(this.config.communication_alpha * (score - maxScore)));
            let sample = this.rng.nextFloat() * weights.reduce((sum, weight) => sum + weight, 0);
            let index = 0;
            while (index < weights.length - 1 && sample > weights[index])
                sample -= weights[index++];
            selected.push(remaining.splice(index, 1)[0]);
        }
        return selected;
    }
    applyMechanics(snapshot, nextStates) {
        const forces = new Map();
        for (const item of snapshot) {
            if (item.state.role !== 'internal' || !nextStates.has(item.id))
                continue;
            const range = this.config.R_s_min + (this.config.R_s_max - this.config.R_s_min) * (item.state.charge / this.config.Qmax);
            let forceX = 0;
            let forceY = 0;
            for (const target of snapshot) {
                if (target.id === item.id)
                    continue;
                const delta = periodicDelta(item.state.position, target.state.position, this.config.Lx, this.config.Ly);
                const distance = Math.hypot(delta.x, delta.y);
                if (distance === 0 || distance > range)
                    continue;
                const score = item.genome.omega_R * this.feature(target.genome.R_s, this.config.R_s_max) +
                    item.genome.omega_A * this.feature(target.genome.A, 10) +
                    item.genome.omega_v * this.feature(Math.hypot(target.state.velocity.x, target.state.velocity.y), 10);
                const magnitude = score * (1 - distance / range);
                const forceFactor = magnitude / (distance + EPSILON);
                forceX += forceFactor * delta.x;
                forceY += forceFactor * delta.y;
            }
            forces.set(item.id, { x: forceX, y: forceY });
        }
        for (const item of snapshot) {
            const state = nextStates.get(item.id);
            if (!state)
                continue;
            if (item.state.role !== 'internal') {
                state.position = { ...item.state.position };
                state.velocity = { x: 0, y: 0 };
                continue;
            }
            const force = forces.get(item.id) ?? { x: 0, y: 0 };
            const velocity = {
                x: item.state.velocity.x + ((force.x - item.genome.gamma * item.state.velocity.x) / item.genome.m) * this.config.dt,
                y: item.state.velocity.y + ((force.y - item.genome.gamma * item.state.velocity.y) / item.genome.m) * this.config.dt,
            };
            state.velocity = velocity;
            state.position = wrap({
                x: item.state.position.x + velocity.x * this.config.dt,
                y: item.state.position.y + velocity.y * this.config.dt,
            }, this.config.Lx, this.config.Ly);
        }
    }
    addOffspring(snapshot, nextStates, nextGenomes, events) {
        if (this.config.mating_probability <= 0 || nextStates.size >= this.config.Nmax)
            return;
        const candidates = snapshot.filter(item => item.state.role === 'internal' && nextStates.has(item.id) &&
            item.state.health >= item.genome.H_max * this.config.mate_health_percent && events.get(item.id)?.success);
        for (let i = 0; i < candidates.length && nextStates.size < this.config.Nmax; i++) {
            for (let j = i + 1; j < candidates.length && nextStates.size < this.config.Nmax; j++) {
                const first = candidates[i];
                const second = candidates[j];
                const matingRadius = this.config.R_mate * (this.config.mate_radius_percent / 100);
                if (periodicDistance(first.state.position, second.state.position, this.config.Lx, this.config.Ly) > matingRadius ||
                    this.rng.nextFloat() >= this.config.mating_probability)
                    continue;
                const id = `offspring-${this.timestep}-${nextStates.size}`;
                const childGenome = first.genome.crossover(second.genome, this.rng).mutate(this.rng);
                nextGenomes.set(id, childGenome);
                nextStates.set(id, new ParticleState({
                    position: (() => {
                        const baseX = (first.state.position.x + second.state.position.x) / 2;
                        const baseY = (first.state.position.y + second.state.position.y) / 2;
                        // Add perturbation: �1% of domain size
                        const perturbationX = (this.rng.nextFloat() - 0.5) * 2 * this.config.Lx * 0.01;
                        const perturbationY = (this.rng.nextFloat() - 0.5) * 2 * this.config.Ly * 0.01;
                        return wrap({ x: baseX + perturbationX, y: baseY + perturbationY }, this.config.Lx, this.config.Ly);
                    })(),
                    velocity: (() => {
                        const baseVx = (first.state.velocity.x + second.state.velocity.x) / 2;
                        const baseVy = (first.state.velocity.y + second.state.velocity.y) / 2;
                        // Add perturbation: �0.01 in each component
                        const perturbationVx = (this.rng.nextFloat() - 0.5) * 2 * 0.01;
                        const perturbationVy = (this.rng.nextFloat() - 0.5) * 2 * 0.01;
                        return { x: baseVx + perturbationVx, y: baseVy + perturbationVy };
                    })(),
                    health: childGenome.H_max * this.config.birth_health_percent, charge: 0, senderSet: new Set(), prevSenderSet: new Set(), role: 'internal',
                }));
            }
        }
    }
    computePressure(snapshot) {
        const outputs = snapshot.filter(item => item.state.role === 'output');
        const outputCharge = outputs.reduce((sum, item) => sum + item.state.charge, 0);
        const error = this.pendingError ?? (outputs.length === 0 ? 0 : 1 - Math.min(1, outputCharge / (outputs.length * this.config.Qmax)));
        this.pendingError = null;
        return this.config.P_min + (this.config.P_max - this.config.P_min) * Math.pow(error, this.config.pressure_gamma);
    }
    feature(value, scale) { return Math.max(0, Math.min(1, value / scale)); }
    clip(value, min, max) { return Math.min(max, Math.max(min, value)); }
}
