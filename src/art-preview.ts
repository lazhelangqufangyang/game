/**
 * 背景美术预览：单独渲染战斗背景，不启动 Phaser、不依赖 /data 配置。
 * 用法：npm run dev 后打开 http://127.0.0.1:5173/preview.html
 * 截图：node tools/arena-shot.mjs → .shots/40-arena.png
 */
import { ARENA_H, ARENA_W, paintArena } from './assets/arena';

const canvas = document.getElementById('arena') as HTMLCanvasElement;
canvas.width = ARENA_W;
canvas.height = ARENA_H;
const ctx = canvas.getContext('2d');
if (!ctx) throw new Error('无法获取 2D 上下文');

const started = performance.now();
paintArena(ctx);
const cost = performance.now() - started;

console.info(`[preview] 背景绘制耗时 ${cost.toFixed(1)}ms`);
document.title = `背景预览 ${cost.toFixed(0)}ms`;
