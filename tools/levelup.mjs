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
    return {
      level: s.xp.level,
      overlay: s.overlayOpen,
      full: s.book.isFull,
      passives: s.run.passives,
      economy: s.run.economy,
      hp: Math.round(s.run.hp),
      maxHp: s.run.max_hp,
      damage: s.stats.damage,
    };
  });

console.log('start', await snap());

// 进入升级：先给经济（刷新按钮按打开时的经济判断可用性），再给一大笔经验连升多级
await page.evaluate(() => {
  window.__game.registry.get('run').economy = 100;
});
await page.evaluate(() => window.__game.scene.keys.Battle.gainXp(700));
await sleep(400);
console.log('after xp', await snap());
await page.screenshot({ path: `${OUT}/30-levelup.png` });

const beforeRefresh = await page.evaluate(() => {
  const s = window.__game.scene.keys.Battle;
  return s.overlay.candidates.map((c) => c.id);
});
await page.mouse.click(640, 538);
await sleep(300);
const afterRefresh = await page.evaluate(() => {
  const s = window.__game.scene.keys.Battle;
  return { ids: s.overlay.candidates.map((c) => c.id), economy: s.run.economy, refreshed: s.overlay.refreshed };
});
console.log('refresh', JSON.stringify({ beforeRefresh, afterRefresh }));
await page.screenshot({ path: `${OUT}/31-refreshed.png` });

// 反复选牌，直到把 8 格填满并触发弃置流程
for (let i = 0; i < 12; i += 1) {
  const st = await snap();
  if (!st.overlay) break;

  await page.mouse.click(362, 350); // 第一张卡
  await sleep(280);

  const afterCard = await snap();
  if (!afterCard.overlay) continue;

  // 进入弃置视图：选第 1 格 -> 确认
  if (afterCard.full) {
    await page.screenshot({ path: `${OUT}/32-discard.png` });
    await page.mouse.click(211, 190);
    await sleep(220);
    await page.screenshot({ path: `${OUT}/33-confirm.png` });
    await page.mouse.click(510, 450);
    await sleep(320);
  }
}

const final = await snap();
console.log('final', JSON.stringify(final));
await page.screenshot({ path: `${OUT}/34-passives.png` });

console.log('errors', errors.length ? errors : 'none');
await browser.close();
