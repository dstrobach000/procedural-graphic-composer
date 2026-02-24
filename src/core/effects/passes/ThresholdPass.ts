import { Vector2 } from 'three';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

export type ThresholdParams = {
  cutoff: number;
  softness: number;
  enabled: boolean;
  seed: number;
};

export function createThresholdPass(): ShaderPass {
  return new ShaderPass({
    uniforms: {
      tDiffuse: { value: null },
      u_cutoff: { value: 0.5 },
      u_softness: { value: 0.1 },
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
      uniform float u_cutoff;
      uniform float u_softness;
      uniform float uSeed;
      uniform float uTime;
      uniform vec2 uResolution;
      varying vec2 vUv;

      void main() {
        vec4 color = texture2D(tDiffuse, vUv);
        float luma = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));
        vec2 jitterUv = floor(vUv * max(uResolution, vec2(1.0))) / max(uResolution, vec2(1.0));
        float jitter = fract(sin(dot(jitterUv * (uSeed * 0.00001 + 1.0), vec2(12.9898, 78.233)) + uTime * 0.0) * 43758.5453) * 0.015;
        float edge = smoothstep(u_cutoff - u_softness, u_cutoff + u_softness, luma + jitter);
        gl_FragColor = vec4(vec3(edge), color.a);
      }
    `,
  });
}

export function applyThresholdParams(pass: ShaderPass, params: ThresholdParams): void {
  pass.enabled = params.enabled;
  pass.uniforms.u_cutoff.value = params.cutoff;
  pass.uniforms.u_softness.value = params.softness;
  pass.uniforms.uSeed.value = params.seed;
}

export function setThresholdFrameUniforms(
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
