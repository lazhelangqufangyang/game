import type { Mods, PassiveDef } from '../core/types';

export const MAX_SLOTS = 8;

export function emptyMods(): Mods {
  return {
    damage_pct: 0,
    aspd_pct: 0,
    speed_pct: 0,
    range_pct: 0,
    max_hp: 0,
    multishot: 0,
    crit_chance: 0,
    crit_mult: 0,
    lifesteal_pct: 0,
  };
}

export function addMods(target: Mods, source: Partial<Mods>): void {
  for (const key of Object.keys(target) as Array<keyof Mods>) {
    target[key] += source[key] ?? 0;
  }
}

export function aggregate(owned: readonly PassiveDef[]): Mods {
  const mods = emptyMods();
  for (const passive of owned) addMods(mods, passive.mods);
  return mods;
}

export function sumMods(...parts: ReadonlyArray<Partial<Mods>>): Mods {
  const mods = emptyMods();
  for (const part of parts) addMods(mods, part);
  return mods;
}

/**
 * 8 格被动书。
 * 满格时只能通过 replace 换入（对应 UI 的「放弃一个」），绝不超格。
 */
export class PassiveBook {
  private readonly slots: Array<PassiveDef | null>;

  constructor(size = MAX_SLOTS) {
    this.slots = new Array<PassiveDef | null>(size).fill(null);
  }

  get size(): number {
    return this.slots.length;
  }

  get list(): ReadonlyArray<PassiveDef | null> {
    return this.slots;
  }

  get count(): number {
    return this.slots.filter((p) => p !== null).length;
  }

  get isFull(): boolean {
    return this.count >= this.slots.length;
  }

  has(id: string): boolean {
    return this.slots.some((p) => p?.id === id);
  }

  /** 有空位时放入，返回是否成功。满格时返回 false（必须走 replace）。 */
  add(passive: PassiveDef): boolean {
    if (this.isFull) return false;
    const index = this.slots.indexOf(null);
    if (index < 0) return false;
    this.slots[index] = passive;
    return true;
  }

  /** 放弃 index 处的被动，换成新的；返回被放弃的那个（越界或空位返回 null）。 */
  replace(index: number, passive: PassiveDef): PassiveDef | null {
    if (index < 0 || index >= this.slots.length) return null;
    const removed = this.slots[index] ?? null;
    if (!removed) return null;
    this.slots[index] = passive;
    return removed;
  }

  remove(index: number): PassiveDef | null {
    if (index < 0 || index >= this.slots.length) return null;
    const removed = this.slots[index] ?? null;
    this.slots[index] = null;
    return removed;
  }

  /** 羁绊进化时把成员从格子里释放出来。 */
  removeById(id: string): PassiveDef | null {
    const index = this.slots.findIndex((p) => p?.id === id);
    if (index < 0) return null;
    return this.remove(index);
  }

  owned(): PassiveDef[] {
    return this.slots.filter((p): p is PassiveDef => p !== null);
  }

  mods(): Mods {
    return aggregate(this.owned());
  }

  ids(): string[] {
    return this.owned().map((p) => p.id);
  }
}
