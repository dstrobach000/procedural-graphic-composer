export type ExportPresetId = 'instagram-1080x1350' | 'custom';

export type ExportPreset = {
  id: ExportPresetId;
  label: string;
  width: number;
  height: number;
};

export const exportPresets: ExportPreset[] = [
  {
    id: 'instagram-1080x1350',
    label: 'Instagram 1080x1350',
    width: 1080,
    height: 1350,
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
