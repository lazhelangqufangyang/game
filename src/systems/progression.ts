import type {
  GrowthDef,
  HeroDef,
  LevelsDef,
  Mods,
  PassiveDef,
  RunStats,
} from '../core/types';

/** 经验与等级：纯逻辑，不依赖 Phaser。 */
export class XpTracker {
  level: number;
  xp: number;

  constructor(
    private readonly levels: LevelsDef,
    level = 1,
    xp = 0,
  ) {
    this.level = Math.min(Math.max(1, level), levels.max_level);
    this.xp = Math.max(0, xp);
  }

  get maxLevel(): number {
    return this.levels.max_level;
  }

  get isMax(): boolean {
    return this.level >= this.levels.max_level;
  }

  /** 升到下一级所需经验；满级返回 null。 */
  get needed(): number | null {
    if (this.isMax) return null;
    return this.levels.xp_to_next[this.level - 1] ?? null;
  }

  /** 当前等级内的进度 0..1（满级恒为 1）。 */
  get progress(): number {
    const need = this.needed;
    if (need === null) return 1;
    return Math.min(1, this.xp / need);
  }

  /** 加经验，返回本次升了几级。 */
  add(amount: number): number {
    if (!Number.isFinite(amount) || amount < 0) {
      throw new Error(`XpTracker.add: 非法经验值 ${amount}`);
    }
    if (this.isMax) {
      this.xp = 0;
      return 0;
    }

    let gained = 0;
    this.xp += amount;
    let need = this.needed;
    while (need !== null && this.xp >= need && !this.isMax) {
      this.xp -= need;
      this.level += 1;
      gained += 1;
      need = this.needed;
    }
    if (this.isMax) this.xp = 0;
    return gained;
  }
}

export function computeStats(
  hero: HeroDef,
  mods: Mods,
  level: number,
  growth: GrowthDef,
): RunStats {
  const lv = Math.max(0, level - 1);
  const dmgPct = growth.damage_pct * lv + mods.damage_pct;
  const aspdPct = growth.aspd_pct * lv + mods.aspd_pct;
  const spdPct = growth.speed_pct * lv + mods.speed_pct;

  return {
    max_hp: Math.round(hero.max_hp + growth.max_hp * lv + mods.max_hp),
    damage: round2(hero.attack.damage * (1 + dmgPct / 100)),
    cooldown_ms: Math.max(80, hero.attack.cooldown_ms / (1 + aspdPct / 100)),
    speed: hero.speed * (1 + spdPct / 100),
    range: hero.attack.range * (1 + mods.range_pct / 100),
    bullet_speed: hero.attack.bullet_speed,
    bullet_radius: hero.attack.bullet_radius,
    multishot: Math.max(1, Math.round(1 + mods.multishot)),
    crit_chance: Math.min(1, mods.crit_chance / 100),
    crit_mult: 1 + mods.crit_mult / 100,
    lifesteal: Math.max(0, Math.min(1, mods.lifesteal_pct / 100)),
  };
}

/** 从被动池里抽 count 个不重复候选；已拥有的优先级最低（池子不够时才重复出现）。 */
export function rollPassives(
  pool: readonly PassiveDef[],
  ownedIds: readonly string[],
  count: number,
  rng: () => number,
): PassiveDef[] {
  const owned = new Set(ownedIds);
  const fresh = pool.filter((p) => !owned.has(p.id));
  const poolA = shuffle(fresh, rng);
  const poolB = shuffle(pool.filter((p) => owned.has(p.id)), rng);

  const picked: PassiveDef[] = [];
  for (const p of [...poolA, ...poolB]) {
    if (picked.length >= count) break;
    if (picked.some((x) => x.id === p.id)) continue;
    picked.push(p);
  }
  return picked;
}

function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
  return arr;
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
