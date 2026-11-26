import { describe, expect, it } from 'vitest';
import {
  MAX_EQUIPMENT,
  buyItem,
  chooseEvolution,
  equipmentMods,
  evolutionMods,
  evolutionPerks,
  nextStage,
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
      { id: 'tide', name: '水', desc: '', mods: { max_hp: 60 } },
    ],
  },
  {
    stage: 2,
    cost: 6,
    options: [
      { id: 'flame2', name: '火2', desc: '', mods: { damage_pct: 25 } },
      { id: 'storm2', name: '雷2', desc: '', mods: { aspd_pct: 25 }, skill_cd_pct: 20 },
      { id: 'tide2', name: '水2', desc: '', mods: { max_hp: 100 }, heal_on_kill: 2 },
    ],
  },
];

const items: ItemDef[] = [
  { id: 'potion', name: '药', desc: '', price: 8, kind: 'consumable', heal: 40 },
  { id: 'whetstone', name: '石', desc: '', price: 12, kind: 'equipment', mods: { damage_pct: 10 } },
  { id: 'boots', name: '靴', desc: '', price: 10, kind: 'equipment', mods: { speed_pct: 12 } },
  { id: 'core', name: '核', desc: '', price: 26, kind: 'equipment', mods: { multishot: 1 } },
];

describe('英雄进化', () => {
  it('按选择数量推进阶段，走完返回 null', () => {
    expect(nextStage(stages, [])?.stage).toBe(1);
    expect(nextStage(stages, ['flame'])?.stage).toBe(2);
    expect(nextStage(stages, ['flame', 'storm2'])).toBeNull();
  });

  it('扣精粹并记录所选方向', () => {
    const run = { essence: 10, evolutions: [] as string[] };
    expect(chooseEvolution(run, stages, 'storm')).toBe(true);
    expect(run.essence).toBe(7);
    expect(run.evolutions).toEqual(['storm']);
  });

  it('方向必须属于当前阶段', () => {
    const run = { essence: 10, evolutions: [] as string[] };
    expect(chooseEvolution(run, stages, 'flame2')).toBe(false);
    expect(run.evolutions).toHaveLength(0);
  });

  it('精粹不够时拒绝', () => {
    const run = { essence: 2, evolutions: [] as string[] };
    expect(chooseEvolution(run, stages, 'flame')).toBe(false);
    expect(run.essence).toBe(2);
    expect(run.evolutions).toHaveLength(0);
  });

  it('方向修正会累加，特殊效果单独统计', () => {
    const chosen = ['flame', 'storm2'];
    expect(evolutionMods(stages, chosen).damage_pct).toBe(20);
    expect(evolutionMods(stages, chosen).aspd_pct).toBe(25);
    const perks = evolutionPerks(stages, chosen);
    expect(perks.skill_cd_pct).toBe(20);
    expect(perks.heal_on_kill).toBe(0);
  });
});

describe('商店', () => {
  it('随机 3 件不重复商品', () => {
    const offers = rollShop(items, mulberry32(5), 3);
    expect(offers).toHaveLength(3);
    expect(new Set(offers).size).toBe(3);
  });

  it('买装备扣经济并进入装备栏，属性生效', () => {
    const run = { economy: 100, hp: 50, max_hp: 100, equipment: [] as string[] };
    expect(buyItem(items[1]!, run)).toBe('ok');
    expect(run.economy).toBe(88);
    expect(run.equipment).toEqual(['whetstone']);
    expect(equipmentMods(items, run.equipment).damage_pct).toBe(10);
  });

  it('装备满 3 件后拒绝，且不扣钱', () => {
    const run = { economy: 100, hp: 50, max_hp: 100, equipment: ['a', 'b', 'c'] };
    expect(run.equipment).toHaveLength(MAX_EQUIPMENT);
    expect(buyItem(items[3]!, run)).toBe('slots');
    expect(run.economy).toBe(100);
  });

  it('经济不足时不扣钱', () => {
    const run = { economy: 5, hp: 50, max_hp: 100, equipment: [] as string[] };
    expect(buyItem(items[0]!, run)).toBe('poor');
    expect(run.economy).toBe(5);
  });

  it('消耗品立即回血且不超过上限', () => {
    const run = { economy: 20, hp: 80, max_hp: 100, equipment: [] as string[] };
    expect(buyItem(items[0]!, run)).toBe('ok');
    expect(run.hp).toBe(100);
    expect(run.economy).toBe(12);
  });
});
