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
await sleep(1200);

const scenes = await page.evaluate(() => window.__game.scene.getScenes(true).map((s) => s.scene.key));
console.log('boot scene', scenes, 'wave', await page.evaluate(() => window.__game.registry.get('run').wave_index + 1));
await page.screenshot({ path: `${OUT}/95-battle-direct.png` });

// 清空第一波
await page.evaluate(() => {
  const s = window.__game.scene.keys.Battle;
  s.director.streams.forEach((st) => {
    st.spawned = st.total;
  });
  s.enemies.getChildren().forEach((e) => {
    if (e.active) s.killEnemy(e);
  });
});
await sleep(1500);

const inter = await page.evaluate(() => {
  const s = window.__game.scene.keys.Battle;
  const run = window.__game.registry.get('run');
  return {
    hasPanel: !!s.intermission,
    blocking: s.uiBlocking,
    countdown: s.nextWaveIn,
    shop: run.shop_offers,
    economy: run.economy,
    items: run.items,
  };
});
console.log('intermission', inter);
await page.screenshot({ path: `${OUT}/96-intermission.png` });

// 买第一件 + 立刻回收
const trade = await page.evaluate(() => {
  const s = window.__game.scene.keys.Battle;
  const run = window.__game.registry.get('run');
  const item = window.__config.items.find((i) => i.id === run.shop_offers[0]);
  run.economy = Math.max(run.economy, item.price + 10);
  s.buyIntermissionItem(item);
  const afterBuy = { items: [...run.items], economy: run.economy };
  s.sellIntermissionItem(item);
  const afterSell = { items: [...run.items], economy: run.economy };
  return { item: item.id, afterBuy, afterSell };
});
console.log('trade', trade);
await sleep(400);
await page.screenshot({ path: `${OUT}/97-sell.png` });

// 空格进入下一波
await page.keyboard.press('Space');
await sleep(1600);
const next = await page.evaluate(() => {
  const s = window.__game.scene.keys.Battle;
  const run = window.__game.registry.get('run');
  return { wave: run.wave_index + 1, intermission: !!s.intermission, blocking: s.uiBlocking };
});
console.log('next wave', next);
await page.screenshot({ path: `${OUT}/98-next-wave.png` });

// 设置面板
await page.mouse.click(1240, 86);
await sleep(400);
const settings = await page.evaluate(() => {
  const s = window.__game.scene.keys.Battle;
  return { open: !!s.settingsPanel, blocking: s.uiBlocking };
});
console.log('settings', settings);
await page.screenshot({ path: `${OUT}/99-settings.png` });
await page.mouse.click(640, 452);
await sleep(300);
const closed = await page.evaluate(() => {
  const s = window.__game.scene.keys.Battle;
  return { open: !!s.settingsPanel, blocking: s.uiBlocking };
});
console.log('settings closed', closed);

console.log('errors', errors.length ? errors.slice(0, 5) : 'none');
await browser.close();
