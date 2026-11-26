import puppeteer from 'puppeteer-core';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: 'new',
  args: ['--no-sandbox', '--window-size=1280,800'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720 });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto('http://127.0.0.1:5173/?renderer=canvas', { waitUntil: 'networkidle0' });
await sleep(700);
await page.keyboard.press('Space');
await sleep(800);

await page.evaluate(() => {
  const s = window.__game.scene.keys.Battle;
  window.__log = [];
  const orig = s.collectPickup.bind(s);
  s.collectPickup = (p) => {
    window.__log.push({
      px: Math.round(p.x),
      py: Math.round(p.y),
      bodyX: Math.round(p.body?.x ?? -1),
      playerX: Math.round(s.player.x),
      playerY: Math.round(s.player.y),
    });
    orig(p);
  };
  s.trySummon('coffer');
  s.summons.getChildren().forEach((x) => x.active && x.setData('hp', 1));
});
await sleep(2500);
console.log(JSON.stringify(await page.evaluate(() => window.__log)));
await page.screenshot({ path: 'D:\\小游戏2\\.shots\\23-debug-loot.png' });
await browser.close();
