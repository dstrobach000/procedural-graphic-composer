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

const layerSchema: z.ZodType<LayerInstance> = z.discriminatedUnion('type', [
  imageLayerSchema,
  shaderLayerSchema,
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

const projectSchema: z.ZodType<Project> = z.lazy(() => projectSchemaObject);

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
    exportPresets: z.array(exportPresetSchema).optional(),
  });

export function parseProject(input: unknown): Project {
  return projectSchema.parse(input);
}

export function safeParseProject(input: unknown) {
  return projectSchema.safeParse(input);
}
