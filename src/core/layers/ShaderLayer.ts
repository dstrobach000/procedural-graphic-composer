import { Mesh, PlaneGeometry, ShaderMaterial, Vector2 } from 'three';
import type { LayerInstance, RuntimeLayer, ShaderLayerInstance, ShaderUniformMap } from './Layer';
import { toThreeBlending } from './Layer';

const vertexShader = `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fallbackFragment = `
precision highp float;

varying vec2 vUv;
uniform float uSeed;
uniform float uTime;
uniform vec2 uResolution;

void main() {
  float wave = 0.5 + 0.5 * sin((vUv.x + vUv.y + uTime * 0.15) * 12.0 + uSeed * 0.0001);
  gl_FragColor = vec4(vec3(wave), 1.0);
}
`;

const RESERVED_UNIFORMS = new Set([
  'uSeed',
  'uTime',
  'uFrame',
  'uResolution',
  'uLayerSize',
  'uLayerPos',
  'u_seed',
  'u_time',
  'u_frame',
  'u_resolution',
  'u_layer_size',
  'u_layer_pos',
]);

export class ShaderLayer implements RuntimeLayer {
  id: string;

  kind: LayerInstance['type'] = 'shader';

  mesh: Mesh;

  private material: ShaderMaterial;

  private lastFragment = '';

  private currentLayerRef: ShaderLayerInstance | null = null;

  private resolution = new Vector2(1, 1);

  constructor(layer: ShaderLayerInstance) {
    this.id = layer.id;
    this.material = new ShaderMaterial({
      vertexShader,
      fragmentShader: layer.params.fragment || fallbackFragment,
      uniforms: {
        uSeed: { value: 0 },
        uTime: { value: 0 },
        uFrame: { value: 0 },
        uResolution: { value: new Vector2(1, 1) },
        uLayerSize: { value: new Vector2(1, 1) },
        uLayerPos: { value: new Vector2(0, 0) },
        u_seed: { value: 0 },
        u_time: { value: 0 },
        u_frame: { value: 0 },
        u_resolution: { value: new Vector2(1, 1) },
        u_layer_size: { value: new Vector2(1, 1) },
        u_layer_pos: { value: new Vector2(0, 0) },
      },
      transparent: true,
      depthWrite: false,
    });
    this.mesh = new Mesh(new PlaneGeometry(1, 1), this.material);
  }

  update(layer: LayerInstance, seed: number): void {
    if (layer.type !== 'shader') {
      return;
    }

    this.currentLayerRef = layer;

    const fragment = layer.params.fragment.trim().length > 0 ? layer.params.fragment : fallbackFragment;
    if (fragment !== this.lastFragment) {
      this.lastFragment = fragment;
      this.material.fragmentShader = fragment;
      this.material.needsUpdate = true;
    }

    this.upsertNumberUniform('uSeed', seed);
    this.upsertNumberUniform('u_seed', seed);
    this.syncCustomUniforms(layer.params.uniforms);

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
    this.mesh.rotation.z = layer.transform.rotation;

    this.applyGeometry(layer);
  }

  tick(timeSeconds: number, resolution: { width: number; height: number }): void {
    this.resolution.set(Math.max(1, resolution.width), Math.max(1, resolution.height));

    const frame = Math.floor(Math.max(0, timeSeconds) * 60);
    this.upsertNumberUniform('uTime', timeSeconds);
    this.upsertNumberUniform('u_time', timeSeconds);
    this.upsertNumberUniform('uFrame', frame);
    this.upsertNumberUniform('u_frame', frame);

    this.upsertVectorUniform('uResolution', this.resolution.x, this.resolution.y);
    this.upsertVectorUniform('u_resolution', this.resolution.x, this.resolution.y);

    if (this.currentLayerRef) {
      this.applyGeometry(this.currentLayerRef);
    }

    const layerSizePx = this.computeLayerSizePx();
    const layerPosPx = this.computeLayerPosPx();
    this.upsertVectorUniform('uLayerSize', layerSizePx.x, layerSizePx.y);
    this.upsertVectorUniform('u_layer_size', layerSizePx.x, layerSizePx.y);
    this.upsertVectorUniform('uLayerPos', layerPosPx.x, layerPosPx.y);
    this.upsertVectorUniform('u_layer_pos', layerPosPx.x, layerPosPx.y);
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }

  private applyGeometry(layer: ShaderLayerInstance): void {
    const sizing = layer.params.sizing ?? { mode: 'fullscreen' as const };

    const baseWidthPx = sizing.mode === 'custom' ? Math.max(1, sizing.width ?? 100) : this.resolution.x;
    const baseHeightPx = sizing.mode === 'custom' ? Math.max(1, sizing.height ?? 100) : this.resolution.y;

    const scale = Math.max(0.0001, layer.transform.scale);
    this.mesh.scale.set(baseWidthPx * scale, baseHeightPx * scale, 1);
    this.mesh.position.set(layer.transform.x, layer.transform.y, 0);
  }

  private computeLayerSizePx(): Vector2 {
    return new Vector2(this.mesh.scale.x, this.mesh.scale.y);
  }

  private computeLayerPosPx(): Vector2 {
    return new Vector2(this.mesh.position.x, this.mesh.position.y);
  }

  private upsertNumberUniform(name: string, value: number): void {
    const uniform = this.material.uniforms[name];
    if (uniform && typeof uniform.value === 'number') {
      uniform.value = value;
      return;
    }
    this.material.uniforms[name] = { value };
  }

  private upsertVectorUniform(name: string, width: number, height: number): void {
    const uniform = this.material.uniforms[name];
    if (uniform?.value instanceof Vector2) {
      uniform.value.set(width, height);
      return;
    }

    this.material.uniforms[name] = { value: new Vector2(width, height) };
  }

  private syncCustomUniforms(uniforms: ShaderUniformMap): void {
    for (const [name, meta] of Object.entries(uniforms)) {
      if (RESERVED_UNIFORMS.has(name)) {
        continue;
      }
      this.upsertNumberUniform(name, meta.value);
    }

    for (const name of Object.keys(this.material.uniforms)) {
      if (RESERVED_UNIFORMS.has(name)) {
        continue;
      }
      if (!(name in uniforms)) {
        delete this.material.uniforms[name];
      }
    }
  }
}
