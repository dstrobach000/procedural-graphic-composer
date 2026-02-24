import type { Scene } from 'three';
import { hashSeed } from '../rng/hash';
import { ImageLayer } from './ImageLayer';
import type { LayerInstance, RuntimeLayer } from './Layer';
import { ShaderLayer } from './ShaderLayer';

export class LayerFactory {
  private readonly scene: Scene;

  private readonly runtimeLayers = new Map<string, RuntimeLayer>();

  constructor(scene: Scene) {
    this.scene = scene;
  }

  async sync(layers: LayerInstance[], projectSeed: number): Promise<void> {
    const incomingIds = new Set(layers.map((layer) => layer.id));

    for (const [layerId, runtimeLayer] of this.runtimeLayers) {
      if (!incomingIds.has(layerId)) {
        this.scene.remove(runtimeLayer.mesh);
        runtimeLayer.dispose();
        this.runtimeLayers.delete(layerId);
      }
    }

    for (const [index, layer] of layers.entries()) {
      let runtimeLayer = this.runtimeLayers.get(layer.id);
      if (!runtimeLayer || runtimeLayer.kind !== layer.type) {
        if (runtimeLayer) {
          this.scene.remove(runtimeLayer.mesh);
          runtimeLayer.dispose();
        }
        runtimeLayer = layer.type === 'image' ? new ImageLayer(layer) : new ShaderLayer(layer);
        this.runtimeLayers.set(layer.id, runtimeLayer);
      }

      const seed = hashSeed(projectSeed, layer.seedOffset);
      await runtimeLayer.update(layer, seed);

      runtimeLayer.mesh.renderOrder = index;
      if (runtimeLayer.mesh.parent !== this.scene) {
        this.scene.add(runtimeLayer.mesh);
      }
    }
  }

  tick(timeSeconds: number, resolution: { width: number; height: number }): void {
    for (const runtimeLayer of this.runtimeLayers.values()) {
      runtimeLayer.tick?.(timeSeconds, resolution);
    }
  }

  dispose(): void {
    for (const runtimeLayer of this.runtimeLayers.values()) {
      this.scene.remove(runtimeLayer.mesh);
      runtimeLayer.dispose();
    }
    this.runtimeLayers.clear();
  }
}
