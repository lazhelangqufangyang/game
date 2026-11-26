import type { HeroDef, RunState } from './types';

/** 新开一局的初始状态；字段必须与 RunState 完全一致。 */
export function createRun(hero: HeroDef): RunState {
  return {
    hp: hero.max_hp,
    max_hp: hero.max_hp,
    wave_index: 0,
    kills: 0,
    seed: (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0,
    economy: 0,
    xp: 0,
    essence: 0,
    level: 1,
    level_xp: 0,
    passives: [],
    bond_members: [],
    evolutions: [],
    items: [],
    shop_offers: [],
  };
}
