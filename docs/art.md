# 美术管线（v0.1）

> 本文说明「当前美术怎么来的、怎么改、以后怎么换成真素材」。
> 口径与 `AGENTS.md` 第 4 节「数据驱动原则」一致：**图和数值一样，都是配置，不是代码**。

## 0. 现状：美术是"程序化像素图"

本机（以及当时的环境）无法从外部下载素材，所以 v0.1 的美术**没有一张 PNG 文件**，全部由两段数据在启动时编译成贴图：

| 内容 | 数据 | 编译 |
|---|---|---|
| 英雄、3 种怪、3 种召唤物、资源球、子弹、碎块 | `data/sprites.json`（字符矩阵） | `src/assets/pixel.ts` → `compileRows()` |
| 地砖、地面装饰、暗角 | `src/assets/tiles.ts`（Canvas 2D 绘制） | `compileCanvas()` |
| 实体显示缩放 / 投影 / 压扁 / 翻转 | `data/visuals.json` | `src/assets/visuals.ts` |

好处：零二进制资产、可 diff、可 code review、启动零网络请求、包体最小。
代价：上限在"能看"这一档，做不出有辨识度的角色设计。

## 1. 怎么改一张图

1. 打开 `data/sprites.json`，找到对应条目（`hero` / `grunt` / `runner` / `brute` / `summon_economy` / …）。
2. 改字符行。每个字符是一个像素，`.` 为透明；**同一张图所有行必须等宽**。
3. 颜色不用写死：字符角色由实体主色派生（见文件里的 `_comment`）。

| 字符 | 含义 | 来源 |
|---|---|---|
| `o` | 描边 | 主色压暗 80% |
| `d` | 暗部 | 主色压暗 42% |
| `b` | 主色 | `data/enemies.json` 等里的 `color` |
| `l` | 亮部 | 主色提亮 30% |
| `h` | 高光 | 主色提亮 62% |
| `w` / `k` | 眼白 / 瞳孔 | 固定 |
| `a` | 强调色 | 可被条目里的 `palette` 覆盖 |

想给某张图固定颜色，就在该条目加 `"palette": { "a": "#ffd166" }`。

4. 改完跑一次预览图（不需要浏览器）：

```bash
node tools/sprite-sheet.mjs
```

产物 `.shots/sprites.png` 是 6 倍放大的拼版图，行宽不一致会在控制台报警。

## 2. 怎么改大小/手感

`data/visuals.json`，每个贴图 key 一段：

```json
"enemy-grunt": { "scale": 2.5, "shadow": 0, "bob": 0.08, "flip": true, "rotate": false }
```

| 字段 | 作用 |
|---|---|
| `scale` | 显示缩放。整数或 `.5` 最稳 |
| `shadow` | 脚下椭圆投影宽度（px），0 = 不画 |
| `bob` | 行走时垂直压扁幅度（0–0.2） |
| `flip` | 是否按水平速度左右翻转 |
| `rotate` | 是否让朝向跟随速度（子弹用） |

**碰撞半径不在这里**，仍在 `enemies.json` / `summons.json` / `heroes.json` 的 `radius`。
显示大小和碰撞大小是两件事：调 `scale` 不会让怪更难打，反之亦然。

## 3. 以后换成真素材（图集）要动哪里

只有一处接缝：`src/assets/sprites.ts` 的 `buildActorTextures()`。

1. 素材放进 `public/assets/`（Vite 会把它映射到 `/assets/`）。
2. 在 `BootScene.preload()` 里 `this.load.atlas('actors', 'assets/actors.png', 'assets/actors.json')`。
3. 在 `buildActorTextures()` 里，贴图 key 已存在就跳过编译 —— 现在的 `compileRows()` 第一行就是 `if (scene.textures.exists(key)) return;`，所以**加载图集后自动走图集，不需要删代码**。
4. 若图集里帧名和运行时 key 不一致，在 `data/visuals.json` 补 `atlas` / `frame` 字段做映射（当前版本还没读这两个字段，需要时再加）。

也就是说：**换美术不需要改 `BattleScene`**，这是刻意留的接缝。

## 4. 授权记录

v0.1 的贴图全部是本仓库自己生成的，无第三方素材，无授权义务。

以后引入外部素材（Kenney / OpenGameArt / itch.io 等）时，**必须在这里补一行**：来源链接、作者、授权（CC0 / CC-BY / OGA-BY）、引入日期、用在哪。

| 日期 | 素材 | 来源 | 授权 | 用途 |
|---|---|---|---|---|
| — | 全部程序化生成 | 本仓库 | 自有 | 全部 |

注意：CC-BY / OGA-BY 要求在游戏内或说明文件里署名，CC0 不要求但建议记录。

## 5. 已知不足（下一步）

- 角色只有 2 帧走路（英雄），怪物靠压扁代替行走帧。
- 没有方向性美术（俯视追逐，靠 `flipX` 翻转）。
- 没有受击/死亡/释放技能的专属帧，靠 tint 和缩放凑。
- 地砖只有一种石板纹，波次之间没有环境变化。
- 手机端 `Scale.FIT` 由浏览器缩放 canvas，非整数倍时像素图会有轻微模糊。
