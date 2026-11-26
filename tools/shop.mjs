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
    return { economy: run.economy, items: run.items, shop: run.shop_offers };
  });

await page.evaluate(() => {
  const run = window.__game.registry.get('run');
  run.economy = 300;
  window.__game.scene.keys.Prep.scene.restart();
});
await sleep(800);
console.log('offers', (await snap()).shop);
await page.screenshot({ path: `${OUT}/80-shop-grid.png` });

// 点第一个商品格（验证点击链路）
await page.mouse.click(654 + 141, 350 + 64);
await sleep(400);
console.log('after click buy', await snap());

// 完整配方链：短剑+手套=战刃；护腕+魔晶=重盾；战刃+重盾=王者之刃
const chain = await page.evaluate(() => {
  const run = window.__game.registry.get('run');
  const all = window.__config.items;
  const byId = (id) => all.find((i) => i.id === id);
  const prep = window.__game.scene.keys.Prep;
  run.items = [];
  run.economy = 300;

  const steps = [];
  const log = (label) => steps.push(`${label}:${run.items.length}格`);

  prep.purchase(byId('dagger'));
  prep.purchase(byId('gloves'));
  log('两小件');
  prep.purchase(byId('warblade'));
  log('合中件');

  prep.purchase(byId('bracer'));
  prep.purchase(byId('crystal'));
  prep.purchase(byId('tower_shield'));
  log('再合中件');
  prep.purchase(byId('king_blade'));
  log('两中件合大件');

  return { steps, items: run.items, economy: run.economy };
});
console.log('chain', chain);
await sleep(500);
await page.screenshot({ path: `${OUT}/81-recipes.png` });

// 六格塞满小件时，合成仍可进行（净腾格）
const full = await page.evaluate(() => {
  const run = window.__game.registry.get('run');
  const all = window.__config.items;
  const byId = (id) => all.find((i) => i.id === id);
  const prep = window.__game.scene.keys.Prep;
  run.items = ['dagger', 'dagger', 'gloves', 'bracer', 'bracer', 'crystal'];
  run.economy = 300;
  const before = run.items.length;
  prep.purchase(byId('warblade'));
  return { before, after: run.items.length, items: run.items };
});
console.log('full slots combine', full);
await sleep(400);
await page.screenshot({ path: `${OUT}/82-full-slots.png` });

// 进战斗验证主动装备
await page.evaluate(() => {
  const run = window.__game.registry.get('run');
  run.items = ['shadow_blade', 'bulwark'];
});
await page.keyboard.press('Space');
await sleep(1400);
const actives = await page.evaluate(() => {
  const s = window.__game.scene.keys.Battle;
  return { actives: s.actives.map((a) => a.id), slots: window.__game.registry.get('run').items.length };
});
console.log('actives', actives);

await page.keyboard.press('Digit4');
await sleep(200);
await page.keyboard.press('Digit5');
await sleep(250);
const shield = await page.evaluate(() => {
  const s = window.__game.scene.keys.Battle;
  return { shield: Math.round(s.shield), dashCd: Math.round(s.itemCd.get('shadow_blade') ?? 0) };
});
console.log('actives fired', shield);
await page.screenshot({ path: `${OUT}/83-item-actives.png` });

console.log('errors', errors.length ? errors.slice(0, 5) : 'none');
await browser.close();
