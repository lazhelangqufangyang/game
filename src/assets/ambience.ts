import Phaser from 'phaser';
import { ARENA_H, ARENA_W, BRAZIERS, RITUAL } from './arena';

/**
 * 背景的动态层：火盆火焰 + 余烬 + 浮尘 + 薄雾 + 法阵呼吸。
 * 全部是纯表现，不参与任何玩法结算；单位数固定（4 光晕 + 3 图层 + 2 发射器）。
 */
export function addArenaAmbience(scene: Phaser.Scene, baseDepth = 0.1): void {
  addBrazierFlames(scene, baseDepth);
  addRitualGlow(scene, baseDepth);
  addMist(scene, baseDepth - 0.05);
  addMotes(scene, baseDepth + 0.05);
}

function addBrazierFlames(scene: Phaser.Scene, depth: number): void {
  for (const [index, b] of BRAZIERS.entries()) {
    // 光晕（ADD 叠加，随时间轻微呼吸）
    const glow = scene.add
      .image(b.x, b.y - 6, 'glow-warm')
      .setDepth(depth)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setScale(1.5)
      .setAlpha(0.5);

    scene.tweens.add({
      targets: glow,
      alpha: { from: 0.38, to: 0.62 },
      scale: { from: 1.4, to: 1.6 },
      duration: 620 + index * 90,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
      delay: index * 130,
    });

    // 火焰与余烬
    scene.add
      .particles(b.x, b.y - 8, 'mote', {
        speedY: { min: -78, max: -34 },
        speedX: { min: -16, max: 16 },
        scale: { start: 0.85, end: 0.05 },
        alpha: { start: 0.85, end: 0 },
        lifespan: { min: 480, max: 1150 },
        frequency: 48,
        quantity: 1,
        blendMode: Phaser.BlendModes.ADD,
        tint: [0xffe2a8, 0xffb05a, 0xff7a33],
      })
      .setDepth(depth + 0.02);

    // 偶发火星，飘得更远
    scene.add
      .particles(b.x, b.y - 10, 'mote', {
        speedY: { min: -120, max: -60 },
        speedX: { min: -34, max: 34 },
        scale: { start: 0.5, end: 0 },
        alpha: { start: 1, end: 0 },
        lifespan: { min: 900, max: 1800 },
        frequency: 620,
        quantity: 1,
        blendMode: Phaser.BlendModes.ADD,
        tint: 0xffcf7a,
      })
      .setDepth(depth + 0.03);
  }
}

function addRitualGlow(scene: Phaser.Scene, depth: number): void {
  const glow = scene.add
    .image(RITUAL.x, RITUAL.y, 'glow-warm')
    .setDepth(depth)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setTint(0x4fd8e8)
    .setScale(2.1)
    .setAlpha(0.1);

  scene.tweens.add({
    targets: glow,
    alpha: { from: 0.07, to: 0.16 },
    duration: 2400,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });
}

function addMist(scene: Phaser.Scene, depth: number): void {
  // 两层反向缓慢漂移的薄雾，让静止的背景"活"起来
  const layers: Array<{ y: number; alpha: number; speed: number; scale: number }> = [
    { y: 0, alpha: 0.16, speed: 26000, scale: 2.2 },
    { y: ARENA_H * 0.35, alpha: 0.1, speed: 41000, scale: 2.8 },
  ];

  for (const [i, layer] of layers.entries()) {
    const mist = scene.add
      .tileSprite(0, layer.y, ARENA_W, ARENA_H - layer.y, 'mist')
      .setOrigin(0)
      .setDepth(depth)
      .setBlendMode(Phaser.BlendModes.SCREEN)
      .setAlpha(layer.alpha)
      .setTileScale(layer.scale);

    scene.tweens.add({
      targets: mist,
      tilePositionX: i === 0 ? 512 : -512,
      duration: layer.speed,
      repeat: -1,
      ease: 'Linear',
    });
  }
}

function addMotes(scene: Phaser.Scene, depth: number): void {
  scene.add
    .particles(0, 0, 'mote', {
      x: { min: 0, max: ARENA_W },
      y: { min: 0, max: ARENA_H },
      speedY: { min: -13, max: -3 },
      speedX: { min: -7, max: 7 },
      scale: { start: 0.32, end: 0 },
      alpha: { start: 0.34, end: 0 },
      lifespan: { min: 5200, max: 9000 },
      frequency: 160,
      quantity: 1,
      blendMode: Phaser.BlendModes.ADD,
      tint: [0x9fd8ff, 0xcfe6ff, 0xffe0b0],
    })
    .setDepth(depth);
}
