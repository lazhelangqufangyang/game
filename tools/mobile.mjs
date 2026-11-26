import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const OUT = 'D:\\小游戏2\\.shots';
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: 'new',
  args: ['--no-sandbox', '--window-size=900,500'],
});

// 手机横屏
const page = await browser.newPage();
await page.setViewport({ width: 844, height: 390, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto('http://127.0.0.1:5173/?renderer=canvas', { waitUntil: 'networkidle0' });
await sleep(800);
await page.screenshot({ path: `${OUT}/10-mobile-prep.png` });

const rect = await page.evaluate(() => {
  const c = document.querySelector('canvas');
  if (!c) return null;
  const r = c.getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height };
});
console.log('canvas rect', JSON.stringify(rect));

// 点击开始（换算到画布内坐标）
const cx = rect.x + rect.w / 2;
const cy = rect.y + rect.h * (360 + 128) / 720;
await page.touchscreen.tap(cx, cy);
await sleep(1200);
console.log('after tap:', await page.evaluate(() => window.__game.scene.getScenes(true).map((s) => s.scene.key).join(',')));
await page.screenshot({ path: `${OUT}/11-mobile-battle.png` });

// 触摸拖动：从中心向左侧拖
const start = { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
const before = await page.evaluate(() => {
  const s = window.__game.scene.keys.Battle;
  return s && s.player ? { x: Math.round(s.player.x), y: Math.round(s.player.y) } : null;
});
await page.touchscreen.touchStart(start.x, start.y);
await page.touchscreen.touchMove(start.x - 120, start.y - 40);
await sleep(1200);
await page.touchscreen.touchEnd();
const after = await page.evaluate(() => {
  const s = window.__game.scene.keys.Battle;
  return s && s.player ? { x: Math.round(s.player.x), y: Math.round(s.player.y) } : null;
});
console.log('drag move:', JSON.stringify({ before, after }));
await page.screenshot({ path: `${OUT}/12-mobile-drag.png` });

// 手机竖屏
const page2 = await browser.newPage();
await page2.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await page2.goto('http://127.0.0.1:5173/?renderer=canvas', { waitUntil: 'networkidle0' });
await sleep(700);
await page2.screenshot({ path: `${OUT}/13-mobile-portrait.png` });

console.log('errors:', errors.length ? errors : 'none');
await browser.close();
