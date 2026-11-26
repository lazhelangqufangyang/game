import { describe, expect, it } from 'vitest';
import {
  MAX_SLOTS,
  activeItems,
  buyItem,
  chooseEvolution,
  evolutionMods,
  evolutionPerks,
  inventoryMods,
  nextStage,
  ownedCount,
  recipeStatus,
  rollShop,
  sellItem,
} from '../src/systems/meta';
import { mulberry32 } from '../src/core/rng';
import type { EvolutionStage, ItemDef } from '../src/core/types';

const stages: EvolutionStage[] = [
  {
    stage: 1,
    cost: 3,
    options: [
      { id: 'flame', name: '火', desc: '', mods: { damage_pct: 20 } },
      { id: 'storm', name: '雷', desc: '', mods: { aspd_pct: 18 } },
    ],
  },
  {
    stage: 2,
    cost: 6,
    options: [
      { id: 'flame2', name: '火2', desc: '', mods: { damage_pct: 25 } },
      { id: 'storm2', name: '雷2', desc: '', mods: { aspd_pct: 25 }, skill_cd_pct: 20 },
    ],
  },
];

const items: ItemDef[] = [
  { id: 'potion', name: '药', desc: '', price: 8, kind: 'consumable', heal: 40 },
  { id: 'dagger', name: '短剑', desc: '', price: 8, kind: 'item', tier: 1, mods: { damage_pct: 10 } },
  { id: 'gloves', name: '手套', desc: '', price: 8, kind: 'item', tier: 1, mods: { aspd_pct: 8 } },
  { id: 'bracer', name: '护腕', desc: '', price: 8, kind: 'item', tier: 1, mods: { max_hp: 25 } },
  {
    id: 'warblade',
    name: '战刃',
    desc: '',
    price: 14,
    kind: 'item',
    tier: 2,
    recipe: ['dagger', 'gloves'],
    mods: { damage_pct: 18 },
  },
  {
    id: 'tower_shield',
    name: '重盾',
    desc: '',
    price: 14,
    kind: 'item',
    tier: 2,
    recipe: ['bracer', 'bracer'],
    mods: { max_hp: 60 },
  },
  {
    id: 'shadow_blade',
    name: '影刃',
    desc: '',
    price: 20,
    kind: 'item',
    tier: 3,
    recipe: ['warblade', 'bracer'],
    mods: { damage_pct: 28 },
    active: { kind: 'dash', cooldown_ms: 8000, power: 210 },
  },
  {
    id: 'king_blade',
    name: '王者之刃',
    desc: '',
    price: 30,
    kind: 'item',
    tier: 3,
    recipe: ['warblade', 'tower_shield'],
    mods: { damage_pct: 45 },
  },
];

const run = () => ({ economy: 100, hp: 50, max_hp: 100, items: [] as string[] });

describe('英雄进化', () => {
  it('按选择数量推进阶段，走完返回 null', () => {
    expect(nextStage(stages, [])?.stage).toBe(1);
    expect(nextStage(stages, ['flame'])?.stage).toBe(2);
    expect(nextStage(stages, ['flame', 'storm2'])).toBeNull();
  });

  it('扣精粹并记录所选方向', () => {
    const r = { essence: 10, evolutions: [] as string[] };
    expect(chooseEvolution(r, stages, 'storm')).toBe(true);
    expect(r.essence).toBe(7);
    expect(r.evolutions).toEqual(['storm']);
  });

  it('方向必须属于当前阶段', () => {
    const r = { essence: 10, evolutions: [] as string[] };
    expect(chooseEvolution(r, stages, 'flame2')).toBe(false);
  });

  it('方向修正累加，特殊效果单独统计', () => {
    const chosen = ['flame', 'storm2'];
    expect(evolutionMods(stages, chosen).damage_pct).toBe(20);
    expect(evolutionPerks(stages, chosen).skill_cd_pct).toBe(20);
  });
});

describe('装备：小件也占格', () => {
  it('买小件会占用一个格子', () => {
    const r = run();
    expect(buyItem(items[1]!, r)).toBe('ok');
    expect(r.items).toEqual(['dagger']);
    expect(inventoryMods(items, r.items).damage_pct).toBe(10);
  });

  it('格子满后不能再买小件', () => {
    const r = run();
    r.items = Array.from({ length: MAX_SLOTS }, () => 'dagger');
    expect(buyItem(items[1]!, r)).toBe('slots');
    expect(r.economy).toBe(100);
  });

  it('组件不足时无法合成中件', () => {
    const r = run();
    expect(buyItem(items[4]!, r)).toBe('recipe');
    expect(r.economy).toBe(100);
  });

  it('两个小件合成中件：消耗组件、净腾出一格', () => {
    const r = run();
    buyItem(items[1]!, r);
    buyItem(items[2]!, r);
    expect(r.items).toHaveLength(2);

    expect(buyItem(items[4]!, r)).toBe('ok');
    expect(r.items).toEqual(['warblade']);
    expect(inventoryMods(items, r.items).damage_pct).toBe(18);
  });

  it('中件 + 小件合成大件', () => {
    const r = run();
    buyItem(items[1]!, r);
    buyItem(items[2]!, r);
    buyItem(items[4]!, r); // 战刃
    buyItem(items[3]!, r); // 护腕
    expect(buyItem(items[6]!, r)).toBe('ok');
    expect(r.items).toEqual(['shadow_blade']);
  });

  it('两个中件合成大件', () => {
    const r = run();
    buyItem(items[1]!, r);
    buyItem(items[2]!, r);
    buyItem(items[4]!, r); // 战刃
    buyItem(items[3]!, r);
    buyItem(items[3]!, r);
    buyItem(items[5]!, r); // 重盾（护腕×2）
    expect(r.items).toEqual(['warblade', 'tower_shield']);
    expect(buyItem(items[7]!, r)).toBe('ok');
    expect(r.items).toEqual(['king_blade']);
  });

  it('合成不需要额外空格（净占用为负）', () => {
    const r = run();
    buyItem(items[1]!, r);
    buyItem(items[2]!, r);
    r.items = [...r.items, 'x', 'y', 'z', 'w']; // 凑满 6 格
    expect(r.items).toHaveLength(MAX_SLOTS);
    expect(buyItem(items[4]!, r)).toBe('ok');
    expect(r.items).toHaveLength(5);
  });

  it('消耗品不占格，立即回血', () => {
    const r = run();
    r.hp = 80;
    expect(buyItem(items[0]!, r)).toBe('ok');
    expect(r.hp).toBe(100);
    expect(r.items).toHaveLength(0);
  });

  it('只有带主动效果的装备进入主动栏', () => {
    expect(activeItems(items, ['shadow_blade'])).toHaveLength(1);
    expect(activeItems(items, ['dagger'])).toHaveLength(0);
  });

  it('回收装备返还半价并移除一件', () => {
    const r = run();
    buyItem(items[1]!, r);
    buyItem(items[1]!, r);
    expect(r.items).toHaveLength(2);

    expect(sellItem(items[1]!, r)).toBe('ok');
    expect(r.items).toEqual(['dagger']);
    expect(r.economy).toBe(100 - 16 + 4);
  });

  it('回收不存在的装备返回 missing 且不给钱', () => {
    const r = run();
    expect(sellItem(items[1]!, r)).toBe('missing');
    expect(r.economy).toBe(100);
  });
});

describe('商店', () => {
  it('每波 4 件，至少 2 个小件且不重复', () => {
    const offers = rollShop(items, mulberry32(3), 4);
    expect(offers).toHaveLength(4);
    expect(new Set(offers).size).toBe(4);
    const smallCount = offers.filter((id) => items.find((i) => i.id === id)?.tier === 1).length;
    expect(smallCount).toBeGreaterThanOrEqual(2);
  });

  it('经济不足时不扣钱、不进货', () => {
    const r = { ...run(), economy: 5 };
    expect(buyItem(items[1]!, r)).toBe('poor');
    expect(r.economy).toBe(5);
    expect(r.items).toHaveLength(0);
  });

  it('ownedCount 统计重复组件', () => {
    expect(ownedCount(['bracer', 'bracer', 'dagger'], 'bracer')).toBe(2);
  });

  it('配方状态列出缺少的组件', () => {
    expect(recipeStatus(items[5]!, ['bracer', 'dagger']).missing).toEqual(['bracer']);
  });
});
