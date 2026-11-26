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
await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

await page.goto('http://127.0.0.1:5173/?renderer=canvas', { waitUntil: 'networkidle0' });
await sleep(900);

// 本测试只验证波次流转，关掉三选一面板避免打断
await page.evaluate(() => {
  window.__config.levels.passive_offer_levels = [];
});
await page.screenshot({ path: `${OUT}/01-battle-direct.png` });

const sceneKey = () =>
  page.evaluate(() => window.__game.scene.getScenes(true).map((s) => s.scene.key).join(','));

const clearWave = () =>
  page.evaluate(() => {
    const s = window.__game.scene.keys.Battle;
    if (!s || !s.scene.isActive()) return 'not-in-battle';
    s.director.streams.forEach((st) => {
      st.spawned = st.total;
    });
    s.enemies.getChildren().forEach((e) => {
      if (e.active) s.killEnemy(e);
    });
    return 'cleared';
  });

const state = () =>
  page.evaluate(() => {
    const s = window.__game.scene.keys.Battle;
    const run = window.__game.registry.get('run');
    return {
      scene: window.__game.scene.getScenes(true).map((x) => x.scene.key).join(','),
      intermission: !!s?.intermission,
      wave: run.wave_index + 1,
      hp: Math.round(run.hp),
    };
  });

// 一波一波推进：清怪 → 结算面板 → 空格下一波，直到结算页
for (let guard = 0; guard < 60; guard += 1) {
  const s = await state();
  if (s.scene.includes('Result')) {
    console.log('reached Result at', s);
    break;
  }
  if (s.intermission) {
    console.log(`wave ${s.wave} cleared (intermission), hp ${s.hp}`);
    await page.keyboard.press('Space');
    await sleep(1200);
    continue;
  }
  await clearWave();
  await sleep(1600);
}

const final = await page.evaluate(() => {
  const run = window.__game.registry.get('run');
  return {
    wave: run.wave_index + 1,
    kills: run.kills,
    economy: run.economy,
    save: localStorage.getItem('rogue-waves-save'),
  };
});
console.log('final', final, await sceneKey());
await page.screenshot({ path: `${OUT}/04-result-win.png` });

console.log('errors:', errors.length ? errors.slice(0, 5) : 'none');
await browser.close();
