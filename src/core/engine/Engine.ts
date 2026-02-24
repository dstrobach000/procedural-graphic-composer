import { OrthographicCamera, Vector2 } from 'three';
import { EffectChain } from '../effects/EffectChain';
import { LayerFactory } from '../layers/LayerFactory';
import type { Project } from '../project/schema';
import { createRenderer, resizeRenderer } from './Renderer';
import { createSceneRoot, setSceneRootSize } from './SceneRoot';

export type EngineOptions = {
  onError?: (error: Error) => void;
};

export type ShaderCompileValidationResult =
  | { ok: true }
  | { ok: false; error: string };

export class Engine {
  private readonly options: EngineOptions;

  private readonly renderer;

  private readonly layerFactory;

  private readonly effectChain;

  private readonly sceneRoot;

  private readonly viewportSize = new Vector2(1, 1);

  private readonly worldSize = new Vector2(1, 1);

  private frameHandle: number | null = null;

  private startedAt = performance.now();

  private disposed = false;

  private lastProject: Project | null = null;

  constructor(canvas: HTMLCanvasElement, options: EngineOptions = {}) {
    this.options = options;
    this.renderer = createRenderer(canvas);
    this.sceneRoot = createSceneRoot();
    this.layerFactory = new LayerFactory(this.sceneRoot.scene);
    this.effectChain = new EffectChain(this.renderer, this.sceneRoot.scene, this.sceneRoot.camera);

    const initialWidth = Math.max(1, canvas.clientWidth || canvas.width || 1);
    const initialHeight = Math.max(1, canvas.clientHeight || canvas.height || 1);
    this.resize(initialWidth, initialHeight);

    this.loop();
  }

  async syncProject(project: Project): Promise<void> {
    if (this.disposed) {
      return;
    }

    try {
      this.worldSize.set(Math.max(1, project.canvas.width), Math.max(1, project.canvas.height));
      setSceneRootSize(this.sceneRoot.camera, this.worldSize.x, this.worldSize.y);

      await this.layerFactory.sync(project.layers, project.seed);
      this.effectChain.sync(project.effectChain, project.seed);
      this.lastProject = project;
    } catch (error) {
      this.options.onError?.(toError(error));
    }
  }

  resize(width: number, height: number): void {
    if (this.disposed) {
      return;
    }

    resizeRenderer(this.renderer, width, height);
    this.effectChain.setSize(width, height);
    this.viewportSize.set(width, height);
  }

  renderFrame(): void {
    if (this.disposed) {
      return;
    }

    const elapsed = (performance.now() - this.startedAt) / 1000;
    this.layerFactory.tick(elapsed, { width: this.worldSize.x, height: this.worldSize.y });
    this.effectChain.render(elapsed, this.viewportSize.x, this.viewportSize.y);
  }

  renderToImage(width: number, height: number): Uint8Array {
    if (this.disposed) {
      throw new Error('Engine has been disposed');
    }
    if (!this.lastProject) {
      throw new Error('Project has not been synced yet');
    }

    this.layerFactory.tick(0, { width: this.worldSize.x, height: this.worldSize.y });

    const exportCanvas = document.createElement('canvas');
    const exportRenderer = createRenderer(exportCanvas);
    exportRenderer.setPixelRatio(1);
    exportRenderer.setSize(width, height, false);

    const exportCamera = this.sceneRoot.camera.clone() as OrthographicCamera;
    const exportChain = new EffectChain(exportRenderer, this.sceneRoot.scene, exportCamera);
    exportChain.sync(this.lastProject.effectChain, this.lastProject.seed);
    exportChain.setSize(width, height);

    try {
      return exportChain.renderToPixels(width, height, 0);
    } finally {
      exportChain.dispose();
      exportRenderer.dispose();

      const elapsed = (performance.now() - this.startedAt) / 1000;
      this.layerFactory.tick(elapsed, { width: this.worldSize.x, height: this.worldSize.y });
    }
  }

  validateShaderFragment(fragment: string): ShaderCompileValidationResult {
    const source = fragment.trim();
    if (source.length === 0) {
      return { ok: false, error: 'Shader fragment is empty.' };
    }

    try {
      const gl = this.renderer.getContext();
      const vertexSource = `
attribute vec3 position;
attribute vec2 uv;
uniform mat4 projectionMatrix;
uniform mat4 modelViewMatrix;
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

      const fragmentSource = source.includes('precision')
        ? source
        : `precision highp float;\n${source}`;

      const vertexShader = compileRawShader(gl, gl.VERTEX_SHADER, vertexSource);
      const fragmentShader = compileRawShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
      const program = gl.createProgram();
      if (!program) {
        gl.deleteShader(vertexShader);
        gl.deleteShader(fragmentShader);
        return { ok: false, error: 'Unable to create WebGL program for shader validation.' };
      }

      gl.attachShader(program, vertexShader);
      gl.attachShader(program, fragmentShader);
      gl.linkProgram(program);

      const linked = gl.getProgramParameter(program, gl.LINK_STATUS);
      if (!linked) {
        const info = gl.getProgramInfoLog(program)?.trim() || 'Shader link failed.';
        gl.deleteProgram(program);
        gl.deleteShader(vertexShader);
        gl.deleteShader(fragmentShader);
        return { ok: false, error: info };
      }

      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: toError(error).message };
    }
  }

  dispose(): void {
    this.disposed = true;
    if (this.frameHandle !== null) {
      cancelAnimationFrame(this.frameHandle);
    }
    this.layerFactory.dispose();
    this.effectChain.dispose();
    this.renderer.dispose();
  }

  private loop = (): void => {
    if (this.disposed) {
      return;
    }

    this.renderFrame();
    this.frameHandle = requestAnimationFrame(this.loop);
  };
}

function toError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }
  return new Error(String(error));
}

function compileRawShader(
  gl: WebGLRenderingContext | WebGL2RenderingContext,
  kind: number,
  source: string,
): WebGLShader {
  const shader = gl.createShader(kind);
  if (!shader) {
    throw new Error('Failed to create WebGL shader object.');
  }

  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  const compiled = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
  if (!compiled) {
    const info = gl.getShaderInfoLog(shader)?.trim() || 'Unknown shader compile failure.';
    gl.deleteShader(shader);
    throw new Error(info);
  }

  return shader;
}
