import { Color, NoToneMapping, SRGBColorSpace, WebGLRenderer } from 'three';

export function createRenderer(canvas: HTMLCanvasElement): WebGLRenderer {
  const renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(new Color('#0c0d10'));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = NoToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.autoClear = true;
  return renderer;
}

export function resizeRenderer(renderer: WebGLRenderer, width: number, height: number): void {
  renderer.setSize(width, height, false);
}
