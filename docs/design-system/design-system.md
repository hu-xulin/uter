# UTER Design System · 设计规范

> **单一权威文件。** 本文件取代原先分散的 7 份分册（`overview` / `typography` /  
> `colors` / `spacing` / `components` / `responsive` / `exceptions`），是设计规范  
> 的唯一入口。
>
> - **设计值的权威来源是代码**：`web/src/design-system/tokens/`、  
>   `web/src/styles/theme.css`。本文档描述规则、边界与落地方式。
> - **两者不一致时以文档为准**，并应由 `web/src/design-system/__tests__/tokens.test.ts`  
>   把差异暴露出来。
> - **规范基线**：2026-10-30 字体规范 v1.1（整合外部《Uter PC Web 字体设计规范》，
>   标题阶梯调整为 28/22/18/15，其余档位沿用 2026-10-29 整合版）。正文基准
>   **14px**，16px 只给长文本（`body-long` 16/26）。
> - **本文件是 AI 执行规范的唯一上下文**：改代码前先读对应章节，不要凭记忆。

---

## 本文件的结构：规则层 + 执行层

设计规范要能被 AI 长期遵守，靠的不是"写得更长"或"反复强调必须遵守"，而是  
**把规范变成一套能被检索、被代码强制、被自动化验证的执行体系**。因此本文件  
分两层：

| 层       | 回答的问题            | 内容                         | 落点                             |
| ------- | ---------------- | -------------------------- | ------------------------------ |
| **执行层** | **AI 怎么改、怎么算做完** | [第一部分](#第一部分-执行层ai-怎么遵守规范) | 本文件 §1–§5 + `AGENTS.md`        |
| **规则层** | **具体该用什么值、什么组件** | [第三部分](#第三部分-设计值)起         | 本文件 §6–§27 + `tokens/` + `ui/` |

两层的关系：**规则层定义"什么是对的"，执行层保证"AI 只能做出对的"**。规则层写得  
再细，如果执行层缺失，AI 依然会绕过 —— 因为违规代码没有任何机制阻止它合入。

> ⚠️ **不要把设计规范只写进 AI 的系统提示词。** 提示词负责指导，代码架构和测试  
> 才负责约束。本项目的 AGENTS.md 已有专门章节指向本文件（见  
> [§4](#4-ai-执行协议)），但**真正的强制力来自 T1–T15 门禁与 92 项守卫测试**。

---

## 📋 可视化核查页

> **逐项核查请打开：`docs/design-system/showcase.html`**（双击即可，无需构建、无需起服务）

核查页把本规范的**每一个字号、每一种颜色、每一档尺寸、每一个组件**都渲染成真实  
可看的实体样本，并附上实测数值。它不是手写的示意图 —— 生成器  
（`web/scripts/generate-design-showcase.mjs`）用项目自己的 Tailwind v4 编译  
`src/styles/theme.css` 与 `src/design-system/tokens/*` 的**同一批 Token 源码**，  
因此**核查页看到的 = 线上渲染的**，且 Token 一改，重新生成即同步。

核查页提供 21 个分区，与本文件章节一一对应：

| #  | 核查页分区     | 对应本文档                         | 核查什么                                                 |
| -- | --------- | ----------------------------- | ---------------------------------------------------- |
| 1  | 字号十档      | [§12.1](#121-十档字号表)           | 每个档位的实际像素、行高、字重、渲染样本                                 |
| 2  | mono 三档   | [§12.4](#124-mono-三档)         | 13 / 14 / 16px 等宽三档的实际观感                             |
| 3  | 页面层级四层    | [§12.5](#125-页面层级四层不多不少)      | 30/24/18/16 四层并排对比                                   |
| 4  | 文字色七档     | [§11.3](#113-文字层级--fg--七档)    | 每档实际渲染出的颜色深浅                                         |
| 5  | 表面与描边     | [§11.1](#111-色板骨架)            | 表面色差与 1px 描边                                         |
| 6  | 品牌色阶      | [§11.2](#112-品牌色阶6-条语义出口一个来源) | 六档紫蓝的层次与悬停/按下区分                                      |
| 7  | 状态色       | [§11.2](#112-品牌色阶6-条语义出口一个来源) | 4 组状态色 + 4 组柔和态                                      |
| 8  | 图表分类色     | [§11.4](#114-图表色与语法高亮)        | 5 个分类色是否彼此可辨                                         |
| 9  | 语法高亮色     | [§11.4](#114-图表色与语法高亮)        | 真实代码片段的着色效果                                          |
| 10 | 首屏演示 Token | [§11.5](#115-首屏演示的效果锚定term--与品牌渐变) | term-* 语法角色 / 弱层级 / 强调色 / 背景装饰层 / 品牌渐变 |
| 11 | 圆角七档      | [§13.4](#134-圆角)              | 每档圆角的实际弧度                                            |
| 12 | 间距        | [§13.1](#131-间距)              | 4px 栅格的实际宽度                                          |
| 13 | 密度 Token  | [§13.3](#133-密度-token)        | 顶部切换 sm / xl 实时观察                                    |
| 14 | 投影六档      | [§13.6](#136-投影)              | 每档投影的实际高度感                                           |
| 15 | 动效        | [§13.7](#137-动效)              | 每档时长与用途                                              |
| 16 | Button 九档 | [§16](#16-button-的九个尺寸档)      | 九档高度/圆角 + 六种变体                                       |
| 17 | 控件尺寸      | [§15](#15-组件尺寸与-token-对应)     | 输入框/表格/胶囊高度                                          |
| 18 | 图标五档      | [§18](#18-图标)                 | 16/18/24/32/48 的实际大小                                 |
| 19 | 组件示范      | [§14](#14-组件实现位置与语义组件)        | Button/Badge/Input/Card/Dialog/Table/Toast/Empty 全组件 |
| 20 | 导航选中态     | [§17](#17-导航选中态)              | 选中态对比度实测表                                            |
| 21 | 焦点环与触控目标  | [§22](#22-触控目标与焦点环)           | 1px 焦点环与 24×24 命中区                                   |

**顶部工具栏**可切换「深色模式」与「密度 sm / xl」，所有分区随之实时变化 —— 这  
也是验证「颜色只换值不改语义」「密度只改留白不改字号」两条硬约束的最快方式。

---

## 目录

- [📋 可视化核查页](#-可视化核查页)
- [第一部分 · 执行层（AI 怎么遵守规范）](#第一部分-执行层ai-怎么遵守规范)
  - [1. 四层强制执行模型](#1-四层强制执行模型)
  - [2. 常见断层与本项目的对策](#2-常见断层与本项目的对策)
  - [3. 落地路线图](#3-落地路线图)
  - [4. AI 执行协议](#4-ai-执行协议)
  - [5. 交付验收标准](#5-交付验收标准)
- [第二部分 · 体系架构](#第二部分-体系架构)
  - [6. 分层模型](#6-分层模型)
  - [7. 目录与实现位置](#7-目录与实现位置)
  - [8. Token 三层体系](#8-token-三层体系)
  - [9. 唯一入口与导入顺序](#9-唯一入口与导入顺序)
  - [10. 主题维度独立性](#10-主题维度独立性)
- [第三部分 · 设计值](#第三部分-设计值)
  - [11. 颜色](#11-颜色)
  - [12. 字号与排版](#12-字号与排版)
  - [13. 间距、形状、描边、投影、动效](#13-间距形状描边投影动效)
- [第四部分 · 组件规范](#第四部分-组件规范)
  - [14. 组件实现位置与语义组件](#14-组件实现位置与语义组件)
  - [15. 组件尺寸与 Token 对应](#15-组件尺寸与-token-对应)
  - [16. Button 的九个尺寸档](#16-button-的九个尺寸档)
  - [17. 导航选中态](#17-导航选中态)
  - [18. 图标](#18-图标)
  - [19. 图表排版](#19-图表排版)
  - [20. 原生 button / input 的边界](#20-原生-button-input-的边界)
- [第五部分 · 响应式与可访问性](#第五部分-响应式与可访问性)
  - [21. 断点与字号策略](#21-断点与字号策略)
  - [22. 触控目标与焦点环](#22-触控目标与焦点环)
  - [23. 长文本阅读宽度](#23-长文本阅读宽度)
- [第六部分 · 质量保障](#第六部分-质量保障)
  - [24. 自动化约束](#24-自动化约束)
  - [25. 禁止事项总表](#25-禁止事项总表)
  - [26. 例外登记](#26-例外登记)
  - [27. 想改某个值时](#27-想改某个值时)

---

# 第一部分 · 执行层（AI 怎么遵守规范）

这一部分回答的不是"该用什么值"，而&#x662F;**"AI 改 UI 代码时，怎么保证它做出对的东西"**。  
规则层在第三～五部分。

## 1. 四层强制执行模型

规范要能被 AI 长期遵守，靠的不是把文档写得更长，也不是反复强调"必须遵守"，而是  
**让违反规范的代码无法轻易通过检查**。四层缺一不可：

| 层             | 负责什么                    | 本项目的落点                                                        | 状态 |
| ------------- | ----------------------- | ------------------------------------------------------------- | -- |
| **① 唯一规范源**   | Token、组件规范、交互规则、响应式规则   | `src/design-system/tokens/`、`src/styles/theme.css`、本文件 §6–§27 | ✅  |
| **② 代码层强制**   | Token、组件库、语义化 API、禁止硬编码 | `tokens/` 三层 Token、`components/ui/` 组件库、T1–T15 静态规则           | ✅  |
| **③ 自动化检查**   | 静态检查、组件测试、视觉回归          | `check-design-tokens.mjs` + 92 项守卫测试 + `bun run test:visual`（核查页双视口；**真实页面未覆盖**） | ⚠️ |
| **④ AI 交付验收** | 生成 → 检查 → 截图 → 修复 → 交付  | `AGENTS.md` 协议 + [§10 验收标准](#5-交付验收标准)                        | ⚠️ |

**核心原则：不要依赖 AI 自觉遵守规范，而要让违反规范的代码无法轻易通过检查。**

提示词负责指导，代码架构和测试才负责约束。AGENTS.md 里写一百遍"必须用 Token"，  
不如一条 `check-design-tokens.mjs --strict` 在 CI 里阻断合并。

### 1.1 为什么"文档"不够

规范与代码之间只要存在断层，AI 就会从断层里掉下去：

| 现象             | 根本原因       | 本项目的对策                                       |
| -------------- | ---------- | -------------------------------------------- |
| 每个页面字号不一样      | AI 自己决定字号  | 十档字号阶梯 + T2/T3/T4/T5/T9 拦截 + `spec-guards`   |
| 品牌色出现多个近似值     | 直接写十六进制    | 品牌色单一来源 + T7/T8 拦截 + `brand color source` 守卫 |
| 同一个按钮有多种样式     | AI 重复创建组件  | 组件实现位置唯一 + 九档 `size` 收敛                      |
| Web 与 H5 样式不一致 | 各页面独立实现    | 同一套 Token 阶梯 + 唯一输入框字号规则                     |
| 页面截图看起来不统一     | 只有代码检查，无视觉 | `bun run test:visual` 覆盖核查页；**真实业务页面待 fixtures**              |
| 改一个组件，其他页面坏掉   | 缺回归测试      | 92 项守卫测试 + 组件测试                              |
| AI 说做完了，规范仍违规  | 没有明确验收条件   | **待补：[§10 验收标准](#5-交付验收标准) 与基线机制**           |

> 最后两行是本项目当前的主要缺口，对应 [§8 路线图](#3-落地路线图) 的阶段 4 与 5。

## 2. 常见断层与本项目的对策

### 2.1 不要让 Markdown 成为唯一的规范来源

**规范值必须写在代码里，文档只解释含义。** 本项目的分工：

| 内容     | 唯一来源                                   | 文档的角色        |
| ------ | -------------------------------------- | ------------ |
| 字号阶梯取值 | `tokens/typography.css` 的 `@theme`     | 解释每档的用途与边界   |
| 颜色取值   | `styles/theme.css` 的 `:root` / `.dark` | 解释层级与对比度     |
| 控件高度   | `tokens/spacing.css`                   | 解释密度语义       |
| 组件 API | `components/ui/*.tsx` 的类型定义            | 解释组件该怎么用     |
| 禁止事项   | `check-design-tokens.mjs` 的 T1–T15     | 解释为什么禁、例外怎么办 |

文档改了而代码没改，AI 会读到过期规则；代码改了而文档没改，人会读到过期规则。  
**两者必须同提交** —— 这是本项目的既有纪律。

### 2.2 不只定义 Token，还要限制使用方式

只提供 Token 挡不住 `font-size: 15px`。本项目用了四道约束：

1. **静态门禁**：`check-design-tokens.mjs` 的 T1–T15（见 [§24](#24-自动化约束)）；
2. **Token 唯一来源**：T1 保证 `--text-*` 只能在 `typography.css` 声明；
3. **组件 API 限制**：`size` / `variant` 是封闭枚举，AI 无法发明新档位；
4. **例外需审批**：任何豁免必须登记（见 [§26](#26-例外登记)）。

> ⚠️ **不要机械禁止所有原始数值。** 边框宽度、图标尺寸、第三方库样式、图表  
> canvas 确实需要例外。本项目的做法是**默认禁止未经批准的设计值，例外必须有明确  
> 理由并经过审核** —— 门禁的 `ALLOWLIST` 与 [§26](#26-例外登记) 的编号台账必须  
> 同步登记，只改一处说明例外已经失控。

### 2.3 让 AI 优先使用组件，而不是自由发挥

组件 API 用封闭枚举收敛自由度：

```tsx
// Button：AI 可以选择已批准的变体，无法发明 purple-button-17px
type ButtonVariant =
  | 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'link'
type ButtonSize =
  | 'default' | 'sm' | 'lg' | 'icon' | 'icon-sm' | 'icon-xs' | 'icon-lg' | 'inline' | 'wrap'
```

各类组件的执行策略：

| 组件类型                    | 执行策略             |
| ----------------------- | ---------------- |
| Button、Input、Select     | **必须**使用标准组件     |
| Dialog、Dropdown、Tooltip | **必须**使用标准交互组件   |
| Typography、Badge、Card   | 优先使用标准组件         |
| 表格、导航、表单布局              | 使用标准布局与间距规则      |
| 特殊业务组件                  | 可以扩展，但必须遵循 Token |
| 全新基础组件                  | 必须先评估能否复用现有组件    |

**标准组件必须覆盖全部适用状态**，不能只有默认态：

`default` / `hover` / `focus-visible` / `active` / `disabled` / `loading` /  
`empty` / `error`。

## 3. 落地路线图

不要一开始就要求 AI 重构整个项目。先建立一个可验证的闭环，再逐步推广。

| 阶段           | 目标     | 具体动作                                                | 状态              |
| ------------ | ------ | --------------------------------------------------- | --------------- |
| 1 · 审计现有代码   | 找出断层   | 重复组件、硬编码设计值、页面级覆盖、规范与实现冲突                           | ✅ 2026-10-27～29 |
| 2 · 冻结规范基线   | 明确批准值  | 十档字号、七档文字色、品牌六档、七档圆角、六档投影、密度三档                      | ✅ 2026-10-29    |
| 3 · 建设基础组件   | 高频组件收敛 | `Text`/`Heading`/`PageHeader` + `components/ui/` 全量 | ✅ 已完成           |
| 4 · 加入自动化规则  | 禁止新增违规 | T1–T15 + 92 项守卫 + CI 阻断 + 基线快照（0 条）                 | ✅ 已完成          |
| 5 · 选取代表页面试点 | 端到端验证  | 核查页桌面 + 移动双视口已跑通；**登录态真实页面待 fixtures**                | ⚠️ 部分           |
| 6 · 接入 CI    | 形成闭环   | `ci.yml` + `release-gate.yml` 阻断；本地提交钩子             | ✅ 已完成           |

### 3.1 缺口清单（按优先级）

| 缺口                        | 影响的验收维度     | 建议做法                                          |
| ------------------------- | ----------- | --------------------------------------------- |
| **视觉回归**（Playwright 截图）   | 布局、字号、颜色、断点 | 关键页在 1440×900 与 390×844 各取基线，与基准图 diff        |
| **基线机制**                  | "新增违规必须为零"  | 门禁输出违规清单快照文件；CI 比对"新增条目"，存量条目按期清理             |
| **AGENTS.md 规范章节**        | AI 执行协议     | 指向本文件，并在仓库根建立规范入口（见 [§9](#4-ai-执行协议)）         |
| **结构化验收输出**               | 交付证据        | 每个 UI 任务交付时给出 [§10](#5-交付验收标准) 的验收表           |
| **Stylelint / ESLint 规则** | 补充拦截面       | 项目已用 `oxlint`；CSS 侧目前靠自定义脚本，可评估是否需要 Stylelint |

> **不要一次性要求全部落地。** 阶段 4 的基线机制与阶段 5 的视觉回归是收益最高的  
> 两项：前者让"历史遗留"与"新增违规"可区分，后者能发现静态检查发现不了的布局  
> 问题。

## 4. AI 执行协议

仓库根目录的 `AGENTS.md` 是 AI 的项目级指令入口，本项目已在其中新增  
**Design System Enforcement** 章节（见 [§4.7](#47-为什么这些规则必须与代码检查配合)）。  
若所用工具支持自己的规则文件（Cursor 的 `.cursor/rules`、Claude Code 的  
`CLAUDE.md` 等），应让它们**引用同一套规范**，而不是各维护一份互相冲突的指令 ——  
规范只有一个来源：`docs/design-system/design-system.md`。

### 4.1 Authority（权威来源）

批准的 Design System 是所有 UI 实现的唯一来源。改动任何 UI 代码前，先读：

- 本文件的对应章节（[§16 颜色](#11-颜色)、[§17 字号](#12-字号与排版)、  
  [§19 组件](#14-组件实现位置与语义组件) 等）；
- `src/design-system/` 下的 Token 与组件实现；
- 涉及视觉判断时打开 [核查页](#-可视化核查页)。

**如果文档与实现冲突，不要静默选一个。** 本项目的裁决顺序是：


1. **设计值** → 以代码为准（`tokens/`、`theme.css`）；
2. **规则与边界** → 以本文件为准；
3. 两者都不明确 → **不要发明新决策**，按 [§26](#26-例外登记) 登记例外并说明理由。

### 4.2 Mandatory Rules（强制规则）

- 所有颜色、字号、行高、间距、圆角、投影、动效使用批准的 Token。
- 复用 `components/ui/` 的现有组件，优先于创建新组件。
- 不引入未经批准的设计值。
- 不复制已有组件实现来绕过 Design System 限制。
- 保持既有 Design System 的 API 与命名约定。
- 遵守响应式规则（[§26](#21-断点与字号策略)）：桌面与移动共用同一套字号阶梯。
- 实现全部适用状态：交互态、加载态、空态、错误态、无障碍行为。
- 改 UI 时不夹带无关业务逻辑改动。

### 4.3 Before Implementation（动手前）

1. 读相关规范章节与现有组件实现；
2. 找出可复用的组件与 Token；
3. 明确受影响的页面、断点与交互状态；
4. **列出缺失或矛盾的设计规则** —— 有矛盾就按 §9.1 上报，不要自行发明；
5. 已有批准规则能覆盖时，不做新的设计决策。

### 4.4 During Implementation（实现中）

1. 优先用现有组件与已批准的变体；
2. 必要时才扩展 Design System，并记录理由与影响范围；
3. **绝不**为了让改动通过而禁用 lint 规则、弱化测试或绕过 CI；
4. **绝不**在未实际执行并核对结果的情况下声称测试通过。

### 4.5 Required Verification（必做的验证）

改动完成后依次执行，**逐条报告结果**：

```bash
cd web
bun run lint:design:strict                      # T1–T15 静态门禁
bun run lint:design:baseline                    # 基线比对：只允许「新增违规」为零
bunx vitest run src/design-system/__tests__     # 92 项守卫测试
npx tsgo -b --force                             # 前端类型门禁（不带 --force 会缓存误报 0 错误）
bun run test:visual                             # 核查页双视口截图回归（缺浏览器会报 BLOCKED）
```

涉及视觉改动时，额外打开 [核查页](#-可视化核查页) 对照受影响分区；涉及页面布局
时，按 [§24 视觉回归](#视觉回归) 的要求补截图核对。

### 4.6 Completion Criteria（完成的定义）

一个 UI 任务算完成，必须同时满足：

- 实现遵循已批准的设计规则；
- **没有引入新的** Token 违规（存量违规按基线处理，不算本次引入）；
- 必做检查全部通过，或剩余失败项被明确记录（含命令、输出、原因）；
- 原有业务功能未受影响；
- 提供了验证证据（命令与结果输出，必要时附截图）；
- 任何 Design System 例外都已登记并说明理由。

> **永远不要仅凭"看起来对了"或"编译通过"就报告完全合规。**

### 4.7 为什么这些规则必须与代码检查配合

`AGENTS.md` 里的每一条"必须"，在代码里都有对应的强制点：

| 协议条款     | 代码里的强制点                                                              |
| ------------ | --------------------------------------------------------------------------- |
| 用批准的 Token | T2–T5、T7–T10 + `tokens.test.ts`                                          |
| 复用现有组件 | `spec-guards.test.ts` 的组件基线守卫 + `control-typography.test.ts`        |
| 不发明新档位 | T1（`--text-*` 唯一来源）、T10（七档圆角）、T12（无 `tracking-*`）          |
| 实现全部状态 | `control-typography.test.ts`、`accessibility.test.ts`、组件测试              |
| 不绕过 CI    | `ci.yml` + `release-gate.yml` 的必需检查 + 本地提交钩子                     |
| 报告失败项   | 提交前 `git diff --cached --name-status` 复核 + 门禁退出码                   |

**这些强制点才是"规范被执行"的真正含义。** 删掉任何一条强制点，对应的规则就退化
为一句建议。

## 5. 交付验收标准

每次 AI 完成 UI 改动后，输出一份结构化验收结果。**不通过的维度必须明确写出
原因**，不能省略。

| 验收维度   | 通过条件                                 | 本项目的检查手段                            |
| ---------- | ---------------------------------------- | ------------------------------------------- |
| **颜色**   | 使用批准的 Token，无未授权色值           | T7 / T8；`semantic-colors.test.ts`          |
| **字体**   | 字号、字重、行高符合规范                 | T2–T5 / T9 / T12；`spec-guards.test.ts`     |
| **间距**   | 使用规定的间距体系                       | 密度 Token + `control-typography.test.ts`   |
| **组件**   | 优先复用标准组件，无重复造轮子           | 组件实现位置唯一；`spec-guards.test.ts`     |
| **交互**   | 适用状态全部实现                         | 组件测试 + `accessibility.test.ts`          |
| **响应式** | 指定断点行为符合规则                     | §26 规则；**视觉回归待补**                  |
| **无障碍** | 键盘、焦点、语义、对比度符合要求         | `accessibility.test.ts` + §6.5 对比度实测  |
| **回归**   | 相关业务与视觉测试通过                   | 92 项守卫 + `bun run test`；**视觉回归待补** |
| **证据**   | 命令、结果、截图、例外清单齐全           | 见 §9.6 完成定义                            |

### 5.1 对比度必须计算，不能靠肉眼

正文文字以 **WCAG AA 4.5:1** 为目标；大号文字（≥24px 常规字重或 ≥18.66px 粗体）
适用 3:1；焦点指示器、图标与组件边界按对应的非文本规则单独验收。

本项目的实测值见 [§11.6](#116-文本对比度验收)。**每次调整 Token、主题背景或
透明度后都要重算**，不能只看单个色值判断合规，深色主题必须独立验证。

### 5.2 自动化截图 ≠ 设计正确

必须区分三件事：

- **静态检查**能确定"某个颜色是否来自批准的 Token"；
- **视觉回归**能确定"页面是否与基准截图存在差异"；
- 但**视觉差异不一定是缺陷，截图一致也不意味着交互与无障碍一定合格**。

因此验收要结合自动化规则、已批准的设计稿与人工判断，而不是只依赖一种测试。
这也是视觉回归列为"待补"而非"最高优先级"的原因 —— 它抓的是布局漂移，抓不到
"这个按钮该不该存在"。

---


# 第二部分 · 体系架构

## 6. 分层模型

```
tokens/        设计值：字号、字重、行高、颜色、圆角、投影、动效
foundations/   全局基础样式：排版工具类、无障碍、动效
components/    语义基元：Text / Heading
patterns/      交互模式：PageHeader
─────────────────────────────────────────────
components/ui/ 组件库正式实现位置：Button / Input / Badge / Dialog / Table …
features/      业务组件与页面：只做组合，不重新定义视觉规则
```

**依赖方向（单向，不可逆）：**

- 下层组件不依赖上层业务组件。
- 页面不直接定义重复的基础设计规则。
- 业务组件组合基础组件，而不是重新实现按钮、输入框和弹窗。
- Token 是唯一设计值来源，组件通过语义 Token 使用设计值。
- 自动化工具负责发现违规，而不只是依靠开发者自觉。

| 层级          | 负责什么                        | 不应该负责什么      |
| ------------- | ------------------------------- | ------------------- |
| Tokens        | 定义全站统一设计值              | 页面布局和业务逻辑  |
| Foundations   | 全局字体、重置样式、无障碍基础  | 特定业务组件        |
| Components    | 按钮、输入框、标签、弹窗等      | API 请求和业务规则  |
| Patterns      | 表单组合、筛选栏、数据表格等    | 页面级业务流程      |
| Business      | API Key、模型、账单等业务组件   | 重复实现基础控件    |
| Pages         | 页面结构、数据获取和业务编排    | 自行定义全站字号体系|
| Docs / Tests  | 说明规范、验证规范              | 作为运行时样式的第二套来源 |

## 7. 目录与实现位置

```
web/
├── src/
│   ├── design-system/              # 设计系统本体
│   │   ├── tokens/                 # ① 原始值 + 语义值 + 组件级值
│   │   │   ├── primitives.css      #    原始设计值
│   │   │   ├── semantic.css        #    语义化 Token（--ds-*）
│   │   │   ├── typography.css      #    字号阶梯（唯一来源）
│   │   │   ├── spacing.css         #    间距与密度 Token
│   │   │   ├── colors.css          #    颜色语义别名
│   │   │   ├── elevation.css       #    投影、动效
│   │   │   ├── brand-colors.ts     #    第三方品牌色 / 分类色
│   │   │   ├── chart-typography.ts #    图表字号镜像
│   │   │   └── index.css
│   │   ├── themes/                 #    主题预设（在 styles/theme-presets.css）
│   │   ├── foundations/            # ② 全局基础样式
│   │   │   ├── reset.css
│   │   │   ├── typography.css
│   │   │   ├── accessibility.css
│   │   │   ├── icons.css
│   │   │   ├── motion.css
│   │   │   └── index.css
│   │   ├── components/             # ③ 语义基元（ui/ 里没有的）
│   │   │   └── typography/{text,heading}.tsx
│   │   ├── patterns/               # ④ 交互模式
│   │   │   └── page-header/
│   │   ├── __tests__/              #    Token 与守卫测试
│   │   └── index.ts
│   ├── components/
│   │   ├── ui/                     # ⑤ 组件正式实现位置
│   │   ├── business/               #    业务组件（api-key / model-selector …）
│   │   └── layout/
│   ├── features/                   # ⑥ 页面与业务编排
│   └── styles/                     # 全局样式入口
│       ├── index.css               #    全局样式唯一入口
│       ├── theme.css               #    颜色、字体栈、圆角基准、品牌色阶
│       └── theme-presets.css       #    颜色/圆角/密度预设
│
└── docs/design-system/            # ⑦ 本文件所在目录
```

### 组件实现位置只有一处

`components/ui/` 是组件的**正式实现位置**。`design-system/components/` 只补充
`ui/` 里没有的东西（Token、基础样式、`Text` / `Heading`、`PageHeader`）。

**不允许在两处各实现一遍同一个组件。** 历史上出现过的「两套按钮」是最难清理的
技术债，从一开始就不要开这个口子。

## 8. Token 三层体系

| 层         | 位置                                          | 谁可以引用       |
| ---------- | --------------------------------------------- | ---------------- |
| Primitive  | `tokens/primitives.css`、`tokens/typography.css` | 只有 semantic 层 |
| Semantic   | `tokens/semantic.css`、`src/styles/theme.css` | 组件、页面       |
| Component  | `tokens/spacing.css` 的密度档、`cva` 变体      | 组件             |

**组件不允许直接引用 primitive 值。** 否则「把全站正文行高从 20px 改成 21px」
就得逐个翻组件，设计系统也就白建了。

### Primitive 层

只定义原始设计值，不表达业务含义。字号阶梯是本层最核心的部分，也是**全站唯一
的字号来源**（`tokens/typography.css` 的 `@theme` 块）：

```css
@theme {
  --text-xs: 0.75rem;      /* 12px — small / caption */
  --text-xs--line-height: 1.125rem;   /* 18px */
  --text-sm: 0.875rem;     /* 14px — body / body-sm / label（行高 22px） */
  --text-sm--line-height: 1.375rem;   /* 22px */
  --text-mono: 0.8125rem;  /* 13px — 正文里的等宽文本 */
  --text-mono--line-height: 1.25rem;  /* 20px */
  --text-mono-code: 0.8125rem;  /* 13px — 固定高度等宽代码容器 */
  --text-mono-title: 1rem; /* 16px — 等宽卡片标题 */
  --text-dense: 0.8125rem; /* 13px — 表格单元格 / 二级导航 / 分页 */
  --text-dense--line-height: 1.25rem; /* 20px */
  --text-long: 1rem;       /* 16px — body-long */
  --text-long--line-height: 1.625rem; /* 26px */
  --text-base: 1rem;       /* 16px — 行标题 / 设置字段 / 指标数值，不是正文 */
  --text-group: 0.9375rem; /* 15px — group-title 专用档 */
  --text-group--line-height: 1.375rem; /* 22px */
  --text-lg: 1.125rem;     /* 18px — h3 */
  --text-lg--line-height: 1.625rem;   /* 26px */
  --text-xl: 1.25rem;      /* 20px — 兼容档 */
  --text-2xl: 1.375rem;    /* 22px — h2 */
  --text-2xl--line-height: 1.875rem;  /* 30px */
  --text-3xl: 1.75rem;     /* 28px — h1 */
  --text-3xl--line-height: 2.25rem;   /* 36px */
  --text-4xl: 2.25rem;     /* 36px — display */
  --text-4xl--line-height: 2.75rem;   /* 44px */
}
```

> ⚠️ **必须声明在 `@theme` 里，不能写在 `:root`。** Tailwind v4 只从 `@theme`
> 读取主题值：写在 `:root` 的 `--text-*` 只能被 `var(--text-sm)` 直接读到，
> `text-sm` 这类工具类会**静默退回 Tailwind 内置默认值**。本项目真实踩过这个坑
> —— `theme.css` 的 `:root` 里曾有一份字号表，改了 `--text-3xl` 却没有任何页面
> 变化。现在阶梯唯一声明在 `tokens/typography.css`。
>
> ⚠️ **同理，文字颜色不能叫 `--text-*`。** `--text-*` 在 Tailwind v4 里是字号
> 命名空间，叫 `--text-primary` 会生成一个 `text-primary` 字号类与品牌色工具类
> 撞车，也会被门禁 T1 判成「字号阶梯重复声明」。文字色统一用 `--fg-*` 前缀，
> 详见 [§11 颜色](#11-颜色)。

### Semantic 层

把「用途」指向既有 Token。绝大多数组件应该使用这一层：

```css
--ds-text-body: var(--text-sm);         /* 14px */
--ds-text-body-sm: var(--text-sm);      /* 14px */
--ds-text-dense: var(--text-dense);     /* 13px */
--ds-text-long: var(--text-long);       /* 16px */
--ds-text-label: var(--text-sm);        /* 14px */
--ds-text-caption: var(--text-xs);      /* 12px */
--ds-text-mono: var(--text-mono);       /* 13px */
--ds-text-page-title: var(--text-3xl);  /* 28px */
--ds-text-section-title: var(--text-2xl);/* 22px */
--ds-text-card-title: var(--text-lg);   /* 18px */
--ds-text-group-title: var(--text-group);/* 15px */

--ds-line-body: var(--text-sm--line-height, 1.375rem);   /* 22px */
--ds-line-long: var(--text-long--line-height, 1.625rem);/* 26px */
--ds-line-mono: var(--text-mono--line-height, 1.25rem);  /* 20px */
--ds-line-mono-dense: 1.375rem;  /* 22px */
```

### Component 层

只在组件确实需要独立控制时引入。**判断依据是「有没有多个调用点必须对齐」。**

| Token                     | 值    | 用途                                                |
| ------------------------- | ----- | --------------------------------------------------- |
| `--ds-control-height-md`  | 40px  | 输入框、下拉等表单控件（md）                        |
| `--ds-control-height-sm`  | 36px  | 表单控件（sm）                                      |
| `--ds-button-height-md`   | 36px  | 按钮（md）                                          |
| `--ds-button-height-sm`   | 32px  | 按钮（sm）                                          |
| `--ds-button-height-lg`   | 40px  | 按钮（lg）                                          |
| `--ds-chip-height`        | 21px  | 内联胶囊（值胶囊、`+N more`、标签条）              |
| `--ds-table-row-padding-y`| 12px  | 表格行上下留白                                      |
| `--ds-form-field-gap`     | 8px   | 表单字段间距                                        |

**胶囊高度 21px 为什么必须单独成 Token**：同一行并排三个胶囊，各自写一遍就会
错位；而 21px 既不是 4px 栅格整数倍、也不属于表单控件的高度三档（24/32/44），
所以它必须单独成 Token，且**不随密度档变化**（字号不变，胶囊就不该变）。

组件 Token 不是越多越好。只有当某个组件需要独立调整、存在多个规格，或者不同
主题下确实需要变化时，才引入独立 Token。否则直接使用语义 Token 更简单。

## 9. 唯一入口与导入顺序

```
src/styles/index.css
├── @import 'tailwindcss'
├── @import './theme.css'           颜色、字体栈、圆角基准、品牌色阶
├── @import './theme-presets.css'   颜色/圆角/密度预设
├── @import '../design-system/tokens/index.css'
└── @import '../design-system/foundations/index.css'
```

**顺序有约束**：`tokens/typography.css` 的 `@theme` 必须晚于
`@import 'tailwindcss'`，否则覆盖不了内置阶梯。


全局正文规则集中管理，组件自己的 CSS 不重复重设 `body`、全局标题或全局字体：

```css
body {
  font-family: var(--font-ui);
  font-size: var(--ds-text-body);
  font-weight: var(--font-weight-normal);
  line-height: var(--ds-line-body);
  color: var(--foreground);
}
```

## 10. 主题维度独立性

| 维度     | 属性                | 允许影响                                  | 不允许影响     |
| -------- | ------------------- | ----------------------------------------- | -------------- |
| 颜色主题 | `data-theme-preset` | 背景、文本、边框、状态色、品牌色阶        | 字号、间距     |
| 圆角     | `data-theme-radius` | 圆角基准 `--radius`                       | 字号、颜色     |
| 密度     | `data-theme-scale`  | `--spacing` + `--ds-*` 控件/表格/卡片尺寸 | 字号阶梯、颜色 |
| 明暗     | `.dark`             | 颜色 Token 取值                           | 尺寸           |

三条硬约束：

1. **密度不得改动默认正文语义。** `[data-theme-scale]` 只缩放 `--spacing`，**不
   缩放 `--text-*`**。这条曾经是反的 —— 密度档会一起压 `--text-*`，等于「用户切
   紧凑模式顺手把正文压小一档」，已移除。需要放大文字的用户走「Simple
   Large-font」预设（见 [§12.6](#126-无障碍大字档simple-large-font-预设)）。
2. **圆角主题不得影响字号与正文行高。** 改 `--radius` 基准即整体缩放。
3. **`.dark` 只替换 Token 取值，不新增 Token。** 任何新增颜色必须在 `:root` 和
   `.dark` 各给一次值，否则深色模式下会漏。唯一例外是
   `--primary-subtle-hover` / `--destructive-subtle` 这类
   `color-mix(… var(--background))` 派生值 —— 它们在 `:root` 声明一次，
   `--background` 翻转时自动跟随。

**主题预设的品牌色阶自动派生**：`theme-presets.css` 对非 `default` 预设用
`color-mix(in oklch, …)` 从该预设的 `--primary` 推出 `primary-hover` /
`primary-active` / `primary-subtle` / `primary-border` / `--ring`，不需要每套
预设手抄一份色阶。

---

# 第三部分 · 设计值

## 11. 颜色

> **👁 可视核查** → 核查页 [§10 表面与描边](#surface)、[§11 品牌色阶](#brand)、
> [§12 状态色](#status)、[§13 图表分类色](#chart)、[§14 语法高亮色](#syntax)
>
> 切换核查页顶部的「深色模式」，逐个确认每个色档在明暗两种主题下的实际观感。

视觉基调：**以 slate 中性色为骨架的现代 SaaS 界面** —— 白底、细描边、低存在感
阴影、8–10px 圆角。所有颜色、字体、间距均按语义变量使用，不直接写死色值。
默认浅色主题，同一套变量支持深色主题。

设计系统**不新建调色板**，只增加一层语义映射，把「用途」指向既有 Token。原因
很直接：两套颜色体系意味着两套深色模式、两套对比度问题。

### 11.1 色板骨架

2026-10-27 整体替换：中性色从 oklch 灰阶换成 **slate**，品牌色从 `#0F172A`
深墨色 / `#6467f0` 旧紫改为 **`#5B5EE6` 紫蓝**。

| 用途                        | 浅色（`:root`）             | 深色（`.dark`） |
| --------------------------- | --------------------------- | --------------- |
| `--background` 页面底色     | `#FFFFFF`                   | `#020617`       |
| `--foreground` 一级文字     | `#0F172A`                   | `#F8FAFC`       |
| `--card` / `--popover` 表面 | `#FFFFFF`                   | 深色表面        |
| `--muted` 次级表面          | `#F1F5F9`                   | `#1E293B`       |
| `--border` 描边             | `#E2E8F0`                   | `#334155`       |
| `--input` 输入框描边        | `#D1D5E5`                   | `#45465F`       |
| `--primary` 品牌主色        | `#6565E8`                   | `#6565E8`（2026-11-03 起深浅同色，见 §11.2） |
| `--destructive` 危险        | `#DC2626`                   | `#7F1D1D`       |
| `--success` 成功            | `#16A34A`                   | `#16A34A`       |
| `--warning` 警告            | `oklch(0.681 0.162 75.834)` | 深色档          |

### 11.2 品牌色阶：6 条语义出口，一个来源

> **👁 可视核查** → 核查页 [§11 品牌色阶](#brand)
>
> 重点看 hover / active 两档是否**肉眼可区分**（同色相加深 12% / 24%）。若在
> 1440px 屏幕上分不出来，说明加深幅度需要调整。

`--primary` 是**唯一入口**。其余五档全部由它派生，组件不得写品牌色字面值：

| Token                          | 用途                               | 浅色      | 深色                  |
| ------------------------------ | ---------------------------------- | --------- | --------------------- |
| `--primary` / `primary-strong` | 主按钮背景、选中控件填充           | `#6565E8` | `#6565E8`             |
| `--hover-primary`              | 主按钮悬停（同色相加深）           | `#5050CA` | `#5050CA`             |
| `--primary-active`             | 主按钮按下（再加深，与悬停可区分） | `#4141B7` | `#4141B7`             |
| `--primary-subtle`             | 浅底：选中行、轻强调背景           | `#F3F3FD` | `#161941`             |
| `--primary-subtle-hover`       | 浅底的悬停一档（`color-mix` 派生） | 12% 混合  | 同声明                |
| `--primary-border`             | 品牌描边：选中控件边框             | `#C4C4F6` | `#7171EA`             |

**2026-11-03 拍板：深色动作梯回归品牌实色；同日品牌主色升级为 `#6565E8`。**
此前深色的动作三档被提亮（`#8B8DF5` / `#A1A3F7` / `#B7B8FA`）以适配深色
前景文字，用户反馈主按钮「颜色发浅、不像品牌按钮」。现在深色与浅色共用
同一套实色动作梯（`#6565E8` + 白色前景，白字 on `#6565E8` = 4.59:1 达 AA）。
**文字出口不跟动作梯走**，仍按提亮档取值以保住各自的 AA 结论：

- 链接 / 强调文字 → `--fg-link`（浅 `#6565E8` / 深 `#BABAF9`，深色下
  11.03:1）。
- 品牌浅底（`bg-primary-subtle`）上的文字 → `--primary-subtle-foreground`
  （浅 `#5959CC` on `#F3F3FD` = 5.11:1 / 深 `#A2A2F8` on `#161941` = 7.25:1，
  见 §2.3）。
- 图标（非文字图形，3:1 即可）可继续用 `text-primary`；≥18px/600 的大
  字号同理（3:1 达标）。

> 完整六档派生公式与近黑背景 AA 口径以 `docs/design-system/design-system-2.0.md`
> §11.2 / §13.5 为权威，本文档其余章节中的 `#5B5EE6` 系旧值均已被该次升级取代。

对应 Tailwind 工具类：`bg-primary` / `bg-primary-strong` / `hover:bg-primary-hover` /
`active:bg-primary-active` / `bg-primary-subtle` / `hover:bg-primary-subtle-hover` /
`border-primary-border` / `ring-ring`。

**规范要求的按钮三态：**

```tsx
// 主按钮：默认 strong，悬停 hover，按下 active
'bg-primary-strong text-primary-foreground hover:bg-primary-hover active:bg-primary-active'
```

三条硬规则：

1. **不得用透明度凑悬停。** `hover:bg-primary/90` 在深色底上会发灰、在浅色底上
   会泛白，已全站替换为 `hover:bg-primary-hover`。同类：`hover:bg-destructive/90`
   → `hover:bg-destructive-hover`、`hover:bg-secondary/80` → `hover:bg-secondary-hover`。
2. **浅底加深一档用 Token，不用 `/15`。** `bg-primary/10 hover:bg-primary/15`
   改为 `bg-primary-subtle hover:bg-primary-subtle-hover`；危险色同理
   `bg-destructive-subtle hover:bg-destructive-subtle-hover`。
3. **`--color-primary` 必须指向 `var(--primary)`。** 历史上它被写死成 `#6467f0`，
   与 `--primary` 完全脱钩 —— 改品牌色对任何 `bg-primary` 都无效。现在
   `spec-guards.test.ts` 的 `brand color source` 守卫会拦下组件里的品牌色字面值。

### 11.3 文字层级：`--fg-*` 七档

> **👁 可视核查** → 核查页 [§9 文字色七档](#fg)
>
> 色卡里每档都渲染了真实文字（「优特 Ag」）。重点看 tertiary 与 disabled 两档在
> 正文旁边的实际区分度 —— 这是最容易在实际页面里"用错"的两档。

文字颜色必须按**语义 Token** 使用，禁止在页面和组件中随意写入十六进制。品牌色
用于可交互元素和品牌强调，不应替代正文中性色；错误、成功、警告等状态色只表达
对应语义。

| 层级     | Token                           | Tailwind 类           | 浅色      | 深色      | 使用范围                         |
| -------- | ------------------------------- | --------------------- | --------- | --------- | -------------------------------- |
| 一级文字 | `--fg-primary` / `--foreground` | `text-foreground`     | `#0F172A` | `#F8FAFC` | 页面标题、正文、主要数据、输入值 |
| 二级文字 | `--fg-secondary`                | `text-fg-secondary`   | `#334155` | `#CBD5E1` | 描述、辅助说明、次级信息         |
| 三级文字 | `--fg-tertiary`                 | `text-fg-tertiary`    | `#64748B` | `#94A3B8` | 时间戳、元信息、次要标签         |
| 禁用文字 | `--fg-disabled`                 | `text-fg-disabled`    | `#94A3B8` | `#64748B` | 禁用按钮、禁用字段               |
| 反色文字 | `--fg-inverse`                  | `text-fg-inverse`     | `#FFFFFF` | `#0F172A` | 深色表面或品牌实心背景           |
| 链接文字 | `--fg-link`                     | `text-fg-link`        | `#5B5EE6` | `#A1A3F7` | 文本链接、可导航文字             |
| 占位符   | `--fg-placeholder`              | `text-fg-placeholder` | `#64748B` | `#94A3B8` | 输入框 placeholder               |

**层级顺序（2026-10-29 更新）**：两套主题下，文字层级都按「离正文越远 = 越浅」
单调递减：

```
浅色（越浅 = 层级越低）      深色（越暗 = 层级越低）
  primary    #0F172A  L=0.009   primary    #F8FAFC  L=0.954
  secondary  #334155  L=0.051   secondary  #CBD5E1  L=0.657
  tertiary   #64748B  L=0.171   tertiary   #94A3B8  L=0.360
  placeholder #64748B L=0.171   placeholder #94A3B8 L=0.360
  disabled   #94A3B8  L=0.360   disabled   #64748B  L=0.171
```

两条由此产生的规则：

1. **`tertiary` 与 `placeholder` 在两套主题下取值相同**（`#64748B` / `#94A3B8`）。
   两者都是「不承载阅读主体的弱信息」，色值相同是有意的；但**语义不能混用** ——
   placeholder 只给输入框，占位符不能用在时间戳上。
2. **`disabled` 比 `tertiary` 更弱**（浅色下更浅、深色下更暗）。禁用态因此在
   两个主题里都是「最不显眼」的一档，不依赖额外样式（斜线、遮罩）就能读出来。

**实测对比度（WCAG 2.2，背景取该主题的 `--background`）**：

| 角色                | 浅色    | 深色    | 判定                          |
| ------------------- | ------- | ------- | ----------------------------- |
| `fg-primary`        | 17.85:1 | 19.28:1 | ✅ AA 普通文本                |
| `fg-secondary`      | 10.35:1 | 13.59:1 | ✅ AA 普通文本                |
| `fg-tertiary`       | 4.76:1  | 7.87:1  | ✅ AA 普通文本（≥ 4.5:1）     |
| `fg-placeholder`    | 4.76:1  | 7.87:1  | ✅ AA 普通文本（≥ 4.5:1）     |
| `fg-link`           | 5.01:1  | 8.74:1  | ✅ AA 普通文本                |
| `fg-disabled`       | 2.56:1  | 4.24:1  | ⚪ 禁用控件豁免（WCAG 1.4.3） |
| `fg-inverse`（反色） | 17.85:1 | —       | ✅ AA 普通文本                |

> `fg-disabled` 未达 4.5:1 属**预期**：WCAG 2.2 §6.4.3 明确豁免「失活控件」的
> 对比度要求。禁用态的设计目标是「一眼看出不可用」，而不是「仍然清晰可读」。
> 但**不得**用 `fg-disabled` 承载用户需要读懂才能操作的信息（见规则 6）。

> ⚠️ **规范原文用的名字是 `--text-primary`，但在本项目里不能用**，两个原因：
> 1. Tailwind v4 的 `--text-*` 是**字号命名空间**，声明 `--text-primary` 会生成
>    一个 `text-primary` 字号工具类，与品牌色工具类 `text-primary` 撞车；
> 2. 门禁 `check-design-tokens.mjs` 的 **T1 规则**把 `--text-*` 视为「字号阶梯
>    声明」，只允许出现在 `typography.css`，其他位置出现即判违规。
>
> 因此文字色统一走 `--fg-*`，工具类前缀同为 `fg-`；一级文字沿用既有的
> `text-foreground`（它本来就等于规范里的 `text-primary` 语义）。

**八条实现规则：**

1. **页面默认文字**：`body`、`body-sm` 默认使用 `text-foreground`；只有明确的
   辅助信息才使用 `text-fg-secondary` 或 `text-fg-tertiary`。
2. **标题**：页面标题、区块标题和卡片标题默认使用 `text-foreground`，不要仅为
   突出标题而改用品牌色。
3. **表单**：输入值使用 `text-foreground`；标签使用 `text-fg-secondary` 或
   `text-foreground`；placeholder 使用 `text-fg-placeholder`；错误消息使用
   `destructive`，并关联字段及错误图标/说明。
4. **按钮**：品牌实心按钮文字使用 `primary-foreground`；次级按钮文字使用
   `secondary-foreground`；危险按钮文字使用 `destructive-foreground`。按钮文字
   不可用透明度降低来表示层级。
5. **链接与选中态**：链接、活动导航和选中控件可使用品牌色；浅色选中背景优先
   使用 `primary-subtle`。在浅色背景上，不要使用过浅的品牌色作为小字号正文。
6. **禁用态**：通过文字颜色、背景/边框和交互状态共同表达禁用；确保状态可辨认，
   但不把关键说明或必要信息做成低对比度。
7. **深色主题**：只切换语义 Token 的值，组件不得写死浅色主题颜色。每种文字
   Token 都应与其实际背景组合检查对比度。
8. **禁止项**：禁止将 `#5B5EE6` 作为所有正文的统一颜色；禁止用 `opacity` 作为
   唯一层级控制手段；禁止把错误、成功、警告状态统一染成品牌色。

**用法规边界：**

- **正文与标题默认一级文字**。不要仅为突出标题而改用品牌色。
- **三级色只给非阅读主体的辅助小字**（页脚法规行、版权行、时间戳、元信息）。
  正文、表单标签、列表说明一律二级色；把它当「更浅的次要文字」用在内容区，
  等于主动放弃可读性。
- **禁用态用 `text-fg-disabled`**，不要借 `text-fg-tertiary` —— 后者是「辅助小字」
  档位，允许清单里没有禁用态。`fg-disabled` 在两套主题下都是**最不显眼**的一档
  （浅色 `#94A3B8` 更浅、深色 `#64748B` 更暗）。
- **`text-fg-tertiary` 与 `text-fg-placeholder` 色值相同（`#64748B` / `#94A3B8`），
  但语义不同。** placeholder 只给输入框；三级文字给时间戳、元信息、次要标签。
  看到色值相同不代表可以互换 —— placeholder 是「还没有内容」，tertiary 是
  「有内容但不需要你读」。
- **不得用 `opacity` / 透明度后缀模拟层级。** `text-foreground/60` 冒充次要文字
  会被审计规则 C3 判违规，改用 `text-fg-secondary`。

`--tertiary-foreground` 不是写死的灰值，而是
`color-mix(in oklch, var(--muted-foreground) 88%, var(--background))`：主题预设
各自覆盖 `--muted-foreground`（含暖灰），派生值自动跟随。实测对比度 **4.6:1**
（浅色 `#747474`）/ **6.6:1**（深色 `#a2a2a2`）。

允许出现 `text-tertiary-foreground` 的位置（其余一律用 `text-muted-foreground`）：

| 位置                     | 文件                                                                                      |
| ------------------------ | ----------------------------------------------------------------------------------------- |
| 页脚法规行、版权行       | `components/layout/components/footer.tsx`                                                 |
| 首页营销终端、营销页装饰 | `features/home/components/hero-terminal-demo.tsx`、`sections/hero.tsx`                    |
| 图表覆盖层坐标标签       | `features/dashboard/components/flow/flow-charts.tsx`                                      |
| 分页信息、搜索占位符     | `components/data-table/core/pagination.tsx`、`features/pricing/components/search-bar.tsx` |


### 11.4 图表色与语法高亮

**`chart-1` … `chart-5` 是分类色，不是状态色。** 二者分工写死如下，不允许互换：

| 用途                                                   | 用什么                                         |
| ------------------------------------------------------ | ---------------------------------------------- |
| 表达成功 / 警告 / 危险 / 信息                          | `success` / `warning` / `destructive` / `info` |
| 浅底深字的语义徽标                                     | `{status}-soft` + `{status}-soft-foreground`   |
| **区分彼此、不带成败含义**的分类（标签、类别、图标底） | `chart-1` … `chart-5`                          |

三条硬规则：

1. **不得用 `chart-N` 表达成功/失败。** `dotColorMap` / `textColorMap` 里
   `success`、`warning`、`danger`、`info` 四个键**必须**指向语义 Token，指向
   `chart-*` 即违规（`semantic-colors.test.ts` 守卫）。
2. **分类色不追求语义正确，只追求可区分。** 需要第 6 种分类色时先问「这 6 个
   类别真的都必须在同一屏区分吗」，确实需要再申请新增 `--chart-6`，而不是随手
   拿一个调色板类名。
3. **分类色只做底色/前景色，不做强调边框。** 边框要表达层级用 `border`，要表达
   状态用 `{status}`。

**语法高亮色（`syntax-*`）** —— 代码块、JSON 查看器、diff 视图里的 token 着色：

| Token             | 用途                         | 浅色取色   | 深色取色   |
| ----------------- | ---------------------------- | ---------- | ---------- |
| `syntax-keyword`  | 关键字（`const` / `import`） | purple-700 | purple-300 |
| `syntax-string`   | 字符串字面量                 | green-800  | green-300  |
| `syntax-number`   | 数字 / 布尔                  | orange-800 | orange-300 |
| `syntax-function` | 函数名、命令                 | blue-700   | blue-300   |
| `syntax-property` | 属性名、flag                 | teal-800   | teal-300   |

用法是 `text-syntax-keyword` 这样的工具类。注释色不单列 Token，用
`text-muted-foreground` + `italic`。

**第三方品牌色与多序列分类色** —— 有两类颜色**本质上无法语义化**，集中声明在
`design-system/tokens/brand-colors.ts`，组件一律从那里 import：

| 常量                                           | 内容                                                  |
| ---------------------------------------------- | ----------------------------------------------------- |
| `VENDOR_BRAND_COLORS`                          | OpenAI / Anthropic / Google / DeepSeek 等 16 个厂商色 |
| `PAYMENT_BRAND_COLORS`                         | 支付宝蓝、微信绿、Stripe 紫等 8 个支付渠道色          |
| `CATEGORICAL_CHART_PALETTE`                    | 23 色多序列调色板                                     |
| `VENDOR_FALLBACK_PALETTE`                      | 未知厂商兜底序列                                      |
| `CHART_OTHER_SERIES_COLOR`                     | 「其他」聚合桶                                        |
| `CHART_FALLBACK_SERIES_COLOR`                  | 无调色板时的首条序列色                                |
| `CHART_NO_THEME_TEXT_COLOR` / `…_STROKE_COLOR` | canvas 在主题解析完成前的兜底色                       |

**允许 `white` / `black` 的场景** —— 它们是无彩色极值，在下面这些场景里**没有**
对应 Token 可替代，且必须保持极值：

| 场景                                       | 写法                                       |
| ------------------------------------------ | ------------------------------------------ |
| 弹窗 / 抽屉 / 移动端全屏菜单的遮罩         | `bg-surface-overlay/{10,50}`（已走 Token） |
| 二维码白底、滑块手柄                       | `bg-surface-pure`（已走 Token）            |
| 媒体预览的纯黑背板（不透明，压住图片边缘） | `bg-black`                                 |
| SVG 描边（色块上的对勾）                   | `stroke-white`                             |
| 营销页终端演示                             | `bg-card/95` + `border-border`             |

除上表之外新增 `white` / `black` 用法，先判断是不是「遮罩 / 纯白表面 / 媒体背板 /
SVG 描边」四类之一；都不是就说明应该用语义 Token。

> **`<meta name="theme-color">` 已改为从 Token 解析**：`components/theme-switch.tsx`
> 通过 `useThemeColor('--background')` 取值，浅色/深色与主题预设都会同步。

### 11.5 首屏演示的效果锚定（`term-*` 与品牌渐变）

首页那张 curl 演示卡、主标题的渐变行、CTA 的渐变副标题，取值必须**渲染出与上游
new-api 一致的效果**。这一节把「效果」落成 Token 与条款，用来替代原先「把上游的
类名照抄一遍」的做法 —— 三者原先都登记为门禁例外，现已全部注销。

> **先把这条边界说清（2026-10-30 决案）**：
>
> | 说法                                     | 结论                             |
> | ---------------------------------------- | -------------------------------- |
> | 「要和上游长得一样」                     | ✅ 这是要求，本节就是它的规范条款 |
> | 「要和上游逐类一致，所以只能用它的类名」 | ❌ 这是把规范的缺口固化成永久豁免 |
>
> 正确的顺序永远是：**先把效果定档成 Token / 条款 → 改代码去满足它 → 验证渲染一致**。
> 只有当某个效果确实无法被 Token 表达时，才允许进 [§26](#26-例外登记)，且必须写清
> 退出条件。E25 / E26 / E27 三条例外就是按这条原则注销的。

**为什么单列一组 `term-*`，不复用 `syntax-*`** —— 两者语境不同，合并不了：
`syntax-*` 服务通用代码查看（Shiki、JSON 查看器），`term-*` 服务首屏那张演示卡，
取值锚定上游渲染。把其中一套的值改去迁就另一套，等于同时改坏两个地方。

#### 语法角色（前景色）

| Token           | 角色                             | 上游等价写法                             | 浅色      | 深色      |
| --------------- | -------------------------------- | ---------------------------------------- | --------- | --------- |
| `term-command`  | shell 命令名（`curl`）           | `text-emerald-600 dark:text-emerald-400` | `#047857` ① | `#34d399` |
| `term-flag`     | 命令行开关（`-X` / `-H` / `-d`） | `text-blue-600 dark:text-blue-400`       | `#2563eb` | `#60a5fa` |
| `term-property` | JSON 键名、Header 名             | `text-sky-700 dark:text-sky-300`         | `#0369a1` | `#7dd3fc` |
| `term-string`   | 字符串字面量                     | `text-amber-700 dark:text-amber-300`     | `#b45309` | `#fcd34d` |
| `term-number`   | 数字、token 计数                 | `text-violet-600 dark:text-violet-300`   | `#7c3aed` | `#c4b5fd` |

#### 弱层级四档（替代 `text-foreground/NN`）

旧写法是一串不透明度：`text-foreground/{75,55,40,30}`。它有两个问题 —— 会随底下
那层表面漂移（卡面、`bg-muted/20` 各不相同），而且对比度无法静态验证。四档实色的
渲染结果与旧写法等价，但可测、可记、跨主题恒定。

| Token        | 等价旧写法           | 取值表达式                | 用在哪                                   |
| ------------ | -------------------- | ------------------------- | ---------------------------------------- |
| `term-dim-1` | `text-foreground/75` | foreground 75% 混 `card`  | 端点行、Tab 悬停态                       |
| `term-dim-2` | `text-foreground/55` | foreground 55% 混 `card`  | 标点、续行符                             |
| `term-dim-3` | `text-foreground/40` | foreground **55%** 混 `card` ② | 未选中的 Tab、卡尾指标行           |
| `term-dim-4` | `text-foreground/30` | foreground **55%** 混 `card` ② | 分组标签（Request / Response）、装饰文案 |

① **AA 补偿（2026-10-30 拍板）**：浅色 `term-command` 由上游等价值 `#059669`
（emerald-600，3.77:1）压深到 `#047857`（emerald-700，5.48:1）。深色维持上游原值
（本就 10.49:1）。
② **AA 补偿（2026-10-30 拍板）**：dim-3 / dim-4 由 40% / 30% 提亮到 55%，与
dim-2 同档 —— 弱层级梯度从四档收成两档（75 / 55），换取两者达到 4.00:1（大文本
阈值达标）。**保留四个 Token 名不合并**：未来若需恢复梯度，只改取值不动使用方。

#### 四个 demo 的分类强调色

每个 demo 一个 tone，三件事共用：Tab 激活态文字、Tab 激活描边、方法徽标。

| tone      | 文字 `term-accent-*`  | 描边 `term-accent-*-line` | 徽标底 `term-accent-*-soft` |
| --------- | --------------------- | ------------------------- | --------------------------- |
| `emerald` | `#047857` ① / `#34d399` | `#047857` ① / `#34d399` | 描边档 10% 混 `card`        |
| `amber`   | `#b45309` ① / `#fbbf24` | `#b45309` ① / `#fbbf24` | 描边档 10% 混 `card`        |
| `blue`    | `#2563eb` / `#60a5fa` | `#3b82f6` / `#60a5fa`     | 描边档 10% 混 `card`        |
| `violet`  | `#7c3aed` / `#a78bfa` | `#8b5cf6` / `#a78bfa`     | 描边档 10% 混 `card`        |

每格写的是「浅色 / 深色」。上游的浅色描边取饱和档（-500，比文字亮一档）；
AA 补偿后浅色 emerald / amber 的**描边与文字同值**（emerald-700 / amber-700）——
1px 线里亮度略降，换来文字 / 描边 / 徽标三处取色统一。深色没有 600 / 500 之分，
两档同值（维持上游原值）。

#### 状态与装饰

| Token              | 用途             | 取值                                                    |
| ------------------ | ---------------- | ------------------------------------------------------- |
| `term-online`      | 在线绿点         | `#10b981`（深浅主题同值 —— 跟着主题变深就不像「在线」了） |
| `--ds-glow-online` | 绿点辉光         | `0 0 8px rgb(16 185 129 / 0.45)`，见 [§13.6](#136-投影)   |
| `term-dot`         | 卡尾指标的分隔点 | foreground 15% 混透明（整卡唯一保留的装饰透明度）        |

#### 背景装饰层（`--ds-decor-*` 与 `ds-decor-*` utility）

hero / CTA 标题背后的**三团光晕 + 网格 + 渐隐遮罩**（以及 CTA 的两团弱化光晕）。
它们原先内联在组件 `style` 里：裸 `oklch(...)` 写在 `radial-gradient` 中，透明度
散装在 `opacity-25 dark:opacity-[0.12]` 这类类名上 —— 颜色、形状、深浅取舍三件事
互相缠死，谁也验证不了。2026-10-30 拆成三层落位：

| 层     | 落位                                              | 内容                             |
| ------ | ------------------------------------------------- | -------------------------------- |
| 颜色   | `styles/theme.css` 的 `--ds-decor-glow-*`         | 五个光晕色（hero 三个 + CTA 两个弱化档），浅色定义、**不随主题变** |
| 透明度 | 同上 `--ds-decor-mesh-opacity-{hero,cta}`         | 浅 / 深各一档（hero 0.25→0.12，CTA 0.2→0.08），`.dark` 覆盖 |
| 形状   | `design-system/foundations/decoration.css` 的 `ds-decor-*` | ellipse 尺寸 / 圆心 / 色标位置 / 网格 / 遮罩 |

光晕颜色（与改动前渲染逐值等价）：

| Token                     | 值                          | 用途                     |
| ------------------------- | --------------------------- | ------------------------ |
| `--ds-decor-glow-1`       | `oklch(0.72 0.18 250 / 80%)` | hero 主光（品牌蓝）      |
| `--ds-decor-glow-2`       | `oklch(0.65 0.15 200 / 60%)` | hero 次光（青）          |
| `--ds-decor-glow-3`       | `oklch(0.7 0.12 280 / 40%)`  | hero 补光（紫）          |
| `--ds-decor-glow-1-soft`  | `oklch(0.7 0.15 250 / 70%)`  | CTA 主光（弱一档）       |
| `--ds-decor-glow-2-soft`  | `oklch(0.65 0.12 200 / 50%)` | CTA 次光（弱一档）       |

三个 utility（`@utility`，与 `ds-motion-*` / `ds-text-gradient-brand` 同一注册方式）：

| utility              | 内容                                                         |
| -------------------- | ------------------------------------------------------------ |
| `ds-decor-mesh-hero` | 三团光晕 + 整层透明度（Token 控制）                          |
| `ds-decor-mesh-cta`  | 两团弱化光晕 + 整层透明度                                    |
| `ds-decor-grid`      | 1px 网格线（`--border`）+ 4rem 方格（`--ds-decor-grid-size`）+ 椭圆渐隐遮罩 + 透明度 0.08 |

**硬规则**：

1. 组件里**禁止**再出现内联 `style={{ background: 'radial-gradient(...)' }}` 或裸
   `oklch(...)` —— 颜色一律改 `--ds-decor-glow-*`，形状一律走 utility。
2. **禁止散装透明度**（`opacity-25 dark:opacity-[0.12]` 这类）：透明度的深浅两档
   由 `--ds-decor-mesh-opacity-*` 管理，散装写法会让「深色压低一档」这个决定不可见。
3. 装饰层是**纯装饰**（`aria-hidden`，不承载文字）：没有对比度义务；但叠在它上面
   的前景内容必须各自达标，装饰层不豁免前景。
4. 网格线颜色跟 `--border` 走主题（不是恒定值），遮罩形状固定在 utility 里。
5. 改光晕的颜色或形状 = 改对外观感：同步本节表格并重新生成核查页第 10 分区。

#### 品牌渐变

三个停靠站：蓝 → 紫 → 洋红。**单一取值，不随主题深浅变化，也不接 `chart-*`** ——
`chart-*` 会跟着主题预设漂移（绿色系预设下渐变会变绿），而这是对外传播资产。

| Token                            | 值        | 上游等价    |
| -------------------------------- | --------- | ----------- |
| `--ds-color-brand-gradient-from` | `#60a5fa` | blue-400    |
| `--ds-color-brand-gradient-via`  | `#a78bfa` | violet-400  |
| `--ds-color-brand-gradient-to`   | `#a855f7` | purple-500  |

消费方式有且只有一个：`@utility ds-text-gradient-brand`（定义在
`design-system/foundations/typography.css`）。它把「渐变 + `background-clip: text`
+ `color: transparent`」收成一类 —— 这三件套必须同时存在，漏掉最后一条会渲染成
看不见的字。

#### 硬规则

1. **改这一组的值 = 改对外的观感。** 上游没变就不要动；动了必须同步更新本节实测表
   并重新生成核查页第 10 分区。
2. `term-*` 只服务首屏演示卡，通用代码查看走 `syntax-*`。两者不许互相引用，也不许
   为了「少一组 Token」合并。
3. **卡内不许再出现 `text-foreground/NN`**：每档都有对应的 `term-dim-*`，不要拿
   `fg-secondary` 顶替 —— 那会直接改变对外观感。T13 会自动拦下。
4. **品牌渐变只经由 `ds-text-gradient-brand`**，组件里手写 `from-… via-… to-…`
   一律由 T7 拦下。
5. **绿点辉光走 `--ds-glow-online`**，不许写裸 `rgba(...)`。
6. 卡面投影走 `--ds-elevation-marketing`（见 [§13.6](#136-投影)），不是独立的例外。
7. **首屏背景装饰层只经 `ds-decor-*`**：颜色在 `--ds-decor-glow-*`、透明度在
   `--ds-decor-mesh-opacity-*`，形状在 `foundations/decoration.css`。组件里禁止
   内联 `radial-gradient(...oklch...)`，也禁止散装透明度（`opacity-25
   dark:opacity-[0.12]` 这类写法会让深浅两档的取舍不可见）。详见下文「背景装饰层」。

#### 对比度实测（2026-10-30 AA 补偿后，背景取 `--card`）

| 组合                       | 浅色 `#FFFFFF`              | 深色 `#020617`                   | 判定                        |
| -------------------------- | --------------------------- | -------------------------------- | --------------------------- |
| `term-command`             | **5.48:1**                  | 10.49:1                          | ✅ AA（补偿前 3.77:1）      |
| `term-flag`                | 5.17:1                      | 7.93:1                           | ✅ AA                       |
| `term-property`            | 5.93:1                      | 12.10:1                          | ✅ AA                       |
| `term-string`              | 5.02:1                      | 13.99:1                          | ✅ AA                       |
| `term-number`              | 5.70:1                      | 10.93:1                          | ✅ AA                       |
| `term-dim-1`               | 7.95:1                      | 10.74:1                          | ✅ AA                       |
| `term-dim-2`               | 4.00:1                      | 6.00:1                           | 仅大文本（≥3:1）            |
| `term-dim-3`               | **4.00:1**                  | **6.00:1**                       | 仅大文本（补偿前 2.55 / 3.62） |
| `term-dim-4`               | **4.00:1**                  | **6.00:1**                       | 仅大文本（补偿前 1.96 / 2.48） |
| 强调 emerald（卡面上）     | **5.48:1**                  | 10.49:1                          | ✅ AA（补偿前 3.77:1）      |
| 强调 amber（卡面上）       | **5.02:1**                  | 12.08:1                          | ✅ AA（补偿前 3.19:1）      |
| 强调 blue / violet         | 5.17:1 / 5.70:1             | 7.93:1 / 7.41:1                  | ✅ AA                       |
| 方法徽标：字 / 底          | 4.78 / 4.36 / 4.62 / 5.04:1 | 9.17 / 10.49 / 7.07 / 6.65:1     | amber 底字组合 4.36 仅大文本 |
| 渐变标题（大文本，阈值 3:1） | 2.54 / 2.72 / 3.96:1        | 7.93 / 7.41 / 5.10:1             | 浅色 from / via 未达        |

> **AA 补偿决策记录（2026-10-30 拍板采纳）**：补偿前上表多处未达 AA（command /
> emerald 3.77、amber 3.19、dim-3 / dim-4 2.55 / 1.96）。经左右并排对比评审
> （`_reports/term-aa-comparison.html`，浅深两主题），决定采纳补偿：浅色
> emerald → `#047857`、amber → `#b45309`（描边跟随文字档）、dim-3 / dim-4 →
> 55%（深色同步）。**接受的代价**：① 与上游 new-api 不再逐像素一致（绿 / 橙
> 压深一档）；② 弱层级梯度四档收成两档。
>
> 补偿后仍存的残留（有意保留，不再处理）：dim-2 / 3 / 4 与 amber 徽标底字组合
> 落在 4.00 ~ 4.36:1 —— 大文本（≥3:1）达标、普通文本未达；它们是营销首屏的
> 装饰性 / 辅助性文案，不是表单标签或错误提示。渐变标题浅色 from / via 未达
> 大文本 3:1 阈值，维持品牌渐变恒定值优先。不许拿「禁用态豁免」解释这些残留 ——
> 它们不是禁用控件。

### 11.6 文本对比度验收

- 普通文本（含 14px 常规正文及 16px 长文本）：目标对比度至少 **4.5:1**。
- 大文本（至少 24px 常规字重，或至少约 18.66px 粗体）：目标对比度至少 **3:1**。
- 控件边界、图标及必要的非文本视觉信息：目标对比度至少 **3:1**，并同时检查
  焦点可见性。
- `#5B5EE6` 与白字对比度约 **5.01:1**，满足 AA 普通字号目标。
- **每次调整 Token、主题背景或透明度后都应重新计算前景/背景组合**，不能只看
  单个颜色值判断合规。深色主题必须独立验证，不能依据浅色结果推断。
- `text-fg-tertiary` / placeholder 在两套主题下均已达 4.5:1（4.76:1 / 7.87:1），
  可安全用于阅读性要求不高的辅助小字。
- `text-fg-disabled` 属**豁免档**（禁用控件，WCAG 2.2 §6.4.3 明确不要求），
  不得用于需要阅读的内容。
- `--ds-color-text-disabled` 同样不适用于需要阅读的内容，只用于禁用态。

**已实测（2026-10-29，背景取各主题 `--background`）**：

| 前景 Token            | 浅色（`#FFFFFF`） | 深色（`#020617`） | 判定                    |
| --------------------- | ----------------- | ----------------- | ----------------------- |
| `--fg-primary`        | 17.85:1           | 19.28:1           | ✅ AA                   |
| `--fg-secondary`      | 10.35:1           | 13.59:1           | ✅ AA                   |
| `--fg-tertiary`       | 4.76:1            | 7.87:1            | ✅ AA                   |
| `--fg-placeholder`    | 4.76:1            | 7.87:1            | ✅ AA                   |
| `--fg-link`           | 5.01:1            | 8.74:1            | ✅ AA                   |
| `--fg-disabled`       | 2.56:1            | 4.24:1            | ⚪ 禁用态豁免           |
| `--fg-inverse`（反色） | 17.85:1           | —                 | ✅ AA                   |
| `--primary` 配白字     | 4.70:1            | —                 | ✅ AA（深色配深字另算） |

> 逐组合实测表见 [§11.3](#113-文字层级--fg--七档) 的层级说明。**修改任一文字色
> Token 后必须重算这张表** —— 尤其注意 tertiary 与 disabled 是相邻的两档，
> 改动其一就要确认另一档仍在其外侧。

---

## 12. 字号与排版

字号是设计系统里最容易被随手破坏的一层 —— 一个 `text-[15px]` 就够让页面看起来
「哪里不对」。因此这里只有十档，且由代码强制。

字体家族：**Inter** 承担全部界面文字（中文回落思源黑体
`@fontsource-variable/noto-sans-sc`），**SF Mono** 仅用于代码与对齐数值。
字距一律 0，不要用 `tracking-*`。

### 12.1 十档字号表

> **👁 可视核查** → 核查页 [§6 字号十档](#type)、[§8 页面层级四层](#level)
>
> 每档都渲染了同一句中文「优特智能大模型服务平台」，可以直接看出：
> ① 28px 与 22px 的层级差是否够明显；② 14px 正文在真实文案下是否偏小；
> ③ 12px caption 是否已经小到看不清。

| Token       | 语义                     | 字号 | 字重 | 行高 | Tailwind                  | 组件                              |
| ----------- | ------------------------ | ---- | ---- | ---- | ------------------------- | --------------------------------- |
| display     | 页面主视觉               | 36px | 600  | 44px | `text-4xl`                | `Heading variant="display"`       |
| h1          | 页面标题                 | 28px | 600  | 36px | `text-3xl`                | `Heading variant="page-title"`    |
| h2          | 区块标题                 | 22px | 600  | 30px | `text-2xl`                | `Heading variant="section-title"` |
| h3          | 卡片/弹窗标题            | 18px | 600  | 26px | `text-lg`                 | `Heading variant="card-title"`    |
| group-title | 卡片内分组标题           | 15px | 600  | 22px | `--text-group` 专用档     | `Heading variant="group-title"`   |
| body        | **正文（全站基准）**     | 14px | 400  | 22px | `text-sm`                 | `Text variant="body"`             |
| body-long   | 长文本（文章/协议/对话） | 16px | 400  | 26px | `text-long`               | `Text variant="body-long"`        |
| body-sm     | 次要正文                 | 14px | 400  | 22px | `text-sm`                 | `Text variant="body-sm"`          |
| body-medium | 强调正文、导航项         | 14px | 500  | 22px | `text-sm font-medium`     | `Text variant="body-medium"`      |
| small       | 辅助信息、时间           | 12px | 400  | 18px | `text-xs`                 | `Text variant="caption"`          |
| caption     | 说明、占位符、徽标       | 12px | 400  | 18px | `text-xs`                 | `Text variant="caption"`          |
| dense       | 密集数据（表格/二级导航/分页） | 13px | 400 | 20px | `text-dense`         | `Text variant="dense"`            |
| mono        | 正文里的等宽文本         | 13px | 400  | 20px | `text-mono`               | `Text variant="code"`             |

**v1.2（2026-10-30）行高与字重校准**：正文 14px 行高 20 → **22**（1.57）、12px 行高
16 → **18**（1.50），阅读段落有了呼吸感；display 字重 700 → **600**（管理后台的主
视觉不需要 Bold 的压迫感，与 h1 同重靠字号差分层）；正文等宽从 14px 收敛到
**13px**（与 dense 同值，等宽字形比 Inter 宽，视觉等重）。控件文本落在固定高度
容器里（按钮 h-9、输入框 h-9），行高变化不改变控件实际高度。

**group-title 是专用派生档**（`--text-group` 15/22），与 `dense` / `mono-code` /
`mono-title` 同一机制：不占阶梯位置、只在专属场景出现。2026-10-30 字体规范 v1.1 起，
分组标题从 `text-base`（16/24）独立出来 —— 16px 由此让给「行标题 / 设置页
字段档 / 指标数值」三个非标题用途（见 [§12.3](#123-body-与-body-long14px-是基准16px-是阅读档)
与 [§12.5](#125-页面层级四层不多不少)）。

**使用边界（每档一句判据）**：

- **display**：仅营销页 hero 主视觉，不用于普通页面标题。
- **h1**：每页一个，页面主标题。
- **h2**：页面内较大的功能区块。
- **h3**：卡片、弹窗、面板标题。
- **group-title**：卡片内部再分组的标题。
- **body / body-sm / body-medium / small / caption**：见各行语义与
  [§12.8](#128-控件与说明文字的下限管理端) 下限。
- **dense**：**只**给表格单元格、二级导航、分页这类以扫读为主的密集数据；
  普通说明文字仍是 14px。13px 是密集数据的专用字号，不是节省空间的常规方案。

**字重四档**（全站只用这四档，`--font-weight-*` 已在 `typography.css` 注册）：

| 字重     | 值  | 使用场景                       |
| -------- | --- | ------------------------------ |
| Regular  | 400 | 正文、说明、表格内容           |
| Medium   | 500 | 标签、导航、按钮、行标题、强调正文 |
| SemiBold | 600 | 标题（全部层级）、重点信息     |
| Bold     | 700 | 特殊强调、关键数据展示；普通管理界面不用 |

普通管理界面**不要大量使用 700** —— 界面会显得过重。v1.2 起 display 也降到
600，700 在系统层不再被任何预设档引用，只剩语义保留。

**mono 是等宽专用档**（正文等宽 13px，见 [§12.4](#124-mono-三档)）。

**汇总值不属于 `caption`。** 卡片标题旁的「总计 / 合计 / 共 N 条」与标题同层级，
用 `body-sm`（14px `text-sm`）；`caption` 只给**不含数值**的短说明。把金额、计数
压到 12px 等于让用户凑近看数字。

### 12.2 行高属于字号，不属于页面

上表的行高是**每一档字号自带的属性**，写在 `design-system/tokens/typography.css`
的 `@theme` 里（`--text-*--line-height`）。所以：

- 写 `text-sm` 就同时拿到了 14px 和 22px，**不需要也不允许**再写 `leading-*`；
- `leading-tight` / `leading-snug` / `leading-relaxed` / `leading-none` /
  `leading-6` 这些工具类会把行高从阶梯上拽下来（`text-sm leading-relaxed`
  实际是 14/22.75，`text-xs leading-5` 是 12/20，都不在任何一档里），
  门禁 **T9** 一律拦截；
- 确实需要更松的行距 → 换档位（`text-long` = 16/26），而不是改行高；
- 唯一允许的写法是 `leading-[var(--ds-line-mono-dense)]` 这类**引用 Token**，
  用于等宽密集容器锁固定高度。

「全站正文行高从 22px 调到 23px 只改一处」这件事，靠的就是这条规则 —— 一旦允许
`leading-*` 散落，行高就又有 N 个来源了。

**设计新档位时的行高比例参考**（定值仍写进 Token，不在调用点算）：

| 用途       | 比例区间      | 本项目取值                              |
| ---------- | ------------- | --------------------------------------- |
| 大标题     | 1.25 – 1.30   | 28/36 = 1.29、36/44 = 1.22（display 略紧） |
| 卡片标题   | 1.30 – 1.45   | 18/26 = 1.44、15/22 = 1.47              |
| 普通正文   | 1.45 – 1.60   | 14/22 = 1.57                            |
| 长文本     | 1.60 – 1.65   | 16/26 = 1.625                           |
| 密集数据   | 1.45 – 1.60   | 13/20 = 1.54                            |
| small/caption | 1.45 – 1.55 | 12/18 = 1.50                          |
| 等宽密集行 | 固定值        | 14/22（`--ds-line-mono-dense`）         |

两条由此而来的边界：**行高不是组件高度**（14/22 的文字放在 36px 高的按钮里，
垂直居中由组件负责，行高不参与撑高）；跨平台垂直对齐一致性由「行高随字号
Token 自带」保证，不允许浏览器默认行高进入任何一档。

### 12.3 body 与 body-long：14px 是基准，16px 是阅读档

「常规正文」定在 **14/22**，16px 只保留给**连续阅读**场景。这两档的分界线不是
「重要程度」，而是**阅读方式**：

| 档位        | 字号/行高 | 什么时候用                                                                  | 判据                                        |
| ----------- | --------- | --------------------------------------------------------------------------- | ------------------------------------------- |
| `body`      | 14/22     | 界面文案：卡片描述、表单说明、列表副标题、弹窗正文                          | 一眼扫过去就能懂，不需要逐字读              |
| `body-medium` | 14/500/22 | 强调正文、首页导航 Tab、管理页左侧导航、文档/关于页左侧导航、首页登录按钮   | 与 body 同字号，用 500 字重表达强调         |
| `body-long` | 16/26     | 需要连续阅读多段的内容：帮助中心、服务协议、隐私政策、文章正文、AI 对话气泡 | 会出现 3 行以上的段落，读者会从上往下顺序读 |

两条实现约定：

1. **`body` 与 `body-sm` 同为 14/22**，视觉上等价。保留两个名字是为了语义分工
   （`body` 是默认正文，`body-sm` 是「比正文次要一档」的显式声明），不要在代码里
   把它们当成两个不同字号。`body-medium` 与 `label` 同为 14/500/22，差别也只在
   语义 —— 组件层的 `Text` 两个名字都收。
2. **`text-base`（16px）不再是任何标题档。** group-title 已于字体规范 v1.1
   独立为 15/600/22（`--text-group`）。`text-base` 现在的合法用途只有四类：
   「名称 + 说明」行标题（16/500）、设置页字段档（16/600）、指标/价格数值
   （16/600 + `tabular-nums`）、移动端全屏菜单一级项（16/500，[§12.13](#1213-移动端全屏菜单)）。
   在 `<p>`、`Card`、`DialogContent`、`SheetContent` 上写 `text-base` 会被
   `spec-guards.test.ts` 判失败。

**不要把所有正文统一放大到 16px，也不要把长篇阅读内容压缩到 14px。** 长文本组件
应显式使用 `variant="body-long"` 或对应的语义类，避免依赖页面局部硬编码。

### 12.4 mono 三档

> **👁 可视核查** → 核查页 [§7 mono 三档](#mono)

**v1.2 收敛：正文等宽从 14px 降到 13px。** 等宽字形比 Inter 同字号更宽，
13px 等宽与 14px 正文并排视觉等重 —— 原来「正文等宽 14px」与「代码容器 13px」
两档的字号差已无必要，统一到 13px，行高 20px。

| Token        | 用途                                                          | 字号 | 字重 | 行高 | Tailwind          | 组件                           |
| ------------ | ------------------------------------------------------------- | ---- | ---- | ---- | ----------------- | ------------------------------ |
| `mono`       | 正文里的等宽文本（模型 ID、密钥、行内代码）                   | 13px | 400  | 20px | `text-mono`       | `Text variant="code"`          |
| `mono-code`  | 固定高度的等宽代码容器（首页代码卡片、代码编辑器视口）        | 13px | 400  | 20px | `text-mono-code`  | `Text variant="code-block"`    |
| `mono-title` | 用等宽字形的卡片标题（定价卡片模型名）                        | 16px | 600  | 22px | `text-mono-title` | `Heading variant="mono-title"` |

三条判定规则：

1. **正文里的等宽文本一律 13px**（`text-mono`）。请求 ID、Trace ID、时间戳、
   版本号这类技术值不得低于 12px（[§12.15](#1215-typography-minimum-size-rule最小字号强制规则)），
   等宽场景统一走 mono 档。
2. **固定高度的等宽代码容器**用 `text-mono-code`。字号与 mono 同值，保留名字
   是为了语义（固定高度代码卡）与将来分档的余地。Markdown 的围栏代码块属于
   **正文**（随正文滚动、高度不固定），也用 `text-mono`（13/20）。
3. **等宽卡片标题用 16px**。等宽字形在同等视觉重量下比 Inter 18px 小一档，16px
   是补偿值；它是 `card-title` 的**同层级等宽字形**，不是新开一档标题。

`Heading variant="mono-title"` 与 `card-title` 属于同一语义层级（都是卡片标题）。
**不要在 `card-title` 上叠 `font-mono text-mono`** —— 那会把 18px 标题压成 13px，
标题层级直接塌掉（定价卡片曾长期如此）。


**mono 密集行高（22px）**：等宽文本在表格单元格 / 调用日志 / 代码行这类密集行里，
20px 行高会把行与行挤在一起。这类场景单独一档：

```css
--ds-line-mono-dense: 22px; /* 只配 text-mono 使用 */
```

写法固定为 `text-mono leading-[var(--ds-line-mono-dense)]`（门禁 T9 放行
`leading-[var(--…)]` 这种**引用 Token** 的形式，它拦的是字面像素值）。

它**不是**第四档 mono 字号 —— 字号仍是 13px，只有行高变成 22px。判定：
「这段等宽文本是不是一屏几十行的密集列表」。是 → 22px；单行 ID / 密钥 / 金额 →
默认 20px。

### 12.5 页面层级：四层，不多不少

一个后台页面只有四层可见标题，缺一层或跳一层都会「看起来哪里不对」：

| 层  | 档位                                  | 用途                                                 | 组件                                         |
| --- | ------------------------------------- | ---------------------------------------------------- | -------------------------------------------- |
| 1   | `page-title` 28/600/36                | 页面标题，**每页一个**                               | `SectionPageLayout.Title`                    |
| 2   | `section-title` 22/600/30             | 页面内的语义区块（一个页面通常 2–5 个）              | `Heading variant="section-title"`            |
| 3   | `card-title` / `mono-title` 18/600/26 | 卡片、面板、图表                                     | `CardTitle` / `Heading variant="card-title"` |
| 4   | `group-title` 15/600/22               | 卡片**内部**再分组：表单分组、列表分组、弹窗字段分组 | `Heading variant="group-title"`              |

配套的硬规则：

- **16/600 不得当标题。** 16px 在阶梯里只属于三件非标题的事：「名称 + 说明」
  行标题（16/500）、设置页字段档（16/600，[§12.7](#127-设置页的名称-说明三层)）、
  指标/价格数值（16/600 + `tabular-nums`）。页面/区块/卡片/分组四层标题必须是
  28 / 22 / 18 / 15，否则页标题之下的层级会塌成一片。
- **指标 / 价格「数值」可以用 16/600。** 这类元素是**数据**，不是标题：
  它没有层级语义、不参与页面大纲，用 `tabular-nums` 等宽数字对齐。判据只有两条
  同时成立才算：① 文本是纯数值或「数值 + 单位」，不含自然语言标题；② 带
  `tabular-nums`。反例：把「模型名称」写成 16/600 不算数值，仍属违规。
- **「名称 + 说明」行标题恒为 16/500**（`text-base font-medium`）。600 只给
  设置页字段档与指标数值。账户安全卡的「删除账户 / 更改密码」、偏好设置卡的
  「界面语言」都按 16/500 执行 —— 600 会把行标题抬到与设置字段档同重，
  一屏里出现两套「加粗的 16px」，层级立刻失效。
- **分组标题不得退回 14px。** 14px 是 `body-sm` / `label` 的档位，压到分组标题上
  会让整块内容比正文还小。15/600/22 是分组标题的下限档。
- **不允许 `text-sm font-semibold` 当卡片/区块标题。**
- **表单标签恒为 `label`（14/500）**——这是**默认**档位。`FormLabel` / `Label`
  上加 `text-xs` 是违规 —— 12px 是 caption 的档位，标签不是说明。
  **设置类页面例外**，见 [§12.7](#127-设置页的名称-说明三层)。
- **12px 只给真 caption**，边界写死成三条，全部满足才允许 12px：
  1. **单行 ≤20 字**（含标点；中文按字计，英文按单词边界计）。超过就是一段说明
     文字，属于正文，用 `body-sm` 14/400；
  2. **不承载数值**。价格、额度、倍率、百分比、计数、时间长度一律 14px 起；
  3. **不是阅读主体**。段落 `<p>`、`FormDescription`、`AlertDescription` 承载的是
     「用户需要读懂才能正确操作」的信息，不属于 caption。
- **卡片 / 区块标题同行的汇总值恒为 14px**（`body-sm`）。标题右侧那个
  `总计：$0.03`、`共 181 条`、`Total: 181` 是**信息**不是脚注，恒为 `body-sm`
  （14/22）。18/600 与 14/400 之间只隔一档，正好构成「标题 → 总量」两级；压到
  12px 会变成三档，中间那档空掉。守卫：`spec-guards.test.ts` 的
  `keeps card summary values at 14px`。
- **弹窗/抽屉标题 18px。** `text-xl`（20px）不在阶梯内，不要用来放大弹窗标题。

### 12.6 无障碍大字档（Simple Large-font 预设）

`[data-theme-preset='simple-large']` 是用户在主题里主动开启的「超大字体简易」
预设。它是**同一套阶梯的放大档**，不是第二套字号体系：档位名称、用途、相对顺序
完全一致，只有取值按 ~1.35× 放大，行高同比放大以维持原阶梯的阅读节奏。

关键约束：**它声明在 `tokens/typography.css`，不是 `theme-presets.css`。** 规范要求
「字号、行高、字重、字体」由 Typography 统一管理，主题只管颜色、密度只管间距。
此前这段覆盖写在主题预设里，等于让字号阶梯有了第二个来源 —— 改基准值对这个预设
无效，改这个预设也不影响其他预设。现在两个来源合一，门禁 T1（`--text-*` 只能出现
在 `typography.css`）也就不再需要例外。

声明在 `@theme` 之外：这些是**运行时按 data 属性切换**的覆盖值，不是主题变量
注册；放在 `@theme` 里会被 Tailwind 当成默认值再生成一遍工具类。

### 12.7 设置页的「名称 + 说明」三层

系统设置页（`features/system-settings/**`）是**列表型**结构：每一行都是「名称 +
说明」成对出现。这类结构里名称必须明显高于说明，否则整页读起来就是「一堆同号
小字」。

| 层       | 档位                | 用途                                                       |
| -------- | ------------------- | ---------------------------------------------------------- |
| 容器标题 | `group` 18/600/26   | 带边框的分组容器（「聊天区域」「管理区域」），等同卡片标题 |
| 字段标签 | `field` 16/600/24   | 字段标题、开关行标题（「Client Secret」「主域名」）        |
| 说明文字 | `body-sm` 14/400/20 | `FormDescription`、手写 `<p>`、`AlertDescription`          |

机器可读的值（URL / 域名 / 端点 / 密钥 / 邮箱 / Client ID / Slug / 路径）用
等宽 13/20（`text-mono`）；人读的名称（站点名、发送者姓名）不用等宽。

实现方式是**上下文声明**，不是逐个调用点加类名：

```tsx
// 整页声明一次，全页 280 个 FormLabel 自动继承
<FormLabelTierProvider tier='field'>…</FormLabelTierProvider>

// 分组容器自己升一档，内部再由 SettingsControlChildren 降回 field
<SettingsControlGroup>…</SettingsControlGroup>
```

`SettingsPage` 已经声明了 `field` 档，新增设置字段不需要任何额外类名。违反了
会怎样：`FormLabel` 上硬写 `text-sm font-normal` 会把标签压回 14px、与说明同号
同重，这种覆盖必须删掉。

`AlertTitle` 也跟随该上下文：设置页里的「设置引导」是 16/600，普通页面仍是原来
的 14/500 加粗。

### 12.8 控件与说明文字的下限（管理端）

「12px 只给真 caption」最容易破防的地方是**控件文字**与**说明性正文**：
`text-xs` 是合法类名，T1–T7 都不会报它，于是密集的技术弹窗里按钮、下拉、输入框
一个接一个退回 12px，整页比个人资料页小一号。

因此管理端（`features/` 下 channels / dashboard / keys / models / organization /
redemption-codes / subscriptions / system-info / system-settings / task-plugins /
usage-logs / users / wallet）执行两条下限：

| 位置                                                                                              | 下限                     | 依据                      |
| ------------------------------------------------------------------------------------------------- | ------------------------ | ------------------------- |
| 控件文字（`Button` / `SelectTrigger` / `Input` / `Textarea` / `ToggleGroupItem` / 小写 `button`） | 14px（`label` 14/500）   | 「按钮文字」就是 label 档 |
| 说明性正文（`<p>`）、`AlertDescription`、`FormDescription`、`dt`                                  | 14px（`body-sm` 14/400） | 说明文字是正文，不是徽标  |
| 表格单元格与分页（`ui/table.tsx` / `data-table/core/pagination.tsx`）                             | 13px（`dense` 13/400/20） | 密集数据专用档，扫读优先  |
| 表格表头（`ui/table.tsx` 的 `th`）                                                                | 12px（500/18）           | 列名是标识不是正文        |

配套细节：

- 紧凑按钮不再手写 `h-7 text-xs`，用 14px 文字时高度给到 `h-7`（28px）以上；
  `h-6`（24px）装不下 14/22 的行高。**小按钮（`Button size="sm"`）v1.2 起为
  12/500/18** —— 由 `button.tsx` 统一下发，调用处不得再覆盖；
- 等宽代码块用 `text-mono`（13/20）或 `text-mono-code`（13/20），不要写 `text-xs`。
- 以下场景**仍然是 12px**：Badge（计数、分类标签、折扣角标）/ `AvatarFallback`、
  表格列名（uppercase）、时间戳、单元格次级信息、日历格子。
- **`StatusBadge` 是例外，固定 14px（`body-sm`）**：它承载运行时状态文字（渠道状态、
  任务结果），要和同一行的表格正文同档阅读，12px 会显得像脚注。

守卫测试：`src/design-system/__tests__/control-typography.test.ts`，三条：

1. **控件下限**：扫描上面 13 个管理端目录，任何控件标签或 `<p>` 上出现 `text-xs`
   直接判失败，并在失败信息里给出文件:行号。
2. **分组标题下限**：扫描 13 个管理端目录 + `security` + `profile`，`h3`/`h4`/`h5`
   上出现 `text-sm` / `text-xs` 判失败。`uppercase` 的 eyebrow 与 `font-mono`
   的标识符标题不计入。
3. **设置页标签档位**：扫描 `features/system-settings`，`FormLabel` / `Label` 上
   硬写 `text-sm` / `text-xs` / `font-normal` 判失败。

前台页面（营销页、定价页）不在扫描范围内，需要时按同一标准单独处理。

### 12.9 内容排版（Markdown prose）

AI 回答、模型输出、docs-web 的文档正文是**内容排版**，不是界面层级。它们的标题
自成一套，比界面标题低一到两档 —— 把 Markdown 的 `h1` 抬到界面的 28px，会让回答
里的标题比它所在卡片的标题（18px）还大，页面层级当场塌掉。

| Markdown | 档位      | 字号/行高 | 字重                           |
| -------- | --------- | --------- | ------------------------------ |
| `h1`     | `h2`      | 24/32     | 600                            |
| `h2`     | `h3`      | 18/28     | 600                            |
| `h3`     | 16/24     | 16/24     | 600                            |
| `h4`     | `body`    | 14/22     | 600                            |
| `h5`     | `body`    | 14/22     | 600（tertiary 色）             |
| `h6`     | `caption` | 12/18     | 600 + uppercase（tertiary 色） |

正文用 `body-long`（16/26），行内代码 `mono`（13/20），围栏代码块 `mono`（13/20，
随正文滚动）。实现位置两处：

- `components/ai-elements/response-renderer-blocks.tsx` 的 `headingClasses`
  （AI 回答、模型输出）；
- `components/ui/markdown.tsx` 的 `[&_h1]`…`[&_h4]` 一串后代选择器
  （`RichContent` 的 markdown 分支、协议正文）。

docs-web 的文档正文同一套，只是文档的一级标题由 `DocsTitle` 按界面 `h1`（30）
渲染，正文从 Markdown 的 `h2` 开始，所以页面上看到的是 **28 → 18 → 16**：

| 页面位置                | 取值                               |
| ----------------------- | ---------------------------------- |
| 文档标题（`DocsTitle`） | 28/36 600 —— 界面 `h1`             |
| 正文一节（Markdown h2） | 18/28 600（`--text-doc-prose-h2`） |
| 正文子节（Markdown h3） | 16/24 600（`--text-doc-prose-h3`） |
| 正文段落 / 列表         | 16/26 400（`body-long`）           |
| 表格单元格              | 13/20（`dense`）                   |

卡片标题（`Uter-card` 里的 `h3`）不算正文，仍按界面 `h3` 的 18/26；docs-web 用
`.prose :is(h3):not(.Uter-card h3)` 把两者分开。

**只对 Markdown 渲染的内容生效。** `Heading` / `CardTitle` / `DialogTitle` 等界面
标题不得借用这条 —— 界面层级永远是 28 / 22 / 18 / 15 四层。

### 12.10 定价卡片

| 元素                                                             | 档位                                             |
| ---------------------------------------------------------------- | ------------------------------------------------ |
| 模型名（标题）                                                   | `Heading variant="mono-title"`（等宽 16/600/22） |
| 供应商                                                           | `caption`                                        |
| 描述（如「面向创意写作、分析与可控智能体工作流的 Claude 模型」） | `body-sm`（14/22）                               |
| 报价数值                                                         | `mono`                                           |
| 报价标签                                                         | `caption`                                        |

描述用 14px 而不是 16px：它是辅助信息，与 16px 等宽标题同档会互相抢层级，且两行
16px 会把卡片撑高、把报价区挤出首屏。

### 12.11 补充档（不在十档内，仅用于兼容）

| Token              | 用途           | 约束                 |
| ------------------ | -------------- | -------------------- |
| `text-xl`（20/28） | 既有 20px 标题 | 不得用于新增页面标题 |

阶梯到 `text-4xl`（36px）为止。**48px 以上不纳入系统**：营销页主视觉同样使用
`display` 档（36/600/44），需要更大字号时按 [§26 例外登记](#26-例外登记) 的流程
登记，而不是随手写 `text-[3rem]`。

### 12.12 多行主标题的行高

`display` 档的单行行高是 44px（36px × 1.22）。这个比例在单行时是对的，但中文营销
主标题常折成 3–4 行，1.11 会让行与行挤在一起。因此给多行场景单独一档：

```css
--ds-line-display-multiline: 1.5; /* 无单位比例，随字号缩放 */
```

用 `Heading` 的 `multiline` 开启：

```tsx
<Heading variant='display' level={1} multiline>
  Uter.ai 优特智能，一个入口，直达全球大模型
</Heading>
```

两个刻意的设计：

1. **无单位比例而不是像素。** 响应式下移动端 28px × 1.5 = 42px、桌面
   36px × 1.5 = 54px，行高跟着字号走，不会出现「字号变小、行高还是 48px」的
   倒挂。
2. **规则放在 `@layer components` 之外。** 调用方要保留 Tailwind 的响应式字号
   （`text-3xl md:text-4xl`），只覆盖行高；放在 components 层会被 utilities 层的
   `line-height` 覆盖，等于没写。这是全站唯一一处刻意的层外规则，仅此一例。

### 12.13 移动端全屏菜单

移动端全屏菜单（`public-header.tsx` 的 overlay）的一级项是**触屏列表**，用 16/24
（`text-base font-medium`），比桌面一级导航的 14/22 大一档：触屏点按面积与
可读性都要求更大。桌面导航仍是 `label` 14/500。

判据是**输入方式**，不是屏幕宽度：鼠标点的用 14，手指点的用 16。

### 12.14 字体家族与加载

**家族分工**（2026-10-30 字体规范 v1.1 整合）：

| 使用范围 | 字体                       | 说明                                   |
| -------- | -------------------------- | -------------------------------------- |
| 界面文字 | Inter                      | 英文、数字、拉丁字符与全部 UI 文本     |
| 中文     | 思源黑体                   | `@fontsource-variable/noto-sans-sc` 可变字重，中文标题/正文/表格/表单 |
| 等宽     | 系统等宽栈                 | SF Mono / Menlo / Consolas —— API Key、代码、金额、模型 ID |

字体栈只声明一次，在 `styles/theme.css` 的 `--font-ui`；等宽是 `--font-mono`。
浏览器按字形覆盖自动分工：英文/数字落 Inter，中文落思源黑体，**不要**给中英文
分别设置不同字号或字重体系。`Source Han Sans SC` 与 `Noto Sans SC` 是同一字体的
两个发行名称，本项目加载的是后者，CSS 里不要混写两个名字。

**等宽字体决策：不引入 JetBrains Mono。** 外部建议以 JetBrains Mono 统一代码
场景，本项目评估后维持系统等宽栈 —— 零加载成本、无 FOUT、跨平台渲染稳定；
风格统一不足以抵消新增字体文件的包体与加载策略复杂度。若未来引入，须同步
`--font-mono`、mono 三档说明与核查页。

**加载要求**：

1. 字体文件随项目本地分发（`@fontsource`），不依赖用户系统是否安装；
2. Inter Variable 覆盖 400–700 全部四档字重，可变字重不需要按档拆文件；
3. 中文用可变字体单文件，避免按字重加载多份中文字体；
4. `font-display: swap`，字体加载不阻塞首屏渲染；
5. 上线前检查英文、中文、数字、货币符号与中英标点混排的实际渲染。

**数字排版（金额 / Token / 余额 / 调用量 / 价格）**：

- 一律 Inter + `tabular-nums`（等宽数字），数字变化时宽度不跳动：
  指标/价格数值类元素按 §12.5 判据带 `tabular-nums`；
- 统一小数位数与千位分隔符；货币符号与金额的间距遵循币种展示习惯；
- 数字与单位用独立排版元素，不要在同一段文字里随手改字号；
- 不用字间距制造数字宽度。

**中英文混排检查点**：英文标点/中文标点、括号、斜杠、连字符在 14px 下的混排
观感；API 路径、Key、代码等技术信息用等宽字体，不与中文正文塞进同一个不可
断行元素。

**字间距：全站恒为 0。** 外部规范曾建议 display/h1/h2 使用 −0.5/−0.3/−0.2px
负字距，**本规范不采纳**（2026-10-30 拍板）：Inter 在 14–28px 的中文混排场景下
负字距收益极小，中文正文更不该用负字距；且 T12 门禁已把 `tracking-*` 全站拦截，
放开个别档位等于给门禁开第一个口子。英文全大写的短标签如确需 0.04em 字距，
走 [§26](#26-例外登记) 流程，不散写。

### 12.15 Typography Minimum Size Rule（最小字号强制规则）

> **强制规则** · 2026-10-30 起生效 · 门禁 **T16**（`check-design-tokens.mjs`）

**Uter PC Web 所有可见文本的最小字号为 12px。**

1. 禁止使用小于 12px 的字号，包括 11px、10px 和浏览器默认缩放产生的非预期
   小字号；
2. 所有辅助信息、时间、日期、版本号、状态、图表坐标轴与图例、表格表头、
   请求/Trace ID、脚注、Badge、Tooltip、错误提示、权限说明均不得低于 12px
   —— 原外部规范中的 11px caption 已否决，统一并入 12px；
3. **不得通过缩小字号解决布局空间不足的问题**；优先调整容器宽度、间距、
   换行、截断与横向滚动；
4. 新增 Typography Token 必须满足下限约束（阶梯里 `--text-xs` = 12px 是
   全系统最小档，`tokens.test.ts` 钉死）；
5. 自动化检查扫描一切字号声明形式（`text-[Npx]`、`font-size:`、`fontSize:`、
   `--text-*:` Token），换算后 < 12px 即 **T16** 违规；
6. 13px 的 `dense` 档是**密集数据的专用字号**（表格单元格、二级导航、分页），
   不是节省空间的常规方案 —— 普通说明文字仍走 14px。

---

## 13. 间距、形状、描边、投影、动效

> **👁 可视核查** → 核查页 [§15 圆角七档](#radius)、[§16 间距](#space)、
> [§17 密度 Token](#density)、[§18 投影六档](#elevation)、[§19 动效](#motion)
>
> 用顶部「密度 sm / xl」按钮切换，直接观察"密度只改留白、不改字号"是否成立。

### 13.1 间距

间距阶梯就是 Tailwind 的 4px 单位，因此**没有**另建一套 `--spacing-*`。直接用
`gap-2`、`p-4`、`mt-6`。

| 场景           | 值      | Tailwind            |
| -------------- | ------- | ------------------- |
| 图标与文字     | 4–6px   | `gap-1` / `gap-1.5` |
| 控件之间       | 8px     | `gap-2`             |
| 表单标签与控件 | 8px     | `gap-2`             |
| 卡片内元素     | 16px    | `gap-4`             |
| 卡片之间       | 16px    | `gap-4`             |
| 区块之间       | 24–32px | `gap-6` / `gap-8`   |
| 页面左右留白   | 24–32px | `px-6` / `px-8`     |

**段落间距**（字体规范 v1.1 补充）—— 段落间距属于布局间距，**不要用加行高来代替
段落间距**：

| 内容类型           | 段落间距  |
| ------------------ | --------- |
| 普通正文段落       | 8px       |
| 长文本段落         | 12–16px   |
| 帮助文档段落       | 16px      |
| 列表项目间距       | 6–8px     |
| 标题与正文         | 8–12px    |
| 卡片标题与内容     | 12–16px   |


### 13.2 内容宽度

内容区宽度只有三档，对应三种版面：

| 档位       | 值     | 写法                   | 用途                                 |
| ---------- | ------ | ---------------------- | ------------------------------------ |
| 营销内容列 | 1152px | `max-w-6xl`            | 官网首页各区块（首屏是「读」的版面） |
| 标准内容区 | 1280px | `max-w-container`      | 控制台、排行、法务、文档             |
| 密集比较页 | 1800px | `max-w-container-wide` | 模型广场（侧栏 + 价格矩阵）          |

后两档来自 Token：`--ds-content-max` / `--ds-content-max-wide`
（`styles/index.css` 的 `@utility`）。业务代码**不要**再写 `max-w-[1800px]`、
`max-w-[1280px]`。

营销内容列不设 Token：1152px 是 `max-w-6xl` 的原生档位。

**为什么宽表单独一档**：模型广场是「模型 × 价格 × 供应商」的横向比较矩阵，1280px
会把价格列挤成两行，比较立刻失效；1800px 是 280px 筛选侧栏 + 四到五列模型卡片
仍然能并排的上限。它**不是**「更大的内容区」，只有这一类页面可以用。

弹窗 / 抽屉的宽度**不属于内容区宽度**：它们各自按 `sm:max-w-[…]` 声明，不读
这两个 Token。

### 13.3 密度 Token

密度只允许改变「留白与控件高度」，不允许改变正文语义。见 `tokens/spacing.css`：

| Token                       | 默认 | `sm` | `xl` |
| --------------------------- | ---- | ---- | ---- |
| `--ds-table-row-padding-y`  | 12px | 8px  | 14px |
| `--ds-table-cell-padding-x` | 12px | 8px  | 14px |
| `--ds-control-height-md`    | 40px | 36px | 44px |
| `--ds-control-height-sm`    | 36px | 32px | 40px |
| `--ds-button-height-md`     | 36px | 32px | 40px |
| `--ds-button-height-sm`     | 32px | 28px | 36px |
| `--ds-button-height-lg`     | 40px | 36px | 44px |
| `--ds-nav-height-md`        | 32px | 28px | 36px |
| `--ds-nav-height-sm`        | 28px | 24px | 32px |
| `--ds-nav-height-lg`        | 48px | 40px | 52px |
| `--ds-form-field-gap`       | 8px  | 6px  | 10px |
| `--ds-card-padding`         | 24px | 16px | 28px |
| `--ds-page-gutter`          | 24px | 16px | 32px |

`--ds-nav-height-*` 驱动侧边栏菜单项与分组标题行高。`sm` 档的
`--ds-nav-height-sm` 收到 24px 就是触控下限，不得再低。

**内联胶囊高度（不随密度变化）**：`--ds-chip-height` = 21px，用于多选的值胶囊、
`+N more` / `Collapse` 徽标按钮、标签条。21px 不是 4px 栅格的整数倍 —— 它由
`text-xs`（12/16）+ 上下各 2.5px 光学补正得出，属于胶囊专用档，**不要**并进
`--ds-control-height-*`，也**不跟密度档走**。

### 13.4 圆角

> **👁 可视核查** → 核查页 [§15 圆角七档](#radius)
>
> 每个档位都画了实心方块，看实际弧度 —— 8px（控件）与 10px（卡片/弹窗）的
> 差别在真实页面里是否需要同时存在。

基准 `--radius` = 8px（即默认控件圆角 r-md），其余档位按比例推导，因此
`data-theme-radius` 改基准就能整体缩放。

| Token           | 值     | 用途                                   |
| --------------- | ------ | -------------------------------------- |
| `--radius-xs`   | 4px    | 极小徽标、内嵌标记                     |
| `--radius-sm`   | 6px    | 关闭按钮、密集控件点击区               |
| `--radius-md`   | 8px    | **按钮、输入框、标签页触发器（默认）** |
| `--radius-lg`   | 10px   | **卡片、弹窗、标签页容器、图标按钮**   |
| `--radius-xl`   | 12px   | 强调容器、大圆角方形头像               |
| `--radius-2xl`  | 16px   | 展示型卡片                             |
| `--radius-full` | 9999px | 胶囊徽标、圆形头像、开关轨道           |

**任意圆角值只剩一类结构性用法**：`rounded-[inherit]`（`ui/scroll-area.tsx`）。
滚动视口继承父容器圆角，是 Tailwind 官方 escape hatch，7 档里没有任何一档能表达
「和父级一样」——写死任何一档都会在 `data-theme-radius` 缩放时与父容器错位。门禁
T10 直接把它识别为合法写法，不需要 ALLOWLIST 条目。

### 13.5 描边

| Token                     | 值         | 用途                       |
| ------------------------- | ---------- | -------------------------- |
| `--ds-stroke-width`       | 1px        | 卡片、弹窗、表格分隔线     |
| `--ds-color-border`       | `--border` | 默认描边                   |
| `--ds-color-border-input` | `--input`  | 输入控件描边               |
| `--ds-focus-ring-width`   | 1px        | 焦点外扩环（原生元素兜底） |

层级靠「1px 描边 + 表面色差」表达，不靠投影。

**非 1px 描边只有两类，且都不是「容器的边框」：**

| 类别     | 取值       | 判据                                         | 现有位置                                                        |
| -------- | ---------- | -------------------------------------------- | --------------------------------------------------------------- |
| 镂空环   | 2px        | 用背景色画描边，把叠在一起的元素「挖」出间隙 | `home/sections/features.tsx` 的 API/SDK/CLI 圆形叠层            |
| 图形描边 | 1px 或 2px | 图形本身是画出来的形状，线宽随图形尺寸       | 加载 spinner（32px 圆环用 2px）、图表 series 指示线（1px 虚线） |

两条硬约束：① 描边宽度**不出现小数**（`border-[1.5px]` 在 1x 屏会渲染成 1px 或
2px 的不确定结果）；② 图形描边写在图形组件内部，不得出现在容器上。

### 13.6 投影

**四档投影 + 一档状态辉光**，判据是「这块面还有没有一个自己的平面位置」：

| Token                      | 值                                        | 用途                             |
| -------------------------- | ----------------------------------------- | -------------------------------- |
| `--ds-elevation-none`      | `none`                                    | 静止的页面内元素（默认）         |
| `--ds-elevation-popover`   | `0 1px 2px 0`                             | 下拉面板、气泡、悬浮提示         |
| `--ds-elevation-overlay`   | `0 4px 6px -4px, 0 10px 15px -3px`        | 弹窗、抽屉、浮层                 |
| `--ds-elevation-raised`    | `0 12px 24px -12px, 0 2px 6px -2px`       | 拖拽中的元素（瞬时离开文档流）   |
| `--ds-elevation-marketing` | `0 20px 50px -25px`（dark 另给 60px/0.7） | 营销展示卡片（脱离页面平面）     |
| `--ds-glow-online`         | `0 0 8px`                                 | 在线状态点（状态语义，不是层级） |

**除这五档之外一律不投影。** 卡片、表格、侧边栏、页面容器、按钮、徽标都不加
阴影 —— 它们靠 1px 描边与表面色差分层。

为什么「拖拽」与「营销卡片」各占一档而不复用 `overlay`：

1. 拖拽是**瞬时**状态：影子要够重才能让用户确认「它被我拿起来了」，但只持续几百
   毫秒，不会长期占据视觉重量；
2. 营销展示卡片是**静态**的展示物，影子必须大而柔（50px 模糊、-25px 收缩），
   `overlay` 的 15px 撑不住 2xl 圆角的展示卡片；
3. 复用 `overlay` 会让「弹窗」与「首页演示窗口」在视觉上无法区分层级。

`--ds-glow-online` 不是投影档，是**状态语义**：亮着 = 在线。它不表达层级，所以
只在状态点出现，不能拿来给卡片「提亮」。

|  |  |  |  |  |
| --- | --- | --- | --- | --- |
写法只有 `shadow-(--ds-elevation-{none|popover|overlay|raised|marketing})` 与
`shadow-(--ds-glow-online)`。`shadow-sm` / `shadow-lg` / `shadow-[…]` 全部被门禁
T6 拦下；自造档位（例如 `--ds-elevation-card`）同样被拦 —— 门禁只认
`check-design-tokens.mjs` 里 `ELEVATION_TOKENS` 列出的六个值。新增档位必须先改
`tokens/elevation.css` 与本节，再往集合里加。

### 13.7 动效

时长按「这段动效在表达什么」分五组，而不是按组件分。全部落在
`tokens/elevation.css` 的 `--ds-motion-*`：

| 组       | Token                                                                | 值                                   | 用途                         |
| -------- | -------------------------------------------------------------------- | ------------------------------------ | ---------------------------- |
| 交互反馈 | `--ds-motion-fast`                                                   | 100ms                                | 颜色、描边、透明度的状态变化 |
|          | `--ds-motion-base`                                                   | 200ms                                | 展开收起、宽度位移这类形变   |
|          | `--ds-motion-slow`                                                   | 350ms                                | 浮层视口 / 背板级整块位移    |
| 营销节奏 | `--ds-motion-marketing-fast`                                         | 300ms                                | 营销面的悬停、下划线生长     |
|          | `--ds-motion-marketing-base`                                         | 500ms                                | 营销面的容器级展开、全屏菜单 |
| 内容入场 | `--ds-motion-enter`                                                  | 600ms                                | 首屏元素的观看节奏           |
| 循环动画 | `--ds-motion-loop-shimmer / pulse / caret / spin / marquee / border` | 1.8s / 1.5s / 1s / 0.8s / 20s / 3.2s | 周期由内容决定               |
| 数据过渡 | `--ds-motion-data-fast` / `--ds-motion-data`                         | 250ms / 500ms                        | 值在变化，不是操作被响应     |

缓动只有三条，与组绑定，不允许自由组合：

| Token                        | 值                            | 绑定                       |
| ---------------------------- | ----------------------------- | -------------------------- |
| `--ds-motion-ease`           | `cubic-bezier(0.4,0,0.2,1)`   | 交互反馈、数据过渡         |
| `--ds-motion-ease-marketing` | `cubic-bezier(0.16,1,0.3,1)`  | 营销节奏、内容入场         |
| `--ds-motion-ease-snappy`    | `cubic-bezier(0.22,1,0.36,1)` | 整块位移（浮层视口、背板） |

为什么时长和缓动捆在一起：缓动是**节奏的一部分**，不是独立维度。500ms 配
ease-in-out 会拖沓，100ms 配 ease-out-expo 会抽搐 —— 允许自由组合就等于允许组合
出错的节奏。

判定口诀：**如果删掉这个动画，用户会以为「没点上」，那它就是交互反馈**；如果删掉
只是少了点氛围，它属于营销节奏或内容入场；如果它要一直动，那它是循环动画，周期
由内容走完一圈的时间决定，与「快慢」无关。

写法：交互反馈与营销节奏用工具类（时长与缓动一起下发）—— `ds-motion-fast` /
`ds-motion-base` / `ds-motion-slow` / `ds-motion-marketing-fast` /
`ds-motion-marketing` / `ds-motion-data`。入场、循环两类必须与 `@keyframes` 写
在一起（`styles/index.css`），直接引 `var(--ds-motion-enter)` /
`var(--ds-motion-loop-*)`。

**不要**再写 `duration-300`、`duration-[0.35s]`、`ease-out`、
`ease-[cubic-bezier(...)]`、`1.8s`、`0.6s` 这类字面值。

### 13.8 裸 `transition-*` 的默认值也是这个集合的一部分

`transition-colors` / `transition-transform` / `transition-all` **不写时长**时，
Tailwind 读 `--default-transition-duration`（内置 **150ms**）与
`--default-transition-timing-function`。150ms 不在 fast/base/slow 三档里 ——
也就是说全站 103 处裸 `transition-*` 一直在用集合外的时长，而门禁只检查**显式
写出**的 `duration-*`，看不见它们。

所以这两个默认值在 `tokens/elevation.css` 里被指到了集合内：

```css
@theme {
  --default-transition-duration: var(--ds-motion-fast);
  --default-transition-timing-function: var(--ds-motion-ease);
}
```

含义：**裸 `transition-*` = 交互反馈最快一档（100ms）**。要 200 / 350 就显式写
`ds-motion-base` / `ds-motion-slow`。这条必须写在 `@theme` 里 —— 写进 `:root` 时
Tailwind 读不到，工具类仍旧是 150ms（与字号阶梯同一个坑）。

**唯一的例外是 `animate-in` / `animate-out` 上的 `duration-*`**：tw-animate 用它设的
是 `animation-duration`（进入/退出动画），和 `transition-duration` 是两个轴。这类
写法必须和 `animate-in` / `animate-out` 出现在同一行，门禁 T11 按此放行。

---

# 第四部分 · 组件规范

## 14. 组件实现位置与语义组件

- **`src/components/ui/`** —— 组件正式实现位置。Button / Input / Badge / Dialog /
  Table / Select / Tabs / Sidebar 等都在这里。
- **`src/design-system/components/`** —— 只放 `ui/` 没有的排版语义组件
  （`Text` / `Heading`）。
- **`src/design-system/patterns/`** —— 组合模式（`PageHeader`）。

不允许在两处各实现一遍同一个组件。

### Text

```tsx
<Text variant='body' color='secondary' as='p' clamp={2}>
  描述文字
</Text>
```

| Prop       | 取值                                                                           | 说明               |
| ---------- | ------------------------------------------------------------------------------ | ------------------ |
| `variant`  | `body` / `body-long` / `body-sm` / `label` / `caption` / `code` / `code-dense` | 字号档位，不可覆盖 |
| `color`    | `primary` / `secondary` / `danger` / `success` / `inherit`                     | 语义色             |
| `weight`   | `400` / `500` / `600` / `700`                                                  | 覆盖字重           |
| `truncate` | boolean                                                                        | 单行截断           |
| `clamp`    | `1` / `2` / `3`                                                                | 多行截断           |
| `as`       | 任意标签                                                                       | 默认 `span`        |

`body-long` 是 16/26 的长文本档，只用于连续阅读内容。


### Heading

```tsx
<Heading variant="page-title">模型广场</Heading>
<Heading variant="section-title" level={2}>用量趋势</Heading>
```

| variant         | 视觉      | 默认标签 |
| --------------- | --------- | -------- |
| `display`       | 36/700/40 | `h1`     |
| `page-title`    | 28/600/36 | `h1`     |
| `section-title` | 22/600/30 | `h2`     |
| `card-title`    | 18/600/26 | `h3`     |
| `dialog-title`  | 18/600/26 | `h3`     |
| `group-title`   | 15/600/22 | `h4`     |
| `mono-title`    | 16/600/22 | `h3`     |

输出真实 `h1`–`h6`。**视觉与语义分离**：需要「看起来是 h3、结构上是 h2」时传
`level={2}`。`multiline` 把行高换成 1.5 比例，只用于折 3 行以上的营销主标题。

### PageHeader

```tsx
<PageHeader
  title='模型广场'
  description='共 128 个模型可用'
  actions={<Button>刷新</Button>}
/>
```

把「标题 + 描述 + 操作」的排版收敛到一处，页面不再各自决定标题字号与间距。

### 调用处的边界

页面可以用 `className` 调整**布局**（宽度、间距、对齐），但不得覆盖组件已经
定义的**视觉身份**：

| 允许                               | 不允许                       |
| ---------------------------------- | ---------------------------- |
| `w-full`、`mt-4`、`justify-center` | `rounded-lg`（改按钮圆角）   |
| `max-w-md`                         | `text-base`（改按钮字号）    |
| `hidden sm:block`                  | `font-bold`（改按钮字重）    |
| `aria-label`、`data-*`             | `bg-red-500`（绕开变体系统） |

新增代码请用 `variant` / `size` 表达差异。

### 状态与可访问性

所有交互组件必须覆盖：

- `default` / `hover` / `focus-visible` / `active` / `disabled` / `loading`
- 键盘可聚焦，焦点环 1px（`--ds-focus-ring-*`），不允许 `outline: none` 抹掉
- 加载态不能改变按钮尺寸
- 图标按钮必须提供 `aria-label`

## 15. 组件尺寸与 Token 对应

> **👁 可视核查** → 核查页 [§21 控件尺寸](#control)、[§23 组件示范](#comp)
>
> 组件示范区把 Button / Badge / Input / Card / Dialog / Table / Toast / Empty
> 全部渲染成真实组件，可逐个核对字号、字重、圆角、内边距。

这些是硬数值，与本项目 Token 一一对应。改尺寸先改 Token，不要在调用点写死：

| 组件               | 规范值                        | 本项目实现                                                            |
| ------------------ | ----------------------------- | --------------------------------------------------------------------- |
| Button `md`        | 高 36px                       | `size="default"` → `--ds-button-height-md` 36px                      |
| Button `sm`        | 高 32px                       | `size="sm"` → `--ds-button-height-sm` 32px                           |
| Input `md`         | 高 40px                       | `--ds-control-height-md` 40px                                        |
| Input 文字         | 全平台 14px                   | `body-sm`（**不设 H5 16px 例外**）                                   |
| Table 行高         | 48px                          | `TableRow` 的 `h-12`                                                 |
| Table 单元格内边距 | 水平 12 / 垂直 8px            | `TableCell` 的 `px-3 py-2`                                           |
| Table 表头         | 高 40px、`px-3 py-2`          | `TableHead`                                                          |
| Alert 内边距       | 16px                          | `Alert` 的 `p-4`，图标与文字间距 `gap-x-3`（12px）                   |
| Sidebar 宽         | 240–280px                     | `SIDEBAR_WIDTH` = 15rem（240px，区间下限）                           |
| Toast 宽           | ≈356px                        | `sonner` 的默认宽度                                                  |
| 焦点环             | 1px 品牌色                    | `--ds-focus-ring-width` 1px + `--ring`（组件层一律 `focus-visible:ring-1`） |
| 圆角               | 控件 8px / 卡片弹窗 10px      | `--radius-md` / `--radius-lg`                                        |

### 组件排版对应表

| 组件             | 字号                        | 字重      | 行高 | 圆角               |
| ---------------- | --------------------------- | --------- | ---- | ------------------ |
| Button           | 14px（`label`）             | 500       | 20px | `--radius-md` 8px  |
| Input / Textarea | 14px（`body-sm`）           | 400       | 20px | `--radius-md` 8px  |
| Label            | 14px（`label`）             | 500       | 20px | —                  |
| Badge            | 12px（`caption`）           | 400       | 16px | `--radius-full`    |
| StatusBadge      | 14px（`body-sm`）           | 400       | 20px | `--radius-full`    |
| Card 标题        | 18px（`h3`）                | 600       | 26px | `--radius-lg` 10px |
| Card 描述        | 14px（`body-sm`）           | 400       | 20px | —                  |
| Dialog 标题      | 18px（`h3`）                | 600       | 26px | `--radius-lg` 10px |
| Dialog 描述      | 14px（`body-sm`）           | 400       | 20px | —                  |
| Table 表头       | 14px（`label`）             | 500       | 20px | —                  |
| Table 单元格     | 14px（`body-sm`）           | 400       | 20px | —                  |
| Table 次要说明   | 12px（`caption`）           | 400       | 16px | —                  |
| Alert 标题       | 14px（`label`）             | 500       | 20px | —                  |
| Alert 描述       | 14px（`body-sm`）           | 400       | 20px | —                  |
| Toast 标题/描述  | 14px（`label` / `body-sm`） | 500 / 400 | 20px | `--radius-lg`      |
| Markdown 正文    | 16px（`body-long`）         | 400       | 26px | —                  |
| Markdown 表格    | 14px（`body-sm`）           | 400       | 20px | —                  |
| Sidebar 菜单项   | 14px（`label`）             | 500       | 20px | `--radius-md`      |
| Sidebar 分组标题 | 12px（`caption`）           | 600       | 16px | —                  |
| Empty 标题       | 18px（`h3`）                | 600       | 26px | —                  |
| Empty 说明       | 14px（`body-sm`）           | 400       | 20px | —                  |


### 卡片标题旁的汇总值：14px

卡片标题右侧那一小串「总计 / 合计 / 共 N 条」是**和标题同一层级的补充信息**，
不是说明文字，**一律 14px（`body-sm`，`text-sm`）**：

```tsx
<div className='text-lg font-semibold'>{t('Quota Distribution')}</div>
<span className='text-muted-foreground text-sm'>
  {t('Total:')} {chartData.totalQuotaDisplay}
</span>
```

| 写法                                               | 判定                            |
| -------------------------------------------------- | ------------------------------- |
| `<span className='text-muted-foreground text-sm'>` | ✅ 14px，正确                   |
| `<span className='text-muted-foreground text-xs'>` | ❌ 12px，把汇总值降成了说明文字 |
| 用 `<p>` 或独立一行渲染                            | ❌ 汇总值属于标题行，不另起一行 |

**为什么不能是 16px**：16px 是 `group-title` 与长文本的档位。汇总值跟标题（18px
`card-title`）同排，16px 会让「标题 → 汇总值」只差 2px，层级塌掉。

守卫：`control-typography.test.ts` 的 `keeps card header summaries at 14px`。

### 加载态用 `loading` 属性

```tsx
<Button loading={mutation.isPending}>保存</Button>
```

`loading` 做三件事，调用方不要再手写：

1. **文字保留在 DOM 里**，宽度不塌缩；
2. spinner 作为**前置图标追加**，尺寸统一 18px（`size-4.5`），不随 `size` 档缩放；
   `icon-xs` 的 24px 容器例外（`size-3`）；
3. 自动 `disabled` + `aria-busy='true'` + `data-loading='true'`。

守卫：`components/ui/__tests__/button-loading.test.tsx`。

**存量迁移**：全站仍有约 100 处手写 `animate-spin`。这些是按页面逐步迁移的存量，
新增与改动的代码**必须**用 `loading`。

## 16. Button 的九个尺寸档

> **👁 可视核查** → 核查页 [§20 Button 九档](#btn)
>
> 九档尺寸 + 六种变体并排展示，可直接判断高度差是否够用、圆角是否合理。
> 切换密度按钮，观察高度是否跟随 Token 收缩。

按钮高度**只来自 `size` 档**，全部由密度 Token 驱动（`data-theme-scale` 切换即
跟随），不要在调用点写 `h-N`：

| size      | 高度                   | 圆角              | Token                   | 用途                                             |
| --------- | ---------------------- | ----------------- | ----------------------- | ------------------------------------------------ |
| `default` | 36px                   | `rounded-md` 8px  | `--ds-button-height-md` | 常规操作（默认）                                 |
| `sm`      | 32px                   | `rounded-md` 8px  | `--ds-button-height-sm` | 表格行内、密集工具栏                             |
| `lg`      | 40px                   | `rounded-md` 8px  | `--ds-button-height-lg` | 页面级主操作                                     |
| `icon`    | 36px                   | `rounded-lg` 10px | `--ds-button-height-md` | 图标按钮（默认）                                 |
| `icon-sm` | 32px                   | `rounded-lg` 10px | `--ds-button-height-sm` | 工具栏图标按钮                                   |
| `icon-xs` | 24px                   | `rounded-lg` 10px | 固定                    | 头像触发器等极紧凑位，**等于触控下限，不得再小** |
| `icon-lg` | 40px                   | `rounded-lg` 10px | `--ds-button-height-lg` | 强调型图标按钮                                   |
| `inline`  | 文本行盒（≈20px）      | `rounded-none`    | 无                      | 嵌在文字流里的链接式入口（「查看详情」「重试」） |
| `wrap`    | 内容高度，`min-h` 32px | `rounded-md` 8px  | `--ds-button-height-sm` | 标签会折行的按钮（长中文名、版本说明）           |

`icon-xs` 是唯一不受密度 Token 驱动的固定档：24px 已经是 WCAG 2.2 AA 的触控下限，
再跟随密度收缩就会破线。

### `inline`：链接式文字按钮

`variant='link'` + `size='inline'`。高度退回文本行盒、左右内边距归零。

为什么需要单独一档：`variant='link'` 无填充、无描边、无内边距，视觉上就是一段带色
的文字。给它套 32px 的盒子会在行内排版里制造 12px 空白，还会与相邻的 `<a>` 文字
对不齐 —— 高度在这里不是「按钮尺寸」，而是「文字行高」。

**只有 `variant='link'` 可以配这一档**：有填充或描边的按钮必须有高度。表格单元格里的
零内边距触发（`px-0 py-0` 的 ghost 按钮）也可以用，但要显式加 `min-h-8` 兜住点按面积。

### `wrap`：内容型按钮

标签会折成 2–3 行时用。高度随内容、允许折行，`min-h` 兜住点按地板。

`min-h` **只有三档**，按场景选，不要在调用点自造第四档：

| min-h              | 场景                              |
| ------------------ | --------------------------------- |
| 24px（`min-h-6`）  | 表格单元格 / 徽标密度里的行内触发 |
| 32px（默认）       | 工具栏、弹窗、卡片内的可折行按钮  |
| 44px（`min-h-11`） | 触屏列表里的整行按钮              |

卡片式选项按钮（金额档位、支付方式、分组选择）是**卡片**而不是按钮：它塞了三行信息
（名称、单价、折扣），高度随内容，用 `h-auto min-h-14 rounded-lg p-3` 的卡片结构，
不要硬套 `size` 档。

## 17. 导航选中态

> **👁 可视核查** → 核查页 [§24 导航选中态](#nav)
>
> 附实测对比度表：专用 Token 4.93:1（AA ✅）与误用 `text-primary` 4.44:1（❌）。
> 切换深色模式可核对深色下的 4.97:1。

**管理界面左侧面板的选中项，图标与文字用专用的 `text-sidebar-active-foreground`，
底色是 `bg-primary-subtle`。** 选中只靠「专用前景色 + 品牌浅底」两件事表达，
**不加粗、不加边框、不加左侧竖条**。

唯一实现点在 `components/ui/sidebar.tsx`，业务代码不要再各写一份：

| 场景                   | 组件                                  | 生效类                                                                     |
| ---------------------- | ------------------------------------- | -------------------------------------------------------------------------- |
| 一级行（含可折叠父项） | `SidebarMenuButton`                   | `data-active:bg-primary-subtle data-active:text-sidebar-active-foreground` |
| 子项行 / 会话预设      | `SidebarMenuSubButton`                | 同上 + `data-active:[&>svg]:text-sidebar-active-foreground`                |
| 折叠态浮层里的子项     | `nav-group.tsx` 的 `DropdownMenuItem` | `bg-primary-subtle text-sidebar-active-foreground`                         |

### 为什么不直接用 `text-primary`

品牌主色 `#5B5EE6` 落在选中浅底 `#F0F0FF` 上只有 **4.44:1**，差 0.06 未达 WCAG AA
普通文本 4.5:1 —— 导航文字是 14px/500，不属大文本豁免。

规范因此引入**专用 Token** `--sidebar-active-foreground`，只与 `primary-subtle`
浅底配对，**不修改全局品牌主色**。主按钮、链接、焦点环仍然是 `#5B5EE6`。

| 主题      | Token 值  | 配对底色  | 对比度 |
| --------- | --------- | --------- | ------ |
| 浅色      | `#5558D8` | `#F0F0FF` | 4.93:1 |
| 深色      | `#8B8DF5` | `#25264A` | 4.97:1 |
| 浅色侧栏 | `#5558D8` | `#F8FAFC` | 约 5.3:1 |
| 深色侧栏 | `#8B8DF5` | `#0F172A` | 6.14:1 |

Token 落在 `src/styles/theme.css`（浅/深两处）并映射成 Tailwind 语义色
`--color-sidebar-active-foreground`；预设主题在 `theme-presets.css` 里用
`color-mix(in oklab, var(--primary) 90%, #000)` 从各自品牌色推导。

### 三条硬规则

1. **图标不单独定色。** Lucide 图标是 `stroke="currentColor"`，行文字换成
   `text-sidebar-active-foreground` 后图标自动跟随。只有子项行需要盖掉子元素
   自带的颜色，才写 `data-active:[&>svg]:text-sidebar-active-foreground`。
   **禁止**写不带状态前缀的 `[&>svg]:text-sidebar-active-foreground` —— 那会让
   未选中行的图标也变色，与「只有选中项用强调色」直接冲突。
2. **不用 `text-primary`，也不用 `text-sidebar-accent-foreground`。** 前者对比度
   不达 AA；后者是近黑 `#0F172A`，选中行只剩一层浅底，和右侧内容区的强调色脱节。
3. **未选中行保持 `text-sidebar-foreground`，字重整列统一 500。** 选中只换颜色，
   不改字重；整列纹理才均匀。

守卫：`src/design-system/__tests__/sidebar-active-guard.test.ts`（7 个用例）断言
专用 Token 的生效类、禁止回退 `text-primary` / accent 前景色、Token 双主题存在，
以及「全局品牌主色未被改动」。

**其他仍使用 `bg-primary-subtle` 的组件（例如胶囊徽标）应单独检查**；若其中包含
普通文本，同样应满足适用的对比度目标，不能默认继承导航例外。为此另设
`--primary-subtle-foreground`（与导航同值 `#5558D8`）供徽标 / 胶囊 / 轻强调块使用。

## 18. 图标

> **👁 可视核查** → 核查页 [§22 图标五档](#icon)
>
> 五档图标按真实像素渲染，可确认 18px 默认档与 16px 紧凑档是否需要并存。

**统一 Lucide 线性图标**，**描边统一 2px**；尺寸按场景固定为
**16 / 18 / 24 / 32 / 48** 五档，**默认档 18px**；**颜色跟随父级文字色**。

> ⚠️ **18px 是当前默认档，侧边栏从 16px 提到 18px。** 这个值被改过四次，每次都是
> 整表重排而非局部修补：**20** → **16** → **20** → **18**（当前）。
> 改之前先 `stat` 规范文件 mtime —— 照着旧口径改代码会白改一轮。

### 三个数值怎么落地

| 规范值              | 实现                                                    | 说明                                                                        |
| ------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------- |
| 24px 画框           | `viewBox="0 0 24 24"`                                   | Lucide 内置，不改                                                           |
| 描边 2              | `strokeWidth={2}`                                       | 单位是**画框单位**；16px ≈ 1.33px、**18px = 1.5px**、24px = 2px、48px = 4px |
| 尺寸 16/18/24/32/48 | `size-4` / `size-4.5` / `size-6` / `size-8` / `size-12` | 渲染尺寸就是字形尺寸（`size-4.5` = 4.5 × 4px = 18px）                       |

描边 Token 三档取值相同，都是 2：

| Token                             | 值  | 用途                |
| --------------------------------- | --- | ------------------- |
| `--ds-icon-stroke-width-sm`       | `2` | 16px 的紧凑辅助图标 |
| `--ds-icon-stroke-width`          | `2` | 全站默认            |
| `--ds-icon-stroke-width-emphasis` | `2` | 32px 的强调型图标   |

保留三档是为了让「紧凑 / 默认 / 强调」的语义落点稳定 —— **不是**要造出三种粗细。

全站由 `IconProvider`（`src/context/icon-provider.tsx`）统一注入
`size={18} strokeWidth={2}`。**调用点不要写 `strokeWidth`**；写了也必须是 2。

### 尺寸档

| 场景                                                                                  | 尺寸     | 类名                  |
| ------------------------------------------------------------------------------------- | -------- | --------------------- |
| 按钮内前置后置 / 工具栏与卡片操作 / **侧边栏** / 主导航与 Tabs / 提示与状态（默认档） | **18px** | `size-4.5`            |
| 紧凑型辅助图标（仅密集信息，不作为主要操作图标）                                      | **16px** | `size-4`              |
| 强调型功能入口                                                                        | **24px** | `size-6`              |
| 空状态                                                                                | **32px** | `size-8`              |
| **整页级空状态**                                                                      | **48px** | `size-12`             |
| 容器放不下 16px 的位置（复选框、徽章、日期格、`icon-xs` 按钮）                        | 12 / 14  | `size-3` / `size-3.5` |

**尺寸必须落在 16 / 18 / 24 / 32 / 48 这五档上**（容器约束型 12 / 14 除外）。档位外
的值（20、22、28、36、40…）一律违规。

### 容器约束：12 / 14px 字形的唯一合法来源

尺寸表的最小档是 16px，但**容器放不下时以容器为准**。判据不是「想画小一点」，而是
「16px 会不会顶破容器」：16px 方框里塞 16px 字形，对勾会压到边框上；24px 徽章里塞
16px，上下各剩 4px，视觉上反而更挤。

| 容器                  | 字形    | 位置                                                     |
| --------------------- | ------- | -------------------------------------------------------- |
| 16px 复选框方框       | 12px    | `ui/checkbox.tsx`                                        |
| 24px 徽章             | 12px    | `ui/badge.tsx`                                           |
| 头像 24/32/40px 三档  | 12–16px | `ui/avatar.tsx`                                          |
| 20px 图标徽章         | 12px    | `ui/icon-badge.tsx` 的 `xs` / `stat` 小屏档              |
| 日历日期格            | 14px    | `ui/calendar.tsx` 的月份导航箭头                         |
| 12px 文字档的侧栏分组 | 14px    | `ui/sidebar.tsx`                                         |
| Badge 内的删除 `X`    | 12px    | `tag-input.tsx`                                          |
| 16px 提示行           | 12px    | `command-menu.tsx` 的装饰箭头                            |
| 密集代码视口工具栏    | 14px    | `json-code-editor.tsx`                                   |
| 24px 步进按钮         | 12px    | `features/channels/components/numeric-spinner-input.tsx` |
| 签到格                | 12px    | `features/profile/components/checkin-calendar-card.tsx`  |

三条硬约束：

1. 白名单**只按文件路径**生效，不做「小于 16px 一律放过」的模糊匹配；
2. 白名单里每一条都必须是「**图标元素自己写了小于 16px 的类名**」。靠祖先
   `[&>svg]:size-*` 约束的不算；
3. 容器放大到能容纳 16px 时，**同步删掉**对应白名单条目。

守卫：`spec-guards.test.ts` 的 `SMALL_GLYPH_ALLOW` 与审计脚本的 `SMALL_ALLOW`
同源，两边必须一起改。

### 三条硬规则

1. **不允许其他图标库。** `@hugeicons/*`、`@heroicons/*`、`react-icons/*` 一律迁到
   `lucide-react`。唯一例外是 `components/react-icon-by-name.tsx`（运营在后台配置的
   支付方式图标，名字运行时才确定）。
2. **尺寸与描边只能用规范值。** 12/14px 只允许出现在固定尺寸容器里；描边只有 2。
3. **颜色跟随父级文字色。** Lucide 内置 `stroke="currentColor"`，只要不写
   `text-blue-400` 这类调色板色就自动成立；状态色用语义 Token。

## 19. 图表排版

VChart 把文字画在 `<canvas>` 上，`fontSize` 必须是**数字**，既写不了 `text-xs` 也读
不到 CSS 变量。于是字号在 TS 侧**镜像**一份，唯一来源是
`design-system/tokens/chart-typography.ts`：

| 常量                         | 值   | 用途                   |
| ---------------------------- | ---- | ---------------------- |
| `CHART_FONT_SIZE`            | 12px | 轴标签、图例、数据标签 |
| `CHART_LABEL_FONT_SIZE`      | 12px | 柱顶数值、节点文字     |
| `CHART_AXIS_TITLE_FONT_SIZE` | 12px | 轴标题                 |

三条约束：

1. 图表只能 import 这三个常量，**不得在 option 里写字面量** —— 门禁 T4 拦
   `fontSize: N`；
2. 这里只允许出现阶梯内的档位（12/14/16/18/22/28/36）。要新档位先改
   `tokens/typography.css`，再同步到这里；
3. 图表的**颜色**同理：canvas 拿不到 `var(--primary)`，用
   `color-mix(in oklch, …)` + `useThemeColors` 在运行时解析，不要写死色值。

## 20. 原生 button / input 的边界

全站有 39 处原生 `<button>`（`components/` 与 `features/` 下，已排除
`components/ui/` 自身实现）与 21 处原生 `<input>`。它们**不是「还没迁移的欠债」**，
但也**不是想留就能留** —— 每处必须落进下面六类之一，落不进就必须换成 `Button` /
`Input`。

判据是**这个元素的语义**，不是它长得像不像按钮：

| 类别          | 判据                                                                                         | 现有落点（抽样）                                                                         |
| ------------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 整行 / 列表项 | 整块区域可点，内容是一组信息而不是一个标签；`aria-expanded` 之外的布局语义 `Button` 表达不了 | 表格内可点单元格、公告行、API Key 行、分组选项行、`multi-select` 的值胶囊                |
| 手风琴触发器  | 带 `aria-expanded`，点击展开一块内容                                                         | `codex-usage-dialog`、`channel-advanced-section`、`task-pricing-matrix`                  |
| 标签页 / 分段 | 带 `role='tab'` 或一组互斥选项，选中态由外部状态驱动                                         | `rankings-hero` 周期切换、图表类型切换、模型图 tab、首页终端 demo 的 tab                 |
| 复合控件根    | 自研输入原语的一部分：数字步进器、密码显隐、侧栏拖拽轨、日历格                               | `numeric-spinner-input`、`secret-input` / `secret-textarea` 的眼睛按钮、`sidebar` 拖拽轨 |
| 图标按钮      | 只有图标、`aria-label` 说明动作，尺寸 16–24px                                                | 图例提示、筛选项移除、重试链入口                                                         |
| 表单隐藏字段  | `type='hidden'` / 文件选择器 / 只读指示符                                                    | react-hook-form 隐藏字段、`<input type='file'>`、Markdown 任务列表 checkbox              |

约束：

1. **样式必须复用控件 Token**：高度走 `--ds-control-height-*` 或
   `--ds-button-height-*`，圆角走 `--radius-*`，颜色走语义色，过渡走 `ds-motion-*`
   （或裸 `transition-*`，默认值已被指到 `--ds-motion-fast`）。**不得自造一套高度与
   描边** —— 胶囊高度统一读 `--ds-chip-height`。
2. **触控目标不小于 24×24**。密集容器里视觉尺寸只能 16–20px 时，加
   `.ds-touch-target`。
3. **键盘焦点由基座兜底，不需要每处手写**。`foundations/accessibility.css` 对
   `:where(a, button, [role='button'], [tabindex]):focus-visible` 画 1px 环；组件层
   写的是 `focus-visible:ring-1 focus-visible:ring-ring`，两者几何必须一致。
4. 隐藏型（`hidden` / `sr-only` / `opacity-0` 覆盖层）不参与统计，也不受样式约束。

> 历史教训：这一节上一版写的是「只要它是用户会点、点了会触发操作的入口，就必须
> 用 `Button`」，而同一页上面列的 39 处里有 34 处正是「会点」的 —— 条款与现状
> 自相矛盾，等于没有条款。**能落进六类的是结构，落不进的是欠债。**

---

# 第五部分 · 响应式与可访问性

## 21. 断点与字号策略

沿用 Tailwind 默认断点，不自定义：

| 前缀   | 宽度     | 典型场景             |
| ------ | -------- | -------------------- |
| （无） | < 640px  | H5、手机浏览器       |
| `sm:`  | ≥ 640px  | 大屏手机横屏、小平板 |
| `md:`  | ≥ 768px  | 平板                 |
| `lg:`  | ≥ 1024px | 笔记本               |
| `xl:`  | ≥ 1280px | 桌面                 |

**桌面与移动共用同一套十档阶梯，不为移动端单独定义字号。** 只在两种情况下按断点
调整：

1. **营销页主视觉**：`text-3xl md:text-4xl`（28 → 36px），即 `display` 档在小屏降
   一档。阶梯最高只到 `text-4xl`（36px），不存在 `text-5xl`；
2. **指标数值**：`text-2xl md:text-3xl`（22 → 28px），小屏避免溢出。

不允许出现「移动端 14px、桌面 12px」这种反向调整 —— 小屏需要更大的字号，不是更小。

**指标数值的放大点是 `md`（768px）而不是 `sm`（640px）**：640–768 之间的窄平板
仍然是单列布局，28px 的数字会把卡片标题挤成两行；768 之后卡片才进入多列，有
横向空间容纳大号数字。

**输入控件与 iOS**：输入控件文字全平台统一 14px（`body-sm`），**不设 H5 16px
例外**。输入内容、占位符与标签字号一致，桌面与移动共用同一套阶梯。

> iOS Safari 在 `font-size < 16px` 的控件获得焦点时仍会自动放大页面。本项目已决定
> 接受该行为、优先保证全平台输入文字一致；如未来要规避，只能整体加大控件字号，
> 不得单独给移动端加 16px 覆盖。

**布局：**

- 侧边栏在 `lg` 以上常驻，以下收起为抽屉。
- 内容区最大宽度 1280px，超出居中。营销页（定价页的价格矩阵）按例外登记放宽到
  1800px，弹窗按需放宽但不超过 1280px。
- 卡片网格：`grid-cols-1 sm:grid-cols-2 xl:grid-cols-3`。
- 表格在窄屏允许横向滚动，不允许把列压到文字换行成三行。

## 22. 触控目标与焦点环

> **👁 可视核查** → 核查页 [§25 焦点环与触控目标](#focus)
>
> 左侧演示 1px 焦点环的实际观感，右侧对比「视觉 16px + 命中区 24px」与
> 「视觉 24px」两种做法。

### 触控目标

可点击元素最小 24×24px（WCAG 2.2 AA · 2.5.8）。密集容器（徽标内的移除、表格行内的
图标按钮）里视觉尺寸只能是 16–18px，此时加 `.ds-touch-target`：

```tsx
<button className='ds-touch-target flex size-4 items-center justify-center'>
  <X />
</button>
```

它**不改元素盒子**，而是用一个居中的 `::after` 把**命中区**扩到 24px —— 视觉不变、
布局不变，只有可点击范围变大。**不要**用 `min-w-6 min-h-6`：那会把行高撑起来、把
徽标顶开。

> ⚠️ 实现是 `position: relative` + `::after`，所以只能用在没有自己 `::after` 的
> 元素上（侧栏拖拽轨、进度环这类不要加）。

### 焦点环

**全站只有一种焦点指示器**：1px 环，贴着元素边框外沿（`outline-offset: 0`）。

| 项             | 规则                                                                                                                                  |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 焦点指示器     | 原生元素由基座的 `:focus-visible` 兜底，组件用 `focus-visible:ring-1 ring-ring`；两者几何必须一致，不得引入第二套颜色或 `outline-offset` |
| 焦点环 Token   | `--ds-focus-ring-width` / `--ds-focus-ring-color`（语义层，唯一来源）                                                             |
| 焦点环宽度     | 恒 1px。2026-10-29 由 2px 收窄 —— 两档并存会让同一次 Tab 里环「跳一下」                                                              |
| 禁用态         | 不得用 `outline: none` 无替代地移除焦点提示                                                                                         |

`ring-0` 仍允许（InputGroup 把环让给容器）。`2px` / `3px` / `4px` 在任何位置都违规。

## 23. 长文本阅读宽度

`body-long`（16/26）用于连续阅读内容时，容器宽度要收在可读区间，否则 16px 长文在
1280px 里一行 60+ 字，眼睛回行会错行：

| 内容                         | 最大宽度                                            |
| ---------------------------- | --------------------------------------------------- |
| 文章正文、服务协议、隐私政策 | `max-w-[72ch]`（约 720–760px）                      |
| 帮助中心列表 + 正文          | 正文列 `max-w-[72ch]`，侧栏固定 240px               |
| AI 对话气泡                  | `max-w-[84%]`（现有实现），单气泡内仍用 `body-long` |

---

# 第六部分 · 质量保障

## 24. 自动化约束

```bash
node scripts/check-design-tokens.mjs          # 报告模式
node scripts/check-design-tokens.mjs --strict # 有违规即退出码 1（CI）
bunx vitest run src/design-system/__tests__   # Token / 守卫测试
```

> **四级检查体系**（详见 [§1 四层强制执行模型](#1-四层强制执行模型)）：
> ① 静态检查（本节）→ ② 组件测试（92 项守卫）→ ③ 视觉回归（**待补**）→
> ④ CI 门禁（`ci.yml` + `release-gate.yml`，已阻断）。
>
> ⚠️ **静态检查只能确定"某个值是否来自批准的 Token"，不能确定"页面看起来对不对"。**
> 视觉差异不一定是缺陷，截图一致也不意味着交互与无障碍合格（见
> [§5.2](#52-自动化截图-设计正确)）。

### 静态扫描规则（T1–T15）

| 规则 | 拦截内容                                                                                                              |
| ---- | --------------------------------------------------------------------------------------------------------------------- |
| T1   | `--text-*` 出现在唯一来源之外（字号阶梯重复声明）                                                                     |
| T2   | 任意字号工具类 `text-[15px]`                                                                                          |
| T3   | 任意行高工具类 `leading-[26px]`                                                                                       |
| T4   | 内联字号 `style={{ fontSize: 13 }}`                                                                                   |
| T5   | CSS 硬编码 `font-size: 15px`                                                                                          |
| T6   | 非浮层投影 `shadow-sm` / `shadow-[…]`；引用不存在的 elevation 档位（弹窗与浮层走 `OVERLAY_ALLOWLIST`，`shadow-none` 不计违规） |
| T7   | 调色板直用 `bg-slate-100` 这类未走语义 Token 的类名                                                                   |
| T8   | 裸色值 `#hex` / `rgba()`（Token 定义处与 SVG 图形除外）                                                               |
| T9   | 行高覆盖 `leading-*`（行高由字号 Token 自带，`leading-[var(--…)]` 放行）                                                |
| T10  | 任意圆角 `rounded-[3px]`（`rounded-[inherit]` / `rounded-[var(--…)]` 放行）                                           |
| T11  | 未登记动效节奏 `duration-N` / `duration-[…]` / `ease-[cubic-bezier(…)]`（同行出现 `animate-in` / `animate-out` 时放行）     |
| T12  | 字距类 `tracking-*`（字距由字号 Token 自带，统一移除；`tracking-normal` 放行）                                   |
| T13  | 透明度冒充文字层级 `text-foreground/NN`（改用 `text-fg-secondary` / `text-fg-tertiary`，见 §11.3）                 |
| T14  | 透明度凑悬停 `hover:bg-{primary\|secondary\|destructive\|success}/NN`（改用 `*-hover` Token，见 §11.2）           |
| T15  | 透明度凑浅底 `bg-{success\|warning\|info}/NN`、`bg-{primary\|destructive}/NN`（改用 `*-soft` / `*-subtle`，见 §11.2）；**只管 ≤20%** |

> T13–T15 是 2026-10-29 补的拦截面。此前 §25 虽然把它们写进了禁止事项， `-soft` /
> `-subtle` Token 也早就有了，但**没有任何检查会拦** —— 于是全库攒了 92 处
> 无人发现的违规。这正是「文档写了 ≠ 规则被执行」的代价：
> 规范里每一行"禁止"，都得在 `check-design-tokens.mjs` 里有对应的强制点。
>
> T15 刻意**只拦 ≤20%**：`/70`、`/90` 那类高透明度是有意的半透明实心填充，
> 换成 `-soft` 会直接改变观感，那是另一种写法，不是欠债。

### 守卫测试

`src/design-system/__tests__/spec-guards.test.ts` 补齐硬规则的静态守卫：

| 守卫                     | 拦截内容                                                                                       |
| ------------------------ | ---------------------------------------------------------------------------------------------- |
| `body baseline`          | `<p>` / `Card` / `DialogContent` / `SheetContent` 上出现 `text-base`                             |
| `card summary value`     | 卡片 / 区块标题同行的汇总值（`总计`、`共 N 条`）不得用 12px                                      |
| `icon library`           | `@hugeicons/*`、`@heroicons/*`、`react-icons/*` 的 import                                        |
| `icon geometry`          | 图标尺寸档位 16/18/24/32/48、描边恒 2、默认档 18px、禁用数值 `size={N}`、图标颜色跟随父级文字色 |
| `brand color source`     | 组件里出现品牌色字面值（`#5B5EE6` 等 11 个档位）                                               |
| `markdown prose ladder`  | Markdown 标题须比界面低一到两档（h1=24 / h2=18 / h3=16 / h4=14）                                |
| `focus indicator`        | 焦点环恒 1px、满色、贴边（`ring` 满色、无 alpha、无 offset）                                    |

另有 `control-typography.test.ts`（控件与说明文字下限，见
[§12.8](#128-控件与说明文字的下限管理端)）与 `sidebar-active-guard.test.ts`
（导航选中态，见 [§17](#17-导航选中态)）。

### 门禁强度（2026-10-29）

`check-design-tokens`（T1–T15）经 `bun run lint:design:strict` 接入 `ci.yml` 与
`release-gate.yml` 的 frontend job，**有违规即阻断**；本地另有同源门禁，由
`web/scripts/setup-git-hooks.mjs`（`bun install` 的 prepare 自动执行）**追加**进
`.git/hooks/pre-commit`，只拦「暂存区含 `web/`」的提交。改字号 / 颜色 / 图标 /
圆角 / 投影后须复跑这两条，不要只靠人眼审计。

⚠️ 本地门禁**刻意不用** `core.hooksPath`：一旦设置，git 就只认那个目录，
`init.templateDir` 下发的身份守卫 `pre-push` 会被整体屏蔽（拆掉一层身份防护）。
且门禁片段必须插在身份守卫的 `case "$origin"` **之前** —— 该 case 的 `*)` 分支
带 `exit 0`，非公司仓库会在那里结束整个钩子，片段排在后面就是死代码。

例外必须写进对应脚本的 `ALLOWLIST` 并给出理由，同时登记到
[§26 例外登记](#26-例外登记)。

**门禁覆盖范围**：`check-design-tokens.mjs` 只扫 `web/src`。**docs-web 是独立的
Next.js + Tailwind 构建，不在扫描范围内**，它的口径写在
`docs-web/src/app/global.css` 的注释里（品牌色 `#5B5EE6`、r-lg 0.625rem、导航选中态
`#5558D8` / `#F0F0FF`、prose 阶梯 24/18/16/14、图标 16/18），改那边时只能靠这份
注释和实机核对，别指望门禁兜底。

### 视觉回归

> **状态：部分实现（2026-10-29）。** 已能对**核查页**做双视口截图基线比对，
> 代价是零（用本机 Chrome 无头模式，不引入 Playwright、不动 bun.lock）。
> **真实业务页面尚未覆盖** —— 原因见下。

```bash
bun run test:visual          # 对比基线：一致 → exit 0，有差异 → exit 1
bun run test:visual:update   # 重录基线
CHROME_PATH=/path/to/chrome bun run test:visual   # 显式指定浏览器
```

| 项             | 状态 / 说明                                                              |
| -------------- | ------------------------------------------------------------------------ |
| 目标清单       | 目前只有 `docs/design-system/showcase.html` —— 唯一不需要后端与登录态就能渲染全部 Token 的页面 |
| 视口           | 桌面 1440×900、手机 390×844，各取一张                                     |
| 基线存放       | `visual-regression/baseline.json`（哈希 + 体积，进版本库）；PNG 落在 `.visual-snapshots/`（gitignore） |
| 未接 CI        | 字体渲染与抗锯齿因机器而异，跨 OS 截图字节不可能一致，接进 CI 只会制造随机红灯 |
| 缺失浏览器     | 退出码 2 并打印 BLOCKED —— **这是"没跑"，交付报告里必须照实写，不能写成通过** |

⚠️ 基线可信度依赖同一台机器。**第一次验证这个脚本时，注入 `body{font-size:17px}`
并没有被检出** —— 因为核查页里每个元素都用 Tailwind 显式字号，body 字号对渲染毫无
影响。改成背景色才被正确捕获。教训：**验证"检测工具能检测"，要用真正会改变渲染的
改动**，否则会把没生效的工具当成已经生效。

关键页面需要在桌面（1440×900）与手机（390×844）两个视口各取一次基线：

- 登录 / 注册、Dashboard、模型列表与详情、API Key 管理、请求日志、充值与账单、
  用户设置、官网首页。

检查项：文字截断、换行、横向滚动、弹窗高度、输入框聚焦表现（iOS 聚焦自动放大
页面是已知取舍，不再作为回归失败项）。

### 基线机制（存量违规 vs 新增违规）

> **状态：已实现（2026-10-29）。** 快照文件 `web/design-tokens.baseline.json`
> 当前为 **0 条**（全量清理后无存量欠债）。

```bash
bun run lint:design:baseline            # 只对比基线里没有的条目，有新增即退出码 1
bun run lint:design:baseline:update     # 重写快照；**条数只允许下降**
```

快照的每个条目按「规则 ID + 文件 + 证据串」认定身份 —— **刻意不含行号**：无关
commit 挪动一行就会让整份基线作废，那是给未来制造噪音；行号仍写进快照，只为人工
定位用。

| 机制               | 落地方式                                                                    |
| ------------------ | --------------------------------------------------------------------------- |
| 违规清单快照       | `--write-baseline` 写入 `design-tokens.baseline.json`                        |
| 「基线只减不增」   | 快照条数变多时拒绝写入并退出码 2；确需扩容必须显式 `--force-baseline` 并写理由 |
| CI 比对            | `--baseline` 只对**新增**条目失败；严格 lint 仍是 `lint:design:strict`        |
| 例外仍走 ALLOWLIST | 真正的例外（不是欠债）不进基线，必须写理由并登记 §26                        |

原则：**新增违规必须为零；既有违规按基线逐步清理。** 这样既不阻断存量债务，
又不给新违规开门。

> ⚠️ **CI 目前跑的是 `--strict`（有违规即阻断），不是 `--baseline`。** 因为当前
> 基线是空的，两者今天完全等价；一旦有人把欠债写进基线，`--strict` 会继续拦全部
> 违规，而 `--baseline` 只拦新增。**是否把 CI 切到 `--baseline` 属于放宽门禁的决定，
> 需要项目负责人批准**，不得由 AI 自行切换。

## 25. 禁止事项总表

| 类别             | 禁止                                              | 替代                                        |
| ---------------- | ------------------------------------------------- | ------------------------------------------- |
| 字号             | `text-[15px]`、`text-[0.9em]`、`text-[1.75rem]`   | 换档位                                       |
| 字号下限         | 10–11px 用于常规 UI（关键提示/表单辅助最低 12px）  | caption 12px 起；14px 起承载任何数值         |
| 行高             | `leading-[26px]`、任何 `leading-*` 工具类         | 换档位 / `leading-[var(--ds-line-mono-dense)]` |
| 内联字号         | `style={{ fontSize: 13 }}`                       | 语义组件                                     |
| 字体族           | 在 `font-mono` 旁再写 `text-sm` / `text-xs`      | mono 三档                                    |
| 标题层级         | `Heading variant="card-title"` 叠 `font-mono text-mono` | `variant="mono-title"`                |
| 页面标题         | 自己写 `<h1 className="text-3xl font-bold">`      | `Heading`                                    |
| 正文 16px        | 拿 `text-base` 当正文                             | `body`（14px）或 `body-long`（16/26）        |
| 汇总值 12px      | 卡片标题旁的「总计 / 共 N 条」用 `text-xs`        | `body-sm`（14px）                            |
| 控件 12px        | 管理端控件 / `<p>` 上出现 `text-xs`               | 14px 起                                      |
| 标题 14px        | `text-sm font-semibold` 当卡片/区块/分组标题      | 28 / 22 / 18 / 15                           |
| 色值             | 组件里写死色值、`text-[#333]`                     | 语义 Token                                   |
| 透明度凑层级      | `text-foreground/60`、`hover:bg-primary/90`        | `text-fg-secondary` / `*-hover` Token        |
| 投影             | `shadow-sm` / `shadow-lg` / `shadow-[…]`          | `--ds-elevation-*`                           |
| 圆角             | `rounded-[3px]`（`rounded-[inherit]` 除外）       | `--radius-*` 七档                            |
| 动效             | `duration-300`、`ease-out`、`1.8s`                | `--ds-motion-*`                              |
| 图标库           | `@hugeicons/*`、`@heroicons/*`、`react-icons/*`    | `lucide-react`                               |
| 图标描边         | `strokeWidth` 非 2                                | 由 `IconProvider` 注入                       |
| 焦点环           | `outline: none` 无替代、`ring-2`                   | 1px 环                                       |
| 触控目标         | 小于 24×24 且无 `.ds-touch-target`                 | `.ds-touch-target`                            |
| 颜色语义         | 用 `chart-N` 表达成功/失败                        | `{status}` Token                             |
| 输入字号         | 移动端单独给 16px 覆盖                            | 全平台 14px                                  |
| 密度             | 密度档缩放 `--text-*`                              | 走 Simple Large-font 预设                    |

## 26. 例外登记

规范的价值取决于「例外是否被记录」。凡是无法接入 Token 的场景，都必须在这里
登记：理由、影响范围、退出条件。代码侧的对应登记在
`scripts/check-design-tokens.mjs` 的 `ALLOWLIST` —— **两处必须同步，只改一处说明
例外已经失控。**

### 判定原则：效果对齐 ≠ 逐类照抄（2026-10-30）

登记例外前，先回答这两个问题，顺序不能反：

| 问题                       | 答「是」意味着什么                                                             |
| -------------------------- | ------------------------------------------------------------------------------ |
| ① 这个**效果**能不能被 Token 表达？ | 能 → **不许登记例外**。把它定档成 Token / 条款，改代码去满足它（例：[§11.5](#115-首屏演示的效果锚定term--与品牌渐变)） |
| ② 表达不了，是规范缺条款还是真做不到？ | 缺条款 → **补条款**，不是补例外；真做不到 → 才轮到 `ALLOWLIST`                |

一句话：**「要和某某长得一样」永远不是登记例外的理由，「这个效果无法被 Token
表达」才是。** 前者是个目标，后者是个证明。把前者当理由，等于把规范的缺口固化成
永久豁免 —— 这正是 E25 / E26 / E27 曾经的样子。

### 现状：0 条例外（2026-10-30）

`ALLOWLIST` **为空**。原先的 E25 / E26 / E27 三条（首屏渐变 + hero 终端代码卡 +
CTA 渐变）已于 2026-10-30 全部注销 —— 它们的理由都是「须与上游 new-api 逐类一致，
无法用 Token 表达」，而这个理由不成立：要求只是**渲染效果与上游一致**，不是类名
照抄。把效果落成 `term-*` 语义组与 `ds-text-gradient-brand` 之后，效果一分未变，
三条豁免同时消失，门禁对这些文件恢复全规则覆盖。

另见 **D7**：登录 / 注册页**不**是字号例外界面，须遵循全局 14px 正文刻度。

门禁 `node scripts/check-design-tokens.mjs --strict` 的通过口径：

| 计数项                     | 含义                                                 | 是否违规 |
| -------------------------- | ---------------------------------------------------- | -------- |
| 违规（violations）         | 落在业务代码里、没有 Token 表达的写法                | **是**   |
| 浮层投影（约 21 处）       | 弹窗 / 抽屉 / 下拉 / 悬浮输入舱的投影，明确允许      | 否       |
| Token 定义处色值（约 176 处） | 调色板、品牌色、SVG 图形本身就该写色值            | 否       |
| 已登记例外                 | `ALLOWLIST` 里逐条写了理由的真例外                   | **0**    |

### 四类「看起来像例外、其实不是」

写新代码前先对照这四类，绝大多数「需要例外」的直觉都落在这里：

| 类别                | 例子                                                          | 为什么不算例外                              |
| ------------------- | ------------------------------------------------------------- | ------------------------------------------- |
| 规范条款            | 多行主标题 1.5 行高、Markdown prose 阶梯、营销动效 300/500ms  | 规范已给出取值，只是条款在别的章节里        |
| Token 的落点        | `tokens/*.css` 里的色值、`brand-colors.ts` 的商标色、SVG 图形 | 它们是**颜色的所有者**，本来就该写值        |
| 结构性 escape hatch | `rounded-[inherit]`、`leading-[var(--ds-line-mono-dense)]`    | 门禁直接识别为合法写法，不占 ALLOWLIST 条目 |
| 效果锚定的 Token      | `term-*` 语义组、`ds-text-gradient-brand`（[§11.5](#115-首屏演示的效果锚定term--与品牌渐变)） | 只对「效果」负责，效果达到就写 Token，不需要例外 |

### 已升格为规范条款（编号已注销）

以下编号**不再有效**。表中「现在在哪」指向该规则的正式条款，写代码时按那里执行。

| 编号  | 原例外                                       | 现在在哪                                                                 |
| ----- | -------------------------------------------- | ------------------------------------------------------------------------ |
| E2    | 密集等宽的行高用 22px                         | [§12.4](#124-mono-三档)「mono 密集行高」→ `--ds-line-mono-dense`          |
| E3    | 行内代码随正文                                | [§12.4](#124-mono-三档)「mono 三档」→ `text-mono` 14/20                     |
| E4    | 图表 canvas 字号写数字                        | [§19](#19-图表排版) → `tokens/chart-typography.ts`                        |
| E5    | 客服挂件内联字号                              | [§12.1](#121-十档字号表) → `var(--ds-text-*)` / `var(--ds-line-*)`          |
| E6    | 错误页 `text-[7rem]`                          | [§12.11](#1211-补充档不在十档内仅用于兼容) 阶梯最高档 `display` 36/700/40    |
| E7    | 多行主标题行高 1.5                            | [§12.12](#1212-多行主标题的行高) → `--ds-line-display-multiline`          |
| E8    | 移动端全屏菜单 16/24                          | [§12.13](#1213-移动端全屏菜单) → `text-base font-medium`                    |
| E9    | 拖拽演示 `shadow-lg`                          | [§13.6](#136-投影) → `--ds-elevation-raised`                                |
| E10   | hero 终端投影 + 状态点辉光                    | [§13.6](#136-投影) → `--ds-elevation-marketing` + `--ds-glow-online`        |
| E11   | 预设里的第二处字号阶梯                        | [§12.6](#126-无障碍大字档simple-large-font-预设) → `tokens/typography.css` 唯一来源 |
| E12   | 首页代码卡片 13px                             | [§12.4](#124-mono-三档) → `text-mono-code` 13/20                             |
| E13   | 多行按钮 / 卡片式选项按钮不受高度档约束       | [§16](#16-button-的九个尺寸档) → `wrap` 档 + `min-h` 三档                  |
| E14   | Markdown 标题自成一套                         | [§12.9](#129-内容排版markdown-prose) → 24/18/16/14/14/12                     |
| E15   | 链接式文字按钮用 `h-auto`                     | [§16](#16-button-的九个尺寸档) → `size='inline'`                          |
| E16   | 残留原生 `<button>` / `<input>`               | [§20](#20-原生-button-input-的边界)                                       |
| E17   | 营销页动效节奏 300–500ms                      | [§13.7](#137-动效) → `--ds-motion-marketing-*`                              |
| E18   | 非交互动效不受 100/200ms 约束                 | [§13.7](#137-动效) → `--ds-motion-enter` / `--ds-motion-loop-*` / `--ds-motion-data*` |
| E19   | 营销页内容区宽度 1800px                       | [§13.2](#132-内容宽度) → `--ds-content-max-wide` + `max-w-container-wide`   |
| E20   | 装饰性描边不是 1px                            | [§13.5](#135-描边) → 镂空环 / 图形描边两类，禁止小数值                      |
| E21   | 结构性圆角的任意值                            | [§13.4](#134-圆角) → 只剩 `rounded-[inherit]`，门禁直接放行                 |
| E22   | 账户安全 / 偏好设置行标题 16/600              | [§12.5](#125-页面层级四层不多不少) → 行标题恒 16/500，600 只给 `group-title` |
| E23   | 固定尺寸容器内的图标小于 16px                 | [§18](#18-图标)「容器约束」→ `SMALL_GLYPH_ALLOW` 白名单                   |
| E24   | 折扣/溢价角标实心填充，部分组合低于 AA       | 浅色折扣 5.02:1 ✅ / 浅色溢价 3.76:1、深色折扣 3.30:1 ❌                    |
| E25   | 首屏渐变标题的上游调色板直用色               | [§11.5](#115-首屏演示的效果锚定term--与品牌渐变) → `ds-text-gradient-brand` + `--ds-color-brand-gradient-{from,via,to}` |
| E26   | hero 终端代码卡多色配色 + 状态点辉光 + 终端弱层级 `text-foreground/NN` | [§11.5](#115-首屏演示的效果锚定term--与品牌渐变) → `term-*` 语法角色 / `term-dim-1…4` / `term-accent-*` / `--ds-glow-online` |
| E27   | CTA 副标题「your AI integration?」的上游渐变 | [§11.5](#115-首屏演示的效果锚定term--与品牌渐变) → 与 E25 同一个 `ds-text-gradient-brand` |

> 这一轮的关键转变：**上一版把 12 条「规范没覆盖到的空白」当成了例外**。它们其实
> 不是「代码没接 Token」，而是**规范本身缺条款** —— 把空白登记成例外，等于把规范的
> 缺口永久固化成豁免。这一轮把每一条都**定档成规范条款**（给出取值、判据、约束），
> 然后改代码去满足它。

### 新增例外的流程

1. **先过一遍上表的判定原则** —— 「要和上游/某某长得一样」不构成理由。
2. **确认没有现存 Token 能表达**，也不能新增 Token 表达。能新增就该新增，
   而不是登记例外。
3. 写清三件事：**理由**（为什么不能接入 Token）、**影响范围**（文件 / 组件）、
   **退出条件**（什么情况下可以取消这条例外）。
4. **两处同步**：本文件登记编号 + `scripts/check-design-tokens.mjs` 的 `ALLOWLIST`
   加条目并写明理由。
5. 跑 `node scripts/check-design-tokens.mjs --strict` 确认计数符合预期。

## 27. 想改某个值时

### 想加一档字号

1. 先确认现有十档真的覆盖不了（绝大多数情况是覆盖得了的）；
2. 在 `tokens/typography.css` 的 `@theme` 里加 `--text-*` 与 `--text-*--line-height`；
   （`--text-*` 是字号命名空间，文字颜色请用 `--fg-*`）
3. 在 `tokens/semantic.css` 里加对应的 `--ds-text-*` / `--ds-line-*`；
4. 在 `__tests__/tokens.test.ts` 的 `LADDER` 里登记期望值；
5. 更新本文件的表格。

只做第 2 步而不做 3–5 步，等于又开了一套平行标准。

### 想改一个既有值

| 目标                     | 改哪里                                     | 附带动作                                        |
| ------------------------ | ------------------------------------------ | ----------------------------------------------- |
| 全站正文字号 / 行高      | `tokens/typography.css` 的 `@theme`         | 更新本文件 §12 表格 + `tokens.test.ts` 的 LADDER |
| 品牌色                   | `styles/theme.css` 的 `--primary`          | 预设色阶自动派生；跑 `spec-guards`            |
| 控件 / 按钮高度         | `tokens/spacing.css` 的密度档              | 检查 `button.tsx` / `input.tsx` 是否引用 Token |
| 圆角                     | `styles/theme.css` 的 `--radius`           | 七档按比例跟随                                   |
| 投影档位                 | `tokens/elevation.css` + 门禁 `ELEVATION_TOKENS` | 更新 §13.6 表格                           |
| 动效时长 / 缓动         | `tokens/elevation.css`                     | 更新 §13.7 表格                                  |
| 文字色                   | `styles/theme.css` 的 `--fg-*`（`.dark` 也要给） | 更新 §11.3 表格                            |
| 首屏演示色               | `styles/theme.css` 的 `--term-*`（`.dark` 也要给） | 更新 §11.5 表格 + 重算对比度；确认是否仍等于上游渲染 |
| 首屏装饰层               | 颜色 `--ds-decor-glow-*`（不随主题）、透明度 `--ds-decor-mesh-opacity-*`（`.dark` 各一档）、形状 `foundations/decoration.css` | 更新 §11.5「背景装饰层」表格；形状改值须同步 utility 与核查页 |

### 判断标准

最重要的判断标准是：**以后如果你要把 UTER 全站常规正文行高从 20px 改成 21px，
或者调整所有按钮的默认高度，应该主要修改一处设计 Token 或组件规则，而不是逐个
修改几十个页面。**

这才是设计规范从「文档」变成「代码架构」的关键。

---

## 附：核查页的生成与维护

核查页 `showcase.html` 是**生成物**，不要手工编辑 —— 手工改的内容会在下次生成
时被覆盖，且会与真实 Token 脱节。

```bash
# 从 web/ 目录执行
node scripts/generate-design-showcase.mjs

# 输出
# ✅ 核查页已生成：docs/design-system/showcase.html
#    大小：135.4 KB
#    编译 Token：168 个候选类，产物 66.4 KB
```

### 它为什么可信

生成器不手写任何色值或字号。它做三件事：

1. 用 Tailwind v4 的 `compile()` API 编译 `src/styles/index.css` 的同一批
   `@import`（`theme.css` + `theme-presets.css` + `tokens/index.css` +
   `foundations/index.css`）；
2. 把编译产物（`:root` / `.dark` 下的全部变量 + 按需生成的工具类）**原样内联**
   进单文件 HTML；
3. 用真实的 Tailwind 类名（`text-3xl`、`bg-primary-subtle`、
   `h-(--ds-button-height-md)`、`shadow-(--ds-elevation-overlay)` …）书写样本。

因此核查页的每一个像素都来自生产代码的同一份 Token。**改了 Token 而没重新
生成，核查页就过期了** —— 所以改了 Token 之后，第一件事是重新生成它。

### 什么时候必须重新生成

| 改动 | 必须重新生成 | 原因 |
|---|---|---|
| `src/styles/theme.css` 的颜色 / 圆角 / 字体栈 | ✅ | 核查页的颜色全部来自这里 |
| `src/design-system/tokens/typography.css` | ✅ | 字号阶梯的唯一来源 |
| `src/design-system/tokens/semantic.css` | ✅ | `--ds-text-*` / `--ds-line-*` 语义层 |
| `src/design-system/tokens/spacing.css` | ✅ | 密度 Token 与控件高度 |
| `src/design-system/tokens/elevation.css` | ✅ | 投影与动效 |
| `src/design-system/tokens/colors.css` / `primitives.css` | ✅ | 语义别名与原始值 |
| `src/design-system/foundations/*.css` | ✅ | 焦点环、图标兜底 |
| 组件实现（`components/ui/*.tsx`） | ⚠️ 建议 | 核查页是静态重绘，组件结构变了要同步改生成器里的样本 |

### 核查流程（人）

1. 打开 `docs/design-system/showcase.html`；
2. 按 §12.1 → §12.4 → §12.5 逐个字号看，§11.1 → §11.4 逐个颜色看；
3. 顶部切「深色模式」复查一遍明暗两套；
4. 顶部切「密度 sm / xl」，确认字号没变、只有留白在变；
5. 有异议 → 改 Token 源码 → 重新生成 → 重看。

### 核查流程（AI）

AI 改设计相关代码前，**必须先读核查页对应的分区**（把 `showcase.html` 读进上下文
或按锚点定位），确认要用的档位与组件的真实形态，再写代码。禁止凭记忆推断字号、
颜色或高度 —— 记忆里的值大概率是旧版。

改完 Token 后，按项目仓库纪律执行闭环：
**改动 → 回归 → `./rebuild-all.sh` → 提交**。

### 相关脚本

| 脚本 | 作用 |
|---|---|
| `web/scripts/generate-design-showcase.mjs` | 生成核查页 |
| `web/scripts/check-design-tokens.mjs` | T1–T11 静态门禁 |
| `web/scripts/add-showcase-anchors.mjs` | 往本文件插入「可视核查」提示块（幂等） |
