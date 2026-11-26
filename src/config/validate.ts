import type {
  AttackDef,
  BondDef,
  Direction,
  Element,
  EnemyDef,
  EvolutionStage,
  GameConfig,
  HeroDef,
  ItemDef,
  LevelsDef,
  Mods,
  PassiveDef,
  Rarity,
  ResourceKind,
  SkillDef,
  SkillKind,
  SummonDef,
  WaveDef,
} from '../core/types';
import { emptyMods } from '../systems/passives';

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

const DIRECTIONS: readonly string[] = ['north', 'east', 'south', 'west'];
const RESOURCES: readonly string[] = ['economy', 'xp', 'essence'];
const RARITIES: readonly string[] = ['common', 'rare'];
const ELEMENTS: readonly string[] = ['fire', 'thunder', 'water', 'ice', 'wind'];
const SKILL_KINDS: readonly string[] = ['dash', 'nova', 'barrage'];

function fail(path: string, msg: string): never {
  throw new ConfigError(`配置错误 → ${path}: ${msg}`);
}

function asObject(v: unknown, path: string): Record<string, unknown> {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) fail(path, '应为对象');
  return v as Record<string, unknown>;
}

function asArray(v: unknown, path: string): unknown[] {
  if (!Array.isArray(v)) fail(path, '应为数组');
  return v;
}

function num(v: unknown, path: string, opts: { min?: number; integer?: boolean } = {}): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) fail(path, '应为有限数字');
  if (opts.integer && !Number.isInteger(v)) fail(path, '应为整数');
  if (opts.min !== undefined && v < opts.min) fail(path, `不能小于 ${opts.min}`);
  return v;
}

function str(v: unknown, path: string): string {
  if (typeof v !== 'string' || v.length === 0) fail(path, '应为非空字符串');
  return v;
}

function parseAttack(raw: unknown, path: string): AttackDef {
  const o = asObject(raw, path);
  return {
    damage: num(o.damage, `${path}.damage`, { min: 0 }),
    cooldown_ms: num(o.cooldown_ms, `${path}.cooldown_ms`, { min: 1 }),
    bullet_speed: num(o.bullet_speed, `${path}.bullet_speed`, { min: 1 }),
    range: num(o.range, `${path}.range`, { min: 1 }),
    bullet_radius: num(o.bullet_radius, `${path}.bullet_radius`, { min: 1 }),
  };
}

export function parseHero(raw: unknown): HeroDef {
  const o = asObject(raw, 'heroes');
  return {
    id: str(o.id, 'heroes.id'),
    name: str(o.name, 'heroes.name'),
    max_hp: num(o.max_hp, 'heroes.max_hp', { min: 1 }),
    speed: num(o.speed, 'heroes.speed', { min: 0 }),
    radius: num(o.radius, 'heroes.radius', { min: 1 }),
    color: str(o.color, 'heroes.color'),
    attack: parseAttack(o.attack, 'heroes.attack'),
  };
}

export function parseEnemies(raw: unknown): Record<string, EnemyDef> {
  const list = asArray(raw, 'enemies');
  const out: Record<string, EnemyDef> = {};
  list.forEach((item, i) => {
    const path = `enemies[${i}]`;
    const o = asObject(item, path);
    const id = str(o.id, `${path}.id`);
    if (out[id]) fail(`${path}.id`, `重复的怪物 id "${id}"`);
    out[id] = {
      id,
      name: str(o.name, `${path}.name`),
      hp: num(o.hp, `${path}.hp`, { min: 1 }),
      speed: num(o.speed, `${path}.speed`, { min: 1 }),
      damage: num(o.damage, `${path}.damage`, { min: 0 }),
      radius: num(o.radius, `${path}.radius`, { min: 1 }),
      color: str(o.color, `${path}.color`),
      contact_cooldown_ms: num(o.contact_cooldown_ms, `${path}.contact_cooldown_ms`, { min: 1 }),
      boss: o.boss === undefined ? undefined : o.boss === true,
    };
  });
  if (Object.keys(out).length === 0) fail('enemies', '至少需要一个怪物');
  return out;
}

export function parseWaves(raw: unknown, enemies: Record<string, EnemyDef>): WaveDef[] {
  const list = asArray(raw, 'waves');
  if (list.length === 0) fail('waves', '至少需要一波');
  return list.map((item, i) => {
    const path = `waves[${i}]`;
    const o = asObject(item, path);
    const direction = str(o.direction, `${path}.direction`);
    if (direction !== 'random' && !DIRECTIONS.includes(direction)) {
      fail(`${path}.direction`, `应为 random / north / east / south / west，实际为 "${direction}"`);
    }
    const groups = asArray(o.groups, `${path}.groups`).map((g, gi) => {
      const gp = `${path}.groups[${gi}]`;
      const go = asObject(g, gp);
      const enemy = str(go.enemy, `${gp}.enemy`);
      if (!enemies[enemy]) fail(`${gp}.enemy`, `未在 enemies.json 中找到 "${enemy}"`);
      return {
        enemy,
        count: num(go.count, `${gp}.count`, { min: 1, integer: true }),
        interval_ms: num(go.interval_ms, `${gp}.interval_ms`, { min: 1 }),
      };
    });
    if (groups.length === 0) fail(`${path}.groups`, '至少需要一条刷怪流');
    return {
      index: num(o.index, `${path}.index`, { min: 1, integer: true }),
      direction: direction as Direction | 'random',
      groups,
      hp_scale: num(o.hp_scale ?? 1, `${path}.hp_scale`, { min: 0.1 }),
      speed_scale: num(o.speed_scale ?? 1, `${path}.speed_scale`, { min: 0.1 }),
    };
  });
}

export function parseSummons(raw: unknown): SummonDef[] {
  const list = asArray(raw, 'summons');
  if (list.length !== 3) fail('summons', `必须恰好配置 3 种召唤物，实际 ${list.length} 种`);

  const seen = new Set<string>();
  const resources = new Set<string>();
  return list.map((item, i) => {
    const path = `summons[${i}]`;
    const o = asObject(item, path);
    const id = str(o.id, `${path}.id`);
    if (seen.has(id)) fail(`${path}.id`, `重复的召唤物 id "${id}"`);
    seen.add(id);

    const resource = str(o.resource, `${path}.resource`);
    if (!RESOURCES.includes(resource)) {
      fail(`${path}.resource`, `应为 economy / xp / essence，实际为 "${resource}"`);
    }
    if (resources.has(resource)) fail(`${path}.resource`, `资源 "${resource}" 被重复绑定`);
    resources.add(resource);

    return {
      id,
      name: str(o.name, `${path}.name`),
      resource: resource as ResourceKind,
      reward: num(o.reward, `${path}.reward`, { min: 1 }),
      hp: num(o.hp, `${path}.hp`, { min: 1 }),
      speed: num(o.speed, `${path}.speed`, { min: 1 }),
      damage: num(o.damage, `${path}.damage`, { min: 0 }),
      radius: num(o.radius, `${path}.radius`, { min: 1 }),
      color: str(o.color, `${path}.color`),
      cooldown_ms: num(o.cooldown_ms, `${path}.cooldown_ms`, { min: 1 }),
      max_alive: num(o.max_alive, `${path}.max_alive`, { min: 1, integer: true }),
      spawn_distance: num(o.spawn_distance, `${path}.spawn_distance`, { min: 0 }),
    };
  });
}

export function parseMods(raw: unknown, path: string): Partial<Mods> {
  const modsRaw = asObject(raw ?? {}, path);
  const mods: Partial<Mods> = {};
  const keys = Object.keys(emptyMods()) as Array<keyof Mods>;
  for (const [key, value] of Object.entries(modsRaw)) {
    if (!keys.includes(key as keyof Mods)) {
      fail(`${path}.${key}`, `未知的修正字段，可用字段：${keys.join(' / ')}`);
    }
    mods[key as keyof Mods] = num(value, `${path}.${key}`);
  }
  return mods;
}

export function parsePassives(raw: unknown): PassiveDef[] {
  const list = asArray(raw, 'passives');
  if (list.length < 3) fail('passives', '至少需要 3 个被动才能三选一');

  const seen = new Set<string>();
  return list.map((item, i) => {
    const path = `passives[${i}]`;
    const o = asObject(item, path);
    const id = str(o.id, `${path}.id`);
    if (seen.has(id)) fail(`${path}.id`, `重复的被动 id "${id}"`);
    seen.add(id);

    const rarity = str(o.rarity, `${path}.rarity`);
    if (!RARITIES.includes(rarity)) fail(`${path}.rarity`, `应为 common / rare，实际为 "${rarity}"`);

    const element = o.element === undefined ? undefined : str(o.element, `${path}.element`);
    if (element !== undefined && !ELEMENTS.includes(element)) {
      fail(`${path}.element`, `应为 fire / thunder / water / ice / wind，实际为 "${element}"`);
    }

    const mods = parseMods(o.mods, `${path}.mods`);

    return {
      id,
      name: str(o.name, `${path}.name`),
      desc: str(o.desc, `${path}.desc`),
      rarity: rarity as Rarity,
      element: element as Element | undefined,
      mods,
    };
  });
}

export function parseSkills(raw: unknown): SkillDef[] {
  const list = asArray(raw, 'skills');
  const seen = new Set<string>();
  return list.map((item, i) => {
    const path = `skills[${i}]`;
    const o = asObject(item, path);
    const id = str(o.id, `${path}.id`);
    if (seen.has(id)) fail(`${path}.id`, `重复的技能 id "${id}"`);
    seen.add(id);

    const kind = str(o.kind, `${path}.kind`);
    if (!SKILL_KINDS.includes(kind)) {
      fail(`${path}.kind`, `应为 dash / nova / barrage，实际为 "${kind}"`);
    }
    if (kind === 'nova' && o.radius === undefined) fail(`${path}.radius`, 'nova 技能必须配置半径');
    if (kind === 'barrage' && o.count === undefined) fail(`${path}.count`, 'barrage 技能必须配置弹数');

    return {
      id,
      name: str(o.name, `${path}.name`),
      desc: str(o.desc, `${path}.desc`),
      kind: kind as SkillKind,
      level: num(o.level, `${path}.level`, { min: 1, integer: true }),
      cooldown_ms: num(o.cooldown_ms, `${path}.cooldown_ms`, { min: 1 }),
      power: num(o.power, `${path}.power`, { min: 0.01 }),
      radius: o.radius === undefined ? undefined : num(o.radius, `${path}.radius`, { min: 1 }),
      count: o.count === undefined ? undefined : num(o.count, `${path}.count`, { min: 1, integer: true }),
    };
  });
}

export function parseLevels(raw: unknown, skills: readonly SkillDef[]): LevelsDef {
  const o = asObject(raw, 'levels');
  const maxLevel = num(o.max_level, 'levels.max_level', { min: 2, integer: true });
  const xpList = asArray(o.xp_to_next, 'levels.xp_to_next');
  if (xpList.length !== maxLevel - 1) {
    fail('levels.xp_to_next', `长度应为 max_level - 1 = ${maxLevel - 1}，实际 ${xpList.length}`);
  }
  const xpToNext = xpList.map((v, i) => num(v, `levels.xp_to_next[${i}]`, { min: 1 }));

  const growthRaw = asObject(o.growth_per_level, 'levels.growth_per_level');
  const growth = {
    max_hp: num(growthRaw.max_hp ?? 0, 'levels.growth_per_level.max_hp'),
    damage_pct: num(growthRaw.damage_pct ?? 0, 'levels.growth_per_level.damage_pct'),
    aspd_pct: num(growthRaw.aspd_pct ?? 0, 'levels.growth_per_level.aspd_pct'),
    speed_pct: num(growthRaw.speed_pct ?? 0, 'levels.growth_per_level.speed_pct'),
  };

  const offerList = asArray(o.passive_offer_levels, 'levels.passive_offer_levels');
  const offerLevels = offerList.map((v, i) => {
    const level = num(v, `levels.passive_offer_levels[${i}]`, { min: 2, integer: true });
    if (level > maxLevel) {
      fail(`levels.passive_offer_levels[${i}]`, `不能超过 max_level ${maxLevel}`);
    }
    return level;
  });
  for (const skill of skills) {
    if (skill.level > maxLevel) {
      fail(`skills.${skill.id}.level`, `不能超过 max_level ${maxLevel}`);
    }
  }

  return {
    max_level: maxLevel,
    xp_to_next: xpToNext,
    growth_per_level: growth,
    passive_offer_levels: [...new Set(offerLevels)].sort((a, b) => a - b),
    refresh_cost: num(o.refresh_cost ?? 0, 'levels.refresh_cost', { min: 0 }),
  };
}

export function parseBonds(raw: unknown, passives: readonly PassiveDef[]): BondDef[] {
  const list = asArray(raw, 'bonds');
  const known = new Set(passives.map((p) => p.id));
  const used = new Set<string>();
  const seen = new Set<string>();

  return list.map((item, i) => {
    const path = `bonds[${i}]`;
    const o = asObject(item, path);
    const id = str(o.id, `${path}.id`);
    if (seen.has(id)) fail(`${path}.id`, `重复的羁绊 id "${id}"`);
    seen.add(id);

    const star = num(o.star, `${path}.star`, { min: 1, integer: true });
    const memberIds = asArray(o.members, `${path}.members`).map((m, mi) => {
      const member = str(m, `${path}.members[${mi}]`);
      if (!known.has(member)) fail(`${path}.members[${mi}]`, `未在 passives.json 中找到 "${member}"`);
      if (used.has(member)) fail(`${path}.members[${mi}]`, `被动 "${member}" 已被其他羁绊占用`);
      used.add(member);
      return member;
    });
    if (memberIds.length < 2) fail(`${path}.members`, '羁绊至少需要 2 个成员');

    const tiers = asArray(o.tiers, `${path}.tiers`).map((t, ti) => {
      const tp = `${path}.tiers[${ti}]`;
      const to = asObject(t, tp);
      const need = num(to.need, `${tp}.need`, { min: 2, integer: true });
      if (need > memberIds.length) {
        fail(`${tp}.need`, `不能超过成员数量 ${memberIds.length}`);
      }
      return {
        need,
        name: str(to.name, `${tp}.name`),
        desc: str(to.desc, `${tp}.desc`),
        mods: parseMods(to.mods, `${tp}.mods`),
      };
    });
    if (tiers.length === 0) fail(`${path}.tiers`, '至少要有一档进化');
    for (let ti = 1; ti < tiers.length; ti += 1) {
      if (tiers[ti]!.need <= tiers[ti - 1]!.need) {
        fail(`${path}.tiers[${ti}].need`, '阈值必须严格递增');
      }
    }
    if (tiers[tiers.length - 1]!.need !== memberIds.length) {
      fail(`${path}.tiers`, '最高一档的 need 必须等于成员数量（集满才是完全体）');
    }

    return { id, name: str(o.name, `${path}.name`), star, members: memberIds, tiers };
  });
}

export function parseEvolutions(raw: unknown): EvolutionStage[] {
  const list = asArray(raw, 'evolutions');
  if (list.length === 0) fail('evolutions', '至少需要 1 个进化阶段');
  return list.map((item, i) => {
    const path = `evolutions[${i}]`;
    const o = asObject(item, path);
    const stage = num(o.stage, `${path}.stage`, { min: 1, integer: true });
    if (stage !== i + 1) fail(`${path}.stage`, `阶段序号应为 ${i + 1}，实际为 ${stage}`);

    const options = asArray(o.options, `${path}.options`).map((opt, oi) => {
      const op = `${path}.options[${oi}]`;
      const oo = asObject(opt, op);
      return {
        id: str(oo.id, `${op}.id`),
        name: str(oo.name, `${op}.name`),
        desc: str(oo.desc, `${op}.desc`),
        mods: parseMods(oo.mods, `${op}.mods`),
        heal_on_kill:
          oo.heal_on_kill === undefined ? undefined : num(oo.heal_on_kill, `${op}.heal_on_kill`, { min: 0 }),
        skill_cd_pct:
          oo.skill_cd_pct === undefined ? undefined : num(oo.skill_cd_pct, `${op}.skill_cd_pct`, { min: 0, }),
      };
    });
    if (options.length < 2) fail(`${path}.options`, '每阶段至少 2 个进化方向');

    return { stage, cost: num(o.cost, `${path}.cost`, { min: 1 }), options };
  });
}

export function parseItems(raw: unknown): ItemDef[] {
  const list = asArray(raw, 'items');
  const seen = new Set<string>();
  const parsed: ItemDef[] = list.map((item, i) => {
    const path = `items[${i}]`;
    const o = asObject(item, path);
    const id = str(o.id, `${path}.id`);
    if (seen.has(id)) fail(`${path}.id`, `重复的物品 id "${id}"`);
    seen.add(id);

    const kind = str(o.kind, `${path}.kind`);
    if (kind !== 'consumable' && kind !== 'item') {
      fail(`${path}.kind`, `应为 consumable / item，实际为 "${kind}"`);
    }
    if (kind === 'consumable' && o.heal === undefined) {
      fail(`${path}.heal`, '消耗品必须配置效果（heal）');
    }

    let tier: ItemDef['tier'];
    if (kind === 'item') {
      tier = num(o.tier, `${path}.tier`, { min: 1, integer: true }) as 1 | 2 | 3;
      if (tier < 1 || tier > 3) fail(`${path}.tier`, '只能为 1 / 2 / 3（小件 / 中件 / 大件）');
    }

    let recipe: string[] | undefined;
    if (o.recipe !== undefined) {
      if (kind !== 'item') fail(`${path}.recipe`, '只有装备可以有合成配方');
      recipe = asArray(o.recipe, `${path}.recipe`).map((r, ri) =>
        str(r, `${path}.recipe[${ri}]`),
      );
      if (recipe.length < 2) fail(`${path}.recipe`, '配方至少需要 2 个组件');
    }
    if (kind === 'item' && tier === 1 && recipe) {
      fail(`${path}.recipe`, '小件（tier 1）不能有配方');
    }
    if (kind === 'item' && tier && tier > 1 && !recipe) {
      fail(`${path}.recipe`, `${tier === 2 ? '中件' : '大件'}必须配置合成配方`);
    }

    let active: ItemDef['active'];
    if (o.active !== undefined) {
      const ap = `${path}.active`;
      const ao = asObject(o.active, ap);
      const activeKind = str(ao.kind, `${ap}.kind`);
      if (activeKind !== 'dash' && activeKind !== 'shield') {
        fail(`${ap}.kind`, `应为 dash / shield，实际为 "${activeKind}"`);
      }
      active = {
        kind: activeKind,
        cooldown_ms: num(ao.cooldown_ms, `${ap}.cooldown_ms`, { min: 1 }),
        power: num(ao.power, `${ap}.power`, { min: 1 }),
        duration_ms:
          ao.duration_ms === undefined ? undefined : num(ao.duration_ms, `${ap}.duration_ms`, { min: 1 }),
      };
      if (kind !== 'item') fail(ap, '只有装备可以有主动效果');
    }

    return {
      id,
      name: str(o.name, `${path}.name`),
      desc: str(o.desc, `${path}.desc`),
      price: num(o.price, `${path}.price`, { min: 0 }),
      kind: kind as ItemDef['kind'],
      tier,
      mods: o.mods === undefined ? undefined : parseMods(o.mods, `${path}.mods`),
      heal: o.heal === undefined ? undefined : num(o.heal, `${path}.heal`, { min: 1 }),
      recipe,
      active,
    };
  });

  // 配方必须引用已存在的物品，且组件层级严格低于成品（小→中→大；允许两个中件合大件）
  const byId = new Map(parsed.map((item) => [item.id, item]));
  parsed.forEach((item) => {
    if (!item.recipe) return;
    for (const componentId of item.recipe) {
      const component = byId.get(componentId);
      if (!component) {
        fail(`items.${item.id}.recipe`, `未找到组件 "${componentId}"`);
      }
      if (component.kind !== 'item') {
        fail(`items.${item.id}.recipe`, `组件 "${componentId}" 不是装备`);
      }
      if ((component.tier ?? 0) >= (item.tier ?? 0)) {
        fail(
          `items.${item.id}.recipe`,
          `组件 "${componentId}"（tier ${component.tier}）必须低于成品（tier ${item.tier}）`,
        );
      }
    }
  });

  return parsed;
}

export interface ConfigSources {
  hero: unknown;
  enemies: unknown;
  waves: unknown;
  summons: unknown;
  passives: unknown;
  bonds: unknown;
  skills: unknown;
  levels: unknown;
  evolutions: unknown;
  items: unknown;
}

export function buildConfig(src: ConfigSources): GameConfig {
  const enemies = parseEnemies(src.enemies);
  const waves = parseWaves(src.waves, enemies);
  waves.forEach((w, i) => {
    if (w.index !== i + 1) fail(`waves[${i}].index`, `波次序号应为 ${i + 1}，实际为 ${w.index}`);
  });
  const passives = parsePassives(src.passives);
  const skills = parseSkills(src.skills);
  return {
    hero: parseHero(src.hero),
    enemies,
    summons: parseSummons(src.summons),
    waves,
    passives,
    bonds: parseBonds(src.bonds, passives),
    skills,
    levels: parseLevels(src.levels, skills),
    evolutions: parseEvolutions(src.evolutions),
    items: parseItems(src.items),
  };
}
