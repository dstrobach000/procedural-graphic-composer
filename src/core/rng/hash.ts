function fnvMix(current: number, value: number): number {
  let hash = current >>> 0;
  let input = value >>> 0;
  for (let i = 0; i < 4; i += 1) {
    hash ^= input & 0xff;
    hash = Math.imul(hash, 16777619) >>> 0;
    input >>>= 8;
  }
  return hash >>> 0;
}

export function hashSeed(projectSeed: number, offset: number): number {
  let hash = 2166136261;
  hash = fnvMix(hash, projectSeed);
  hash = fnvMix(hash, offset);
  return hash >>> 0;
}
