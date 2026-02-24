import { save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';
import type { Engine } from '../engine/Engine';

export type ExportSize = {
  width: number;
  height: number;
};

export async function exportPNG(engine: Engine, size: ExportSize): Promise<string | null> {
  const pixels = engine.renderToImage(size.width, size.height);
  const flipped = flipPixels(pixels, size.width, size.height);

  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('2D canvas context is unavailable');
  }

  const imageData = new ImageData(new Uint8ClampedArray(flipped), size.width, size.height);
  context.putImageData(imageData, 0, 0);

  const blob = await canvasToBlob(canvas);
  const path = await save({
    title: 'Export PNG',
    defaultPath: `export-${size.width}x${size.height}.png`,
    filters: [{ name: 'PNG', extensions: ['png'] }],
  });

  if (!path) {
    return null;
  }

  const arrayBuffer = await blob.arrayBuffer();
  await writeFile(path, new Uint8Array(arrayBuffer));
  return path;
}

function flipPixels(pixels: Uint8Array, width: number, height: number): Uint8Array {
  const rowSize = width * 4;
  const output = new Uint8Array(pixels.length);

  for (let y = 0; y < height; y += 1) {
    const from = y * rowSize;
    const to = (height - y - 1) * rowSize;
    output.set(pixels.subarray(from, from + rowSize), to);
  }

  return output;
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Failed to encode PNG blob'));
        return;
      }
      resolve(blob);
    }, 'image/png');
  });
}
