import { describe, expect, it } from 'vitest';
import { PassiveBook, MAX_SLOTS, aggregate } from '../src/systems/passives';
import { computeStats, rollPassives, XpTracker } from '../src/systems/progression';
import { mulberry32 } from '../src/core/rng';
import type { HeroDef, LevelsDef, PassiveDef } from '../src/core/types';

const levels: LevelsDef = {
  max_level: 10,
  xp_to_next: [10, 15, 22, 30, 40, 52, 66, 82, 100],
  growth_per_level: { max_hp: 8, damage_pct: 3, aspd_pct: 2, speed_pct: 1 },
  passive_offer_levels: [2, 3, 4, 5, 6, 7, 8, 9, 10],
  refresh_cost: 15,
};

const hero: HeroDef = {
  id: 'h',
  name: 'H',
  max_hp: 100,
  speed: 260,
  radius: 16,
  color: '#fff',
  attack: { damage: 12, cooldown_ms: 320, bullet_speed: 760, range: 560, bullet_radius: 5 },
};

const passive = (id: string, mods: Partial<PassiveDef['mods']> = {}): PassiveDef => ({
  id,
  name: id,
  desc: '',
  rarity: 'common',
  mods,
});

describe('XpTracker', () => {
  it('累计经验并在达到阈值时升级，剩余经验保留', () => {
    const t = new XpTracker(levels);
    expect(t.add(10)).toBe(1);
    expect(t.level).toBe(2);
    expect(t.xp).toBe(0);
    expect(t.add(20)).toBe(1); // 15 升级，剩 5
    expect(t.level).toBe(3);
    expect(t.xp).toBe(5);
  });

  it('一次加大量经验可以连升多级', () => {
    const t = new XpTracker(levels);
    const gained = t.add(10 + 15 + 22 + 30);
    expect(gained).toBe(4);
    expect(t.level).toBe(5);
  });

  it('满级后不再升级，经验清零', () => {
    const t = new XpTracker(levels, 10, 0);
    expect(t.needed).toBeNull();
    expect(t.add(9999)).toBe(0);
    expect(t.level).toBe(10);
    expect(t.progress).toBe(1);
  });

  it('拒绝负数经验', () => {
    expect(() => new XpTracker(levels).add(-5)).toThrow();
  });
});

describe('属性结算', () => {
  it('等级成长与被动叠加', () => {
    const stats = computeStats(hero, aggregate([passive('a', { damage_pct: 12, max_hp: 25 })]), 3, levels.growth_per_level);
    // 3 级 = 2 次成长：伤害 12 * (1 + 6% + 12%) = 14.16
    expect(stats.damage).toBeCloseTo(14.16, 2);
    expect(stats.max_hp).toBe(100 + 8 * 2 + 25);
    expect(stats.multishot).toBe(1);
  });

  it('攻速提升会缩短攻击间隔，但有下限', () => {
    const fast = computeStats(hero, aggregate([passive('h', { aspd_pct: 100 })]), 1, levels.growth_per_level);
    expect(fast.cooldown_ms).toBeCloseTo(160, 3);
    const crazy = computeStats(hero, aggregate([passive('h2', { aspd_pct: 100000 })]), 1, levels.growth_per_level);
    expect(crazy.cooldown_ms).toBeGreaterThanOrEqual(80);
  });

  it('多重射击至少 1 发，暴击率封顶 100%', () => {
    const stats = computeStats(hero, aggregate([passive('m', { multishot: 2, crit_chance: 250 })]), 1, levels.growth_per_level);
    expect(stats.multishot).toBe(3);
    expect(stats.crit_chance).toBe(1);
  });
});

describe('PassiveBook（8 格）', () => {
  it('最多放 8 个，第 9 个被拒绝', () => {
    const book = new PassiveBook();
    for (let i = 0; i < MAX_SLOTS; i += 1) {
      expect(book.add(passive(`p${i}`))).toBe(true);
    }
    expect(book.isFull).toBe(true);
    expect(book.add(passive('p9'))).toBe(false);
    expect(book.count).toBe(8);
  });

  it('满格时必须替换，被替换的被动返回给 UI 展示', () => {
    const book = new PassiveBook();
    for (let i = 0; i < MAX_SLOTS; i += 1) book.add(passive(`p${i}`));

    const removed = book.replace(2, passive('new'));
    expect(removed?.id).toBe('p2');
    expect(book.has('p2')).toBe(false);
    expect(book.has('new')).toBe(true);
    expect(book.count).toBe(8);
  });

  it('空位替换失败，不改变状态', () => {
    const book = new PassiveBook();
    book.add(passive('a'));
    expect(book.replace(3, passive('b'))).toBeNull();
    expect(book.count).toBe(1);
  });

  it('聚合所有被动的修正值', () => {
    const mods = aggregate([
      passive('a', { damage_pct: 10, max_hp: 5 }),
      passive('b', { damage_pct: 5, multishot: 1 }),
    ]);
    expect(mods.damage_pct).toBe(15);
    expect(mods.max_hp).toBe(5);
    expect(mods.multishot).toBe(1);
  });
});

describe('派发三选一', () => {
  const pool = Array.from({ length: 8 }, (_, i) => passive(`p${i}`));

  it('抽出 3 个不重复候选，且优先给未拥有的', () => {
    const picked = rollPassives(pool, ['p0', 'p1'], 3, mulberry32(7));
    expect(picked).toHaveLength(3);
    expect(new Set(picked.map((p) => p.id)).size).toBe(3);
    expect(picked.some((p) => p.id === 'p0')).toBe(false);
  });

  it('池子不够时用已拥有的补位，仍然不重复', () => {
    const picked = rollPassives([passive('a'), passive('b')], ['a', 'b'], 3, mulberry32(3));
    expect(picked).toHaveLength(2);
    expect(new Set(picked.map((p) => p.id)).size).toBe(2);
  });
});
