import { useState } from 'react';
import { exportPresets, type ExportPresetId } from '../core/export/presets';
import { useProjectStore } from '../store/useProjectStore';
import { BatchExportDialog } from './BatchExportDialog';

export function TopBar() {
  const project = useProjectStore((state) => state.project);
  const seed = useProjectStore((state) => state.project.seed);
  const layouts = useProjectStore((state) => state.project.layouts);
  const activeLayoutId = useProjectStore((state) => state.project.activeLayoutId);
  const activeLayout = layouts[activeLayoutId];
  const customExportSize = useProjectStore((state) => state.customExportSize);
  const setCustomExportSize = useProjectStore((state) => state.setCustomExportSize);
  const setActiveLayout = useProjectStore((state) => state.setActiveLayout);

  const newProject = useProjectStore((state) => state.newProject);
  const openProject = useProjectStore((state) => state.openProject);
  const saveProject = useProjectStore((state) => state.saveProject);
  const randomizeSeed = useProjectStore((state) => state.randomizeSeed);
  const variation = useProjectStore((state) => state.variation);
  const resetVariation = useProjectStore((state) => state.resetVariation);
  const hasVariationBase = useProjectStore((state) => state.lastVariationBase !== null);
  const createSnapshot = useProjectStore((state) => state.createSnapshot);
  const exportPNG = useProjectStore((state) => state.exportPNG);
  const exportBatch = useProjectStore((state) => state.exportBatch);

  const [selectedPreset, setSelectedPreset] = useState<ExportPresetId>('current-layout');
  const [isBatchDialogOpen, setBatchDialogOpen] = useState(false);

  return (
    <>
      <header className="top-bar">
        <div className="top-bar-section">
          <button type="button" onClick={newProject}>
            New
          </button>
          <button type="button" onClick={() => void openProject()}>
            Open
          </button>
          <button type="button" onClick={() => void saveProject()}>
            Save
          </button>
        </div>

        <div className="top-bar-section">
          <label className="inline-field" htmlFor="layout-preset">
            Layout
            <select
              id="layout-preset"
              value={activeLayoutId}
              onChange={(event) => setActiveLayout(event.target.value)}
            >
              {Object.values(layouts).map((layout) => (
                <option key={layout.id} value={layout.id}>
                  {layout.name}
                </option>
              ))}
            </select>
          </label>

          {activeLayout ? (
            <div className="seed-pill">
              {activeLayout.width}x{activeLayout.height}
            </div>
          ) : null}

          <label className="inline-field" htmlFor="export-preset">
            Export
            <select
              id="export-preset"
              value={selectedPreset}
              onChange={(event) => setSelectedPreset(event.target.value as ExportPresetId)}
            >
              {exportPresets.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.label}
                </option>
              ))}
            </select>
          </label>

          {selectedPreset === 'custom' ? (
            <>
              <label className="inline-field" htmlFor="custom-width">
                W
                <input
                  id="custom-width"
                  type="number"
                  min={1}
                  value={customExportSize.width}
                  onChange={(event) => setCustomExportSize({ width: Number(event.target.value) })}
                />
              </label>
              <label className="inline-field" htmlFor="custom-height">
                H
                <input
                  id="custom-height"
                  type="number"
                  min={1}
                  value={customExportSize.height}
                  onChange={(event) => setCustomExportSize({ height: Number(event.target.value) })}
                />
              </label>
            </>
          ) : null}

          <button type="button" onClick={() => void exportPNG(selectedPreset)}>
            Export PNG
          </button>
          <button type="button" onClick={() => setBatchDialogOpen(true)} disabled={project.snapshots.length === 0}>
            Batch Export
          </button>
        </div>

        <div className="top-bar-section">
          <div className="seed-pill">Seed: {seed}</div>
          <button type="button" onClick={randomizeSeed}>
            Randomize Seed
          </button>
          <button type="button" onClick={variation}>
            Variation
          </button>
          <button type="button" onClick={resetVariation} disabled={!hasVariationBase}>
            Reset Variation
          </button>
          <button type="button" onClick={createSnapshot}>
            Snapshot
          </button>
        </div>
      </header>

      <BatchExportDialog
        isOpen={isBatchDialogOpen}
        project={project}
        onClose={() => setBatchDialogOpen(false)}
        onExport={(selection) => exportBatch(selection)}
      />
    </>
  );
}
