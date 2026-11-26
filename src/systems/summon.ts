import type { SummonDef } from '../core/types';

export type SummonResult = 'ok' | 'cooldown' | 'max_alive' | 'unknown';

/**
 * 召唤冷却与场上数量限制（纯逻辑，不依赖 Phaser）。
 * 代价 = 冷却 + 同类型上限，不消耗资源（见 AGENTS.md 3.2）。
 */
export class SummonSystem {
  private readonly defs = new Map<string, SummonDef>();
  private readonly cooldowns = new Map<string, number>();
  private readonly alive = new Map<string, number>();

  constructor(defs: readonly SummonDef[]) {
    for (const def of defs) {
      this.defs.set(def.id, def);
      this.cooldowns.set(def.id, 0);
      this.alive.set(def.id, 0);
    }
  }

  request(id: string): SummonResult {
    const def = this.defs.get(id);
    if (!def) return 'unknown';
    if ((this.alive.get(id) ?? 0) >= def.max_alive) return 'max_alive';
    if ((this.cooldowns.get(id) ?? 0) > 0) return 'cooldown';

    this.alive.set(id, (this.alive.get(id) ?? 0) + 1);
    this.cooldowns.set(id, def.cooldown_ms);
    return 'ok';
  }

  /** 召唤物死亡/离场时调用，释放一个场上名额。 */
  release(id: string): void {
    const current = this.alive.get(id) ?? 0;
    if (current > 0) this.alive.set(id, current - 1);
  }

  update(dtMs: number): void {
    if (dtMs < 0) throw new Error('SummonSystem.update: dtMs 不能为负');
    for (const [id, remaining] of this.cooldowns) {
      if (remaining > 0) this.cooldowns.set(id, Math.max(0, remaining - dtMs));
    }
  }

  cooldownLeft(id: string): number {
    return this.cooldowns.get(id) ?? 0;
  }

  cooldownRatio(id: string): number {
    const def = this.defs.get(id);
    if (!def) return 0;
    return (this.cooldowns.get(id) ?? 0) / def.cooldown_ms;
  }

  aliveCount(id: string): number {
    return this.alive.get(id) ?? 0;
  }

  maxAlive(id: string): number {
    return this.defs.get(id)?.max_alive ?? 0;
  }
}
