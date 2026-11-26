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

const snap = () =>
  page.evaluate(() => {
    const run = window.__game.registry.get('run');
    return {
      economy: run.economy,
      items: run.items,
      equipment: run.equipment,
      shop: run.shop_offers,
    };
  });

await page.evaluate(() => {
  const run = window.__game.registry.get('run');
  run.economy = 200;
  window.__game.scene.keys.Prep.scene.restart();
});
await sleep(800);
console.log('offers', (await snap()).shop);
await page.screenshot({ path: `${OUT}/80-shop-grid.png` });

// 点第一个商品格
await page.mouse.click(654 + 141, 350 + 64);
await sleep(400);
console.log('after click buy', await snap());

// 直接补齐影刃配方并合成（等价于玩家先买组件再买成品）
const forged = await page.evaluate(() => {
  const run = window.__game.registry.get('run');
  const all = window.__config.items;
  const byId = (id) => all.find((i) => i.id === id);
  const meta = window.__game.scene.keys.Prep;
  const buy = (id) => meta.purchase(byId(id));
  run.items = [];
  run.equipment = [];
  run.economy = 200;
  buy('dagger');
  buy('soft_boots');
  buy('shadow_blade');
  buy('bracer');
  buy('bracer');
  buy('bulwark');
  return { items: run.items, equipment: run.equipment, economy: run.economy };
});
console.log('forged', forged);
await sleep(500);
await page.screenshot({ path: `${OUT}/81-equipment-6.png` });

// 进战斗：验证主动装备（4/5）与护盾
await page.keyboard.press('Space');
await sleep(1400);
const actives = await page.evaluate(() => {
  const s = window.__game.scene.keys.Battle;
  return {
    actives: s.actives.map((a) => ({ id: a.id, kind: a.active?.kind })),
    buttons: s.itemButtons.length,
  };
});
console.log('actives', actives);

const before = await page.evaluate(() => Math.round(window.__game.scene.keys.Battle.player.x));
await page.keyboard.down('KeyD');
await sleep(400);
await page.keyboard.up('KeyD');
await page.keyboard.press('Digit4');
await sleep(200);
const after = await page.evaluate(() => Math.round(window.__game.scene.keys.Battle.player.x));
console.log('item dash', { before, after });

await page.keyboard.press('Digit5');
await sleep(200);
const shield = await page.evaluate(() => {
  const s = window.__game.scene.keys.Battle;
  return { shield: Math.round(s.shield), cd: Math.round(s.itemCd.get('bulwark') ?? 0) };
});
console.log('shield', shield);
await page.screenshot({ path: `${OUT}/82-item-actives.png` });

console.log('errors', errors.length ? errors.slice(0, 5) : 'none');
await browser.close();
