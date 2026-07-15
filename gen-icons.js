// Genera le icone PNG della PWA senza dipendenze esterne.
// Icona: quadrato bordeaux (maskable) + documento bianco con righe.
// Uso: node gen-icons.js  (già eseguito; rilancialo solo se cambi i colori)
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const WINE = [142, 32, 67]; // bordeaux (#8e2043)
const WINE_DARK = [96, 18, 42];
const WHITE = [255, 255, 255];

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'latin1');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePng(size, pixels) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter none
    pixels.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

function roundedInside(x, y, l, t, r, b, rad) {
  if (x < l || x >= r || y < t || y >= b) return false;
  const cx = x < l + rad ? l + rad : x > r - 1 - rad ? r - 1 - rad : x;
  const cy = y < t + rad ? t + rad : y > b - 1 - rad ? b - 1 - rad : y;
  const dx = x - cx, dy = y - cy;
  return dx * dx + dy * dy <= rad * rad;
}

function draw(size) {
  const px = Buffer.alloc(size * size * 4);
  const s = size;
  const docL = Math.round(s * 0.28), docR = Math.round(s * 0.72);
  const docT = Math.round(s * 0.18), docB = Math.round(s * 0.82);
  const docRad = Math.round(s * 0.06);
  const bars = [
    { y: 0.34, w: 0.52 },
    { y: 0.46, w: 0.72 },
    { y: 0.58, w: 0.6 },
    { y: 0.7, w: 0.4 },
  ];
  const barH = Math.max(2, Math.round(s * 0.035));
  const barL = docL + Math.round(s * 0.06);

  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const i = (y * s + x) * 4;
      const g = (x + y) / (2 * s); // leggero gradiente diagonale
      let col = [
        Math.round(WINE[0] + (WINE_DARK[0] - WINE[0]) * g),
        Math.round(WINE[1] + (WINE_DARK[1] - WINE[1]) * g),
        Math.round(WINE[2] + (WINE_DARK[2] - WINE[2]) * g),
      ];
      if (roundedInside(x, y, docL, docT, docR, docB, docRad)) {
        col = WHITE;
        for (const bar of bars) {
          const by = Math.round(s * bar.y);
          const bw = Math.round((docR - docL - 2 * (barL - docL)) * bar.w);
          if (y >= by && y < by + barH && x >= barL && x < barL + bw) {
            col = WINE;
          }
        }
      }
      px[i] = col[0];
      px[i + 1] = col[1];
      px[i + 2] = col[2];
      px[i + 3] = 255;
    }
  }
  return px;
}

const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'public');
for (const size of [192, 512]) {
  const png = encodePng(size, draw(size));
  fs.writeFileSync(path.join(outDir, `icon-${size}.png`), png);
  console.log(`icon-${size}.png (${png.length} byte)`);
}
console.log('Icone generate.');
