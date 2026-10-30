// A stored (uncompressed) zip. JPEGs are already compressed, so deflate
// would only cost time. CRC-32 is the part a reader still checks.

const CRC = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC[n] = c >>> 0;
}

function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function u16(view: DataView, offset: number, value: number) {
  view.setUint16(offset, value, true);
}

function u32(view: DataView, offset: number, value: number) {
  view.setUint32(offset, value, true);
}

export type ZipItem = { name: string; data: Uint8Array };

export function zipStore(items: ZipItem[]): Uint8Array {
  const encoder = new TextEncoder();
  const names = items.map((item) => encoder.encode(item.name));
  let localSize = 0;
  const crcs = items.map((item) => crc32(item.data));
  for (let i = 0; i < items.length; i++) localSize += 30 + names[i].length + items[i].data.length;

  let centralSize = 0;
  for (const name of names) centralSize += 46 + name.length;

  const out = new Uint8Array(localSize + centralSize + 22);
  const view = new DataView(out.buffer);
  let offset = 0;
  const starts: number[] = [];

  for (let i = 0; i < items.length; i++) {
    starts.push(offset);
    u32(view, offset, 0x04034b50);
    u16(view, offset + 4, 20);
    u16(view, offset + 6, 0x0800);
    u16(view, offset + 8, 0);
    u16(view, offset + 10, 0);
    u16(view, offset + 12, 0);
    u32(view, offset + 14, crcs[i]);
    u32(view, offset + 18, items[i].data.length);
    u32(view, offset + 22, items[i].data.length);
    u16(view, offset + 26, names[i].length);
    u16(view, offset + 28, 0);
    out.set(names[i], offset + 30);
    out.set(items[i].data, offset + 30 + names[i].length);
    offset += 30 + names[i].length + items[i].data.length;
  }

  const centralStart = offset;
  for (let i = 0; i < items.length; i++) {
    u32(view, offset, 0x02014b50);
    u16(view, offset + 4, 20);
    u16(view, offset + 6, 20);
    u16(view, offset + 8, 0x0800);
    u16(view, offset + 10, 0);
    u16(view, offset + 12, 0);
    u16(view, offset + 14, 0);
    u32(view, offset + 16, crcs[i]);
    u32(view, offset + 20, items[i].data.length);
    u32(view, offset + 24, items[i].data.length);
    u16(view, offset + 28, names[i].length);
    u16(view, offset + 30, 0);
    u16(view, offset + 32, 0);
    u16(view, offset + 34, 0);
    u16(view, offset + 36, 0);
    u32(view, offset + 38, 0);
    u32(view, offset + 42, starts[i]);
    out.set(names[i], offset + 46);
    offset += 46 + names[i].length;
  }

  u32(view, offset, 0x06054b50);
  u16(view, offset + 4, 0);
  u16(view, offset + 6, 0);
  u16(view, offset + 8, items.length);
  u16(view, offset + 10, items.length);
  u32(view, offset + 12, offset - centralStart);
  u32(view, offset + 16, centralStart);
  u16(view, offset + 20, 0);
  return out;
}
