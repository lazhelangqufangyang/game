import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const OUT = 'D:\\小游戏2\\.shots';
mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: 'new',
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=swiftshader', '--window-size=1280,800'],
});

const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });

const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
page.on('requestfailed', (r) => logs.push(`[requestfailed] ${r.url()} ${r.failure()?.errorText}`));

await page.goto('http://127.0.0.1:5173/?renderer=canvas', { waitUntil: 'networkidle0', timeout: 30000 });
await new Promise((r) => setTimeout(r, 1200));
await page.screenshot({ path: `${OUT}/01-prep.png` });

// 开始战斗
await page.keyboard.press('Space');
await new Promise((r) => setTimeout(r, 1800));
await page.screenshot({ path: `${OUT}/02-battle-start.png` });

// 移动 + 等怪靠近
await page.keyboard.down('KeyD');
await new Promise((r) => setTimeout(r, 700));
await page.keyboard.up('KeyD');
await new Promise((r) => setTimeout(r, 2500));
await page.screenshot({ path: `${OUT}/03-battle-mid.png` });

const state = await page.evaluate(() => {
  const g = window.__game;
  if (!g) return { ok: false };
  const run = g.registry.get('run');
  const scene = g.scene.getScenes(true).map((s) => s.scene.key);
  return { ok: true, run, scene };
});

console.log('STATE', JSON.stringify(state));
console.log('LOGS', logs.length ? logs.join('\n') : '(no console output)');

await browser.close();
