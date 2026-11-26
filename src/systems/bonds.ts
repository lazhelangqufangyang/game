import type { BondDef, BondTierDef, Mods } from '../core/types';
import { addMods, emptyMods } from './passives';

export interface BondActivation {
  bond: BondDef;
  tier: BondTierDef;
}

export interface BondResult {
  absorbed: boolean;
  bond: BondDef | null;
  activation: BondActivation | null;
}

/**
 * 元素/生命羁绊收集器（纯逻辑）。
 *
 * 规则（已与用户确认）：
 * - 未达阈值时，成员正常占被动格；
 * - 凑够某一档 need（如 3/5）→ 该档进化，所有已收集成员**离开格子**，进化体不占格；
 * - 3 档之后新来的成员（第 4、5 个）**仍占格子**，直到集满 5 个触发下一档，一并释放。
 */
export class BondTracker {
  private readonly members = new Map<string, Set<string>>();
  private readonly memberToBond = new Map<string, BondDef>();

  constructor(private readonly bonds: readonly BondDef[]) {
    for (const bond of bonds) {
      this.members.set(bond.id, new Set());
      for (const id of bond.members) this.memberToBond.set(id, bond);
    }
  }

  bondOf(passiveId: string): BondDef | null {
    return this.memberToBond.get(passiveId) ?? null;
  }

  count(bondId: string): number {
    return this.members.get(bondId)?.size ?? 0;
  }

  collected(bondId: string): string[] {
    return [...(this.members.get(bondId) ?? [])];
  }

  collectedIds(): string[] {
    return [...this.members.values()].flatMap((set) => [...set]);
  }

  /** 当前生效的最高档；没有则 null。 */
  activeTier(bond: BondDef): BondTierDef | null {
    const total = this.count(bond.id);
    let active: BondTierDef | null = null;
    for (const tier of bond.tiers) {
      if (total >= tier.need) active = tier;
    }
    return active;
  }

  /** 再拿一个这个被动，会不会直接触发进化（从而不进格子）。 */
  willAbsorb(passiveId: string): boolean {
    const bond = this.memberToBond.get(passiveId);
    if (!bond) return false;
    const before = this.activeTier(bond);
    const after = tierForCount(bond, this.count(bond.id) + 1);
    return after !== null && after !== before;
  }

  add(passiveId: string): BondResult {
    const bond = this.memberToBond.get(passiveId);
    if (!bond) return { absorbed: false, bond: null, activation: null };

    const set = this.members.get(bond.id)!;
    const before = this.activeTier(bond);
    set.add(passiveId);
    const after = this.activeTier(bond);

    if (after && after !== before) {
      return { absorbed: true, bond, activation: { bond, tier: after } };
    }
    return { absorbed: false, bond, activation: null };
  }

  /** 读档/跨波次恢复：只记录已收集成员，不触发吸收逻辑（档位按数量重算）。 */
  restore(passiveIds: readonly string[]): void {
    for (const id of passiveIds) {
      const bond = this.memberToBond.get(id);
      if (!bond) continue;
      this.members.get(bond.id)!.add(id);
    }
  }

  /** 所有已激活档位的修正值（取最高档，不叠加低档）。 */
  mods(): Mods {
    const mods = emptyMods();
    for (const bond of this.bonds) {
      const tier = this.activeTier(bond);
      if (tier) addMods(mods, tier.mods);
    }
    return mods;
  }
}

function tierForCount(bond: BondDef, count: number): BondTierDef | null {
  let active: BondTierDef | null = null;
  for (const tier of bond.tiers) {
    if (count >= tier.need) active = tier;
  }
  return active;
}
