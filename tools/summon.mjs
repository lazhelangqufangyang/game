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

const snap = () =>
  page.evaluate(() => {
    const s = window.__game.scene.keys.Battle;
    const run = window.__game.registry.get('run');
    return {
      alive: s.summonSystem.aliveCount('coffer'),
      cd: Math.round(s.summonSystem.cooldownLeft('coffer')),
      economy: run.economy,
      xp: run.xp,
      essence: run.essence,
      summons: s.summons.getChildren().filter((x) => x.active).length,
      pickups: s.pickups.getChildren().filter((x) => x.active).length,
      toast: s.toastText.text,
    };
  });

console.log('initial', await snap());

await page.keyboard.press('Digit1');
await sleep(400);
console.log('after summon #1', await snap());

await page.keyboard.press('Digit1');
await sleep(300);
console.log('after summon #2 (cooldown)', await snap());
await page.screenshot({ path: `${OUT}/20-summon.png` });

// 让召唤物只剩 1 血，等自动射击打死
await page.evaluate(() => {
  const s = window.__game.scene.keys.Battle;
  s.summons.getChildren().forEach((x) => x.active && x.setData('hp', 1));
});
await sleep(2500);
console.log('after kill', await snap());
await page.screenshot({ path: `${OUT}/21-loot.png` });

// 快进冷却，连招两只验证上限
await page.evaluate(() => {
  const s = window.__game.scene.keys.Battle;
  s.summonSystem.update(9000);
  s.trySummon('coffer');
  s.summonSystem.update(9000);
  s.trySummon('coffer');
  s.summonSystem.update(9000);
  s.trySummon('coffer');
});
await sleep(500);
console.log('cap check', await snap());
await page.screenshot({ path: `${OUT}/22-cap.png` });

console.log('errors', errors.length ? errors : 'none');
await browser.close();
