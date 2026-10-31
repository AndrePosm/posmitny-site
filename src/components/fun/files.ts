export const MAX_FILE = 25 * 1024 * 1024;
export const MAX_ROLL = 12;

export function isImage(file: File): boolean {
  if (file.type.startsWith('image/')) return true;
  return /\.(jpe?g|png|webp|gif|avif)$/i.test(file.name);
}

export function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'photo';
}

export function stem(name: string): string {
  return name.replace(/\.[^.]+$/, '') || 'Your photo';
}

export function shortName(cap: string): string {
  const i = cap.indexOf('·');
  return (i === -1 ? cap : cap.slice(0, i)).trim();
}

export function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2500);
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('load'));
    img.src = src;
  });
}
