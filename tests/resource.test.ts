import { describe, expect, it } from 'vitest';
import { grantResource, resourceTotal } from '../src/core/resources';
import type { RunState } from '../src/core/types';

const run = (): RunState => ({
  hp: 100,
  max_hp: 100,
  wave_index: 0,
  kills: 0,
  seed: 1,
  economy: 0,
  xp: 0,
  essence: 0,
  level: 1,
  level_xp: 0,
  passives: [],
  bond_members: [],
  evolutions: [],
  equipment: [],
  items: [],
  shop_offers: [],
});

describe('资源结算', () => {
  it('三种资源互不串味', () => {
    const r = run();
    grantResource(r, 'economy', 3);
    grantResource(r, 'xp', 10);
    grantResource(r, 'essence', 1);

    expect(r.economy).toBe(3);
    expect(r.xp).toBe(10);
    expect(r.essence).toBe(1);
    expect(resourceTotal(r)).toBe(14);
  });

  it('累加而不是覆盖', () => {
    const r = run();
    grantResource(r, 'economy', 3);
    grantResource(r, 'economy', 4);
    expect(r.economy).toBe(7);
  });

  it('拒绝负数与非法数量', () => {
    const r = run();
    expect(() => grantResource(r, 'xp', -1)).toThrow();
    expect(() => grantResource(r, 'xp', Number.NaN)).toThrow();
    expect(r.xp).toBe(0);
  });
});
