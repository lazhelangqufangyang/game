import { describe, expect, it } from 'vitest';
import { SummonSystem } from '../src/systems/summon';
import type { SummonDef } from '../src/core/types';

const def = (over: Partial<SummonDef> = {}): SummonDef => ({
  id: 'coffer',
  name: '经济怪',
  resource: 'economy',
  reward: 3,
  hp: 45,
  speed: 88,
  damage: 7,
  radius: 15,
  color: '#ffd166',
  cooldown_ms: 9000,
  max_alive: 2,
  spawn_distance: 130,
  ...over,
});

describe('SummonSystem', () => {
  it('首次可以召唤，之后进入冷却', () => {
    const sys = new SummonSystem([def()]);
    expect(sys.request('coffer')).toBe('ok');
    expect(sys.cooldownLeft('coffer')).toBe(9000);
    expect(sys.request('coffer')).toBe('cooldown');
  });

  it('冷却结束后可以再次召唤', () => {
    const sys = new SummonSystem([def()]);
    sys.request('coffer');
    sys.update(8999);
    expect(sys.request('coffer')).toBe('cooldown');
    sys.update(1);
    expect(sys.cooldownLeft('coffer')).toBe(0);
    expect(sys.request('coffer')).toBe('ok');
  });

  it('同类型场上数量到达上限后拒绝，死亡后释放名额', () => {
    const sys = new SummonSystem([def({ cooldown_ms: 1, max_alive: 2 })]);
    expect(sys.request('coffer')).toBe('ok');
    sys.update(1);
    expect(sys.request('coffer')).toBe('ok');
    sys.update(1);
    expect(sys.request('coffer')).toBe('max_alive');
    expect(sys.aliveCount('coffer')).toBe(2);

    sys.release('coffer');
    expect(sys.aliveCount('coffer')).toBe(1);
    expect(sys.request('coffer')).toBe('ok');
  });

  it('冷却比例用于 UI 遮罩，从 1 递减到 0', () => {
    const sys = new SummonSystem([def({ cooldown_ms: 1000 })]);
    sys.request('coffer');
    expect(sys.cooldownRatio('coffer')).toBeCloseTo(1);
    sys.update(500);
    expect(sys.cooldownRatio('coffer')).toBeCloseTo(0.5);
    sys.update(500);
    expect(sys.cooldownRatio('coffer')).toBe(0);
  });

  it('未知 id 安全返回并拒绝负数时间', () => {
    const sys = new SummonSystem([def()]);
    expect(sys.request('nope')).toBe('unknown');
    expect(() => sys.update(-1)).toThrow();
  });
});
