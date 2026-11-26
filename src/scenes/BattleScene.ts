import Phaser from 'phaser';
import { visualOf, type VisualDef } from '../assets/visuals';
import { config } from '../config';
import { RESOURCE_META, RESOURCE_ORDER, grantResource } from '../core/resources';
import { saveRun } from '../core/save';
import { sfx } from '../core/sfx';
import { mulberry32 } from '../core/rng';
import type {
  Direction,
  PassiveDef,
  ResourceKind,
  RunState,
  RunStats,
  SkillDef,
  SummonDef,
  WaveDef,
} from '../core/types';
import { BondTracker, type BondActivation } from '../systems/bonds';
import { equipmentMods, evolutionMods, evolutionPerks } from '../systems/meta';
import { PassiveBook, sumMods } from '../systems/passives';
import { computeStats, rollPassives, XpTracker } from '../systems/progression';
import { SummonSystem } from '../systems/summon';
import { DIRECTION_LABEL, WaveDirector } from '../systems/wave';
import { LevelUpOverlay } from '../ui/LevelUpOverlay';
import { PassiveBar } from '../ui/PassiveBar';
import { SkillBar } from '../ui/SkillBar';
import { SummonBar } from '../ui/SummonBar';
import { COLORS, TEXT_STYLE } from '../ui/style';

const ARENA_W = 1280;
const ARENA_H = 720;

const SKILL_KEYS = ['Q', 'W', 'E'];

export class BattleScene extends Phaser.Scene {
  private run!: RunState;
  private wave!: WaveDef;
  private direction!: Direction;
  private director!: WaveDirector;
  private summonSystem!: SummonSystem;

  private book!: PassiveBook;
  private bonds!: BondTracker;
  private xp!: XpTracker;
  private stats!: RunStats;
  private readonly skillCd = new Map<string, number>();
  private readonly offerQueue: number[] = [];
  private overlayOpen = false;
  private overlay: LevelUpOverlay | null = null;

  private player!: Phaser.Physics.Arcade.Sprite;
  private playerShadow: Phaser.GameObjects.Ellipse | null = null;
  private enemies!: Phaser.Physics.Arcade.Group;
  private summons!: Phaser.Physics.Arcade.Group;
  private bullets!: Phaser.Physics.Arcade.Group;
  private pickups!: Phaser.Physics.Arcade.Group;

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<'W' | 'A' | 'S' | 'D', Phaser.Input.Keyboard.Key>;
  private pointerActive = false;
  private pointerTarget = new Phaser.Math.Vector2();
  private lastMove = new Phaser.Math.Vector2(1, 0);

  private attackCd = 0;
  private invuln = 0;
  private waveCleared = false;
  private dead = false;
  private bossSprite: Phaser.Physics.Arcade.Sprite | null = null;
  private bossMaxHp = 0;

  private hpBar!: Phaser.GameObjects.Graphics;
  private xpBar!: Phaser.GameObjects.Graphics;
  private hpText!: Phaser.GameObjects.Text;
  private waveText!: Phaser.GameObjects.Text;
  private killText!: Phaser.GameObjects.Text;
  private bondText!: Phaser.GameObjects.Text;
  private resourceTexts!: Record<ResourceKind, Phaser.GameObjects.Text>;
  private toastText!: Phaser.GameObjects.Text;
  private summonBar!: SummonBar;
  private skillBar!: SkillBar;
  private passiveBar!: PassiveBar;

  constructor() {
    super('Battle');
  }

  create(): void {
    this.run = this.registry.get('run') as RunState;
    this.wave = config.waves[this.run.wave_index]!;
    this.direction = this.registry.get('direction') as Direction;
    this.dead = false;
    this.waveCleared = false;
    this.overlayOpen = false;
    this.attackCd = 0;
    this.invuln = 0;
    this.pointerActive = false;
    this.offerQueue.length = 0;
    this.skillCd.clear();
    this.bossSprite = null;
    this.bossMaxHp = 0;

    this.book = new PassiveBook();
    for (const id of this.run.passives) {
      const def = config.passives.find((p) => p.id === id);
      if (def) this.book.add(def);
    }
    this.xp = new XpTracker(config.levels, this.run.level, this.run.level_xp);
    this.bonds = new BondTracker(config.bonds);
    this.bonds.restore(this.run.bond_members);
    this.stats = computeStats(
      config.hero,
      this.allMods(),
      this.xp.level,
      config.levels.growth_per_level,
    );
    this.run.max_hp = this.stats.max_hp;
    this.run.hp = Math.min(this.run.hp, this.run.max_hp);

    this.buildBackground();
    this.physics.world.setBounds(0, 0, ARENA_W, ARENA_H);

    const heroVisual = visualOf('hero');
    this.player = this.physics.add.sprite(ARENA_W / 2, ARENA_H / 2, 'hero').setDepth(5);
    this.player.setScale(heroVisual.scale);
    this.player.setCircle(config.hero.radius);
    this.player.setCollideWorldBounds(true);
    this.player.setMaxVelocity(2000);

    if (heroVisual.shadow > 0) {
      this.playerShadow = this.add
        .ellipse(this.player.x, this.player.y + 20, heroVisual.shadow, heroVisual.shadow * 0.32, 0x000000, 0.35)
        .setDepth(4.5);
    }

    this.enemies = this.physics.add.group({ maxSize: 200 });
    this.summons = this.physics.add.group({ maxSize: 12 });
    this.bullets = this.physics.add.group({ maxSize: 80 });
    this.pickups = this.physics.add.group({ maxSize: 60 });

    this.physics.add.collider(this.enemies, this.enemies);
    this.physics.add.collider(this.summons, this.summons);
    this.physics.add.overlap(this.bullets, this.enemies, (b, e) => {
      this.hitEnemy(b as Phaser.Physics.Arcade.Sprite, e as Phaser.Physics.Arcade.Sprite);
    });
    this.physics.add.overlap(this.bullets, this.summons, (b, s) => {
      this.hitSummon(b as Phaser.Physics.Arcade.Sprite, s as Phaser.Physics.Arcade.Sprite);
    });
    this.physics.add.overlap(this.player, this.enemies, (_p, e) => {
      this.touchPlayer(e as Phaser.Physics.Arcade.Sprite);
    });
    this.physics.add.overlap(this.player, this.summons, (_p, s) => {
      this.touchPlayer(s as Phaser.Physics.Arcade.Sprite);
    });
    this.physics.add.overlap(this.player, this.pickups, (_p, p) => {
      this.collectPickup(p as Phaser.Physics.Arcade.Sprite);
    });

    this.summonSystem = new SummonSystem(config.summons);
    this.summonBar = new SummonBar(this, config.summons, (id) => this.trySummon(id));
    this.skillBar = new SkillBar(this, config.skills, 524, ARENA_H - 88, (id) => this.castSkill(id));
    this.passiveBar = new PassiveBar(this, (p) => this.inspectPassive(p));
    this.passiveBar.refresh(this.book.list);

    this.setupInput();
    this.buildHud();

    this.director = new WaveDirector(this.wave);
    this.cameras.main.fadeIn(180, 0, 0, 0);
    saveRun(this.run);
  }

  // ---------------------------------------------------------------- setup

  private buildBackground(): void {
    this.add.rectangle(0, 0, ARENA_W, ARENA_H, COLORS.bg).setOrigin(0);
    this.add.tileSprite(0, 0, ARENA_W, ARENA_H, 'floor-a').setOrigin(0).setTileScale(2).setDepth(0);

    // 地面装饰用本局种子铺开，同一局反复进出 Prep 位置不变
    const rng = mulberry32(this.run.seed ^ 0x9e3779b9);
    const decals = ['decor-crack', 'decor-scuff', 'decor-scuff', 'decor-crack'];
    for (let i = 0; i < 22; i += 1) {
      const key = decals[Math.floor(rng() * decals.length)]!;
      this.add
        .image(rng() * ARENA_W, rng() * ARENA_H, key)
        .setScale(2)
        .setAlpha(0.5)
        .setDepth(0.2)
        .setAngle(Math.floor(rng() * 4) * 90);
    }

    this.add.image(0, 0, 'vignette').setOrigin(0).setDisplaySize(ARENA_W, ARENA_H).setDepth(0.6);

    const frame = this.add.graphics().setDepth(0.7);
    frame.lineStyle(3, COLORS.border, 1);
    frame.strokeRect(1.5, 1.5, ARENA_W - 3, ARENA_H - 3);

    this.addDirectionGate();
  }

  /** 在来袭那一侧描一条红边 + 指向战场内的箭头，让「这波怪从哪边来」一眼可见。 */
  private addDirectionGate(): void {
    const thickness = 6;
    let strip: Phaser.GameObjects.Rectangle;
    const marks: Array<{ x: number; y: number; angle: number }> = [];

    switch (this.direction) {
      case 'north':
        strip = this.add.rectangle(0, 0, ARENA_W, thickness, 0xff5c7a, 0.18).setOrigin(0);
        for (let i = 0; i < 5; i += 1) marks.push({ x: 160 + i * 240, y: 30, angle: 90 });
        break;
      case 'south':
        strip = this.add
          .rectangle(0, ARENA_H - thickness, ARENA_W, thickness, 0xff5c7a, 0.18)
          .setOrigin(0);
        for (let i = 0; i < 5; i += 1) marks.push({ x: 160 + i * 240, y: ARENA_H - 30, angle: -90 });
        break;
      case 'east':
        strip = this.add
          .rectangle(ARENA_W - thickness, 0, thickness, ARENA_H, 0xff5c7a, 0.18)
          .setOrigin(0);
        for (let i = 0; i < 3; i += 1) marks.push({ x: ARENA_W - 30, y: 180 + i * 180, angle: 180 });
        break;
      default:
        strip = this.add.rectangle(0, 0, thickness, ARENA_H, 0xff5c7a, 0.18).setOrigin(0);
        for (let i = 0; i < 3; i += 1) marks.push({ x: 30, y: 180 + i * 180, angle: 0 });
        break;
    }
    strip.setDepth(0.8);

    const arrows = this.add.container(0, 0).setDepth(0.85);
    for (const m of marks) {
      const arrow = this.add.triangle(m.x, m.y, -12, -11, 12, 0, -12, 11, 0xff5c7a, 0.5);
      arrow.setAngle(m.angle);
      arrows.add(arrow);
    }

    this.tweens.add({
      targets: [strip, arrows],
      alpha: { from: 0.35, to: 1 },
      duration: 950,
      yoyo: true,
      repeat: -1,
    });
  }

  private setupInput(): void {
    const kb = this.input.keyboard!;
    this.cursors = kb.createCursorKeys();
    this.wasd = kb.addKeys('W,A,S,D') as Record<
      'W' | 'A' | 'S' | 'D',
      Phaser.Input.Keyboard.Key
    >;

    config.summons.forEach((def, i) => {
      kb.on(`keydown-${['ONE', 'TWO', 'THREE'][i]}`, () => this.trySummon(def.id));
    });
    config.skills.forEach((def, i) => {
      const code = SKILL_KEYS[i];
      if (!code) return;
      kb.on(`keydown-${code}`, () => this.castSkill(def.id));
    });

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.summonBar.contains(p.worldX, p.worldY)) return;
      if (p.worldY > ARENA_H - 120 && p.worldX > 500) return;
      if (this.overlayOpen) return;
      this.pointerActive = true;
      this.pointerTarget.set(p.worldX, p.worldY);
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.pointerActive) this.pointerTarget.set(p.worldX, p.worldY);
    });
    this.input.on('pointerup', () => {
      this.pointerActive = false;
    });
  }

  private buildHud(): void {
    this.hpBar = this.add.graphics().setDepth(20);
    this.xpBar = this.add.graphics().setDepth(20);
    this.hpText = this.add
      .text(24, 22, '', { ...TEXT_STYLE, fontSize: '14px', color: COLORS.dim })
      .setDepth(21);

    this.waveText = this.add
      .text(ARENA_W / 2, 22, '', { ...TEXT_STYLE, fontSize: '20px', fontStyle: 'bold' })
      .setOrigin(0.5, 0)
      .setDepth(21);

    this.killText = this.add
      .text(ARENA_W - 24, 22, '', { ...TEXT_STYLE, fontSize: '16px', color: COLORS.dim })
      .setOrigin(1, 0)
      .setDepth(21);

    this.bondText = this.add
      .text(ARENA_W - 24, 48, '', {
        ...TEXT_STYLE,
        fontSize: '13px',
        color: COLORS.gold,
        align: 'right',
        lineSpacing: 4,
      })
      .setOrigin(1, 0)
      .setDepth(21);

    this.resourceTexts = {} as Record<ResourceKind, Phaser.GameObjects.Text>;
    RESOURCE_ORDER.forEach((kind, i) => {
      const meta = RESOURCE_META[kind];
      const x = 28 + i * 118;
      this.add.circle(x, 88, 5, meta.hex).setDepth(21);
      this.resourceTexts[kind] = this.add
        .text(x + 12, 88, '', { ...TEXT_STYLE, fontSize: '15px', color: meta.color })
        .setOrigin(0, 0.5)
        .setDepth(21);
    });

    this.toastText = this.add
      .text(ARENA_W / 2, ARENA_H - 150, '', {
        ...TEXT_STYLE,
        fontSize: '18px',
        color: COLORS.danger,
      })
      .setOrigin(0.5)
      .setAlpha(0)
      .setDepth(40);
  }

  // ---------------------------------------------------------------- update

  override update(_time: number, delta: number): void {
    if (this.dead || this.overlayOpen) return;
    const dt = Math.min(delta, 50);

    this.summonSystem.update(dt);
    this.tickCooldowns(dt);
    this.updateMovement();
    this.updateCombat(dt);
    this.updateSpawns(dt);
    this.updateSummonMovement();
    this.updatePickups();
    this.updateBullets();
    this.updateHud();
    this.summonBar.update(this.summonSystem);
    this.skillBar.update(this.skillCd, this.xp.level);
    this.checkWaveCleared();
  }

  private tickCooldowns(dt: number): void {
    for (const [id, cd] of this.skillCd) {
      if (cd > 0) this.skillCd.set(id, Math.max(0, cd - dt));
    }
  }

  private updateMovement(): void {
    const speed = this.stats.speed;
    let vx = 0;
    let vy = 0;

    if (this.cursors.left.isDown || this.wasd.A.isDown) vx -= 1;
    if (this.cursors.right.isDown || this.wasd.D.isDown) vx += 1;
    if (this.cursors.up.isDown || this.wasd.W.isDown) vy -= 1;
    if (this.cursors.down.isDown || this.wasd.S.isDown) vy += 1;

    if (vx === 0 && vy === 0 && this.pointerActive) {
      const dx = this.pointerTarget.x - this.player.x;
      const dy = this.pointerTarget.y - this.player.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 12) {
        vx = dx / dist;
        vy = dy / dist;
      }
    }

    const len = Math.hypot(vx, vy);
    if (len > 0) {
      vx /= len;
      vy /= len;
      this.lastMove.set(vx, vy);
    }
    this.player.setVelocity(vx * speed, vy * speed);

    if (len > 0) {
      if (vx < -0.1) this.player.setFlipX(true);
      else if (vx > 0.1) this.player.setFlipX(false);
      this.player.play('hero-walk', true);
    } else if (this.player.anims.isPlaying) {
      this.player.stop();
      this.player.setTexture('hero');
    }

    if (this.playerShadow) {
      this.playerShadow.setPosition(this.player.x, this.player.y + 20);
    }
  }

  private updateCombat(dt: number): void {
    this.attackCd -= dt;
    if (this.invuln > 0) this.invuln -= dt;

    for (const obj of this.enemies.getChildren()) {
      const e = obj as Phaser.Physics.Arcade.Sprite;
      if (!e.active) continue;
      const speed = (e.getData('speed') as number) * this.wave.speed_scale;
      this.physics.moveToObject(e, this.player, speed);
      this.animateWalk(e, this.time.now);
    }

    if (this.attackCd <= 0) {
      const target = this.nearestTarget();
      if (target) this.fireAt(target);
    }
  }

  /** 敌人走路：横向翻转朝向前进方向 + 轻微压扁，省掉 8 方向行走图。 */
  private animateWalk(sprite: Phaser.Physics.Arcade.Sprite, now: number): void {
    const visual = sprite.getData('visual') as VisualDef | undefined;
    if (!visual) return;
    const body = sprite.body as Phaser.Physics.Arcade.Body | null;
    if (visual.flip && body && Math.abs(body.velocity.x) > 1) {
      sprite.setFlipX(body.velocity.x < 0);
    }
    if (visual.bob > 0) {
      const phase = (sprite.getData('bob_phase') as number) ?? 0;
      const squash = 1 + Math.sin(now * 0.011 + phase) * visual.bob;
      sprite.setScale(visual.scale, visual.scale * squash);
    }
  }

  /** 受击闪白：比改 alpha 更有打击感。 */
  private flashTarget(sprite: Phaser.Physics.Arcade.Sprite): void {
    sprite.setTintFill(0xffffff);
    this.time.delayedCall(65, () => {
      if (sprite.active) sprite.clearTint();
    });
  }

  private nearestTarget(): Phaser.Physics.Arcade.Sprite | null {
    let best: Phaser.Physics.Arcade.Sprite | null = null;
    let bestDist = this.stats.range;
    const consider = (obj: Phaser.GameObjects.GameObject) => {
      const sprite = obj as Phaser.Physics.Arcade.Sprite;
      if (!sprite.active) return;
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, sprite.x, sprite.y);
      if (d < bestDist) {
        bestDist = d;
        best = sprite;
      }
    };
    this.enemies.getChildren().forEach(consider);
    this.summons.getChildren().forEach(consider);
    return best;
  }

  private fireAt(target: Phaser.Physics.Arcade.Sprite): void {
    const base = Phaser.Math.Angle.Between(this.player.x, this.player.y, target.x, target.y);
    const shots = this.stats.multishot;
    for (let i = 0; i < shots; i += 1) {
      const offset = (i - (shots - 1) / 2) * 0.09;
      const hit = this.rollHit(this.stats.damage);
      this.spawnBullet(base + offset, hit.dmg, hit.crit);
    }
    this.attackCd = this.stats.cooldown_ms;
    sfx.play('shoot');
  }

  private rollHit(base: number): { dmg: number; crit: boolean } {
    const crit = Math.random() < this.stats.crit_chance;
    return { dmg: crit ? base * this.stats.crit_mult : base, crit };
  }

  private spawnBullet(angle: number, damage: number, crit = false): void {
    const bullet = this.bullets.get(this.player.x, this.player.y, 'bullet') as
      | Phaser.Physics.Arcade.Sprite
      | null;
    if (!bullet) return;

    bullet.enableBody(true, this.player.x, this.player.y, true, true);
    bullet.setDepth(4);
    const visual = visualOf('bullet');
    bullet.setScale(visual.scale);
    bullet.setCircle(this.stats.bullet_radius);
    if (visual.rotate) bullet.setRotation(angle);
    bullet.setData('born', this.time.now);
    bullet.setData('dmg', damage);
    bullet.setData('crit', crit);
    this.physics.velocityFromRotation(
      angle,
      this.stats.bullet_speed,
      (bullet.body as Phaser.Physics.Arcade.Body).velocity,
    );
  }

  private updateSpawns(dt: number): void {
    for (const { stream, count } of this.director.update(dt)) {
      const group = this.wave.groups[stream]!;
      for (let i = 0; i < count; i += 1) this.spawnEnemy(group.enemy);
    }
  }

  private spawnEnemy(id: string): void {
    const def = config.enemies[id]!;
    const margin = 50;
    let x = 0;
    let y = 0;
    const rnd = Math.random;

    switch (this.direction) {
      case 'north':
        x = 80 + rnd() * (ARENA_W - 160);
        y = -margin;
        break;
      case 'south':
        x = 80 + rnd() * (ARENA_W - 160);
        y = ARENA_H + margin;
        break;
      case 'east':
        x = ARENA_W + margin;
        y = 60 + rnd() * (ARENA_H - 120);
        break;
      case 'west':
        x = -margin;
        y = 60 + rnd() * (ARENA_H - 120);
        break;
    }

    const visual = visualOf(`enemy-${def.id}`);
    const enemy = this.enemies.get(x, y, `enemy-${def.id}`) as Phaser.Physics.Arcade.Sprite | null;
    if (!enemy) return;

    enemy.enableBody(true, x, y, true, true);
    enemy.clearTint();
    enemy.setAlpha(1);
    enemy.setScale(visual.scale);
    enemy.setCircle(def.radius);
    enemy.setDepth(3);
    enemy.setData('visual', visual);
    enemy.setData('bob_phase', Math.random() * Math.PI * 2);
    enemy.setData('hp', def.hp * this.wave.hp_scale);
    enemy.setData('damage', def.damage);
    enemy.setData('speed', def.speed);
    enemy.setData('def_id', def.id);

    if (def.boss) {
      this.bossSprite = enemy;
      this.bossMaxHp = def.hp * this.wave.hp_scale;
      sfx.play('boss');
      this.cameras.main.shake(260, 0.008);
      this.toast(`BOSS 出现：${def.name}`, COLORS.danger);
    }
  }

  // ---------------------------------------------------------------- skills

  private castSkill(id: string): void {
    if (this.dead || this.overlayOpen) return;
    const def = config.skills.find((s) => s.id === id);
    if (!def) return;
    if (this.xp.level < def.level) {
      this.toast(`${def.name} 需要 Lv.${def.level}`);
      return;
    }
    if ((this.skillCd.get(id) ?? 0) > 0) {
      this.toast(`${def.name} 冷却中`);
      return;
    }
    this.skillCd.set(id, def.cooldown_ms * (1 - evolutionPerks(config.evolutions, this.run.evolutions).skill_cd_pct / 100));
    switch (def.kind) {
      case 'dash':
        this.castDash(def);
        break;
      case 'nova':
        this.castNova(def);
        break;
      case 'barrage':
        this.castBarrage(def);
        break;
    }
  }

  private castDash(def: SkillDef): void {
    const dir = this.lastMove.clone().normalize();
    const nx = Phaser.Math.Clamp(this.player.x + dir.x * def.power, 24, ARENA_W - 24);
    const ny = Phaser.Math.Clamp(this.player.y + dir.y * def.power, 24, ARENA_H - 24);
    this.invuln = Math.max(this.invuln, 450);

    for (let i = 0; i < 5; i += 1) {
      const ghost = this.add
        .image(
          Phaser.Math.Linear(this.player.x, nx, i / 5),
          Phaser.Math.Linear(this.player.y, ny, i / 5),
          'hero',
        )
        .setAlpha(0.35)
        .setDepth(3);
      this.tweens.add({
        targets: ghost,
        alpha: 0,
        duration: 220 + i * 40,
        onComplete: () => ghost.destroy(),
      });
    }
    (this.player.body as Phaser.Physics.Arcade.Body).reset(nx, ny);
  }

  private castNova(def: SkillDef): void {
    const radius = def.radius ?? 160;
    this.damageArea(this.player.x, this.player.y, radius, this.stats.damage * def.power);

    const ring = this.add.circle(this.player.x, this.player.y, 20, 0x6ee7ff, 0.18);
    ring.setStrokeStyle(3, 0x6ee7ff, 0.9).setDepth(6);
    this.tweens.add({
      targets: ring,
      radius,
      alpha: 0,
      duration: 320,
      ease: 'Quad.easeOut',
      onComplete: () => ring.destroy(),
    });
    this.cameras.main.shake(90, 0.004);
  }

  private damageArea(x: number, y: number, radius: number, damage: number): void {
    for (const obj of this.enemies.getChildren()) {
      const e = obj as Phaser.Physics.Arcade.Sprite;
      if (!e.active) continue;
      if (Phaser.Math.Distance.Between(x, y, e.x, e.y) > radius + 16) continue;

      const hp = (e.getData('hp') as number) - damage;
      e.setData('hp', hp);
      this.knockback(e, x, y);
      if (hp > 0) {
        this.tweens.add({ targets: e, alpha: 0.45, duration: 60, yoyo: true });
      } else {
        this.killEnemy(e);
      }
    }
  }

  private knockback(e: Phaser.Physics.Arcade.Sprite, fromX: number, fromY: number): void {
    const angle = Phaser.Math.Angle.Between(fromX, fromY, e.x, e.y);
    e.setVelocity(Math.cos(angle) * 220, Math.sin(angle) * 220);
  }

  private castBarrage(def: SkillDef): void {
    const count = def.count ?? 12;
    for (let i = 0; i < count; i += 1) {
      const angle = (Math.PI * 2 * i) / count;
      const hit = this.rollHit(this.stats.damage * def.power);
      this.spawnBullet(angle, hit.dmg, hit.crit);
    }
    sfx.play('shoot');
    this.cameras.main.flash(80, 40, 80, 120, false);
  }

  // ---------------------------------------------------------------- summons

  private trySummon(id: string): void {
    if (this.dead || this.overlayOpen) return;
    const def = config.summons.find((s) => s.id === id);
    if (!def) return;

    const result = this.summonSystem.request(id);
    if (result === 'ok') {
      this.spawnSummon(def);
      return;
    }
    this.toast(result === 'max_alive' ? `${def.name}已达上限` : `${def.name}冷却中`);
  }

  private spawnSummon(def: SummonDef): void {
    const angle = Math.random() * Math.PI * 2;
    const x = Phaser.Math.Clamp(
      this.player.x + Math.cos(angle) * def.spawn_distance,
      48,
      ARENA_W - 48,
    );
    const y = Phaser.Math.Clamp(
      this.player.y + Math.sin(angle) * def.spawn_distance,
      110,
      ARENA_H - 120,
    );

    const summon = this.summons.get(x, y, `summon-${def.id}`) as
      | Phaser.Physics.Arcade.Sprite
      | null;
    if (!summon) {
      this.summonSystem.release(def.id);
      return;
    }

    summon.enableBody(true, x, y, true, true);
    const visual = visualOf(`summon-${def.id}`);
    summon.setScale(visual.scale * 0.2).setAlpha(1);
    summon.clearTint();
    summon.setCircle(def.radius);
    summon.setDepth(4);
    summon.setData('visual', visual);
    summon.setData('bob_phase', Math.random() * Math.PI * 2);
    summon.setData('hp', def.hp);
    summon.setData('damage', def.damage);
    summon.setData('speed', def.speed);
    summon.setData('def_id', def.id);
    summon.setData('resource', def.resource);
    summon.setData('reward', def.reward);

    this.tweens.add({
      targets: summon,
      scaleX: visual.scale,
      scaleY: visual.scale,
      duration: 180,
      ease: 'Back.easeOut',
    });
  }

  private updateSummonMovement(): void {
    for (const obj of this.summons.getChildren()) {
      const s = obj as Phaser.Physics.Arcade.Sprite;
      if (!s.active) continue;
      this.physics.moveToObject(s, this.player, s.getData('speed') as number);
      const visual = s.getData('visual') as VisualDef | undefined;
      const body = s.body as Phaser.Physics.Arcade.Body | null;
      if (visual?.flip && body && Math.abs(body.velocity.x) > 1) {
        s.setFlipX(body.velocity.x < 0);
      }
    }
  }

  private hitSummon(
    bullet: Phaser.Physics.Arcade.Sprite,
    summon: Phaser.Physics.Arcade.Sprite,
  ): void {
    if (!bullet.active || !summon.active) return;
    bullet.disableBody(true, true);

    const dmg = (bullet.getData('dmg') as number) ?? this.stats.damage;
    const hp = (summon.getData('hp') as number) - dmg;
    summon.setData('hp', hp);
    if (hp > 0) {
      this.flashTarget(summon);
      return;
    }
    this.killSummon(summon);
  }

  private killSummon(summon: Phaser.Physics.Arcade.Sprite): void {
    const x = summon.x;
    const y = summon.y;
    const defId = summon.getData('def_id') as string;
    const resource = summon.getData('resource') as ResourceKind;
    const reward = summon.getData('reward') as number;
    const color = RESOURCE_META[resource].hex;

    summon.disableBody(true, true);
    this.summonSystem.release(defId);
    this.burst(x, y, color);
    this.dropPickup(x, y, resource, reward);
  }

  private dropPickup(x: number, y: number, kind: ResourceKind, amount: number): void {
    const pickup = this.pickups.get(x, y, `pickup-${kind}`) as
      | Phaser.Physics.Arcade.Sprite
      | null;
    if (!pickup) return;

    pickup.enableBody(true, x, y, true, true);
    const visual = visualOf(`pickup-${kind}`);
    pickup.setCircle(9);
    pickup.setDepth(4);
    pickup.setData('visual', visual);
    pickup.setData('phase', Math.random() * Math.PI * 2);
    pickup.setData('kind', kind);
    pickup.setData('amount', amount);
    pickup.setData('born', this.time.now);
    pickup.setVelocity(Math.random() * 160 - 80, Math.random() * 160 - 80);
    pickup.setDrag(420, 420);
    pickup.setScale(visual.scale * 0.6);
    this.tweens.add({
      targets: pickup,
      scaleX: visual.scale,
      scaleY: visual.scale,
      duration: 160,
      ease: 'Back.easeOut',
    });
  }

  private updatePickups(): void {
    for (const obj of this.pickups.getChildren()) {
      const p = obj as Phaser.Physics.Arcade.Sprite;
      if (!p.active) continue;
      if (this.time.now - (p.getData('born') as number) > 20000) {
        p.disableBody(true, true);
        continue;
      }
      const dist = Phaser.Math.Distance.Between(p.x, p.y, this.player.x, this.player.y);
      if (dist < 26) {
        this.collectPickup(p);
      } else if (dist < 130) {
        this.physics.moveToObject(p, this.player, 460);
      } else {
        const visual = p.getData('visual') as VisualDef | undefined;
        const born = (p.getData('born') as number) ?? this.time.now;
        if (visual && this.time.now - born > 200) {
          const pulse = 1 + Math.sin(this.time.now * 0.006 + (p.getData('phase') as number)) * 0.08;
          p.setScale(visual.scale * pulse);
        }
      }
    }
  }

  private collectPickup(pickup: Phaser.Physics.Arcade.Sprite): void {
    if (!pickup.active) return;
    const kind = pickup.getData('kind') as ResourceKind;
    const amount = pickup.getData('amount') as number;
    const meta = RESOURCE_META[kind];
    const px = pickup.x;
    const py = pickup.y;

    pickup.disableBody(true, true);
    this.popText(px, py, `+${amount} ${meta.name}`, meta.color);

    if (kind === 'xp') {
      this.gainXp(amount);
    } else {
      grantResource(this.run, kind, amount);
    }
  }

  // ---------------------------------------------------------------- progression

  private gainXp(amount: number): void {
    grantResource(this.run, 'xp', amount);
    const before = this.xp.level;
    const gained = this.xp.add(amount);
    this.run.level = this.xp.level;
    this.run.level_xp = this.xp.xp;
    if (gained <= 0) return;

    this.refreshStats(true);
    sfx.play('levelup');
    for (let lv = before + 1; lv <= this.xp.level; lv += 1) {
      for (const skill of config.skills) {
        if (skill.level === lv) this.toast(`解锁主动技能：${skill.name}`, COLORS.accent);
      }
      if (config.levels.passive_offer_levels.includes(lv)) this.offerQueue.push(lv);
    }
    this.tryOpenOffer();
  }

  /** 被动 + 羁绊 + 英雄进化 + 装备，统一汇总成属性修正。 */
  private allMods() {
    return sumMods(
      this.book.mods(),
      this.bonds.mods(),
      evolutionMods(config.evolutions, this.run.evolutions),
      equipmentMods(config.items, this.run.equipment),
    );
  }

  private refreshStats(healDelta: boolean): void {
    const next = computeStats(
      config.hero,
      this.allMods(),
      this.xp.level,
      config.levels.growth_per_level,
    );
    const delta = next.max_hp - this.stats.max_hp;
    this.stats = next;
    this.run.max_hp = next.max_hp;
    if (healDelta && delta > 0) this.run.hp += delta;
    this.run.hp = Math.min(this.run.hp, next.max_hp);
  }

  private tryOpenOffer(): void {
    if (this.overlayOpen || this.dead) return;
    const level = this.offerQueue.shift();
    if (level === undefined) return;

    this.overlayOpen = true;
    this.physics.pause();
    this.player.setVelocity(0, 0);
    this.updateHud();

    const ownedIds = [...this.book.ids(), ...this.bonds.collectedIds()];
    const candidates = rollPassives(config.passives, ownedIds, 3, Math.random);
    this.overlay = new LevelUpOverlay(this, {
      level,
      candidates,
      slots: this.book.list,
      refresh_cost: config.levels.refresh_cost,
      economy: this.run.economy,
      canTake: (p) => this.bonds.willAbsorb(p.id) || !this.book.isFull,
      onPick: (p) => this.acquirePassive(p),
      onReplace: (slot, p) => this.acquirePassive(p, slot),
      onRefresh: () => {
        const cost = config.levels.refresh_cost;
        if (this.run.economy < cost) return null;
        this.run.economy -= cost;
        return rollPassives(config.passives, ownedIds, 3, Math.random);
      },
    });
  }

  /** 拿被动：先过羁绊，触发进化时成员离开格子；否则进空格/替换。 */
  private acquirePassive(passive: PassiveDef, slotIndex?: number): void {
    const result = this.bonds.add(passive.id);

    if (result.absorbed) {
      for (const id of this.bonds.collectedIds()) this.book.removeById(id);
    } else if (slotIndex !== undefined) {
      this.book.replace(slotIndex, passive);
    } else {
      this.book.add(passive);
    }

    if (result.activation) this.onBondEvolved(result.activation);

    this.run.bond_members = this.bonds.collectedIds();
    this.commitPassive();
  }

  private onBondEvolved(activation: BondActivation): void {
    const { bond, tier } = activation;
    sfx.play('evolve');
    this.toast(`${bond.name}进化：${tier.name}`, COLORS.gold);
    this.popText(this.player.x, this.player.y - 44, `${tier.name}！`, COLORS.gold);
    this.cameras.main.flash(160, 90, 60, 140, false);

    const ring = this.add.circle(this.player.x, this.player.y, 24, 0xffd166, 0.15);
    ring.setStrokeStyle(4, 0xffd166, 0.9).setDepth(7);
    this.tweens.add({
      targets: ring,
      radius: 220,
      alpha: 0,
      duration: 520,
      ease: 'Quad.easeOut',
      onComplete: () => ring.destroy(),
    });
  }

  private commitPassive(): void {
    this.run.passives = this.book.ids();
    this.refreshStats(true);
    this.passiveBar.refresh(this.book.list);

    this.overlay?.destroy();
    this.overlay = null;
    this.overlayOpen = false;
    this.physics.resume();
    this.tryOpenOffer();
  }

  private inspectPassive(passive: PassiveDef): void {
    if (this.overlayOpen) return;
    const element = passive.element ? '（元素）' : '';
    this.toast(`${passive.name}${element}：${passive.desc}`);
  }

  // ---------------------------------------------------------------- damage

  private updateBullets(): void {
    const now = this.time.now;
    for (const obj of this.bullets.getChildren()) {
      const b = obj as Phaser.Physics.Arcade.Sprite;
      if (!b.active) continue;
      const born = (b.getData('born') as number) ?? now;
      const out = b.x < -40 || b.x > ARENA_W + 40 || b.y < -40 || b.y > ARENA_H + 40;
      if (now - born > 1400 || out) b.disableBody(true, true);
    }
  }

  private updateHud(): void {
    const w = 260;
    const h = 14;
    const x = 24;
    const y = 44;
    const ratio = Phaser.Math.Clamp(this.run.hp / this.run.max_hp, 0, 1);

    this.hpBar.clear();
    this.hpBar.fillStyle(0x000000, 0.6).fillRect(x - 2, y - 2, w + 4, h + 4);
    this.hpBar.fillStyle(0x26313f, 1).fillRect(x, y, w, h);
    const color = ratio > 0.5 ? 0x51cf9b : ratio > 0.25 ? 0xf0a44a : 0xff5c7a;
    this.hpBar.fillStyle(color, 1).fillRect(x, y, w * ratio, h);

    this.xpBar.clear();
    this.xpBar.fillStyle(0x1b2534, 1).fillRect(x, y + h + 4, w, 4);
    this.xpBar.fillStyle(0x5ee6a8, 1).fillRect(x, y + h + 4, w * this.xp.progress, 4);

    this.hpText.setText(
      `Lv.${this.xp.level} · 生命 ${Math.max(0, Math.ceil(this.run.hp))} / ${this.run.max_hp}`,
    );
    this.waveText.setText(
      `第 ${this.run.wave_index + 1} / ${config.waves.length} 波 · ${DIRECTION_LABEL[this.direction]}`,
    );
    this.killText.setText(`击杀 ${this.run.kills}`);
    for (const kind of RESOURCE_ORDER) {
      this.resourceTexts[kind].setText(`${RESOURCE_META[kind].name} ${this.run[kind]}`);
    }

    const bondLines = config.bonds
      .filter((bond) => this.bonds.count(bond.id) > 0)
      .map((bond) => {
        const tier = this.bonds.activeTier(bond);
        const progress = `${this.bonds.count(bond.id)}/${bond.members.length}★${bond.star}`;
        return tier ? `${bond.name} ${progress} · ${tier.name}` : `${bond.name} ${progress}`;
      });
    this.bondText.setText(bondLines.join('\n'));

    if (this.bossSprite?.active) {
      const bossHp = (this.bossSprite.getData('hp') as number) ?? 0;
      const bossRatio = Phaser.Math.Clamp(bossHp / Math.max(1, this.bossMaxHp), 0, 1);
      const bw = 420;
      const bx = (ARENA_W - bw) / 2;
      const by = 58;
      this.hpBar.fillStyle(0x000000, 0.6).fillRect(bx - 2, by - 2, bw + 4, 12);
      this.hpBar.fillStyle(0x2a1620, 1).fillRect(bx, by, bw, 8);
      this.hpBar.fillStyle(0xff4d6d, 1).fillRect(bx, by, bw * bossRatio, 8);
    }
  }

  private hitEnemy(bullet: Phaser.Physics.Arcade.Sprite, enemy: Phaser.Physics.Arcade.Sprite): void {
    if (!bullet.active || !enemy.active) return;
    const dmg = (bullet.getData('dmg') as number) ?? this.stats.damage;
    const crit = (bullet.getData('crit') as boolean) ?? false;
    bullet.disableBody(true, true);

    const hp = (enemy.getData('hp') as number) - dmg;
    enemy.setData('hp', hp);
    this.applyLifesteal(dmg);
    this.showDamage(enemy.x, enemy.y - 8, dmg, crit);
    sfx.play('hit');

    if (hp > 0) {
      this.flashTarget(enemy);
      return;
    }
    this.killEnemy(enemy);
  }

  /** 飘伤害数字；暴击更大更亮。 */
  private showDamage(x: number, y: number, amount: number, crit: boolean): void {
    const jitterX = (Math.random() - 0.5) * 16;
    const label = this.add
      .text(x + jitterX, y, `${Math.round(amount)}${crit ? '!' : ''}`, {
        fontFamily: '"Microsoft YaHei", system-ui, sans-serif',
        fontSize: crit ? '22px' : '15px',
        color: crit ? '#ffd166' : '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(60)
      .setAlpha(0.95);

    this.tweens.add({
      targets: label,
      y: y - 34,
      alpha: 0,
      duration: crit ? 620 : 460,
      ease: 'Quad.easeOut',
      onComplete: () => label.destroy(),
    });
  }

  /** 击杀顿帧：物理世界短暂慢放，打击感来源。 */
  private hitStop(ms: number): void {
    this.physics.world.timeScale = 0.08;
    this.time.delayedCall(ms, () => {
      this.physics.world.timeScale = 1;
    });
  }

  private applyLifesteal(damage: number): void {
    if (this.stats.lifesteal <= 0) return;
    const heal = damage * this.stats.lifesteal;
    if (heal <= 0) return;
    this.run.hp = Math.min(this.run.max_hp, this.run.hp + heal);
  }

  private killEnemy(enemy: Phaser.Physics.Arcade.Sprite): void {
    const x = enemy.x;
    const y = enemy.y;
    const defId = enemy.getData('def_id') as string;
    const color = Phaser.Display.Color.HexStringToColor(
      config.enemies[defId]?.color ?? '#ffffff',
    ).color;
    enemy.disableBody(true, true);
    this.run.kills += 1;
    const healOnKill = evolutionPerks(config.evolutions, this.run.evolutions).heal_on_kill;
    if (healOnKill > 0) {
      this.run.hp = Math.min(this.run.max_hp, this.run.hp + healOnKill);
    }
    this.burst(x, y, color);
    this.spawnShards(x, y, color);
    sfx.play('kill');
    this.hitStop(45);
  }

  /** 死亡碎块：比纯粒子更能看出「被打碎了」。 */
  private spawnShards(x: number, y: number, color: number): void {
    const visual = visualOf('shard');
    for (let i = 0; i < 6; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 14 + Math.random() * 30;
      const shard = this.add
        .image(x, y, 'shard')
        .setDepth(6)
        .setScale(visual.scale)
        .setTint(color);
      this.tweens.add({
        targets: shard,
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist,
        angle: Math.random() * 360,
        alpha: 0,
        duration: 320 + Math.random() * 220,
        ease: 'Quad.easeOut',
        onComplete: () => shard.destroy(),
      });
    }
  }

  private burst(x: number, y: number, color: number): void {
    for (let i = 0; i < 7; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 18 + Math.random() * 34;
      const dot = this.add.circle(x, y, 3, color).setDepth(6).setAlpha(0.9);
      this.tweens.add({
        targets: dot,
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist,
        alpha: 0,
        scale: 0.3,
        duration: 300 + Math.random() * 180,
        ease: 'Quad.easeOut',
        onComplete: () => dot.destroy(),
      });
    }
  }

  private popText(x: number, y: number, text: string, color: string): void {
    const label = this.add
      .text(x, y - 6, text, { ...TEXT_STYLE, fontSize: '16px', color, fontStyle: 'bold' })
      .setOrigin(0.5)
      .setDepth(40);
    this.tweens.add({
      targets: label,
      y: y - 46,
      alpha: 0,
      duration: 700,
      ease: 'Quad.easeOut',
      onComplete: () => label.destroy(),
    });
  }

  private toast(message: string, color: string = COLORS.danger): void {
    if (!this.toastText) return;
    this.toastText.setText(message).setColor(color).setAlpha(1);
    this.tweens.killTweensOf(this.toastText);
    this.tweens.add({ targets: this.toastText, alpha: 0, delay: 800, duration: 450 });
  }

  private touchPlayer(hostile: Phaser.Physics.Arcade.Sprite): void {
    if (this.dead || !hostile.active) return;
    if (this.invuln > 0) return;

    const damage = hostile.getData('damage') as number;
    this.run.hp -= damage;
    this.invuln = 650;

    this.cameras.main.shake(120, 0.006);
    sfx.play('hurt');
    this.player.setTintFill(0xff5c7a);
    this.player.setAlpha(0.55);
    this.time.delayedCall(110, () => {
      if (!this.player.active) return;
      this.player.clearTint();
      this.player.setAlpha(1);
    });

    if (this.run.hp <= 0) this.onPlayerDeath();
  }

  private onPlayerDeath(): void {
    this.dead = true;
    this.run.hp = 0;
    this.player.setVelocity(0, 0);
    this.physics.pause();
    this.cameras.main.shake(260, 0.012);
    this.cameras.main.flash(120, 120, 0, 20);

    this.time.delayedCall(650, () => {
      this.scene.start('Result', {
        win: false,
        kills: this.run.kills,
        wave: this.run.wave_index + 1,
      });
    });
  }

  private checkWaveCleared(): void {
    if (this.waveCleared || this.dead) return;
    if (!this.director.finished) return;
    if (this.enemies.countActive(true) > 0) return;

    this.waveCleared = true;
    const isLast = this.run.wave_index >= config.waves.length - 1;

    this.time.delayedCall(700, () => {
      if (this.dead) return;
      if (isLast) {
        this.scene.start('Result', {
          win: true,
          kills: this.run.kills,
          wave: this.run.wave_index + 1,
        });
      } else {
        this.run.wave_index += 1;
        this.scene.start('Prep');
      }
    });
  }
}
