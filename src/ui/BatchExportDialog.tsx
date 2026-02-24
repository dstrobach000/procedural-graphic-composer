import { useEffect, useMemo, useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import type { LayoutPreset, Project } from '../core/project/schema';

type BatchExportDialogProps = {
  isOpen: boolean;
  project: Project;
  onClose: () => void;
  onExport: (selection: { snapshotIds: string[]; layoutIds: string[]; directory: string }) => Promise<void>;
};

export function BatchExportDialog({ isOpen, project, onClose, onExport }: BatchExportDialogProps) {
  const [selectedSnapshotIds, setSelectedSnapshotIds] = useState<string[]>([]);
  const [selectedLayoutIds, setSelectedLayoutIds] = useState<string[]>([]);
  const [directory, setDirectory] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const snapshotIds = project.snapshots.map((snapshot) => snapshot.id);
    setSelectedSnapshotIds(snapshotIds);

    const defaultLayouts = getCommonLayouts(project, snapshotIds);
    setSelectedLayoutIds(defaultLayouts.map((layout) => layout.id));
    setDirectory('');
    setIsExporting(false);
  }, [isOpen, project]);

  const availableLayouts = useMemo(
    () => getCommonLayouts(project, selectedSnapshotIds),
    [project, selectedSnapshotIds],
  );

  useEffect(() => {
    const validLayoutIds = new Set(availableLayouts.map((layout) => layout.id));
    setSelectedLayoutIds((current) => current.filter((layoutId) => validLayoutIds.has(layoutId)));
  }, [availableLayouts]);

  if (!isOpen) {
    return null;
  }

  const canExport =
    !isExporting &&
    directory.length > 0 &&
    selectedSnapshotIds.length > 0 &&
    selectedLayoutIds.length > 0;

  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div className="modal-card" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h3>Batch Export PNG</h3>
        </div>

        <div className="modal-section">
          <strong>Snapshots</strong>
          {project.snapshots.length === 0 ? (
            <p className="modal-empty">No snapshots yet. Create snapshots first.</p>
          ) : (
            <div className="modal-list">
              {project.snapshots.map((snapshot) => (
                <label key={snapshot.id} className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={selectedSnapshotIds.includes(snapshot.id)}
                    onChange={(event) =>
                      setSelectedSnapshotIds((current) =>
                        event.target.checked
                          ? [...current, snapshot.id]
                          : current.filter((entry) => entry !== snapshot.id),
                      )
                    }
                  />
                  {snapshot.name}
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="modal-section">
          <strong>Layouts (common to selected snapshots)</strong>
          {availableLayouts.length === 0 ? (
            <p className="modal-empty">No common layouts available for the selected snapshots.</p>
          ) : (
            <div className="modal-list">
              {availableLayouts.map((layout) => (
                <label key={layout.id} className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={selectedLayoutIds.includes(layout.id)}
                    onChange={(event) =>
                      setSelectedLayoutIds((current) =>
                        event.target.checked
                          ? [...current, layout.id]
                          : current.filter((entry) => entry !== layout.id),
                      )
                    }
                  />
                  {layout.name} ({layout.width}x{layout.height})
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="modal-section">
          <strong>Folder</strong>
          <div className="modal-row">
            <input value={directory} readOnly placeholder="Choose output directory" />
            <button
              type="button"
              onClick={() => {
                void (async () => {
                  const selected = await open({
                    title: 'Select Batch Export Folder',
                    directory: true,
                    multiple: false,
                  });
                  if (typeof selected === 'string') {
                    setDirectory(selected);
                  }
                })();
              }}
            >
              Choose
            </button>
          </div>
        </div>

        <div className="modal-actions">
          <button type="button" onClick={onClose} disabled={isExporting}>
            Cancel
          </button>
          <button
            type="button"
            disabled={!canExport}
            onClick={() => {
              void (async () => {
                if (!canExport) {
                  return;
                }
                setIsExporting(true);
                try {
                  await onExport({
                    snapshotIds: selectedSnapshotIds,
                    layoutIds: selectedLayoutIds,
                    directory,
                  });
                  onClose();
                } finally {
                  setIsExporting(false);
                }
              })();
            }}
          >
            {isExporting ? 'Exporting...' : 'Export'}
          </button>
        </div>
      </div>
    </div>
  );
}

function getCommonLayouts(project: Project, snapshotIds: string[]): LayoutPreset[] {
  const selectedSnapshots = project.snapshots.filter((snapshot) => snapshotIds.includes(snapshot.id));
  if (selectedSnapshots.length === 0) {
    return [];
  }

  const [firstSnapshot, ...rest] = selectedSnapshots;
  if (!firstSnapshot) {
    return [];
  }

  const commonLayoutIds = Object.keys(firstSnapshot.projectState.layouts).filter((layoutId) =>
    rest.every((snapshot) => Boolean(snapshot.projectState.layouts[layoutId])),
  );

  return commonLayoutIds
    .map((layoutId) => firstSnapshot.projectState.layouts[layoutId])
    .filter((layout): layout is LayoutPreset => Boolean(layout))
    .sort((a, b) => a.name.localeCompare(b.name));
}
