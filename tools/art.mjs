/**
 * 美术验收截图：Prep → Battle 各截一张，用来肉眼确认背景/角色/UI 的观感。
 * 用法：先 npm run dev，再 node tools/art.mjs
 * 产物：.shots/30-art-prep.png / 31-art-battle.png / 32-art-pickup.png
 */
import puppeteer from 'puppeteer-core';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL = 'http://127.0.0.1:5173/?renderer=canvas';

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: 'new',
  args: ['--no-sandbox', '--window-size=1300,820'],
});

const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720 });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') console.log(`[${m.type()}]`, m.text());
});

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

await page.goto(URL, { waitUntil: 'networkidle0' });
await wait(900);
await page.screenshot({ path: '.shots/30-art-prep.png' });

await page.keyboard.press('Space');
await wait(2600);
await page.screenshot({ path: '.shots/31-art-battle.png' });

// 召唤一只经济怪并打掉，看掉落球和受击闪白的观感
await page.evaluate(() => {
  const s = window.__game.scene.keys.Battle;
  s.trySummon('coffer');
  s.trySummon('scholar');
});
await wait(2600);
await page.screenshot({ path: '.shots/32-art-summon.png' });

const report = await page.evaluate(() => {
  const s = window.__game.scene.keys.Battle;
  const enemies = s.enemies.getChildren().filter((e) => e.active);
  return {
    sceneActive: s.scene.isActive(),
    enemyCount: enemies.length,
    enemyTextures: [...new Set(enemies.map((e) => e.texture.key))],
    enemyScale: enemies[0] ? [enemies[0].scaleX, enemies[0].scaleY] : null,
    enemyBodyRadius: enemies[0] ? enemies[0].body?.radius : null,
    playerTexture: s.player.texture.key,
    playerScale: [s.player.scaleX, s.player.scaleY],
    bulletTexture: (s.bullets.getChildren().find((b) => b.active) ?? { texture: { key: 'none' } })
      .texture.key,
    summons: s.summons.getChildren().filter((x) => x.active).map((x) => x.texture.key),
    pickups: s.pickups.getChildren().filter((x) => x.active).map((x) => x.texture.key),
    textures: ['hero', 'hero-alt', 'floor-a', 'vignette', 'enemy-grunt', 'bullet', 'shard'].filter(
      (k) => s.textures.exists(k),
    ),
    anims: s.anims.anims.has('hero-walk'),
  };
});
console.log(JSON.stringify(report, null, 2));

await browser.close();
