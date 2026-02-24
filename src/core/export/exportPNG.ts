import { save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';
import type { Engine } from '../engine/Engine';
import { pixelsToPNGBytes } from './png';

export type ExportSize = {
  width: number;
  height: number;
};

export async function exportPNG(engine: Engine, size: ExportSize): Promise<string | null> {
  const pixels = await engine.renderToImage(size.width, size.height);
  const pngBytes = await pixelsToPNGBytes(pixels, size.width, size.height);
  const path = await save({
    title: 'Export PNG',
    defaultPath: `export-${size.width}x${size.height}.png`,
    filters: [{ name: 'PNG', extensions: ['png'] }],
  });

  if (!path) {
    return null;
  }

  await writeFile(path, pngBytes);
  return path;
}
