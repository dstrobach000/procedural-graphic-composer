import { describe, expect, it } from 'vitest';
import { createDefaultProject } from '../core/project/defaults';
import { nextDeterministicSeed } from '../core/rng/prng';
import { buildVariationProject, quantizedRandom } from './variation';

describe('variation engine', () => {
  it('randomizes only randomizable uniforms within range and step', () => {
    const project = createDefaultProject();
    const shaderLayer = project.layers.find((layer) => layer.type === 'shader');
    if (!shaderLayer || shaderLayer.type !== 'shader') {
      throw new Error('missing shader layer');
    }

    shaderLayer.params.uniforms = {
      uA: { value: 0.2, min: 0, max: 1, step: 0.1, randomizable: true },
      uB: { value: 5, min: 0, max: 10, step: 1, randomizable: false },
      uC: { value: 9, randomizable: true },
    };

    const varied = buildVariationProject(project, 2222);
    const variedLayer = varied.layers.find((layer) => layer.type === 'shader');
    if (!variedLayer || variedLayer.type !== 'shader') {
      throw new Error('missing varied shader layer');
    }

    expect(varied.seed).toBe(2222);
    expect(variedLayer.params.uniforms.uA.value).toBeGreaterThanOrEqual(0);
    expect(variedLayer.params.uniforms.uA.value).toBeLessThanOrEqual(1);
    expect((variedLayer.params.uniforms.uA.value * 10) % 1).toBe(0);
    expect(variedLayer.params.uniforms.uB.value).toBe(5);
    expect(variedLayer.params.uniforms.uC.value).toBe(9);
  });

  it('is deterministic for same base project and seed', () => {
    const project = createDefaultProject();
    const shaderLayer = project.layers.find((layer) => layer.type === 'shader');
    if (!shaderLayer || shaderLayer.type !== 'shader') {
      throw new Error('missing shader layer');
    }

    shaderLayer.params.uniforms = {
      uA: { value: 0.2, min: -1, max: 1, step: 0.01, randomizable: true },
      uB: { value: 0.8, min: 0, max: 2, step: 0.05, randomizable: true },
    };

    const one = buildVariationProject(project, 1337);
    const two = buildVariationProject(project, 1337);

    expect(one).toEqual(two);
  });

  it('produces deterministic rebase chain for repeated variations', () => {
    const base = createDefaultProject();
    const shaderLayer = base.layers.find((layer) => layer.type === 'shader');
    if (!shaderLayer || shaderLayer.type !== 'shader') {
      throw new Error('missing shader layer');
    }

    shaderLayer.params.uniforms = {
      uA: { value: 0.25, min: 0, max: 1, step: 0.05, randomizable: true },
      uB: { value: 0.7, min: 0, max: 1, step: 0.1, randomizable: true },
      uLocked: { value: 3, min: 0, max: 10, step: 1, randomizable: false },
    };

    const runChain = () => {
      let seed = base.seed;
      let latest = base;
      for (let i = 0; i < 3; i += 1) {
        seed = nextDeterministicSeed(seed);
        latest = buildVariationProject(base, seed);
      }
      return latest;
    };

    const one = runChain();
    const two = runChain();

    const oneLayer = one.layers.find((layer) => layer.type === 'shader');
    const twoLayer = two.layers.find((layer) => layer.type === 'shader');
    if (!oneLayer || oneLayer.type !== 'shader' || !twoLayer || twoLayer.type !== 'shader') {
      throw new Error('missing varied shader layers');
    }

    expect(one).toEqual(two);
    expect(oneLayer.params.uniforms.uLocked.value).toBe(3);
  });

  it('quantized random clamps correctly', () => {
    const rng = () => 1;
    const value = quantizedRandom(rng, 0, 1, 0.3);
    expect(value).toBe(0.9);
  });
});
