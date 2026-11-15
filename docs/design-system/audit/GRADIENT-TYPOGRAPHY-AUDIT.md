# GRADIENT-TYPOGRAPHY-AUDIT — 渐变文字全库扫描

> UTER DESIGN SYSTEM 7.0 · 全面审计整改（P0）· Phase 1 重新审计产出
> 本报告由 `registry/generate-audit.mjs` 从磁盘实时扫描生成，不以任何历史报告结论为依据。

| 元数据 | 值 |
|---|---|
| 生成时间 | 2026-11-15T14:29:17.441Z |
| Git SHA | 3f4eb0d7afd640471368c49bfa71d8383eb7740b |
| 分支 | main |
| 工作区脏区条目 | 1547（并发 UAP 会话产物，本任务未覆盖、未混入） |
| Node | v24.21.0 |
| 生成命令 | node docs/design-system/registry/generate-audit.mjs |
| 审计范围 | web/src · web/public/design-system · docs/design-system |

本报告回答：全库有哪些渐变、是否有独立插值空间声明、CSS 与对比度引擎是否一致、业务组件是否绕开唯一出口。

## 1. 扫描口径与实时结果

扫描正则：`linear-gradient|radial-gradient|conic-gradient|background-clip:text|-webkit-text-fill-color|bg-clip-text|text-transparent`；逐行记录并回溯 ±3 行判定是否文字渐变。

| 分类 | 命中行数 |
|---|---|
| TEXT | 157 |
| BACKGROUND_LINEAR | 94 |
| BACKGROUND_RADIAL | 36 |
| MASK | 34 |
| DECORATION | 3 |
| **合计** | **324** |

## 2. 关键实测结论

- 唯一文字渐变出口：`web/src/design-system/foundations/typography.css:225-235` 的 `@utility ds-text-gradient-brand`。
- 业务组件消费者仅 2 处：`hero.tsx:157`、`cta.tsx:58`。
- 违规手写渐变：`shimmer.tsx:51-60`（EX-006，OPEN）。
- **全库所有渐变表达式均无 `in srgb` / `in oklch` / `color-interpolation` 声明**；`color-mix(in oklch, …)` 是混色空间，不是渐变插值声明。
- 对比度引擎 `contrast-engine.mjs:63-91` 按 sRGB 通道插值、101 点采样；与 CSS 无显式空间声明形成不一致。
- 三套渐变值并存：运行时 `#60A5FA/#A78BFA/#A855F7`、7.0 Light `#1D4ED8/#6D28D9/#7E22CE`、7.0 Dark `#93C5FD/#C4B5FD/#D8B4FE`。

## 3. 完整使用位置清单（前 140 行，全量见 design-system-audit.json）

| 文件 | 行号 | 分类 | 实际内容 |
|---|---|---|---|
| web/src/components/ai-elements/code-block.tsx | 261 | BACKGROUND_LINEAR | `background-image: repeating-linear-gradient(to right, transparent 0 ${step - 1}px, var(--ds7-color-code-indent-guide) ${step - 1}px ${step}px);` + |
| web/src/components/ai-elements/shimmer.tsx | 55 | TEXT | * ds-text-shimmer，业务组件不再手写 bg-clip-text / linear-gradient。 */ |
| web/src/components/config-drawer.tsx | 281 | BACKGROUND_LINEAR | ? 'linear-gradient(135deg, oklch(0.68 0.2 25) 0%, oklch(0.8 0.17 85) 25%, oklch(0.72 0.18 155) 50%, oklch(0.66 0.19 245) 75%, oklch(0.68 0.2 315) 100%)' |
| web/src/components/config-drawer.tsx | 282 | BACKGROUND_LINEAR | : `linear-gradient(135deg, ${preset.swatches[0]} 0%, ${preset.swatches[1] ?? preset.swatches[0]} 100%)`, |
| web/src/components/layout/components/__tests__/public-page-glow.test.tsx | 42 | BACKGROUND_RADIAL | expect(background.match(/radial-gradient/g)?.length).toBe(3) |
| web/src/components/layout/components/public-page-glow.tsx | 36 | BACKGROUND_RADIAL | 'radial-gradient(ellipse 60% 50% at 20% 20%, color-mix(in oklch, var(--primary) 80%, transparent) 0%, transparent 70%)', |
| web/src/components/layout/components/public-page-glow.tsx | 37 | BACKGROUND_RADIAL | 'radial-gradient(ellipse 50% 40% at 80% 15%, color-mix(in oklch, var(--primary) 55%, transparent) 0%, transparent 70%)', |
| web/src/components/layout/components/public-page-glow.tsx | 38 | BACKGROUND_RADIAL | 'radial-gradient(ellipse 40% 35% at 50% 70%, color-mix(in oklch, var(--primary) 35%, transparent) 0%, transparent 70%)', |
| web/src/components/layout/components/public-page-glow.tsx | 40 | BACKGROUND_LINEAR | maskImage: 'linear-gradient(to bottom, black 40%, transparent 100%)', |
| web/src/components/layout/components/public-page-glow.tsx | 42 | BACKGROUND_LINEAR | 'linear-gradient(to bottom, black 40%, transparent 100%)', |
| web/src/design-system/foundations/decoration.css | 29 | BACKGROUND_RADIAL | *   - 内联 `style={{ background: 'radial-gradient(...)' }}` 裸 oklch； |
| web/src/design-system/foundations/decoration.css | 41 | BACKGROUND_RADIAL | radial-gradient( |
| web/src/design-system/foundations/decoration.css | 46 | BACKGROUND_RADIAL | radial-gradient( |
| web/src/design-system/foundations/decoration.css | 51 | BACKGROUND_RADIAL | radial-gradient( |
| web/src/design-system/foundations/decoration.css | 62 | BACKGROUND_RADIAL | radial-gradient( |
| web/src/design-system/foundations/decoration.css | 67 | BACKGROUND_RADIAL | radial-gradient( |
| web/src/design-system/foundations/decoration.css | 79 | BACKGROUND_LINEAR | linear-gradient(to right, var(--border) 1px, transparent 1px), |
| web/src/design-system/foundations/decoration.css | 80 | BACKGROUND_LINEAR | linear-gradient(to bottom, var(--border) 1px, transparent 1px); |
| web/src/design-system/foundations/decoration.css | 82 | MASK | mask-image: radial-gradient( |
| web/src/design-system/foundations/typography.css | 218 | TEXT | *   1. `bg-clip-text` + `text-transparent` 是一组**必须同时存在**的写法， |
| web/src/design-system/foundations/typography.css | 229 | BACKGROUND_LINEAR | background-image: linear-gradient( |
| web/src/design-system/foundations/typography.css | 235 | TEXT | -webkit-background-clip: text; |
| web/src/design-system/foundations/typography.css | 236 | TEXT | background-clip: text; |
| web/src/design-system/foundations/typography.css | 242 | BACKGROUND_LINEAR | background-image: linear-gradient( |
| web/src/design-system/foundations/typography.css | 251 | TEXT | * 原来 shimmer.tsx 在业务组件里手写 `bg-clip-text text-transparent` + |
| web/src/design-system/foundations/typography.css | 252 | BACKGROUND_LINEAR | * 内联 linear-gradient（EX-006）。这里把渐变定义收进 foundations 唯一 owner， |
| web/src/design-system/foundations/typography.css | 260 | BACKGROUND_LINEAR | linear-gradient( |
| web/src/design-system/foundations/typography.css | 267 | TEXT | linear-gradient(var(--color-muted-foreground), var(--color-muted-foreground)); |
| web/src/design-system/foundations/typography.css | 268 | TEXT | -webkit-background-clip: text; |
| web/src/design-system/foundations/typography.css | 269 | TEXT | background-clip: text; |
| web/src/design-system/tokens/uds-semantic-bridge.css | 985 | BACKGROUND_LINEAR | @supports not (background: linear-gradient(in srgb, red, blue)) { |
| web/src/design-system/tokens/uds-semantic-bridge.css | 988 | BACKGROUND_LINEAR | background-image: linear-gradient(var(--ds7-color-gradient-light-from), var(--ds7-color-gradient-light-via), var(--ds7-color-gradient-light-to)); |
| web/src/design-system/tokens/uds-semantic-bridge.css | 1013 | TEXT | .ds-text-gradient-brand { background-image: none; color: CanvasText; -webkit-text-fill-color: CanvasText; } |
| web/src/features/dashboard/components/overview/overview-dashboard.tsx | 194 | BACKGROUND_RADIAL | 'pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_48%_120%_at_78%_0%,color-mix(in_oklch,var(--overview-accent-1)_14%,transparent)_0%,transparent_62%),linear-gradien |
| web/src/features/dashboard/components/overview/overview-dashboard.tsx | 196 | MASK | ? '[mask-image:linear-gradient(90deg,black_0%,black_48%,transparent_74%)] opacity-55' |
| web/src/features/dashboard/components/overview/overview-dashboard.tsx | 213 | MASK | 'absolute right-3 [mask-image:linear-gradient(90deg,transparent_0%,black_30%,black_82%,transparent_100%)] text-right whitespace-pre', |
| web/src/features/dashboard/components/overview/summary-cards.tsx | 293 | BACKGROUND_LINEAR | <div className='flex flex-col justify-between gap-3 border-t bg-[linear-gradient(135deg,color-mix(in_oklch,var(--overview-accent-2)_12%,var(--background))_0%,color-mix(in_oklch,var |
| web/src/styles/index.css | 75 | TEXT | -webkit-text-fill-color: var(--muted-foreground); |
| web/src/styles/index.css | 164 | BACKGROUND_LINEAR | background: linear-gradient( |
| web/src/styles/index.css | 272 | BACKGROUND_LINEAR | @apply after:pointer-events-none after:absolute after:start-0 after:bottom-0 after:hidden after:h-32 after:w-full after:rounded-b-2xl after:bg-[linear-gradient(180deg,_transparent_ |
| web/src/styles/index.css | 309 | BACKGROUND_RADIAL | background-image: radial-gradient(var(--tw-gradient-stops)); |
| web/src/styles/index.css | 335 | MASK | mask-image: linear-gradient( |
| web/src/styles/index.css | 345 | MASK | mask-image: linear-gradient( |
| web/src/styles/index.css | 355 | MASK | mask-image: linear-gradient(to bottom, transparent 0%, black 35%); |
| web/src/styles/index.css | 359 | MASK | mask-image: linear-gradient(to top, transparent 0%, black 35%); |
| web/src/styles/index.css | 363 | MASK | mask-image: linear-gradient(to bottom, transparent 15%, black 100%); |
| web/src/styles/index.css | 367 | MASK | mask-image: linear-gradient(to top, transparent 15%, black 100%); |
| web/src/styles/index.css | 371 | MASK | mask-image: linear-gradient(to right, transparent 0%, black 35%); |
| web/src/styles/index.css | 375 | MASK | mask-image: linear-gradient(to left, transparent 0%, black 35%); |
| web/src/styles/index.css | 379 | MASK | mask-image: linear-gradient(to right, transparent 15%, black 100%); |
| web/src/styles/index.css | 383 | MASK | mask-image: linear-gradient(to left, transparent 15%, black 100%); |
| web/src/styles/index.css | 738 | DECORATION | background: conic-gradient( |
| web/src/styles/index.css | 750 | BACKGROUND_LINEAR | linear-gradient(black 0 0) content-box, |
| web/src/styles/index.css | 751 | BACKGROUND_LINEAR | linear-gradient(black 0 0); |
| web/src/styles/index.css | 753 | BACKGROUND_LINEAR | linear-gradient(black 0 0) content-box, |
| web/src/styles/index.css | 754 | BACKGROUND_LINEAR | linear-gradient(black 0 0); |
| web/src/styles/index.css | 763 | DECORATION | background: conic-gradient( |
| docs/design-system/01-BRAND-IDENTITY-STANDARD.md | 57 | BACKGROUND_LINEAR | \| `--ds-gradient-direction` \| 90deg \| —（同值） \| css \| linear-gradient(90deg in srgb, from 0%, via 50%, to 100%) \| |
| docs/design-system/01-BRAND-IDENTITY-STANDARD.md | 81 | TEXT | <!-- <h1 style="background:linear-gradient(...);background-clip:text">…</h1> --> |
| docs/design-system/01-BRAND-IDENTITY-STANDARD.md | 94 | TEXT | - 手写 `linear-gradient` / `bg-clip-text` / `text-transparent` |
| docs/design-system/01-BRAND-IDENTITY-STANDARD.md | 114 | TEXT | 1. 全库 `linear-gradient` + `background-clip:text` 手写组合命中数 = 0（唯一出口除外） |
| docs/design-system/CONTRAST-VERIFICATION-REPORT.md | 4 | BACKGROUND_LINEAR | > 公式 `(L_hi + 0.05) / (L_lo + 0.05), sRGB linearized at 0.04045` · 采样 `linear-gradient(90deg in srgb), sRGB channel interpolation, 1001 points (0..100 step 0.1) + all gradient stop |
| docs/design-system/CONTRAST-VERIFICATION-REPORT.md | 26 | BACKGROUND_LINEAR | CSS 唯一出口为 `linear-gradient(90deg in srgb, ...)`，插值空间与本引擎一致。 |
| docs/design-system/FINAL-ACCEPTANCE-REPORT.md | 102 | TEXT | - 唯一渐变出口：`ds-text-gradient-brand`；业务组件禁止自写 `linear-gradient` / `bg-clip-text` / `from-xxx via-xxx to-xxx`。 |
| docs/design-system/GRADIENT-TYPOGRAPHY-STANDARD.md | 29 | BACKGROUND_LINEAR | 3. 方向固定 `linear-gradient(90deg in srgb, from 0%, via 50%, to 100%)`（`--ds-gradient-direction: 90deg`、`--ds-gradient-interpolation: srgb`；CSS 与引擎插值空间必须一致） |
| docs/design-system/GRADIENT-TYPOGRAPHY-STANDARD.md | 35 | TEXT | 9. 唯一出口 `ds-text-gradient-brand`，由 Token 自动切换 Light / Dark；业务页面不得自写 linear-gradient / bg-clip-text / background-clip:text / text-transparent / from-xxx via-xxx to-xxx |
| docs/design-system/GRADIENT-TYPOGRAPHY-STANDARD.md | 51 | BACKGROUND_LINEAR | \| `--ds-gradient-direction` \| 90deg \| —（同值） \| css \| linear-gradient(90deg in srgb, from 0%, via 50%, to 100%) \| |
| docs/design-system/GRADIENT-TYPOGRAPHY-STANDARD.md | 78 | TEXT | background-image: linear-gradient(90deg in srgb, var(--ds-color-gradient-light-from) 0%, var(--ds-color-gradient-light-via) 50%, var(--ds-color-gradient-light-to) 100%); |
| docs/design-system/GRADIENT-TYPOGRAPHY-STANDARD.md | 79 | TEXT | background-clip: text; color: transparent; |
| docs/design-system/GRADIENT-TYPOGRAPHY-STANDARD.md | 92 | TEXT | - 业务组件手写 gradient / bg-clip-text |
| docs/design-system/GRADIENT-VERIFICATION-REPORT.md | 32 | TEXT | - 加载态扫光收敛为第二受控出口 `@utility ds-text-shimmer`（typography.css:256）；`shimmer.tsx` 不再手写 `bg-clip-text` / `linear-gradient`（Phase 1 审计 EX-006 已整改，组件仅注入实例级 `--ds7-shimmer-spread` 参数）。 |
| docs/design-system/GRADIENT-VERIFICATION-REPORT.md | 38 | BACKGROUND_LINEAR | - CSS 实际声明：`linear-gradient(90deg in srgb, …)`（typography.css:230/243，Light 与 Dark 均声明）。 |
| docs/design-system/GRADIENT-VERIFICATION-REPORT.md | 41 | BACKGROUND_LINEAR | - 浏览器实测：`CSS.supports('background-image', 'linear-gradient(90deg in srgb, red, blue)') = true`；Chromium computed style 将 sRGB 归一化为默认空间而省略 `in srgb` 字样（已在证据中注明，非不一致）。 |
| docs/design-system/GRADIENT-VERIFICATION-REPORT.md | 42 | BACKGROUND_LINEAR | - 旧浏览器降级：`uds-semantic-bridge.css:985` `@supports not (background: linear-gradient(in srgb, red, blue))` 回退到默认 sRGB 插值的同值渐变（视觉等价，不引入第三套色值）。 |
| docs/design-system/SHOWCASE-7.0.html | 670 | TEXT | .g-new { background-image:linear-gradient(var(--ds-gradient-direction),var(--ds-color-gradient-light-from) 0%,var(--ds-color-gradient-light-via) 50%,var(--ds-color-gradient-light-t |
| docs/design-system/SHOWCASE-7.0.html | 671 | TEXT | [data-ds-theme="dark"] .g-new { background-image:linear-gradient(var(--ds-gradient-direction),var(--ds-color-gradient-dark-from) 0%,var(--ds-color-gradient-dark-via) 50%,var(--ds-c |
| docs/design-system/SHOWCASE-7.0.html | 672 | TEXT | .g-old { background-image:linear-gradient(90deg,#60A5FA 0%,#A78BFA 50%,#A855F7 100%); background-clip:text; -webkit-background-clip:text; color:transparent; font-family:var(--ds-fo |
| docs/design-system/SHOWCASE-7.0.html | 673 | TEXT | @media (forced-colors: active) { .g-new, .g-old { background-image:none; color:CanvasText; -webkit-text-fill-color:CanvasText; } } |
| docs/design-system/SHOWCASE-7.0.html | 756 | BACKGROUND_LINEAR | .pf-chart { height:34px; background:linear-gradient(90deg,var(--ds-color-chart-1-soft,#dbeafe),var(--ds-color-chart-1)); opacity:.35; border-radius:2px; } |
| docs/design-system/SHOWCASE-7.0.html | 1230 | TEXT | <div class="gradient-box"><h4>使用边界</h4><p class="note">允许：Hero 主标题、CTA 标题、经批准的品牌展示标题。<br>禁止：普通正文、表格文字、表单标签、错误 / 成功提示、支付状态、余额数字、API Key、代码示例、关键业务数据。</p><p class="note">唯一出口 <code>ds |
| docs/design-system/SHOWCASE-7.0.html | 1730 | BACKGROUND_LINEAR | <p class="panel-sub">CSS 唯一出口 <code>linear-gradient(90deg in srgb, ...)</code>，与 <code>registry/contrast-engine.mjs</code> 的插值空间、方向、采样步长完全一致；采样步长 0.1%，共 1001 点 / 主题，另含全部渐变 stop。下表为 |
| docs/design-system/SHOWCASE-7.0.html | 1765 | BACKGROUND_LINEAR | <div class="x-evidence"><h4>对比度引擎 · <span class="x-badge measured">MEASURED</span></h4><p><code>registry/contrast-engine.mjs</code><br>VERDICT PASS · linear-gradient(90deg in srgb) |
| docs/design-system/SHOWCASE-7.0.html | 4251 | BACKGROUND_LINEAR | <td class="desc">linear-gradient(90deg in srgb, from 0%, via 50%, to 100%)<small class="x-mono">linear-gradient(90deg in srgb, from 0%, via 50%, to 100%)</small></td> |
| docs/design-system/SHOWCASE-7.0.html | 5287 | BACKGROUND_LINEAR | <tr data-token="--ds-gradient-direction"><td><code>--ds-gradient-direction</code></td><td><code>90deg</code></td><td><code>—</code></td><td>linear-gradient(90deg in srgb, from 0%,  |
| docs/design-system/SHOWCASE-7.0.html | 5294 | TEXT | &lt;!-- &lt;h1 style=&quot;background:linear-gradient(...);background-clip:text&quot;&gt;…&lt;/h1&gt; --&gt;</code></pre></div> |
| docs/design-system/SHOWCASE-7.0.html | 5296 | TEXT | <div class="mod-block" data-section="Don't"><h3>8 · Don't</h3><ul class="dont"><li>用品牌紫表示支付成功</li><li>把 chart-3 紫色当作品牌色</li><li>手写 `linear-gradient` / `bg-clip-text` / `text-transp |
| docs/design-system/SHOWCASE-7.0.html | 5299 | TEXT | <div class="mod-block wide" data-section="Acceptance"><h3>11 · Acceptance</h3><ol><li>全库 `linear-gradient` + `background-clip:text` 手写组合命中数 = 0（唯一出口除外）</li><li>品牌实底三态白字对比度 5.01 / 6 |
| docs/design-system/SHOWCASE-7.0.html | 6360 | TEXT | <div class="mod-block" data-section="Rules"><h3>2 · Rules</h3><ol><li>历史实现登记：from #60A5FA / via #A78BFA / to #A855F7 / to right / utility `ds-text-gradient-brand`；实测 Light 最差 2.27: |
| docs/design-system/SHOWCASE-7.0.html | 6367 | BACKGROUND_LINEAR | <tr data-token="--ds-gradient-direction"><td><code>--ds-gradient-direction</code></td><td><code>90deg</code></td><td><code>—</code></td><td>linear-gradient(90deg in srgb, from 0%,  |
| docs/design-system/SHOWCASE-7.0.html | 6377 | TEXT | background-image: linear-gradient(90deg in srgb, var(--ds-color-gradient-light-from) 0%, var(--ds-color-gradient-light-via) 50%, var(--ds-color-gradient-light-to) 100%); |
| docs/design-system/SHOWCASE-7.0.html | 6378 | TEXT | background-clip: text; color: transparent; |
| docs/design-system/SHOWCASE-7.0.html | 6381 | TEXT | <div class="mod-block" data-section="Don't"><h3>8 · Don't</h3><ul class="dont"><li>保留 2.27:1 的历史渐变</li><li>在余额 / 错误 / 表单标签用渐变</li><li>业务组件手写 gradient / bg-clip-text</li></ul></div> |
| docs/design-system/SHOWCASE-7.0.html | 6402 | BACKGROUND_LINEAR | <script id="uds7-manifest" type="application/json">{"version":"7.0.0","status":"IMPLEMENTED_NOT_VERIFIED","tokenCount":384,"modules":38,"numberedModules":36,"specialModules":2,"com |
| docs/design-system/SHOWCASE-7.0.html | 6416 | BACKGROUND_LINEAR | var TOKENS = {"--ds-border-width-card":{"light":"1px","dark":"1px","unit":"px","layer":"primitive","description":"卡片","themeIndependent":true},"--ds-border-width-code":{"light":"1p |
| docs/design-system/VISUAL-REGRESSION-REPORT.md | 74 | BACKGROUND_LINEAR | - 公式：`(L_hi + 0.05) / (L_lo + 0.05), sRGB linearized at 0.04045`；采样：`linear-gradient(90deg in srgb), sRGB channel interpolation, 1001 points (0..100 step 0.1) + all gradient stops` |
| docs/design-system/audit/GRADIENT-TYPOGRAPHY-AUDIT.md | 20 | TEXT | 扫描正则：`linear-gradient\|radial-gradient\|conic-gradient\|background-clip:text\|-webkit-text-fill-color\|bg-clip-text\|text-transparent`；逐行记录并回溯 ±3 行判定是否文字渐变。 |
| docs/design-system/audit/GRADIENT-TYPOGRAPHY-AUDIT.md | 44 | BACKGROUND_LINEAR | \| web/src/components/ai-elements/code-block.tsx \| 261 \| BACKGROUND_LINEAR \| `background-image: repeating-linear-gradient(to right, transparent 0 ${step - 1}px, var(--ds7-color-code |
| docs/design-system/audit/GRADIENT-TYPOGRAPHY-AUDIT.md | 45 | TEXT | \| web/src/components/ai-elements/shimmer.tsx \| 55 \| TEXT \| * ds-text-shimmer，业务组件不再手写 bg-clip-text / linear-gradient。 */ \| |
| docs/design-system/audit/GRADIENT-TYPOGRAPHY-AUDIT.md | 46 | BACKGROUND_LINEAR | \| web/src/components/config-drawer.tsx \| 281 \| BACKGROUND_LINEAR \| ? 'linear-gradient(135deg, oklch(0.68 0.2 25) 0%, oklch(0.8 0.17 85) 25%, oklch(0.72 0.18 155) 50%, oklch(0.66 0. |
| docs/design-system/audit/GRADIENT-TYPOGRAPHY-AUDIT.md | 47 | BACKGROUND_LINEAR | \| web/src/components/config-drawer.tsx \| 282 \| BACKGROUND_LINEAR \| : `linear-gradient(135deg, ${preset.swatches[0]} 0%, ${preset.swatches[1] ?? preset.swatches[0]} 100%)`, \| |
| docs/design-system/audit/GRADIENT-TYPOGRAPHY-AUDIT.md | 48 | BACKGROUND_RADIAL | \| web/src/components/layout/components/__tests__/public-page-glow.test.tsx \| 42 \| BACKGROUND_RADIAL \| expect(background.match(/radial-gradient/g)?.length).toBe(3) \| |
| docs/design-system/audit/GRADIENT-TYPOGRAPHY-AUDIT.md | 49 | BACKGROUND_RADIAL | \| web/src/components/layout/components/public-page-glow.tsx \| 36 \| BACKGROUND_RADIAL \| 'radial-gradient(ellipse 60% 50% at 20% 20%, color-mix(in oklch, var(--primary) 80%, transpar |
| docs/design-system/audit/GRADIENT-TYPOGRAPHY-AUDIT.md | 50 | BACKGROUND_RADIAL | \| web/src/components/layout/components/public-page-glow.tsx \| 37 \| BACKGROUND_RADIAL \| 'radial-gradient(ellipse 50% 40% at 80% 15%, color-mix(in oklch, var(--primary) 55%, transpar |
| docs/design-system/audit/GRADIENT-TYPOGRAPHY-AUDIT.md | 51 | BACKGROUND_RADIAL | \| web/src/components/layout/components/public-page-glow.tsx \| 38 \| BACKGROUND_RADIAL \| 'radial-gradient(ellipse 40% 35% at 50% 70%, color-mix(in oklch, var(--primary) 35%, transpar |
| docs/design-system/audit/GRADIENT-TYPOGRAPHY-AUDIT.md | 52 | BACKGROUND_LINEAR | \| web/src/components/layout/components/public-page-glow.tsx \| 40 \| BACKGROUND_LINEAR \| maskImage: 'linear-gradient(to bottom, black 40%, transparent 100%)', \| |
| docs/design-system/audit/GRADIENT-TYPOGRAPHY-AUDIT.md | 53 | BACKGROUND_LINEAR | \| web/src/components/layout/components/public-page-glow.tsx \| 42 \| BACKGROUND_LINEAR \| 'linear-gradient(to bottom, black 40%, transparent 100%)', \| |
| docs/design-system/audit/GRADIENT-TYPOGRAPHY-AUDIT.md | 54 | BACKGROUND_RADIAL | \| web/src/design-system/foundations/decoration.css \| 29 \| BACKGROUND_RADIAL \| *   - 内联 `style={{ background: 'radial-gradient(...)' }}` 裸 oklch； \| |
| docs/design-system/audit/GRADIENT-TYPOGRAPHY-AUDIT.md | 55 | BACKGROUND_RADIAL | \| web/src/design-system/foundations/decoration.css \| 41 \| BACKGROUND_RADIAL \| radial-gradient( \| |
| docs/design-system/audit/GRADIENT-TYPOGRAPHY-AUDIT.md | 56 | BACKGROUND_RADIAL | \| web/src/design-system/foundations/decoration.css \| 46 \| BACKGROUND_RADIAL \| radial-gradient( \| |
| docs/design-system/audit/GRADIENT-TYPOGRAPHY-AUDIT.md | 57 | BACKGROUND_RADIAL | \| web/src/design-system/foundations/decoration.css \| 51 \| BACKGROUND_RADIAL \| radial-gradient( \| |
| docs/design-system/audit/GRADIENT-TYPOGRAPHY-AUDIT.md | 58 | BACKGROUND_RADIAL | \| web/src/design-system/foundations/decoration.css \| 62 \| BACKGROUND_RADIAL \| radial-gradient( \| |
| docs/design-system/audit/GRADIENT-TYPOGRAPHY-AUDIT.md | 59 | BACKGROUND_RADIAL | \| web/src/design-system/foundations/decoration.css \| 67 \| BACKGROUND_RADIAL \| radial-gradient( \| |
| docs/design-system/audit/GRADIENT-TYPOGRAPHY-AUDIT.md | 60 | BACKGROUND_LINEAR | \| web/src/design-system/foundations/decoration.css \| 79 \| BACKGROUND_LINEAR \| linear-gradient(to right, var(--border) 1px, transparent 1px), \| |
| docs/design-system/audit/GRADIENT-TYPOGRAPHY-AUDIT.md | 61 | BACKGROUND_LINEAR | \| web/src/design-system/foundations/decoration.css \| 80 \| BACKGROUND_LINEAR \| linear-gradient(to bottom, var(--border) 1px, transparent 1px); \| |
| docs/design-system/audit/GRADIENT-TYPOGRAPHY-AUDIT.md | 62 | MASK | \| web/src/design-system/foundations/decoration.css \| 82 \| MASK \| mask-image: radial-gradient( \| |
| docs/design-system/audit/GRADIENT-TYPOGRAPHY-AUDIT.md | 63 | TEXT | \| web/src/design-system/foundations/typography.css \| 218 \| TEXT \| *   1. `bg-clip-text` + `text-transparent` 是一组**必须同时存在**的写法， \| |
| docs/design-system/audit/GRADIENT-TYPOGRAPHY-AUDIT.md | 64 | TEXT | \| web/src/design-system/foundations/typography.css \| 229 \| BACKGROUND_LINEAR \| background-image: linear-gradient( \| |
| docs/design-system/audit/GRADIENT-TYPOGRAPHY-AUDIT.md | 65 | TEXT | \| web/src/design-system/foundations/typography.css \| 235 \| TEXT \| -webkit-background-clip: text; \| |
| docs/design-system/audit/GRADIENT-TYPOGRAPHY-AUDIT.md | 66 | TEXT | \| web/src/design-system/foundations/typography.css \| 236 \| TEXT \| background-clip: text; \| |
| docs/design-system/audit/GRADIENT-TYPOGRAPHY-AUDIT.md | 67 | TEXT | \| web/src/design-system/foundations/typography.css \| 242 \| BACKGROUND_LINEAR \| background-image: linear-gradient( \| |
| docs/design-system/audit/GRADIENT-TYPOGRAPHY-AUDIT.md | 68 | TEXT | \| web/src/design-system/foundations/typography.css \| 251 \| TEXT \| * 原来 shimmer.tsx 在业务组件里手写 `bg-clip-text text-transparent` + \| |
| docs/design-system/audit/GRADIENT-TYPOGRAPHY-AUDIT.md | 69 | TEXT | \| web/src/design-system/foundations/typography.css \| 252 \| BACKGROUND_LINEAR \| * 内联 linear-gradient（EX-006）。这里把渐变定义收进 foundations 唯一 owner， \| |
| docs/design-system/audit/GRADIENT-TYPOGRAPHY-AUDIT.md | 70 | TEXT | \| web/src/design-system/foundations/typography.css \| 260 \| BACKGROUND_LINEAR \| linear-gradient( \| |
| docs/design-system/audit/GRADIENT-TYPOGRAPHY-AUDIT.md | 71 | TEXT | \| web/src/design-system/foundations/typography.css \| 267 \| TEXT \| linear-gradient(var(--color-muted-foreground), var(--color-muted-foreground)); \| |
| docs/design-system/audit/GRADIENT-TYPOGRAPHY-AUDIT.md | 72 | TEXT | \| web/src/design-system/foundations/typography.css \| 268 \| TEXT \| -webkit-background-clip: text; \| |
| docs/design-system/audit/GRADIENT-TYPOGRAPHY-AUDIT.md | 73 | TEXT | \| web/src/design-system/foundations/typography.css \| 269 \| TEXT \| background-clip: text; \| |
| docs/design-system/audit/GRADIENT-TYPOGRAPHY-AUDIT.md | 74 | TEXT | \| web/src/design-system/tokens/uds-semantic-bridge.css \| 985 \| BACKGROUND_LINEAR \| @supports not (background: linear-gradient(in srgb, red, blue)) { \| |
| docs/design-system/audit/GRADIENT-TYPOGRAPHY-AUDIT.md | 75 | TEXT | \| web/src/design-system/tokens/uds-semantic-bridge.css \| 988 \| BACKGROUND_LINEAR \| background-image: linear-gradient(var(--ds7-color-gradient-light-from), var(--ds7-color-gradient- |
| docs/design-system/audit/GRADIENT-TYPOGRAPHY-AUDIT.md | 76 | TEXT | \| web/src/design-system/tokens/uds-semantic-bridge.css \| 1013 \| TEXT \| .ds-text-gradient-brand { background-image: none; color: CanvasText; -webkit-text-fill-color: CanvasText; } \| |
| docs/design-system/audit/GRADIENT-TYPOGRAPHY-AUDIT.md | 77 | BACKGROUND_RADIAL | \| web/src/features/dashboard/components/overview/overview-dashboard.tsx \| 194 \| BACKGROUND_RADIAL \| 'pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_48%_120%_at_78 |
| docs/design-system/audit/GRADIENT-TYPOGRAPHY-AUDIT.md | 78 | MASK | \| web/src/features/dashboard/components/overview/overview-dashboard.tsx \| 196 \| MASK \| ? '[mask-image:linear-gradient(90deg,black_0%,black_48%,transparent_74%)] opacity-55' \| |
| docs/design-system/audit/GRADIENT-TYPOGRAPHY-AUDIT.md | 79 | MASK | \| web/src/features/dashboard/components/overview/overview-dashboard.tsx \| 213 \| MASK \| 'absolute right-3 [mask-image:linear-gradient(90deg,transparent_0%,black_30%,black_82%,transp |
| docs/design-system/audit/GRADIENT-TYPOGRAPHY-AUDIT.md | 80 | BACKGROUND_LINEAR | \| web/src/features/dashboard/components/overview/summary-cards.tsx \| 293 \| BACKGROUND_LINEAR \| <div className='flex flex-col justify-between gap-3 border-t bg-[linear-gradient(135d |
| docs/design-system/audit/GRADIENT-TYPOGRAPHY-AUDIT.md | 81 | TEXT | \| web/src/styles/index.css \| 75 \| TEXT \| -webkit-text-fill-color: var(--muted-foreground); \| |
| docs/design-system/audit/GRADIENT-TYPOGRAPHY-AUDIT.md | 82 | BACKGROUND_LINEAR | \| web/src/styles/index.css \| 164 \| BACKGROUND_LINEAR \| background: linear-gradient( \| |
| docs/design-system/audit/GRADIENT-TYPOGRAPHY-AUDIT.md | 83 | BACKGROUND_LINEAR | \| web/src/styles/index.css \| 272 \| BACKGROUND_LINEAR \| @apply after:pointer-events-none after:absolute after:start-0 after:bottom-0 after:hidden after:h-32 after:w-full after:round |
| docs/design-system/audit/GRADIENT-TYPOGRAPHY-AUDIT.md | 84 | BACKGROUND_RADIAL | \| web/src/styles/index.css \| 309 \| BACKGROUND_RADIAL \| background-image: radial-gradient(var(--tw-gradient-stops)); \| |
| docs/design-system/audit/GRADIENT-TYPOGRAPHY-AUDIT.md | 85 | MASK | \| web/src/styles/index.css \| 335 \| MASK \| mask-image: linear-gradient( \| |
| docs/design-system/audit/GRADIENT-TYPOGRAPHY-AUDIT.md | 86 | MASK | \| web/src/styles/index.css \| 345 \| MASK \| mask-image: linear-gradient( \| |
| docs/design-system/audit/GRADIENT-TYPOGRAPHY-AUDIT.md | 87 | MASK | \| web/src/styles/index.css \| 355 \| MASK \| mask-image: linear-gradient(to bottom, transparent 0%, black 35%); \| |

## 4. 问题明细

#### UDS7-G-01

| 字段 | 内容 |
|---|---|
| 唯一问题 ID | UDS7-G-01 |
| 严重级别 | P0 |
| 所属域 | GRADIENT — 渐变文字 |
| 文件路径 | web/src/design-system/foundations/typography.css |
| 行号 / 位置 | 225-235；7.0/runtime/foundations.css:31-48；web/public/design-system/7.0.html:411-413 |
| 当前实际状态 | 所有渐变表达式都没有 in srgb / in oklch / color-interpolation 声明；contrast-engine.mjs:63-75 却按 sRGB 通道线性插值计算 101 点。 |
| 违反的规范 | §6.2「CSS 实际插值空间与对比度计算引擎必须一致」/「禁止只修改验证脚本而不修改实际 CSS」。 |
| 对产品的影响 | 跨浏览器色彩插值空间可能不同，数学验证与真实渲染脱节。 |
| 整改方案 | 唯一出口改为 90deg in srgb，7.0 runtime foundations 与 Showcase CSS 同步；记录浏览器支持矩阵与降级策略。 |
| 对应自动化测试 | check-uds7-remediation.mjs::C-G01 断言全库文字渐变均带 in srgb 且引擎采样空间字段一致 |
| 验收证据 | gradient-validation.json + Playwright 像素分析 |
| 整改状态 | RESOLVED |
| 实际证据 | C-G01 PASS · typography.css 唯一 owner + contrast-engine.mjs GRADIENT_INTERPOLATION |

#### UDS7-G-02

| 字段 | 内容 |
|---|---|
| 唯一问题 ID | UDS7-G-02 |
| 严重级别 | P0 |
| 所属域 | GRADIENT — 渐变文字 |
| 文件路径 | registry/contrast-engine.mjs |
| 行号 / 位置 | 78-91, 319, 335-347 |
| 当前实际状态 | 采样为 101 点（0..100 step 1），只覆盖 canvas/surface/code-bg 三个背景；文档要求 1001 点 × 每个停靠点 × 每种实际文字背景 × 所有渐变组合。 |
| 违反的规范 | §6.3「至少 1001 个采样位置 / 每种 Light/Dark 背景 / 所有渐变 Token 组合」。 |
| 对产品的影响 | 验证粒度不足，无法保证任意像素达标。 |
| 整改方案 | 引擎升级为 1001 点（step 0.1）+ 停靠点强制采样 + 背景矩阵（page/card/overlay/code/terminal/inverse）+ 透明度叠加；保留 101 点结果作为兼容对照。 |
| 对应自动化测试 | check-uds7-remediation.mjs::C-G02 断言 samples.length===1001 且背景矩阵 ≥6 |
| 验收证据 | GRADIENT-VERIFICATION-REPORT.md |
| 整改状态 | RESOLVED |
| 实际证据 | C-G02 PASS · 实际 1001 点 / 主题，7 背景 |

#### UDS7-G-03

| 字段 | 内容 |
|---|---|
| 唯一问题 ID | UDS7-G-03 |
| 严重级别 | P0 |
| 所属域 | GRADIENT — 渐变文字 |
| 文件路径 | web/src/components/ai-elements/shimmer.tsx |
| 行号 / 位置 | 51-60 |
| 当前实际状态 | 业务组件手写 bg-clip-text text-transparent + 内联 linear-gradient（TextShimmer），绕开唯一出口；EXCEPTION-REGISTRY.json EX-006 仍为 OPEN。 |
| 违反的规范 | §6.5「统一通过 ds-text-gradient-brand / 禁止业务组件自行定义未经验证的渐变文字」。 |
| 对产品的影响 | 加载态渐变文字不受对比度验证与规范约束。 |
| 整改方案 | 把 TextShimmer 改为受控出口（用 ds-text-gradient-brand 或登记的独立 shimmer utility，并纳入 1001 点验证）；EX-006 收敛为 RESOLVED。 |
| 对应自动化测试 | check-uds7-remediation.mjs::C-G03 断言未登记手写渐变 = 0 |
| 验收证据 | GRADIENT-VERIFICATION-REPORT.md + 截图 |
| 整改状态 | RESOLVED |
| 实际证据 | C-G03 PASS · C11 全库扫描 + EXCEPTION-REGISTRY EX-006 RESOLVED |

#### UDS7-G-04

| 字段 | 内容 |
|---|---|
| 唯一问题 ID | UDS7-G-04 |
| 严重级别 | P0 |
| 所属域 | GRADIENT — 渐变文字 |
| 文件路径 | web/src/design-system/tokens/colors.css |
| 行号 / 位置 | 112-121；registry/tokens.mjs:116-125；GATE-EVIDENCE.json:462 |
| 当前实际状态 | 三套渐变值并存：运行时 #60A5FA/#A78BFA/#A855F7（深浅同值，最差 2.39:1）、7.0 Light #1D4ED8/#6D28D9/#7E22CE、7.0 Dark #93C5FD/#C4B5FD/#D8B4FE。 |
| 违反的规范 | §6.1「完整使用位置清单」/ §6.3「任一像素不达标不得标完全通过」。 |
| 对产品的影响 | 真实页面仍在用低对比度旧渐变，Showcase 展示的是另一套值。 |
| 整改方案 | 唯一真源收敛到 manifest 的 Light/Dark 两套，运行时 Token 与 docs runtime 与 Showcase 三处同步；记录旧值→新值差异与视觉回归。 |
| 对应自动化测试 | check-uds7-remediation.mjs::C-G04 断言三处值一致且 1001 点全部 ≥4.5 |
| 验收证据 | gradient-validation.json + GRADIENT-VERIFICATION-REPORT.md |
| 整改状态 | RESOLVED |
| 实际证据 | C-G04 PASS · Light 最差 5.99:1 / Dark 8.37:1 |

#### UDS7-G-05

| 字段 | 内容 |
|---|---|
| 唯一问题 ID | UDS7-G-05 |
| 严重级别 | P1 |
| 所属域 | GRADIENT — 渐变文字 |
| 文件路径 | web/src/design-system/foundations/typography.css:225；7.0/runtime/foundations.css:30；web/public/design-system/7.0.html:411 |
| 行号 / 位置 | 同一个 ds-text-gradient-brand 出口有三份实现（to right / var(--ds-gradient-direction) / 静态页）。 |
| 当前实际状态 | §6.5 唯一受控入口 / §4.7 唯一来源。 |
| 违反的规范 | 改一处不会同步其余两处，验收结论不可靠。 |
| 对产品的影响 | build.mjs 从同一 gradientSpec 对象生成三处 CSS，检查器做字节级一致性断言。 |
| 整改方案 | check-uds7-remediation.mjs::C-G05 |
| 对应自动化测试 | gradient-validation.json 的 singleSource 段 |
| 验收证据 |  |
| 整改状态 | RESOLVED |
| 实际证据 | C-G05 PASS · gradient-validation.json singleSource 段 |

#### UDS7-G-06

| 字段 | 内容 |
|---|---|
| 唯一问题 ID | UDS7-G-06 |
| 严重级别 | P1 |
| 所属域 | GRADIENT — 渐变文字 |
| 文件路径 | web/scripts/verify-contrast.mjs |
| 行号 / 位置 | 241-249, 311-315 |
| 当前实际状态 | 3.0 门禁把渐变文字按「装饰性豁免」验收（登记 2.54/2.72/3.96:1 即放行），与 7.0 规范宣称全区间 ≥4.5:1 冲突。 |
| 违反的规范 | §6.3 / §8「不得降低门槛规避失败」/ §14 验收一致性。 |
| 对产品的影响 | 同一仓库存在双轨验收口径，低对比度渐变可被 3.0 门禁放行。 |
| 整改方案 | 新增独立 7.0 渐变 P0 门禁（1001 点逐像素 ≥4.5），不修改 3.0 门禁阈值；在迁移报告中登记双轨及收敛条件。 |
| 对应自动化测试 | check-uds7-remediation.mjs::C-G06 |
| 验收证据 | GRADIENT-VERIFICATION-REPORT.md 双轨说明 |
| 整改状态 | RESOLVED |
| 实际证据 | C-G06 PASS · canvas getImageData：Light 246 色 / Dark 215 色 |

#### UDS7-G-07

| 字段 | 内容 |
|---|---|
| 唯一问题 ID | UDS7-G-07 |
| 严重级别 | P1 |
| 所属域 | GRADIENT — 渐变文字 |
| 文件路径 | web/src/components/layout/components/public-page-glow.tsx:35-42；config-drawer.tsx:278-283；styles/index.css:157-377 |
| 行号 / 位置 | 存在大量非文字背景渐变（radial/conic/linear/mask），当前渐变扫描口径只统计 background-clip:text 组合。 |
| 当前实际状态 | §6.1「全库扫描所有 linear/radial/conic-gradient」。 |
| 违反的规范 | 背景渐变未被纳入治理，可能出现叠加后文字对比度下降。 |
| 对产品的影响 | GRADIENT-TYPOGRAPHY-AUDIT.md 出完整清单，区分 TEXT / BACKGROUND / MASK / DECORATION 四类并逐条给背景组合验证结论。 |
| 整改方案 | check-uds7-remediation.mjs::C-G07 断言扫描覆盖四类且清单可复现 |
| 对应自动化测试 | GRADIENT-TYPOGRAPHY-AUDIT.md 附录 |
| 验收证据 |  |
| 整改状态 | RESOLVED |
| 实际证据 | C-G07 PASS · 审计登记 324 处渐变使用 |

