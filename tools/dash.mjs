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
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

await page.goto('http://127.0.0.1:5173/?renderer=canvas', { waitUntil: 'networkidle0' });
await sleep(1000);

const result = await page.evaluate(async () => {
  const s = window.__game.scene.keys.Battle;
  s.player.body.reset(640, 360);
  s.lastMove.set(1, 0);
  const start = s.player.x;
  s.startDash(240, 400);

  await new Promise((r) => setTimeout(r, 80));
  const mid = s.player.x;
  const midDash = s.dashMs;

  await new Promise((r) => setTimeout(r, 400));
  const end = s.player.x;

  return {
    start: Math.round(start),
    at80ms: Math.round(mid),
    midDashLeft: Math.round(midDash),
    at480ms: Math.round(end),
    traveledEarly: Math.round(mid - start),
    traveledTotal: Math.round(end - start),
  };
});
console.log('dash', result);
console.log('errors', errors.length ? errors : 'none');
await browser.close();
