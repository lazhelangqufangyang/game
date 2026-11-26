import Phaser from 'phaser';

/**
 * 菜单/结算场景的背景：复用战斗那张「夜色遗迹」插画，压暗一层让文字可读。
 * 深度全部为负，场景里默认 depth 0 的面板和文字自然浮在它上面。
 */
export function addMenuBackdrop(scene: Phaser.Scene, width: number, height: number): void {
  const arenaKey = (scene.registry.get('arenaKey') as string | undefined) ?? 'arena';

  scene.add.rectangle(0, 0, width, height, 0x060810).setOrigin(0).setDepth(-20);
  if (scene.textures.exists(arenaKey)) {
    scene.add
      .image(0, 0, arenaKey)
      .setOrigin(0)
      .setDisplaySize(width, height)
      .setDepth(-15);
  }
  scene.add.rectangle(0, 0, width, height, 0x05070d, 0.66).setOrigin(0).setDepth(-10);
  if (scene.textures.exists('vignette')) {
    scene.add.image(0, 0, 'vignette').setOrigin(0).setDisplaySize(width, height).setDepth(-5);
  }
}
