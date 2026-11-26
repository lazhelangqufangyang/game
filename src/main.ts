import Phaser from 'phaser';
import { config } from './config';
import { sfx } from './core/sfx';
import { BootScene } from './scenes/BootScene';
import { PrepScene } from './scenes/PrepScene';
import { BattleScene } from './scenes/BattleScene';
import { ResultScene } from './scenes/ResultScene';

const forceCanvas = new URLSearchParams(window.location.search).get('renderer') === 'canvas';

const game = new Phaser.Game({
  type: forceCanvas ? Phaser.CANVAS : Phaser.AUTO,
  parent: 'app',
  backgroundColor: '#0b0e14',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 1280,
    height: 720,
  },
  physics: {
    default: 'arcade',
    arcade: { debug: false, gravity: { x: 0, y: 0 } },
  },
  render: { antialias: true, roundPixels: false },
  scene: [BootScene, PrepScene, BattleScene, ResultScene],
});

void game;

// 音频必须在用户首次交互后解锁（移动端自动播放策略）；M 键静音。
const unlockAudio = () => {
  sfx.unlock();
  window.removeEventListener('pointerdown', unlockAudio);
  window.removeEventListener('keydown', unlockAudio);
};
window.addEventListener('pointerdown', unlockAudio);
window.addEventListener('keydown', unlockAudio);
window.addEventListener('keydown', (event) => {
  if (event.key.toLowerCase() === 'm') {
    const muted = sfx.toggleMute();
    console.info(muted ? '[音效] 已静音' : '[音效] 已开启');
  }
});

// 便于自动化冒烟测试读取运行时状态（仅调试用）。
const debugWindow = window as unknown as { __game?: Phaser.Game; __config?: unknown };
debugWindow.__game = game;
debugWindow.__config = config;
