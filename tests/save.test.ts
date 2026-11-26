import { describe, expect, it } from 'vitest';
import { SAVE_VERSION, parseRun, serializeRun } from '../src/core/save';
import { createRun } from '../src/core/run';
import type { HeroDef, RunState } from '../src/core/types';

const hero: HeroDef = {
  id: 'h',
  name: 'H',
  max_hp: 100,
  speed: 260,
  radius: 16,
  color: '#fff',
  attack: { damage: 12, cooldown_ms: 320, bullet_speed: 760, range: 560, bullet_radius: 5 },
};

const sample = (): RunState => ({
  ...createRun(hero),
  wave_index: 3,
  kills: 12,
  economy: 18,
  essence: 4,
  level: 5,
  level_xp: 7,
  hp: 64,
  max_hp: 132,
  passives: ['edge', 'haste'],
  bond_members: ['ember'],
  evolutions: ['flame'],
  equipment: ['boots'],
  shop_offers: ['potion'],
});

describe('存档', () => {
  it('序列化后能原样读回', () => {
    const run = sample();
    const loaded = parseRun(serializeRun(run));
    expect(loaded).toEqual(run);
  });

  it('损坏的 JSON 返回 null，不抛错', () => {
    expect(parseRun('{not json')).toBeNull();
    expect(parseRun('')).toBeNull();
    expect(parseRun(null)).toBeNull();
  });

  it('版本不匹配返回 null', () => {
    const raw = JSON.stringify({ version: SAVE_VERSION + 1, run: sample() });
    expect(parseRun(raw)).toBeNull();
  });

  it('缺字段或类型不对返回 null', () => {
    const broken = { version: SAVE_VERSION, run: { ...sample(), economy: 'lots' } };
    expect(parseRun(JSON.stringify(broken))).toBeNull();

    const missing = { version: SAVE_VERSION, run: { hp: 10 } };
    expect(parseRun(JSON.stringify(missing))).toBeNull();
  });

  it('生命不会超过上限', () => {
    const run = { ...sample(), hp: 999, max_hp: 120 };
    expect(parseRun(serializeRun(run))?.hp).toBe(120);
  });
});
