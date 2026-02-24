import { convertFileSrc } from '@tauri-apps/api/core';
import * as opentype from 'opentype.js';
import {
  BufferGeometry,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Shape,
  ShapeGeometry,
  ShapePath,
} from 'three';
import type { LayerInstance, LayerTransform, RuntimeLayer, TextLayerInstance } from './Layer';
import { toThreeBlending } from './Layer';

const fontPromiseCache = new Map<string, Promise<opentype.Font>>();

export class TextLayer implements RuntimeLayer {
  id: string;

  kind: LayerInstance['type'] = 'text';

  mesh: Mesh;

  private material: MeshBasicMaterial;

  private rebuildKey = '';

  private buildToken = 0;

  private ready = false;

  private hasGeometry = false;

  constructor(layer: TextLayerInstance) {
    this.id = layer.id;
    this.material = new MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: layer.opacity,
      depthWrite: false,
      side: DoubleSide,
    });
    this.mesh = new Mesh(new PlaneGeometry(1, 1), this.material);
    this.mesh.visible = false;
  }

  async update(layer: LayerInstance, _seed: number): Promise<void> {
    void _seed;
    if (layer.type !== 'text') {
      return;
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

    const nextKey = toRebuildKey(layer);
    if (nextKey !== this.rebuildKey) {
      const token = ++this.buildToken;
      this.ready = false;
      try {
        const font = await loadFont(layer.params.fontPath);
        const geometry = buildTextGeometry(font, layer.params);
        if (token !== this.buildToken) {
          geometry.dispose();
        } else {
          const previous = this.mesh.geometry;
          this.mesh.geometry = geometry;
          previous.dispose();
          this.hasGeometry = hasRenderableGeometry(geometry);
          this.rebuildKey = nextKey;
        }
      } catch (error) {
        if (token === this.buildToken) {
          this.ready = true;
        }
        throw error;
      }
      if (token === this.buildToken) {
        this.ready = true;
      }
    }

    this.applyTransform(layer.transform);
    this.mesh.visible = layer.visible && this.hasGeometry;
  }

  isReady(): boolean {
    return this.ready;
  }

  applyRuntimePatch(patch: { transform?: LayerTransform }): void {
    if (!patch.transform || !this.mesh.visible) {
      return;
    }
    this.applyTransform(patch.transform);
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }

  private applyTransform(transform: LayerTransform): void {
    this.mesh.position.set(transform.x, transform.y, 0);
    this.mesh.rotation.z = transform.rotation;

    const scale = Math.max(0.0001, transform.scale);
    this.mesh.scale.set(scale, scale, 1);
  }
}

async function loadFont(fontPath: string): Promise<opentype.Font> {
  const source = resolveFontSource(fontPath);
  const cached = fontPromiseCache.get(source);
  if (cached) {
    return cached;
  }

  const promise = opentype.load(source).catch((error: unknown) => {
    fontPromiseCache.delete(source);
    throw new Error(`Failed to load font "${fontPath}": ${toErrorMessage(error)}`);
  });
  fontPromiseCache.set(source, promise);
  return promise;
}

function resolveFontSource(fontPath: string): string {
  const trimmed = fontPath.trim();
  if (trimmed.length === 0) {
    throw new Error('Font path is required for text layers.');
  }

  if (
    trimmed.startsWith('/') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('file://')
  ) {
    return trimmed;
  }

  return convertFileSrc(trimmed);
}

function buildTextGeometry(font: opentype.Font, params: TextLayerInstance['params']): BufferGeometry {
  const fontSize = Math.max(1, params.fontSize);
  const letterSpacing = Number.isFinite(params.letterSpacing) ? params.letterSpacing : 0;
  const scale = fontSize / Math.max(1, font.unitsPerEm);
  let penX = 0;
  const allShapes: Shape[] = [];

  for (const character of params.text) {
    const glyph = font.charToGlyph(character);
    const path = glyph.getPath(penX, 0, fontSize);
    const shapePath = new ShapePath();

    for (const command of path.commands) {
      switch (command.type) {
        case 'M':
          shapePath.moveTo(command.x, command.y);
          break;
        case 'L':
          shapePath.lineTo(command.x, command.y);
          break;
        case 'Q':
          shapePath.quadraticCurveTo(command.x1, command.y1, command.x, command.y);
          break;
        case 'C':
          shapePath.bezierCurveTo(command.x1, command.y1, command.x2, command.y2, command.x, command.y);
          break;
        case 'Z':
          shapePath.currentPath?.closePath();
          break;
        default:
          break;
      }
    }

    allShapes.push(...shapePath.toShapes(true));
    const advance = glyph.advanceWidth ?? font.unitsPerEm;
    penX += advance * scale + letterSpacing;
  }

  if (allShapes.length === 0) {
    return new BufferGeometry();
  }

  const geometry = new ShapeGeometry(allShapes);
  geometry.scale(1, -1, 1);
  geometry.computeBoundingBox();
  return geometry;
}

function hasRenderableGeometry(geometry: BufferGeometry): boolean {
  const position = geometry.getAttribute('position');
  return Boolean(position && position.count > 0);
}

function toRebuildKey(layer: TextLayerInstance): string {
  return [
    layer.params.text,
    layer.params.fontPath,
    layer.params.fontSize,
    layer.params.letterSpacing,
  ].join('|');
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
