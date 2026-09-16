export interface PRNG {
  nextFloat(): number;
  nextInt(max: number): number;
  clone(): PRNG;
}

export class XorShift32 implements PRNG {
  private state: number;
  constructor(seed: number = 1) {
    this.state = (seed >>> 0) || 1;
  }
  private nextUInt(): number {
    let x = this.state;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.state = x >>> 0;
    return this.state;
  }
  nextFloat(): number {
    return this.nextUInt() / 0xffffffff;
  }
  nextInt(max: number): number {
    return Math.floor(this.nextFloat() * max);
  }
  clone(): PRNG {
    const c = new XorShift32(0);
    (c as any).state = this.state;
    return c;
  }
  getState(): number { return this.state; }
  setState(s: number): void { this.state = s >>> 0; }
}
