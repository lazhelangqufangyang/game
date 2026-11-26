import type { ResourceKind, RunState } from './types';

export const RESOURCE_META: Record<
  ResourceKind,
  { name: string; color: string; hex: number }
> = {
  economy: { name: '经济', color: '#ffd166', hex: 0xffd166 },
  xp: { name: '经验', color: '#5ee6a8', hex: 0x5ee6a8 },
  essence: { name: '精粹', color: '#c084fc', hex: 0xc084fc },
};

export const RESOURCE_ORDER: readonly ResourceKind[] = ['economy', 'xp', 'essence'];

/** 资源隔离：只加到对应字段，绝不串味。 */
export function grantResource(run: RunState, kind: ResourceKind, amount: number): number {
  if (!Number.isFinite(amount) || amount < 0) throw new Error(`grantResource: 非法数量 ${amount}`);
  const next = run[kind] + amount;
  run[kind] = next;
  return next;
}

export function resourceTotal(run: RunState): number {
  return run.economy + run.xp + run.essence;
}
