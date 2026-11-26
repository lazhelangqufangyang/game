import Phaser from 'phaser';
import { addMenuBackdrop } from '../assets/backdrop';
import { config } from '../config';
import { mulberry32 } from '../core/rng';
import { createRun } from '../core/run';
import { clearRun, saveRun } from '../core/save';
import { sfx } from '../core/sfx';
import type { EvolutionStage, ItemDef, RunState } from '../core/types';
import {
  MAX_SLOTS,
  buyItem,
  chooseEvolution,
  findItem,
  nextStage,
  recipeStatus,
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

const EVO_H = 230;
const SHOP_TOP = PANEL_TOP + EVO_H + 12;

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
      this.run.shop_offers = rollShop(config.items, rng, 4);
    }

    this.ui = this.add.container(0, 0);
    this.build();
    saveRun(this.run);

    if (this.registry.get('resumed')) {
      this.add
        .text(width / 2, 22, '已恢复上次进度（刷新页面不会丢）', {
          ...TEXT_STYLE,
          fontSize: '14px',
          color: COLORS.accent,
        })
        .setOrigin(0.5, 0)
        .setDepth(5);
      this.registry.set('resumed', false);
    }

    this.add
      .text(24, 22, '重开一局（清空存档）', { ...TEXT_STYLE, fontSize: '14px', color: COLORS.dim })
      .setInteractive({ useHandCursor: true })
      .setDepth(5)
      .on('pointerdown', () => this.restartRun());
  }

  private restartRun(): void {
    clearRun();
    this.registry.set('run', createRun(config.hero));
    this.registry.set('resumed', false);
    this.scene.restart();
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
        .text(cx, top + 12, `第 ${run.wave_index + 1} 波 / 共 ${config.waves.length} 波`, {
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
        .text(cx, top + 102, lines.join('    '), {
          ...TEXT_STYLE,
          fontSize: '17px',
          color: COLORS.dim,
        })
        .setOrigin(0.5),
    );

    const hpPct = run.hp / run.max_hp;
    this.ui.add(
      this.add
        .text(cx, top + 140, `生命 ${Math.ceil(run.hp)} / ${run.max_hp}`, {
          ...TEXT_STYLE,
          fontSize: '18px',
          color: hpPct < 0.35 ? COLORS.danger : COLORS.text,
        })
        .setOrigin(0.5),
    );

    this.ui.add(
      this.add
        .text(cx, top + 174, `经济 ${run.economy}    精粹 ${run.essence}    等级 Lv.${run.level}`, {
          ...TEXT_STYLE,
          fontSize: '17px',
          color: COLORS.dim,
        })
        .setOrigin(0.5),
    );

    // 装备：所有装备都占格
    const eqNames = run.items
      .map((id) => findItem(config.items, id)?.name ?? id)
      .join('、');
    this.ui.add(
      this.add
        .text(cx, top + 212, `装备 ${run.items.length}/${MAX_SLOTS}：${eqNames || '无'}`, {
          ...TEXT_STYLE,
          fontSize: '15px',
          color: run.items.length >= MAX_SLOTS ? COLORS.danger : COLORS.gold,
        })
        .setOrigin(0.5),
    );

    // 合成进度提示
    const readyCount = config.items.filter((item) => {
      if (!item.recipe) return false;
      const status = recipeStatus(item, run.items);
      return status.ok;
    }).length;
    this.ui.add(
      this.add
        .text(cx, top + 244, `可合成：${readyCount} 件（组件会被消耗，腾出格子）`, {
          ...TEXT_STYLE,
          fontSize: '14px',
          color: readyCount > 0 ? COLORS.accent : COLORS.dim,
        })
        .setOrigin(0.5),
    );

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
    const h = EVO_H;
    this.panel(x, y, RIGHT_W, h);
    const cx = x + RIGHT_W / 2;

    this.ui.add(
      this.add.text(x + 20, y + 16, '英雄进化', {
        ...TEXT_STYLE,
        fontSize: '21px',
        fontStyle: 'bold',
      }),
    );

    const stage = nextStage(config.evolutions, this.run.evolutions);
    const chosenNames = this.run.evolutions
      .map((id) => findOptionName(id))
      .filter(Boolean)
      .join(' → ');

    this.ui.add(
      this.add
        .text(x + RIGHT_W - 20, y + 20, `精粹 ${this.run.essence}`, {
          ...TEXT_STYLE,
          fontSize: '16px',
          color: COLORS.gold,
        })
        .setOrigin(1, 0),
    );

    this.ui.add(
      this.add.text(
        x + 20,
        y + 50,
        stage ? `阶段 ${stage.stage} / ${config.evolutions.length}` : '已完成全部进化',
        { ...TEXT_STYLE, fontSize: '15px', color: COLORS.dim },
      ),
    );

    if (chosenNames) {
      this.ui.add(
        this.add.text(x + RIGHT_W - 20, y + 50, `已选：${chosenNames}`, {
          ...TEXT_STYLE,
          fontSize: '14px',
          color: COLORS.accent,
        }).setOrigin(1, 0),
      );
    }

    if (stage) {
      const afford = this.run.essence >= stage.cost;
      const btn = this.add
        .rectangle(cx, y + h - 62, 340, 48, 0x1b2a3f)
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
          .text(
            cx,
            y + h - 62,
            afford ? `进化（${stage.cost} 精粹）· 三选一` : `还需要 ${stage.cost - this.run.essence} 精粹`,
            { ...TEXT_STYLE, fontSize: '18px', color: afford ? COLORS.accent : COLORS.dim },
          )
          .setOrigin(0.5),
      );
      this.ui.add(
        this.add
          .text(cx, y + h - 26, '每个阶段从三个方向里选一个，选定后不可更改', {
            ...TEXT_STYLE,
            fontSize: '12px',
            color: COLORS.dim,
          })
          .setOrigin(0.5),
      );
    }
  }

  private buildShopPanel(): void {
    const x = PANEL_RIGHT;
    const y = SHOP_TOP;
    const h = PANEL_BOTTOM - y;
    this.panel(x, y, RIGHT_W, h);

    this.ui.add(
      this.add.text(x + 18, y + 12, '商店', { ...TEXT_STYLE, fontSize: '21px', fontStyle: 'bold' }),
    );
    this.ui.add(
      this.add
        .text(x + RIGHT_W - 18, y + 16, `经济 ${this.run.economy}`, {
          ...TEXT_STYLE,
          fontSize: '16px',
          color: COLORS.gold,
        })
        .setOrigin(1, 0),
    );

    const cellW = 282;
    const cellH = 128;
    const gapX = 12;
    const gapY = 10;
    this.run.shop_offers.forEach((id, index) => {
      const item = findItem(config.items, id);
      if (!item) return;
      const col = index % 2;
      const row = Math.floor(index / 2);
      const cellX = x + 18 + col * (cellW + gapX);
      const cellY = y + 52 + row * (cellH + gapY);
      this.shopCell(item, cellX, cellY, cellW, cellH);
    });

    this.ui.add(
      this.add.text(
        x + 18,
        y + h - 26,
        `每件装备都占 1 格（${MAX_SLOTS} 格）· 两个小件合中件、中件+小件合大件 · 每波刷新`,
        { ...TEXT_STYLE, fontSize: '12px', color: COLORS.dim },
      ),
    );
  }

  private shopCell(item: ItemDef, x: number, y: number, w: number, h: number): void {
    const recipe = item.recipe ? recipeStatus(item, this.run.items) : { ok: true, missing: [] };
    const slotsFull = !item.recipe && this.run.items.length >= MAX_SLOTS;
    const affordable = this.run.economy >= item.price;
    const usable = affordable && recipe.ok && !slotsFull;

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

    const kindTag =
      item.kind === 'consumable'
        ? '消耗品'
        : item.recipe
          ? item.tier === 2
            ? '中件 · 合成'
            : '大件 · 合成'
          : '小件';

    this.ui.add(
      this.add.text(x + 12, y + 10, item.name, {
        ...TEXT_STYLE,
        fontSize: '17px',
        color: usable ? COLORS.text : COLORS.dim,
      }),
    );
    this.ui.add(
      this.add
        .text(x + w - 12, y + 12, `${item.price} 经济`, {
          ...TEXT_STYLE,
          fontSize: '14px',
          color: usable ? COLORS.gold : COLORS.dim,
        })
        .setOrigin(1, 0),
    );
    this.ui.add(
      this.add
        .text(x + w - 12, y + 32, slotsFull ? '装备已满' : kindTag, {
          ...TEXT_STYLE,
          fontSize: '11px',
          color: slotsFull ? COLORS.danger : COLORS.dim,
        })
        .setOrigin(1, 0),
    );

    this.ui.add(
      this.add.text(x + 12, y + 38, wrap(item.desc, 20), {
        ...TEXT_STYLE,
        fontSize: '12px',
        color: COLORS.dim,
        lineSpacing: 2,
      }),
    );

    if (item.recipe) {
      const names = item.recipe.map((id) => findItem(config.items, id)?.name ?? id).join(' + ');
      this.ui.add(
        this.add.text(x + 12, y + h - 22, `合成：${names}${recipe.ok ? ' ✓' : ' ✗'}`, {
          ...TEXT_STYLE,
          fontSize: '12px',
          color: recipe.ok ? COLORS.accent : COLORS.dim,
        }),
      );
    } else if (item.kind === 'consumable') {
      this.ui.add(
        this.add.text(x + 12, y + h - 22, '购买后立即生效', {
          ...TEXT_STYLE,
          fontSize: '12px',
          color: COLORS.dim,
        }),
      );
    }
  }

  private purchase(item: ItemDef): void {
    const result = buyItem(item, this.run);
    if (result === 'poor') return;
    if (result === 'slots') {
      this.flashHint('装备已满：先合成更少而精的成品');
      return;
    }
    if (result === 'recipe') {
      this.flashHint('缺少合成组件');
      return;
    }

    sfx.play('buy');
    this.run.shop_offers = this.run.shop_offers.filter((id) => id !== item.id);
    saveRun(this.run);
    this.build();
  }

  private flashHint(message: string): void {
    const { width, height } = this.scale;
    const tip = this.add
      .text(width / 2, height - 30, message, {
        ...TEXT_STYLE,
        fontSize: '16px',
        color: COLORS.danger,
      })
      .setOrigin(0.5)
      .setDepth(80);
    this.tweens.add({
      targets: tip,
      alpha: 0,
      delay: 700,
      duration: 400,
      onComplete: () => tip.destroy(),
    });
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
      this.add
        .text(width / 2, 600, '取消', { ...TEXT_STYLE, fontSize: '18px', color: COLORS.dim })
        .setOrigin(0.5),
    );
  }

  private pickEvolution(optionId: string): void {
    if (!chooseEvolution(this.run, config.evolutions, optionId)) return;
    sfx.play('evolve');
    saveRun(this.run);
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
