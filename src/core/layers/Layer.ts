import {
  AdditiveBlending,
  type BlendingDstFactor,
  type BlendingSrcFactor,
  CustomBlending,
  Mesh,
  MultiplyBlending,
  NormalBlending,
  OneFactor,
  OneMinusSrcColorFactor,
  type Blending,
} from 'three';

export const blendModes = ['normal', 'add', 'multiply', 'screen'] as const;
export type BlendMode = (typeof blendModes)[number];

export type LayerTransform = {
  x: number;
  y: number;
  scale: number;
  rotation: number;
};

export type BaseLayerInstance = {
  id: string;
  name: string;
  visible: boolean;
  blendMode: BlendMode;
  opacity: number;
  transform: LayerTransform;
  seedOffset: number;
  script?: {
    enabled: boolean;
    source: string;
  };
};

export type ImageLayerInstance = BaseLayerInstance & {
  type: 'image';
  params: {
    src: string;
  };
};

export type ShaderLayerInstance = BaseLayerInstance & {
  type: 'shader';
  params: {
    fragment: string;
    uniforms: ShaderUniformMap;
    sizing?: {
      mode: 'fullscreen' | 'custom';
      width?: number;
      height?: number;
    };
  };
};

export type TextLayerInstance = BaseLayerInstance & {
  type: 'text';
  params: {
    text: string;
    fontPath: string;
    fontSize: number;
    letterSpacing: number;
  };
};

export type ShaderUniform = {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  randomizable?: boolean;
};

export type ShaderUniformMap = Record<string, ShaderUniform>;

export type LayerInstance = ImageLayerInstance | ShaderLayerInstance | TextLayerInstance;

export interface RuntimeLayer {
  id: string;
  kind: LayerInstance['type'];
  mesh: Mesh;
  update(layer: LayerInstance, seed: number): Promise<void> | void;
  isReady(): boolean;
  applyRuntimePatch?(patch: {
    transform?: LayerTransform;
    uniforms?: Record<string, number>;
  }): void;
  tick?(timeSeconds: number, resolution: { width: number; height: number }): void;
  dispose(): void;
}

export function toThreeBlending(mode: BlendMode): {
  blending: Blending;
  blendSrc?: BlendingSrcFactor;
  blendDst?: BlendingDstFactor;
} {
  switch (mode) {
    case 'add':
      return { blending: AdditiveBlending };
    case 'multiply':
      return { blending: MultiplyBlending };
    case 'screen':
      return {
        blending: CustomBlending,
        blendSrc: OneFactor,
        blendDst: OneMinusSrcColorFactor,
      };
    case 'normal':
    default:
      return { blending: NormalBlending };
  }
}
