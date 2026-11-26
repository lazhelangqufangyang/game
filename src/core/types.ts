export type Direction = 'north' | 'east' | 'south' | 'west';

export type ResourceKind = 'economy' | 'xp' | 'essence';

export type Element = 'fire' | 'thunder' | 'water' | 'ice' | 'wind';

export type SkillKind = 'dash' | 'nova' | 'barrage';

export type Rarity = 'common' | 'rare';

export interface AttackDef {
  damage: number;
  cooldown_ms: number;
  bullet_speed: number;
  range: number;
  bullet_radius: number;
}

export interface HeroDef {
  id: string;
  name: string;
  max_hp: number;
  speed: number;
  radius: number;
  color: string;
  attack: AttackDef;
}

export interface EnemyDef {
  id: string;
  name: string;
  hp: number;
  speed: number;
  damage: number;
  radius: number;
  color: string;
  contact_cooldown_ms: number;
  boss?: boolean;
}

export interface SummonDef {
  id: string;
  name: string;
  resource: ResourceKind;
  reward: number;
  hp: number;
  speed: number;
  damage: number;
  radius: number;
  color: string;
  cooldown_ms: number;
  max_alive: number;
  spawn_distance: number;
}

export interface WaveGroup {
  enemy: string;
  count: number;
  interval_ms: number;
}

export interface WaveDef {
  index: number;
  direction: Direction | 'random';
  groups: WaveGroup[];
  hp_scale: number;
  speed_scale: number;
}

/** 被动提供的修正值，全部为「加法百分比」或「绝对值」。 */
export interface Mods {
  damage_pct: number;
  aspd_pct: number;
  speed_pct: number;
  range_pct: number;
  max_hp: number;
  multishot: number;
  crit_chance: number;
  crit_mult: number;
  lifesteal_pct: number;
}

export interface PassiveDef {
  id: string;
  name: string;
  desc: string;
  rarity: Rarity;
  element?: Element;
  mods: Partial<Mods>;
}

export interface SkillDef {
  id: string;
  name: string;
  desc: string;
  kind: SkillKind;
  level: number;
  cooldown_ms: number;
  power: number;
  radius?: number;
  count?: number;
}

export interface GrowthDef {
  max_hp: number;
  damage_pct: number;
  aspd_pct: number;
  speed_pct: number;
}

export interface LevelsDef {
  max_level: number;
  xp_to_next: number[];
  growth_per_level: GrowthDef;
  passive_offer_levels: number[];
  refresh_cost: number;
}

export interface EvolutionOption {
  id: string;
  name: string;
  desc: string;
  mods: Partial<Mods>;
  heal_on_kill?: number;
  skill_cd_pct?: number;
}

export interface EvolutionStage {
  stage: number;
  cost: number;
  options: EvolutionOption[];
}

export interface ItemActive {
  kind: 'dash' | 'shield';
  cooldown_ms: number;
  power: number;
  duration_ms?: number;
}

export interface ItemDef {
  id: string;
  name: string;
  desc: string;
  price: number;
  kind: 'consumable' | 'item';
  /** 1 = 小件，2 = 中件，3 = 大件。 */
  tier?: 1 | 2 | 3;
  mods?: Partial<Mods>;
  heal?: number;
  /** 合成配方：组件必须是更低一阶（允许两个中件合成大件），组件会被消耗。 */
  recipe?: string[];
  active?: ItemActive;
}

export interface GameConfig {
  hero: HeroDef;
  enemies: Record<string, EnemyDef>;
  summons: SummonDef[];
  waves: WaveDef[];
  passives: PassiveDef[];
  bonds: BondDef[];
  skills: SkillDef[];
  levels: LevelsDef;
  evolutions: EvolutionStage[];
  items: ItemDef[];
}

/** 羁绊的一档：凑够 need 个成员后进化为 name，提供 mods。 */
export interface BondTierDef {
  need: number;
  name: string;
  desc: string;
  mods: Partial<Mods>;
}

export interface BondDef {
  id: string;
  name: string;
  star: number;
  members: string[];
  tiers: BondTierDef[];
}

/** 由基础属性 + 等级成长 + 被动聚合出来的运行时属性。 */
export interface RunStats {
  max_hp: number;
  damage: number;
  cooldown_ms: number;
  speed: number;
  range: number;
  bullet_speed: number;
  bullet_radius: number;
  multishot: number;
  crit_chance: number;
  crit_mult: number;
  lifesteal: number;
}

export interface RunState {
  hp: number;
  max_hp: number;
  wave_index: number;
  kills: number;
  seed: number;
  economy: number;
  xp: number;
  essence: number;
  level: number;
  level_xp: number;
  passives: string[];
  bond_members: string[];
  evolutions: string[];
  items: string[];
  shop_offers: string[];
}
