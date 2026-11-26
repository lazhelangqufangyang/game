/**
 * 美术预览页（不启动 Phaser、不依赖 /data 配置）：
 *  - `?sheet=1`（默认）：所有角色 × 4 个姿势帧（基础 / 行走 / 受击 / 死亡）
 *  - 无参数：只渲染战斗背景
 *
 * 用法：npm run dev 后打开 http://127.0.0.1:5173/preview.html?sheet=1
 * 截图：node tools/arena-shot.mjs          → .shots/40-arena.png
 *       node tools/arena-shot.mjs sheet    → .shots/41-poses.png
 */
import spriteData from '../data/sprites.json';
import { ARENA_H, ARENA_W, paintArena } from './assets/arena';
import { deathFrame, hurtFrame, walkFrame, type Rows } from './assets/poses';

const params = new URLSearchParams(location.search);
const canvas = document.getElementById('arena') as HTMLCanvasElement;
const ctx = canvas.getContext('2d');
if (!ctx) throw new Error('无法获取 2D 上下文');

// 注意：模式分发放在文件末尾——模块顶层的 const 还没初始化时调用会触发 TDZ 错误。

// ------------------------------------------------------------------ 背景

function renderArena(context: CanvasRenderingContext2D, el: HTMLCanvasElement): void {
  el.width = ARENA_W;
  el.height = ARENA_H;
  const started = performance.now();
  paintArena(context);
  const cost = performance.now() - started;
  console.info(`[preview] 背景绘制耗时 ${cost.toFixed(1)}ms`);
  document.title = `背景预览 ${cost.toFixed(0)}ms`;
}

// ------------------------------------------------------------------ 姿势总览

interface Entry {
  rows: Rows;
  palette?: Record<string, string>;
  walk?: Rows;
  hurt?: Rows;
  death?: Rows;
}

const PREVIEW_COLOR: Record<string, string> = {
  hero: '#6ee7ff',
  hero_alt: '#6ee7ff',
  grunt: '#e05c5c',
  runner: '#f0a44a',
  brute: '#a855f7',
  warden: '#ff4d6d',
  summon_economy: '#ffd166',
  summon_xp: '#5ee6a8',
  summon_essence: '#c084fc',
  pickup: '#ffd166',
};

const POSE_NAMES = ['基础', '行走', '受击', '死亡'];

function renderSheet(context: CanvasRenderingContext2D, el: HTMLCanvasElement): void {
  const entries = Object.entries(spriteData as unknown as Record<string, unknown>).filter(
    ([key]) => !key.startsWith('_'),
  ) as Array<[string, Entry]>;

  const SCALE = 4;
  const PAD = 14;
  const LABEL_W = 64;
  const HEADER_H = 26;

  const posesOf = (e: Entry): Rows[] => [
    e.rows,
    e.walk ?? walkFrame(e.rows),
    e.hurt ?? hurtFrame(e.rows),
    e.death ?? deathFrame(e.rows),
  ];

  const cols = entries.map(([name, e]) => {
    const poses = posesOf(e);
    const w = Math.max(...poses.map((r) => Math.max(1, ...r.map((s) => s.length))));
    const h = Math.max(...poses.map((r) => r.length));
    return {
      w,
      h,
      poses,
      palette: derivePalette(PREVIEW_COLOR[name] ?? '#ffffff', e.palette ?? {}),
    };
  });

  const cellW = Math.max(...cols.map((c) => c.w)) * SCALE + PAD * 2;
  const cellH = Math.max(...cols.map((c) => c.h)) * SCALE + PAD * 2;
  const W = LABEL_W + cellW * cols.length;
  const H = HEADER_H + cellH * 4;

  el.width = W;
  el.height = H;
  context.fillStyle = '#0b0e14';
  context.fillRect(0, 0, W, H);

  // 网格底
  for (let y = 0; y < H; y += 8) {
    for (let x = 0; x < W; x += 8) {
      context.fillStyle = (x / 8 + y / 8) % 2 === 0 ? '#0d1119' : '#0f1420';
      context.fillRect(x, y, 8, 8);
    }
  }

  context.font = '12px "Microsoft YaHei", monospace';
  context.textBaseline = 'middle';

  entries.forEach(([name], ci) => {
    context.fillStyle = '#8a97ab';
    context.fillText(name, LABEL_W + cellW * ci + PAD, HEADER_H / 2);
  });

  POSE_NAMES.forEach((label, ri) => {
    context.fillStyle = '#6ee7ff';
    context.fillText(label, 8, HEADER_H + cellH * ri + cellH / 2);
  });

  entries.forEach(([, e], ci) => {
    const col = cols[ci]!;
    posesOf(e).forEach((rows, ri) => {
      const baseX = LABEL_W + cellW * ci + PAD;
      const baseY = HEADER_H + cellH * ri + PAD;
      rows.forEach((row, y) => {
        for (let x = 0; x < row.length; x += 1) {
          const ch = row[x]!;
          if (ch === '.' || ch === ' ') continue;
          const color = col.palette[ch];
          if (!color) continue;
          context.fillStyle = color;
          context.fillRect(baseX + x * SCALE, baseY + y * SCALE, SCALE, SCALE);
        }
      });
    });
  });

  document.title = `姿势总览 ${entries.length}×4`;
}

// ---------------------------------------------------------------- 调色板

function parseHex(hex: string): [number, number, number] {
  const s = hex.replace('#', '');
  const f = s.length === 3 ? s.split('').map((c) => c + c).join('') : s;
  return [0, 2, 4].map((i) => Number.parseInt(f.slice(i, i + 2), 16)) as [number, number, number];
}

function mixHex(a: string, b: string, t: number): string {
  const pa = parseHex(a);
  const pb = parseHex(b);
  return `#${[0, 1, 2]
    .map((i) =>
      Math.max(0, Math.min(255, Math.round(pa[i]! + (pb[i]! - pa[i]!) * t)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}

function derivePalette(base: string, overrides: Record<string, string>): Record<string, string> {
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
// ---------------------------------------------------------------- 启动

if (params.get('sheet') === '1') {
  renderSheet(ctx, canvas);
} else {
  renderArena(ctx, canvas);
}