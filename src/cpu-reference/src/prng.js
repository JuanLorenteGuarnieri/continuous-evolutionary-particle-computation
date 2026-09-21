export class XorShift32 {
    state;
    constructor(seed = 1) {
        this.state = (seed >>> 0) || 1;
    }
    nextUInt() {
        let x = this.state;
        x ^= x << 13;
        x ^= x >>> 17;
        x ^= x << 5;
        this.state = x >>> 0;
        return this.state;
    }
    nextFloat() {
        return this.nextUInt() / 0xffffffff;
    }
    nextInt(max) {
        return Math.floor(this.nextFloat() * max);
    }
    clone() {
        const c = new XorShift32(0);
        c.state = this.state;
        return c;
    }
    getState() { return this.state; }
    setState(s) { this.state = s >>> 0; }
}
