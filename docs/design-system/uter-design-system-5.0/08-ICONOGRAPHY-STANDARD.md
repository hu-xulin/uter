# 08 · 图标规范（Iconography Standard）

> UTER Design System 5.0 · 分册 S08。本规范定义「用哪套图标、尺寸/颜色/描边怎么取、图文怎么排、品牌与第三方图标怎么登记、无障碍标签怎么给」。**核心口径：同一功能不得混用不同风格，业务图标一律 Lucide 线性图标**。**5.0 为当前唯一正式体系，3.0 保留为历史**。除标明已核实的真源代码位置外，未宣称任何测试通过或平台验收。

| 字段 | 值 |
|---|---|
| 文档 ID | `UDS5-S08` |
| 版本 | `5.0.0` |
| 状态 | `ACTIVE` |
| 上级规范 | `UDS5-S01`（UTER Design System 5.0 总纲） |
| 生效日期 | `2026-11-14` |
| 适用范围 | `web/` 全部 TSX 组件、导航配置、状态组件、Auth/营销/后台/H5 分支；图标守卫覆盖 `web/src` 全量导入扫描 |
| 验证状态 | `NOT_VERIFIED` |

---

## 1. 总则

| 编号 | 原则 | 说明 |
|---|---|---|
| I-1 | 单一线性风格 | 业务功能图标统一 Lucide 线性图标（24px 画框、描边 2），禁止混用填充/双色/手绘风格。 |
| I-2 | 同功能同风格 | 同一功能（如「删除」「设置」）在全站必须用同一图标、同一风格、同一语义；禁止一处 Lucide、一处第三方图标。 |
| I-3 | 尺寸封闭 | 尺寸只用 5 档（§4），用 `size-*` 类表达，禁止任意值与 lucide `size={N}` 数值属性。 |
| I-4 | 颜色跟随 | 图标色跟随父级文字色（`currentColor`），不写死颜色；状态色走语义 Token。 |
| I-5 | 语义可达 | 图标按钮必须有可访问名称；纯装饰图标必须 `aria-hidden`。 |
| I-6 | **上游对齐·唯一值** | 3.0 §2.2 图标契约与 12 个守卫测试属 `UDS5-S01` §4.2 `G2` 唯一规范值（clerk.com 未提供通用图标规范），5.0 继承，不另立第二套值 |
| I-7 | 例外可枚举 | 第三方品牌图标、运行时动态图标只能走登记的例外文件，不得散落。 |

---

## 2. 图标库（真实依赖）

以 `web/package.json` 为准（BASELINE-AUDIT §2 表格核实）：

| 依赖 | 版本 | 角色 | 5.0 处置 |
|---|---|---|---|
| `lucide-react` | `^1.23.0`（`package.json:78`） | **业务功能图标唯一正式来源** | 采用；守卫强制 |
| `react-icons` | `^5.7.0`（`package.json:88`） | 历史/第三方图标集 | 保留依赖，但**禁止在一般组件中从 `react-icons/*` 导入**（守卫拦截）；仅登记例外文件可用 |
| `@lobehub/icons` | `^5.10.1`（`package.json:60`） | 第三方 AI 模型 / 服务商品牌标识 | 保留依赖，用于「第三方品牌图标」登记场景（§9） |

### 2.1 过时描述澄清（必须标注）

| 项 | 事实 |
|---|---|
| 过时来源 | `web/AGENTS.md:20` 提及 **Hugeicons**。 |
| 核实结论 | BASELINE-AUDIT §2 表格：`web/package.json` 中**无 `@hugeicons/*` 依赖**，该描述属过时。 |
| 5.0 规定 | 规范文本不得据 `web/AGENTS.md` 宣称使用 Hugeicons；图标只按 `package.json` 的 3 个真实依赖登记。 |
| 守卫 | `spec-guards.test.ts:214` 的正则同时禁止 `from '@hugeicons/…'`、`from '@heroicons/…'`、`from 'react-icons/…'`，与"业务只 Lucide"口径一致。 |

---

## 3. 图标只允许 Lucide（守卫登记）

守卫文件 `web/src/design-system/__tests__/spec-guards.test.ts`，是 `web/src/design-system/__tests__/` 下 12 个守卫测试之一：

| 项 | 内容 |
|---|---|
| 契约条目 | §2.2「图标只允许 Lucide」（`spec-guards.test.ts:34`、`:201`）——混用两套图标库会让同一界面出现两种描边语言。 |
| 用例名 | `it('imports icons from lucide-react only', …)`（`:212`）。 |
| 拦截正则 | `/from\s+['"](@hugeicons\/[^'"]+\|@heroicons\/[^'"]+\|react-icons\/[^'"]+)['"]/ `（`:214`）：禁止从 Hugeicons / Heroicons / react-icons 导入图标。 |
| 失败提示 | 指向"规范 §2.2：图标一律 Lucide 线性图标（24px 画框、默认 18px、描边 2），其他图标库请迁移到 `lucide-react`"（`:221`）。 |
| 登记例外 | `components/react-icon-by-name.tsx`（`ReactIconByName`）——运营在后台「支付方式」配置的图标名**运行时才确定，无法预先枚举**（`:205-207`）。该文件从守卫的导入扫描中豁免。 |
| 判定方式 | 解析 `lucide-react` 导入名单 → 定位 JSX 元素 → 读 `className`，**不按组件名后缀猜**（Lucide 组件名无 `Icon` 后缀，`:240-241`、`:313-320`）。 |

> 说明：守卫是**测试文件**而非门禁脚本；对应自动化执行见 §`自动化验证`。

---

## 4. 尺寸（5 档封闭集合）

真源为 `spec-guards.test.ts:454` 登记的「尺寸只有 16 / 18 / 24 / 32 / 48 五档」：

| 档 | 尺寸 | 典型场景（spec-guards 注释） |
|---:|---:|---|
| 1 | 16px | 紧凑型辅助图标（密集信息里的辅助图标） |
| 2 | 18px | 按钮内、工具栏、侧边栏、主导航与 Tabs、提示与状态（**默认档**） |
| 3 | 24px | 强调型入口 |
| 4 | 32px | 空状态图标 |
| 5 | 48px | 整页级空状态图标 |

### 4.1 尺寸硬性规定

| 项 | 规定 | 依据 |
|---|---|---|
| 不在表内的尺寸 | 20 / 22 / 28 / 36 / 40 均**不在档位表** | `spec-guards.test.ts:454` |
| 最小档 | 16px 是图标最小档 | `spec-guards.test.ts:430` |
| 12 / 14px 例外 | 只允许出现在「容器物理上放不下 16px」的固定尺寸容器（`SMALL_GLYPH_ALLOW`） | `spec-guards.test.ts:380,385-387` |
| 已登记小图标容器 | `components/ui/badge.tsx`（24px 徽章内图标）、`components/ui/icon-badge.tsx`（徽章五档随容器缩放） | `spec-guards.test.ts:385-387` |
| 侧边栏 | 18px（`size-4.5`），不得升到 `size-5`（20px 不在表里）也不得退回 `size-4` | `spec-guards.test.ts:544-552` |
| 写法 | 尺寸必须用 `className='size-*'` 表达，**禁止 lucide 的 `size={16}` 数值属性** | `spec-guards.test.ts:465-484` |
| 禁止数值属性理由 | 父级 Button 的 `[&_svg:not([class*='size-'])]:size-*` 兜底会覆盖 HTML 属性，导致「声明 16px 实际渲染 18px」，错漏能跑到线上截图 | `spec-guards.test.ts:468-471` |

---

## 5. 颜色（跟随父级文字色）

| 项 | 规定 | 依据 |
|---|---|---|
| 默认色 | 跟随父级文字色——Lucide 内置 `stroke="currentColor"`，只要不写死颜色即可 | `spec-guards.test.ts:237` |
| 状态色 | 成功 / 警告 / 错误 / 信息 / 在线 等状态色走语义 Token（`UDS5-S03`），不写裸 `#hex` / `rgba()`（T8） | §8 状态图标 |
| 禁用态 | 禁用态靠语义色与对比度表达，不得用透明度凑层级（T13） | S13 |
| 品牌色 | 唯一规范主色 `#6c47ff`（`UDS5-S01` §4.2 `G1`，上游 clerk.com `colorPrimary`）只用于品牌资产，不用于普通功能图标 | 上游基线 |
| 禁止 | 禁止给同一图标在不同页面写不同固定色；禁止用填充色块包裹线性图标制造"双风格" | I-1 / I-2 |

---

## 6. 描边（恒 2，不存在三档粗细）

| 项 | 规定 | 依据 |
|---|---|---|
| 画框 | 24px 画框 | `spec-guards.test.ts:34` |
| 描边宽度 | **恒为 2**（`strokeWidth` 单位为画框单位，由 `IconProvider` 注入 2） | `spec-guards.test.ts:236` |
| 三档 Token | 三个 `--icon-stroke-width*` Token 值**全是 2px**——"不再按尺寸分三档粗细" | `spec-guards.test.ts:558-559` |
| 禁止 | 按尺寸切换 1.5 / 2 / 2.5 描边；自定义第四档描边；在同一组件混用两种描边 | I-1 |
| 状态区分 | 状态靠语义色 / 图标形状区分，不靠描边粗细 | §8 |

---

## 7. 对齐与图文间距

| 项 | 规定 |
|---|---|
| 垂直对齐 | 图标与文字垂直居中（与文本行高对齐），不得靠 `margin-top: 1px` 一类魔法值微调。 |
| 基线 | 行内图标与文字共用同一行盒；`inline-flex items-center` 对齐，禁止用绝对定位硬贴。 |
| 图文间距 | 走 4px 间距阶梯（`UDS5-S05` / T17：`gap-*`），禁止 `gap-[…]` 任意值。 |
| 按钮内图标 | 前置 / 后置图标 = 18px（默认档），与 label 的间距走阶梯，不随 size 逐档改图标尺寸（`spec-guards.test.ts:502`） |
| 提示与状态 | 提示与状态图标 = 18px（`spec-guards.test.ts:512`） |
| 密集信息 | 16px 辅助图标与文字间距取阶梯下限，但不得把图标压到 12/14px（除非登记容器） |
| 方向 | RTL / i18n 7 locale 下镜像语义图标（如前进/后退）需随方向翻转，功能语义不变 |

---

## 8. 功能图标 / 状态图标 / 品牌图标

| 类别 | 定义 | 规定 |
|---|---|---|
| 功能图标 | 表达操作与导航（新增、删除、设置、搜索、返回、侧栏、Tabs） | 一律 Lucide；同功能全站同图标；默认 18px；见 `system-settings.config.ts:20-29` 从 `lucide-react` 导入 `Box/Route/CreditCard/Layout/Settings/Shield/ShieldAlert/Wrench` 的实例 |
| 状态图标 | 表达结果（成功 / 警告 / 错误 / 信息 / 在线 / 加载） | 形状 + 语义色区分；在线辉光用 `--ds-glow-online`（S07）但不得用 glow 代替品牌色；状态不得仅靠颜色（S13 需文字或图标辅助） |
| 品牌图标 | Uter 自有品牌资产（logo / 系统名 / 首屏） | 落在 `web/src/components/layout/components/system-brand.tsx`、`header-logo.tsx`；品牌基线（靛紫 + Inter + Noto Sans SC）不得替换 |
| 装饰图标 | 纯装饰、不承载信息 | 必须 `aria-hidden="true"`，不进入无障碍树 |

---

## 9. 第三方品牌图标（登记例外）

| 场景 | 图标来源 | 处置 |
|---|---|---|
| AI 模型 / 服务商 / 渠道品牌标识 | `@lobehub/icons ^5.10.1` | 仅用于「第三方品牌标识」场景，作为品牌徽标而非功能图标；不得与 Lucide 功能图标混排表达同一操作 |
| 支付方式图标（运行时动态名） | `react-icons`（经 `components/react-icon-by-name.tsx` 的 `ReactIconByName`） | **唯一登记的运行时例外**：图标名由后台配置、运行时才确定，无法枚举（守卫 `:205-207`）；一般组件禁止 `react-icons/*` 导入 |
| OAuth / 登录渠道 | 按第三方品牌规范 | 只参考视觉，不引入 Clerk SDK / 不替换 Uter 自建认证（Clerk 参考分析 2.17） |
| 禁止 | 把第三方品牌图标当作通用功能图标；同一功能在 A 页用 Lucide、B 页用 `@lobehub/icons` | I-2 |

> 说明：`@lobehub/icons` 与 `react-icons` 的具体渲染落点未在本轮逐文件枚举，故不虚构组件路径；仅登记"依赖存在 + 允许场景 + 例外文件"三层事实，精确清单为 `NOT_VERIFIED`（§13）。

---

## 10. 无障碍标签

| 项 | 规定 | 依据 |
|---|---|---|
| 图标按钮 | 必须具有可访问名称（`aria-label` / 视觉隐藏文本） | 3.0 §15.4「图标按钮必须具有可访问名称」 |
| 纯装饰图标 | `aria-hidden="true"`，且不得抢焦点 | 语义 HTML / S13 |
| 状态图标 | 状态不得仅靠颜色，须有文字或图标辅助（S13） | 3.0 §15.4 |
| 焦点 | 焦点态见 S13；图标不得导致命中区 < 24px（视觉 16/18px 时须补命中区） | S13 |
| 对比度 | 非文本图形对象 ≥ 3:1（WCAG 2.2 AA 1.4.11） | S13 / 3.0 §15.2 |
| Tooltip | 不得成为唯一信息来源（3.0 §15.4） | S17 |

---

## 11. 禁止事项汇总

1. 禁止同一功能混用不同图标库或不同风格（线性 vs 填充）。
2. 禁止 `from 'react-icons/…'` / `@hugeicons/…` / `@heroicons/…` 在一般组件中导入图标。
3. 禁止尺寸用 `size={N}` 数值属性或 20/22/28/36/40 非登记档。
4. 禁止按尺寸分描边粗细（描边恒 2）。
5. 禁止写死图标颜色（应 `currentColor` + 语义 Token）。
6. 禁止 `gap-[…]` 任意图文间距或 1px 魔法对齐。
7. 禁止图标按钮缺可访问名称、装饰图标进入无障碍树。
8. 禁止引入新图标依赖（升级边界：BASELINE-AUDIT §13 第 3 条）。

---

## 12. 差异与例外登记

| 编号 | 内容 | 状态 |
|---|---|---|
| S08-D1 | `web/AGENTS.md:20` Hugeicons 描述过时，package.json 无该依赖 | 已核实（BASELINE-AUDIT §2） |
| S08-D2 | `react-icon-by-name.tsx` 为运行时动态图标的登记例外 | 已核实（守卫豁免） |
| S08-D3 | `@lobehub/icons` / `react-icons` 逐文件渲染落点未枚举 | `NOT_VERIFIED` |
| S08-D4 | 三档 `--icon-stroke-width*` 全为 2px（历史"按尺寸分三档"口径已废） | 已核实（`spec-guards.test.ts:558-559`） |
| S08-D5 | 业务域蓝图《Iconography and Motion Standard》§2 图标尺寸 **7 档**（12 / 14 / 16 / 18 / 20 / 24 / 32px）↔ 仓库守卫硬锁 **5 档**（16 / 18 / 24 / 32 / 48） | 已登记（**保留仓库真值**：守卫为可执行门禁；蓝图多出的 12 / 14 / 20 档与缺失的 48 档均**不采纳**） |
| S08-D6 | 蓝图 §3「默认 1.75–2px 视觉线宽」↔ 仓库**恒 2px**（三个 `--icon-stroke-width*` 全为 2） | 已登记（**保留仓库真值**；1.75px 不采纳） |
| S08-D7 | 蓝图 §2「图标与文字间距通常 6–8px」——仓库走 4px 阶梯（`gap-1.5` / `gap-2`），**数值一致**，但未设单一出口 | 已登记（对齐，无冲突） |
| S08-D8 | 蓝图 §4「纯图标按钮可操作区域至少 32px」↔ 仓库 `ui/button.tsx` 的 `icon-xs` 为 **24px** | 已登记（与 `UDS5-S14` `S14-D5` 同源；仓库以 `.ds-touch-target` 伪元素扩展命中区，见 S17 §5.2 / S13 §3.10） |
| S08-D9 | 蓝图 §1「禁止用 emoji 替代关键功能图标」；仓库图标库为 Lucide + 少量登记例外（`@lobehub/icons` / `react-icons` / 动态图标），**emoji 是否被用作关键功能图标未全量核查** | `NOT_VERIFIED` |

---

## 与其他规范的关系

| 规范 | 关系 | 边界 |
|---|---|---|
| `UDS5-S01`（总纲） | 上级 | 5.0 效力、五层架构 |
| `UDS5-S03`（Color） | 依赖 | 状态色 / 语义色 / 品牌色来源 |
| `UDS5-S05`（Spacing） | 依赖 | 图文间距走 4px 阶梯（T17） |
| `UDS5-S06`（Radius） | 关联 | 圆形图标按钮 / 图标徽章形态 |
| `UDS5-S07`（Elevation） | 关联 | 在线状态辉光 `--ds-glow-online` 定义于 S07 |
| `UDS5-S10`（Theme） | 约束 | 品牌图标深浅同值例外；主题切换不改图标语义 |
| `UDS5-S11`（Layout） | 落地 | `system-settings.config.ts` 侧栏导航图标 |
| `UDS5-S13`（Accessibility） | 约束 | 可访问名称、非文本对比度 3:1、命中区 ≥24px |
| `UDS5-S14`（Component） | 落地 | Button / Badge / IconButton 内图标尺寸与状态 |
| 3.0 §2.2 / §19.5 | 历史溯源 | 3.0 保留为历史，仅用于真源定位 |

---

## 代码实施位置

| 路径 | 职责 |
|---|---|
| `web/package.json:60,78,88` | `lucide-react` / `react-icons` / `@lobehub/icons` 真实依赖声明 |
| `web/AGENTS.md:20` | Hugeicons 过时描述（须按本文 §2.1 澄清） |
| `web/src/design-system/__tests__/spec-guards.test.ts:34,201-241,313-320,380-559` | 「图标只允许 Lucide」守卫、尺寸/描边/颜色/写法几何校验 |
| `web/src/components/react-icon-by-name.tsx` | 运行时动态支付方式图标（登记例外） |
| `web/src/components/ui/badge.tsx` / `icon-badge.tsx` | 12/14px 小图标登记容器 |
| `web/src/components/layout/config/system-settings.config.ts:20-29` | 从 `lucide-react` 导入导航图标的实例 |
| `web/src/components/layout/components/system-brand.tsx` / `header-logo.tsx` | Uter 自有品牌资产 |
| `web/src/design-system/tokens/semantic.css` | 状态语义色 / `--ds-glow-online` 相关基准 |
| `web/scripts/check-design-tokens.mjs` | T1–T17（T8 裸色值、T17 任意间距） |

---

## 自动化验证

| 脚本 / npm 脚本 | 关联 | 说明 |
|---|---|---|
| `check-design-tokens.mjs` | T8 / T17 | 拦截图标裸色值与任意 `gap-[…]` 间距；T1–T17 统一扫描 |
| `lint:design:strict` | 门禁 | CI 唯一阻断模式 |
| `verify:contrast`（`verify-contrast.mjs`） | 对比度 | 非文本图形对象 3:1 校验（S13 引用） |
| `test:axe`（`axe-audit.mjs`） | 无障碍 | 图标按钮可访问名称 / `aria-hidden` 校验 |
| `visual-regression.mjs` / `test:visual` | 视觉 | 图标尺寸/对齐变更需复核 22 页 × 2 视口基线 |
| `spec-guards.test.ts` | 守卫测试 | `web/src/design-system/__tests__/` 12 个守卫之一，强制 `lucide-react` 单一来源与几何契约 |

> 说明：`spec-guards.test.ts` 为守卫测试文件；门禁脚本以上表所列 `.mjs` 与 npm 脚本为限。

---

## 验证状态

| 项 | 状态 | 依据 / 备注 |
|---|---|---|
| 全站图标单一来源（Lucide） | `NOT_VERIFIED` | 守卫用例存在，但本轮**未执行** `spec-guards.test.ts` |
| 尺寸 5 档 / 描边恒 2 / `size-*` 写法 | `NOT_VERIFIED` | 守卫用例存在，未在本轮运行 |
| 同功能图标一致性 | `NOT_VERIFIED` | 未在 65 个 `ui/` 组件与 30 个 feature 上逐项核对 |
| `@lobehub/icons` / `react-icons` 落点清单 | `NOT_VERIFIED` | 未逐文件枚举，不虚构路径 |
| 图标可访问名称 / `aria-hidden` | `NOT_VERIFIED` | `test:axe`（刻意不接 CI，BASELINE-AUDIT §7）本轮未执行 |
| `verify:contrast` 31 条 | `NOT_VERIFIED` | 审计记录曾 31 PASS / 0 FAIL，本轮未执行，不继承为通过 |
| 视觉回归双轨 / 全量构建 | `NOT_EXECUTED` | BASELINE-AUDIT §14 明确未执行 |
| 平台验收（Android / iOS / HarmonyOS） | `NOT_VERIFIED` | 见 `UDS5-S12` 与 BASELINE-AUDIT §8 |

**结论**：本分册为规范声明，所有验证项均为 `NOT_VERIFIED` / `NOT_EXECUTED`，**未勾选任何测试通过或平台验收**。
