import Phaser from 'phaser';
import spriteData from '../../data/sprites.json';
import { RESOURCE_META, RESOURCE_ORDER } from '../core/resources';
import type { GameConfig } from '../core/types';
import { compileRows, derivePalette, mixHex, type Palette, type PixelRows } from './pixel';
import { buildTiles } from './tiles';

interface SpriteEntry {
  rows: PixelRows;
  palette?: Palette;
}

const ENTRIES: Record<string, SpriteEntry> = Object.fromEntries(
  Object.entries(spriteData as Record<string, unknown>)
    .filter(([key]) => !key.startsWith('_'))
    .map(([key, value]) => [key, value as SpriteEntry]),
);

function entry(name: string): SpriteEntry | null {
  const found = ENTRIES[name];
  if (!found) {
    console.warn(`[sprites] data/sprites.json 缺少 ${name}，将回退占位图`);
    return null;
  }
  return found;
}

/** 用实体主色派生调色板后编译一张贴图；sprites.json 里的 palette 优先于派生色。 */
function paint(
  scene: Phaser.Scene,
  key: string,
  spriteName: string,
  base: string,
  extra: Palette = {},
): void {
  const found = entry(spriteName);
  if (!found) return;
  const palette: Palette = { ...derivePalette(base, found.palette ?? {}), ...extra };
  compileRows(scene, key, found.rows, palette);
}

/**
 * 生成全部运行时贴图：地面/装饰/暗角 + 英雄、怪物、召唤物、资源球、子弹、碎片。
 * 贴图 key 与 BattleScene 里的用法一一对应（hero / enemy-<id> / summon-<id> / pickup-<kind>）。
 */
export function buildActorTextures(scene: Phaser.Scene, cfg: GameConfig): void {
  buildTiles(scene);

  paint(scene, 'hero', 'hero', cfg.hero.color);
  paint(scene, 'hero-alt', 'hero_alt', cfg.hero.color);

  for (const def of Object.values(cfg.enemies)) {
    paint(scene, `enemy-${def.id}`, def.id, def.color);
  }

  for (const def of cfg.summons) {
    paint(scene, `summon-${def.id}`, `summon_${def.resource}`, def.color);
  }

  for (const kind of RESOURCE_ORDER) {
    const hex = RESOURCE_META[kind].color;
    paint(scene, `pickup-${kind}`, 'pickup', hex, {
      o: mixHex(hex, '#05070d', 0.8),
      l: mixHex(hex, '#ffffff', 0.35),
      h: mixHex(hex, '#ffffff', 0.75),
    });
  }

  paint(scene, 'bullet', 'bullet', '#ffd166');
  paint(scene, 'shard', 'shard', '#ffffff');
}

/** 英雄行走动画：两张像素图交替，俯视追逐不需要 8 方向行走图。 */
export function buildAnimations(scene: Phaser.Scene): void {
  if (scene.anims.exists('hero-walk')) return;
  if (!scene.textures.exists('hero') || !scene.textures.exists('hero-alt')) return;
  scene.anims.create({
    key: 'hero-walk',
    frames: [{ key: 'hero' }, { key: 'hero-alt' }],
    frameRate: 8,
    repeat: -1,
  });
}
