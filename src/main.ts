import Phaser from 'phaser';
import { config } from './config';
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

// 便于自动化冒烟测试读取运行时状态（仅调试用）。
const debugWindow = window as unknown as { __game?: Phaser.Game; __config?: unknown };
debugWindow.__game = game;
debugWindow.__config = config;
