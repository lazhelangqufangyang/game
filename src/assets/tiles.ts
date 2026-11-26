import Phaser from 'phaser';
import { mulberry32 } from '../core/rng';
import { compileCanvas } from './pixel';

const TILE = 32;
const VIGNETTE_W = 256;
const VIGNETTE_H = 144;

/** 战斗地面：可平铺的石板贴图 + 地面装饰 + 暗角。全部程序化生成，无外部素材。 */
export function buildTiles(scene: Phaser.Scene): void {
  compileCanvas(scene, 'floor-a', TILE, TILE, (ctx) => {
    drawSlab(ctx, mulberry32(0x51a7), { base: '#141a24', slab: '#182030', grout: '#0b0f16' });
  });
  compileCanvas(scene, 'floor-b', TILE, TILE, (ctx) => {
    drawSlab(ctx, mulberry32(0x2c93), { base: '#121821', slab: '#161d2a', grout: '#0a0e15' });
  });

  compileCanvas(scene, 'decor-crack', TILE, TILE, (ctx) => {
    const rng = mulberry32(0x7a1f);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    for (let i = 0; i < 3; i += 1) {
      let x = 4 + Math.floor(rng() * 24);
      let y = 4 + Math.floor(rng() * 24);
      for (let step = 0; step < 9; step += 1) {
        ctx.fillRect(x, y, 1, 1);
        x += rng() > 0.5 ? 1 : -1;
        y += rng() > 0.35 ? 1 : 0;
        if (x < 0 || x >= TILE || y < 0 || y >= TILE) break;
      }
    }
  });

  compileCanvas(scene, 'decor-scuff', TILE, TILE, (ctx) => {
    const rng = mulberry32(0x3d55);
    for (let i = 0; i < 14; i += 1) {
      const x = Math.floor(rng() * TILE);
      const y = Math.floor(rng() * TILE);
      ctx.fillStyle = rng() > 0.5 ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.3)';
      ctx.fillRect(x, y, 1, 1);
    }
  });

  compileCanvas(scene, 'decor-rune', TILE, TILE, (ctx) => {
    ctx.strokeStyle = 'rgba(110, 231, 255, 0.22)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(16.5, 16.5, 9, 0, Math.PI * 2);
    ctx.moveTo(16.5, 3.5);
    ctx.lineTo(16.5, 29.5);
    ctx.moveTo(3.5, 16.5);
    ctx.lineTo(29.5, 16.5);
    ctx.stroke();
  });

  compileCanvas(
    scene,
    'vignette',
    VIGNETTE_W,
    VIGNETTE_H,
    (ctx, w, h) => {
      const gradient = ctx.createRadialGradient(w / 2, h / 2, h * 0.22, w / 2, h / 2, h * 0.82);
      gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
      gradient.addColorStop(0.62, 'rgba(0, 0, 0, 0.28)');
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0.72)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);
    },
    Phaser.Textures.FilterMode.LINEAR,
  );
}

interface SlabOptions {
  base: string;
  slab: string;
  grout: string;
}

function drawSlab(ctx: CanvasRenderingContext2D, rng: () => number, opts: SlabOptions): void {
  ctx.fillStyle = opts.base;
  ctx.fillRect(0, 0, TILE, TILE);

  // 石板本体（留 1px 灰缝）
  ctx.fillStyle = opts.slab;
  ctx.fillRect(1, 1, TILE - 2, TILE - 2);

  // 上/左受光、下/右压暗，做出微微的立体感
  ctx.fillStyle = 'rgba(255, 255, 255, 0.045)';
  ctx.fillRect(1, 1, TILE - 2, 1);
  ctx.fillRect(1, 1, 1, TILE - 2);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
  ctx.fillRect(1, TILE - 2, TILE - 2, 1);
  ctx.fillRect(TILE - 2, 1, 1, TILE - 2);

  // 随机麻点，避免大色块显得死板
  for (let i = 0; i < 80; i += 1) {
    const x = 2 + Math.floor(rng() * (TILE - 4));
    const y = 2 + Math.floor(rng() * (TILE - 4));
    ctx.fillStyle = rng() > 0.5 ? 'rgba(255, 255, 255, 0.035)' : 'rgba(0, 0, 0, 0.22)';
    ctx.fillRect(x, y, 1, 1);
  }

  // 灰缝压深
  ctx.fillStyle = opts.grout;
  ctx.fillRect(0, 0, TILE, 1);
  ctx.fillRect(0, 0, 1, TILE);
}
