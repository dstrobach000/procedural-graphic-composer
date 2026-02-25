import { describe, expect, it } from 'vitest';
import { resolveLayoutExportTarget, mmToPixels } from './layoutExport';

describe('layout export bleed', () => {
  it('converts mm to pixels with stable rounding', () => {
    expect(mmToPixels(3, 300)).toBe(35);
    expect(mmToPixels(3, 72)).toBe(9);
  });

  it('resolves export size with symmetrical bleed', () => {
    const target = resolveLayoutExportTarget({
      id: 'a3_300dpi',
      name: 'A3',
      width: 3508,
      height: 4961,
      bleedMM: 3,
      dpi: 300,
    });

    expect(target.bleedPx).toBe(35);
    expect(target.exportWidth).toBe(3578);
    expect(target.exportHeight).toBe(5031);
    expect(target.cameraBounds).toEqual({
      trimWidth: 3508,
      trimHeight: 4961,
      bleedPx: 35,
    });
  });

  it('keeps trim size for layouts without bleed', () => {
    const target = resolveLayoutExportTarget({
      id: 'instagramPortrait',
      name: 'Instagram',
      width: 1080,
      height: 1350,
    });

    expect(target.bleedPx).toBe(0);
    expect(target.exportWidth).toBe(1080);
    expect(target.exportHeight).toBe(1350);
    expect(target.cameraBounds).toBeUndefined();
  });
});
