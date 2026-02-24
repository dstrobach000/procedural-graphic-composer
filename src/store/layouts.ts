import type { Project } from '../core/project/schema';

export function applyActiveLayout(project: Project, layoutId: string): Project {
  const layout = project.layouts[layoutId];
  if (!layout) {
    return project;
  }

  return {
    ...project,
    activeLayoutId: layout.id,
    canvas: {
      width: layout.width,
      height: layout.height,
    },
  };
}
