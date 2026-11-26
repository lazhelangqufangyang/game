import Phaser from 'phaser';
import { addMenuBackdrop } from '../assets/backdrop';
import { config } from '../config';
import { mulberry32 } from '../core/rng';
import type { EvolutionStage, ItemDef, RunState } from '../core/types';
import {
  MAX_EQUIPMENT,
  buyItem,
  chooseEvolution,
  nextStage,
  rollShop,
} from '../systems/meta';
import { DIRECTION_LABEL, resolveDirection } from '../systems/wave';
import { COLORS, TEXT_STYLE } from '../ui/style';

const PANEL_LEFT = 32;
const PANEL_RIGHT = 636;
const PANEL_TOP = 56;
const PANEL_BOTTOM = 664;
const LEFT_W = 580;
const RIGHT_W = 612;

export class PrepScene extends Phaser.Scene {
  private starting = false;
  private run!: RunState;
  private ui!: Phaser.GameObjects.Container;
  private modal: Phaser.GameObjects.Container | null = null;

  constructor() {
    super('Prep');
  }

  create(): void {
    this.starting = false;
    this.run = this.registry.get('run') as RunState;
    const wave = config.waves[this.run.wave_index];
    if (!wave) {
      this.scene.start('Result', { win: true, kills: this.run.kills, wave: this.run.wave_index });
      return;
    }

    const { width, height } = this.scale;
    this.add.rectangle(0, 0, width, height, COLORS.bg).setOrigin(0).setDepth(-30);
    addMenuBackdrop(this, width, height);

    if (this.run.shop_offers.length === 0) {
      const rng = mulberry32(this.run.seed + this.run.wave_index * 104729);
      this.run.shop_offers = rollShop(config.items, rng, 3);
    }

    this.ui = this.add.container(0, 0);
    this.build();
  }

  // ---------------------------------------------------------------- layout

  private build(): void {
    this.ui.removeAll(true);
    this.buildBriefing();
    this.buildEvolutionPanel();
    this.buildShopPanel();
  }

  private panel(x: number, y: number, w: number, h: number): void {
    this.ui.add(
      this.add.rectangle(x + w / 2, y + h / 2, w, h, 0x111826, 0.92).setStrokeStyle(2, COLORS.border),
    );
  }

  private buildBriefing(): void {
    const run = this.run;
    const wave = config.waves[run.wave_index]!;
    const rng = mulberry32(run.seed + run.wave_index * 7919);
    const direction = resolveDirection(wave, rng);
    this.registry.set('direction', direction);

    this.panel(PANEL_LEFT, PANEL_TOP, LEFT_W, PANEL_BOTTOM - PANEL_TOP);
    const cx = PANEL_LEFT + LEFT_W / 2;
    const top = PANEL_TOP + 24;

    this.ui.add(
      this.add
        .text(cx, top + 10, `第 ${run.wave_index + 1} 波 / 共 ${config.waves.length} 波`, {
          ...TEXT_STYLE,
          fontSize: '30px',
          fontStyle: 'bold',
        })
        .setOrigin(0.5),
    );

    this.ui.add(
      this.add
        .text(cx, top + 62, `来袭方向：${DIRECTION_LABEL[direction]}`, {
          ...TEXT_STYLE,
          fontSize: '24px',
          color: COLORS.accent,
        })
        .setOrigin(0.5),
    );

    const lines = wave.groups.map((g) => `${config.enemies[g.enemy]!.name} × ${g.count}`);
    this.ui.add(
      this.add
        .text(cx, top + 104, lines.join('    '), {
          ...TEXT_STYLE,
          fontSize: '18px',
          color: COLORS.dim,
        })
        .setOrigin(0.5),
    );

    const hpPct = run.hp / run.max_hp;
    this.ui.add(
      this.add
        .text(cx, top + 146, `生命 ${Math.ceil(run.hp)} / ${run.max_hp}`, {
          ...TEXT_STYLE,
          fontSize: '18px',
          color: hpPct < 0.35 ? COLORS.danger : COLORS.text,
        })
        .setOrigin(0.5),
    );

    this.ui.add(
      this.add
        .text(cx, top + 182, `经济 ${run.economy}    精粹 ${run.essence}    等级 Lv.${run.level}`, {
          ...TEXT_STYLE,
          fontSize: '17px',
          color: COLORS.dim,
        })
        .setOrigin(0.5),
    );

    if (run.equipment.length > 0) {
      const names = run.equipment
        .map((id) => config.items.find((i) => i.id === id)?.name ?? id)
        .join('、');
      this.ui.add(
        this.add
          .text(cx, top + 212, `装备（${run.equipment.length}/${MAX_EQUIPMENT}）：${names}`, {
            ...TEXT_STYLE,
            fontSize: '15px',
            color: COLORS.gold,
          })
          .setOrigin(0.5),
      );
    }

    const btnY = PANEL_BOTTOM - 74;
    const btn = this.add
      .rectangle(cx, btnY, 260, 58, 0x1b2a3f)
      .setStrokeStyle(2, COLORS.accent_line)
      .setInteractive({ useHandCursor: true });
    btn.on('pointerover', () => btn.setFillStyle(0x24384f));
    btn.on('pointerout', () => btn.setFillStyle(0x1b2a3f));
    btn.on('pointerdown', () => this.start());
    this.ui.add(btn);

    const label = this.add
      .text(cx, btnY, '开始战斗', { ...TEXT_STYLE, fontSize: '24px', color: COLORS.accent })
      .setOrigin(0.5);
    this.ui.add(label);

    this.tweens.add({ targets: label, alpha: 0.55, duration: 900, yoyo: true, repeat: -1 });

    this.ui.add(
      this.add
        .text(cx, PANEL_BOTTOM - 128, 'WASD / 方向键移动 · 拖动屏幕也可移动 · 自动射击', {
          ...TEXT_STYLE,
          fontSize: '15px',
          color: COLORS.dim,
        })
        .setOrigin(0.5),
    );

    if (!this.input.keyboard?.listenerCount('keydown-SPACE')) {
      this.input.keyboard?.once('keydown-SPACE', () => this.start());
      this.input.keyboard?.once('keydown-ENTER', () => this.start());
    }
  }

  private buildEvolutionPanel(): void {
    const x = PANEL_RIGHT;
    const y = PANEL_TOP;
    const h = 268;
    this.panel(x, y, RIGHT_W, h);
    const cx = x + RIGHT_W / 2;

    this.ui.add(
      this.add.text(x + 20, y + 18, '英雄进化', {
        ...TEXT_STYLE,
        fontSize: '22px',
        fontStyle: 'bold',
      }),
    );

    const stage = nextStage(config.evolutions, this.run.evolutions);
    const chosenNames = this.run.evolutions
      .map((id) => findOptionName(id))
      .filter(Boolean)
      .join(' → ');

    this.ui.add(
      this.add.text(x + RIGHT_W - 20, y + 22, `精粹 ${this.run.essence}`, {
        ...TEXT_STYLE,
        fontSize: '17px',
        color: COLORS.gold,
      }).setOrigin(1, 0),
    );

    this.ui.add(
      this.add.text(x + 20, y + 56, stage ? `阶段 ${stage.stage} / ${config.evolutions.length}` : '已完成全部进化', {
        ...TEXT_STYLE,
        fontSize: '16px',
        color: COLORS.dim,
      }),
    );

    if (chosenNames) {
      this.ui.add(
        this.add.text(x + 20, y + 82, `已选方向：${chosenNames}`, {
          ...TEXT_STYLE,
          fontSize: '15px',
          color: COLORS.accent,
        }),
      );
    }

    if (stage) {
      const cost = stage.cost;
      const afford = this.run.essence >= cost;
      const btn = this.add
        .rectangle(cx, y + h - 70, 320, 52, 0x1b2a3f)
        .setStrokeStyle(2, afford ? COLORS.accent_line : 0x334155)
        .setInteractive({ useHandCursor: afford });
      if (afford) {
        btn.on('pointerdown', () => this.openEvolutionModal(stage));
        btn.on('pointerover', () => btn.setFillStyle(0x24384f));
        btn.on('pointerout', () => btn.setFillStyle(0x1b2a3f));
      }
      this.ui.add(btn);
      this.ui.add(
        this.add
          .text(cx, y + h - 70, afford ? `进化（${cost} 精粹）· 三选一` : `还需要 ${cost - this.run.essence} 精粹`, {
            ...TEXT_STYLE,
            fontSize: '18px',
            color: afford ? COLORS.accent : COLORS.dim,
          })
          .setOrigin(0.5),
      );
      this.ui.add(
        this.add
          .text(cx, y + h - 28, '每个阶段从三个方向里选一个，选定后不可更改', {
            ...TEXT_STYLE,
            fontSize: '13px',
            color: COLORS.dim,
          })
          .setOrigin(0.5),
      );
    }
  }

  private buildShopPanel(): void {
    const x = PANEL_RIGHT;
    const y = PANEL_TOP + 284;
    const h = PANEL_BOTTOM - y;
    this.panel(x, y, RIGHT_W, h);

    this.ui.add(
      this.add.text(x + 20, y + 16, '商店', { ...TEXT_STYLE, fontSize: '22px', fontStyle: 'bold' }),
    );
    this.ui.add(
      this.add
        .text(x + RIGHT_W - 20, y + 20, `经济 ${this.run.economy}`, {
          ...TEXT_STYLE,
          fontSize: '17px',
          color: COLORS.gold,
        })
        .setOrigin(1, 0),
    );

    this.run.shop_offers.forEach((id, i) => {
      const item = config.items.find((it) => it.id === id);
      if (!item) return;
      this.shopRow(item, x + 16, y + 56 + i * 82, RIGHT_W - 32, 72);
    });

    this.ui.add(
      this.add.text(x + 20, y + h - 30, `装备上限 ${MAX_EQUIPMENT} 件 · 消耗品立即生效 · 每波刷新`, {
        ...TEXT_STYLE,
        fontSize: '13px',
        color: COLORS.dim,
      }),
    );
  }

  private shopRow(item: ItemDef, x: number, y: number, w: number, h: number): void {
    const affordable = this.run.economy >= item.price;
    const slotsFull = item.kind === 'equipment' && this.run.equipment.length >= MAX_EQUIPMENT;
    const usable = affordable && !slotsFull;

    const box = this.add
      .rectangle(x + w / 2, y + h / 2, w, h, 0x0f1724)
      .setStrokeStyle(1, usable ? 0x2c3f57 : 0x232c38)
      .setInteractive({ useHandCursor: usable });
    if (usable) {
      box.on('pointerdown', () => this.purchase(item));
      box.on('pointerover', () => box.setFillStyle(0x16233a));
      box.on('pointerout', () => box.setFillStyle(0x0f1724));
    }
    this.ui.add(box);

    this.ui.add(
      this.add.text(x + 14, y + 12, item.name, {
        ...TEXT_STYLE,
        fontSize: '18px',
        color: usable ? COLORS.text : COLORS.dim,
      }),
    );
    this.ui.add(
      this.add.text(x + 14, y + 40, item.desc, {
        ...TEXT_STYLE,
        fontSize: '13px',
        color: COLORS.dim,
      }),
    );

    const tag = item.kind === 'equipment' ? '装备' : '消耗品';
    const priceLabel = slotsFull ? '装备已满' : `${item.price} 经济`;
    this.ui.add(
      this.add
        .text(x + w - 14, y + 14, priceLabel, {
          ...TEXT_STYLE,
          fontSize: '16px',
          color: usable ? COLORS.gold : COLORS.dim,
        })
        .setOrigin(1, 0),
    );
    this.ui.add(
      this.add
        .text(x + w - 14, y + 40, tag, { ...TEXT_STYLE, fontSize: '13px', color: COLORS.dim })
        .setOrigin(1, 0),
    );
  }

  private purchase(item: ItemDef): void {
    const result = buyItem(item, this.run);
    if (result !== 'ok') return;
    this.run.shop_offers = this.run.shop_offers.filter((id) => id !== item.id);
    this.build();
  }

  // ---------------------------------------------------------------- evolution modal

  private openEvolutionModal(stage: EvolutionStage): void {
    if (this.modal) return;
    const { width, height } = this.scale;
    const modal = this.add.container(0, 0).setDepth(50);
    this.modal = modal;

    modal.add(this.add.rectangle(0, 0, width, height, 0x05080d, 0.82).setOrigin(0).setInteractive());

    modal.add(
      this.add
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
      const box = this.add
        .rectangle(cx, cy, cardW, cardH, 0x111a28)
        .setStrokeStyle(2, 0x3b4c63)
        .setInteractive({ useHandCursor: true });
      box.on('pointerover', () => box.setFillStyle(0x1a2739));
      box.on('pointerout', () => box.setFillStyle(0x111a28));
      box.on('pointerdown', () => this.pickEvolution(option.id));
      modal.add(box);

      modal.add(
        this.add
          .text(cx, cy - 100, option.name, {
            ...TEXT_STYLE,
            fontSize: '26px',
            fontStyle: 'bold',
          })
          .setOrigin(0.5),
      );
      modal.add(
        this.add
          .text(cx, cy + 10, wrap(option.desc, 14), {
            ...TEXT_STYLE,
            fontSize: '16px',
            color: COLORS.text,
            align: 'center',
            lineSpacing: 6,
          })
          .setOrigin(0.5),
      );
    });

    const cancel = this.add
      .rectangle(width / 2, 600, 200, 48, 0x16202f)
      .setStrokeStyle(2, 0x334155)
      .setInteractive({ useHandCursor: true });
    cancel.on('pointerdown', () => this.closeModal());
    modal.add(cancel);
    modal.add(
      this.add.text(width / 2, 600, '取消', { ...TEXT_STYLE, fontSize: '18px', color: COLORS.dim }).setOrigin(0.5),
    );
  }

  private pickEvolution(optionId: string): void {
    if (!chooseEvolution(this.run, config.evolutions, optionId)) return;
    this.closeModal();
    this.build();
  }

  private closeModal(): void {
    this.modal?.destroy(true);
    this.modal = null;
  }

  private start(): void {
    if (this.starting) return;
    this.starting = true;
    // 下一波重新进货（每波刷新商品）
    this.run.shop_offers = [];
    this.cameras.main.fadeOut(180, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('Battle');
    });
  }
}

function findOptionName(id: string): string {
  for (const stage of config.evolutions) {
    const option = stage.options.find((o) => o.id === id);
    if (option) return option.name;
  }
  return '';
}

function wrap(text: string, perLine: number): string {
  const lines: string[] = [];
  for (let i = 0; i < text.length; i += perLine) lines.push(text.slice(i, i + perLine));
  return lines.join('\n');
}
