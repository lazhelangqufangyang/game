import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const OUT = 'D:\\小游戏2\\.shots';
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: 'new',
  args: ['--no-sandbox', '--window-size=1280,800'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720 });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

await page.goto('http://127.0.0.1:5173/?renderer=canvas', { waitUntil: 'networkidle0' });
await sleep(900);
await page.screenshot({ path: `${OUT}/60-prep-shop.png` });

const snap = () =>
  page.evaluate(() => {
    const run = window.__game.registry.get('run');
    return {
      economy: run.economy,
      essence: run.essence,
      evolutions: run.evolutions,
      equipment: run.equipment,
      shop: run.shop_offers,
    };
  });

console.log('initial', await snap());

// 给钱和精粹，重开 Prep 让面板刷新
await page.evaluate(() => {
  const run = window.__game.registry.get('run');
  run.economy = 100;
  run.essence = 20;
  window.__game.scene.keys.Prep.scene.restart();
});
await sleep(800);
console.log('funded', await snap());
await page.screenshot({ path: `${OUT}/61-prep-funded.png` });

// 打开进化弹窗
await page.mouse.click(942, 254);
await sleep(500);
await page.screenshot({ path: `${OUT}/62-evolution-modal.png` });

// 选第一个方向
await page.mouse.click(292, 360);
await sleep(500);
console.log('after evolve', await snap());

// 买第一件商品
await page.mouse.click(942, 432);
await sleep(400);
console.log('after buy #1', await snap());
await page.screenshot({ path: `${OUT}/63-after-buy.png` });

// 继续进化到第 3 阶段
await page.evaluate(() => {
  window.__game.registry.get('run').essence = 100;
  window.__game.scene.keys.Prep.scene.restart();
});
await sleep(700);
for (let i = 0; i < 2; i += 1) {
  await page.mouse.click(942, 254);
  await sleep(350);
  await page.mouse.click(292, 360);
  await sleep(350);
}
console.log('after 3 stages', await snap());
await page.screenshot({ path: `${OUT}/65-evolved-3.png` });

// 开战，检查属性已包含进化/装备加成
await page.keyboard.press('Space');
await sleep(1400);
const stats = await page.evaluate(() => {
  const s = window.__game.scene.keys.Battle;
  return {
    damage: s.stats.damage,
    maxHp: s.stats.max_hp,
    evolutions: window.__game.registry.get('run').evolutions,
    equipment: window.__game.registry.get('run').equipment,
  };
});
console.log('battle stats', stats);
await page.screenshot({ path: `${OUT}/64-battle-evolved.png` });

console.log('errors', errors.length ? errors : 'none');
await browser.close();
