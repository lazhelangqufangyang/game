# 美术规格与 AI 生成 Prompt（路线 B：AI 出图 → 我接入）

> 目标：把现在「程序化像素图」换成有设计感的定制像素图。
> 你（或美术）按本文规格出图 → 我按第 7 节的流程转进 `data/sprites.json` → 代码零改动。
>
> 本文所有 prompt 都是**可直接粘贴**的英文（图像模型对英文更稳），说明文字是中文。

---

## 0. 一句话规格

**俯视 3/4 视角、单角色居中、硬像素无抗锯齿、透明背景、近黑描边 + 3 个明度阶 + 白眼睛。**
每个单位还要 4 个姿势：**基础 / 行走 / 受击 / 死亡**。

---

## 1. 硬性交付规格

| 单位 | 逻辑尺寸（格） | 生成建议尺寸 | 主色（取自配置） | 碰撞半径 |
|---|---|---|---|---|
| 英雄 · 游侠 `hero` | **18 × 20** | 576 × 640 | `#6ee7ff` 青 | 16 |
| 杂兵 `grunt` | **16 × 16** | 512 × 512 | `#e05c5c` 红 | 14 |
| 疾行者 `runner` | **16 × 16** | 512 × 512 | `#f0a44a` 橙 | 11 |
| 重装 `brute` | **20 × 20** | 640 × 640 | `#a855f7` 紫 | 21 |
| 守关者（Boss）`warden` | **26 × 26** | 832 × 832 | `#ff4d6d` 洋红 | 32 |
| 经济怪 `summon-coffer` | **16 × 16** | 512 × 512 | `#ffd166` 金 | 15 |
| 经验怪 `summon-scholar` | **16 × 16** | 512 × 512 | `#5ee6a8` 绿 | 15 |
| 精粹怪 `summon-wisp` | **16 × 16** | 512 × 512 | `#c084fc` 紫罗兰 | 17 |
| 资源球（3 色共用一张）`pickup` | **11 × 11** | 352 × 352 | 白（运行时染色） | 9 |
| 子弹 `bullet` | **6 × 6** | 192 × 192 | `#ffe9a8` | 5 |
| 碎块 `shard` | **5 × 5** | — | 白（运行时染色） | — |

**通用硬要求：**

1. **背景必须透明**（PNG 带 alpha），不要画出地面阴影——阴影是引擎按 `visuals.json` 画的。
2. **不要抗锯齿**：像素边缘必须是硬方块，不要渐变过渡。
3. **不要缩放模糊**：最终尺寸必须正好是上表的逻辑尺寸（或它的整数倍，方便我缩）。
4. 角色**脚底贴住画布底边**、左右大致居中（居中偏 1px 没关系，我会自动裁剪）。
5. **不要描边光晕 / 外发光 / 投影**。
6. 同一单位的所有姿势帧**画布尺寸必须一致**，否则切换帧会抖。

> 说明：上表是"逻辑格数"。AI 直接出 16×16 会糊成一坨，所以请按"生成建议尺寸"出图，
> 并在 prompt 里声明逻辑网格（例如 `16x16 pixel grid upscaled to 512x512`）。
> 我会用最近邻缩到逻辑尺寸并做调色板收敛。

---

## 2. 全局风格块（每次都要带上）

把下面这段作为 **prompt 前缀**，后面再接第 3 节的具体主体：

```
pixel art game sprite, top-down 3/4 view, single character centered, facing the viewer,
{COLOR} dominant palette with exactly 3 value steps (dark / base / light),
near-black outline, bright white eyes, chunky readable silhouette,
{GRID} logical pixel grid upscaled to {SIZE}, hard square pixels, no anti-aliasing,
flat transparent background, no ground shadow, no glow, no text, no border
```

- `{COLOR}`：第 1 节表里的主色描述（例：`crimson red`）。
- `{GRID}` / `{SIZE}`：例 `16x16` / `512x512`。

**视角一致性要点**（写进 prompt 或作为参考图）：
- 俯视但能看到正脸（正对镜头），**不要俯视头顶**、不要侧脸、不要透视消失点。
- 光源在**左上**，所以亮部在左上、暗部在右下。
- 剪影优先：眯眼看能立刻区分出是哪种怪。

---

## 3. 每个单位的 prompt

### 3.1 英雄 · 游侠（青 `#6ee7ff`，18×20）

**主体描述**（贴在风格块后面）：

```
a lean ranger in a hooded cloak, cyan-trimmed leather armor, small crossbow, short cape,
hood shadowing the upper face, glowing cyan eyes, agile stance
```

4 个姿势（建议**一次出 4 帧横排**，模型比单独出更连贯）：

```
sprite sheet, 4 frames in one horizontal row, same character, pixel art,
frame 1 idle standing, frame 2 mid-stride walking, frame 3 flinching backwards being hit,
frame 4 collapsed on the ground after death,
```

> 也可以逐帧单独出，prompt 里把 `idle standing` 换成 `mid-stride walking / flinching being hit / collapsed on the ground`。

### 3.2 杂兵 `grunt`（红 `#e05c5c`，16×16）

```
a small round-bodied imp with two short horns, angry white eyes, stubby legs, tiny claws,
crimson red skin, cute but aggressive
```

帧：`idle / walking with legs apart / squashed body flinching / flattened pancake on the ground`

### 3.3 疾行者 `runner`（橙 `#f0a44a`，16×16）

```
a lean elongated hound-like creature, long pointed ears, thin spiky back, no arms,
orange fur, fast and twitchy, glowing eyes
```

帧：`idle / sprinting with legs stretched / recoiling / splattered flat`

### 3.4 重装 `brute`（紫 `#a855f7`，20×20）

```
a hulking armored ogre, huge pauldrons, tiny head with heavy brows, thick arms, short legs,
purple plate armor with dark rivets, gold belt buckle, slow and heavy
```

帧：`idle / heavy stomping step / arm raised flinching / crushed flat on the ground`

### 3.5 守关者 Boss `warden`（洋红 `#ff4d6d`，26×26）

```
a towering horned warden, long curved horns, hollow glowing eyes, cracked stone armor,
gold rivets, tattered waist cloth, imposing boss silhouette
```

帧：`idle / slow menacing step / roaring while being hit / collapsing into rubble`
Boss 帧要求更高：**受击帧要有"吼叫/后仰"**，死亡帧要像**塌成石堆**。

### 3.6 三种召唤物（会主动攻击玩家，必须一眼和普通怪区分）

**关键**：它们身上要有**资源色的宝石/印记**，且**不带尖角**（普通怪都有角）。
另外请给它们一个**淡淡的资源色光环**（只是在角色周围一圈，不要外发光到画布边缘）。

- 经济怪 `summon-coffer`（金 `#ffd166`）：
  ```
  a round coin-shaped slime with a golden coin embedded in its forehead, no horns, friendly dumb expression
  ```
- 经验怪 `summon-scholar`（绿 `#5ee6a8`）：
  ```
  a floating green flame wisp with a small book-like charm, no horns, calm expression
  ```
- 精粹怪 `summon-wisp`（紫罗兰 `#c084fc`）：
  ```
  a floating single-eyed orb with a gemstone core, no horns, unsettling stare
  ```

帧：`idle / bobbing walk / flinching / collapsing into a puff`

### 3.7 资源球 `pickup`（11×11，白，运行时染色）

```
a small cut gemstone, isometric diamond shape, bright white core with a bright edge,
minimal detail, readable at very small size
```

只需要 1 帧。

### 3.8 子弹 `bullet`（6×6）

```
a tiny glowing dart pointing right, warm yellow core, near-black outline
```

只需要 1 帧，**必须朝右（+X）**，因为引擎会按速度旋转它。

---

## 4. 通用 Negative Prompt

```
blurry, anti-aliased, smooth gradient shading, soft shadow, drop shadow, glow, bloom,
3d render, cgi, photorealistic, painterly, watercolor, anime, sketch, line art,
text, watermark, signature, border, frame, multiple characters overlapping,
isometric top-down view from above (we need front-facing), extra limbs, deformed
```

---

## 5. 生成参数建议

| 工具 | 建议 |
|---|---|
| **Midjourney v6/v7** | `--style raw --ar 1:1 --s 50`（风格化别太高，否则会画成插画）；一次出 4 张挑；固定 `--seed` 保证同一角色多帧一致 |
| **SDXL / SD3.5 + pixel-art LoRA** | 推荐，最可控：pixel-art LoRA（如 `pixel-art-xl`）权重 0.8–1.0；CFG 5–7；步数 25–35；**同一角色多帧用同一 seed + 图生图（img2img, denoise 0.35–0.5）**，比纯文生图连贯得多 |
| **Flux.1 / Nano Banana / GPT-image** | 一致性最好，适合"一张图出 4 帧 sprite sheet"，但注意要求它**不要抗锯齿** |
| **Aseprite / LibreSprite** | 出了大图之后手动修 3–5 个像素，比纯 AI 出图质量高一档（推荐，尤其 Boss） |

**一致性技巧（重要）**：先出「基础帧」，满意后把它作为 **参考图 / img2img 底图**再出另外 3 帧，比每次重新文生图稳定得多。

---

## 6. 交付方式

按下面命名放到一个文件夹（`src/assets/actors/` 或直接发我）：

```
hero_idle.png      hero_walk.png      hero_hurt.png      hero_death.png
grunt_idle.png     grunt_walk.png     grunt_hurt.png     grunt_death.png
runner_idle.png    runner_walk.png    runner_hurt.png    runner_death.png
brute_idle.png     brute_walk.png     brute_hurt.png     brute_death.png
warden_idle.png    warden_walk.png    warden_hurt.png    warden_death.png
coffer_idle.png    coffer_walk.png    coffer_hurt.png    coffer_death.png
scholar_idle.png   scholar_walk.png   scholar_hurt.png   scholar_death.png
wisp_idle.png      wisp_walk.png      wisp_hurt.png      wisp_death.png
pickup.png
bullet.png
```

> 可以先只交 `*_idle.png`（10 张），我会先接进去看效果；姿势帧可以后补，
> 缺的帧现在的代码会自动用程序化派生兜底。

---

## 7. 我拿到图之后做什么（你不用管）

1. **最近邻缩到逻辑尺寸**（例：512 → 16，每 32×32 块取中心像素），保证硬像素。
2. **调色板收敛**：把颜色压到「描边 / 3 明度阶 / 眼白 / 强调色」这几档，去掉 AI 常见的几十种杂色。
3. **对齐网格**：裁掉空白边、让脚底贴底、水平居中，写入 `data/sprites.json`（字符矩阵）。
4. **补姿势帧**：缺的用 `src/assets/poses.ts` 派生（现在的行走/受击/死亡就是这么来的）。
5. 跑 `npm run typecheck && npm test`，再用 `node tools/arena-shot.mjs sheet` 出姿势总览图给你确认。

---

## 8. 验收清单（交付前自检）

- [ ] 背景真透明（不是白底/黑底）
- [ ] 没有抗锯齿、没有渐变、没有外发光
- [ ] 眼睛是纯白（或纯白+深色瞳），在深色背景上能看见
- [ ] 有近黑描边（没有描边的小怪在暗背景里会糊）
- [ ] 俯视 3/4、正脸朝观众（不是俯视头顶）
- [ ] 同一单位的 4 帧画布尺寸完全一致
- [ ] 缩到逻辑尺寸后**剪影仍然能认**（把图缩到 32px 看一眼）
- [ ] 召唤物没有角、身上有资源色标记（和普通怪区分）

---

## 9. 一页速查（复制这段就能开工）

```
pixel art game sprite, top-down 3/4 view, single character centered, facing the viewer,
{COLOR} dominant palette, 3 value steps, near-black outline, bright white eyes,
chunky readable silhouette, {GRID} logical pixel grid upscaled to {SIZE},
hard square pixels, no anti-aliasing, flat transparent background,
no ground shadow, no glow, no text, no border

subject: {SUBJECT}
```

| 占位符 | 值 |
|---|---|
| `{COLOR}` | crimson red / orange / purple / magenta / cyan / gold / green / violet |
| `{GRID}` | 16x16（小怪/召唤物）、18x20（英雄）、20x20（重装）、26x26（Boss）、11x11（资源球）、6x6（子弹） |
| `{SIZE}` | 512x512 / 576x640 / 640x640 / 832x832 / 352x352 / 192x192 |
| `{SUBJECT}` | 见第 3 节各条目 |

negative：见第 4 节。

---

## 10. 想要更好看的两条额外建议

1. **Boss 和英雄别纯靠 AI**：出图后让美术（或你自己）在 Aseprite 里手动修 20–30 分钟，
   主要是「眼睛位置、轮廓缺口、脚底接地」，这三处决定了像素图"是不是活的"。
2. **一次只做一套**：先做 `grunt` + `hero` 两套接入游戏，看实际效果再决定其余 8 套的风格要不要调。
   风格定下来之前不要批量生成，否则返工量很大。
