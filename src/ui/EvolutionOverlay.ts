import Phaser from 'phaser';
import type { EvolutionStage } from '../core/types';
import { COLORS, TEXT_STYLE } from './style';

/** 英雄进化三选一（战斗内结算界面复用）。 */
export class EvolutionOverlay {
  private readonly root: Phaser.GameObjects.Container;

  constructor(
    scene: Phaser.Scene,
    stage: EvolutionStage,
    onPick: (optionId: string) => void,
    onCancel: () => void,
  ) {
    const { width, height } = scene.scale;
    this.root = scene.add.container(0, 0).setDepth(120);
    this.root.add(
      scene.add.rectangle(0, 0, width, height, 0x05080d, 0.85).setOrigin(0).setInteractive(),
    );

    this.root.add(
      scene.add
        .text(width / 2, 120, `阶段 ${stage.stage} 进化 · 选择方向`, {
          ...TEXT_STYLE,
          fontSize: '30px',
          fontStyle: 'bold',
          color: COLORS.accent,
        })
        .setOrigin(0.5),
    );

    const cardW = 320;
    const cardH = 300;
    const gap = 28;
    const totalW = stage.options.length * cardW + (stage.options.length - 1) * gap;
    const startX = width / 2 - totalW / 2 + cardW / 2;

    stage.options.forEach((option, i) => {
      const cx = startX + i * (cardW + gap);
      const cy = 360;
      const box = scene.add
        .rectangle(cx, cy, cardW, cardH, 0x111a28)
        .setStrokeStyle(2, 0x3b4c63)
        .setInteractive({ useHandCursor: true });
      box.on('pointerover', () => box.setFillStyle(0x1a2739));
      box.on('pointerout', () => box.setFillStyle(0x111a28));
      box.on('pointerdown', () => {
        this.destroy();
        onPick(option.id);
      });
      this.root.add(box);

      this.root.add(
        scene.add
          .text(cx, cy - 100, option.name, {
            ...TEXT_STYLE,
            fontSize: '26px',
            fontStyle: 'bold',
          })
          .setOrigin(0.5),
      );
      const lines: string[] = [];
      for (let k = 0; k < option.desc.length; k += 14) lines.push(option.desc.slice(k, k + 14));
      this.root.add(
        scene.add
          .text(cx, cy + 10, lines.join('\n'), {
            ...TEXT_STYLE,
            fontSize: '16px',
            color: COLORS.text,
            align: 'center',
            lineSpacing: 6,
          })
          .setOrigin(0.5),
      );
    });

    const cancel = scene.add
      .rectangle(width / 2, 600, 200, 48, 0x16202f)
      .setStrokeStyle(2, 0x334155)
      .setInteractive({ useHandCursor: true });
    cancel.on('pointerdown', () => {
      this.destroy();
      onCancel();
    });
    this.root.add(cancel);
    this.root.add(
      scene.add
        .text(width / 2, 600, '取消', { ...TEXT_STYLE, fontSize: '18px', color: COLORS.dim })
        .setOrigin(0.5),
    );
  }

  destroy(): void {
    this.root.destroy(true);
  }
}
