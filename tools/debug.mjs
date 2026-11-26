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
await new Promise((r) => setTimeout(r, 3000));

const info = await page.evaluate(() => {
  const s = window.__game.scene.keys.Battle;
  const enemies = s.enemies.getChildren().filter((e) => e.active);
  const bullets = s.bullets.getChildren().filter((b) => b.active);
  return {
    sceneActive: s.scene.isActive(),
    player: { x: Math.round(s.player.x), y: Math.round(s.player.y), body: !!s.player.body },
    kills: s.run.kills,
    hp: s.run.hp,
    enemyCount: enemies.length,
    enemies: enemies.slice(0, 5).map((e) => ({
      x: Math.round(e.x),
      y: Math.round(e.y),
      hp: e.getData('hp'),
      bodyEnabled: e.body?.enable,
    })),
    bulletCount: bullets.length,
    bullets: bullets.slice(0, 5).map((b) => ({
      x: Math.round(b.x),
      y: Math.round(b.y),
      vx: Math.round(b.body?.velocity.x ?? 0),
      vy: Math.round(b.body?.velocity.y ?? 0),
    })),
    waveFinished: s.director.finished,
    bulletGroupChildren: s.bullets.getLength(),
    enemyGroupChildren: s.enemies.getLength(),
  };
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
