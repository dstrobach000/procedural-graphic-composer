import { useMemo, useState } from 'react';
import { useProjectStore } from '../store/useProjectStore';

export function LayerPanel() {
  const layers = useProjectStore((state) => state.project.layers);
  const selectedLayerId = useProjectStore((state) => state.selectedLayerId);
  const selectLayer = useProjectStore((state) => state.selectLayer);
  const reorderLayer = useProjectStore((state) => state.reorderLayer);
  const addLayer = useProjectStore((state) => state.addLayer);
  const removeLayer = useProjectStore((state) => state.removeLayer);
  const updateLayer = useProjectStore((state) => state.updateLayer);

  const [draggedLayerId, setDraggedLayerId] = useState<string | null>(null);

  const selectedLayer = useMemo(
    () => layers.find((layer) => layer.id === selectedLayerId) ?? null,
    [layers, selectedLayerId],
  );

  return (
    <aside className="panel layer-panel">
      <div className="panel-header">
        <h2>Layers</h2>
      </div>

      <div className="panel-actions">
        <button type="button" onClick={() => addLayer('image')}>
          + Image
        </button>
        <button type="button" onClick={() => addLayer('text')}>
          + Text
        </button>
        <button type="button" onClick={() => addLayer('shader')}>
          + Shader
        </button>
        <button
          type="button"
          onClick={() => {
            if (selectedLayer) {
              removeLayer(selectedLayer.id);
            }
          }}
          disabled={!selectedLayer}
        >
          Delete
        </button>
      </div>

      <ul className="layer-list">
        {layers.map((layer, index) => (
          <li
            key={layer.id}
            className={layer.id === selectedLayerId ? 'layer-item selected' : 'layer-item'}
            draggable
            onDragStart={() => setDraggedLayerId(layer.id)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              if (!draggedLayerId || draggedLayerId === layer.id) {
                return;
              }
              const from = layers.findIndex((entry) => entry.id === draggedLayerId);
              const to = index;
              reorderLayer(from, to);
              setDraggedLayerId(null);
            }}
            onClick={() => selectLayer(layer.id)}
          >
            <button
              type="button"
              className="visibility-toggle"
              onClick={(event) => {
                event.stopPropagation();
                updateLayer(layer.id, { visible: !layer.visible });
              }}
            >
              {layer.visible ? 'ON' : 'OFF'}
            </button>
            <span className="layer-name">{layer.name}</span>
            <span className="layer-kind">{layer.type}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}
