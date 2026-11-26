import type { EvolutionOption, EvolutionStage, ItemDef, Mods, RunState } from '../core/types';
import { addMods, emptyMods } from './passives';

export const MAX_EQUIPMENT = 3;

function optionIndex(stages: readonly EvolutionStage[]): Map<string, EvolutionOption> {
  const map = new Map<string, EvolutionOption>();
  for (const stage of stages) for (const option of stage.options) map.set(option.id, option);
  return map;
}

/** 下一个可进化的阶段；已走完全部阶段返回 null。 */
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

/** 进化：扣精粹并记录所选方向；精粹不够 / 方向不属于当前阶段返回 false。 */
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

export function equipmentMods(items: readonly ItemDef[], ids: readonly string[]): Mods {
  const mods = emptyMods();
  for (const id of ids) {
    const item = items.find((i) => i.id === id);
    if (item?.mods) addMods(mods, item.mods);
  }
  return mods;
}

/** 每波随机 3 件商品，同一波内不重复。 */
export function rollShop(items: readonly ItemDef[], rng: () => number, count = 3): string[] {
  const pool = items.slice();
  const picked: string[] = [];
  while (pool.length > 0 && picked.length < count) {
    const index = Math.floor(rng() * pool.length);
    const [item] = pool.splice(index, 1);
    if (item) picked.push(item.id);
  }
  return picked;
}

export type BuyResult = 'ok' | 'poor' | 'slots';

export function buyItem(
  item: ItemDef,
  run: Pick<RunState, 'economy' | 'hp' | 'max_hp' | 'equipment'>,
): BuyResult {
  if (run.economy < item.price) return 'poor';
  if (item.kind === 'equipment' && run.equipment.length >= MAX_EQUIPMENT) return 'slots';

  run.economy -= item.price;
  if (item.kind === 'equipment') {
    run.equipment = [...run.equipment, item.id];
  } else if (item.heal) {
    run.hp = Math.min(run.max_hp, run.hp + item.heal);
  }
  return 'ok';
}
