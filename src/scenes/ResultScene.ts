import Phaser from 'phaser';
import { COLORS, TEXT_STYLE } from '../ui/style';

interface ResultData {
  win: boolean;
  kills: number;
  wave: number;
}

export class ResultScene extends Phaser.Scene {
  private restarted = false;

  constructor() {
    super('Result');
  }

  create(data: ResultData): void {
    const { width, height } = this.scale;
    this.restarted = false;
    this.add.rectangle(0, 0, width, height, COLORS.bg).setOrigin(0);

    this.add
      .text(width / 2, height / 2 - 120, data.win ? '守住了' : '英雄倒下了', {
        ...TEXT_STYLE,
        fontSize: '56px',
        fontStyle: 'bold',
        color: data.win ? COLORS.accent : COLORS.danger,
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height / 2 - 30, `到达第 ${data.wave} 波 · 击杀 ${data.kills}`, {
        ...TEXT_STYLE,
        fontSize: '24px',
        color: COLORS.dim,
      })
      .setOrigin(0.5);

    const btn = this.add
      .rectangle(width / 2, height / 2 + 70, 240, 58, 0x1b2a3f)
      .setStrokeStyle(2, COLORS.accent_line)
      .setInteractive({ useHandCursor: true });

    this.add
      .text(width / 2, height / 2 + 70, '再来一局', {
        ...TEXT_STYLE,
        fontSize: '24px',
        color: COLORS.accent,
      })
      .setOrigin(0.5);

    btn.on('pointerover', () => btn.setFillStyle(0x24384f));
    btn.on('pointerout', () => btn.setFillStyle(0x1b2a3f));
    btn.on('pointerdown', () => this.restart());

    this.input.keyboard?.once('keydown-SPACE', () => this.restart());
    this.input.keyboard?.once('keydown-ENTER', () => this.restart());

    this.cameras.main.fadeIn(250, 0, 0, 0);
  }

  private restart(): void {
    if (this.restarted) return;
    this.restarted = true;
    this.cameras.main.fadeOut(200, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Boot'));
  }
}
