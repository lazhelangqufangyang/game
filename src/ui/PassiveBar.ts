import Phaser from 'phaser';
import type { PassiveDef } from '../core/types';
import { COLORS, TEXT_STYLE } from './style';

const SLOT = 46;
const GAP = 6;

/** 右下角 8 格被动槽：显示名字前两字，点击查看完整说明。 */
export class PassiveBar {
  private readonly cells: Array<{
    bg: Phaser.GameObjects.Rectangle;
    label: Phaser.GameObjects.Text;
    index: number;
  }> = [];

  private current: Array<PassiveDef | null> = [];

  constructor(
    scene: Phaser.Scene,
    private readonly onInspect: (passive: PassiveDef) => void,
    slots = 8,
  ) {
    const totalW = slots * SLOT + (slots - 1) * GAP;
    const startX = scene.scale.width - 24 - totalW;
    const y = scene.scale.height - 24 - SLOT / 2;

    for (let i = 0; i < slots; i += 1) {
      const x = startX + i * (SLOT + GAP) + SLOT / 2;
      const bg = scene.add
        .rectangle(x, y, SLOT, SLOT, 0x101825)
        .setStrokeStyle(1, 0x2a3546)
        .setDepth(29)
        .setInteractive({ useHandCursor: true });

      const label = scene.add
        .text(x, y, '', { ...TEXT_STYLE, fontSize: '15px', color: COLORS.dim })
        .setOrigin(0.5)
        .setDepth(30);

      bg.on('pointerdown', () => {
        const passive = this.current[i];
        if (passive) this.onInspect(passive);
      });

      this.cells.push({ bg, label, index: i });
    }
  }

  refresh(slots: ReadonlyArray<PassiveDef | null>): void {
    this.current = slots.slice();
    this.cells.forEach((cell, i) => {
      const passive = slots[i] ?? null;
      if (!passive) {
        cell.label.setText('');
        cell.bg.setStrokeStyle(1, 0x2a3546).setFillStyle(0x101825);
        return;
      }
      cell.label.setText(passive.name.slice(0, 2)).setColor(COLORS.text);
      cell.bg
        .setStrokeStyle(2, passive.rarity === 'rare' ? 0xffd166 : 0x64748b)
        .setFillStyle(0x16202f);
    });
  }

  get indexOfLast(): number {
    return this.cells.length - 1;
  }
}
