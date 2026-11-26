import type { EvolutionOption, EvolutionStage, ItemDef, Mods, RunState } from '../core/types';
import { addMods, emptyMods } from './passives';

/** 所有装备（小件 / 中件 / 大件）都占格，总共 6 格。 */
export const MAX_SLOTS = 6;

function optionIndex(stages: readonly EvolutionStage[]): Map<string, EvolutionOption> {
  const map = new Map<string, EvolutionOption>();
  for (const stage of stages) for (const option of stage.options) map.set(option.id, option);
  return map;
}

export function nextStage(
  stages: readonly EvolutionStage[],
  chosen: readonly string[],
): EvolutionStage | null {
  return stages[chosen.length] ?? null;
}

export function evolutionMods(stages: readonly EvolutionStage[], chosen: readonly string[]): Mods {
  const mods = emptyMods();
  const byId = optionIndex(stages);
  for (const id of chosen) {
    const option = byId.get(id);
    if (option) addMods(mods, option.mods);
  }
  return mods;
}

export function evolutionPerks(
  stages: readonly EvolutionStage[],
  chosen: readonly string[],
): { heal_on_kill: number; skill_cd_pct: number } {
  const byId = optionIndex(stages);
  let heal = 0;
  let cd = 0;
  for (const id of chosen) {
    const option = byId.get(id);
    if (!option) continue;
    heal += option.heal_on_kill ?? 0;
    cd += option.skill_cd_pct ?? 0;
  }
  return { heal_on_kill: heal, skill_cd_pct: Math.min(80, cd) };
}

export function chooseEvolution(
  run: Pick<RunState, 'essence' | 'evolutions'>,
  stages: readonly EvolutionStage[],
  optionId: string,
): boolean {
  const stage = nextStage(stages, run.evolutions);
  if (!stage) return false;
  if (!stage.options.some((o) => o.id === optionId)) return false;
  if (run.essence < stage.cost) return false;

  run.essence -= stage.cost;
  run.evolutions = [...run.evolutions, optionId];
  return true;
}

export function findItem(items: readonly ItemDef[], id: string): ItemDef | undefined {
  return items.find((item) => item.id === id);
}

/** 所有已拥有装备的属性总和。 */
export function inventoryMods(items: readonly ItemDef[], owned: readonly string[]): Mods {
  const mods = emptyMods();
  for (const id of owned) {
    const item = findItem(items, id);
    if (item?.mods) addMods(mods, item.mods);
  }
  return mods;
}

export function ownedCount(owned: readonly string[], id: string): number {
  return owned.filter((x) => x === id).length;
}

export function recipeStatus(
  item: ItemDef,
  owned: readonly string[],
): { ok: boolean; missing: string[] } {
  const missing: string[] = [];
  const pool = [...owned];
  for (const component of item.recipe ?? []) {
    const index = pool.indexOf(component);
    if (index < 0) {
      missing.push(component);
    } else {
      pool.splice(index, 1);
    }
  }
  return { ok: missing.length === 0, missing };
}

/** 已拥有、且带主动效果的装备（战斗内按 4/5 释放）。 */
export function activeItems(items: readonly ItemDef[], owned: readonly string[]): ItemDef[] {
  return owned
    .map((id) => findItem(items, id))
    .filter((item): item is ItemDef => !!item && !!item.active);
}

export type BuyResult = 'ok' | 'poor' | 'slots' | 'recipe';

export function buyItem(
  item: ItemDef,
  run: Pick<RunState, 'economy' | 'hp' | 'max_hp' | 'items'>,
): BuyResult {
  if (run.economy < item.price) return 'poor';

  if (item.kind === 'consumable') {
    run.economy -= item.price;
    if (item.heal) run.hp = Math.min(run.max_hp, run.hp + item.heal);
    return 'ok';
  }

  // 合成：组件会被消耗，净占用 = 1 - 组件数 ≤ 0，永远放得下
  if (item.recipe) {
    const status = recipeStatus(item, run.items);
    if (!status.ok) return 'recipe';

    run.economy -= item.price;
    const remaining = [...run.items];
    for (const component of item.recipe) {
      const index = remaining.indexOf(component);
      if (index >= 0) remaining.splice(index, 1);
    }
    run.items = [...remaining, item.id];
    return 'ok';
  }

  // 小件：直接占 1 格
  if (run.items.length >= MAX_SLOTS) return 'slots';
  run.economy -= item.price;
  run.items = [...run.items, item.id];
  return 'ok';
}

export type SellResult = 'ok' | 'missing';

/** 回收价：售价的一半（向下取整，至少 1）。合成后的成品按自身售价折算，不追溯组件。 */
export function sellValue(item: ItemDef): number {
  return Math.max(1, Math.floor(item.price * 0.5));
}

export function sellItem(
  item: ItemDef,
  run: Pick<RunState, 'economy' | 'items'>,
): SellResult {
  const index = run.items.indexOf(item.id);
  if (index < 0) return 'missing';
  run.items = run.items.filter((_, i) => i !== index);
  run.economy += sellValue(item);
  return 'ok';
}

/** 每波 4 件商品：保证至少 2 个小件，其余从全部商品（含治疗药剂）里抽。 */
export function rollShop(items: readonly ItemDef[], rng: () => number, count = 4): string[] {
  const smalls = items.filter((i) => i.kind === 'item' && i.tier === 1);
  const others = items.filter((i) => i.kind !== 'item' || (i.tier ?? 1) > 1);
  const picked: string[] = [];

  const draw = (pool: ItemDef[]) => {
    while (pool.length > 0 && picked.length < count) {
      const index = Math.floor(rng() * pool.length);
      const [item] = pool.splice(index, 1);
      if (item && !picked.includes(item.id)) picked.push(item.id);
    }
  };

  const smallPool = smalls.slice();
  const smallTarget = Math.min(2, count);
  for (let i = 0; i < smallTarget; i += 1) {
    const index = Math.floor(rng() * smallPool.length);
    const [item] = smallPool.splice(index, 1);
    if (item) picked.push(item.id);
  }

  draw(others.slice());
  if (picked.length < count) draw(items.slice());
  return picked;
}
