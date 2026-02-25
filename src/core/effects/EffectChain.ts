import {
  LinearFilter,
  RGBAFormat,
  UnsignedByteType,
  WebGLRenderTarget,
  type Camera,
  type Scene,
  type WebGLRenderer,
} from 'three';
import type { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { hashSeed } from '../rng/hash';
import type { EffectInstance } from '../project/schema';
import {
  applyGrainParams,
  createGrainPass,
  setGrainFrameUniforms,
} from './passes/GrainPass';
import {
  applyThresholdParams,
  createThresholdPass,
  setThresholdFrameUniforms,
} from './passes/ThresholdPass';

type ManagedPass = {
  pass: ShaderPass;
  type: EffectInstance['type'];
};

export class EffectChain {
  private readonly renderer: WebGLRenderer;

  private readonly scene: Scene;

  private readonly camera: Camera;

  private composer: EffectComposer;

  private readonly managedPasses: ManagedPass[] = [];

  constructor(renderer: WebGLRenderer, scene: Scene, camera: Camera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.composer = createComposer(renderer);
    this.sync([], 0);
  }

  sync(effects: EffectInstance[], projectSeed: number): void {
    this.composer.dispose();
    this.composer = createComposer(this.renderer);
    this.managedPasses.length = 0;

    const renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(renderPass);

    for (const effect of effects) {
      if (effect.type === 'threshold') {
        const pass = createThresholdPass();
        applyThresholdParams(pass, {
          enabled: effect.enabled,
          cutoff: effect.params.cutoff ?? 0.5,
          softness: effect.params.softness ?? 0.08,
          seed: hashSeed(projectSeed, effect.seedOffset),
        });
        this.managedPasses.push({ pass, type: 'threshold' });
        this.composer.addPass(pass);
      }

      if (effect.type === 'grain') {
        const pass = createGrainPass();
        applyGrainParams(pass, {
          enabled: effect.enabled,
          amount: effect.params.amount ?? 0.08,
          size: effect.params.size ?? 1,
          seed: hashSeed(projectSeed, effect.seedOffset),
        });
        this.managedPasses.push({ pass, type: 'grain' });
        this.composer.addPass(pass);
      }
    }
  }

  setSize(width: number, height: number): void {
    this.composer.setSize(width, height);
  }

  render(timeSeconds: number, width: number, height: number): void {
    this.applyFrameUniforms(timeSeconds, width, height);
    this.composer.render();
  }

  renderToPixels(width: number, height: number, timeSeconds: number): Uint8Array {
    const previousRenderToScreen = this.composer.renderToScreen;
    this.composer.renderToScreen = false;

    try {
      this.setSize(width, height);
      this.applyFrameUniforms(timeSeconds, width, height);
      this.composer.render();

      const pixels = new Uint8Array(width * height * 4);
      const readTarget = this.composer.readBuffer;
      this.renderer.readRenderTargetPixels(readTarget, 0, 0, width, height, pixels);
      if (isZeroBuffer(pixels)) {
        const writeTarget = this.composer.writeBuffer;
        this.renderer.readRenderTargetPixels(writeTarget, 0, 0, width, height, pixels);
      }
      return pixels;
    } finally {
      this.composer.renderToScreen = previousRenderToScreen;
    }
  }

  dispose(): void {
    this.composer.dispose();
  }

  private applyFrameUniforms(timeSeconds: number, width: number, height: number): void {
    for (const entry of this.managedPasses) {
      if (entry.type === 'threshold') {
        setThresholdFrameUniforms(entry.pass, timeSeconds, width, height);
      }

      if (entry.type === 'grain') {
        setGrainFrameUniforms(entry.pass, timeSeconds, width, height);
      }
    }
  }
}

function isZeroBuffer(buffer: Uint8Array): boolean {
  for (let index = 0; index < buffer.length; index += 1) {
    if (buffer[index] !== 0) {
      return false;
    }
  }
  return true;
}

function createComposer(renderer: WebGLRenderer): EffectComposer {
  // Use byte render targets so readRenderTargetPixels into Uint8Array is reliable for PNG export.
  const target = new WebGLRenderTarget(1, 1, {
    minFilter: LinearFilter,
    magFilter: LinearFilter,
    format: RGBAFormat,
    type: UnsignedByteType,
    depthBuffer: true,
    stencilBuffer: false,
  });
  return new EffectComposer(renderer, target);
}
