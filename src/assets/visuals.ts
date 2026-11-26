import raw from '../../data/visuals.json';
import { ConfigError } from '../config/validate';

export interface VisualDef {
  /** 显示缩放，像素图请用整数。 */
  scale: number;
  /** 地面投影的椭圆宽度（px），0 表示不画。 */
  shadow: number;
  /** 行走时的垂直压扁幅度（0–0.2）。 */
  bob: number;
  /** 是否按水平速度左右翻转。 */
  flip: boolean;
  /** 是否让朝向跟随速度（子弹用）。 */
  rotate: boolean;
}

const FILE = 'data/visuals.json';

function fail(path: string, msg: string): never {
  throw new ConfigError(`配置错误 → ${path}: ${msg}`);
}

function number(v: unknown, path: string, min: number, max: number): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) fail(path, '应为有限数字');
  if (v < min || v > max) fail(path, `应在 ${min} ~ ${max} 之间`);
  return v;
}

function bool(v: unknown, path: string): boolean {
  if (typeof v !== 'boolean') fail(path, '应为布尔值');
  return v;
}

function buildVisuals(input: unknown): Record<string, VisualDef> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    fail(FILE, '顶层应为对象');
  }
  const out: Record<string, VisualDef> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (key.startsWith('_')) continue;
    const path = `${FILE}.${key}`;
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      fail(path, '应为对象');
    }
    const o = value as Record<string, unknown>;
    out[key] = {
      scale: number(o.scale, `${path}.scale`, 0.25, 8),
      shadow: number(o.shadow, `${path}.shadow`, 0, 200),
      bob: number(o.bob, `${path}.bob`, 0, 0.3),
      flip: bool(o.flip, `${path}.flip`),
      rotate: bool(o.rotate, `${path}.rotate`),
    };
  }
  if (Object.keys(out).length === 0) fail(FILE, '至少要有一个外观条目');
  return out;
}

export const visuals = buildVisuals(raw);

/** 取某个贴图 key 的外观参数；缺失时按 1 倍、无投影处理，并在控制台提示。 */
export function visualOf(key: string): VisualDef {
  const found = visuals[key];
  if (found) return found;
  console.warn(`[visuals] 未声明 ${key}，使用默认外观`);
  return { scale: 1, shadow: 0, bob: 0, flip: false, rotate: false };
}
