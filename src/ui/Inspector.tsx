import { useMemo } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import type { ShaderCompileValidationResult } from '../core/engine/Engine';
import { blendModes } from '../core/layers/Layer';
import type { LayerInstance, ShaderLayerInstance, ShaderUniform } from '../core/layers/Layer';
import { useProjectStore } from '../store/useProjectStore';
import { ShaderEditor } from './ShaderEditor';

export function Inspector() {
  const layers = useProjectStore((state) => state.project.layers);
  const effects = useProjectStore((state) => state.project.effectChain);
  const selectedLayerId = useProjectStore((state) => state.selectedLayerId);
  const updateLayer = useProjectStore((state) => state.updateLayer);
  const attemptUpdateShaderFragment = useProjectStore((state) => state.attemptUpdateShaderFragment);
  const addEffect = useProjectStore((state) => state.addEffect);
  const updateEffect = useProjectStore((state) => state.updateEffect);
  const removeEffect = useProjectStore((state) => state.removeEffect);

  const selectedLayer = useMemo(
    () => layers.find((layer) => layer.id === selectedLayerId) ?? null,
    [layers, selectedLayerId],
  );

  return (
    <aside className="panel inspector-panel">
      <div className="panel-header">
        <h2>Inspector</h2>
      </div>

      {selectedLayer ? (
        <div className="inspector-section">
          <h3>Layer</h3>
          <label>
            Name
            <input
              value={selectedLayer.name}
              onChange={(event) => updateLayer(selectedLayer.id, { name: event.target.value })}
            />
          </label>
          <label>
            Opacity
            <input
              type="number"
              min={0}
              max={1}
              step={0.01}
              value={selectedLayer.opacity}
              onChange={(event) =>
                updateLayer(selectedLayer.id, {
                  opacity: Number(event.target.value),
                })
              }
            />
          </label>
          <label>
            Blend Mode
            <select
              value={selectedLayer.blendMode}
              onChange={(event) =>
                updateLayer(selectedLayer.id, {
                  blendMode: event.target.value as LayerInstance['blendMode'],
                })
              }
            >
              {blendModes.map((mode) => (
                <option key={mode} value={mode}>
                  {mode}
                </option>
              ))}
            </select>
          </label>
          <label>
            Seed Offset
            <input
              type="number"
              step={1}
              value={selectedLayer.seedOffset}
              onChange={(event) => updateLayer(selectedLayer.id, { seedOffset: Number(event.target.value) })}
            />
          </label>

          <div className="inspector-grid">
            <label>
              X
              <input
                type="number"
                step={0.01}
                value={selectedLayer.transform.x}
                onChange={(event) =>
                  updateLayer(selectedLayer.id, {
                    transform: {
                      ...selectedLayer.transform,
                      x: Number(event.target.value),
                    },
                  })
                }
              />
            </label>
            <label>
              Y
              <input
                type="number"
                step={0.01}
                value={selectedLayer.transform.y}
                onChange={(event) =>
                  updateLayer(selectedLayer.id, {
                    transform: {
                      ...selectedLayer.transform,
                      y: Number(event.target.value),
                    },
                  })
                }
              />
            </label>
            <label>
              Scale
              <input
                type="number"
                min={0.01}
                step={0.01}
                value={selectedLayer.transform.scale}
                onChange={(event) =>
                  updateLayer(selectedLayer.id, {
                    transform: {
                      ...selectedLayer.transform,
                      scale: Number(event.target.value),
                    },
                  })
                }
              />
            </label>
            <label>
              Rotation
              <input
                type="number"
                step={0.01}
                value={selectedLayer.transform.rotation}
                onChange={(event) =>
                  updateLayer(selectedLayer.id, {
                    transform: {
                      ...selectedLayer.transform,
                      rotation: Number(event.target.value),
                    },
                  })
                }
              />
            </label>
          </div>

          {selectedLayer.type === 'image' ? (
            <ImageLayerInspector layer={selectedLayer} updateLayer={updateLayer} />
          ) : (
            <ShaderLayerInspector
              key={selectedLayer.id}
              layer={selectedLayer}
              updateLayer={updateLayer}
              attemptUpdateShaderFragment={attemptUpdateShaderFragment}
            />
          )}
        </div>
      ) : (
        <div className="inspector-empty">Select a layer to edit properties.</div>
      )}

      <div className="inspector-section">
        <h3>Effects</h3>
        <div className="panel-actions">
          <button type="button" onClick={() => addEffect('threshold')}>
            + Threshold
          </button>
          <button type="button" onClick={() => addEffect('grain')}>
            + Grain
          </button>
        </div>

        {effects.map((effect) => (
          <div key={effect.id} className="effect-card">
            <div className="effect-head">
              <strong>{effect.type}</strong>
              <button type="button" onClick={() => removeEffect(effect.id)}>
                Remove
              </button>
            </div>

            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={effect.enabled}
                onChange={(event) => updateEffect(effect.id, { enabled: event.target.checked })}
              />
              Enabled
            </label>

            <label>
              Seed Offset
              <input
                type="number"
                step={1}
                value={effect.seedOffset}
                onChange={(event) => updateEffect(effect.id, { seedOffset: Number(event.target.value) })}
              />
            </label>

            {Object.entries(effect.params).map(([key, value]) => (
              <label key={key}>
                {key}
                <input
                  type="number"
                  step={0.01}
                  value={value}
                  onChange={(event) =>
                    updateEffect(effect.id, {
                      params: {
                        [key]: Number(event.target.value),
                      },
                    })
                  }
                />
              </label>
            ))}
          </div>
        ))}
      </div>
    </aside>
  );
}

function ImageLayerInspector({
  layer,
  updateLayer,
}: {
  layer: Extract<LayerInstance, { type: 'image' }>;
  updateLayer: (id: string, patch: Partial<LayerInstance>) => void;
}) {
  return (
    <div className="inspector-section">
      <label>
        Source Path
        <input
          value={layer.params.src}
          onChange={(event) =>
            updateLayer(layer.id, {
              params: {
                ...layer.params,
                src: event.target.value,
              },
            } as Partial<LayerInstance>)
          }
        />
      </label>
      <button
        type="button"
        onClick={() => {
          void (async () => {
            const file = await open({
              multiple: false,
              directory: false,
              filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
            });
            if (!file || Array.isArray(file)) {
              return;
            }
            updateLayer(layer.id, {
              params: {
                ...layer.params,
                src: file,
              },
            } as Partial<LayerInstance>);
          })();
        }}
      >
        Browse Image
      </button>
    </div>
  );
}

function ShaderLayerInspector({
  layer,
  updateLayer,
  attemptUpdateShaderFragment,
}: {
  layer: ShaderLayerInstance;
  updateLayer: (id: string, patch: Partial<LayerInstance>) => void;
  attemptUpdateShaderFragment: (
    id: string,
    fragment: string,
  ) => Promise<ShaderCompileValidationResult>;
}) {
  const sizing = layer.params.sizing ?? { mode: 'fullscreen' as const };
  const setUniform = (uniformName: string, patch: Partial<ShaderUniform>) => {
    const current = layer.params.uniforms[uniformName];
    if (!current) {
      return;
    }
    updateLayer(layer.id, {
      params: {
        ...layer.params,
        uniforms: {
          ...layer.params.uniforms,
          [uniformName]: {
            ...current,
            ...patch,
          },
        },
      },
    } as Partial<LayerInstance>);
  };

  return (
    <div className="inspector-section">
      <label>
        Sizing Mode
        <select
          value={sizing.mode}
          onChange={(event) =>
            updateLayer(layer.id, {
              params: {
                ...layer.params,
                sizing:
                  event.target.value === 'custom'
                    ? {
                        mode: 'custom',
                        width: layer.params.sizing?.width ?? 300,
                        height: layer.params.sizing?.height ?? 300,
                      }
                    : { mode: 'fullscreen' },
              },
            } as Partial<LayerInstance>)
          }
        >
          <option value="fullscreen">Fullscreen</option>
          <option value="custom">Custom</option>
        </select>
      </label>

      {sizing.mode === 'custom' ? (
        <div className="inspector-grid">
          <label>
            Width
            <input
              type="number"
              min={1}
              step={1}
              value={sizing.width ?? 300}
              onChange={(event) =>
                updateLayer(layer.id, {
                  params: {
                    ...layer.params,
                    sizing: {
                      mode: 'custom',
                      width: Math.max(1, Number(event.target.value)),
                      height: sizing.height ?? 300,
                    },
                  },
                } as Partial<LayerInstance>)
              }
            />
          </label>
          <label>
            Height
            <input
              type="number"
              min={1}
              step={1}
              value={sizing.height ?? 300}
              onChange={(event) =>
                updateLayer(layer.id, {
                  params: {
                    ...layer.params,
                    sizing: {
                      mode: 'custom',
                      width: sizing.width ?? 300,
                      height: Math.max(1, Number(event.target.value)),
                    },
                  },
                } as Partial<LayerInstance>)
              }
            />
          </label>
        </div>
      ) : null}

      <label>Fragment Shader</label>
      <ShaderEditor
        fragment={layer.params.fragment}
        onApply={(fragment) => attemptUpdateShaderFragment(layer.id, fragment)}
      />

      <h4>Uniforms</h4>
      {Object.entries(layer.params.uniforms).map(([name, uniform]) => (
        <div key={name} className="uniform-card">
          <div className="uniform-head">
            <strong>{name}</strong>
            <button
              type="button"
              onClick={() => {
                const nextUniforms = { ...layer.params.uniforms };
                delete nextUniforms[name];
                updateLayer(layer.id, {
                  params: {
                    ...layer.params,
                    uniforms: nextUniforms,
                  },
                } as Partial<LayerInstance>);
              }}
            >
              Remove
            </button>
          </div>

          {uniform.min !== undefined && uniform.max !== undefined ? (
            <input
              type="range"
              min={uniform.min}
              max={uniform.max}
              step={uniform.step ?? 0.01}
              value={uniform.value}
              onChange={(event) => setUniform(name, { value: Number(event.target.value) })}
            />
          ) : null}

          <label>
            Value
            <input
              type="number"
              step={uniform.step ?? 0.01}
              value={uniform.value}
              onChange={(event) => setUniform(name, { value: Number(event.target.value) })}
            />
          </label>

          <div className="inspector-grid">
            <label>
              Min
              <input
                type="number"
                value={uniform.min ?? ''}
                onChange={(event) => setUniform(name, { min: toNumberOrUndefined(event.target.value) })}
              />
            </label>
            <label>
              Max
              <input
                type="number"
                value={uniform.max ?? ''}
                onChange={(event) => setUniform(name, { max: toNumberOrUndefined(event.target.value) })}
              />
            </label>
            <label>
              Step
              <input
                type="number"
                min={0.0001}
                step={0.0001}
                value={uniform.step ?? ''}
                onChange={(event) => setUniform(name, { step: toNumberOrUndefined(event.target.value) })}
              />
            </label>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={uniform.randomizable ?? false}
                onChange={(event) => setUniform(name, { randomizable: event.target.checked })}
              />
              Randomizable
            </label>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={() => {
          const uniformName = window.prompt('Uniform name (for example: u_amount)');
          if (!uniformName) {
            return;
          }
          updateLayer(layer.id, {
            params: {
              ...layer.params,
              uniforms: {
                ...layer.params.uniforms,
                [uniformName]: {
                  value: 0,
                  step: 0.01,
                },
              },
            },
          } as Partial<LayerInstance>);
        }}
      >
        Add Uniform
      </button>
    </div>
  );
}

function toNumberOrUndefined(value: string): number | undefined {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }
  return parsed;
}
