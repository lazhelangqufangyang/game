import { describe, expect, it } from 'vitest';
import { BondTracker } from '../src/systems/bonds';
import type { BondDef } from '../src/core/types';

const elementBond: BondDef = {
  id: 'element',
  name: '元素共鸣',
  star: 5,
  members: ['ember', 'spark', 'tide', 'frost', 'gale'],
  tiers: [
    { need: 3, name: '元素回响', desc: '', mods: { damage_pct: 12, crit_chance: 8 } },
    { need: 5, name: '元素风暴', desc: '', mods: { damage_pct: 30, aspd_pct: 25 } },
  ],
};

const vitalityBond: BondDef = {
  id: 'vitality',
  name: '生命共鸣',
  star: 3,
  members: ['iron_body', 'vigor', 'bulwark'],
  tiers: [{ need: 3, name: '血脉觉醒', desc: '', mods: { max_hp: 80, lifesteal_pct: 4 } }],
};

const tracker = () => new BondTracker([elementBond, vitalityBond]);

describe('BondTracker（元素 5 星：3 件小进化 / 5 件完全体）', () => {
  it('前两个成员不吸收（正常占格）', () => {
    const t = tracker();
    expect(t.add('ember').absorbed).toBe(false);
    expect(t.add('spark').absorbed).toBe(false);
    expect(t.count('element')).toBe(2);
    expect(t.activeTier(elementBond)).toBeNull();
  });

  it('第三个触发小进化：absorbed + 激活 need=3', () => {
    const t = tracker();
    t.add('ember');
    t.add('spark');
    const third = t.add('tide');
    expect(third.absorbed).toBe(true);
    expect(third.activation?.tier.name).toBe('元素回响');
    expect(t.activeTier(elementBond)?.need).toBe(3);
  });

  it('第 4 个不吸收（仍然占格），第 5 个触发完全体', () => {
    const t = tracker();
    for (const id of ['ember', 'spark', 'tide']) t.add(id);
    expect(t.add('frost').absorbed).toBe(false);
    expect(t.activeTier(elementBond)?.need).toBe(3);

    const fifth = t.add('gale');
    expect(fifth.absorbed).toBe(true);
    expect(fifth.activation?.tier.name).toBe('元素风暴');
    expect(t.activeTier(elementBond)?.need).toBe(5);
  });

  it('willAbsorb 与 add 的判定一致', () => {
    const t = tracker();
    t.add('ember');
    t.add('spark');
    expect(t.willAbsorb('tide')).toBe(true); // 第 3 个会触发小进化

    t.add('tide');
    expect(t.willAbsorb('frost')).toBe(false); // 第 4 个仍占格

    t.add('frost');
    expect(t.willAbsorb('gale')).toBe(true); // 第 5 个触发完全体
  });

  it('修正值只取最高档，不叠加低档', () => {
    const t = tracker();
    for (const id of ['ember', 'spark', 'tide']) t.add(id);
    expect(t.mods().damage_pct).toBe(12);

    t.add('frost');
    t.add('gale');
    expect(t.mods().damage_pct).toBe(30);
    expect(t.mods().aspd_pct).toBe(25);
    expect(t.mods().crit_chance).toBe(0);
  });

  it('3 星生命羁绊凑 3 个直接进化', () => {
    const t = tracker();
    expect(t.add('iron_body').absorbed).toBe(false);
    expect(t.add('vigor').absorbed).toBe(false);
    const third = t.add('bulwark');
    expect(third.absorbed).toBe(true);
    expect(t.mods().max_hp).toBe(80);
  });

  it('非羁绊被动不受影响', () => {
    const t = tracker();
    expect(t.add('edge').absorbed).toBe(false);
    expect(t.add('edge').activation).toBeNull();
    expect(t.count('element')).toBe(0);
  });

  it('restore 可以恢复跨波次进度并重算档位', () => {
    const t = tracker();
    t.restore(['ember', 'spark', 'tide', 'frost']);
    expect(t.count('element')).toBe(4);
    expect(t.activeTier(elementBond)?.need).toBe(3);
    expect(t.willAbsorb('gale')).toBe(true);
  });
});
