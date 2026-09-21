export class ParticleState {
    version;
    position;
    velocity;
    health;
    charge;
    senderSet;
    prevSenderSet;
    role;
    constructor(data = {}) {
        this.version = data.version ?? '3.0.0';
        this.position = data.position ?? { x: 0, y: 0 };
        this.velocity = data.velocity ?? { x: 0, y: 0 };
        this.health = data.health ?? 0;
        this.charge = data.charge ?? 0;
        this.senderSet = data.senderSet ? new Set(data.senderSet) : new Set();
        this.prevSenderSet = data.prevSenderSet ? new Set(data.prevSenderSet) : new Set();
        this.role = data.role ?? 'internal';
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
            (o.senderSet instanceof Set || Array.isArray(o.senderSet)) &&
            (o.prevSenderSet instanceof Set || Array.isArray(o.prevSenderSet)));
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
            role: this.role,
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
            role: this.role,
        };
    }
    static fromJSON(obj) {
        if (typeof obj !== 'object' || obj === null)
            throw new Error('Invalid ParticleState JSON');
        const o = obj;
        const position = o.position;
        const velocity = o.velocity;
        const senderSet = o.senderSet;
        const prevSenderSet = o.prevSenderSet;
        if (typeof o.version !== 'string' ||
            typeof position !== 'object' || position === null ||
            typeof position.x !== 'number' ||
            typeof position.y !== 'number' ||
            typeof velocity !== 'object' || velocity === null ||
            typeof velocity.x !== 'number' ||
            typeof velocity.y !== 'number' ||
            typeof o.health !== 'number' ||
            typeof o.charge !== 'number' ||
            !Array.isArray(senderSet) ||
            !Array.isArray(prevSenderSet)) {
            throw new Error('Invalid ParticleState JSON');
        }
        return new ParticleState({
            version: o.version,
            position: position,
            velocity: velocity,
            health: o.health,
            charge: o.charge,
            senderSet: new Set(senderSet),
            prevSenderSet: new Set(prevSenderSet),
            role: o.role === 'input' || o.role === 'output' ? o.role : 'internal',
        });
    }
}
