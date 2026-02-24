import { z } from 'zod';
import type { BlendMode, LayerInstance, LayerTransform, ShaderUniform } from '../layers/Layer';

export type EffectType = 'threshold' | 'grain';

export type EffectInstance = {
  id: string;
  type: EffectType;
  enabled: boolean;
  seedOffset: number;
  params: Record<string, number>;
};

export type Snapshot = {
  id: string;
  name: string;
  createdAt: string;
  seed: number;
  projectState: Project;
  thumbnailPath?: string;
};

export type ExportPreset = {
  id: string;
  label: string;
  width: number;
  height: number;
};

export type LayoutPreset = {
  id: string;
  name: string;
  width: number;
  height: number;
};

export type Project = {
  version: '0.1';
  seed: number;
  canvas: {
    width: number;
    height: number;
  };
  layers: LayerInstance[];
  effectChain: EffectInstance[];
  snapshots: Snapshot[];
  layouts: Record<string, LayoutPreset>;
  activeLayoutId: string;
  exportPresets?: ExportPreset[];
};

const transformSchema: z.ZodType<LayerTransform> = z.object({
  x: z.number(),
  y: z.number(),
  scale: z.number(),
  rotation: z.number(),
});

const blendModeSchema: z.ZodType<BlendMode> = z.enum(['normal', 'add', 'multiply', 'screen']);

const layerBaseSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  visible: z.boolean(),
  blendMode: blendModeSchema,
  opacity: z.number().min(0).max(1),
  transform: transformSchema,
  seedOffset: z.number().int(),
  script: z
    .object({
      enabled: z.boolean(),
      source: z.string(),
    })
    .optional(),
});

const imageLayerSchema = layerBaseSchema.extend({
  type: z.literal('image'),
  params: z.object({
    src: z.string(),
  }),
});

const shaderLayerSchema = layerBaseSchema.extend({
  type: z.literal('shader'),
  params: z.object({
    fragment: z.string(),
    uniforms: z.record(
      z.string(),
      z.union([
        z.number().transform(
          (value): ShaderUniform => ({
            value,
          }),
        ),
        z.object({
          value: z.number(),
          min: z.number().optional(),
          max: z.number().optional(),
          step: z.number().positive().optional(),
          randomizable: z.boolean().optional(),
        }),
      ]),
    ),
    sizing: z
      .object({
        mode: z.enum(['fullscreen', 'custom']),
        width: z.number().positive().optional(),
        height: z.number().positive().optional(),
      })
      .optional(),
  }),
});

const textLayerSchema = layerBaseSchema.extend({
  type: z.literal('text'),
  params: z.object({
    text: z.string(),
    fontPath: z.string().min(1),
    fontSize: z.number().positive(),
    letterSpacing: z.number(),
  }),
});

const layerSchema: z.ZodType<LayerInstance> = z.discriminatedUnion('type', [
  imageLayerSchema,
  shaderLayerSchema,
  textLayerSchema,
]);

const effectSchema: z.ZodType<EffectInstance> = z.object({
  id: z.string().min(1),
  type: z.enum(['threshold', 'grain']),
  enabled: z.boolean(),
  seedOffset: z.number().int(),
  params: z.record(z.string(), z.number()),
});

const exportPresetSchema: z.ZodType<ExportPreset> = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

const layoutPresetSchema: z.ZodType<LayoutPreset> = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

const snapshotSchema: z.ZodType<Snapshot> = z.lazy(() =>
  z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    createdAt: z.string().datetime(),
    seed: z.number().int(),
    projectState: projectSchema,
    thumbnailPath: z.string().optional(),
  }),
);

const projectSchemaObject =
  z.object({
    version: z.literal('0.1'),
    seed: z.number().int(),
    canvas: z.object({
      width: z.number().int().positive(),
      height: z.number().int().positive(),
    }),
    layers: z.array(layerSchema),
    effectChain: z.array(effectSchema),
    snapshots: z.array(snapshotSchema),
    layouts: z.record(z.string(), layoutPresetSchema),
    activeLayoutId: z.string().min(1),
    exportPresets: z.array(exportPresetSchema).optional(),
  })
  .superRefine((project, ctx) => {
    if (!project.layouts[project.activeLayoutId]) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `activeLayoutId "${project.activeLayoutId}" does not exist in layouts`,
      });
    }
  });

const projectSchemaBase: z.ZodType<Project> = z.lazy(() => projectSchemaObject);

const projectSchema: z.ZodType<Project> = z.preprocess(
  (input) => withLegacyLayoutDefaults(input),
  projectSchemaBase,
);

export function parseProject(input: unknown): Project {
  return projectSchema.parse(input);
}

export function safeParseProject(input: unknown) {
  return projectSchema.safeParse(input);
}

const LEGACY_LAYOUT_ID = 'default';

function withLegacyLayoutDefaults(input: unknown): unknown {
  if (!isRecord(input)) {
    return input;
  }

  const canvas = asRecord(input.canvas);
  const width = toPositiveInt(canvas?.width) ?? 1080;
  const height = toPositiveInt(canvas?.height) ?? 1080;

  let next: Record<string, unknown> | null = null;

  if (!isRecord(input.layouts)) {
    next = {
      ...input,
      layouts: {
        [LEGACY_LAYOUT_ID]: {
          id: LEGACY_LAYOUT_ID,
          name: 'Default Layout',
          width,
          height,
        },
      },
    };
  }

  const candidate = next ?? input;
  const layouts = asRecord(candidate.layouts);
  const activeLayoutId =
    typeof candidate.activeLayoutId === 'string' && candidate.activeLayoutId.length > 0
      ? candidate.activeLayoutId
      : undefined;

  if (!activeLayoutId || !layouts || !isRecord(layouts[activeLayoutId])) {
    const firstLayoutId = layouts ? Object.keys(layouts)[0] : undefined;
    if (firstLayoutId) {
      return {
        ...candidate,
        activeLayoutId: firstLayoutId,
      };
    }

    return {
      ...candidate,
      activeLayoutId: LEGACY_LAYOUT_ID,
      layouts: {
        [LEGACY_LAYOUT_ID]: {
          id: LEGACY_LAYOUT_ID,
          name: 'Default Layout',
          width,
          height,
        },
      },
    };
  }

  return candidate;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined;
}

function toPositiveInt(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined;
  }
  const integer = Math.floor(value);
  return integer > 0 ? integer : undefined;
}
