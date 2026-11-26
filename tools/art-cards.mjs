/**
 * 生成「AI 出图」交付物（纯浏览器渲染，不依赖游戏逻辑）：
 *   docs/art/prompt-cards.png    —— 每个单位的完整 prompt 卡片（含负面词）
 *   docs/art/style-reference.png —— 透明底的风格参考图（可当 img2img 参考图）
 *
 * 用法：先 npm run dev，再 node tools/art-cards.mjs
 */
import { mkdirSync } from 'node:fs';
import puppeteer from 'puppeteer-core';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const OUT_DIR = 'docs/art';
mkdirSync(OUT_DIR, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: 'new',
  args: ['--no-sandbox'],
});

const errors = [];

async function capture(url, out, transparent) {
  const page = await browser.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && !m.text().includes('404')) errors.push(`[console] ${m.text()}`);
  });

  await page.goto(url, { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 600));

  const size = await page.evaluate(() => {
    const c = document.querySelector('canvas');
    return { w: c.width, h: c.height, title: document.title };
  });

  // 视口必须覆盖整张画布，否则 element.screenshot 会被裁掉
  await page.setViewport({ width: size.w, height: size.h });
  await new Promise((r) => setTimeout(r, 250));

  const el = await page.$('canvas');
  await el.screenshot({ path: out, omitBackground: transparent, captureBeyondViewport: true });
  console.log(`${out}  ${size.w}x${size.h}  (${size.title})`);
  await page.close();
}

const BASE = 'http://127.0.0.1:5173/preview.html';
await capture(`${BASE}?cards=1`, `${OUT_DIR}/prompt-cards.png`, false);
await capture(`${BASE}?ref=1`, `${OUT_DIR}/style-reference.png`, true);

console.log('errors:', errors.length ? errors : 'none');
await browser.close();
