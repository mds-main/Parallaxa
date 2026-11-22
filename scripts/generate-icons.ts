/** Renders the Parallaxa logo (two overlapping rings) to PNG icons without external tools. */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const PAPER = [0xf7, 0xf5, 0xf0];
const INK = [0x1c, 0x1f, 0x24];
const OCHRE = [0xc9, 0x8a, 0x1b];

function crc32(buf: Buffer) {
  let c = ~0;
  for (const b of buf) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}
function chunk(type: string, data: Buffer) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function render(size: number, inset: number, rounded: boolean): Buffer {
  const rows: Buffer[] = [];
  const r = size * (0.24 - inset / 2);
  const stroke = size * 0.066 * (1 - inset);
  const cy = size / 2;
  const c1 = size * (0.383 + inset / 5);
  const c2 = size * (0.617 - inset / 5);
  const radius = size * 0.22;
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 4);
    for (let x = 0; x < size; x++) {
      let color = PAPER;
      let alpha = 255;
      if (rounded) {
        const dx = Math.max(radius - x, x - (size - 1 - radius), 0);
        const dy = Math.max(radius - y, y - (size - 1 - radius), 0);
        if (Math.hypot(dx, dy) > radius) alpha = 0;
      }
      const ring = (cx: number) => Math.max(0, 1 - Math.abs(Math.hypot(x + 0.5 - cx, y + 0.5 - cy) - r) / (stroke / 2)) ;
      const a2 = Math.min(1, ring(c2) * 2.2);
      const a1 = Math.min(1, ring(c1) * 2.2);
      const mix = (base: number[], top: number[], a: number) => base.map((v, i) => Math.round(v * (1 - a) + top[i]! * a));
      color = mix(color, OCHRE, a2);
      color = mix(color, INK, a1);
      row.set([color[0]!, color[1]!, color[2]!, alpha], 1 + x * 4);
    }
    rows.push(row);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(Buffer.concat(rows))), chunk('IEND', Buffer.alloc(0))]);
}

const out = path.join(process.cwd(), 'public', 'icons');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'icon-192.png'), render(192, 0, true));
fs.writeFileSync(path.join(out, 'icon-512.png'), render(512, 0, true));
fs.writeFileSync(path.join(out, 'maskable-512.png'), render(512, 0.2, false));
fs.writeFileSync(path.join(out, 'apple-touch-icon.png'), render(180, 0.05, false));
fs.writeFileSync(path.join(process.cwd(), 'public', 'favicon.ico'), render(48, 0, true));
console.log('Icons written.');
