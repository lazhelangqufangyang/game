import { describe, expect, it } from 'vitest';
import {
  MAX_EQUIPMENT,
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
  { id: 'dagger', name: '短剑', desc: '', price: 10, kind: 'stat', mods: { damage_pct: 10 } },
  { id: 'bracer', name: '护腕', desc: '', price: 10, kind: 'stat', mods: { max_hp: 25 } },
  {
    id: 'shadow_blade',
    name: '影刃',
    desc: '',
    price: 12,
    kind: 'equipment',
    recipe: ['dagger', 'bracer'],
    mods: { damage_pct: 18 },
    active: { kind: 'dash', cooldown_ms: 8000, power: 210 },
  },
  {
    id: 'bulwark',
    name: '壁垒',
    desc: '',
    price: 12,
    kind: 'equipment',
    recipe: ['bracer', 'bracer'],
    mods: { max_hp: 60 },
    active: { kind: 'shield', cooldown_ms: 12000, power: 70, duration_ms: 4000 },
  },
];

const run = () => ({
  economy: 100,
  hp: 50,
  max_hp: 100,
  equipment: [] as string[],
  items: [] as string[],
});

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

describe('装备与配方', () => {
  it('小件只加属性、不占装备格', () => {
    const r = run();
    expect(buyItem(items[1]!, r)).toBe('ok');
    expect(r.items).toEqual(['dagger']);
    expect(r.equipment).toHaveLength(0);
    expect(inventoryMods(items, r.items).damage_pct).toBe(10);
  });

  it('没有组件时无法合成成品，也不扣钱', () => {
    const r = run();
    expect(buyItem(items[3]!, r)).toBe('recipe');
    expect(r.economy).toBe(100);
    expect(r.equipment).toHaveLength(0);
  });

  it('买齐组件后合成会消耗组件并占用装备格', () => {
    const r = run();
    buyItem(items[1]!, r);
    buyItem(items[2]!, r);
    expect(r.economy).toBe(80);

    expect(buyItem(items[3]!, r)).toBe('ok');
    expect(r.economy).toBe(68);
    expect(r.equipment).toEqual(['shadow_blade']);
    expect(r.items).toEqual(['shadow_blade']);
    expect(inventoryMods(items, r.items).damage_pct).toBe(18);
  });

  it('同组件重复需求按数量校验（壁垒 = 护腕 × 2）', () => {
    const r = run();
    buyItem(items[2]!, r);
    expect(recipeStatus(items[4]!, r.items)).toEqual({ ok: false, missing: ['bracer'] });
    buyItem(items[2]!, r);
    expect(recipeStatus(items[4]!, r.items).ok).toBe(true);
    expect(buyItem(items[4]!, r)).toBe('ok');
    expect(r.equipment).toEqual(['bulwark']);
  });

  it('装备格上限为 6', () => {
    const r = run();
    r.equipment = Array.from({ length: MAX_EQUIPMENT }, () => 'shadow_blade');
    r.items = ['dagger', 'bracer'];
    expect(buyItem(items[3]!, r)).toBe('slots');
    expect(r.economy).toBe(100);
  });

  it('消耗品立即回血且不超过上限', () => {
    const r = run();
    r.hp = 80;
    expect(buyItem(items[0]!, r)).toBe('ok');
    expect(r.hp).toBe(100);
  });

  it('只有成品且带主动效果的才进入主动栏', () => {
    const actives = activeItems(items, ['shadow_blade', 'bulwark']);
    expect(actives.map((i) => i.id)).toEqual(['shadow_blade', 'bulwark']);
    expect(activeItems(items, ['dagger'])).toHaveLength(0);
  });
});

describe('商店', () => {
  it('随机 4 件不重复商品', () => {
    const offers = rollShop(items, mulberry32(3), 4);
    expect(offers).toHaveLength(4);
    expect(new Set(offers).size).toBe(4);
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
});
