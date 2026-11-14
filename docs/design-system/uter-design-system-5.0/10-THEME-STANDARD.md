# 10 · 主题规范（Theme Standard）

> UTER Design System 5.0 · 分册 S10。本规范定义「Light/Dark 怎么翻、主题变量怎么分层、三维独立怎么组合、切换不改什么、定制边界在哪」。**5.0 采纳 Clerk 的「主题继承 + 局部覆盖」理念，但明确不引入 `@clerk/ui` 或任何 Clerk 运行时依赖**。**5.0 为当前唯一正式体系，3.0 保留为历史**。除标明已核实的真源代码位置外，未宣称任何测试通过或平台验收。

| 字段 | 值 |
|---|---|
| 文档 ID | `UDS5-S10` |
| 版本 | `5.0.0` |
| 状态 | `ACTIVE` |
| 上级规范 | `UDS5-S01`（UTER Design System 5.0 总纲） |
| 生效日期 | `2026-11-14` |
| 适用范围 | `web/` 全局样式、design-system tokens、`showcase.html` 的 Light/Dark 与密度切换；后台 / 营销 / H5 / Electron 桌面封装一致适用 |
| 验证状态 | `NOT_VERIFIED` |

---

## 1. 总则

| 编号 | 原则 | 说明 |
|---|---|---|
| T-1 | 二维正交 + 三维独立 | Light/Dark 是**明暗轴**；`data-theme-preset` / `data-theme-radius` / `data-theme-scale` 是**三个正交维度**，可任意组合，互不耦合。 |
| T-2 | 继承 + 局部覆盖 | 基础 `:root` 声明 → 主题预设覆盖差异键 → 组件级局部覆盖；越往下作用域越小。 |
| T-3 | 切换不改状态机 | **主题切换只改外观变量，绝不改变组件状态与交互逻辑**（认证/授权/资金/表单状态一律不动）。 |
| T-4 | 成对成对 | Light / Dark 变量成对声明；新增一个语义变量必须同步声明 `.dark` 值。 |
| T-5 | 品牌基线不动 | 品牌色（Light `#5B5EE6` / `#494CC7` / `#3F42B0`；Dark `#8B8DF5` / `#A1A3F7` / `#B7B8FA`）、Inter + Noto Sans SC 保持不变（规范层保留的用户基线声明；与运行时 DTCG 真值的 **Adapt 差异见 §10.1 / S10-D7**，本轮不改任何色值）。 |
| T-6 | 刻意例外登记 | 品牌渐变**深浅同值**是刻意例外，禁止 `.dark` 覆盖（§6）。 |
| T-7 | 不引入新依赖 | 不引入 `@clerk/ui`、`@clerk/elements`、Clerk SDK、Storybook（BASELINE-AUDIT §13 第 3 条）。 |
| T-8 | 单一出口 | 组件只消费语义 Token，运行时派生/切换有单一出口（`theme-color.ts` 的 MutationObserver）。 |

---

## 2. Light / Dark（明暗轴）

全局明暗由 `web/src/styles/theme.css` 驱动（BASELINE-AUDIT §4.1 核实）：

| 机制 | 真源 | 说明 |
|---|---|---|
| Dark 变体注册 | `@custom-variant dark (&:is(.dark *))`（`theme.css:19`） | Tailwind v4 的 dark 变体按 `.dark` 祖先匹配，`dark:` 工具类由此生效 |
| 颜色翻转 | `.dark { … }`（`theme.css:590`） | 明暗调色板在 `.dark` 作用域整体翻转 |
| design-system 内部覆盖 | `tokens/generated/brand.css`（Light 8 + Dark 8 品牌色）、`tokens/elevation.css`（`.dark` 覆盖 2 档阴影） | 仅这两处有 design-system 内部 Dark 覆盖（BASELINE-AUDIT §4.1） |

### 2.1 成对声明要求

| 项 | 规定 |
|---|---|
| 变量 | 每个 `--ds-color-*` / `--border` / `--ring` 等语义变量须有 `:root`（Light）与 `.dark`（Dark）成对值。 |
| 禁止 | 禁止直接复制 Light 阴影值到 Dark（见 `UDS5-S07` E-5）；禁止仅加深阴影透明度就认定层级正确。 |
| 三层共同生效 | Dark 下「更深的阴影 + 表面色差 + 1px 边框」三层共同表达层级（3.0 §8.2）。 |
| 校验目标 | 5.0 目标：补 Light/Dark 变量成对校验器（Clerk 参考分析 2.22 `Uter Adaptation`）。当前落地情况 `NOT_VERIFIED`。 |

---

## 3. Theme Variables（主题变量分层）

| 层 | 真源 | 内容 |
|---|---|---|
| L1 Primitive | `tokens/primitives.css`（47 定义）、`tokens/generated/brand.css`（DTCG 生成） | 原始色板 / 品牌色值 |
| L2 Semantic | `tokens/semantic.css`（63）、`tokens/colors.css`（45）、`tokens/elevation.css`（27） | `--ds-*` 语义变量（组件唯一消费层） |
| L3 消费 | `foundations/*.css`（6 份）、`web/src/styles/theme.css` | `@utility` / `@layer` / 基础 `:root` 声明 |
| 基础 / 覆盖 | `theme.css`（`:root` 基础层）与 `theme-presets.css`（预设覆盖）有 **52 个同名变量** | BASELINE-AUDIT §4.1：属设计意图，预设重抄整组是 5.0 合并候选 |

> **`--text-*` 命名空间（D1，禁止删除）**：`tokens/typography.css:68` 的 `@theme { --text-sm: … }` 是 Tailwind CSS v4.3.3 的**自定义字号注册机制**（在 `@theme` 内声明即注册 `text-sm` 工具类并覆盖内置默认值），同时是运行时可读 CSS 变量；写在 `:root` 才会静默回退。T1 门禁、17 条 showcase 校验、`tokens.test.ts` 断言均依赖它，**5.0 决策为 `Adapt`（保留），禁止删除**。规范层另立 `--ds-font-*` 语义别名用于文档与跨端映射（BASELINE-AUDIT §9 D1、§4.2）。

---

## 4. Inheritance（继承）与局部覆盖

借鉴 Clerk「四层定制 / 主题继承 + 局部覆盖」理念（Clerk 参考分析来源 2、3、2.22），按 Uter 工程落地为：

| 层 | Uter 实现 | 作用域 |
|---|---|---|
| 1 基础层 | `:root` 基础调色板（`theme.css`） | 全局 |
| 2 主题预设 | `[data-theme-preset='…']` 覆盖差异键（`theme-presets.css`） | 全局（body 级） |
| 3 明暗覆盖 | `.dark [data-theme-preset='…']`（`theme-presets.css:54,91,128,165,202,239` 等成对块） | 全局 × 明暗 |
| 4 组件局部 | 组件 props + `cva()` + 语义 Token（`UDS5-S15`） | 单组件实例 |

| 硬规则 | 内容 |
|---|---|
| 禁止全局覆写 | **禁止 `appearance` 式全局覆写**（会绕过 T1–T17 门禁，Clerk 参考分析 2.23 / S15）；Uter 扩展路径是 variant / slot / composition。 |
| 嵌套弹层作用域 | 组件打开另一组件时外观经专用 props / Portal 显式传递，不隐式继承（S07 / S17）。 |
| 稳定类 | 不引入 Clerk 的 `cl-*` 稳定类体系；Uter 用自有组件 API。 |
| 不引入包 | **Reject `@clerk/ui` 主题包**（Clerk 参考分析 2.22 Decision、§3 决策汇总）。 |

> Clerk 时效性事实（必须记录，不得把弃用 API 描述为现行）：`Clerk Elements` 已随 **Clerk Core 3（2026-03-03）** 弃用，官方推荐 redesigned hooks；`localization` prop 仍为 **Experimental**。因此 5.0 **不引入任何 Clerk 运行时依赖**（Clerk 参考分析 §5、BASELINE-AUDIT D5）。

---

## 5. Switching（切换）与三维独立

### 5.1 三个正交维度

真源 `web/src/styles/theme-presets.css:23` 的用法示例：

```html
<body data-theme-preset="rose-garden" data-theme-radius="lg" data-theme-scale="sm" />
```

| 维度 | 属性 | 控制内容 | 写入位置 | 取值 / 影响 |
|---|---|---|---|---|
| 调色板 | `data-theme-preset` | 覆盖 `theme.css` 定义的基础调色板 | `theme-customization-provider.tsx:120` | underground / rose-garden / lake-view / sunset-glow / forest-whisper / ocean-breeze 等；`tokens/typography.css:159` 另有 `simple-large` 大字预设 |
| 圆角 | `data-theme-radius` | 改 `--radius` 基准，整体缩放 8 档（S06 §11） | `theme-customization-provider.tsx:131` | `theme-presets.css:674-686` 列 0 / 0.3 / 0.5 / 0.75 / 1rem 等基准档 |
| 密度 / 字号 | `data-theme-scale` | 改 `--spacing` 与 `--ds-*` 控件尺寸（S05） | `theme-customization-provider.tsx:138` | `tokens/spacing.css:30,69,87` 的 `[data-theme-scale='sm'/'lg'/'xl']` 三档；`typography.css:65` 注明只改 spacing 与控件尺寸 |

| 项 | 规定 |
|---|---|
| 正交互不干扰 | 三个属性可任意组合，改任一维度不影响另两维；`theme-preferences.test.tsx:119-121,135-137` 分别断言三者可独立写入 / 移除。 |
| 属性缺省 | 未设置时属性不存在（而非写空值），回落 `:root` 默认（`theme-preferences.test.tsx:163-165,184-186`）。 |
| 单一出口 | `web/src/lib/theme-color.ts:73,112` 的 `MutationObserver` 监听 `data-theme-preset`，是运行时派生的单一出口。 |
| 成对覆盖 | 每套预设需有 `.dark [data-theme-preset='…']` 成对块，否则 Dark 下预设不完整。 |

### 5.2 切换不改状态机（硬红线）

| 项 | 规定 |
|---|---|
| 只改外观 | 主题切换只切换 CSS 变量 / `data-*` 属性 / `.dark` 类，**不得改变组件状态与交互逻辑**。 |
| 不得触碰 | 认证 / 授权 / 资金 / 订单 / 表单校验 / 权限（Casbin / `ROLE.ADMIN` / `SUPER_ADMIN`）一律不动（BASELINE-AUDIT §13 第 2 条、D8）。 |
| 不得重挂载 | 切换不得导致受控组件（输入值、展开态、选中行、焦点位置）丢失或重挂载。 |
| 定制不改状态机 | 对应 Clerk 参考分析 2.23「定制不改动组件状态机与业务逻辑」。 |
| 持久化 | 偏好由 `ThemeCustomizationProvider`（`__root.tsx:36` 引入）在根路由注入，切换全局生效但不重建业务状态树。 |

---

## 6. System Theme（系统主题）

| 项 | 规定 |
|---|---|
| 系统明暗 | 跟随 `prefers-color-scheme`；与 `prefers-reduced-motion`（S09 §7，`styles/index.css:272` 有 `no-preference` 分支）同属系统偏好媒体查询机制。 |
| 实现口径 | 运行时以 `.dark` 类切换为准；`@custom-variant dark (&:is(.dark *))` 是 `dark:` 工具类生效前提。 |
| 具体接入 | 系统偏好 → `.dark` 类的自动映射代码未在本轮逐文件核实，登记为 `NOT_VERIFIED`（§10 S10-D3），不虚构初始化脚本。 |
| 禁止 | 不得因系统主题变化重置用户显式选择的 `data-theme-*` 偏好。 |

---

## 7. Component Theme / Semantic Theme / Custom Theme

### 7.1 Semantic Theme（语义主题）

| 项 | 规定 |
|---|---|
| 两层分离 | Primitive → Semantic 已分离（BASELINE-AUDIT §4.1、§11.1 第 4 条），5.0 保留，不倒退到 Clerk 式扁平单层 24 键。 |
| 消费 | 组件只消费 `--ds-*` 语义变量；裸色值由 `brand-colors.ts` 唯一持有（T8）。 |
| 对比度 | 语义色成对值须满足 WCAG，E24 两处待修（S13）。 |
| 透明度 | 禁止用透明度凑层级 / 悬停 / 浅底（T13–T15）。 |

### 7.2 Component Theme（组件主题）

| 项 | 规定 |
|---|---|
| 作用域 | 单组件实例级局部覆盖，走 props + `cva()` variant（S15），不引入 `appearance` 对象。 |
| 浮层作用域 | 嵌套弹层外观经专用 props 传递，作用域显式（S07 / S17）。 |
| 八态一致 | 组件 default/hover/focus/pressed/disabled/loading/error/success 八态在任何主题下都须齐备（S14）。 |
| 禁止 | 禁止组件内写死 Light 专用色导致 Dark 下不可读。 |

### 7.3 Custom Theme（自定义主题）

| 项 | 规定 |
|---|---|
| 预设 | `theme-presets.css` 的 7+ 套预设 + `simple-large` 大字预设；预设只应列差异键（当前重抄整组，为合并候选）。 |
| 新增流程 | 新增预设须同时补 Light / `.dark` 成对块、`data-theme-*` 属性契约与 showcase 快照，并按 §28.2 先改声明再改实现，不得「先改实现、后补门禁」。 |
| 品牌资产 | 品牌渐变与 logo 不随自定义主题漂移（§8）。 |

---

## 8. 品牌渐变深浅同值（刻意例外）

真源 3.0 §17.5（`:2507-2565`、`:2646-2647`、`:3475`）与 BASELINE-AUDIT §4.1：

| 项 | 内容 |
|---|---|
| 三停靠站 | `--ds-color-brand-gradient-from #60a5fa` / `-via #a78bfa` / `-to #a855f7`（blue-400 / violet-400 / purple-500）。 |
| 单一消费出口 | `@utility ds-text-gradient-brand`（`foundations/typography.css`）；组件手写 `from-… via-… to-…` 由 T7 拦下。 |
| 深浅同值 | **禁止 `:root.dark` 覆盖**：深浅主题共用同一组停靠站，深色主题靠更暗背景自然获得更高对比度。 |
| 不接 chart | 不接 `chart-*`（会随主题预设漂移，绿色预设下渐变变绿），这是对外传播资产。 |
| 例外性质 | 属**刻意例外**，已在 §26.2 登记为 B 类 **E28**（验收口径例外，不进 `ALLOWLIST`）；浅色 from 2.54:1 / via 2.72:1 / to 3.96:1 未达大文本 3:1，理由与退出条件见 `UDS5-S13`。 |
| 禁止 | 禁止通过压深停靠站「修」对比度（会直接改变品牌观感）；禁止用「禁用态豁免」解释残留。 |

---

## 9. 禁止事项汇总

1. 禁止引入 `@clerk/ui` / `@clerk/elements` / Clerk SDK / Storybook。
2. 禁止 `appearance` 式全局覆写绕过 T1–T17 门禁。
3. 禁止主题切换改变组件状态机或重挂载受控组件。
4. 禁止 `:root.dark` 覆盖品牌渐变；禁止品牌色随预设漂移。
5. 禁止删除 `@theme --text-*`（D1）。
6. 禁止新增语义变量只写 Light 不写 `.dark`。
7. 禁止因参考 Clerk 替换 Uter 认证 / 用户管理 / 组织管理 / 权限逻辑（D8）。
8. 禁止「先改实现、后补门禁」的主题值变更。

---

## 10. 差异与例外登记

| 编号 | 内容 | 状态 |
|---|---|---|
| S10-D1 | `theme.css` / `theme-presets.css` 52 个同名变量重抄 | 合并候选（BASELINE-AUDIT §4.1、§11.2 第 2 条），`NOT_VERIFIED` |
| S10-D2 | 品牌渐变深浅同值为刻意例外 E28 | 已登记（§8），5.0 保留边界 |
| S10-D3 | `prefers-color-scheme` → `.dark` 自动映射代码未逐文件核实 | `NOT_VERIFIED` |
| S10-D4 | Light/Dark 变量成对校验器 | 5.0 目标，落地 `NOT_VERIFIED` |
| S10-D5 | `brand.tokens.json` 仍为 `status: DRAFT` / `decision: AUTO_BLOCKED` | 待证据链齐备后变更（BASELINE-AUDIT §11.4 第 5 条），`NOT_VERIFIED` |
| S10-D6 | 字体轴 `data-theme-font`（system/sans/serif）未落地，代码锁 Inter + Noto Sans SC | 保留 Pending（BASELINE-AUDIT §3.1），`NOT_VERIFIED` |
| S10-D7 | 品牌基线六色与运行时 DTCG 值不一致；`brand.tokens.json` 仍 `DRAFT` / `AUTO_BLOCKED` | **Adapt**（详见 §10.1），`NOT_VERIFIED` |

### 10.1 S10-D7 · 品牌基线六色与运行时 DTCG 值差异（Adapt，2026-11-14 登记）

> 口径与 `01 §4.2`、`03 §2.1`、BASELINE-AUDIT §9 **D7**（Adapt + 分期）一致；本条为差异登记，**不是**「基线已一致」的结论。

| 来源 | 色值 | 依据 |
|---|---|---|
| 用户基线（规范层保留） | Light `#5B5EE6` / `#494CC7` / `#3F42B0`；Dark `#8B8DF5` / `#A1A3F7` / `#B7B8FA`（六色） | 用户指令品牌基线、BASELINE-AUDIT §11.1 第 1 条 |
| 运行时 DTCG 真值 | `#4F52D1` / `#4A4DC5` / `#A1A3F7` / `#B1B3FF` / `#9294F7`（Hover / Active / Dark 三态实际值，5 个；**具体态位映射未逐一核实**） | `web/src/design-system/source/brand.tokens.json`、`web/src/design-system/tokens/generated/brand.css` |

| 项 | 处置 |
|---|---|
| 事实 | 两组色值**不一致**；`brand.tokens.json` 仍为 `status: DRAFT` / `decision: AUTO_BLOCKED`，状态未解除（与 S10-D5 同源，BASELINE-AUDIT §11.4 第 5 条）。 |
| 决策 | **Adapt**（不 Reject、不照抄、不改值）：按 `AGENTS.md`「Design System Enforcement」——文档与实现冲突时，**设计值来自代码（`tokens/`、`theme.css`），规则与边界来自规范**，故**运行时以 `generated/brand.css` 为准**。 |
| 规范层 | 保留 T-5 的用户基线声明不动（品牌基线必须保留）；本差异仅作登记，不构成「基线已一致」或「色值已验收」的结论。 |
| 变更边界 | **本轮绝不改任何色值**：不改 `brand.tokens.json`、不改 `generated/brand.css`、不改组件、不改 §28 Manifest、不扩 `ALLOWLIST`；色值统一须待 `DRAFT` 解除 + 对比度/视觉证据链齐备后另立变更。 |
| 关联 | `generated/brand.css` 为 DTCG 生成（Light 8 + Dark 8，见 §2 / §3），其 Dark 覆盖与 `elevation.css` 的 2 档阴影覆盖同属 design-system 内部 Dark 覆盖，均按「设计值来自代码」处理。 |
| 状态 | `NOT_VERIFIED`（未执行色值一致性复核，不得勾选通过，不得宣称品牌基线已验收）。 |

---

## 与其他规范的关系

| 规范 | 关系 | 边界 |
|---|---|---|
| `UDS5-S01`（总纲） | 上级 | 5.0 效力、五层架构、版本治理 |
| `UDS5-S03`（Color） | 依赖 | 品牌色、语义色、Primitive/Semantic 两层定义 |
| `UDS5-S04`（Typography） | 依赖 | `@theme --text-*` 保留（D1）、`--ds-font-*` 别名、`simple-large` 预设 |
| `UDS5-S05`（Spacing） | 依赖 | `data-theme-scale` 驱动 spacing 三档 |
| `UDS5-S06`（Radius） | 依赖 | `data-theme-radius` 改 `--radius` 基准整体缩放 |
| `UDS5-S07`（Elevation） | 依赖 | `.dark` 覆盖 2 档阴影、1px 边框三层共同生效 |
| `UDS5-S09`（Motion） | 关联 | `prefers-reduced-motion` 同属系统偏好机制 |
| `UDS5-S12`（Responsive） | 约束 | 主题切换不得改变断点行为 |
| `UDS5-S13`（Accessibility） | 约束 | 成对值对比度、E24 待修、E28 例外 |
| `UDS5-S15`（Component API） | 落地 | props + cva + 语义 Token 为唯一扩展路径 |
| Clerk 参考分析 2.22 / §5 | 外部参考 | 仅理念，不引入依赖 |
| 3.0 §17.5 / §26.2 | 历史溯源 | 3.0 保留为历史，仅用于真源定位 |

---

## 代码实施位置

| 路径 | 职责 |
|---|---|
| `web/src/styles/theme.css:19,264-276,590` | `@custom-variant dark`、`--radius` 基础、`.dark` 颜色翻转 |
| `web/src/styles/theme-presets.css:23,36-239,674-686` | `[data-theme-preset]` 预设、`.dark [data-theme-preset]` 成对块、radius 基准档 |
| `web/src/context/theme-customization-provider.tsx:120,131,138` | 写入 `data-theme-preset` / `data-theme-radius` / `data-theme-scale` |
| `web/src/context/__tests__/theme-preferences.test.tsx:119-234` | 三维独立写入 / 移除断言 |
| `web/src/lib/theme-color.ts:73,112` | `MutationObserver` 监听 `data-theme-preset`（单一出口） |
| `web/src/lib/theme-radius.ts` | 运行时读取 `--radius-md` |
| `web/src/lib/__tests__/theme-color.test.tsx` | 预设切换行为测试 |
| `web/src/design-system/tokens/generated/brand.css` | 品牌色 Light 8 + Dark 8（DTCG 生成） |
| `web/src/design-system/tokens/elevation.css:127-131` | `.dark` 阴影覆盖 2 档 |
| `web/src/design-system/tokens/spacing.css:30,69,87` | `[data-theme-scale]` 三档 |
| `web/src/design-system/tokens/typography.css:65,68,159` | `@theme --text-*` 注册、`simple-large` 预设 |
| `web/src/design-system/foundations/typography.css` | `ds-text-gradient-brand` 单一出口 |
| `web/src/routes/__root.tsx:36` | `ThemeCustomizationProvider` 根路由注入 |
| `web/scripts/verify-contrast.mjs` | 品牌渐变锚定 / 深浅同值校验 |
| `web/scripts/sync-design-showcase.mjs` | Light/Dark 与密度切换快照一致性 |

---

## 自动化验证

| 脚本 / npm 脚本 | 关联 | 说明 |
|---|---|---|
| `verify-contrast.mjs`（`verify:contrast`） | 对比度 | 语义色对比度、品牌渐变逐值锚定与深浅同值（E28 口径） |
| `sync-design-showcase.mjs`（`design:showcase:check`） | 展示一致 | `--check` 17 条校验含 Light/Dark 与密度快照 |
| `generate-design-tokens.mjs` | 真源同步 | `--check` 校验 `brand.css` 与 DTCG 源同步 |
| `check-design-tokens.mjs` | T1 / T7 / T8 | 守唯一 `@theme` 来源、渐变单一出口、裸色值单一所有者 |
| `lint:design:strict` | 门禁 | CI 唯一阻断模式 |
| `test:axe`（`axe-audit.mjs`） | 无障碍 | Dark 下对比度 / 状态可辨认（S13 引用） |
| `visual-regression.mjs` / `test:visual` | 视觉 | 22 页 × 2 视口基线含 Light/Dark |
| `theme-preferences.test.tsx` / `theme-color.test.tsx` | 守卫测试 | 三维独立 / 切换行为（非门禁脚本） |

> 说明：`theme-preferences.test.tsx` 等为测试文件；门禁脚本以上表所列 `.mjs` 与 npm 脚本为限。

---

## 验证状态

| 项 | 状态 | 依据 / 备注 |
|---|---|---|
| `@custom-variant dark` / `.dark` 翻转声明 | `NOT_VERIFIED` | 已读取 `theme.css` 核实声明，本轮**未执行**渲染复核 |
| 三维独立端到端 | `NOT_VERIFIED` | `theme-preferences.test.tsx` 存在但未在本轮运行 |
| Light/Dark 变量成对完整性 | `NOT_VERIFIED` | 成对校验器为 5.0 目标，未落地 |
| 品牌渐变深浅同值 / E28 | `NOT_VERIFIED` | `verify-contrast.mjs` 本轮未执行，不继承审计曾 31 PASS |
| `prefers-color-scheme` 自动映射 | `NOT_VERIFIED` | 未逐文件核实（S10-D3） |
| 主题切换不改状态机 | `NOT_VERIFIED` | 未在受控组件上逐项验证 |
| 65 组件 Dark 可读性 / `test:axe` | `NOT_VERIFIED` | BASELINE-AUDIT §5 记 65 组件证据 0 VERIFIED |
| 视觉回归双轨 / 全量构建 | `NOT_EXECUTED` | BASELINE-AUDIT §14 明确未执行 |
| 平台验收（Android / iOS / HarmonyOS） | `NOT_VERIFIED` | 见 `UDS5-S12` 与 BASELINE-AUDIT §8 |

**结论**：本分册为规范声明，所有验证项均为 `NOT_VERIFIED` / `NOT_EXECUTED`，**未勾选任何测试通过或平台验收**。
