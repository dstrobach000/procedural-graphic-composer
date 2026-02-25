import { save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';
import type { Engine } from '../engine/Engine';
import type { ExportCameraBounds } from './layoutExport';
import { pixelsToPNGBytes } from './png';

export type ExportSize = {
  width: number;
  height: number;
};

export type ExportPNGOptions = {
  cameraBounds?: ExportCameraBounds;
  fileName?: string;
};

export async function exportPNG(
  engine: Engine,
  size: ExportSize,
  options: ExportPNGOptions = {},
): Promise<string | null> {
  const pixels = await engine.renderToImage(size.width, size.height, {
    cameraBounds: options.cameraBounds,
  });
  const pngBytes = await pixelsToPNGBytes(pixels, size.width, size.height);
  const path = await save({
    title: 'Export PNG',
    defaultPath: options.fileName ?? `export-${size.width}x${size.height}.png`,
    filters: [{ name: 'PNG', extensions: ['png'] }],
  });

  if (!path) {
    return null;
  }

  await writeFile(path, pngBytes);
  return path;
}
