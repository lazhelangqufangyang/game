import Phaser from 'phaser';
import { config } from '../config';
import { mulberry32 } from '../core/rng';
import type { RunState } from '../core/types';
import { DIRECTION_LABEL, resolveDirection } from '../systems/wave';
import { COLORS, TEXT_STYLE } from '../ui/style';

export class PrepScene extends Phaser.Scene {
  private starting = false;

  constructor() {
    super('Prep');
  }

  create(): void {
    this.starting = false;
    const run = this.registry.get('run') as RunState;
    const wave = config.waves[run.wave_index];
    if (!wave) {
      this.scene.start('Result', { win: true, kills: run.kills, wave: run.wave_index });
      return;
    }

    const rng = mulberry32(run.seed + run.wave_index * 7919);
    const direction = resolveDirection(wave, rng);
    this.registry.set('direction', direction);

    const { width, height } = this.scale;

    this.add.rectangle(0, 0, width, height, COLORS.bg).setOrigin(0);

    const panelW = 640;
    const panelH = 380;
    const panel = this.add
      .rectangle(width / 2, height / 2, panelW, panelH, 0x111826)
      .setStrokeStyle(2, COLORS.border);
    void panel;

    this.add
      .text(width / 2, height / 2 - 140, `第 ${run.wave_index + 1} 波 / 共 ${config.waves.length} 波`, {
        ...TEXT_STYLE,
        fontSize: '34px',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height / 2 - 78, `来袭方向：${DIRECTION_LABEL[direction]}`, {
        ...TEXT_STYLE,
        fontSize: '26px',
        color: COLORS.accent,
      })
      .setOrigin(0.5);

    const lines = wave.groups.map(
      (g) => `${config.enemies[g.enemy]!.name} × ${g.count}`,
    );
    this.add
      .text(width / 2, height / 2 - 20, lines.join('    '), {
        ...TEXT_STYLE,
        fontSize: '22px',
        color: COLORS.dim,
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height / 2 + 26, `生命 ${Math.ceil(run.hp)} / ${run.max_hp}`, {
        ...TEXT_STYLE,
        fontSize: '20px',
        color: run.hp / run.max_hp < 0.35 ? COLORS.danger : COLORS.text,
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height / 2 + 68, 'WASD / 方向键移动 · 也可拖动屏幕移动 · 自动射击', {
        ...TEXT_STYLE,
        fontSize: '16px',
        color: COLORS.dim,
      })
      .setOrigin(0.5);

    const btn = this.add
      .rectangle(width / 2, height / 2 + 128, 240, 56, 0x1b2a3f)
      .setStrokeStyle(2, COLORS.accent_line)
      .setInteractive({ useHandCursor: true });

    const btnText = this.add
      .text(width / 2, height / 2 + 128, '开始战斗', {
        ...TEXT_STYLE,
        fontSize: '24px',
        color: COLORS.accent,
      })
      .setOrigin(0.5);

    btn.on('pointerover', () => btn.setFillStyle(0x24384f));
    btn.on('pointerout', () => btn.setFillStyle(0x1b2a3f));
    btn.on('pointerdown', () => this.start());

    this.input.keyboard?.once('keydown-SPACE', () => this.start());
    this.input.keyboard?.once('keydown-ENTER', () => this.start());

    this.tweens.add({
      targets: btnText,
      alpha: 0.55,
      duration: 900,
      yoyo: true,
      repeat: -1,
    });
  }

  private start(): void {
    if (this.starting) return;
    this.starting = true;
    this.cameras.main.fadeOut(180, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('Battle');
    });
  }
}
