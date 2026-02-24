export type ExportPresetId =
  | 'current-layout'
  | 'instagram-1080x1350'
  | 'facebook-event-1920x1005'
  | 'a3-3508x4961'
  | 'a6-1748x1240'
  | 'custom';

export type ExportPreset = {
  id: ExportPresetId;
  label: string;
  width: number;
  height: number;
};

export const exportPresets: ExportPreset[] = [
  {
    id: 'current-layout',
    label: 'Current Layout',
    width: 0,
    height: 0,
  },
  {
    id: 'instagram-1080x1350',
    label: 'Instagram 1080x1350',
    width: 1080,
    height: 1350,
  },
  {
    id: 'facebook-event-1920x1005',
    label: 'Facebook Event 1920x1005',
    width: 1920,
    height: 1005,
  },
  {
    id: 'a3-3508x4961',
    label: 'A3 3508x4961 (300dpi)',
    width: 3508,
    height: 4961,
  },
  {
    id: 'a6-1748x1240',
    label: 'A6 1748x1240 (300dpi)',
    width: 1748,
    height: 1240,
  },
  {
    id: 'custom',
    label: 'Custom',
    width: 1080,
    height: 1350,
  },
];

export function getPresetById(id: ExportPresetId): ExportPreset {
  const found = exportPresets.find((preset) => preset.id === id);
  if (!found) {
    return exportPresets[0];
  }
  return found;
}
