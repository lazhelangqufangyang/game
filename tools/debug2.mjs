import puppeteer from 'puppeteer-core';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: 'new',
  args: ['--no-sandbox', '--window-size=1280,800'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720 });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto('http://127.0.0.1:5173/?renderer=canvas', { waitUntil: 'networkidle0' });
await new Promise((r) => setTimeout(r, 800));
await page.keyboard.press('Space');
await new Promise((r) => setTimeout(r, 500));

await page.evaluate(() => {
  const s = window.__game.scene.keys.Battle;
  window.__hits = 0;
  window.__hitsInfo = [];
  const orig = s.hitEnemy.bind(s);
  s.hitEnemy = (bullet, enemy) => {
    window.__hits += 1;
    if (window.__hitsInfo.length < 10) {
      window.__hitsInfo.push({
        bx: Math.round(bullet.x),
        by: Math.round(bullet.y),
        ex: Math.round(enemy.x),
        ey: Math.round(enemy.y),
        bActive: bullet.active,
        eActive: enemy.active,
      });
    }
    orig(bullet, enemy);
  };
});

await new Promise((r) => setTimeout(r, 6000));

const info = await page.evaluate(() => {
  const s = window.__game.scene.keys.Battle;
  const enemies = s.enemies.getChildren().filter((e) => e.active);
  return {
    hits: window.__hits,
    hitsInfo: window.__hitsInfo,
    kills: s.run.kills,
    hp: s.run.hp,
    enemyCount: enemies.length,
    enemies: enemies.map((e) => ({
      x: Math.round(e.x),
      y: Math.round(e.y),
      hp: e.getData('hp'),
      bw: Math.round(e.body.width),
      bh: Math.round(e.body.height),
      ox: Math.round(e.body.offset.x),
      oy: Math.round(e.body.offset.y),
    })),
    bullets: s.bullets.getChildren().filter((b) => b.active).length,
  };
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
