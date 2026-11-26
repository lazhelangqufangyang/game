import type { EvolutionOption, EvolutionStage, ItemDef, Mods, RunState } from '../core/types';
import { addMods, emptyMods } from './passives';

/** 只有带特殊效果的成品装备占格；纯属性小件不占格。 */
export const MAX_EQUIPMENT = 6;

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

/** 所有已拥有物品（小件 + 成品）的属性总和。 */
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

/** 已装备、且带主动效果的成品（战斗内按 4/5 释放）。 */
export function activeItems(items: readonly ItemDef[], equipment: readonly string[]): ItemDef[] {
  return equipment
    .map((id) => findItem(items, id))
    .filter((item): item is ItemDef => !!item && !!item.active);
}

export type BuyResult = 'ok' | 'poor' | 'slots' | 'recipe';

export function buyItem(
  item: ItemDef,
  run: Pick<RunState, 'economy' | 'hp' | 'max_hp' | 'equipment' | 'items'>,
): BuyResult {
  if (run.economy < item.price) return 'poor';

  if (item.kind === 'consumable') {
    run.economy -= item.price;
    if (item.heal) run.hp = Math.min(run.max_hp, run.hp + item.heal);
    return 'ok';
  }

  if (item.kind === 'stat') {
    run.economy -= item.price;
    run.items = [...run.items, item.id];
    return 'ok';
  }

  // 成品装备：需要配方组件 + 有空装备格
  if (run.equipment.length >= MAX_EQUIPMENT) return 'slots';
  const status = recipeStatus(item, run.items);
  if (!status.ok) return 'recipe';

  run.economy -= item.price;
  const remaining = [...run.items];
  for (const component of item.recipe ?? []) {
    const index = remaining.indexOf(component);
    if (index >= 0) remaining.splice(index, 1);
  }
  run.items = [...remaining, item.id];
  run.equipment = [...run.equipment, item.id];
  return 'ok';
}

/** 每波随机 3 件商品，同一波内不重复。 */
export function rollShop(items: readonly ItemDef[], rng: () => number, count = 4): string[] {
  const pool = items.slice();
  const picked: string[] = [];
  while (pool.length > 0 && picked.length < count) {
    const index = Math.floor(rng() * pool.length);
    const [item] = pool.splice(index, 1);
    if (item) picked.push(item.id);
  }
  return picked;
}
