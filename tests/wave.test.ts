import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../src/core/rng';
import { SpawnStream, WaveDirector, resolveDirection } from '../src/systems/wave';
import type { WaveDef } from '../src/core/types';

describe('SpawnStream', () => {
  it('首次更新立刻产出第一只，之后按间隔产出', () => {
    const s = new SpawnStream(3, 500);
    expect(s.update(16)).toBe(1);
    expect(s.spawned).toBe(1);
    expect(s.update(483)).toBe(0);
    expect(s.update(1)).toBe(1);
    expect(s.spawned).toBe(2);
    expect(s.finished).toBe(false);
    expect(s.update(500)).toBe(1);
    expect(s.finished).toBe(true);
    expect(s.update(5000)).toBe(0);
  });

  it('一次大步长可以补出多只，但不超过总量', () => {
    const s = new SpawnStream(3, 100);
    expect(s.update(1000)).toBe(3);
    expect(s.spawned).toBe(3);
  });

  it('拒绝非法配置', () => {
    expect(() => new SpawnStream(1, 0)).toThrow();
    expect(() => new SpawnStream(-1, 100)).toThrow();
    expect(() => new SpawnStream(2, 100).update(-1)).toThrow();
  });
});

describe('WaveDirector', () => {
  const wave: WaveDef = {
    index: 1,
    direction: 'north',
    groups: [
      { enemy: 'grunt', count: 2, interval_ms: 100 },
      { enemy: 'runner', count: 1, interval_ms: 50 },
    ],
    hp_scale: 1,
    speed_scale: 1,
  };

  it('多条刷怪流独立推进', () => {
    const d = new WaveDirector(wave);
    const first = d.update(16);
    expect(first).toHaveLength(2);
    expect(first.map((x) => x.stream)).toEqual([0, 1]);
    expect(d.finished).toBe(false);

    d.update(50);
    expect(d.streams[1]!.finished).toBe(true);
    d.update(200);
    expect(d.finished).toBe(true);
  });
});

describe('resolveDirection', () => {
  it('random 时按种子确定，且抽完固定', () => {
    const w: WaveDef = {
      index: 1,
      direction: 'random',
      groups: [{ enemy: 'grunt', count: 1, interval_ms: 100 }],
      hp_scale: 1,
      speed_scale: 1,
    };
    const a = resolveDirection(w, mulberry32(42));
    const b = resolveDirection(w, mulberry32(42));
    expect(a).toBe(b);
    expect(['north', 'east', 'south', 'west']).toContain(a);
  });

  it('配置了方向就固定用配置值', () => {
    const w: WaveDef = {
      index: 1,
      direction: 'west',
      groups: [{ enemy: 'grunt', count: 1, interval_ms: 100 }],
      hp_scale: 1,
      speed_scale: 1,
    };
    expect(resolveDirection(w, mulberry32(1))).toBe('west');
  });
});
