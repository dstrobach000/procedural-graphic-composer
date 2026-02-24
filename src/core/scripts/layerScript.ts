import type { LayerTransform } from '../layers/Layer';

export type ScriptTransform = LayerTransform;

export type LayerScriptContext = {
  time: number;
  frame: number;
  seed: number;
  projectSeed: number;
  layerSeed: number;
  random: () => number;
  uniforms: Record<string, number>;
  transform: ScriptTransform;
};

export type LayerScriptPatch = {
  uniforms?: Partial<Record<string, number>>;
  transform?: Partial<ScriptTransform>;
};

export type LayerScriptRunner = (context: LayerScriptContext) => unknown;

export type LayerScriptValidationResult = { ok: true } | { ok: false; error: string };

const SAFE_MATH = Object.freeze(createSafeMath());

export function compileLayerScript(source: string): LayerScriptRunner {
  const body = source.trim();
  if (body.length === 0) {
    throw new Error('Script is empty.');
  }

  const runtime = new Function(
    'context',
    'safeMath',
    `
      "use strict";
      const Math = safeMath;
      const { time, frame, seed, projectSeed, layerSeed, random, uniforms, transform } = context;
      const window = undefined;
      const document = undefined;
      const globalThis = undefined;
      const self = undefined;
      const Date = undefined;
      const performance = undefined;
      const Function = undefined;
      const fetch = undefined;
      const XMLHttpRequest = undefined;
      const WebSocket = undefined;
      const EventSource = undefined;
      ${body}
    `,
  ) as (context: LayerScriptContext, safeMath: typeof SAFE_MATH) => unknown;

  return (context) => runtime(context, SAFE_MATH);
}

export function validateLayerScript(source: string): LayerScriptValidationResult {
  try {
    compileLayerScript(source);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: toErrorMessage(error),
    };
  }
}

export function normalizeLayerScriptPatch(value: unknown): LayerScriptPatch | null {
  if (!isRecord(value)) {
    return null;
  }

  const next: LayerScriptPatch = {};

  if (isRecord(value.uniforms)) {
    const uniforms: Record<string, number> = {};
    for (const [key, entryValue] of Object.entries(value.uniforms)) {
      if (typeof entryValue === 'number' && Number.isFinite(entryValue)) {
        uniforms[key] = entryValue;
      }
    }
    if (Object.keys(uniforms).length > 0) {
      next.uniforms = uniforms;
    }
  }

  if (isRecord(value.transform)) {
    const transform: Partial<ScriptTransform> = {};
    if (typeof value.transform.x === 'number' && Number.isFinite(value.transform.x)) {
      transform.x = value.transform.x;
    }
    if (typeof value.transform.y === 'number' && Number.isFinite(value.transform.y)) {
      transform.y = value.transform.y;
    }
    if (typeof value.transform.scale === 'number' && Number.isFinite(value.transform.scale)) {
      transform.scale = value.transform.scale;
    }
    if (typeof value.transform.rotation === 'number' && Number.isFinite(value.transform.rotation)) {
      transform.rotation = value.transform.rotation;
    }
    if (Object.keys(transform).length > 0) {
      next.transform = transform;
    }
  }

  return Object.keys(next).length > 0 ? next : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function createSafeMath(): Record<string, unknown> {
  const safeMath: Record<string, unknown> = {};
  for (const key of Object.getOwnPropertyNames(Math)) {
    const value = (Math as unknown as Record<string, unknown>)[key];
    safeMath[key] = typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(Math) : value;
  }
  safeMath.random = undefined;
  return safeMath;
}
