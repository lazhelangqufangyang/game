import Phaser from 'phaser';
import { buildArena } from '../assets/arena';
import { buildActorTextures, buildAnimations } from '../assets/sprites';
import { config } from '../config';
import { RESOURCE_META, RESOURCE_ORDER } from '../core/resources';
import { createRun } from '../core/run';
import { loadRun } from '../core/save';

/**
 * 可选：把任意一张 1280×720 的插画放到 `src/assets/arena.png`，就会直接拿它当战斗背景。
 * 用 import.meta.glob 在构建期解析，没放图时不会产生任何网络请求（也就不会有 404）。
 */
const ARENA_OVERRIDES = import.meta.glob('../assets/arena*.png', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    const override = Object.values(ARENA_OVERRIDES)[0];
    if (override) this.load.image('arena-src', override);
  }

  create(): void {
    buildActorTextures(this, config);
    buildAnimations(this);
    this.registry.set('arenaKey', buildArena(this));
    this.ensureFallbacks();
    this.ensureParticles();

    const saved = loadRun();
    this.registry.set('run', saved ?? createRun(config.hero));
    this.registry.set('resumed', saved !== null);
    this.registry.set('direction', 'north');
    this.scene.start('Prep');
  }

  /**
   * 兜底：像素图没编译出来（配置写错 / 新增实体忘了加图）时退回纯色圆，
   * 保证游戏永远能跑起来，而不是直接崩在渲染阶段。
   */
  private ensureFallbacks(): void {
    this.makeCircle('hero', config.hero.radius, hex(config.hero.color));
    this.makeCircle('hero-alt', config.hero.radius, hex(config.hero.color));
    for (const def of Object.values(config.enemies)) {
      this.makeCircle(`enemy-${def.id}`, def.radius, hex(def.color));
    }
    for (const def of config.summons) {
      this.makeCircle(`summon-${def.id}`, def.radius, hex(def.color), true);
    }
    for (const kind of RESOURCE_ORDER) {
      this.makeCircle(`pickup-${kind}`, 9, RESOURCE_META[kind].hex, true);
    }
    this.makeCircle('bullet', config.hero.attack.bullet_radius, 0xffe9a8);
    this.makeCircle('shard', 3, 0xffffff);
  }

  private ensureParticles(): void {
    this.makeCircle('spark', 4, 0xffffff);
  }

  private makeCircle(key: string, radius: number, color: number, ring = false): void {
    if (this.textures.exists(key)) return;
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(color, 1);
    g.fillCircle(radius, radius, radius);
    if (ring) {
      g.lineStyle(2, 0xffffff, 0.85);
      g.strokeCircle(radius, radius, radius - 1.5);
    }
    g.generateTexture(key, radius * 2, radius * 2);
    g.destroy();
  }
}

function hex(color: string): number {
  return Phaser.Display.Color.HexStringToColor(color).color;
}
