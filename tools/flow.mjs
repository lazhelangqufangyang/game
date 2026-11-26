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
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});

await page.goto('http://127.0.0.1:5173/?renderer=canvas', { waitUntil: 'networkidle0' });
await sleep(700);
await page.screenshot({ path: `${OUT}/01-prep.png` });

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

await page.keyboard.press('Space');
await sleep(1500);
console.log('after start:', await sceneKey(), await page.evaluate(() => window.__game.registry.get('direction')));
await page.screenshot({ path: `${OUT}/02-battle.png` });

// 装一个被动、升到 3 级，验证跨波次保留
await page.evaluate(() => {
  const s = window.__game.scene.keys.Battle;
  s.book.add(window.__config.passives[0]);
  s.run.passives = s.book.ids();
  s.passiveBar.refresh(s.book.list);
  s.xp.level = 3;
  s.run.level = 3;
  s.refreshStats(true);
});

// 第一波清空
await clearWave();
await sleep(1400);
console.log('after wave1:', await sceneKey());
await page.screenshot({ path: `${OUT}/03-prep-wave2.png` });

await page.keyboard.press('Space');
await sleep(1400);
console.log(
  'carry over:',
  await page.evaluate(() => {
    const s = window.__game.scene.keys.Battle;
    return { level: s.xp.level, passives: s.run.passives, slots: s.book.count };
  }),
);
await clearWave();
await sleep(1400);
console.log('after wave2:', await sceneKey());

await page.keyboard.press('Space');
await sleep(1200);
await clearWave();
await sleep(1600);
console.log('after wave3:', await sceneKey());
await page.screenshot({ path: `${OUT}/04-result-win.png` });

// 重开并测试死亡
await page.keyboard.press('Space');
await sleep(900);
await page.keyboard.press('Space');
await sleep(1600);
await page.evaluate(() => {
  const s = window.__game.scene.keys.Battle;
  s.run.hp = 5;
  const enemy = s.enemies.getChildren().find((e) => e.active);
  if (enemy) s.touchPlayer(enemy);
});
await sleep(1500);
console.log('after death:', await sceneKey());
await page.screenshot({ path: `${OUT}/05-result-lose.png` });

console.log('errors:', errors.length ? errors : 'none');
await browser.close();
