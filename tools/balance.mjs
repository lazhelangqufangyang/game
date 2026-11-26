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
await sleep(900);

const hero = await page.evaluate(() => ({
  hp: window.__config.hero.max_hp,
  speed: window.__config.hero.speed,
  growth: window.__config.levels.growth_per_level.max_hp,
  shop: window.__game.registry.get('run').shop_offers,
}));
console.log('hero/config', hero);

// 跳过开场：直接进战斗
await page.keyboard.press('Space');
await sleep(1200);

// 杀一只杂兵，检查掉经济/经验
const before = await page.evaluate(() => {
  const run = window.__game.registry.get('run');
  return { economy: run.economy, xp: run.xp, essence: run.essence, kills: run.kills };
});

const reward = await page.evaluate(() => {
  const s = window.__game.scene.keys.Battle;
  const enemy = s.enemies.getChildren().find((e) => e.active && e.getData('def_id') === 'grunt');
  if (!enemy) return null;
  s.killEnemy(enemy);
  const run = window.__game.registry.get('run');
  return { economy: run.economy, xp: run.xp, essence: run.essence, kills: run.kills };
});
console.log('after grunt', { before, reward });

// 精英（重装）应给精粹
const elite = await page.evaluate(() => {
  const s = window.__game.scene.keys.Battle;
  s.director.update(0);
  const def = window.__config.enemies.brute;
  const sprite = s.enemies.get(s.player.x + 40, s.player.y, `enemy-${def.id}`);
  sprite.enableBody(true, s.player.x + 40, s.player.y, true, true);
  sprite.setData('hp', 1);
  sprite.setData('damage', def.damage);
  sprite.setData('speed', def.speed);
  sprite.setData('def_id', def.id);
  const before = window.__game.registry.get('run').essence;
  s.killEnemy(sprite);
  return { before, after: window.__game.registry.get('run').essence };
});
console.log('elite essence', elite);

// 接触判定：贴脸但不重叠时是否掉血（attack_range 很小）
const contact = await page.evaluate(() => {
  const s = window.__game.scene.keys.Battle;
  const run = window.__game.registry.get('run');
  const def = window.__config.enemies.grunt;
  const sprite = s.enemies.get(s.player.x + 40, s.player.y, `enemy-${def.id}`);
  sprite.enableBody(true, s.player.x + 40, s.player.y, true, true);
  sprite.setData('hp', 999);
  sprite.setData('damage', def.damage);
  sprite.setData('speed', 0);
  sprite.setData('def_id', def.id);
  const hp0 = run.hp;
  s.updateCombat(16);
  return { hp0, hp1: run.hp, gap: 40, attackRange: def.attack_range, radius: def.radius };
});
console.log('contact 40px away', contact);

await page.screenshot({ path: `${OUT}/90-hard-mode.png` });
console.log('errors', errors.length ? errors.slice(0, 5) : 'none');
await browser.close();
