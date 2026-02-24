import type { ShaderUniformMap } from '../layers/Layer';

export type ShaderTemplate = {
  id: string;
  label: string;
  fragment: string;
  uniforms?: ShaderUniformMap;
};

const baseHeader = `
precision highp float;

varying vec2 vUv;
uniform float uSeed;
uniform float uTime;
uniform vec2 uResolution;
`;

export const SHADER_TEMPLATES: ShaderTemplate[] = [
  {
    id: 'noise-field',
    label: 'Noise Field',
    fragment: `${baseHeader}
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  vec2 uv = vUv;
  float n = hash(uv * uResolution + uSeed);
  gl_FragColor = vec4(vec3(n), 1.0);
}
`,
  },
  {
    id: 'photocopier-threshold',
    label: 'Photocopier Threshold',
    fragment: `${baseHeader}
uniform float uThreshold;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  vec2 uv = vUv;
  float n = hash(uv * uResolution + uSeed);
  float t = step(uThreshold, n);
  gl_FragColor = vec4(vec3(t), 1.0);
}
`,
    uniforms: {
      uThreshold: { value: 0.5, min: 0, max: 1, step: 0.01, randomizable: true },
    },
  },
  {
    id: 'teletext-grid',
    label: 'Teletext Grid',
    fragment: `${baseHeader}
uniform float uCells;

void main() {
  vec2 uv = vUv;
  vec2 grid = floor(uv * max(1.0, uCells));
  float cell = mod(grid.x + grid.y, 2.0);
  gl_FragColor = vec4(vec3(cell), 1.0);
}
`,
    uniforms: {
      uCells: { value: 40, min: 4, max: 120, step: 1, randomizable: true },
    },
  },
];

export const DEFAULT_SHADER_TEMPLATE_ID = SHADER_TEMPLATES[0]?.id ?? 'noise-field';

export function getShaderTemplateById(id: string): ShaderTemplate | undefined {
  return SHADER_TEMPLATES.find((template) => template.id === id);
}
