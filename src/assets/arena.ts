import Phaser from 'phaser';
import { mulberry32 } from '../core/rng';
import { compileCanvas } from './pixel';

export const ARENA_W = 1280;
export const ARENA_H = 720;

export interface ArenaAnchor {
  x: number;
  y: number;
}

/** 四个火盆位置（画在角落，避开主战场；动态火焰在 ambience.ts 里叠）。 */
export const BRAZIERS: readonly ArenaAnchor[] = [
  { x: 84, y: 92 },
  { x: 1196, y: 92 },
  { x: 84, y: 628 },
  { x: 1196, y: 628 },
];

/** 法阵圆心与半径。 */
export const RITUAL = { x: ARENA_W / 2, y: ARENA_H / 2, radius: 238 } as const;

/**
 * 生成战斗背景。优先用 `src/assets/arena*.png`（丢一张真插画进来即可替换），
 * 没有则程序化画一张「夜晚遗迹斗技场」。
 * @returns 实际使用的贴图 key
 */
export function buildArena(scene: Phaser.Scene): string {
  buildArenaGlowTextures(scene);

  if (scene.textures.exists('arena-src')) {
    console.info('[art] 使用 src/assets/arena*.png 作为战斗背景');
    return 'arena-src';
  }

  compileCanvas(
    scene,
    'arena',
    ARENA_W,
    ARENA_H,
    (ctx) => paintArena(ctx),
    Phaser.Textures.FilterMode.LINEAR,
  );
  return 'arena';
}

/** 火盆光晕、余烬、浮尘、薄雾用的贴图。 */
function buildArenaGlowTextures(scene: Phaser.Scene): void {
  compileCanvas(
    scene,
    'glow-warm',
    256,
    256,
    (ctx, w, h) => {
      const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      g.addColorStop(0, 'rgba(255, 196, 130, 0.95)');
      g.addColorStop(0.32, 'rgba(255, 150, 66, 0.45)');
      g.addColorStop(0.68, 'rgba(255, 112, 32, 0.13)');
      g.addColorStop(1, 'rgba(255, 90, 20, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    },
    Phaser.Textures.FilterMode.LINEAR,
  );

  compileCanvas(
    scene,
    'mote',
    12,
    12,
    (ctx, w, h) => {
      const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      g.addColorStop(0, 'rgba(255, 255, 255, 1)');
      g.addColorStop(0.5, 'rgba(255, 244, 220, 0.55)');
      g.addColorStop(1, 'rgba(255, 240, 210, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    },
    Phaser.Textures.FilterMode.LINEAR,
  );

  compileCanvas(
    scene,
    'mist',
    256,
    256,
    (ctx, w, h) => {
      for (let i = 0; i < 7; i += 1) {
        const rng = mulberry32(0x6d1 + i * 977);
        const cx = w * (0.2 + rng() * 0.6);
        const cy = h * (0.2 + rng() * 0.6);
        const r = w * (0.18 + rng() * 0.26);
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        g.addColorStop(0, 'rgba(150, 190, 220, 0.12)');
        g.addColorStop(1, 'rgba(150, 190, 220, 0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }
    },
    Phaser.Textures.FilterMode.LINEAR,
  );
}

// ------------------------------------------------------------------ 绘制

/** 把整张背景画到给定画布上。抽出来是为了能在美术预览页（preview.html）里单独看。 */
export function paintArena(ctx: CanvasRenderingContext2D): void {
  const W = ARENA_W;
  const H = ARENA_H;
  const rng = mulberry32(0xa17e3);

  ctx.save();
  ctx.clearRect(0, 0, W, H);

  paintNightWash(ctx, W, H);
  paintColorFields(ctx, W, H);
  paintArenaFloor(ctx, W, H, rng);
  paintGrime(ctx, W, H, rng);
  paintCracks(ctx, W, H, rng);
  paintRitualCircle(ctx);
  paintCornerBoulders(ctx, rng);
  paintBraziers(ctx);
  paintLighting(ctx, W, H);
  paintEdgeShadows(ctx, W, H);
  paintVignette(ctx, W, H);
  paintGrain(ctx, W, H, rng);

  ctx.restore();
}

function paintNightWash(ctx: CanvasRenderingContext2D, W: number, H: number): void {
  const base = ctx.createLinearGradient(0, 0, 0, H);
  base.addColorStop(0, '#080d14');
  base.addColorStop(0.45, '#06090f');
  base.addColorStop(1, '#03050a');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, W, H);
}

/** 很轻的大块色域，只用来统一冷暖，不要抢对比。 */
function paintColorFields(ctx: CanvasRenderingContext2D, W: number, H: number): void {
  ctx.save();
  ctx.globalCompositeOperation = 'soft-light';

  softBlob(ctx, W * 0.5, H * 0.46, 720, 'rgba(40, 90, 140, 0.36)');
  softBlob(ctx, W * 0.12, H * 0.14, 440, 'rgba(96, 52, 118, 0.26)');
  softBlob(ctx, W * 0.88, H * 0.88, 470, 'rgba(18, 112, 112, 0.22)');

  ctx.restore();
}

/** 阶梯式圆形竞技场：三层石台，几何清晰、有体积，比铺满石板更"像个场景"。 */
function paintArenaFloor(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  rng: () => number,
): void {
  const cx = W / 2;
  const cy = H / 2;

  // 外圈地面：接近黑，只留一点起伏，避免大片死黑
  ctx.fillStyle = '#080b12';
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 2600; i += 1) {
    const x = rng() * W;
    const y = rng() * H;
    ctx.fillStyle = rng() > 0.5 ? 'rgba(120, 150, 190, 0.022)' : 'rgba(0, 0, 0, 0.16)';
    ctx.fillRect(x, y, 1 + (rng() > 0.9 ? 1 : 0), 1);
  }

  const tiers: Array<{ r: number; hue: number; light: number; seams: number }> = [
    { r: 520, hue: 210, light: 15, seams: 24 },
    { r: 404, hue: 212, light: 18, seams: 20 },
    { r: 292, hue: 214, light: 21, seams: 16 },
  ];

  for (const tier of tiers) {
    // 台面投影：往下偏移一点，读得出"台阶"
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.beginPath();
    ctx.arc(cx, cy + 14, tier.r, 0, Math.PI * 2);
    ctx.fill();

    // 台面
    const g = ctx.createRadialGradient(cx, cy - tier.r * 0.42, tier.r * 0.08, cx, cy, tier.r);
    g.addColorStop(0, hsl(tier.hue, 13, tier.light + 8));
    g.addColorStop(0.55, hsl(tier.hue, 15, tier.light));
    g.addColorStop(1, hsl(tier.hue + 4, 17, tier.light - 7));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, tier.r, 0, Math.PI * 2);
    ctx.fill();

    // 放射石缝
    for (let i = 0; i < tier.seams; i += 1) {
      const a = (i / tier.seams) * Math.PI * 2 + (tier.r % 7) * 0.02;
      const jitter = (rng() - 0.5) * 0.05;
      ctx.strokeStyle = 'rgba(4, 7, 12, 0.34)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * (tier.r * 0.34), cy + Math.sin(a) * (tier.r * 0.34));
      ctx.lineTo(cx + Math.cos(a + jitter) * tier.r, cy + Math.sin(a + jitter) * tier.r);
      ctx.stroke();
    }

    // 同心石缝
    for (const k of [0.52, 0.78]) {
      ctx.strokeStyle = 'rgba(4, 7, 12, 0.26)';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.arc(cx, cy, tier.r * k, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 台缘：上侧亮、下侧暗，做出倒角
    ctx.lineWidth = 3;
    ctx.strokeStyle = `hsla(${tier.hue}, 16%, ${tier.light + 20}%, 0.42)`;
    ctx.beginPath();
    ctx.arc(cx, cy, tier.r - 1.5, Math.PI * 0.92, Math.PI * 2.08);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(2, 4, 8, 0.55)';
    ctx.beginPath();
    ctx.arc(cx, cy, tier.r - 1.5, Math.PI * 0.08, Math.PI * 0.92);
    ctx.stroke();

    // 石面细粒
    const dots = Math.floor(tier.r * 1.6);
    for (let i = 0; i < dots; i += 1) {
      const a = rng() * Math.PI * 2;
      const rad = Math.sqrt(rng()) * tier.r;
      const x = cx + Math.cos(a) * rad;
      const y = cy + Math.sin(a) * rad;
      ctx.fillStyle = rng() > 0.5 ? 'rgba(255, 255, 255, 0.035)' : 'rgba(0, 0, 0, 0.2)';
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

/** 苔藓/污渍/旧血痕。 */
function paintGrime(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  rng: () => number,
): void {
  const kinds: Array<{ color: string; alpha: number }> = [
    { color: '46, 82, 60', alpha: 0.32 },
    { color: '74, 50, 34', alpha: 0.28 },
    { color: '32, 42, 58', alpha: 0.4 },
    { color: '92, 30, 38', alpha: 0.2 },
  ];

  for (let i = 0; i < 22; i += 1) {
    const kind = kinds[i % kinds.length]!;
    const x = rng() * W;
    const y = rng() * H;
    const r = 60 + rng() * 180;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${kind.color}, ${kind.alpha})`);
    g.addColorStop(0.6, `rgba(${kind.color}, ${kind.alpha * 0.5})`);
    g.addColorStop(1, `rgba(${kind.color}, 0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * (0.5 + rng() * 0.6), rng() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
}

function paintCracks(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  rng: () => number,
): void {
  for (let i = 0; i < 6; i += 1) {
    let x = rng() * W;
    let y = rng() * H;
    let angle = rng() * Math.PI * 2;
    const segments = 5 + Math.floor(rng() * 7);
    const points: Array<{ x: number; y: number }> = [{ x, y }];
    for (let s = 0; s < segments; s += 1) {
      angle += (rng() - 0.5) * 1.1;
      const len = 10 + rng() * 22;
      x += Math.cos(angle) * len;
      y += Math.sin(angle) * len;
      points.push({ x, y });
    }

    ctx.strokeStyle = 'rgba(4, 6, 10, 0.38)';
    ctx.lineWidth = 0.8 + rng() * 0.8;
    strokePath(ctx, points);

    ctx.strokeStyle = 'rgba(180, 200, 220, 0.05)';
    ctx.lineWidth = 0.8;
    strokePath(
      ctx,
      points.map((p) => ({ x: p.x + 1, y: p.y + 1 })),
    );
  }
}

function strokePath(
  ctx: CanvasRenderingContext2D,
  points: Array<{ x: number; y: number }>,
): void {
  ctx.beginPath();
  ctx.moveTo(points[0]!.x, points[0]!.y);
  for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i]!.x, points[i]!.y);
  ctx.stroke();
}

/** 中央法阵：只做很淡的暗示，不能盖住角色。 */
function paintRitualCircle(ctx: CanvasRenderingContext2D): void {
  const { x: cx, y: cy, radius: R } = RITUAL;

  ctx.save();

  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.3);
  glow.addColorStop(0, 'rgba(80, 205, 230, 0.11)');
  glow.addColorStop(0.5, 'rgba(60, 170, 210, 0.05)');
  glow.addColorStop(1, 'rgba(40, 140, 190, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(cx - R * 1.3, cy - R * 1.3, R * 2.6, R * 2.6);

  ctx.lineCap = 'round';

  const rings: Array<[number, number, number]> = [
    [R, 3, 0.15],
    [R - 26, 1.3, 0.09],
    [R - 46, 1.8, 0.12],
  ];
  for (const [r, width, alpha] of rings) {
    ctx.strokeStyle = `rgba(110, 226, 240, ${alpha})`;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  for (let i = 0; i < 48; i += 1) {
    const a = (i / 48) * Math.PI * 2;
    const long = i % 4 === 0;
    const r0 = R - 26;
    const r1 = R - 26 - (long ? 16 : 7);
    ctx.strokeStyle = `rgba(120, 230, 245, ${long ? 0.22 : 0.12})`;
    ctx.lineWidth = long ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
    ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
    ctx.stroke();
  }

  for (const offset of [0, Math.PI / 3]) {
    ctx.beginPath();
    for (let i = 0; i < 3; i += 1) {
      const a = offset + (i / 3) * Math.PI * 2 - Math.PI / 2;
      const px = cx + Math.cos(a) * (R - 62);
      const py = cy + Math.sin(a) * (R - 62);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.strokeStyle = 'rgba(110, 226, 240, 0.09)';
    ctx.lineWidth = 1.4;
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.arc(cx, cy, 34, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(130, 235, 250, 0.16)';
  ctx.lineWidth = 1.8;
  ctx.stroke();

  ctx.restore();
}

/** 四角巨石堆：把"墙"做出体积，同时不挡住四个刷怪边。 */
function paintCornerBoulders(ctx: CanvasRenderingContext2D, rng: () => number): void {
  const corners: Array<{ x: number; y: number; sx: number; sy: number }> = [
    { x: -20, y: -20, sx: 1, sy: 1 },
    { x: ARENA_W + 20, y: -20, sx: -1, sy: 1 },
    { x: -20, y: ARENA_H + 20, sx: 1, sy: -1 },
    { x: ARENA_W + 20, y: ARENA_H + 20, sx: -1, sy: -1 },
  ];

  for (const corner of corners) {
    const shadow = ctx.createRadialGradient(corner.x, corner.y, 0, corner.x, corner.y, 400);
    shadow.addColorStop(0, 'rgba(0, 0, 0, 0.7)');
    shadow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = shadow;
    ctx.fillRect(0, 0, ARENA_W, ARENA_H);

    // 大块（贴边、部分被画面裁掉，像墙延伸到画外）
    const bigs = 2;
    for (let i = 0; i < bigs; i += 1) {
      const dist = 26 + rng() * 40 + i * 34;
      const lateral = (rng() - 0.5) * 120;
      drawRock(
        ctx,
        corner.x + (dist + lateral * 0.3) * corner.sx,
        corner.y + (dist * 0.7 - lateral * 0.35) * corner.sy,
        22 + rng() * 22,
        rng,
      );
    }

    // 碎石
    for (let i = 0; i < 7; i += 1) {
      const dist = 90 + rng() * 190;
      const lateral = (rng() - 0.5) * 240;
      drawRock(
        ctx,
        corner.x + (dist + lateral * 0.4) * corner.sx,
        corner.y + (dist * 0.62 - lateral * 0.45) * corner.sy,
        6 + rng() * 14,
        rng,
      );
    }
  }
}

function drawRock(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  rng: () => number,
): void {
  // 落地阴影
  ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
  ctx.beginPath();
  ctx.ellipse(x + r * 0.12, y + r * 0.66, r * 1.15, r * 0.36, 0, 0, Math.PI * 2);
  ctx.fill();

  const points = 7 + Math.floor(rng() * 3);
  const verts: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < points; i += 1) {
    const a = (i / points) * Math.PI * 2 + rng() * 0.2;
    const rad = r * (0.62 + rng() * 0.58);
    verts.push({ x: x + Math.cos(a) * rad, y: y + Math.sin(a) * rad * 0.86 });
  }

  // 用中点 + 二次贝塞尔串起来，得到圆润的石头轮廓（直边多边形会像折纸）
  const path = new Path2D();
  const n = verts.length;
  path.moveTo((verts[0]!.x + verts[n - 1]!.x) / 2, (verts[0]!.y + verts[n - 1]!.y) / 2);
  for (let i = 0; i < n; i += 1) {
    const cur = verts[i]!;
    const next = verts[(i + 1) % n]!;
    path.quadraticCurveTo(cur.x, cur.y, (cur.x + next.x) / 2, (cur.y + next.y) / 2);
  }
  path.closePath();

  // 左上受光 → 右下入暗；整体比地面更暗，靠边缘反光区分
  const grad = ctx.createLinearGradient(x - r * 0.9, y - r, x + r * 0.8, y + r);
  grad.addColorStop(0, '#1a2130');
  grad.addColorStop(0.35, '#111722');
  grad.addColorStop(0.72, '#080c12');
  grad.addColorStop(1, '#03050a');
  ctx.fillStyle = grad;
  ctx.fill(path);

  ctx.save();
  ctx.clip(path);

  // 顶面柔光
  const top = ctx.createRadialGradient(
    x - r * 0.35,
    y - r * 0.5,
    0,
    x - r * 0.35,
    y - r * 0.5,
    r * 1.1,
  );
  top.addColorStop(0, 'rgba(150, 176, 212, 0.1)');
  top.addColorStop(1, 'rgba(150, 176, 212, 0)');
  ctx.fillStyle = top;
  ctx.fillRect(x - r * 1.5, y - r * 1.5, r * 3, r * 3);

  // 石面斑驳
  for (let i = 0; i < 3; i += 1) {
    const bx = x + (rng() - 0.5) * r * 1.4;
    const by = y + (rng() - 0.5) * r * 1.2;
    const br = r * (0.3 + rng() * 0.5);
    const g = ctx.createRadialGradient(bx, by, 0, bx, by, br);
    g.addColorStop(0, rng() > 0.5 ? 'rgba(150, 172, 200, 0.07)' : 'rgba(0, 0, 0, 0.22)');
    g.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(bx - br, by - br, br * 2, br * 2);
  }
  ctx.restore();
}

/** 火盆：石台 + 金属盆 + 炭火。火焰本身是动态粒子。 */
function paintBraziers(ctx: CanvasRenderingContext2D): void {
  for (const b of BRAZIERS) {
    ctx.save();

    // 石台（梯形，带受光面）
    const ped = ctx.createLinearGradient(b.x - 26, b.y, b.x + 26, b.y + 46);
    ped.addColorStop(0, '#1b222e');
    ped.addColorStop(0.5, '#101620');
    ped.addColorStop(1, '#06090e');
    ctx.fillStyle = ped;
    ctx.beginPath();
    ctx.moveTo(b.x - 30, b.y + 22);
    ctx.lineTo(b.x + 30, b.y + 22);
    ctx.lineTo(b.x + 40, b.y + 56);
    ctx.lineTo(b.x - 40, b.y + 56);
    ctx.closePath();
    ctx.fill();

    // 盆体：下暗上亮
    const bowl = ctx.createLinearGradient(b.x, b.y - 20, b.x, b.y + 26);
    bowl.addColorStop(0, '#333c52');
    bowl.addColorStop(0.4, '#1d2433');
    bowl.addColorStop(1, '#080b11');
    ctx.fillStyle = bowl;
    ctx.beginPath();
    ctx.moveTo(b.x - 34, b.y - 8);
    ctx.quadraticCurveTo(b.x, b.y + 34, b.x + 34, b.y - 8);
    ctx.closePath();
    ctx.fill();

    // 盆口边缘
    ctx.strokeStyle = 'rgba(206, 162, 116, 0.55)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(b.x, b.y - 8, 34, 11, 0, 0, Math.PI * 2);
    ctx.stroke();

    // 盆内：先铺暗炭底
    const inner = ctx.createRadialGradient(b.x, b.y - 8, 2, b.x, b.y - 8, 30);
    inner.addColorStop(0, '#241109');
    inner.addColorStop(0.7, '#160b06');
    inner.addColorStop(1, '#0b0604');
    ctx.fillStyle = inner;
    ctx.beginPath();
    ctx.ellipse(b.x, b.y - 8, 30, 9.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // 炭块之间的缝隙透出火光（小块、不铺满，否则远处看像煎蛋）
    for (let i = 0; i < 9; i += 1) {
      const rng = mulberry32(0x77 + i * 331);
      const ex = b.x + (rng() - 0.5) * 46;
      const ey = b.y - 8 + (rng() - 0.5) * 11;
      const er = 3 + rng() * 5;
      const g = ctx.createRadialGradient(ex, ey, 0, ex, ey, er);
      g.addColorStop(0, 'rgba(255, 214, 140, 0.85)');
      g.addColorStop(0.5, 'rgba(255, 122, 36, 0.5)');
      g.addColorStop(1, 'rgba(180, 40, 6, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(ex, ey, er, er * 0.75, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // 压在上面的炭块，遮掉一部分火
    for (let i = 0; i < 7; i += 1) {
      const rng = mulberry32(0x1a5 + i * 617);
      const cx = b.x + (rng() - 0.5) * 48;
      const cy = b.y - 8 + (rng() - 0.5) * 12;
      ctx.fillStyle = `rgba(${26 + rng() * 22}, ${14 + rng() * 12}, 10, 0.92)`;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 4 + rng() * 5, 2.6 + rng() * 2.4, rng() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}

/** 光照统一层：暗底 + 几处光池，是"看起来像画"的决定性一步。 */
function paintLighting(ctx: CanvasRenderingContext2D, W: number, H: number): void {
  ctx.save();

  // 月光：soft-light 可以整体提亮但不太压对比
  ctx.globalCompositeOperation = 'soft-light';
  const moon = ctx.createRadialGradient(W * 0.5, -H * 0.2, 60, W * 0.5, H * 0.4, H * 1.1);
  moon.addColorStop(0, 'rgba(150, 195, 240, 0.55)');
  moon.addColorStop(0.45, 'rgba(110, 150, 200, 0.22)');
  moon.addColorStop(1, 'rgba(70, 100, 140, 0)');
  ctx.fillStyle = moon;
  ctx.fillRect(0, 0, W, H);

  // 火盆暖光：远处用 overlay 上色（保对比），近处才用 screen 提亮
  for (const b of BRAZIERS) {
    ctx.globalCompositeOperation = 'overlay';
    const wide = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, 340);
    wide.addColorStop(0, 'rgba(255, 176, 96, 0.72)');
    wide.addColorStop(0.35, 'rgba(240, 130, 56, 0.34)');
    wide.addColorStop(1, 'rgba(180, 70, 20, 0)');
    ctx.fillStyle = wide;
    ctx.fillRect(0, 0, W, H);

    ctx.globalCompositeOperation = 'screen';
    const hot = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, 150);
    hot.addColorStop(0, 'rgba(255, 210, 150, 0.5)');
    hot.addColorStop(0.45, 'rgba(255, 150, 70, 0.16)');
    hot.addColorStop(1, 'rgba(255, 120, 40, 0)');
    ctx.fillStyle = hot;
    ctx.fillRect(0, 0, W, H);
  }

  // 中央法阵冷光
  ctx.globalCompositeOperation = 'screen';
  const cold = ctx.createRadialGradient(RITUAL.x, RITUAL.y, 30, RITUAL.x, RITUAL.y, 400);
  cold.addColorStop(0, 'rgba(74, 196, 226, 0.1)');
  cold.addColorStop(0.55, 'rgba(52, 152, 192, 0.04)');
  cold.addColorStop(1, 'rgba(30, 110, 160, 0)');
  ctx.fillStyle = cold;
  ctx.fillRect(0, 0, W, H);

  ctx.restore();
}

/** 四边向内压暗：像画框，把视线收回中间。 */
function paintEdgeShadows(ctx: CanvasRenderingContext2D, W: number, H: number): void {
  const depth = 130;
  const edges: Array<[number, number, number, number, number, number, number, number]> = [
    [0, 0, 0, depth, 0, 0, W, depth],
    [0, H, 0, H - depth, 0, H - depth, W, depth],
    [0, 0, depth, 0, 0, 0, depth, H],
    [W, 0, W - depth, 0, W - depth, 0, depth, H],
  ];

  for (const [x0, y0, x1, y1, rx, ry, rw, rh] of edges) {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, 'rgba(2, 4, 8, 0.78)');
    g.addColorStop(1, 'rgba(2, 4, 8, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(rx, ry, rw, rh);
  }
}

function paintVignette(ctx: CanvasRenderingContext2D, W: number, H: number): void {
  const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.32, W / 2, H / 2, H * 0.98);
  g.addColorStop(0, 'rgba(0, 0, 0, 0)');
  g.addColorStop(0.6, 'rgba(0, 0, 0, 0.16)');
  g.addColorStop(1, 'rgba(0, 0, 0, 0.6)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

function paintGrain(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  rng: () => number,
): void {
  for (let i = 0; i < 14000; i += 1) {
    const x = rng() * W;
    const y = rng() * H;
    const bright = rng() > 0.55;
    ctx.fillStyle = bright ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.045)';
    ctx.fillRect(x, y, 1, 1);
  }
}

// ------------------------------------------------------------------ 工具

function softBlob(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: string,
): void {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

function hsl(h: number, s: number, l: number): string {
  const hue = ((h % 360) + 360) % 360;
  const sat = Math.max(0, Math.min(100, s));
  const light = Math.max(0, Math.min(100, l));
  return `hsl(${hue.toFixed(1)}, ${sat.toFixed(1)}%, ${light.toFixed(1)}%)`;
}
