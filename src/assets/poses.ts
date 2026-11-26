/**
 * 姿势帧：从一张基础像素图派生出行走 / 受击 / 死亡帧。
 *
 * 为什么用派生而不是手画：怪物是数据驱动的（`data/sprites.json`），
 * 手画每种怪的 4 个姿势容易漏、且新增怪物就得再画一遍。
 * 派生保证「任何新怪物自动拥有三套帧」，同时允许在 sprites.json 里
 * 用同名 `walk` / `hurt` / `death` 条目覆盖（见 docs/art.md）。
 *
 * 本模块是纯函数、不 import Phaser，方便预览页与工具复用。
 */

export type Rows = readonly string[];

function widthOf(rows: Rows): number {
  return Math.max(1, ...rows.map((r) => r.length));
}

function padded(rows: Rows): string[] {
  const w = widthOf(rows);
  return rows.map((r) => r.padEnd(w, '.'));
}

/**
 * 行走第 2 帧：把下半身整体向两侧张开，读作「迈步」。
 * @param amp 张开像素数
 */
export function walkFrame(rows: Rows, amp = 2): string[] {
  const src = padded(rows);
  const w = widthOf(src);
  const legFrom = Math.floor(src.length * 0.82);

  return src.map((row, y) => {
    if (y < legFrom) return row;
    let out = '';
    for (let x = 0; x < w; x += 1) {
      const leftHalf = x < w / 2;
      out += row[leftHalf ? x + amp : x - amp] ?? '.';
    }
    return out;
  });
}

/** 受击帧：横向向中心收 1px、整体下移 1px，读作「被打得一缩」。 */
export function hurtFrame(rows: Rows): string[] {
  const src = padded(rows);
  const w = widthOf(src);

  const squeezed = src.map((row) => {
    let out = '';
    for (let x = 0; x < w; x += 1) {
      const leftHalf = x < w / 2;
      out += row[leftHalf ? x + 1 : x - 1] ?? '.';
    }
    return out;
  });

  return ['.'.repeat(w), ...squeezed.slice(0, -1)];
}

/** 死亡帧：垂直压扁成「塌下去」的一坨，配合淡化与碎块使用。 */
export function deathFrame(rows: Rows, ratio = 0.42): string[] {
  const src = padded(rows);
  const w = widthOf(src);
  const h = src.length;
  const outH = Math.max(5, Math.round(h * ratio));

  const out: string[] = [];
  for (let y = 0; y < outH; y += 1) {
    const srcY = Math.min(h - 1, Math.round((y / Math.max(1, outH - 1)) * (h - 1)));
    out.push(src[srcY] ?? '.'.repeat(w));
  }
  return out;
}
