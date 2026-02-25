import { describe, expect, it } from 'vitest';
import { createDefaultProject } from './defaults';
import { parseProject, safeParseProject } from './schema';

describe('project schema', () => {
  it('parses a valid default project', () => {
    const project = createDefaultProject();
    const parsed = parseProject(project);
    expect(parsed.version).toBe('0.1');
    expect(parsed.layers.length).toBeGreaterThan(0);
  });

  it('rejects malformed layer payload', () => {
    const project = createDefaultProject();
    const broken = {
      ...project,
      layers: [
        {
          ...project.layers[0],
          opacity: 2,
        },
      ],
    };

    const result = safeParseProject(broken);
    expect(result.success).toBe(false);
  });

  it('accepts legacy shader layers without sizing', () => {
    const project = createDefaultProject();
    const shaderLayer = project.layers.find((layer) => layer.type === 'shader');
    if (!shaderLayer || shaderLayer.type !== 'shader') {
      throw new Error('default shader layer missing');
    }

    const legacyLayer = {
      ...shaderLayer,
      params: {
        fragment: shaderLayer.params.fragment,
        uniforms: shaderLayer.params.uniforms,
      },
    };

    const result = safeParseProject({
      ...project,
      layers: [legacyLayer],
    });
    expect(result.success).toBe(true);
  });

  it('normalizes legacy numeric uniforms to metadata objects', () => {
    const project = createDefaultProject();
    const shaderLayer = project.layers.find((layer) => layer.type === 'shader');
    if (!shaderLayer || shaderLayer.type !== 'shader') {
      throw new Error('default shader layer missing');
    }

    const numericUniformLayer = {
      ...shaderLayer,
      params: {
        ...shaderLayer.params,
        uniforms: {
          u_amount: 0.75,
        },
      },
    };

    const parsed = parseProject({
      ...project,
      layers: [numericUniformLayer],
    });

    const parsedShader = parsed.layers[0];
    if (!parsedShader || parsedShader.type !== 'shader') {
      throw new Error('parsed shader layer missing');
    }

    expect(parsedShader.params.uniforms.u_amount?.value).toBe(0.75);
  });

  it('injects a default layout for legacy projects missing layout fields', () => {
    const project = createDefaultProject();
    const legacyProject = {
      version: project.version,
      seed: project.seed,
      canvas: project.canvas,
      layers: project.layers,
      effectChain: project.effectChain,
      snapshots: project.snapshots,
      exportPresets: project.exportPresets,
    };

    const parsed = parseProject(legacyProject);
    expect(parsed.activeLayoutId).toBe('default');
    expect(parsed.layouts.default?.width).toBe(project.canvas.width);
    expect(parsed.layouts.default?.height).toBe(project.canvas.height);
  });

  it('parses text layer payloads', () => {
    const project = createDefaultProject();
    const textLayer = {
      id: 'text-1',
      type: 'text' as const,
      name: 'Headline',
      visible: true,
      blendMode: 'normal' as const,
      opacity: 1,
      transform: {
        x: 0,
        y: 0,
        scale: 1,
        rotation: 0,
      },
      seedOffset: 0,
      script: {
        enabled: true,
        source: 'return { transform: { x: 10 } };',
      },
      params: {
        text: 'HELLO',
        fontPath: '/fonts/kenpixel.ttf',
        fontSize: 160,
        letterSpacing: 1,
      },
    };

    const parsed = parseProject({
      ...project,
      layers: [textLayer],
    });

    const parsedTextLayer = parsed.layers[0];
    expect(parsedTextLayer?.type).toBe('text');
  });

  it('parses layouts with bleed metadata', () => {
    const project = createDefaultProject();
    const parsed = parseProject(project);

    const a3 = parsed.layouts.a3_300dpi;
    expect(a3?.bleedMM).toBe(3);
    expect(a3?.dpi).toBe(300);
  });
});
