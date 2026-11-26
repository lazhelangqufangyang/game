/**
 * 背景预览截图：只渲染背景绘制层，不依赖游戏逻辑（并行改动时也能单独验收美术）。
 * 用法：先 npm run dev，再 node tools/arena-shot.mjs
 * 产物：.shots/40-arena.png
 */
import puppeteer from 'puppeteer-core';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: 'new',
  args: ['--no-sandbox'],
});

const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720 });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`[console] ${m.text()}`);
});

await page.goto('http://127.0.0.1:5173/preview.html', { waitUntil: 'networkidle0' });
await new Promise((r) => setTimeout(r, 400));

const cost = await page.evaluate(() => document.title);
await page.screenshot({ path: '.shots/40-arena.png' });
console.log('shot -> .shots/40-arena.png', cost);
console.log('errors:', errors.length ? errors : 'none');

await browser.close();
