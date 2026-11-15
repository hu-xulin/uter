# 09 · 动效规范（Motion Standard）

> UTER Design System 5.0 · 分册 S09。本规范定义「时长、缓动、过渡、各类交互与状态动效、骨架与降级」。**核心口径：时长与缓动按「这段动效在表达什么」分组并捆在同一个 `@utility` 里，节奏集合封闭**。**5.0 为当前唯一正式体系，3.0 保留为历史**，本文引用 3.0 §9 / §9.5 仅用于溯源。除标明已核实的真源代码位置外，未宣称任何测试通过或平台验收。

| 字段 | 值 |
|---|---|
| 文档 ID | `UDS5-S09` |
| 版本 | `5.0.0` |
| 状态 | `ACTIVE` |
| 上级规范 | `UDS5-S01`（UTER Design System 5.0 总纲） |
| 生效日期 | `2026-11-14` |
| 适用范围 | `web/` 全部组件与过渡、`foundations/motion.css`、`styles/index.css` 的 keyframes、`showcase.html` 第 15 区（Motion）；后台 / 营销 / H5 一致适用 |
| 验证状态 | `NOT_VERIFIED` |

---

## 1. 总则

| 编号 | 原则 | 说明 |
|---|---|---|
| M-1 | 按语义分组 | 时长按「动效在表达什么」分五组（交互反馈 / 营销 / 内容入场 / 循环 / 数据过渡），不按组件分。 |
| M-2 | 时长缓动捆绑 | 缓动曲线是节奏的一部分，不是独立维度；只允许使用已登记的 `ds-motion-*` 组合，禁止自由拼装。 |
| M-3 | 封闭集合 | 时长/缓动 Token 是封闭集合，未登记的 `duration-*` / `ease-[…]` 由 T11 拦截。 |
| M-4 | 性能优先 | 优先 `transform` 与 `opacity`，避免布局动画。 |
| M-5 | 不干扰操作 | 动画不得阻止用户操作，不得为普通业务组件添加过度装饰动画。 |
| M-6 | 状态含义 | Loading 动效必须有明确状态含义。 |
| M-7 | 可降级 | 必须支持 `prefers-reduced-motion: reduce`，按动画类别降级，不粗暴全局关闭。 |
| M-8 | **上游对齐·唯一值** | 3.0 §1.6 / §9 的时长与缓动集合、`@theme` 默认值修正属 `UDS5-S01` §4.2 `G2` 唯一规范值（clerk.com 未公布动效数值），5.0 继承 |

---

## 2. Duration Token（时长封闭集合）

真源 `web/src/design-system/tokens/elevation.css:80-96`（duration 与 easing 集中声明在该文件），按五组归类：

| 组 | Token | 值 | 语义 |
|---|---|---:|---|
| 交互反馈 | `--ds-motion-fast` | 100ms | 颜色、描边、透明度等「一下就够」的状态变化 |
| 交互反馈 | `--ds-motion-base` | 200ms | 展开收起、宽度位移等看得见过程的形变 |
| 交互反馈 | `--ds-motion-slow` | 350ms | 浮层视口 / 背板级整块位移（巨型菜单换页） |
| 营销节奏 | `--ds-motion-marketing-fast` | 300ms | 公共站点大区块位移与展开 |
| 营销节奏 | `--ds-motion-marketing-base` | 500ms | 营销展示（比后台慢一档，刻意） |
| 内容入场 | `--ds-motion-enter` | 600ms | 首屏元素的观看节奏 |
| 循环动画 | `--ds-motion-loop-shimmer` | 1.8s | 骨架屏扫过整块 |
| 循环动画 | `--ds-motion-loop-pulse` | 1.5s | 在线点 / 状态脉冲呼吸一次 |
| 循环动画 | `--ds-motion-loop-caret` | 1s | 光标闪一次 |
| 循环动画 | `--ds-motion-loop-spin` | 0.8s | 加载圈转一圈 |
| 循环动画 | `--ds-motion-loop-marquee` | 20s | 跑马灯滚完一屏 |
| 循环动画 | `--ds-motion-loop-border` | 3.2s | 流动描边跑完一个周长 |
| 数据过渡 | `--ds-motion-data-fast` | 250ms | 数据快速变化 |
| 数据过渡 | `--ds-motion-data` | 500ms | 值在变化（进度环、数字滚动） |

> 循环动画的周期不是「快慢」，是内容走完一圈需要多久；数据过渡比交互反馈慢一档，因为「100ms 的跳变读不出 30% → 60% 的过程」（elevation.css:69-78、motion.css:69-70）。

---

## 3. Easing Token（缓动三档）

真源 `web/src/design-system/tokens/elevation.css:98-104`：

| Token | 值 | 用途 |
|---|---|---|
| `--ds-motion-ease` | `cubic-bezier(0.4, 0, 0.2, 1)` | 后台交互标准曲线：两端对称、不抢戏，全站默认 |
| `--ds-motion-ease-marketing` | `cubic-bezier(0.16, 1, 0.3, 1)` | 营销面先快后缓：起手干脆、收尾拉长 |
| `--ds-motion-ease-snappy` | `cubic-bezier(0.22, 1, 0.36, 1)` | 整块位移（巨型菜单视口、背板滑入）略缓一档的 ease-out-quint |

| 禁止项 | 依据 |
|---|---|
| 裸写 `ease-in` / `ease-out` / `ease-in-out` / `linear` 作为交互过渡（`linear` 仅允许无限循环位移，如 marquee） | 3.0 §9.2 |
| 自定义第四档贝塞尔曲线 | 3.0 §9.2 |
| 同一组件混用两档曲线 | 3.0 §9.2 |

---

## 4. 七个 `@utility ds-motion-*`（消费层唯一入口）

真源 `web/src/design-system/foundations/motion.css:41-79`。**必须写成 `@utility` 而非 `@layer utilities { .ds-motion-x }`**——只有 `@utility` 注册的类才被 Tailwind 变体系统识别，`data-ending-style:ds-motion-fast` 这类写法才会生成对应选择器（motion.css:35-38）。

| # | Utility | 时长 Token | 缓动 Token | 场景 |
|---:|---|---|---|---|
| 1 | `ds-motion-fast` | `--ds-motion-fast` 100ms | `--ds-motion-ease` | 颜色/描边/透明度状态变化 |
| 2 | `ds-motion-base` | `--ds-motion-base` 200ms | `--ds-motion-ease` | 展开收起、宽度位移 |
| 3 | `ds-motion-slow` | `--ds-motion-slow` 350ms | `--ds-motion-ease-snappy` | 浮层视口 / 背板整块位移 |
| 4 | `ds-motion-marketing-fast` | `--ds-motion-marketing-fast` 300ms | `--ds-motion-ease-marketing` | 营销面微交互（悬停、描边、下划线生长） |
| 5 | `ds-motion-marketing` | `--ds-motion-marketing-base` 500ms | `--ds-motion-ease-marketing` | 营销面容器级位移（整块展开、移动端全屏菜单） |
| 6 | `ds-motion-data` | `--ds-motion-data` 500ms | `--ds-motion-ease` | 进度环、数字滚动 |
| 7 | `ds-motion-data-fast` | `--ds-motion-data-fast` 250ms | `--ds-motion-ease` | 数据快速变化 |

> 内容入场（600ms）与循环动画（1s–20s）**不写成 `ds-motion-*` utility**：它们必须和 `@keyframes` 一起声明，拆开更难读，落在 `web/src/styles/index.css`（motion.css:28-29、elevation.css:65-79）。已核实的 keyframes 位置：`styles/index.css:171`（skeleton-shimmer）、`:281,:290`（slideDown/slideUp）、`:407,:423`（appear/appear-zoom）、`:435`（scroll-up）、`:475`（stream-fade-in）、`:497-535`（landing-* 系列）。

---

## 5. Transition 与 `@theme` 默认值（关键真源）

`web/src/design-system/tokens/elevation.css:107-124` 记录了一个真实陷阱并给出修正：

| 项 | 内容 |
|---|---|
| 问题 | `transition-colors` / `transition-transform` / `transition-all` **不写时长**时，Tailwind 读 `--default-transition-duration`（内置 **150ms**）；150ms 不在 §2 集合里，而门禁只检查显式写出的 `duration-*`，看不见裸 `transition-*`（全站曾有 103 处）。 |
| 修正 | 把默认值指到集合内，写在 `@theme` 里（写进 `:root` Tailwind 读不到，与字号阶梯同一坑）： |
| 声明 | `@theme { --default-transition-duration: var(--ds-motion-fast); --default-transition-timing-function: var(--ds-motion-ease); }`（elevation.css:121-124） |
| 含义 | **裸 `transition-*` = 交互反馈最快一档（100ms + ease）**；要更慢必须显式写 `ds-motion-base` / `ds-motion-slow` / `ds-motion-marketing-*`。 |

### 5.1 唯一放行例外

| 项 | 内容 |
|---|---|
| 例外 | `animate-in` / `animate-out` 上的 `duration-*`：tw-animate 用它设的是 `animation-duration`（进入/退出动画），与 `transition-duration` 是两个轴。 |
| 条件 | 该 `duration-*` **必须与 `animate-in` / `animate-out` 出现在同一行**，T11 按此放行（3.0 §9.5:1440-1442）。 |

---

## 6. 场景动效规定

| 场景 | 推荐时长 | 落地 utility / 写法 | 缓动 |
|---|---|---|---|
| Hover | 100–150ms | `ds-motion-fast`（后台）/ `ds-motion-marketing-fast`（营销） | `--ds-motion-ease` / marketing |
| Press / Active | 100ms | `ds-motion-fast` | `--ds-motion-ease` |
| Focus | 即时到 100ms | `ds-motion-fast`；焦点环不得被过渡裁切或延迟出现 | `--ds-motion-ease` |
| Tooltip | 100–200ms | `ds-motion-fast` / `ds-motion-base` | `--ds-motion-ease` |
| Dropdown | 150–200ms | `ds-motion-base` | `--ds-motion-ease` |
| Modal / Dialog | 200–350ms | `ds-motion-base` / `ds-motion-slow` | ease / ease-snappy |
| Drawer / Sheet | 200–350ms | `ds-motion-slow`（背板整块位移） | ease-snappy |
| 页面切换 | 200–350ms | `ds-motion-base` / `ds-motion-slow` | ease |
| 数据变化 | 250–500ms | `ds-motion-data-fast` / `ds-motion-data` | ease |
| 营销展示 | 300–500ms | `ds-motion-marketing-fast` / `ds-motion-marketing` | ease-marketing |

> 场景表与 3.0 §9.3（`:1378-1388`）一致；**营销面是唯一允许 300/500ms 的地方，且必须显式引用 `ds-motion-marketing-*` Token**，不得写裸值（3.0 §9.3:1398）。

### 6.1 Loading 与 Skeleton

| 项 | 规定 |
|---|---|
| Loading | 必须有明确状态含义；`--ds-motion-loop-spin`（0.8s）驱动加载圈（`ui/spinner.tsx` / `progress.tsx`）。 |
| Skeleton | `--ds-motion-loop-shimmer`（1.8s）驱动 `skeleton-shimmer` keyframes（`styles/index.css:167,171`）；`ui/skeleton.tsx` / `loading-state.tsx` 落地。 |
| 空/加载/错误三态 | 页面须三态齐全（Clerk 参考分析 2.14/2.15），见 `UDS5-S20` / `UDS5-S14`。 |
| 禁止 | 用装饰动画冒充加载；加载动效在 Reduce Motion 下不得完全消失导致状态不可辨认。 |

---

## 7. Reduced Motion（降级）

真源 `web/src/styles/index.css:180,461,490` 与 3.0 §9.4（`:1400-1417`）：

| 规则 | 内容 |
|---|---|
| 媒体查询 | `@media (prefers-reduced-motion: reduce) { … }`，按动画类别降级。 |
| 1 | 装饰性动画停止或显著缩短。 |
| 2 | 无限循环 Shimmer / Pulse / Caret 等非必要动画停止或替换。 |
| 3 | 页面进入/退出改为即时显示或简单透明度变化。 |
| 4 | 必要操作反馈必须保留（成功状态、焦点变化、Loading 状态）。 |
| 5 | 不得用一条全局规则粗暴关闭所有动画。 |
| 6 | 不得因 Reduce Motion 导致组件状态无法辨认。 |
| 已登记降级 | `styles/index.css:461-470` 对 `.animate-appear` / `.animate-appear-zoom` / `.animate-scroll-up` / `.animate-scroll-down` 降级；`:490` 对 `stream-fade-in` 降级。 |
| 系统偏好联动 | `styles/index.css:272` 有 `@media (prefers-reduced-motion: no-preference)` 对应分支（与 S10 系统主题偏好同源机制）。 |

---

## 8. T11 门禁：禁止未登记 `duration-*`

规则登记于 3.0 §19.5（`UTER-DESIGN-SYSTEM-3.0.md:2952`），由 `check-design-tokens.mjs`（T1–T17）执行：

| 项 | 内容 |
|---|---|
| 拦截 | 未登记动效节奏 `duration-N` / `duration-[…]` / `ease-[cubic-bezier(…)]`。 |
| 放行 | 同行出现 `animate-in` / `animate-out` 时放行（§5.1）。 |
| 禁止裸值 | `duration-150` / `duration-300` / `duration-[0.35s]`（3.0 §9.3:1397）；后台交互只用 `ds-motion-fast`(100) / `ds-motion-base`(200)，`ds-motion-slow`(350) 只给 Dialog/Sheet 整块进出。 |
| 依据 | §2 时长集合 + §3 三档缓动 + §4 七个 `@utility`。 |
| ALLOWLIST | `ALLOWLIST=[]`，无静态扫描例外。 |
| 阻断 | CI 仅以 `--strict` 为唯一阻断模式。 |

---

## 9. 禁止事项汇总

1. 禁止裸写 `duration-150` / `duration-300` / `duration-[0.35s]` / `ease-[cubic-bezier(…)]`。
2. 禁止自定义第四档贝塞尔曲线或同组件混用两档曲线。
3. 禁止把时长与缓动自由拼装（绕过 `ds-motion-*` 捆绑）。
4. 禁止用布局动画（width/height/top/left 触发重排）替代 transform/opacity。
5. 禁止为普通业务组件添加过度装饰动画、禁止动画阻止操作。
6. 禁止把 `@theme --default-transition-duration` 写进 `:root`（会静默退回 150ms）。
7. 禁止把 `@utility ds-motion-*` 改写成普通 `.ds-motion-x` 类（变体静默失效）。
8. 禁止用一条全局 `animation: none` 粗暴关闭所有动画（违反 Reduce Motion 第 5 条）。

---

## 10. 差异与例外登记

| 编号 | 内容 | 状态 |
|---|---|---|
| S09-D1 | 裸 `transition-*` 内置默认值 150ms 曾逸出集合，已由 `@theme` 修正为 `var(--ds-motion-fast)` | 已核实（elevation.css:107-124） |
| S09-D2 | `animate-in` / `animate-out` 同行 `duration-*` 为 T11 唯一放行例外 | 已核实（3.0 §9.5） |
| S09-D3 | 内容入场 / 循环动画的 keyframes 未纳入 `ds-motion-*` utility，按设计留在 `styles/index.css` | 已核实（motion.css:28-29） |
| S09-D4 | Reduce Motion 在全部 65 个 `ui/` 组件上的逐项降级覆盖 | `NOT_VERIFIED` |
| S09-D5 | 业务域蓝图《Iconography and Motion Standard》§5 动效时长 **6 档**（80 / 120 / 180 / 240 / 320 / 400ms）↔ 仓库 **14 个 duration Token**（100 / 200 / 250 / 300 / 350 / 500 / 600ms + 1.8s / 1.5s / 1s / 0.8s / 20s / 3.2s） | 已登记（**保留仓库真值**；蓝图 6 档**不是**仓库的子集，两套编号体系不同，不得混用） |
| S09-D6 | 蓝图 §5「Modal 默认 200ms；Drawer 默认 280ms」——仓库 Dialog 背板走 `duration-100`（100ms，`ui/dialog.tsx:51`）、Sheet 面板走 `ds-motion-base`（200ms，`ui/sheet.tsx:81`）、巨型菜单视口走 `ds-motion-slow`（350ms，`ui/navigation-menu.tsx:132`），三者不同且均与蓝图建议值不同 | 已登记（**保留仓库真值**；抽屉的 280ms 在仓库对应档位待核，见 `S09-D7`） |
| S09-D7 | 蓝图 §5 的 `motion.instant 80ms` / `motion.fast 120ms` / `motion.normal 180ms` / `motion.medium 240ms` / `motion.slow 320ms` / `motion.slower 400ms` 与仓库 14 档**无一一对应关系**；蓝图未提供「28ms 对应哪一档」的映射 | 已登记（**不虚构映射**；如需跨体系换算须先在仓库侧建立映射表） |
| S09-D8 | 蓝图 §7 要求响应 `prefers-reduced-motion` **与原生平台减少动态效果设置**；仓库仅实现 CSS 媒体查询，**原生平台无实现** | 已登记（与 S12 §7 三平台 `NOT_VERIFIED` 一致） |

---

## 与其他规范的关系

| 规范 | 关系 | 边界 |
|---|---|---|
| `UDS5-S01`（总纲） | 上级 | 5.0 效力、五层架构 |
| `UDS5-S07`（Elevation） | 同文件 | duration/easing Token 与 `@theme` 默认值声明在 `elevation.css`；transform 动画会创建 Stacking Context |
| `UDS5-S10`（Theme） | 关联 | `prefers-reduced-motion` 与 `prefers-color-scheme` 同属系统偏好机制 |
| `UDS5-S13`（Accessibility） | 约束 | Reduced Motion、焦点不被延迟/裁切、状态可辨认 |
| `UDS5-S14`（Component） | 落地 | 八态（含 loading）动效与状态含义 |
| `UDS5-S17`（Interaction） | 关联 | Hover / Press / Focus 三态动效 |
| `UDS5-S20`（Notification） | 关联 | 空/加载/错误三态 |
| 3.0 §1.6 / §9 / §9.5 / §19.5 T11 | 历史溯源 | 3.0 保留为历史，仅用于真源定位 |

---

## 代码实施位置

| 路径 | 职责 |
|---|---|
| `web/src/design-system/foundations/motion.css:41-79` | 7 个 `@utility ds-motion-*` 唯一声明 |
| `web/src/design-system/tokens/elevation.css:65-105` | 14 个 duration Token + 3 档 easing 声明 |
| `web/src/design-system/tokens/elevation.css:121-124` | `@theme --default-transition-duration` / `--default-transition-timing-function` |
| `web/src/styles/index.css:20,167-180,272,281-535` | `@import 'tw-animate-css'`、skeleton-shimmer / appear / landing-* keyframes、`prefers-reduced-motion` 降级 |
| `web/src/design-system/__tests__/elevation-motion.test.ts` | 12 个守卫之一，守时长/缓动集合与 Dark 阴影覆盖 |
| `web/src/components/ui/spinner.tsx` / `skeleton.tsx` / `progress.tsx` | Loading / Skeleton 落地 |
| `web/src/components/loading-state.tsx` | 加载状态封装 |
| `web/scripts/check-design-tokens.mjs` | T1–T17 静态门禁（T11） |

---

## 自动化验证

| 脚本 / npm 脚本 | 关联 | 说明 |
|---|---|---|
| `check-design-tokens.mjs` | T11 | 拦截未登记 `duration-*` / `ease-[…]`，放行 `animate-in/out` 同行写法 |
| `lint:design:strict` | 门禁 | CI 唯一阻断模式 |
| `generate-design-tokens.mjs` | 真源同步 | `--check` 校验生成 CSS 与源同步，防时长/缓动漂移 |
| `sync-design-showcase.mjs` | 展示一致 | `--check` 17 条校验含 Motion 区（showcase 第 15 区）快照 |
| `visual-regression.mjs` / `test:visual` | 视觉 | 动画首帧/末帧与 22 页 × 2 视口基线复核 |
| `test:axe`（`axe-audit.mjs`） | 无障碍 | Reduced Motion / 状态可辨认（S13 引用） |
| `elevation-motion.test.ts` | 守卫测试 | `web/src/design-system/__tests__/` 12 个守卫之一 |

> 说明：`elevation-motion.test.ts` 为守卫测试文件；门禁脚本以上表所列 `.mjs` 与 npm 脚本为限。

---

## 验证状态

| 项 | 状态 | 依据 / 备注 |
|---|---|---|
| 7 个 `@utility` 与 14 个 duration / 3 个 easing 真值 | `NOT_VERIFIED` | 已读取 `motion.css` / `elevation.css` 核实声明，本轮**未执行** `check-design-tokens.mjs --strict` |
| `@theme` 默认值修正生效（裸 `transition-*` = 100ms） | `NOT_VERIFIED` | 未在生产构建产物中复核（BASELINE-AUDIT §1 不执行全量构建） |
| T11 全库扫描无违规 | `NOT_VERIFIED` | 审计 §4.4 曾记录 0 违规 EXIT=0，本轮未执行，不继承为通过 |
| Reduce Motion 逐组件覆盖 | `NOT_VERIFIED` | 未在 65 个 `ui/` 组件上逐项核对 |
| keyframes 与 Reduce Motion 降级配对完整 | `NOT_VERIFIED` | `styles/index.css` 存在降级块，未逐 keyframe 核对 |
| `test:axe` / 视觉回归双轨 | `NOT_EXECUTED` | BASELINE-AUDIT §14 明确未执行，不得伪装 PASS |
| 平台验收（Android / iOS / HarmonyOS） | `NOT_VERIFIED` | 见 `UDS5-S12` 与 BASELINE-AUDIT §8 |

**结论**：本分册为规范声明，所有验证项均为 `NOT_VERIFIED` / `NOT_EXECUTED`，**未勾选任何测试通过或平台验收**。
