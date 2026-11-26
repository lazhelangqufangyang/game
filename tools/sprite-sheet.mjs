/**
 * 把 data/sprites.json 里的像素图渲染成一张 PNG 放大图，用来肉眼检查美术。
 * 用法：node tools/sprite-sheet.mjs
 * 产物：.shots/sprites.png（6 倍放大 + 深色底）
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SCALE = 6;
const PAD = 10;
const COLS = 4;

const PREVIEW_COLOR = {
  hero: '#6ee7ff',
  hero_alt: '#6ee7ff',
  grunt: '#e05c5c',
  runner: '#f0a44a',
  brute: '#a855f7',
  summon_economy: '#ffd166',
  summon_xp: '#5ee6a8',
  summon_essence: '#c084fc',
  pickup: '#ffd166',
};

const sprites = JSON.parse(readFileSync(resolve(ROOT, 'data/sprites.json'), 'utf8'));
const names = Object.keys(sprites).filter((k) => !k.startsWith('_'));

// ---------------------------------------------------------------- 调色板（与 src/assets/pixel.ts 保持一致）
function parseHex(hex) {
  const s = hex.replace('#', '');
  const f = s.length === 3 ? s.split('').map((c) => c + c).join('') : s;
  return [0, 2, 4].map((i) => Number.parseInt(f.slice(i, i + 2), 16));
}

function mixHex(a, b, t) {
  const pa = parseHex(a);
  const pb = parseHex(b);
  return `#${[0, 1, 2]
    .map((i) => Math.max(0, Math.min(255, Math.round(pa[i] + (pb[i] - pa[i]) * t))).toString(16).padStart(2, '0'))
    .join('')}`;
}

function derivePalette(base, overrides = {}) {
  return {
    o: mixHex(base, '#05070d', 0.8),
    d: mixHex(base, '#05070d', 0.42),
    b: base,
    l: mixHex(base, '#ffffff', 0.3),
    h: mixHex(base, '#ffffff', 0.62),
    w: '#f2f8ff',
    k: '#080b12',
    a: mixHex(base, '#ffffff', 0.78),
    ...overrides,
  };
}

// ---------------------------------------------------------------- 布局
const cells = names.map((name) => {
  const entry = sprites[name];
  const rows = entry.rows ?? [];
  const w = Math.max(1, ...rows.map((r) => r.length));
  const h = Math.max(1, rows.length);
  const palette = derivePalette(PREVIEW_COLOR[name] ?? '#ffffff', entry.palette ?? {});
  const badRows = rows
    .map((r, i) => (r.length === w ? null : i))
    .filter((i) => i !== null);
  return { name, rows, w, h, palette, badRows };
});

const cellW = Math.max(...cells.map((c) => c.w)) * SCALE + PAD * 2;
const cellH = Math.max(...cells.map((c) => c.h)) * SCALE + PAD * 2;
const rowsCount = Math.ceil(cells.length / COLS);
const W = cellW * COLS;
const H = cellH * rowsCount;

const buf = Buffer.alloc(W * H * 4);
// 背景：深色 + 每 8px 轻微格线，方便看透明区域
for (let y = 0; y < H; y += 1) {
  for (let x = 0; x < W; x += 1) {
    const grid = x % 8 === 0 || y % 8 === 0;
    const v = grid ? 26 : 20;
    const i = (y * W + x) * 4;
    buf[i] = v;
    buf[i + 1] = v + 3;
    buf[i + 2] = v + 8;
    buf[i + 3] = 255;
  }
}

function blendPixel(px, py, rgb, alpha) {
  if (px < 0 || py < 0 || px >= W || py >= H) return;
  const i = (py * W + px) * 4;
  for (let c = 0; c < 3; c += 1) {
    buf[i + c] = Math.round(buf[i + c] * (1 - alpha) + rgb[c] * alpha);
  }
  buf[i + 3] = 255;
}

for (let idx = 0; idx < cells.length; idx += 1) {
  const cell = cells[idx];
  const cx = (idx % COLS) * cellW;
  const cy = Math.floor(idx / COLS) * cellH;
  for (let y = 0; y < cell.h; y += 1) {
    const row = cell.rows[y] ?? '';
    for (let x = 0; x < row.length; x += 1) {
      const ch = row[x];
      if (ch === '.' || ch === ' ') continue;
      const color = cell.palette[ch];
      if (!color) continue;
      const rgb = parseHex(color);
      for (let sy = 0; sy < SCALE; sy += 1) {
        for (let sx = 0; sx < SCALE; sx += 1) {
          blendPixel(cx + PAD + x * SCALE + sx, cy + PAD + y * SCALE + sy, rgb, 1);
        }
      }
    }
  }
}

// ---------------------------------------------------------------- PNG 编码
const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(bytes) {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8;
ihdr[9] = 6;

const raw = Buffer.alloc((W * 4 + 1) * H);
for (let y = 0; y < H; y += 1) {
  raw[y * (W * 4 + 1)] = 0;
  buf.copy(raw, y * (W * 4 + 1) + 1, y * W * 4, (y + 1) * W * 4);
}

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);

mkdirSync(resolve(ROOT, '.shots'), { recursive: true });
const out = resolve(ROOT, '.shots/sprites.png');
writeFileSync(out, png);

console.log(`已输出 ${out}  (${W}x${H})`);
console.log(`布局 ${COLS} 列 × ${rowsCount} 行：`);
cells.forEach((c, i) => {
  const flag = c.badRows.length > 0 ? `  ⚠ 行宽不一致: ${c.badRows.join(',')}` : '';
  console.log(`  [${i}] ${c.name}  ${c.w}x${c.h}${flag}`);
});
