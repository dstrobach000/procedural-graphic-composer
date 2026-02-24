import { nanoid } from 'nanoid';
import { create } from 'zustand';
import { exportBatch as exportBatchFiles } from '../core/export/exportBatch';
import type {
  Engine,
  ScriptCompileValidationResult,
  ShaderCompileValidationResult,
} from '../core/engine/Engine';
import { exportPNG as exportPNGFile } from '../core/export/exportPNG';
import type { ExportPresetId } from '../core/export/presets';
import { getPresetById } from '../core/export/presets';
import type { LayerInstance } from '../core/layers/Layer';
import { defaultTextFontPath } from '../core/layers/textFonts';
import { defaultShaderFragment, createDefaultProject } from '../core/project/defaults';
import { loadProjectFromDisk, saveProjectToDisk } from '../core/project/io';
import type { EffectInstance, Project } from '../core/project/schema';
import { nextDeterministicSeed } from '../core/rng/prng';
import { applyActiveLayout } from './layouts';
import { applySnapshot, cloneProject, createSnapshot, reorderLayers } from './projectStateUtils';
import { buildVariationProject } from './variation';

export type Notification = {
  id: string;
  level: 'info' | 'error';
  message: string;
};

type ExportCustomSize = {
  width: number;
  height: number;
};

type BatchExportSelection = {
  snapshotIds: string[];
  layoutIds: string[];
  directory: string;
};

type ProjectState = {
  project: Project;
  lastVariationBase: Project | null;
  selectedLayerId: string | null;
  engine: Engine | null;
  customExportSize: ExportCustomSize;
  notifications: Notification[];
  setEngine(engine: Engine | null): void;
  dismissNotification(id: string): void;
  notify(message: string, level?: Notification['level']): void;
  newProject(): void;
  openProject(): Promise<void>;
  saveProject(): Promise<void>;
  addLayer(type: LayerInstance['type']): void;
  removeLayer(id: string): void;
  reorderLayer(fromIndex: number, toIndex: number): void;
  selectLayer(id: string | null): void;
  updateLayer(id: string, patch: Partial<LayerInstance>): void;
  attemptUpdateShaderFragment(id: string, fragment: string): Promise<ShaderCompileValidationResult>;
  attemptUpdateLayerScript(id: string, source: string): Promise<ScriptCompileValidationResult>;
  addEffect(type: EffectInstance['type']): void;
  updateEffect(id: string, patch: Partial<EffectInstance>): void;
  removeEffect(id: string): void;
  setActiveLayout(layoutId: string): void;
  randomizeSeed(): void;
  variation(): void;
  resetVariation(): void;
  createSnapshot(): void;
  loadSnapshot(snapshotId: string): void;
  setCustomExportSize(size: Partial<ExportCustomSize>): void;
  exportPNG(presetId: ExportPresetId): Promise<void>;
  exportBatch(selection: BatchExportSelection): Promise<void>;
};

function pushNotification(state: ProjectState, notification: Notification): Notification[] {
  const next = [notification, ...state.notifications];
  return next.slice(0, 8);
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  project: createDefaultProject(),
  lastVariationBase: null,
  selectedLayerId: null,
  engine: null,
  customExportSize: {
    width: 1080,
    height: 1350,
  },
  notifications: [],

  setEngine(engine) {
    set({ engine });
  },

  dismissNotification(id) {
    set((state) => ({
      notifications: state.notifications.filter((notification) => notification.id !== id),
    }));
  },

  notify(message, level = 'info') {
    set((state) => ({
      notifications: pushNotification(state, {
        id: nanoid(),
        level,
        message,
      }),
    }));
  },

  newProject() {
    const nextProject = createDefaultProject();
    set({
      project: nextProject,
      lastVariationBase: null,
      selectedLayerId: nextProject.layers[0]?.id ?? null,
    });
    get().notify('Started a new project');
  },

  async openProject() {
    try {
      const loaded = await loadProjectFromDisk();
      if (!loaded) {
        return;
      }
      set({
        project: loaded,
        lastVariationBase: null,
        selectedLayerId: loaded.layers[0]?.id ?? null,
      });
      get().notify('Project loaded');
    } catch (error) {
      get().notify(`Failed to open project: ${toErrorMessage(error)}`, 'error');
    }
  },

  async saveProject() {
    try {
      const project = get().project;
      const path = await saveProjectToDisk(project);
      if (!path) {
        return;
      }
      get().notify(`Project saved: ${path}`);
    } catch (error) {
      get().notify(`Failed to save project: ${toErrorMessage(error)}`, 'error');
    }
  },

  addLayer(type) {
    const layer: LayerInstance = createLayer(type);

    set((state) => ({
      project: {
        ...state.project,
        layers: [...state.project.layers, layer],
      },
      lastVariationBase: null,
      selectedLayerId: layer.id,
    }));
  },

  removeLayer(id) {
    set((state) => {
      const layers = state.project.layers.filter((layer) => layer.id !== id);
      return {
        project: {
          ...state.project,
          layers,
        },
        lastVariationBase: null,
        selectedLayerId: state.selectedLayerId === id ? layers[0]?.id ?? null : state.selectedLayerId,
      };
    });
  },

  reorderLayer(fromIndex, toIndex) {
    set((state) => ({
      project: {
        ...state.project,
        layers: reorderLayers(state.project.layers, fromIndex, toIndex),
      },
      lastVariationBase: null,
    }));
  },

  selectLayer(id) {
    set({ selectedLayerId: id });
  },

  updateLayer(id, patch) {
    set((state) => ({
      project: {
        ...state.project,
        layers: state.project.layers.map((layer) => {
          if (layer.id !== id) {
            return layer;
          }
          return {
            ...layer,
            ...patch,
          } as LayerInstance;
        }),
      },
      lastVariationBase: null,
    }));
  },

  async attemptUpdateShaderFragment(id, fragment) {
    const state = get();
    const layer = state.project.layers.find((entry) => entry.id === id);
    if (!layer || layer.type !== 'shader') {
      return {
        ok: false,
        error: 'Selected layer is not a shader layer.',
      };
    }

    if (!state.engine) {
      return {
        ok: false,
        error: 'Renderer is not ready yet.',
      };
    }

    const compileResult = state.engine.validateShaderFragment(fragment);
    if (!compileResult.ok) {
      state.notify(`Shader compile failed: ${compileResult.error}`, 'error');
      return compileResult;
    }

    set((current) => ({
      project: {
        ...current.project,
        layers: current.project.layers.map((entry) => {
          if (entry.id !== id || entry.type !== 'shader') {
            return entry;
          }
          return {
            ...entry,
            params: {
              ...entry.params,
              fragment,
            },
          };
        }),
      },
      lastVariationBase: null,
    }));

    state.notify('Shader compiled and applied');
    return { ok: true };
  },

  async attemptUpdateLayerScript(id, source) {
    const state = get();
    const layer = state.project.layers.find((entry) => entry.id === id);
    if (!layer) {
      return {
        ok: false,
        error: 'Selected layer does not exist.',
      };
    }

    if (!state.engine) {
      return {
        ok: false,
        error: 'Renderer is not ready yet.',
      };
    }

    const compileResult = state.engine.validateLayerScript(source);
    if (!compileResult.ok) {
      state.notify(`Script compile failed: ${compileResult.error}`, 'error');
      return compileResult;
    }

    set((current) => ({
      project: {
        ...current.project,
        layers: current.project.layers.map((entry) => {
          if (entry.id !== id) {
            return entry;
          }
          return {
            ...entry,
            script: {
              enabled: entry.script?.enabled ?? false,
              source,
            },
          };
        }),
      },
      lastVariationBase: null,
    }));

    state.notify('Script compiled and applied');
    return { ok: true };
  },

  addEffect(type) {
    const effect: EffectInstance = {
      id: nanoid(),
      type,
      enabled: false,
      seedOffset: 0,
      params: type === 'threshold' ? { cutoff: 0.5, softness: 0.08 } : { amount: 0.08, size: 1 },
    };

    set((state) => ({
      project: {
        ...state.project,
        effectChain: [...state.project.effectChain, effect],
      },
      lastVariationBase: null,
    }));
  },

  updateEffect(id, patch) {
    set((state) => ({
      project: {
        ...state.project,
        effectChain: state.project.effectChain.map((effect) => {
          if (effect.id !== id) {
            return effect;
          }
          return {
            ...effect,
            ...patch,
            params: {
              ...effect.params,
              ...(patch.params ?? {}),
            },
          };
        }),
      },
      lastVariationBase: null,
    }));
  },

  removeEffect(id) {
    set((state) => ({
      project: {
        ...state.project,
        effectChain: state.project.effectChain.filter((effect) => effect.id !== id),
      },
      lastVariationBase: null,
    }));
  },

  setActiveLayout(layoutId) {
    set((state) => {
      const nextProject = applyActiveLayout(state.project, layoutId);
      if (nextProject === state.project) {
        return state;
      }

      return {
        project: nextProject,
        lastVariationBase: null,
      };
    });
  },

  randomizeSeed() {
    set((state) => ({
      project: {
        ...state.project,
        seed: nextDeterministicSeed(state.project.seed),
      },
      lastVariationBase: null,
    }));
  },

  variation() {
    let appliedSeed = 0;
    set((state) => {
      const base = state.lastVariationBase ? cloneProject(state.lastVariationBase) : cloneProject(state.project);
      const nextSeed = nextDeterministicSeed(state.project.seed);
      appliedSeed = nextSeed;
      const nextProject = buildVariationProject(base, nextSeed);

      return {
        project: nextProject,
        lastVariationBase: state.lastVariationBase ?? base,
      };
    });
    get().notify(`Variation applied (seed ${appliedSeed})`);
  },

  resetVariation() {
    const base = get().lastVariationBase;
    if (!base) {
      get().notify('Variation base is not set');
      return;
    }

    set({
      project: cloneProject(base),
      lastVariationBase: null,
      selectedLayerId: base.layers[0]?.id ?? null,
    });
    get().notify('Variation reset');
  },

  createSnapshot() {
    set((state) => ({
      project: {
        ...state.project,
        snapshots: [createSnapshot(state.project), ...state.project.snapshots],
      },
      lastVariationBase: null,
    }));
    get().notify('Snapshot saved');
  },

  loadSnapshot(snapshotId) {
    set((state) => {
      const snapshot = state.project.snapshots.find((entry) => entry.id === snapshotId);
      if (!snapshot) {
        return state;
      }
      const restored = applySnapshot(state.project, snapshot);
      return {
        project: restored,
        lastVariationBase: null,
        selectedLayerId: restored.layers[0]?.id ?? null,
      };
    });
    get().notify('Snapshot loaded');
  },

  setCustomExportSize(size) {
    set((state) => ({
      customExportSize: {
        width: size.width ?? state.customExportSize.width,
        height: size.height ?? state.customExportSize.height,
      },
    }));
  },

  async exportPNG(presetId) {
    try {
      const { engine, customExportSize, project } = get();
      if (!engine) {
        throw new Error('Renderer is not ready yet.');
      }

      await engine.syncProject(project);

      const size =
        presetId === 'custom'
          ? {
              width: Math.max(1, Math.floor(customExportSize.width)),
              height: Math.max(1, Math.floor(customExportSize.height)),
            }
          : presetId === 'current-layout'
            ? {
                width: Math.max(1, Math.floor(project.canvas.width)),
                height: Math.max(1, Math.floor(project.canvas.height)),
              }
          : {
              width: getPresetById(presetId).width,
              height: getPresetById(presetId).height,
            };

      const path = await exportPNGFile(engine, size);
      if (path) {
        get().notify(`PNG exported: ${path}`);
      }
    } catch (error) {
      get().notify(`Failed to export PNG: ${toErrorMessage(error)}`, 'error');
    }
  },

  async exportBatch(selection) {
    try {
      const { engine, project } = get();
      if (!engine) {
        throw new Error('Renderer is not ready yet.');
      }

      await engine.syncProject(project);

      const result = await exportBatchFiles(engine, cloneProject(project), {
        snapshotIds: selection.snapshotIds,
        layoutIds: selection.layoutIds,
        directory: selection.directory,
        format: 'png',
      });

      get().notify(`Batch export complete: ${result.written} files`);
    } catch (error) {
      get().notify(`Failed to export batch: ${toErrorMessage(error)}`, 'error');
    }
  },
}));

export function getClonedProject(): Project {
  return cloneProject(useProjectStore.getState().project);
}

function createLayer(type: LayerInstance['type']): LayerInstance {
  switch (type) {
    case 'image':
      return {
        id: nanoid(),
        type: 'image',
        name: 'Image Layer',
        visible: true,
        blendMode: 'normal',
        opacity: 1,
        transform: { x: 0, y: 0, scale: 1, rotation: 0 },
        seedOffset: 0,
        script: {
          enabled: false,
          source: '',
        },
        params: { src: '' },
      };
    case 'text':
      return {
        id: nanoid(),
        type: 'text',
        name: 'Text Layer',
        visible: true,
        blendMode: 'normal',
        opacity: 1,
        transform: { x: 0, y: 0, scale: 1, rotation: 0 },
        seedOffset: 0,
        script: {
          enabled: false,
          source: '',
        },
        params: {
          text: 'HELLO',
          fontPath: defaultTextFontPath,
          fontSize: 180,
          letterSpacing: 0,
        },
      };
    case 'shader':
    default:
      return {
        id: nanoid(),
        type: 'shader',
        name: 'Shader Layer',
        visible: true,
        blendMode: 'normal',
        opacity: 1,
        transform: { x: 0, y: 0, scale: 1, rotation: 0 },
        seedOffset: 0,
        script: {
          enabled: false,
          source: '',
        },
        params: {
          fragment: defaultShaderFragment,
          uniforms: {
            u_intensity: {
              value: 0.35,
              min: 0,
              max: 1,
              step: 0.01,
              randomizable: true,
            },
          },
          sizing: { mode: 'fullscreen' },
        },
      };
  }
}
