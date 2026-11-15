# GRADIENT-VERIFICATION-REPORT — 字体颜色渐变整改验证报告

> UTER DESIGN SYSTEM 7.0 · 全面审计整改（P0）· 第四阶段交付物
> 对应执行规范 §6.1–§6.5。本报告只引用真实命令产物与磁盘证据，不以历史报告结论为依据。

| 元数据 | 值 |
|---|---|
| 生成时间 | 2026-11-15 |
| 分支 | main（未创建/切换分支） |
| 验证引擎 | registry/contrast-engine.mjs（sRGB 插值，1001 点） |
| 浏览器验证 | Playwright Chromium headless（web/node_modules/playwright） |
| 机器可读证据 | audit/gradient-validation.json · audit/visual-regression.json · web/visual-regression/uds7/run-log.json |
| 结论 | **PASS**（算法采样 + 真实浏览器像素 + 无障碍三层证据齐全；整体验收状态以 final-acceptance.json 为准） |

## 1. 单一真源与受控出口（§6.5）

- 唯一文字渐变出口：`web/src/design-system/foundations/typography.css:225` 的 `@utility ds-text-gradient-brand`；Dark 覆盖在 `:241`。
- 渐变值唯一真源：`TOKEN-MANIFEST.json` 的 6 个语义 Token，经 `registry/build.mjs` 派生到 `uds-semantic-bridge.css`（`--ds7-*` 运行时名）：

| Token | Light | Dark |
|---|---|---|
| `--ds-color-gradient-light-from` | `#1D4ED8` | `#1D4ED8`（主题无关，Light 出口专用） |
| `--ds-color-gradient-light-via` | `#6D28D9` | 同上 |
| `--ds-color-gradient-light-to` | `#7E22CE` | 同上 |
| `--ds-color-gradient-dark-from` | `#93C5FD`（Dark 出口专用） | `#93C5FD` |
| `--ds-color-gradient-dark-via` | `#C4B5FD` | `#C4B5FD` |
| `--ds-color-gradient-dark-to` | `#D8B4FE` | `#D8B4FE` |

- 产品侧真实消费者仅 2 处，均为允许场景（品牌展示标题）：
  - `web/src/features/home/components/sections/hero.tsx:157`（首页 Hero 主标题）
  - `web/src/features/home/components/sections/cta.tsx:58`（宣传性标题）
- 加载态扫光收敛为第二受控出口 `@utility ds-text-shimmer`（typography.css:256）；`shimmer.tsx` 不再手写 `bg-clip-text` / `linear-gradient`（Phase 1 审计 EX-006 已整改，组件仅注入实例级 `--ds7-shimmer-spread` 参数）。
- 门禁强制：`check-design-system-7.0.mjs` C11「全库渐变文字单一 owner，重复实现必须已真实收敛」；`web/scripts/check-design-tokens.mjs` T 门禁拦截业务代码裸色值/绕出口写法。
- 禁止场景（普通正文、表格、表单标签、余额、充值金额、订单状态、支付结果、API Key、Token、代码示例、错误/警告消息）：全库扫描（audit/GRADIENT-TYPOGRAPHY-AUDIT.md，315 行命中分类清单）确认无上述场景使用文字渐变；TEXT 类命中收敛到 2 个受控出口。

## 2. 插值空间一致性（§6.2）

- CSS 实际声明：`linear-gradient(90deg in srgb, …)`（typography.css:230/243，Light 与 Dark 均声明）。
- 对比度引擎：`contrast-engine.mjs` 按 sRGB 通道线性插值，`GRADIENT_INTERPOLATION = 'srgb'`。
- 一致性断言：`gradient-validation.json.interpolationConsistent = true`（`cssInterpolation: "90deg in srgb"` ↔ `engineInterpolation: "srgb"`）。
- 浏览器实测：`CSS.supports('background-image', 'linear-gradient(90deg in srgb, red, blue)') = true`；Chromium computed style 将 sRGB 归一化为默认空间而省略 `in srgb` 字样（已在证据中注明，非不一致）。
- 旧浏览器降级：`uds-semantic-bridge.css:985` `@supports not (background: linear-gradient(in srgb, red, blue))` 回退到默认 sRGB 插值的同值渐变（视觉等价，不引入第三套色值）。
- 未「只改验证脚本不改 CSS」：owner CSS 与构建产物 dist CSS 均被实读断言（`ownerDeclaresInSrgb` / `distDeclaresInSrgb` = true，见 real-page-regression.mjs:275-276）。

## 3. 1001 点采样验证（§6.3）

命令：`node docs/design-system/registry/contrast-engine.mjs`（经 build.mjs 与 finalize.mjs 真实调用）。

- 采样数：**1001**（`sampleCount: 1001`，含全部停靠点 0% / 50% / 100%）。
- 背景矩阵：**7 种**实际文字背景（canvas / surface / raised / sunken / overlay / hero-glow / code-bg）× Light / Dark 两主题。
- 判定阈值：普通文字 ≥4.5:1（WCAG 2.2 AA）；大文本 ≥3:1 另由对比度引擎 text 组覆盖。

| 主题 | 停靠站 | 最差点 | 最差对比度 | 判定 | 旧值最差（整改前） |
|---|---|---|---|---|---|
| Light | `#1D4ED8 → #6D28D9 → #7E22CE` | 0%（from）@ hero-glow | **5.99:1** | PASS | `#60A5FA` 2.27:1 FAIL |
| Dark | `#93C5FD → #C4B5FD → #D8B4FE` | 45.4% @ raised | **8.37:1** | PASS | `#A855F7` 3.92:1 FAIL |

- 1001 × 7 × 2 全部采样点无一低于阈值（`light.worst.pass` / `dark.worst.pass` = true；逐点明细在 gradient-validation.json `samples[]`）。
- 透明度/背景叠加：hero-glow 背景按实际叠加后的合成色计算；forced-colors 场景下渐变文字回退实色（real-page-regression.mjs:298 起断言），不依赖颜色传递信息。
- 字体抗锯齿：像素级验证（§4）直接分析真实渲染截图，抗锯齿边缘像素计入统计；对比度结论基于停靠站色值与背景实算，不受抗锯齿影响。

## 4. 真实浏览器像素验证（§6.4）

命令：`node docs/design-system/registry/visual-check.mjs` 与 `node docs/design-system/registry/real-page-regression.mjs`（后者需 `web/dist` 与本地后端，由 finalize.mjs 按 G15→G17 顺序编排）。

五类测试与真实实现映射：

| 规范要求 | 实现 | 证据 |
|---|---|---|
| Gradient Light Test | visual-check light 场景 + 1001 点 Light 采样 | run-log.json verdict=PASS；gradient-validation.json light |
| Gradient Dark Test | visual-check dark 场景 + 1001 点 Dark 采样 | run-log.json；gradient-validation.json dark |
| Gradient Background Matrix Test | Showcase `#gradient-matrix` 7 背景矩阵（`data-gradient-background` ×7） | check-design-system-7.0.mjs C14 / 整改探针 C-S03 gradient7=PASS |
| Gradient Browser Rendering Test | 真实产品页 Hero 渐变截图逐像素分析 | gradient-hero-light.png / gradient-hero-dark.png（web/visual-regression/uds7/real-pages/） |
| Gradient Accessibility Test | axe-core WCAG 2.2 A+AA + 真实键盘 Tab | a11y-log.json verdict=PASS，violations=0 |

Hero 渐变截图像素实测（`audit/visual-regression.json.gradient`，pass=true）：

| 指标 | Light | Dark |
|---|---|---|
| 截图尺寸 | 491×113 | 491×113 |
| 采样像素 | 55,483 | 55,483 |
| 不同颜色数 | 246 | 215 |
| 平均亮度 | 228.49 | 47.55 |
| 非白像素占比 | 0.1556 | 1.0 |
| SHA256 | `d1dde16c4fd2dbd8…` | `5437ffb7d3b3b496…` |

断言链（real-page-regression.mjs:282-283）：`ownerDeclaresInSrgb && distDeclaresInSrgb && browserSupportsInSrgb && themePixelsDiffer && gradientIsPolychromatic && gradientVisible` 全部 true。Light/Dark 截图像素确实不同（非共用一套值），渐变多色且可见（非渲染失败/ invisible text）。

## 5. 字体规范不被渐变覆盖（§7 联动）

`ds-text-gradient-brand` 只声明 `background-image` / `background-clip` / `color: transparent`，不声明 font-family / font-size / font-weight / line-height；Hero 与 CTA 标题继续继承 Uter 标题字阶（Inter + 中文回退链），等宽数字与字重规范不受影响。`ds-text-shimmer` 同理，仅叠加扫光背景层。

## 6. 复现命令

```bash
cd /Users/lincolnhu/uter
node docs/design-system/registry/build.mjs            # 生成 manifest/bridge/Showcase + 对比度报告
node docs/design-system/registry/visual-check.mjs     # G12 Showcase 视觉（含渐变矩阵）
node docs/design-system/registry/real-page-regression.mjs  # G17 真实页 + 渐变像素（需 dist + 后端）
node docs/design-system/registry/a11y-check.mjs       # G13 axe + 键盘
node web/scripts/check-design-system-7.0.mjs                                 # C09/C11/C14/C21 断言
```

## 7. 诚实限制

- 浏览器像素证据来自 Chromium headless；Safari/Firefox 的 `in srgb` 支持由 `@supports not` 降级块兜底（降级路径未做跨浏览器像素实测，登记为未执行项）。
- 1001 点采样覆盖 7 种登记背景；产品未来新增文字背景必须先入背景矩阵再使用渐变（C11/T 门禁拦截绕出口写法）。
- 本报告 PASS 仅指渐变专项；整体验收 verdict 以 `audit/final-acceptance.json` 为准（当前 PARTIALLY_VERIFIED，用户审核未完成）。