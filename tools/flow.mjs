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

// 从头打到第 20 波，验证完整波次流转
let wave = 0;
while (wave < 25) {
  const scene = await sceneKey();
  if (scene.includes('Result')) break;
  if (scene.includes('Prep')) {
    await page.keyboard.press('Space');
    await sleep(900);
    wave += 1;
    console.log(`wave ${wave} start ->`, await sceneKey());
    continue;
  }
  await clearWave();
  await sleep(1300);
  console.log(`wave ${wave} cleared ->`, await sceneKey());
}

const finalScene = await sceneKey();
const stats = await page.evaluate(() => {
  const run = window.__game.registry.get('run');
  return { wave: run.wave_index + 1, kills: run.kills, save: localStorage.getItem('rogue-waves-save') };
});
console.log('final', finalScene, stats);
await page.screenshot({ path: `${OUT}/04-result-win.png` });

console.log('errors:', errors.length ? errors.slice(0, 5) : 'none');
await browser.close();
