import { Genome, MFMConfig, ParticleState, PopulationState } from '@cepc/shared-config';
import { XorShift32 } from './prng.js';
import { periodicDelta, periodicDistance, wrap } from './vector2d.js';

type Snapshot = { id: string; state: ParticleState; genome: Genome };
type Event = { success: boolean; targets: Set<string> };

export class MfmCpuReference {
  private config: MFMConfig;
  private population: PopulationState;
  private rng: XorShift32;
  private timestep = 0;
  private pendingInputSignal: number | null = null;
  private pendingError: number | null = null;
  private incomingChargeMap = new Map<string, number>();
  private incomingSendersMap = new Map<string, Set<string>>();

  constructor(config: MFMConfig, population: PopulationState, seed?: number) {
    this.config = config;
    this.population = population;
    this.rng = new XorShift32(seed ?? config.seed);
  }

  public getConfig(): MFMConfig { return this.config; }
  public getPopulation(): PopulationState { return this.population; }
  public setConfig(config: MFMConfig): void { this.config = config; }
  public setPopulation(population: PopulationState): void { this.population = population; }

  public injectInput(value: number): void {
    this.pendingInputSignal = Math.max(0, Math.min(1, value));
  }

  public setGlobalError(error: number): void {
    this.pendingError = Math.max(0, Math.min(1, error));
  }

  public step(): PopulationState {
    const snapshot = this.takeSnapshot();
    const inputMap = this.buildInputMap(snapshot);
    const nextCharges = new Map<string, number>();
    const nextSenders = new Map<string, Set<string>>();
    const events = new Map<string, Event>();
    const nextStates = new Map<string, ParticleState>();
    const nextGenomes = new Map<string, Genome>();

    for (const item of snapshot) {
      const { id, state, genome } = item;
      const receivedCharge = this.incomingChargeMap.get(id) ?? 0;
      const receivedSenders = this.incomingSendersMap.get(id) ?? new Set<string>();
      const qPre = state.charge + receivedCharge + (inputMap.get(id) ?? 0);
      const active = qPre >= genome.theta_q;
      const qOut = active ? Math.max(0, Math.round(genome.A * genome.theta_q)) : 0;
      const targets = active ? this.selectTargets(item, snapshot) : [];

      for (const target of targets) {
        nextCharges.set(target.id, (nextCharges.get(target.id) ?? 0) + qOut);
        const senders = nextSenders.get(target.id) ?? new Set<string>();
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
        senderSet: nextSenders.get(id) ?? new Set<string>(),
        prevSenderSet: new Set(receivedSenders),
        role: state.role,
      }));
    }

    const pressure = this.computePressure(snapshot);
    for (const item of snapshot) {
      const nextState = nextStates.get(item.id);
      if (!nextState) continue;
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
      if (genome) nextPopulation.addParticle(id, genome, state);
    }
    this.population = nextPopulation;
    this.incomingChargeMap = nextCharges;
    this.incomingSendersMap = nextSenders;
    this.timestep++;
    return nextPopulation;
  }

  public run(steps: number): PopulationState[] {
    const trajectory: PopulationState[] = [];
    for (let i = 0; i < steps; i++) trajectory.push(this.step());
    return trajectory;
  }

  public getState(): unknown {
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

  public setState(state: Record<string, unknown>): void {
    this.timestep = typeof state.timestep === 'number' ? state.timestep : 0;
    this.population = PopulationState.fromJSON(state.population);
    if (typeof state.rngState === 'number') this.rng.setState(state.rngState);
    this.pendingInputSignal = typeof state.pendingInputSignal === 'number' ? state.pendingInputSignal : null;
    this.pendingError = typeof state.pendingError === 'number' ? state.pendingError : null;
    this.incomingChargeMap = new Map(
      Array.isArray(state.incomingCharges)
        ? state.incomingCharges.filter((entry): entry is [string, number] => Array.isArray(entry) && typeof entry[0] === 'string' && typeof entry[1] === 'number')
        : []
    );
    this.incomingSendersMap = new Map(
      Array.isArray(state.incomingSenders)
        ? state.incomingSenders.filter((entry): entry is [string, string[]] => Array.isArray(entry) && typeof entry[0] === 'string' && Array.isArray(entry[1])).map(([id, senders]) => [id, new Set(senders.filter((sender): sender is string => typeof sender === 'string'))])
        : []
    );
  }

  private takeSnapshot(): Snapshot[] {
    const snapshot: Snapshot[] = [];
    for (const [id, state] of this.population.particles) {
      const genome = this.population.genomes.get(id);
      if (genome) snapshot.push({ id, state, genome });
    }
    return snapshot;
  }

  private buildInputMap(snapshot: Snapshot[]): Map<string, number> {
    const inputMap = new Map<string, number>();
    if (this.pendingInputSignal === null) return inputMap;
    const input = snapshot.find(item => item.state.role === 'input') ?? snapshot[0];
    if (input) inputMap.set(input.id, Math.round(this.config.Q_in_max * this.pendingInputSignal));
    this.pendingInputSignal = null;
    return inputMap;
  }

  private selectTargets(sender: Snapshot, snapshot: Snapshot[]): Snapshot[] {
    if (sender.state.role === 'output') return [];
    const remaining = snapshot.filter(item => item.id !== sender.id && item.state.role !== 'input' && periodicDistance(
      sender.state.position, item.state.position, this.config.Lx, this.config.Ly
    ) <= sender.genome.R_c);
    const selected: Snapshot[] = [];
    const count = Math.min(Math.max(0, Math.floor(sender.genome.K)), remaining.length);
    for (let i = 0; i < count; i++) {
      const scores = remaining.map(item => sender.genome.omega_R * this.feature(item.genome.R_s, this.config.R_s_max) +
        sender.genome.omega_A * this.feature(item.genome.A, 10) +
        sender.genome.omega_v * this.feature(Math.hypot(item.state.velocity.x, item.state.velocity.y), 10));
      const maxScore = Math.max(...scores, 0);
      const weights = scores.map(score => Math.exp(this.config.communication_alpha * (score - maxScore)));
      let sample = this.rng.nextFloat() * weights.reduce((sum, weight) => sum + weight, 0);
      let index = 0;
      while (index < weights.length - 1 && sample > weights[index]) sample -= weights[index++];
      selected.push(remaining.splice(index, 1)[0]);
    }
    return selected;
  }

  private applyMechanics(snapshot: Snapshot[], nextStates: Map<string, ParticleState>): void {
    const forces = new Map<string, { x: number; y: number }>();
    for (const item of snapshot) {
      if (item.state.role !== 'internal' || !nextStates.has(item.id)) continue;
      const range = this.config.R_s_min + (this.config.R_s_max - this.config.R_s_min) * (item.state.charge / this.config.Qmax);
      let forceX = 0;
      let forceY = 0;
      for (const target of snapshot) {
        if (target.id === item.id) continue;
        const delta = periodicDelta(item.state.position, target.state.position, this.config.Lx, this.config.Ly);
        const distance = Math.hypot(delta.x, delta.y);
        if (distance === 0 || distance > range) continue;
        const score = item.genome.omega_R * this.feature(target.genome.R_s, this.config.R_s_max) +
          item.genome.omega_A * this.feature(target.genome.A, 10) +
          item.genome.omega_v * this.feature(Math.hypot(target.state.velocity.x, target.state.velocity.y), 10);
        const magnitude = score * (1 - distance / range);
        forceX += magnitude * delta.x / distance;
        forceY += magnitude * delta.y / distance;
      }
      forces.set(item.id, { x: forceX, y: forceY });
    }
    for (const item of snapshot) {
      const state = nextStates.get(item.id);
      if (!state) continue;
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

  private addOffspring(snapshot: Snapshot[], nextStates: Map<string, ParticleState>, nextGenomes: Map<string, Genome>, events: Map<string, Event>): void {
    if (this.config.mating_probability <= 0 || nextStates.size >= this.config.Nmax) return;
    const candidates = snapshot.filter(item => item.state.role === 'internal' && nextStates.has(item.id) &&
      item.state.health >= item.genome.H_max * this.config.mate_health_percent && events.get(item.id)?.success);
    for (let i = 0; i < candidates.length && nextStates.size < this.config.Nmax; i++) {
      for (let j = i + 1; j < candidates.length && nextStates.size < this.config.Nmax; j++) {
        const first = candidates[i];
        const second = candidates[j];
        const matingRadius = Math.min(first.genome.R_c, second.genome.R_c) * this.config.mate_radius_percent;
        if (periodicDistance(first.state.position, second.state.position, this.config.Lx, this.config.Ly) > matingRadius ||
          this.rng.nextFloat() >= this.config.mating_probability) continue;
        const id = `offspring-${this.timestep}-${nextStates.size}`;
        const childGenome = first.genome.crossover(second.genome, this.rng).mutate(this.rng);
        nextGenomes.set(id, childGenome);
        nextStates.set(id, new ParticleState({
          position: wrap({ x: (first.state.position.x + second.state.position.x) / 2, y: (first.state.position.y + second.state.position.y) / 2 }, this.config.Lx, this.config.Ly),
          velocity: { x: (first.state.velocity.x + second.state.velocity.x) / 2, y: (first.state.velocity.y + second.state.velocity.y) / 2 },
          health: childGenome.H_max * this.config.birth_health_percent, charge: 0, senderSet: new Set(), prevSenderSet: new Set(), role: 'internal',
        }));
      }
    }
  }

  private computePressure(snapshot: Snapshot[]): number {
    const outputs = snapshot.filter(item => item.state.role === 'output');
    const outputCharge = outputs.reduce((sum, item) => sum + item.state.charge, 0);
    const error = this.pendingError ?? (outputs.length === 0 ? 0 : 1 - Math.min(1, outputCharge / (outputs.length * this.config.Qmax)));
    this.pendingError = null;
    return this.config.P_min + (this.config.P_max - this.config.P_min) * Math.pow(error, this.config.pressure_gamma);
  }

  private feature(value: number, scale: number): number { return Math.max(0, Math.min(1, value / scale)); }
  private clip(value: number, min: number, max: number): number { return Math.min(max, Math.max(min, value)); }
}
