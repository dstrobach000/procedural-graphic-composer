import { describe, expect, it } from 'vitest';
import { createDefaultProject } from '../core/project/defaults';
import { applySnapshot, createSnapshot, reorderLayers } from './projectStateUtils';

describe('project state utils', () => {
  it('reorders layers deterministically', () => {
    const project = createDefaultProject();
    const withTwo = {
      ...project,
      layers: [
        ...project.layers,
        {
          ...project.layers[0],
          id: 'layer-two',
          name: 'Layer Two',
        },
      ],
    };

    const reordered = reorderLayers(withTwo.layers, 0, 1);
    expect(reordered[0]?.id).toBe('layer-two');
    expect(reordered[1]?.id).toBe(withTwo.layers[0]?.id);
  });

  it('snapshot strips nested snapshots and restores state', () => {
    const project = createDefaultProject();
    const snapshot = createSnapshot(project);

    expect(snapshot.projectState.snapshots).toEqual([]);

    const nextProject = {
      ...project,
      snapshots: [snapshot],
      seed: 500,
    };

    const restored = applySnapshot(nextProject, snapshot);
    expect(restored.seed).toBe(snapshot.seed);
    expect(restored.snapshots.length).toBe(1);
  });
});
