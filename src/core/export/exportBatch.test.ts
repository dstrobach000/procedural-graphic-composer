import { describe, expect, it } from 'vitest';
import { nanoid } from 'nanoid';
import { createDefaultProject } from '../project/defaults';
import type { Project, Snapshot } from '../project/schema';
import { buildBatchPlan, sanitizeFileName } from './exportBatch';

describe('batch export plan', () => {
  it('uses snapshot project layouts, not current project layouts', () => {
    const project = createDefaultProject();

    const snapshotProject: Project = JSON.parse(JSON.stringify(project)) as Project;
    snapshotProject.layouts = {
      instagramPortrait: {
        id: 'instagramPortrait',
        name: 'Snapshot Instagram',
        width: 1080,
        height: 1350,
      },
    };
    snapshotProject.activeLayoutId = 'instagramPortrait';

    const snapshot: Snapshot = {
      id: nanoid(),
      name: 'S1',
      createdAt: new Date().toISOString(),
      seed: snapshotProject.seed,
      projectState: snapshotProject,
    };

    project.layouts = {
      ...project.layouts,
      widescreen: {
        id: 'widescreen',
        name: 'Widescreen',
        width: 1920,
        height: 1080,
      },
    };
    project.snapshots = [snapshot];

    const jobs = buildBatchPlan(project, [snapshot.id], ['instagramPortrait', 'widescreen']);

    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.layoutId).toBe('instagramPortrait');
    expect(jobs[0]?.layoutName).toBe('Snapshot Instagram');
  });

  it('sanitizes filenames and keeps empty values deterministic', () => {
    expect(sanitizeFileName('Snapshot 01!')).toBe('snapshot_01');
    expect(sanitizeFileName('   ')).toBe('untitled');
  });

  it('generates deterministic unique file stems for collisions', () => {
    const project = createDefaultProject();
    const snapshotProject: Project = JSON.parse(JSON.stringify(project)) as Project;
    const sharedLayout = snapshotProject.layouts.instagramPortrait;
    if (!sharedLayout) {
      throw new Error('missing default layout');
    }

    const snapshots: Snapshot[] = ['A', 'B'].map((idSuffix) => ({
      id: `snapshot-${idSuffix}`,
      name: 'Same Name',
      createdAt: new Date().toISOString(),
      seed: snapshotProject.seed,
      projectState: {
        ...JSON.parse(JSON.stringify(snapshotProject)),
      } as Project,
    }));

    project.snapshots = snapshots;
    const jobs = buildBatchPlan(
      project,
      snapshots.map((snapshot) => snapshot.id),
      [sharedLayout.id],
    );

    expect(jobs).toHaveLength(2);
    expect(jobs[0]?.fileStem).toBe('same_name__instagram_portrait');
    expect(jobs[1]?.fileStem).toBe('same_name__instagram_portrait__2');
  });
});
