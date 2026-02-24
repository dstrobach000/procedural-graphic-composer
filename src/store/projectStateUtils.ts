import { nanoid } from 'nanoid';
import type { LayerInstance } from '../core/layers/Layer';
import type { Project, Snapshot } from '../core/project/schema';

export function reorderLayers(layers: LayerInstance[], fromIndex: number, toIndex: number): LayerInstance[] {
  if (fromIndex < 0 || toIndex < 0 || fromIndex >= layers.length || toIndex >= layers.length) {
    return layers;
  }

  const next = [...layers];
  const [moved] = next.splice(fromIndex, 1);
  if (!moved) {
    return layers;
  }
  next.splice(toIndex, 0, moved);
  return next;
}

export function createSnapshot(project: Project): Snapshot {
  const projectState = cloneProject(project);
  projectState.snapshots = [];

  return {
    id: nanoid(),
    name: `Snapshot ${project.snapshots.length + 1}`,
    createdAt: new Date().toISOString(),
    seed: project.seed,
    projectState,
  };
}

export function applySnapshot(project: Project, snapshot: Snapshot): Project {
  const restored = cloneProject(snapshot.projectState);
  restored.snapshots = project.snapshots;
  return restored;
}

export function cloneProject(project: Project): Project {
  return JSON.parse(JSON.stringify(project)) as Project;
}
