export type ExportId = 'full' | 'website' | 'square' | 'instagram' | 'story';

export type ExportPreset = {
  id: ExportId;
  label: string;
  hint: string;
  /** Width / height. Null keeps the whole frame. */
  aspect: number | null;
  width: number | null;
  height: number | null;
  /** Long-edge cap when the frame is not cropped to a fixed size. */
  longEdge: number;
  suffix: string;
};

export const EXPORTS: ExportPreset[] = [
  {
    id: 'full',
    label: 'Full',
    hint: 'The whole frame, long edge up to 2560.',
    aspect: null,
    width: null,
    height: null,
    longEdge: 2560,
    suffix: '',
  },
  {
    id: 'website',
    label: 'Website',
    hint: 'The whole frame, long edge up to 2048.',
    aspect: null,
    width: null,
    height: null,
    longEdge: 2048,
    suffix: 'web',
  },
  {
    id: 'square',
    label: 'Square',
    hint: '1:1 · 1080×1080. Drag the frame.',
    aspect: 1,
    width: 1080,
    height: 1080,
    longEdge: 2560,
    suffix: 'square',
  },
  {
    id: 'instagram',
    label: '4:5',
    hint: 'Instagram · 1080×1350. Drag the frame.',
    aspect: 4 / 5,
    width: 1080,
    height: 1350,
    longEdge: 2560,
    suffix: '4x5',
  },
  {
    id: 'story',
    label: 'Story',
    hint: 'Story · 1080×1920. Drag the frame.',
    aspect: 9 / 16,
    width: 1080,
    height: 1920,
    longEdge: 2560,
    suffix: 'story',
  },
];

export function exportById(id: ExportId): ExportPreset {
  return EXPORTS.find((item) => item.id === id) ?? EXPORTS[0];
}
