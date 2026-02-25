import { nanoid } from 'nanoid';
import type { Project } from './schema';

export const defaultShaderFragment = `
precision highp float;

varying vec2 vUv;
uniform float uSeed;
uniform float uTime;
uniform vec2 uResolution;
uniform float u_intensity;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 345.45));
  p += dot(p, p + 34.23 + uSeed * 0.000001);
  return fract(p.x * p.y);
}

void main() {
  vec2 uv = vUv;
  float n = hash(uv * (8.0 + uSeed * 0.0001) + uTime * 0.1);
  vec3 base = mix(vec3(0.08, 0.08, 0.12), vec3(0.9, 0.86, 0.75), smoothstep(0.2, 0.9, n));
  vec3 color = base + (n - 0.5) * u_intensity;
  gl_FragColor = vec4(color, 1.0);
}
`;

export function createDefaultProject(): Project {
  const layouts = {
    instagramPortrait: {
      id: 'instagramPortrait',
      name: 'Instagram Portrait',
      width: 1080,
      height: 1350,
    },
    square: {
      id: 'square',
      name: 'Square',
      width: 1080,
      height: 1080,
    },
    a3_300dpi: {
      id: 'a3_300dpi',
      name: 'A3 (300dpi)',
      width: 3508,
      height: 4961,
      bleedMM: 3,
      dpi: 300,
    },
  } as const;

  return {
    version: '0.1',
    seed: 1337,
    canvas: {
      width: layouts.instagramPortrait.width,
      height: layouts.instagramPortrait.height,
    },
    layers: [
      {
        id: nanoid(),
        type: 'shader',
        name: 'Base Shader',
        visible: true,
        blendMode: 'normal',
        opacity: 1,
        transform: {
          x: 0,
          y: 0,
          scale: 1,
          rotation: 0,
        },
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
          sizing: {
            mode: 'fullscreen',
          },
        },
      },
    ],
    effectChain: [
      {
        id: nanoid(),
        type: 'grain',
        enabled: false,
        seedOffset: 1,
        params: {
          amount: 0.08,
          size: 1,
        },
      },
    ],
    snapshots: [],
    layouts,
    activeLayoutId: 'instagramPortrait',
    exportPresets: [
      {
        id: 'instagram-1080x1350',
        label: 'Instagram 1080x1350',
        width: 1080,
        height: 1350,
      },
    ],
  };
}
