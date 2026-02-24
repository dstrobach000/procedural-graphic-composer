import { convertFileSrc } from '@tauri-apps/api/core';
import { Mesh, MeshBasicMaterial, PlaneGeometry, TextureLoader, Vector2 } from 'three';
import type { ImageLayerInstance, LayerInstance, LayerTransform, RuntimeLayer } from './Layer';
import { toThreeBlending } from './Layer';

const textureLoader = new TextureLoader();

export class ImageLayer implements RuntimeLayer {
  id: string;

  kind: LayerInstance['type'] = 'image';

  mesh: Mesh;

  private material: MeshBasicMaterial;

  private currentSource = '';

  private intrinsicSize = new Vector2(256, 256);

  constructor(layer: ImageLayerInstance) {
    this.id = layer.id;
    this.material = new MeshBasicMaterial({
      transparent: true,
      opacity: layer.opacity,
      depthWrite: false,
    });
    this.mesh = new Mesh(new PlaneGeometry(1, 1), this.material);
  }

  async update(layer: LayerInstance, _seed: number): Promise<void> {
    void _seed;
    if (layer.type !== 'image') {
      return;
    }

    if (this.currentSource !== layer.params.src) {
      this.currentSource = layer.params.src;
      if (this.currentSource.trim().length === 0) {
        this.material.map = null;
        this.intrinsicSize.set(256, 256);
      } else {
        const texture = await textureLoader.loadAsync(convertFileSrc(this.currentSource));
        texture.needsUpdate = true;
        this.material.map = texture;

        const image = texture.image as { width?: number; height?: number } | undefined;
        const width = Math.max(1, image?.width ?? 256);
        const height = Math.max(1, image?.height ?? 256);
        this.intrinsicSize.set(width, height);
      }
      this.material.needsUpdate = true;
    }

    this.material.opacity = layer.opacity;
    const blending = toThreeBlending(layer.blendMode);
    this.material.blending = blending.blending;
    if (blending.blendSrc !== undefined) {
      this.material.blendSrc = blending.blendSrc;
    }
    if (blending.blendDst !== undefined) {
      this.material.blendDst = blending.blendDst;
    }

    this.mesh.visible = layer.visible;
    this.applyTransform(layer.transform);
  }

  dispose(): void {
    if (this.material.map) {
      this.material.map.dispose();
    }
    this.mesh.geometry.dispose();
    this.material.dispose();
  }

  isReady(): boolean {
    return true;
  }

  applyRuntimePatch(patch: { transform?: LayerTransform }): void {
    if (!patch.transform) {
      return;
    }
    this.applyTransform(patch.transform);
  }

  private applyTransform(transform: LayerTransform): void {
    this.mesh.position.set(transform.x, transform.y, 0);
    this.mesh.rotation.z = transform.rotation;

    const scale = Math.max(0.0001, transform.scale);
    this.mesh.scale.set(this.intrinsicSize.x * scale, this.intrinsicSize.y * scale, 1);
  }
}
