import { open, save } from '@tauri-apps/plugin-dialog';
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import type { Project } from './schema';
import { parseProject } from './schema';

export async function saveProjectToDisk(project: Project): Promise<string | null> {
  const target = await save({
    title: 'Save Project',
    defaultPath: 'project.json',
    filters: [{ name: 'Project JSON', extensions: ['json'] }],
  });

  if (!target) {
    return null;
  }

  await writeTextFile(target, JSON.stringify(project, null, 2));
  return target;
}

export async function loadProjectFromDisk(): Promise<Project | null> {
  const selected = await open({
    title: 'Open Project',
    directory: false,
    multiple: false,
    filters: [{ name: 'Project JSON', extensions: ['json'] }],
  });

  if (!selected || Array.isArray(selected)) {
    return null;
  }

  const content = await readTextFile(selected);
  const parsed = JSON.parse(content);
  return parseProject(parsed);
}
