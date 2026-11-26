import Phaser from 'phaser';

/** 像素图：一组等宽字符行，'.' / ' ' 表示透明。 */
export type PixelRows = readonly string[];

/** 字符 → 颜色。角色含义见 data/sprites.json 的 _comment。 */
export type Palette = Record<string, string>;

/** 由实体主色派生出的默认调色板。 */
export function derivePalette(base: string, overrides: Palette = {}): Palette {
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

export function mixHex(a: string, b: string, t: number): string {
  const pa = parseHex(a);
  const pb = parseHex(b);
  const channel = (i: number): string => {
    const v = Math.round(pa[i]! + (pb[i]! - pa[i]!) * t);
    return Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0');
  };
  return `#${channel(0)}${channel(1)}${channel(2)}`;
}

function parseHex(hex: string): [number, number, number] {
  const s = hex.replace('#', '');
  const full = s.length === 3 ? s.split('').map((c) => c + c).join('') : s;
  return [
    Number.parseInt(full.slice(0, 2), 16),
    Number.parseInt(full.slice(2, 4), 16),
    Number.parseInt(full.slice(4, 6), 16),
  ];
}

/**
 * 把字符矩阵编译成一张 1 像素 = 1 纹素的 CanvasTexture，并设置 NEAREST 采样。
 * 贴图已存在时直接跳过（场景重启不会重复生成）。
 */
export function compileRows(
  scene: Phaser.Scene,
  key: string,
  rows: PixelRows,
  palette: Palette,
): void {
  if (scene.textures.exists(key)) return;
  if (rows.length === 0) {
    console.warn(`[pixel] ${key}: 没有像素行，跳过`);
    return;
  }

  const width = Math.max(1, ...rows.map((r) => r.length));
  const height = rows.length;
  const maxWidth = Math.max(...rows.map((r) => r.length));
  if (rows.some((r) => r.length !== maxWidth)) {
    console.warn(`[pixel] ${key}: 像素行宽度不一致（最大 ${maxWidth}），未对齐的行会左对齐渲染`);
  }

  const texture = scene.textures.createCanvas(key, width, height);
  if (!texture) {
    console.warn(`[pixel] ${key}: 创建 CanvasTexture 失败`);
    return;
  }

  const ctx = texture.getContext();
  ctx.clearRect(0, 0, width, height);
  const unknown = new Set<string>();

  for (let y = 0; y < height; y += 1) {
    const row = rows[y] ?? '';
    for (let x = 0; x < row.length; x += 1) {
      const ch = row[x]!;
      if (ch === '.' || ch === ' ') continue;
      const color = palette[ch];
      if (!color) {
        unknown.add(ch);
        continue;
      }
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    }
  }

  if (unknown.size > 0) {
    console.warn(`[pixel] ${key}: 调色板缺少字符 ${[...unknown].join(' ')}`);
  }

  texture.refresh();
  texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
}

/** 生成一张纯程序化绘制的贴图（背景砖块、渐变等用它）。 */
export function compileCanvas(
  scene: Phaser.Scene,
  key: string,
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  filter: Phaser.Textures.FilterMode = Phaser.Textures.FilterMode.NEAREST,
): void {
  if (scene.textures.exists(key)) return;
  const texture = scene.textures.createCanvas(key, width, height);
  if (!texture) return;
  const ctx = texture.getContext();
  ctx.clearRect(0, 0, width, height);
  draw(ctx, width, height);
  texture.refresh();
  texture.setFilter(filter);
}
