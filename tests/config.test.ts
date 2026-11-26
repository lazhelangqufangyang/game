import { describe, expect, it } from 'vitest';
import { config } from '../src/config';
import { buildConfig, ConfigError } from '../src/config/validate';

const summons = [
  { id: 'a', name: 'A', resource: 'economy', reward: 1, hp: 10, speed: 10, damage: 1, radius: 10, color: '#fff', cooldown_ms: 1000, max_alive: 2, spawn_distance: 100 },
  { id: 'b', name: 'B', resource: 'xp', reward: 1, hp: 10, speed: 10, damage: 1, radius: 10, color: '#fff', cooldown_ms: 1000, max_alive: 2, spawn_distance: 100 },
  { id: 'c', name: 'C', resource: 'essence', reward: 1, hp: 10, speed: 10, damage: 1, radius: 10, color: '#fff', cooldown_ms: 1000, max_alive: 2, spawn_distance: 100 },
];
const passives = [
  { id: 'p1', name: 'P1', desc: 'd', rarity: 'common', mods: { damage_pct: 10 } },
  { id: 'p2', name: 'P2', desc: 'd', rarity: 'rare', mods: { max_hp: 20 } },
  { id: 'p3', name: 'P3', desc: 'd', rarity: 'common', element: 'fire', mods: { aspd_pct: 8 } },
];
const skills = [{ id: 's1', name: 'S1', desc: 'd', kind: 'dash', level: 2, cooldown_ms: 1000, power: 10 }];
const bonds = [
  {
    id: 'pair',
    name: '双生',
    star: 3,
    members: ['p1', 'p2'],
    tiers: [{ need: 2, name: '双生体', desc: 'd', mods: { damage_pct: 10 } }],
  },
];
const levels = {
  max_level: 3,
  xp_to_next: [10, 20],
  growth_per_level: { max_hp: 5, damage_pct: 2, aspd_pct: 2, speed_pct: 1 },
  passive_offer_levels: [2, 3],
  refresh_cost: 15,
};

const hero = { id: 'h', name: 'H', max_hp: 100, speed: 100, radius: 10, color: '#fff', attack: { damage: 1, cooldown_ms: 100, bullet_speed: 100, range: 100, bullet_radius: 2 } };
const enemies = [{ id: 'e', name: 'E', hp: 10, speed: 10, damage: 1, radius: 5, color: '#fff', contact_cooldown_ms: 100 }];
const waves = [{ index: 1, direction: 'random', groups: [{ enemy: 'e', count: 1, interval_ms: 100 }], hp_scale: 1, speed_scale: 1 }];

const evolutions = [
  {
    stage: 1,
    cost: 3,
    options: [
      { id: 'e1', name: 'E1', desc: 'd', mods: { damage_pct: 10 } },
      { id: 'e2', name: 'E2', desc: 'd', mods: { max_hp: 20 } },
    ],
  },
];
const items = [
  { id: 'potion', name: '药', desc: 'd', price: 8, kind: 'consumable', heal: 20 },
  { id: 'ring', name: '戒', desc: 'd', price: 10, kind: 'item', tier: 1, mods: { damage_pct: 5 } },
];

const src = (over: Record<string, unknown> = {}) => ({
  hero,
  enemies,
  waves,
  summons,
  passives,
  bonds,
  skills,
  levels,
  evolutions,
  items,
  ...over,
});

describe('配置加载', () => {
  it('能解析出英雄、怪物、召唤物、被动、技能、等级与波次', () => {
    expect(config.hero.max_hp).toBeGreaterThan(0);
    expect(Object.keys(config.enemies).length).toBeGreaterThan(0);
    expect(config.summons).toHaveLength(3);
    expect(config.passives.length).toBeGreaterThanOrEqual(3);
    expect(config.skills.length).toBeGreaterThanOrEqual(1);
    expect(config.levels.max_level).toBeGreaterThanOrEqual(5);
    expect(config.waves.length).toBeGreaterThanOrEqual(3);
  });

  it('三种召唤物分别绑定三种资源', () => {
    expect(config.summons.map((s) => s.resource).sort()).toEqual(['economy', 'essence', 'xp']);
  });

  it('波次里引用的怪物都存在，且序号连续', () => {
    config.waves.forEach((w, i) => {
      expect(w.index).toBe(i + 1);
      for (const g of w.groups) {
        expect(config.enemies[g.enemy], `未定义的怪物 ${g.enemy}`).toBeTruthy();
      }
    });
  });

  it('经验表长度与等级上限匹配，三选一等级在范围内', () => {
    expect(config.levels.xp_to_next).toHaveLength(config.levels.max_level - 1);
    for (const level of config.levels.passive_offer_levels) {
      expect(level).toBeLessThanOrEqual(config.levels.max_level);
    }
  });

  it('20 波难度递增，第 10 / 20 波有 Boss', () => {
    expect(config.waves).toHaveLength(20);
    for (let i = 1; i < config.waves.length; i += 1) {
      expect(config.waves[i]!.hp_scale).toBeGreaterThanOrEqual(config.waves[i - 1]!.hp_scale);
    }
    for (const waveIndex of [9, 19]) {
      const wave = config.waves[waveIndex]!;
      const bossGroup = wave.groups.find((g) => config.enemies[g.enemy]?.boss);
      expect(bossGroup, `第 ${waveIndex + 1} 波应有 Boss`).toBeTruthy();
    }
  });
});

describe('配置校验', () => {
  it('引用不存在的怪物时报出字段路径', () => {
    const bad = { waves: [{ ...waves[0], groups: [{ enemy: 'nope', count: 1, interval_ms: 100 }] }] };
    expect(() => buildConfig(src(bad))).toThrowError(ConfigError);
    expect(() => buildConfig(src(bad))).toThrowError(/groups\[0\]\.enemy/);
  });

  it('波次序号错位时报错', () => {
    expect(() => buildConfig(src({ waves: [{ ...waves[0], index: 3 }] }))).toThrowError(/index/);
  });

  it('hp 为负数时报错', () => {
    expect(() => buildConfig(src({ enemies: [{ ...enemies[0], hp: -5 }] }))).toThrowError(/hp/);
  });

  it('方向非法时报错', () => {
    expect(() => buildConfig(src({ waves: [{ ...waves[0], direction: 'up' }] }))).toThrowError(/direction/);
  });

  it('召唤物必须恰好三种且资源不可重复', () => {
    expect(() => buildConfig(src({ summons: summons.slice(0, 2) }))).toThrowError(/3 种/);
    const dup = [summons[0]!, summons[1]!, { ...summons[2], resource: 'economy' }];
    expect(() => buildConfig(src({ summons: dup }))).toThrowError(/重复绑定/);
  });

  it('被动修正字段写错时报出字段名', () => {
    const bad = [
      passives[0]!,
      passives[1]!,
      { id: 'p', name: 'P', desc: 'd', rarity: 'common', mods: { dmg: 10 } },
    ];
    expect(() => buildConfig(src({ passives: bad }))).toThrowError(/mods\.dmg/);
  });

  it('被动稀有度非法时报错', () => {
    const bad = [passives[0]!, passives[1]!, { id: 'p', name: 'P', desc: 'd', rarity: 'epic', mods: {} }];
    expect(() => buildConfig(src({ passives: bad }))).toThrowError(/rarity/);
  });

  it('经验表长度不匹配时报错', () => {
    const bad = { ...levels, xp_to_next: [10] };
    expect(() => buildConfig(src({ levels: bad }))).toThrowError(/xp_to_next/);
  });

  it('技能等级超过上限时报错', () => {
    const bad = [{ ...skills[0], level: 9 }];
    expect(() => buildConfig(src({ skills: bad }))).toThrowError(/can.*not|不能|level/);
  });

  it('nova 缺半径、barrage 缺弹数时报错', () => {
    expect(() =>
      buildConfig(src({ skills: [{ ...skills[0], kind: 'nova', level: 1 }] })),
    ).toThrowError(/radius/);
    expect(() =>
      buildConfig(src({ skills: [{ ...skills[0], kind: 'barrage', level: 1 }] })),
    ).toThrowError(/count/);
  });

  it('羁绊成员必须存在且不能被两个羁绊共享', () => {
    const missing = [{ ...bonds[0], members: ['p1', 'ghost'] }];
    expect(() => buildConfig(src({ bonds: missing }))).toThrowError(/ghost/);

    const shared = [
      bonds[0],
      { ...bonds[0], id: 'pair2', members: ['p2', 'p3'] },
    ];
    expect(() => buildConfig(src({ bonds: shared }))).toThrowError(/已被其他羁绊占用/);
  });

  it('羁绊最高档必须等于成员数（集满才是完全体）', () => {
    const bad = [{ ...bonds[0], tiers: [{ need: 2, name: 'x', desc: 'd', mods: {} }], members: ['p1', 'p2', 'p3'] }];
    expect(() => buildConfig(src({ bonds: bad }))).toThrowError(/完全体/);
  });
});
