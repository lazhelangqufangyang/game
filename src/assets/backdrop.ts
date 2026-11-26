import Phaser from 'phaser';

/**
 * 菜单/结算场景的背景：与战斗场景同一套地砖 + 暗角，只额外压一层暗色让文字更好读。
 * 深度全部为负，场景里默认 depth 0 的面板和文字自然浮在它上面。
 */
export function addMenuBackdrop(scene: Phaser.Scene, width: number, height: number): void {
  scene.add.rectangle(0, 0, width, height, 0x0b0e14).setOrigin(0).setDepth(-20);
  scene.add.tileSprite(0, 0, width, height, 'floor-b').setOrigin(0).setTileScale(2).setDepth(-10);
  scene.add.rectangle(0, 0, width, height, 0x0b0e14, 0.6).setOrigin(0).setDepth(-5);
  scene.add.image(0, 0, 'vignette').setOrigin(0).setDisplaySize(width, height).setDepth(-1);
}
