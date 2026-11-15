# ACCESSIBILITY-AUDIT — 无障碍与字体体系审计

> UTER DESIGN SYSTEM 6.0 · 全面审计整改（P0）· Phase 1 重新审计产出
> 本报告由 `registry/generate-audit.mjs` 从磁盘实时扫描生成，不以任何历史报告结论为依据。

| 元数据 | 值 |
|---|---|
| 生成时间 | 2026-11-15T05:35:55.927Z |
| Git SHA | 012c08eaf6127261f4ba434bf277489261ef6dd5 |
| 分支 | main |
| 工作区脏区条目 | 671（并发 UAP 会话产物，本任务未覆盖、未混入） |
| Node | v22.22.2 |
| 生成命令 | node docs/design-system/uter-design-system-6.0/registry/generate-audit.mjs |
| 审计范围 | web/src 全量 · web/scripts/verify-contrast.mjs · web/e2e/visual · 6.0 runtime/foundations.css |

本报告回答：WCAG 2.2 AA 12 类逐项是否验证、forced-colors 是否支持、字体体系是否被擅自改动。

## 1. 实时扫描

| 关键词 | 文件数 | 命中数 |
|---|---|---|
| `forced-colors` | 0 | 0 |
| `prefers-reduced-motion` | 14 | 24 |
| `focus-visible` | 46 | 189 |
| `aria-` | 385 | 1480 |
| `role=` | 110 | 169 |

## 2. `verify-contrast.mjs` 逐项覆盖

| 检查类别 | 是否有逐项对比度检查 |
|---|---|
| 普通文字 | 部分（17 个品牌/链接/选中态对） |
| 大文本 | 部分（17 个品牌/链接/选中态对） |
| 按钮文字 | 部分（17 个品牌/链接/选中态对） |
| 输入框文字 | 无 |
| Placeholder | 无 |
| Disabled | 无 |
| Border | 无 |
| Focus Indicator | 无 |
| 图表 | 无 |
| 代码高亮 | 无 |
| 渐变文字 | 有（但按装饰性豁免口径放行，非达标型） |
| 状态提示 | 无 |

## 3. 字体体系真实值（不得更换）

```css
--font-ui: Inter Variable, Inter, Source Han Sans SC, Source Han Sans CN,
          思源黑体, Noto Sans SC Variable, Noto Sans SC, Noto Sans CJK SC,
          PingFang SC, Hiragino Sans GB, Microsoft YaHei, system-ui, ... sans-serif;
--font-body: var(--font-ui);
--font-mono: ui-monospace, SFMono-Regular, SF Mono, Menlo, Monaco, Consolas,
             Liberation Mono, Courier New, monospace, Source Han Sans SC, ...;

来源：web/src/styles/theme.css:301-306, 311, 324-328
等宽数字：styles/index.css:657 + 87 文件 177 处 tabular-nums
```

## 4. 问题明细

#### UDS6-F-01

| 字段 | 内容 |
|---|---|
| 唯一问题 ID | UDS6-F-01 |
| 严重级别 | P1 |
| 所属域 | FONT — 字体体系 |
| 文件路径 | web/src/styles/theme.css |
| 行号 / 位置 | 301-306, 311, 324-328 |
| 当前实际状态 | 真实字体栈为 Inter Variable / Source Han Sans / 思源黑体 / Noto Sans / PingFang 等；--font-mono 以 ui-monospace…monospace 开头，CJK 置于 generic monospace 之后。 |
| 违反的规范 | §五「保留 Uter 当前字体体系，不得擅自更换」——现状合规，需固化为守卫。 |
| 对产品的影响 | 无产品影响；但缺少回归保护。 |
| 整改方案 | 把三段字体栈逐字写入 manifest 并在检查器做精确比对（已有 C12，扩展到 --font-body 与 CJK 回退顺序）。 |
| 对应自动化测试 | check-uds6-remediation.mjs::C-F01 |
| 验收证据 | ACCESSIBILITY-AUDIT.md 字体节 |
| 整改状态 | RESOLVED |
| 实际证据 | C-F01 PASS · C12 守卫 |

#### UDS6-F-02

| 字段 | 内容 |
|---|---|
| 唯一问题 ID | UDS6-F-02 |
| 严重级别 | P1 |
| 所属域 | FONT — 字体体系 |
| 文件路径 | registry/tokens.mjs:202-211；web/src/design-system/tokens/typography.css:69-135 |
| 行号 / 位置 | 6.0 定义 --ds-text-2xs=12 与 5xl=48；运行时 18 档无 2xs、最大 5xl=36，且 :134-135 明示 48/60px 不纳入系统。 |
| 当前实际状态 | §五「不得擅自改变字号 / 字重 / 行高」/ §14 规范与实现一致。 |
| 违反的规范 | 若接入 6.0 字号会引入 48px 档，违反现行 3.0 刻度。 |
| 对产品的影响 | 6.0 字号刻度与运行时 @theme 逐项对齐，删除 48px 档；差异登记到迁移报告。 |
| 整改方案 | check-uds6-remediation.mjs::C-F02 断言两处刻度集合一致 |
| 对应自动化测试 | token-validation.json 的 typography 段 |
| 验收证据 |  |
| 整改状态 | RESOLVED |
| 实际证据 | C-F02 PASS · C12 逐字比对 theme.css:301-328 的字体定义 |

#### UDS6-F-03

| 字段 | 内容 |
|---|---|
| 唯一问题 ID | UDS6-F-03 |
| 严重级别 | P2 |
| 所属域 | FONT — 字体体系 |
| 文件路径 | web/src/styles/index.css:657；87 文件 177 处 tabular-nums |
| 行号 / 位置 | 运行时靠 CSS + Tailwind 类实现等宽数字；6.0 另引入 --ds-numeric-tabular 与 .ds-tabular-nums，两套机制未对齐。 |
| 当前实际状态 | §五「金额和 Token 显示」/ §4.7 唯一来源。 |
| 违反的规范 | 无直接故障，但存在两套声明。 |
| 对产品的影响 | 6.0 的 numeric Token 改为引用运行时已存在的 tabular-nums 机制，不新增第二套。 |
| 整改方案 | check-uds6-remediation.mjs::C-F03 |
| 对应自动化测试 | TOKEN-CONSUMPTION-AUDIT.md |
| 验收证据 |  |
| 整改状态 | RESOLVED |
| 实际证据 | C-F03 PASS · 审计生成器实时扫盘产出消耗清单 |

#### UDS6-A-01

| 字段 | 内容 |
|---|---|
| 唯一问题 ID | UDS6-A-01 |
| 严重级别 | P0 |
| 所属域 | A11Y — 无障碍与对比度 |
| 文件路径 | web/src（全库） |
| 行号 / 位置 | forced-colors 0 文件 / 0 命中 |
| 当前实际状态 | web/src 中没有任何 @media (forced-colors: active) 规则。 |
| 违反的规范 | §八「强制颜色模式」/ WCAG 2.2 AA。 |
| 对产品的影响 | Windows 高对比度模式下渐变文字、语法色、状态色可能全部失效。 |
| 整改方案 | 在 6.0 runtime foundations 与 bridge CSS 增加 forced-colors 回退（color: CanvasText / background: Canvas / 边框 Highlight），Showcase 用 Playwright forced-colors 模拟验证。 |
| 对应自动化测试 | check-uds6-remediation.mjs::C-A01 + Playwright emulateMedia({forcedColors}) |
| 验收证据 | accessibility-validation.json |
| 整改状态 | PARTIAL |
| 实际证据 | C-A01 PARTIAL · bridge CSS 有 forced-colors 回退规则；Playwright forcedColors 场景未执行（如实 NOT_EXECUTED） |

#### UDS6-A-02

| 字段 | 内容 |
|---|---|
| 唯一问题 ID | UDS6-A-02 |
| 严重级别 | P0 |
| 所属域 | A11Y — 无障碍与对比度 |
| 文件路径 | web/scripts/verify-contrast.mjs |
| 行号 / 位置 | 92-214 |
| 当前实际状态 | 17 个对比度对全部是品牌/链接/选中态；placeholder / disabled / border / 图表 / 代码高亮 / 状态提示 / 焦点指示逐项检查均为 0 命中。 |
| 违反的规范 | §八「至少检查 12 类」/「每个失败项必须定位到实际 Token 或组件」。 |
| 对产品的影响 | 大量界面元素的对比度从未被验证。 |
| 整改方案 | 新建 a11y-contrast-matrix.mjs 对 12 类 × Light/Dark 逐项计算，输出 accessibility-validation.json，失败项定位到 Token 名。 |
| 对应自动化测试 | check-uds6-remediation.mjs::C-A02 断言 12 类齐全且无 <4.5 项（disabled 单独标注但不放宽其他项） |
| 验收证据 | ACCESSIBILITY-AUDIT.md + accessibility-validation.json |
| 整改状态 | RESOLVED |
| 实际证据 | C-A02 PASS · 真实计算 56 行文字 / 语法对比度 + 品牌实底三态 |

#### UDS6-A-03

| 字段 | 内容 |
|---|---|
| 唯一问题 ID | UDS6-A-03 |
| 严重级别 | P1 |
| 所属域 | A11Y — 无障碍与对比度 |
| 文件路径 | web/src |
| 行号 / 位置 | prefers-reduced-motion 14 文件 / 24 命中；focus-visible 46 文件 / 189 命中；aria- 385 文件 |
| 当前实际状态 | 减少动态效果与焦点可见性有基础覆盖，但无 axe 全站扫描证据（仅 6.0 Showcase 单页跑过 axe）。 |
| 违反的规范 | §八「键盘导航 / Focus 可见性 / 减少动态效果」。 |
| 对产品的影响 | Showcase 通过不代表产品页面通过。 |
| 整改方案 | 对可访问的产品页跑 axe + 真实 Tab 键焦点链，结果如实标注覆盖页面数与 SKIPPED 原因。 |
| 对应自动化测试 | check-uds6-remediation.mjs::C-A03 |
| 验收证据 | accessibility-validation.json 的 axe 段 |
| 整改状态 | RESOLVED |
| 实际证据 | C-A03 PASS · axe 4 场景 / 0 violations / keyboardFocus {"checked":12,"allVisible":true} |

#### UDS6-A-04

| 字段 | 内容 |
|---|---|
| 唯一问题 ID | UDS6-A-04 |
| 严重级别 | P1 |
| 所属域 | A11Y — 无障碍与对比度 |
| 文件路径 | web/src/styles/index.css:81-99；theme.css:389-394 |
| 行号 / 位置 | 语法色与图表色存在交叉引用，且图表只靠颜色区分系列（无线型/点型强制约束）。 |
| 当前实际状态 | §八「不依赖颜色传递信息 / 色觉障碍可识别性」/ §4.5。 |
| 违反的规范 | 色觉障碍用户无法区分图表系列与 JSON 语法类别。 |
| 对产品的影响 | 12 色图表提供线型/点型/图例三通道；CVD 模拟验证；syntax 与 chart 值集合强制不相交。 |
| 整改方案 | check-uds6-remediation.mjs::C-A04 |
| 对应自动化测试 | chart-validation.json |
| 验收证据 |  |
| 整改状态 | OPEN |
| 实际证据 | C-A04 FAIL · 真实 CIEDE2000：Light 常视觉最小 8.81，Dark 7.64；CVD 模拟最小 Light 0.93 / Dark 0.27。仅靠颜色不可区分，必须以非颜色通道补偿。 |

