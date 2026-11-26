/**
 * 美术预览截图：不依赖游戏逻辑（并行改动时也能单独验收美术）。
 * 用法：先 npm run dev，再
 *   node tools/arena-shot.mjs         → .shots/40-arena.png（只看背景）
 *   node tools/arena-shot.mjs sheet   → .shots/41-poses.png（所有角色 × 4 姿势帧）
 */
import puppeteer from 'puppeteer-core';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const sheet = process.argv[2] === 'sheet';

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: 'new',
  args: ['--no-sandbox'],
});

const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`[console] ${m.text()}`);
});

const url = sheet
  ? 'http://127.0.0.1:5173/preview.html?sheet=1'
  : 'http://127.0.0.1:5173/preview.html';

await page.goto(url, { waitUntil: 'networkidle0' });
await new Promise((r) => setTimeout(r, 500));

// 画布是自适应尺寸的，按内容大小截图（背景 1280×720，姿势总览更宽）
const size = await page.evaluate(() => {
  const c = document.querySelector('canvas');
  return { w: c.width, h: c.height };
});
await page.setViewport({ width: Math.min(2000, size.w), height: Math.min(1200, size.h) });
await new Promise((r) => setTimeout(r, 250));

const out = sheet ? '.shots/41-poses.png' : '.shots/40-arena.png';
await page.screenshot({ path: out });
console.log('shot ->', out, await page.evaluate(() => document.title));
console.log('errors:', errors.length ? errors : 'none');

await browser.close();
