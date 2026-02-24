import { describe, expect, it } from 'vitest';
import { createDefaultProject } from '../core/project/defaults';
import { applyActiveLayout } from './layouts';

describe('layout presets', () => {
  it('switches canvas without mutating seed/layers/effects', () => {
    const project = createDefaultProject();
    const originalSeed = project.seed;
    const originalLayers = JSON.parse(JSON.stringify(project.layers));
    const originalEffects = JSON.parse(JSON.stringify(project.effectChain));

    const next = applyActiveLayout(project, 'square');

    expect(next.activeLayoutId).toBe('square');
    expect(next.canvas.width).toBe(1080);
    expect(next.canvas.height).toBe(1080);
    expect(next.seed).toBe(originalSeed);
    expect(next.layers).toEqual(originalLayers);
    expect(next.effectChain).toEqual(originalEffects);
  });

  it('restores canvas when switching A -> B -> A', () => {
    const project = createDefaultProject();
    const switched = applyActiveLayout(project, 'square');
    const restored = applyActiveLayout(switched, 'instagramPortrait');

    expect(restored.canvas).toEqual(project.canvas);
    expect(restored.activeLayoutId).toBe('instagramPortrait');
  });
});
