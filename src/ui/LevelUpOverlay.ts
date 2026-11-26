import Phaser from 'phaser';
import type { PassiveDef } from '../core/types';
import { COLORS, FONT, TEXT_STYLE } from './style';

const CARD_W = 250;
const CARD_H = 300;
const RARITY_COLOR = { common: 0x64748b, rare: 0xffd166 } as const;
const RARITY_LABEL = { common: '普通', rare: '稀有' } as const;
const ELEMENT_LABEL = { fire: '火', thunder: '雷', water: '水', ice: '冰', wind: '风' } as const;

export interface LevelUpCtx {
  level: number;
  candidates: PassiveDef[];
  slots: ReadonlyArray<PassiveDef | null>;
  refresh_cost: number;
  economy: number;
  onPick: (passive: PassiveDef) => void;
  onReplace: (slot: number, passive: PassiveDef) => void;
  onRefresh: () => PassiveDef[] | null;
  /** 能否直接拿走：有空位，或这个被动会被羁绊吸收（不占格）。 */
  canTake: (passive: PassiveDef) => boolean;
}

/** 升级三选一：不能跳过；满 8 格时必须先选一个放弃（二次确认）；每级可花经济刷新一次。 */
export class LevelUpOverlay {
  private readonly root: Phaser.GameObjects.Container;
  private candidates: PassiveDef[];
  private refreshed = false;
  private economy: number;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly ctx: LevelUpCtx,
  ) {
    this.candidates = ctx.candidates.slice();
    this.economy = ctx.economy;
    this.root = scene.add.container(0, 0).setDepth(100);
    this.renderChoice();
  }

  destroy(): void {
    this.root.destroy(true);
  }

  // ---------------------------------------------------------------- views

  private reset(): void {
    this.root.removeAll(true);
  }

  private backdrop(): void {
    const { width, height } = this.scene.scale;
    this.root.add(
      this.scene.add.rectangle(0, 0, width, height, 0x05080d, 0.82).setOrigin(0),
    );
  }

  private renderChoice(): void {
    this.reset();
    this.backdrop();
    const { width, height } = this.scene.scale;

    this.root.add(
      this.scene.add
        .text(width / 2, height / 2 - 218, `升级！Lv.${this.ctx.level}`, {
          ...TEXT_STYLE,
          fontSize: '34px',
          fontStyle: 'bold',
          color: COLORS.accent,
        })
        .setOrigin(0.5),
    );
    this.root.add(
      this.scene.add
        .text(width / 2, height / 2 - 176, '选择一个被动（被动槽 8 格，满了要放弃一个）', {
          ...TEXT_STYLE,
          fontSize: '15px',
          color: COLORS.dim,
        })
        .setOrigin(0.5),
    );

    const totalW = this.candidates.length * CARD_W + (this.candidates.length - 1) * 28;
    this.candidates.forEach((passive, i) => {
      const x = width / 2 - totalW / 2 + i * (CARD_W + 28) + CARD_W / 2;
      this.card(passive, x, height / 2 - 10, () => this.choose(passive));
    });

    this.refreshButton(width / 2, height / 2 + 178);
  }

  private card(passive: PassiveDef, cx: number, cy: number, onClick: () => void): void {
    const border = RARITY_COLOR[passive.rarity];
    const bg = this.scene.add
      .rectangle(cx, cy, CARD_W, CARD_H, 0x111a28)
      .setStrokeStyle(2, border)
      .setInteractive({ useHandCursor: true });

    bg.on('pointerover', () => bg.setFillStyle(0x1a2739));
    bg.on('pointerout', () => bg.setFillStyle(0x111a28));
    bg.on('pointerdown', onClick);
    this.root.add(bg);

    this.root.add(
      this.scene.add
        .text(cx, cy - CARD_H / 2 + 18, RARITY_LABEL[passive.rarity], {
          ...TEXT_STYLE,
          fontSize: '13px',
          color: passive.rarity === 'rare' ? COLORS.gold : COLORS.dim,
        })
        .setOrigin(0.5),
    );

    this.root.add(
      this.scene.add
        .text(cx, cy - CARD_H / 2 + 58, passive.name, {
          ...TEXT_STYLE,
          fontSize: '28px',
          fontStyle: 'bold',
          color: COLORS.text,
        })
        .setOrigin(0.5),
    );

    const element = passive.element ? `元素：${ELEMENT_LABEL[passive.element]}` : '无元素';
    this.root.add(
      this.scene.add
        .text(cx, cy - 30, element, {
          ...TEXT_STYLE,
          fontSize: '14px',
          color: passive.element ? COLORS.accent : COLORS.dim,
        })
        .setOrigin(0.5),
    );

    this.root.add(
      this.scene.add
        .text(cx, cy + 40, wrapCJK(passive.desc, 11), {
          ...TEXT_STYLE,
          fontSize: '16px',
          color: COLORS.text,
          align: 'center',
          lineSpacing: 6,
        })
        .setOrigin(0.5),
    );
  }

  private refreshButton(cx: number, cy: number): void {
    const cost = this.ctx.refresh_cost;
    const usable = !this.refreshed && this.economy >= cost;
    const label = this.refreshed
      ? '本回合已刷新'
      : this.economy >= cost
        ? `刷新（${cost} 经济）`
        : `刷新需要 ${cost} 经济`;

    const btn = this.scene.add
      .rectangle(cx, cy, 240, 46, 0x16202f)
      .setStrokeStyle(2, usable ? COLORS.accent_line : 0x334155)
      .setInteractive({ useHandCursor: usable });

    if (usable) {
      btn.on('pointerdown', () => this.doRefresh());
      btn.on('pointerover', () => btn.setFillStyle(0x1e2c3f));
      btn.on('pointerout', () => btn.setFillStyle(0x16202f));
    }

    this.root.add(btn);
    this.root.add(
      this.scene.add
        .text(cx, cy, label, {
          ...TEXT_STYLE,
          fontSize: '17px',
          color: usable ? COLORS.accent : COLORS.dim,
        })
        .setOrigin(0.5),
    );
    this.root.add(
      this.scene.add
        .text(cx, cy + 44, `当前经济 ${this.economy}`, {
          ...TEXT_STYLE,
          fontSize: '13px',
          color: COLORS.dim,
        })
        .setOrigin(0.5),
    );
  }

  private choose(passive: PassiveDef): void {
    if (this.ctx.canTake(passive)) this.ctx.onPick(passive);
    else this.renderDiscard(passive);
  }

  private renderDiscard(pending: PassiveDef): void {
    this.reset();
    this.backdrop();
    const { width, height } = this.scene.scale;

    this.root.add(
      this.scene.add
        .text(width / 2, 56, '被动已满：选择一个放弃', {
          ...TEXT_STYLE,
          fontSize: '28px',
          fontStyle: 'bold',
          color: COLORS.danger,
        })
        .setOrigin(0.5),
    );
    this.root.add(
      this.scene.add
        .text(width / 2, 94, `即将获得「${pending.name}」 · 放弃是永久的，不可撤销`, {
          ...TEXT_STYLE,
          fontSize: '15px',
          color: COLORS.dim,
        })
        .setOrigin(0.5),
    );

    const slotW = 270;
    const slotH = 84;
    const gap = 16;
    const cols = 4;
    const startX = width / 2 - (cols * slotW + (cols - 1) * gap) / 2 + slotW / 2;
    const startY = 190;

    this.ctx.slots.forEach((slot, i) => {
      if (!slot) return;
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * (slotW + gap);
      const y = startY + row * (slotH + gap);

      const box = this.scene.add
        .rectangle(x, y, slotW, slotH, 0x111a28)
        .setStrokeStyle(2, RARITY_COLOR[slot.rarity])
        .setInteractive({ useHandCursor: true });
      box.on('pointerover', () => box.setFillStyle(0x1a2739));
      box.on('pointerout', () => box.setFillStyle(0x111a28));
      box.on('pointerdown', () => this.renderConfirm(i, slot, pending));
      this.root.add(box);

      this.root.add(
        this.scene.add
          .text(x - slotW / 2 + 14, y - 16, slot.name, {
            ...TEXT_STYLE,
            fontSize: '19px',
            color: COLORS.text,
          })
          .setOrigin(0, 0.5),
      );
      this.root.add(
        this.scene.add
          .text(x - slotW / 2 + 14, y + 14, wrapCJK(slot.desc, 13), {
            ...TEXT_STYLE,
            fontSize: '13px',
            color: COLORS.dim,
          })
          .setOrigin(0, 0.5),
      );
    });

    this.cancelButton('返回三选一', width / 2, height - 70, () => this.renderChoice());
  }

  private renderConfirm(slotIndex: number, slot: PassiveDef, pending: PassiveDef): void {
    this.reset();
    this.backdrop();
    const { width, height } = this.scene.scale;

    this.root.add(
      this.scene.add
        .text(width / 2, height / 2 - 120, '确认交换？', {
          ...TEXT_STYLE,
          fontSize: '30px',
          fontStyle: 'bold',
        })
        .setOrigin(0.5),
    );
    this.root.add(
      this.scene.add
        .text(
          width / 2,
          height / 2 - 40,
          `放弃「${slot.name}」（${slot.desc}）\n换取「${pending.name}」（${pending.desc}）`,
          {
            ...TEXT_STYLE,
            fontSize: '19px',
            color: COLORS.text,
            align: 'center',
            lineSpacing: 12,
          },
        )
        .setOrigin(0.5),
    );

    this.actionButton('确认放弃', width / 2 - 130, height / 2 + 90, COLORS.danger_line, () =>
      this.ctx.onReplace(slotIndex, pending),
    );
    this.cancelButton('返回', width / 2 + 130, height / 2 + 90, () => this.renderDiscard(pending));
  }

  private actionButton(
    label: string,
    cx: number,
    cy: number,
    border: number,
    onClick: () => void,
  ): void {
    const btn = this.scene.add
      .rectangle(cx, cy, 220, 54, 0x1b2a3f)
      .setStrokeStyle(2, border)
      .setInteractive({ useHandCursor: true });
    btn.on('pointerdown', onClick);
    this.root.add(btn);
    this.root.add(
      this.scene.add.text(cx, cy, label, { ...TEXT_STYLE, fontSize: '20px' }).setOrigin(0.5),
    );
  }

  private cancelButton(label: string, cx: number, cy: number, onClick: () => void): void {
    const btn = this.scene.add
      .rectangle(cx, cy, 180, 46, 0x16202f)
      .setStrokeStyle(2, 0x334155)
      .setInteractive({ useHandCursor: true });
    btn.on('pointerdown', onClick);
    this.root.add(btn);
    this.root.add(
      this.scene.add
        .text(cx, cy, label, { ...TEXT_STYLE, fontSize: '17px', color: COLORS.dim })
        .setOrigin(0.5),
    );
  }

  // ---------------------------------------------------------------- refresh

  private doRefresh(): void {
    const next = this.ctx.onRefresh();
    if (!next) {
      this.flashRefreshDenied();
      return;
    }
    this.refreshed = true;
    this.economy -= this.ctx.refresh_cost;
    this.candidates = next;
    this.renderChoice();
  }

  private flashRefreshDenied(): void {
    const { width, height } = this.scene.scale;
    const tip = this.scene.add
      .text(width / 2, height / 2 + 232, '经济不足', {
        fontFamily: FONT,
        fontSize: '16px',
        color: COLORS.danger,
      })
      .setOrigin(0.5);
    this.root.add(tip);
    this.scene.tweens.add({
      targets: tip,
      alpha: 0,
      delay: 600,
      duration: 400,
      onComplete: () => tip.destroy(),
    });
  }
}

/** 中文按字数强行换行（Phaser 的 wordWrap 对无空格文本无效）。 */
export function wrapCJK(text: string, perLine: number): string {
  if (text.length <= perLine) return text;
  const lines: string[] = [];
  for (let i = 0; i < text.length; i += perLine) lines.push(text.slice(i, i + perLine));
  return lines.join('\n');
}
