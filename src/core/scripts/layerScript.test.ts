import { describe, expect, it } from 'vitest';
import {
  compileLayerScript,
  normalizeLayerScriptPatch,
  validateLayerScript,
} from './layerScript';

describe('layer script runtime', () => {
  it('compiles and runs valid script source', () => {
    const runner = compileLayerScript(`
      return {
        transform: { y: transform.y + 10 },
        uniforms: { u_amount: uniforms.u_amount + 0.25 }
      };
    `);

    const result = runner({
      time: 0,
      frame: 0,
      seed: 1,
      projectSeed: 1,
      layerSeed: 1,
      random: () => 0.5,
      uniforms: { u_amount: 1 },
      transform: { x: 0, y: 0, scale: 1, rotation: 0 },
    });

    const patch = normalizeLayerScriptPatch(result);
    expect(patch?.transform?.y).toBe(10);
    expect(patch?.uniforms?.u_amount).toBe(1.25);
  });

  it('rejects invalid source', () => {
    const result = validateLayerScript('return {');
    expect(result.ok).toBe(false);
  });

  it('normalizes patch values and removes non-numeric fields', () => {
    const patch = normalizeLayerScriptPatch({
      transform: { x: 3, y: 'bad', scale: 1.2 },
      uniforms: {
        u_ok: 2,
        u_bad: Number.NaN,
      },
    });

    expect(patch).toEqual({
      transform: { x: 3, scale: 1.2 },
      uniforms: { u_ok: 2 },
    });
  });
});
