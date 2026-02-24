import type { ShaderUniform } from '../core/layers/Layer';
import type { Project } from '../core/project/schema';
import { mulberry32 } from '../core/rng/prng';
import { cloneProject } from './projectStateUtils';

export function buildVariationProject(baseProject: Project, newSeed: number): Project {
  const nextProject = cloneProject(baseProject);
  nextProject.seed = newSeed;

  const rng = mulberry32(newSeed >>> 0);

  nextProject.layers = nextProject.layers.map((layer) => {
    if (layer.type !== 'shader') {
      return layer;
    }

    const nextUniforms = Object.fromEntries(
      Object.entries(layer.params.uniforms).map(([uniformName, uniformMeta]) => {
        const nextMeta: ShaderUniform = { ...uniformMeta };

        const canRandomize =
          nextMeta.randomizable === true &&
          typeof nextMeta.min === 'number' &&
          typeof nextMeta.max === 'number';

        if (canRandomize) {
          nextMeta.value = quantizedRandom(
            rng,
            nextMeta.min as number,
            nextMeta.max as number,
            nextMeta.step ?? 0.01,
          );
        }

        return [uniformName, nextMeta];
      }),
    );

    return {
      ...layer,
      params: {
        ...layer.params,
        uniforms: nextUniforms,
      },
    };
  });

  return nextProject;
}

export function quantizedRandom(rng: () => number, min: number, max: number, step = 0.01): number {
  const lower = Math.min(min, max);
  const upper = Math.max(min, max);
  const safeStep = Number.isFinite(step) && step > 0 ? step : 0.01;

  const raw = lower + rng() * (upper - lower);
  const normalized = (raw - lower) / safeStep;
  const snapped = Math.round(normalized) * safeStep + lower;
  const clamped = clamp(snapped, lower, upper);

  const decimals = decimalPlaces(safeStep);
  return Number(clamped.toFixed(decimals));
}

function decimalPlaces(value: number): number {
  const text = value.toString().toLowerCase();
  if (text.includes('e-')) {
    const exponent = Number(text.split('e-')[1] ?? '0');
    return Number.isFinite(exponent) ? exponent : 6;
  }
  const dot = text.indexOf('.');
  if (dot === -1) {
    return 0;
  }
  return text.length - dot - 1;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
