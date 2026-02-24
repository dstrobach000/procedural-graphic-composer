import { Vector2 } from 'three';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

export type GrainParams = {
  amount: number;
  size: number;
  enabled: boolean;
  seed: number;
};

export function createGrainPass(): ShaderPass {
  return new ShaderPass({
    uniforms: {
      tDiffuse: { value: null },
      u_amount: { value: 0.08 },
      u_size: { value: 1 },
      uSeed: { value: 0 },
      uTime: { value: 0 },
      uResolution: { value: new Vector2(1, 1) },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D tDiffuse;
      uniform float u_amount;
      uniform float u_size;
      uniform float uSeed;
      uniform float uTime;
      uniform vec2 uResolution;
      varying vec2 vUv;

      float hash(vec2 p) {
        p = fract(p * vec2(443.8975, 397.2973));
        p += dot(p, p + 19.19 + uSeed * 0.000001 + uTime * 0.0);
        return fract(p.x * p.y);
      }

      void main() {
        vec4 color = texture2D(tDiffuse, vUv);
        vec2 safeResolution = max(uResolution, vec2(1.0));
        vec2 pixelUv = floor(vUv * safeResolution / max(u_size, 0.1)) * max(u_size, 0.1) / safeResolution;
        float noise = hash(pixelUv) - 0.5;
        gl_FragColor = vec4(color.rgb + noise * u_amount, color.a);
      }
    `,
  });
}

export function applyGrainParams(pass: ShaderPass, params: GrainParams): void {
  pass.enabled = params.enabled;
  pass.uniforms.u_amount.value = params.amount;
  pass.uniforms.u_size.value = Math.max(0.1, params.size);
  pass.uniforms.uSeed.value = params.seed;
}

export function setGrainFrameUniforms(
  pass: ShaderPass,
  timeSeconds: number,
  width: number,
  height: number,
): void {
  pass.uniforms.uTime.value = timeSeconds;
  const resolution = pass.uniforms.uResolution.value;
  if (resolution instanceof Vector2) {
    resolution.set(width, height);
  } else {
    pass.uniforms.uResolution.value = new Vector2(width, height);
  }
}
