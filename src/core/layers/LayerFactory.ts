import type { Scene } from 'three';
import { hashSeed } from '../rng/hash';
import { mulberry32, type Rng } from '../rng/prng';
import {
  compileLayerScript,
  normalizeLayerScriptPatch,
  type LayerScriptPatch,
  type LayerScriptRunner,
} from '../scripts/layerScript';
import { ImageLayer } from './ImageLayer';
import type { LayerInstance, RuntimeLayer } from './Layer';
import { ShaderLayer } from './ShaderLayer';
import { TextLayer } from './TextLayer';

type LayerBinding = {
  layer: LayerInstance;
  projectSeed: number;
  layerSeed: number;
  scriptRuntime: LayerScriptRuntime | null;
};

type LayerScriptRuntime = {
  runner: LayerScriptRunner;
  random: Rng;
  halted: boolean;
};

export class LayerFactory {
  private readonly scene: Scene;

  private readonly runtimeLayers = new Map<string, RuntimeLayer>();

  private readonly layerBindings = new Map<string, LayerBinding>();

  private orderedLayerIds: string[] = [];

  constructor(scene: Scene) {
    this.scene = scene;
  }

  async sync(layers: LayerInstance[], projectSeed: number): Promise<void> {
    const incomingIds = new Set(layers.map((layer) => layer.id));
    this.orderedLayerIds = layers.map((layer) => layer.id);

    for (const [layerId, runtimeLayer] of this.runtimeLayers) {
      if (!incomingIds.has(layerId)) {
        this.scene.remove(runtimeLayer.mesh);
        runtimeLayer.dispose();
        this.runtimeLayers.delete(layerId);
        this.layerBindings.delete(layerId);
      }
    }

    for (const [index, layer] of layers.entries()) {
      let runtimeLayer = this.runtimeLayers.get(layer.id);
      if (!runtimeLayer || runtimeLayer.kind !== layer.type) {
        if (runtimeLayer) {
          this.scene.remove(runtimeLayer.mesh);
          runtimeLayer.dispose();
        }
        runtimeLayer = createRuntimeLayer(layer);
        this.runtimeLayers.set(layer.id, runtimeLayer);
      }

      const seed = hashSeed(projectSeed, layer.seedOffset);
      await runtimeLayer.update(layer, seed);
      this.layerBindings.set(layer.id, {
        layer,
        projectSeed,
        layerSeed: seed,
        scriptRuntime: buildScriptRuntime(layer, seed),
      });

      runtimeLayer.mesh.renderOrder = index;
      if (runtimeLayer.mesh.parent !== this.scene) {
        this.scene.add(runtimeLayer.mesh);
      }
    }
  }

  tick(timeSeconds: number, resolution: { width: number; height: number }): void {
    const frame = Math.floor(Math.max(0, timeSeconds) * 60);
    for (const runtimeLayer of this.runtimeLayers.values()) {
      runtimeLayer.tick?.(timeSeconds, resolution);
    }

    for (const layerId of this.orderedLayerIds) {
      const runtimeLayer = this.runtimeLayers.get(layerId);
      const binding = this.layerBindings.get(layerId);
      if (!runtimeLayer || !binding) {
        continue;
      }

      const scriptRuntime = binding.scriptRuntime;
      if (!scriptRuntime || scriptRuntime.halted) {
        continue;
      }

      const context = createScriptContext(binding, frame, timeSeconds, scriptRuntime.random);
      try {
        const result = scriptRuntime.runner(context);
        const normalizedPatch = normalizeLayerScriptPatch(result);
        const patch = resolveRuntimePatch(binding.layer, normalizedPatch);
        if (patch) {
          runtimeLayer.applyRuntimePatch?.(patch);
        }
      } catch (error) {
        scriptRuntime.halted = true;
        // Script errors should not crash rendering or mutate store state.
        console.error(`Layer script runtime error (${binding.layer.name}):`, error);
      }
    }
  }

  areAllReady(): boolean {
    for (const runtimeLayer of this.runtimeLayers.values()) {
      if (!runtimeLayer.isReady()) {
        return false;
      }
    }
    return true;
  }

  async waitUntilReady(timeoutMs = 8000): Promise<void> {
    if (this.areAllReady()) {
      return;
    }

    const startedAt = performance.now();
    while (!this.areAllReady()) {
      if (performance.now() - startedAt > timeoutMs) {
        throw new Error('Timed out waiting for runtime layers to become ready.');
      }
      await sleep(16);
    }
  }

  dispose(): void {
    for (const runtimeLayer of this.runtimeLayers.values()) {
      this.scene.remove(runtimeLayer.mesh);
      runtimeLayer.dispose();
    }
    this.runtimeLayers.clear();
    this.layerBindings.clear();
    this.orderedLayerIds = [];
  }
}

function createRuntimeLayer(layer: LayerInstance): RuntimeLayer {
  switch (layer.type) {
    case 'image':
      return new ImageLayer(layer);
    case 'shader':
      return new ShaderLayer(layer);
    case 'text':
      return new TextLayer(layer);
    default:
      throw new Error(`Unsupported layer type: ${(layer as { type: string }).type}`);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildScriptRuntime(layer: LayerInstance, layerSeed: number): LayerScriptRuntime | null {
  if (!layer.script?.enabled) {
    return null;
  }

  const source = layer.script.source.trim();
  if (source.length === 0) {
    return null;
  }

  try {
    return {
      runner: compileLayerScript(source),
      random: mulberry32(layerSeed),
      halted: false,
    };
  } catch (error) {
    console.error(`Layer script compile error (${layer.name}):`, error);
    return null;
  }
}

function createScriptContext(
  binding: LayerBinding,
  frame: number,
  time: number,
  random: Rng,
) {
  const uniforms = Object.freeze(extractUniformValues(binding.layer));
  const transform = Object.freeze({ ...binding.layer.transform });

  return Object.freeze({
    time,
    frame,
    seed: binding.layerSeed,
    projectSeed: binding.projectSeed,
    layerSeed: binding.layerSeed,
    random,
    uniforms,
    transform,
  });
}

function resolveRuntimePatch(
  layer: LayerInstance,
  patch: LayerScriptPatch | null,
): { transform?: LayerInstance['transform']; uniforms?: Record<string, number> } | null {
  if (!patch) {
    return null;
  }

  const result: { transform?: LayerInstance['transform']; uniforms?: Record<string, number> } = {};

  if (patch.transform) {
    result.transform = {
      ...layer.transform,
      ...patch.transform,
      scale:
        typeof patch.transform.scale === 'number'
          ? Math.max(0.0001, patch.transform.scale)
          : Math.max(0.0001, layer.transform.scale),
    };
  }

  if (layer.type === 'shader') {
    const base = extractUniformValues(layer);
    const merged = { ...base };
    if (patch.uniforms) {
      for (const [name, value] of Object.entries(patch.uniforms)) {
        if (!(name in base)) {
          continue;
        }
        if (typeof value === 'number' && Number.isFinite(value)) {
          merged[name] = value;
        }
      }
    }
    result.uniforms = merged;
  }

  return Object.keys(result).length > 0 ? result : null;
}

function extractUniformValues(layer: LayerInstance): Record<string, number> {
  if (layer.type !== 'shader') {
    return {};
  }

  return Object.fromEntries(
    Object.entries(layer.params.uniforms).map(([name, meta]) => [name, meta.value]),
  );
}
