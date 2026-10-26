// Shared by the texture generators (generate-alloy-textures.mjs,
// generate-family-textures.mjs): an 8-bit greyscale+alpha PNG as a data URI,
// and a seeded random source so every generated tile is stable.
import { deflateSync } from 'node:zlib';

// pixel(x, y) -> [grey 0-255, alpha 0-255]
export function png(width, height, pixel) {
  const raw = Buffer.alloc(height * (1 + width * 2));
  for (let y = 0; y < height; y++) {
    const row = y * (1 + width * 2);
    raw[row] = 0;
    for (let x = 0; x < width; x++) {
      const [grey, alpha] = pixel(x, y);
      raw[row + 1 + x * 2] = grey;
      raw[row + 2 + x * 2] = alpha;
    }
  }
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc32 = (buf) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 4; // 8-bit greyscale + alpha
  return `data:image/png;base64,${Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]).toString('base64')}`;
}

export function seeded(seed) {
  return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 0x100000000);
}
