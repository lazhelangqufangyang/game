import Phaser from 'phaser';
import type { SkillDef } from '../core/types';
import { COLORS, TEXT_STYLE } from './style';

const W = 84;
const H = 66;
const GAP = 10;

const KEYS = ['Q', 'W', 'E'];

/** 主动技能栏：未解锁显示等级要求，冷却时显示遮罩。 */
export class SkillBar {
  private readonly items: Array<{
    def: SkillDef;
    bg: Phaser.GameObjects.Rectangle;
    name: Phaser.GameObjects.Text;
    key: Phaser.GameObjects.Text;
    lock: Phaser.GameObjects.Text;
  }> = [];
  private readonly overlay: Phaser.GameObjects.Graphics;

  constructor(
    scene: Phaser.Scene,
    defs: readonly SkillDef[],
    x0: number,
    y0: number,
    onCast: (id: string) => void,
  ) {
    this.overlay = scene.add.graphics().setDepth(31);

    defs.forEach((def, i) => {
      const x = x0 + i * (W + GAP);
      const bg = scene.add
        .rectangle(x + W / 2, y0 + H / 2, W, H, 0x121a27)
        .setStrokeStyle(2, 0x4b5b72)
        .setDepth(30)
        .setInteractive({ useHandCursor: true });
      bg.on('pointerdown', () => onCast(def.id));

      const name = scene.add
        .text(x + W / 2, y0 + 22, def.name, { ...TEXT_STYLE, fontSize: '14px' })
        .setOrigin(0.5)
        .setDepth(32);
      const key = scene.add
        .text(x + W / 2, y0 + 48, `[${KEYS[i] ?? '?'}]`, {
          ...TEXT_STYLE,
          fontSize: '12px',
          color: COLORS.dim,
        })
        .setOrigin(0.5)
        .setDepth(32);
      const lock = scene.add
        .text(x + W / 2, y0 + H / 2, `Lv.${def.level}`, {
          ...TEXT_STYLE,
          fontSize: '15px',
          color: COLORS.dim,
        })
        .setOrigin(0.5)
        .setDepth(33);

      this.items.push({ def, bg, name, key, lock });
    });
  }

  update(cooldowns: ReadonlyMap<string, number>, level: number): void {
    this.overlay.clear();
    for (const item of this.items) {
      const unlocked = level >= item.def.level;
      const cd = cooldowns.get(item.def.id) ?? 0;
      const ratio = Math.min(1, cd / item.def.cooldown_ms);

      item.lock.setVisible(!unlocked);
      item.name.setAlpha(unlocked ? 1 : 0.25);
      item.key.setAlpha(unlocked ? 1 : 0.25);

      if (unlocked && ratio > 0.001) {
        const x = item.bg.x - W / 2;
        const y = item.bg.y - H / 2;
        this.overlay.fillStyle(0x000000, 0.55);
        this.overlay.fillRect(x + 2, y + H * (1 - ratio), W - 4, H * ratio - 2);
      }
      if (!unlocked) {
        this.overlay.fillStyle(0x000000, 0.45);
        this.overlay.fillRect(item.bg.x - W / 2 + 2, item.bg.y - H / 2 + 2, W - 4, H - 4);
      }
    }
  }
}
