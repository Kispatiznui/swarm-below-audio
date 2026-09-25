export class SeededRandom {
  constructor(seed = 0x5EED1234) {
    this.state = (seed >>> 0) || 1;
  }

  next() {
    let x = this.state;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.state = x >>> 0;
    return (this.state / 0xFFFFFFFF) * 2 - 1;
  }

  next01() {
    return (this.next() + 1) * 0.5;
  }

  static fromString(str) {
    let hash = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return new SeededRandom(hash);
  }
}