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
await sleep(700);
await page.keyboard.press('Space');
await sleep(900);

// 直接注入等级和被动，跳过三选一面板
await page.evaluate(() => {
  const s = window.__game.scene.keys.Battle;
  const passives = window.__config.passives;
  s.xp.level = 6;
  s.run.level = 6;
  for (const id of ['split_shot', 'edge', 'hunter', 'burst']) {
    const def = passives.find((p) => p.id === id);
    if (def) s.book.add(def);
  }
  s.run.passives = s.book.ids();
  s.passiveBar.refresh(s.book.list);
  s.refreshStats(true);
  s.run.hp = s.run.max_hp;
});
await sleep(200);

const stats = await page.evaluate(() => {
  const s = window.__game.scene.keys.Battle;
  return { level: s.xp.level, damage: s.stats.damage, multishot: s.stats.multishot, crit: s.stats.crit_chance };
});
console.log('stats', JSON.stringify(stats));

const before = await page.evaluate(() => {
  const s = window.__game.scene.keys.Battle;
  return { x: Math.round(s.player.x), y: Math.round(s.player.y) };
});

await page.keyboard.down('KeyD');
await sleep(450);
await page.keyboard.up('KeyD');
await page.keyboard.press('KeyQ');
await sleep(150);
const afterDash = await page.evaluate(() => {
  const s = window.__game.scene.keys.Battle;
  return { x: Math.round(s.player.x), y: Math.round(s.player.y) };
});
console.log('dash', JSON.stringify({ before, afterDash }));

await page.keyboard.press('KeyE');
await sleep(120);
const barrage = await page.evaluate(() => {
  const s = window.__game.scene.keys.Battle;
  return { bullets: s.bullets.countActive(true), cd: Math.round(s.skillCd.get('barrage') ?? 0) };
});
console.log('barrage', JSON.stringify(barrage));
await page.screenshot({ path: `${OUT}/40-barrage.png` });

await page.keyboard.press('KeyW');
await sleep(120);
const nova = await page.evaluate(() => {
  const s = window.__game.scene.keys.Battle;
  return { enemies: s.enemies.countActive(true), cd: Math.round(s.skillCd.get('nova') ?? 0) };
});
console.log('nova', JSON.stringify(nova));
await page.screenshot({ path: `${OUT}/41-nova.png` });

// 等怪走近再打一会，看多重射击与暴击表现
await sleep(2200);
await page.screenshot({ path: `${OUT}/42-fight.png` });

console.log('errors', errors.length ? errors : 'none');
await browser.close();
