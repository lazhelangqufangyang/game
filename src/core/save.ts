import type { RunState } from './types';

export const SAVE_KEY = 'rogue-waves-save';
export const SAVE_VERSION = 1;

interface SaveFile {
  version: number;
  saved_at: number;
  run: RunState;
}

export function serializeRun(run: RunState, now = Date.now()): string {
  const file: SaveFile = { version: SAVE_VERSION, saved_at: now, run };
  return JSON.stringify(file);
}

/** 解析存档；结构不合法返回 null（不抛错，损坏的存档不能卡住启动）。 */
export function parseRun(raw: string | null): RunState | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Partial<SaveFile>;
    if (data.version !== SAVE_VERSION || !data.run) return null;
    const run = data.run as Partial<RunState>;

    const numbers: Array<keyof RunState> = [
      'hp',
      'max_hp',
      'wave_index',
      'kills',
      'seed',
      'economy',
      'xp',
      'essence',
      'level',
      'level_xp',
    ];
    for (const key of numbers) {
      if (typeof run[key] !== 'number' || !Number.isFinite(run[key] as number)) return null;
    }
    const arrays: Array<keyof RunState> = [
      'passives',
      'bond_members',
      'evolutions',
      'equipment',
      'shop_offers',
    ];
    for (const key of arrays) {
      if (!Array.isArray(run[key])) return null;
    }
    if ((run.max_hp as number) <= 0 || (run.wave_index as number) < 0) return null;

    return {
      ...(run as RunState),
      hp: Math.min(run.hp as number, run.max_hp as number),
    };
  } catch {
    return null;
  }
}

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function saveRun(run: RunState): void {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(SAVE_KEY, serializeRun(run));
  } catch {
    // 隐私模式 / 配额满时静默失败，不影响游戏
  }
}

export function loadRun(): RunState | null {
  const store = storage();
  if (!store) return null;
  try {
    return parseRun(store.getItem(SAVE_KEY));
  } catch {
    return null;
  }
}

export function clearRun(): void {
  const store = storage();
  if (!store) return;
  try {
    store.removeItem(SAVE_KEY);
  } catch {
    // ignore
  }
}
