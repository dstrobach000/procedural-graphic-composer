import { describe, expect, it } from 'vitest';
import { hashSeed } from './hash';
import { mulberry32, nextDeterministicSeed } from './prng';

describe('PRNG determinism', () => {
  it('returns same sequence for same seed', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);

    const samplesA = Array.from({ length: 6 }, () => a());
    const samplesB = Array.from({ length: 6 }, () => b());

    expect(samplesA).toEqual(samplesB);
  });

  it('returns different sequence for different seeds', () => {
    const a = mulberry32(42);
    const b = mulberry32(1337);

    const samplesA = Array.from({ length: 6 }, () => a());
    const samplesB = Array.from({ length: 6 }, () => b());

    expect(samplesA).not.toEqual(samplesB);
  });

  it('computes deterministic variation chain', () => {
    let seed = 99;
    const chainA = [] as number[];
    for (let i = 0; i < 5; i += 1) {
      seed = nextDeterministicSeed(seed);
      chainA.push(seed);
    }

    seed = 99;
    const chainB = [] as number[];
    for (let i = 0; i < 5; i += 1) {
      seed = nextDeterministicSeed(seed);
      chainB.push(seed);
    }

    expect(chainA).toEqual(chainB);
  });

  it('hashes project seed + offset stably', () => {
    const first = hashSeed(1234, 9);
    const second = hashSeed(1234, 9);
    const different = hashSeed(1234, 10);

    expect(first).toBe(second);
    expect(first).not.toBe(different);
  });
});
