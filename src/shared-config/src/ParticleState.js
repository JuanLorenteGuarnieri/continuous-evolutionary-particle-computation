export class ParticleState {
    version;
    position;
    velocity;
    health;
    charge;
    senderSet;
    prevSenderSet;
    constructor(data = {}) {
        this.version = data.version ?? '3.0.0';
        this.position = data.position ?? { x: 0, y: 0 };
        this.velocity = data.velocity ?? { x: 0, y: 0 };
        this.health = data.health ?? 0;
        this.charge = data.charge ?? 0;
        this.senderSet = data.senderSet ? new Set(data.senderSet) : new Set();
        this.prevSenderSet = data.prevSenderSet ? new Set(data.prevSenderSet) : new Set();
        this.validate();
    }
    static validate(obj) {
        if (typeof obj !== 'object' || obj === null)
            return false;
        const o = obj;
        return (typeof o.version === 'string' &&
            typeof o.position === 'object' && o.position !== null &&
            typeof o.position.x === 'number' && typeof o.position.y === 'number' &&
            typeof o.velocity === 'object' && o.velocity !== null &&
            typeof o.velocity.x === 'number' && typeof o.velocity.y === 'number' &&
            typeof o.health === 'number' && o.health >= 0 &&
            typeof o.charge === 'number' && Number.isInteger(o.charge) && o.charge >= 0 &&
            o.senderSet instanceof Set &&
            o.prevSenderSet instanceof Set);
    }
    validate() {
        if (this.charge < 0 || !Number.isInteger(this.charge)) {
            throw new Error('charge must be non-negative integer');
        }
        if (this.health < 0) {
            throw new Error('health must be >=0');
        }
    }
    reset() {
        return new ParticleState({
            version: this.version,
            position: { x: 0, y: 0 },
            velocity: { x: 0, y: 0 },
            health: 0,
            charge: 0,
            senderSet: new Set(),
            prevSenderSet: new Set(),
        });
    }
    isValid(Qmax = Number.MAX_SAFE_INTEGER, Hmax = Number.MAX_SAFE_INTEGER) {
        return (this.charge >= 0 && this.charge <= Qmax &&
            this.health >= 0 && this.health <= Hmax);
    }
    toJSON() {
        return {
            version: this.version,
            position: this.position,
            velocity: this.velocity,
            health: this.health,
            charge: this.charge,
            senderSet: Array.from(this.senderSet),
            prevSenderSet: Array.from(this.prevSenderSet),
        };
    }
    static fromJSON(obj) {
        return new ParticleState({
            version: obj.version,
            position: obj.position,
            velocity: obj.velocity,
            health: obj.health,
            charge: obj.charge,
            senderSet: new Set(obj.senderSet ?? []),
            prevSenderSet: new Set(obj.prevSenderSet ?? []),
        });
    }
}
//# sourceMappingURL=ParticleState.js.map