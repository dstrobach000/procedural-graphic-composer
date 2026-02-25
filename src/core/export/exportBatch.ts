import { join } from '@tauri-apps/api/path';
import { writeFile } from '@tauri-apps/plugin-fs';
import type { Engine } from '../engine/Engine';
import type { Project } from '../project/schema';
import { resolveLayoutExportTarget } from './layoutExport';
import { pixelsToPNGBytes } from './png';

export type BatchExportOptions = {
  snapshotIds: string[];
  layoutIds: string[];
  format: 'png';
  directory: string;
};

export type BatchExportJob = {
  snapshotId: string;
  snapshotName: string;
  layoutId: string;
  layoutName: string;
  width: number;
  height: number;
  fileStem: string;
};

export type BatchExportResult = {
  files: string[];
  written: number;
  skipped: number;
};

export async function exportBatch(
  engine: Engine,
  project: Project,
  options: BatchExportOptions,
): Promise<BatchExportResult> {
  if (options.format !== 'png') {
    throw new Error(`Unsupported batch export format: ${options.format}`);
  }

  const originalProject = cloneProject(project);
  const jobs = buildBatchPlan(originalProject, options.snapshotIds, options.layoutIds);
  const files: string[] = [];

  try {
    for (const job of jobs) {
      const snapshot = originalProject.snapshots.find((entry) => entry.id === job.snapshotId);
      if (!snapshot) {
        continue;
      }

      const snapshotProject = cloneProject(snapshot.projectState);
      const layout = snapshotProject.layouts[job.layoutId];
      if (!layout) {
        continue;
      }

      snapshotProject.activeLayoutId = job.layoutId;
      snapshotProject.canvas = {
        width: layout.width,
        height: layout.height,
      };

      await engine.syncProject(snapshotProject);

      const target = resolveLayoutExportTarget(layout);
      const pixels = await engine.renderToImage(target.exportWidth, target.exportHeight, {
        cameraBounds: target.cameraBounds,
      });
      const pngBytes = await pixelsToPNGBytes(pixels, target.exportWidth, target.exportHeight);
      const path = await join(options.directory, `${job.fileStem}.png`);
      await writeFile(path, pngBytes);
      files.push(path);
    }
  } finally {
    await engine.syncProject(originalProject);
  }

  return {
    files,
    written: files.length,
    skipped: Math.max(0, jobs.length - files.length),
  };
}

export function buildBatchPlan(
  project: Project,
  snapshotIds: string[],
  layoutIds: string[],
): BatchExportJob[] {
  const requestedSnapshots = new Set(snapshotIds);
  const requestedLayouts = new Set(layoutIds);
  const fileNames = new Set<string>();

  const jobs: BatchExportJob[] = [];

  for (const snapshot of project.snapshots) {
    if (!requestedSnapshots.has(snapshot.id)) {
      continue;
    }

    for (const layoutId of layoutIds) {
      if (!requestedLayouts.has(layoutId)) {
        continue;
      }

      const layout = snapshot.projectState.layouts[layoutId];
      if (!layout) {
        continue;
      }

      const snapshotSlug = sanitizeFileName(snapshot.name);
      const layoutSlug = sanitizeFileName(layout.name);
      const baseFileStem = `${snapshotSlug}__${layoutSlug}`;
      const fileStem = toUniqueFileStem(baseFileStem, fileNames);

      jobs.push({
        snapshotId: snapshot.id,
        snapshotName: snapshot.name,
        layoutId,
        layoutName: layout.name,
        width: layout.width,
        height: layout.height,
        fileStem,
      });
    }
  }

  return jobs;
}

export function sanitizeFileName(name: string): string {
  const normalized = name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_-]/g, '');

  return normalized.length > 0 ? normalized : 'untitled';
}

function toUniqueFileStem(base: string, used: Set<string>): string {
  if (!used.has(base)) {
    used.add(base);
    return base;
  }

  let counter = 2;
  while (true) {
    const candidate = `${base}__${counter}`;
    if (!used.has(candidate)) {
      used.add(candidate);
      return candidate;
    }
    counter += 1;
  }
}

function cloneProject(project: Project): Project {
  return JSON.parse(JSON.stringify(project)) as Project;
}
