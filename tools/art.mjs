/**
 * 美术验收截图（只关心画面，不做玩法断言）：
 *   30-art-battle.png  开局战斗画面
 *   31-art-battle2.png 打一会儿（有怪、子弹、伤害数字）
 *   32-art-summon.png  召唤 + 掉落
 *
 * 用法：先 npm run dev，再 node tools/art.mjs
 * 说明：流程是 Boot 直接进 Battle（波间结算在战斗内），波间面板与升级三选一会挡画面，
 *      截图前会自动选一张卡关掉；同时把英雄血量补满，避免截图过程中死亡打断。
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
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error' && !m.text().includes('404')) errors.push(`[console] ${m.text()}`);
});

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** 关掉升级三选一 / 波间面板，顺便把血补满，保证截图不被死亡或弹窗打断。 */
async function keepAlive() {
  for (let i = 0; i < 10; i += 1) {
    const state = await page.evaluate(() => {
      const s = window.__game.scene.keys.Battle;
      if (!s || !s.scene.isActive()) return { alive: false };
      if (s.run) s.run.hp = s.run.max_hp;
      return { alive: true, overlay: !!s.overlayOpen, intermission: !!s.intermission };
    });
    if (!state.alive) return false;
    if (!state.overlay && !state.intermission) return true;
    await page.mouse.click(361, 349); // 三选一第一张卡
    await wait(320);
    if (state.intermission) {
      await page.keyboard.press('Space');
      await wait(320);
    }
  }
  return true;
}

await page.goto(URL, { waitUntil: 'networkidle0' });

for (let i = 0; i < 40; i += 1) {
  const ready = await page.evaluate(() => {
    const s = window.__game?.scene?.keys?.Battle;
    return !!s && s.scene.isActive() && !!s.player;
  });
  if (ready) break;
  await wait(150);
}

await wait(1200);
await keepAlive();
await page.screenshot({ path: '.shots/30-art-battle.png' });

await page.evaluate(() => {
  const s = window.__game.scene.keys.Battle;
  s.trySummon?.('coffer');
  s.trySummon?.('scholar');
});

await wait(2600);
await keepAlive();
await page.screenshot({ path: '.shots/31-art-battle2.png' });

await wait(2600);
await keepAlive();
await page.screenshot({ path: '.shots/32-art-summon.png' });

const report = await page.evaluate(() => {
  const s = window.__game.scene.keys.Battle;
  if (!s || !s.scene.isActive()) return { sceneActive: false };
  const enemies = s.enemies?.getChildren().filter((e) => e.active) ?? [];
  return {
    sceneActive: true,
    enemyCount: enemies.length,
    enemyTextures: [...new Set(enemies.map((e) => e.texture.key))],
    enemyScale: enemies[0] ? [enemies[0].scaleX, Number(enemies[0].scaleY.toFixed(2))] : null,
    enemyBodyRadius: enemies[0]?.body?.radius ?? null,
    playerTexture: s.player?.texture.key ?? null,
    playerScale: s.player ? [s.player.scaleX, s.player.scaleY] : null,
    summons: s.summons?.getChildren().filter((x) => x.active).map((x) => x.texture.key) ?? [],
    pickups: s.pickups?.getChildren().filter((x) => x.active).map((x) => x.texture.key) ?? [],
    textures: ['hero', 'hero-hurt', 'hero-death', 'arena', 'enemy-grunt-death', 'bullet', 'shard'].filter(
      (k) => s.textures.exists(k),
    ),
    anims: s.anims.anims.has('hero-walk'),
  };
});
console.log(JSON.stringify(report, null, 2));
console.log('errors:', errors.length ? errors.slice(0, 3) : 'none');

await browser.close();
