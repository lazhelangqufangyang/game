import type { Direction, WaveDef } from '../core/types';
import { pickOne } from '../core/rng';

export const DIRECTIONS: readonly Direction[] = ['north', 'east', 'south', 'west'];

export const DIRECTION_LABEL: Record<Direction, string> = {
  north: '北 ↑',
  east: '东 →',
  south: '南 ↓',
  west: '西 ←',
};

/** 每波方向：配置为 random 时随机抽一个，抽完即固定。 */
export function resolveDirection(wave: WaveDef, rng: () => number): Direction {
  return wave.direction === 'random' ? pickOne(rng, DIRECTIONS) : wave.direction;
}

/**
 * 单条刷怪流：按固定间隔产出 count 只怪。
 * 首次调用 update 时立刻产出第一只。
 * 纯逻辑，不依赖 Phaser，可直接单测。
 */
export class SpawnStream {
  private timer: number;
  spawned = 0;

  constructor(
    readonly total: number,
    readonly intervalMs: number,
  ) {
    if (total < 0) throw new Error('SpawnStream: total 不能为负');
    if (total > 0 && intervalMs <= 0) throw new Error('SpawnStream: intervalMs 必须大于 0');
    this.timer = 0;
  }

  get finished(): boolean {
    return this.spawned >= this.total;
  }

  /** 推进 dtMs 毫秒，返回本次应产出的数量。 */
  update(dtMs: number): number {
    if (dtMs < 0) throw new Error('SpawnStream: dtMs 不能为负');
    if (this.finished) return 0;

    let produced = 0;
    this.timer -= dtMs;
    while (this.timer <= 0 && !this.finished) {
      this.spawned += 1;
      produced += 1;
      this.timer += this.intervalMs;
    }
    return produced;
  }
}

/** 一波内的多条刷怪流（不同兵种不同节奏）。 */
export class WaveDirector {
  readonly streams: SpawnStream[];

  constructor(wave: WaveDef) {
    this.streams = wave.groups.map((g) => new SpawnStream(g.count, g.interval_ms));
  }

  get finished(): boolean {
    return this.streams.every((s) => s.finished);
  }

  /** 返回 [流索引, 数量] 列表。 */
  update(dtMs: number): Array<{ stream: number; count: number }> {
    const out: Array<{ stream: number; count: number }> = [];
    this.streams.forEach((stream, index) => {
      const count = stream.update(dtMs);
      if (count > 0) out.push({ stream: index, count });
    });
    return out;
  }
}
