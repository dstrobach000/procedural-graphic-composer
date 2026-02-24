export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function nextDeterministicSeed(seed: number): number {
  const rng = mulberry32(seed >>> 0);
  return Math.floor(rng() * 0xffffffff) >>> 0;
}

export function randomInt(rng: Rng, min: number, max: number): number {
  if (max <= min) {
    return min;
  }
  return Math.floor(rng() * (max - min + 1)) + min;
}
