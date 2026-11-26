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
await sleep(800);
await page.keyboard.press('Space');
await sleep(900);

const give = (ids) =>
  page.evaluate((list) => {
    const s = window.__game.scene.keys.Battle;
    const all = window.__config.passives;
    for (const id of list) {
      const def = all.find((p) => p.id === id);
      if (def) s.acquirePassive(def);
    }
  }, ids);

const snap = () =>
  page.evaluate(() => {
    const s = window.__game.scene.keys.Battle;
    return {
      slots: s.book.count,
      ids: s.book.ids(),
      element: s.bonds.count('element'),
      tier: s.bonds.activeTier(window.__config.bonds[0])?.name ?? null,
      damage: s.stats.damage,
      maxHp: s.stats.max_hp,
      bondText: s.bondText.text,
    };
  });

// 先塞 6 个普通被动
await give(['edge', 'haste', 'stride', 'focus', 'hunter', 'leech']);
console.log('junk', await snap());

// 2 个元素：不触发
await give(['ember', 'spark']);
console.log('2 elements', await snap());

// 第 3 个：触发小进化，三件离开格子
await give(['tide']);
await sleep(400);
console.log('3 elements -> 小进化', await snap());
await page.screenshot({ path: `${OUT}/50-bond-tier1.png` });

// 第 4 个：仍占格
await give(['frost']);
console.log('4 elements', await snap());

// 第 5 个：完全体，全部释放
await give(['gale']);
await sleep(400);
console.log('5 elements -> 完全体', await snap());
await page.screenshot({ path: `${OUT}/51-bond-tier2.png` });

// 3 星生命羁绊
await give(['iron_body', 'vigor', 'bulwark']);
await sleep(300);
console.log('vitality', await snap());
await page.screenshot({ path: `${OUT}/52-vitality.png` });

console.log('errors', errors.length ? errors : 'none');
await browser.close();
