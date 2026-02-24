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
});
