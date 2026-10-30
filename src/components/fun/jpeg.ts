/**
 * Drop EXIF (APP1, which also holds GPS) and IPTC (APP13) from a JPEG.
 * Canvas already encodes a fresh file; this is the guarantee if a segment
 * ever comes along with the bytes.
 */
export function stripJpegMetadata(bytes: Uint8Array): Uint8Array {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return bytes;

  const parts: Uint8Array[] = [bytes.subarray(0, 2)];
  let i = 2;

  while (i + 1 < bytes.length) {
    if (bytes[i] !== 0xff) {
      parts.push(bytes.subarray(i));
      break;
    }
    while (i < bytes.length && bytes[i] === 0xff) i += 1;
    if (i >= bytes.length) break;
    const marker = bytes[i];
    i += 1;

    // Start of scan: the rest is entropy-coded data, through to the end.
    if (marker === 0xda) {
      parts.push(new Uint8Array([0xff, marker]));
      parts.push(bytes.subarray(i));
      break;
    }
    // Standalone markers (RST, SOI, EOI, TEM).
    if (marker === 0xd9 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      parts.push(new Uint8Array([0xff, marker]));
      if (marker === 0xd9) break;
      continue;
    }
    if (i + 1 >= bytes.length) break;
    const len = (bytes[i] << 8) | bytes[i + 1];
    if (len < 2 || i + len > bytes.length) {
      parts.push(bytes.subarray(i - 2));
      break;
    }
    // APP1 is EXIF / XMP (and GPS lives inside EXIF). APP13 is IPTC.
    const drop = marker === 0xe1 || marker === 0xed;
    if (!drop) {
      const seg = new Uint8Array(2 + len);
      seg[0] = 0xff;
      seg[1] = marker;
      seg.set(bytes.subarray(i, i + len), 2);
      parts.push(seg);
    }
    i += len;
  }

  let total = 0;
  for (const part of parts) total += part.length;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

export function hasExif(bytes: Uint8Array): boolean {
  let i = 2;
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return false;
  while (i + 3 < bytes.length) {
    if (bytes[i] !== 0xff) return false;
    while (i < bytes.length && bytes[i] === 0xff) i += 1;
    const marker = bytes[i];
    i += 1;
    if (marker === 0xda || marker === 0xd9) return false;
    if (marker === 0xe1 || marker === 0xed) return true;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (i + 1 >= bytes.length) return false;
    const len = (bytes[i] << 8) | bytes[i + 1];
    if (len < 2) return false;
    i += len;
  }
  return false;
}
