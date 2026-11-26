import Phaser from 'phaser';
import { RESOURCE_META } from '../core/resources';
import type { SummonDef } from '../core/types';
import type { SummonSystem } from '../systems/summon';
import { COLORS, TEXT_STYLE } from './style';

const ITEM_W = 152;
const ITEM_H = 66;
const GAP = 12;
const MARGIN = 24;

interface BarItem {
  def: SummonDef;
  bg: Phaser.GameObjects.Rectangle;
  name: Phaser.GameObjects.Text;
  key: Phaser.GameObjects.Text;
  count: Phaser.GameObjects.Text;
}

/** 底部召唤栏：冷却遮罩 + 场上数量，点击/按 1-3 召唤。 */
export class SummonBar {
  private readonly items: BarItem[] = [];
  private readonly overlay: Phaser.GameObjects.Graphics;
  private readonly left: number;
  private readonly top: number;
  private readonly width: number;

  constructor(
    scene: Phaser.Scene,
    defs: readonly SummonDef[],
    onSummon: (id: string) => void,
  ) {
    const y = scene.scale.height - ITEM_H - MARGIN;
    this.left = MARGIN;
    this.top = y;
    this.width = defs.length * ITEM_W + (defs.length - 1) * GAP;

    this.overlay = scene.add.graphics().setDepth(31);

    defs.forEach((def, i) => {
      const x = MARGIN + i * (ITEM_W + GAP);
      const color = RESOURCE_META[def.resource].hex;

      const bg = scene.add
        .rectangle(x + ITEM_W / 2, y + ITEM_H / 2, ITEM_W, ITEM_H, 0x121a27)
        .setStrokeStyle(2, color, 0.75)
        .setDepth(30)
        .setInteractive({ useHandCursor: true });

      bg.on('pointerdown', () => onSummon(def.id));
      bg.on('pointerover', () => bg.setFillStyle(0x1a2536));
      bg.on('pointerout', () => bg.setFillStyle(0x121a27));

      const name = scene.add
        .text(x + 12, y + 10, def.name, {
          ...TEXT_STYLE,
          fontSize: '17px',
          color: RESOURCE_META[def.resource].color,
        })
        .setDepth(32);

      const key = scene.add
        .text(x + 12, y + 38, `[${i + 1}]`, { ...TEXT_STYLE, fontSize: '13px', color: COLORS.dim })
        .setDepth(32);

      const count = scene.add
        .text(x + ITEM_W - 12, y + 36, '0/2', {
          ...TEXT_STYLE,
          fontSize: '15px',
          color: COLORS.text,
        })
        .setOrigin(1, 0)
        .setDepth(32);

      this.items.push({ def, bg, name, key, count });
    });
  }

  /** 是否落在召唤栏区域内（用于避免拖拽移动与按钮冲突）。 */
  contains(x: number, y: number): boolean {
    return y >= this.top - 20 && x >= this.left - 20 && x <= this.left + this.width + 20;
  }

  update(system: SummonSystem): void {
    this.overlay.clear();
    for (const item of this.items) {
      const id = item.def.id;
      const ratio = system.cooldownRatio(id);
      const alive = system.aliveCount(id);
      const max = system.maxAlive(id);
      const blocked = ratio > 0.001 || alive >= max;

      item.count.setText(`${alive}/${max}`);
      item.count.setColor(alive >= max ? COLORS.danger : COLORS.text);
      item.name.setAlpha(blocked ? 0.5 : 1);
      item.key.setAlpha(blocked ? 0.5 : 1);

      if (ratio > 0.001) {
        const x = item.bg.x - ITEM_W / 2;
        const y = item.bg.y - ITEM_H / 2;
        this.overlay.fillStyle(0x000000, 0.55);
        this.overlay.fillRect(x + 2, y + ITEM_H * (1 - ratio), ITEM_W - 4, ITEM_H * ratio - 2);
      }

      if (alive >= max) {
        this.overlay.fillStyle(0x000000, 0.35);
        this.overlay.fillRect(item.bg.x - ITEM_W / 2 + 2, item.bg.y - ITEM_H / 2 + 2, ITEM_W - 4, ITEM_H - 4);
      }
    }
  }
}
