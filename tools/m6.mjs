import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const OUT = 'D:\\小游戏2\\.shots';
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: 'new',
  args: ['--no-sandbox', '--window-size=1280,800', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720 });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

await page.goto('http://127.0.0.1:5173/?renderer=canvas', { waitUntil: 'networkidle0' });
await sleep(900);

const saved = await page.evaluate(() => {
  const raw = localStorage.getItem('rogue-waves-save');
  if (!raw) return null;
  const data = JSON.parse(raw);
  return { version: data.version, wave: data.run.wave_index, hp: data.run.hp };
});
console.log('save after prep', saved);

// 打一波、买东西，然后刷新页面验证续档
await page.keyboard.press('Space');
await sleep(1200);
await page.evaluate(() => {
  const run = window.__game.registry.get('run');
  run.economy = 50;
  run.wave_index = 2;
  run.hp = 77;
  run.equipment = ['boots'];
  window.__game.scene.keys.Battle.scene.start('Prep');
});
await sleep(900);
await page.reload({ waitUntil: 'networkidle0' });
await sleep(1000);
const resumed = await page.evaluate(() => {
  const run = window.__game.registry.get('run');
  return { wave: run.wave_index, hp: run.hp, equipment: run.equipment };
});
console.log('after reload', resumed);
await page.screenshot({ path: `${OUT}/70-resumed.png` });

// 跳到 Boss 波
await page.evaluate(() => {
  const run = window.__game.registry.get('run');
  run.wave_index = 7;
  window.__game.scene.keys.Prep.scene.start('Battle');
});
await sleep(2200);
const boss = await page.evaluate(() => {
  const s = window.__game.scene.keys.Battle;
  const b = s.bossSprite;
  return {
    hasBoss: !!b?.active,
    maxHp: Math.round(s.bossMaxHp),
    hp: b?.getData('hp'),
    wave: window.__game.registry.get('run').wave_index + 1,
  };
});
console.log('boss wave', boss);
await page.screenshot({ path: `${OUT}/71-boss.png` });

// 打几下看伤害数字
await page.evaluate(() => {
  const s = window.__game.scene.keys.Battle;
  s.player.x = 640;
  s.player.y = 360;
});
await sleep(1200);
await page.screenshot({ path: `${OUT}/72-boss-fight.png` });

// 清场：秒掉所有怪并结束刷怪流
await page.evaluate(() => {
  const s = window.__game.scene.keys.Battle;
  s.director.streams.forEach((st) => {
    st.spawned = st.total;
  });
  s.enemies.getChildren().forEach((e) => {
    if (e.active) s.killEnemy(e);
  });
});
await sleep(1800);
const end = await page.evaluate(() => window.__game.scene.getScenes(true).map((s) => s.scene.key).join(','));
console.log('after boss clear', end);
await page.screenshot({ path: `${OUT}/73-victory.png` });

console.log('errors', errors.length ? errors.slice(0, 5) : 'none');
await browser.close();
