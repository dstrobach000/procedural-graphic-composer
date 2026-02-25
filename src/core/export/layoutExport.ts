import type { LayoutPreset } from '../project/schema';

export type ExportCameraBounds = {
  trimWidth: number;
  trimHeight: number;
  bleedPx: number;
};

export type LayoutExportTarget = {
  trimWidth: number;
  trimHeight: number;
  exportWidth: number;
  exportHeight: number;
  bleedPx: number;
  cameraBounds?: ExportCameraBounds;
};

const MM_PER_INCH = 25.4;

export function mmToPixels(mm: number, dpi: number): number {
  return Math.round((mm / MM_PER_INCH) * dpi);
}

export function resolveLayoutExportTarget(layout: LayoutPreset): LayoutExportTarget {
  const trimWidth = Math.max(1, Math.floor(layout.width));
  const trimHeight = Math.max(1, Math.floor(layout.height));

  const bleedPx = resolveBleedPx(layout);
  const exportWidth = trimWidth + bleedPx * 2;
  const exportHeight = trimHeight + bleedPx * 2;

  return bleedPx > 0
    ? {
        trimWidth,
        trimHeight,
        exportWidth,
        exportHeight,
        bleedPx,
        cameraBounds: {
          trimWidth,
          trimHeight,
          bleedPx,
        },
      }
    : {
        trimWidth,
        trimHeight,
        exportWidth,
        exportHeight,
        bleedPx,
      };
}

function resolveBleedPx(layout: LayoutPreset): number {
  if (typeof layout.bleedMM !== 'number' || typeof layout.dpi !== 'number') {
    return 0;
  }

  if (!Number.isFinite(layout.bleedMM) || !Number.isFinite(layout.dpi)) {
    return 0;
  }

  if (layout.bleedMM <= 0 || layout.dpi <= 0) {
    return 0;
  }

  return Math.max(0, mmToPixels(layout.bleedMM, layout.dpi));
}
