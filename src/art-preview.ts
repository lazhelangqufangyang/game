/**
 * 美术预览页（不启动 Phaser、不依赖 /data 配置）：
 *  - `?sheet=1`（默认）：所有角色 × 4 个姿势帧（基础 / 行走 / 受击 / 死亡）
 *  - 无参数：只渲染战斗背景
 *
 * 用法：npm run dev 后打开 http://127.0.0.1:5173/preview.html?sheet=1
 * 截图：node tools/arena-shot.mjs          → .shots/40-arena.png
 *       node tools/arena-shot.mjs sheet    → .shots/41-poses.png
 */
import promptData from '../data/art-prompts.json';
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

// ------------------------------------------------------------------ AI 出图 prompt 卡片

interface PromptEntry {
  label: string;
  sprite: string;
  grid: [number, number];
  size: [number, number];
  color: string;
  color_name: string;
  radius: number;
  subject: string;
  frames: string;
  file: string;
}

/** 风格块：每张卡都带，只替换 {COLOR} / {GRID} / {SIZE}。 */
const STYLE_TEMPLATE =
  'pixel art game sprite, top-down 3/4 view, single character centered, facing the viewer, ' +
  '{COLOR} dominant palette with exactly 3 value steps (dark / base / light), ' +
  'near-black outline, bright white eyes, chunky readable silhouette, ' +
  '{GRID} logical pixel grid upscaled to {SIZE}, hard square pixels, no anti-aliasing, ' +
  'flat transparent background, no ground shadow, no glow, no text, no border';

const NEGATIVE =
  'blurry, anti-aliased, smooth gradient shading, soft shadow, drop shadow, glow, bloom, ' +
  '3d render, cgi, photorealistic, painterly, watercolor, anime, sketch, line art, ' +
  'text, watermark, signature, border, frame, multiple characters overlapping, ' +
  'top-down view from above, extra limbs, deformed';

const PROMPTS = Object.entries(promptData as unknown as Record<string, unknown>)
  .filter(([key]) => !key.startsWith('_'))
  .map(([key, value]) => [key, value as PromptEntry] as const);

function styleFor(e: PromptEntry): string {
  return STYLE_TEMPLATE.replace('{COLOR}', e.color_name)
    .replace('{GRID}', `${e.grid[0]}x${e.grid[1]}`)
    .replace('{SIZE}', `${e.size[0]}x${e.size[1]}`);
}

function fullPrompt(e: PromptEntry): string {
  return `${styleFor(e)}\n\nsubject: ${e.subject}\n\nframes: ${e.frames}`;
}

function wrapText(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const out: string[] = [];
  for (const paragraph of text.split('\n')) {
    if (paragraph.trim() === '') {
      out.push('');
      continue;
    }
    let line = '';
    for (const word of paragraph.split(' ')) {
      const next = line ? `${line} ${word}` : word;
      if (context.measureText(next).width > maxWidth && line) {
        out.push(line);
        line = word;
      } else {
        line = next;
      }
    }
    out.push(line);
  }
  return out;
}

const SPRITES = spriteData as unknown as Record<string, Entry>;

function drawSprite(
  context: CanvasRenderingContext2D,
  name: string,
  x: number,
  y: number,
  boxW: number,
  boxH: number,
): void {
  const e = SPRITES[name];
  if (!e) return;
  const rows = e.rows;
  const w = Math.max(1, ...rows.map((r) => r.length));
  const h = rows.length;
  const scale = Math.max(2, Math.floor(Math.min(boxW / w, boxH / h)));
  const palette = derivePalette(PREVIEW_COLOR[name] ?? '#ffffff', e.palette ?? {});
  const ox = Math.round(x + (boxW - w * scale) / 2);
  const oy = Math.round(y + (boxH - h * scale) / 2);
  rows.forEach((row, ry) => {
    for (let rx = 0; rx < row.length; rx += 1) {
      const ch = row[rx]!;
      if (ch === '.' || ch === ' ') continue;
      const color = palette[ch];
      if (!color) continue;
      context.fillStyle = color;
      context.fillRect(ox + rx * scale, oy + ry * scale, scale, scale);
    }
  });
}

function renderCards(context: CanvasRenderingContext2D, el: HTMLCanvasElement): void {
  const S = 2;
  const CARD_W = 700;
  const CARD_H = 286;
  const GAP = 18;
  const PAD = 30;
  const COLS = 2;
  const TITLE_H = 84;
  const FOOTER_H = 118;

  const rows = Math.ceil(PROMPTS.length / COLS);
  const W = PAD * 2 + CARD_W * COLS + GAP * (COLS - 1);
  const H = TITLE_H + rows * CARD_H + GAP * (rows - 1) + FOOTER_H + PAD;

  el.width = W * S;
  el.height = H * S;
  context.setTransform(S, 0, 0, S, 0, 0);
  context.textBaseline = 'top';

  // 背景
  context.fillStyle = '#0a0e15';
  context.fillRect(0, 0, W, H);

  // 标题
  context.fillStyle = '#e6edf7';
  context.font = 'bold 26px "Microsoft YaHei", system-ui, sans-serif';
  context.fillText('AI 出图 Prompt 卡 · 波次防守肉鸽', PAD, 26);
  context.fillStyle = '#8a97ab';
  context.font = '14px "Microsoft YaHei", system-ui, sans-serif';
  context.fillText(
    '每张卡右侧文字可直接复制；左侧是当前占位图，仅用于说明构图与配色。所有单位都需要「基础 / 行走 / 受击 / 死亡」4 帧。',
    PAD,
    60,
  );

  PROMPTS.forEach(([, e], index) => {
    const col = index % COLS;
    const row = Math.floor(index / COLS);
    const x = PAD + col * (CARD_W + GAP);
    const y = TITLE_H + row * (CARD_H + GAP);

    // 卡片底
    context.fillStyle = '#0d131c';
    context.fillRect(x, y, CARD_W, CARD_H);
    context.strokeStyle = '#1f2a3a';
    context.lineWidth = 1;
    context.strokeRect(x + 0.5, y + 0.5, CARD_W - 1, CARD_H - 1);

    // 左侧预览区（纯色面板，别用棋盘格，否则像素图会跟底纹打架）
    const boxW = 190;
    const boxH = CARD_H - 44;
    context.fillStyle = '#121a26';
    context.fillRect(x + 18, y + 22, boxW, boxH);
    context.strokeStyle = '#1b2534';
    context.lineWidth = 1;
    context.strokeRect(x + 18.5, y + 22.5, boxW - 1, boxH - 1);
    drawSprite(context, e.sprite, x + 18, y + 22, boxW, boxH);

    // 文件名
    context.fillStyle = '#6ee7ff';
    context.font = '12px "Consolas", monospace';
    context.fillText(`${e.file}_idle.png`, x + 18, y + CARD_H - 20);

    // 右侧文字
    const tx = x + 18 + boxW + 20;
    const tw = CARD_W - (boxW + 20) - 36;

    context.fillStyle = '#e6edf7';
    context.font = 'bold 17px "Microsoft YaHei", system-ui, sans-serif';
    context.fillText(e.label, tx, y + 16);

    context.fillStyle = '#8a97ab';
    context.font = '12px "Consolas", monospace';
    context.fillText(
      `${e.grid[0]}x${e.grid[1]}  ·  ${e.color}  ·  ${e.size[0]}x${e.size[1]}  ·  radius ${e.radius}`,
      tx,
      y + 40,
    );

    context.fillStyle = '#c8d3e2';
    context.font = '12.5px "Consolas", monospace';
    const lines = wrapText(context, fullPrompt(e), tw);
    lines.forEach((line, i) => {
      context.fillText(line, tx, y + 62 + i * 16.5);
    });
  });

  // 负面词
  const fy = TITLE_H + rows * CARD_H + GAP * (rows - 1) + 22;
  context.fillStyle = '#0d131c';
  context.fillRect(PAD, fy, W - PAD * 2, FOOTER_H - 40);
  context.strokeStyle = '#3a2430';
  context.strokeRect(PAD + 0.5, fy + 0.5, W - PAD * 2 - 1, FOOTER_H - 41);

  context.fillStyle = '#ff5c7a';
  context.font = 'bold 14px "Microsoft YaHei", system-ui, sans-serif';
  context.fillText('通用 Negative Prompt（每次都要带上）', PAD + 16, fy + 14);

  context.fillStyle = '#c8d3e2';
  context.font = '12.5px "Consolas", monospace';
  wrapText(context, NEGATIVE, W - PAD * 2 - 32).forEach((line, i) => {
    context.fillText(line, PAD + 16, fy + 40 + i * 16.5);
  });

  document.title = `prompt 卡片 ${PROMPTS.length} 张 ${W}x${H}`;
}

// ------------------------------------------------------------------ 风格参考图（透明底）

function renderReference(context: CanvasRenderingContext2D, el: HTMLCanvasElement): void {
  const S = 2;
  const CELL = 320;
  const COLS = 5;
  const rows = Math.ceil(PROMPTS.length / COLS);
  const LABEL_H = 46;
  const W = CELL * COLS;
  const H = (CELL + LABEL_H) * rows;

  el.width = W * S;
  el.height = H * S;
  context.setTransform(S, 0, 0, S, 0, 0);
  context.clearRect(0, 0, W, H);
  context.textBaseline = 'top';

  PROMPTS.forEach(([, e], index) => {
    const col = index % COLS;
    const row = Math.floor(index / COLS);
    const x = col * CELL;
    const y = row * (CELL + LABEL_H);
    drawSprite(context, e.sprite, x, y + 8, CELL, CELL - 16);

    context.fillStyle = '#6ee7ff';
    context.font = 'bold 15px "Consolas", monospace';
    context.textAlign = 'center';
    context.fillText(
      `${e.file}  ${e.grid[0]}x${e.grid[1]}`,
      x + CELL / 2,
      y + CELL,
    );
    context.textAlign = 'left';
  });

  document.title = `风格参考图 ${W}x${H}`;
}
// ---------------------------------------------------------------- 启动

const mode = params.get('sheet') === '1'
  ? 'sheet'
  : params.get('cards') === '1'
    ? 'cards'
    : params.get('ref') === '1'
      ? 'ref'
      : 'arena';

if (mode === 'sheet') renderSheet(ctx, canvas);
else if (mode === 'cards') renderCards(ctx, canvas);
else if (mode === 'ref') renderReference(ctx, canvas);
else renderArena(ctx, canvas);