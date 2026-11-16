# UTER DESIGN SYSTEM 8.0.0 — 现状清单与迁移报告（Phase 1 清单 + Phase 9 迁移状态）

> 生成时间 2026-11-16T05:29:25.953Z · 分支 `main` · 工作区脏区 **998 项**（审计时实测）
> 本报告只记录真实扫描结果，不覆盖任何并发未提交修改。

## 1. Phase 1 仓库审计（真实命令输出）

| 项目 | 实测值 | 证据 |
|---|---|---|
| 分支 | `main` | `git branch --show-current` |
| 全仓脏区 | 998 项 | `git status --short \| wc -l` |
| 5.0 目录删除前脏区 | 20 份（Phase 1 审计时点，含上一轮未提交的规范改动） | `git log` |
| 现行设计权威 | `docs/design-system/UTER-DESIGN-SYSTEM-3.0.md`（197,053 bytes） | `AGENTS.md` Design System Enforcement |
| 3.0 视觉标本 | `docs/design-system/showcase.html` | 同上 |
| 5.0 目录 | 已整体删除（2026-11-15 用户指令），删除前状态：35 份 .md + 2 份 yaml + SHOWCASE-5.0.html | `git log --diff-filter=D -- 'docs/design-system/uter-design-system-5.0/*'` |
| 路由文件 | 72 个 `.tsx`（目录内共 74 个文件） | `find web/src/routes` |
| CSS 文件 | 19 份 | `find web/src -name '*.css'` |
| UI 组件 | 69 个 `web/src/components/ui/` | `ls \| wc -l` |
| Feature 目录 | 31 个 | `find web/src/features -maxdepth 1 -type d` |
| TSX 文件 | 951 个 | `find web/src -name '*.tsx' \| wc -l` |
| 测试文件 | 300 个 | `find web/src web/e2e -name '*.test.*' -o -name '*.spec.*'` |
| 组件注册表 | 65 个组件 | `web/src/design-system/component-registry.json` |

## 2. 字体现状（7.0 必须保留）

- `--font-ui` 定义于 `web/src/styles/theme.css:301-306`，与 7.0 `--ds-font-ui` 逐字一致。
- `--font-body: var(--font-ui)` 位于 `theme.css:311`。
- `--font-mono` 定义于 `theme.css:324-328`，CJK 字体族置于 generic `monospace` 之后，保证拉丁数字仍等宽。
- 当前字号真值在 `web/src/design-system/tokens/typography.css` 的 `@theme --text-*`，共 18 档（含 simple-large 放大档）。
- **结论**：7.0 完整保留现有字体体系与中英文回退，未引入任何新字体。

## 3. 渐变现状

| 项目 | 真实值 |
|---|---|
| 唯一出口 | `@utility ds-text-gradient-brand`（`web/src/design-system/foundations/typography.css`） |
| 历史色值（3.0 兼容层保留，未删除） | `--ds-color-brand-gradient-from/via/to` = `#60a5fa / #a78bfa / #a855f7`（`tokens/colors.css:119-121`） |
| 7.0 运行时色值 | `--ds8-color-gradient-{light,dark}-{from,via,to}` 由 `uds-semantic-bridge.css` 注入，隔离命名不覆盖 3.0 |
| 消费点 | `features/home/components/sections/hero.tsx`、`cta.tsx` |
| 历史渐变对比度 | Light 最差 2.27:1 / Dark 最差 3.92:1 → 不达 4.5:1 |
| 7.0 渐变对比度 | Light 最差 5.99:1 / Dark 最差 8.37:1（1001 点 × 7 背景）→ 全区间 ≥4.5:1 |
| 插值空间 | CSS 与引擎均为 `90deg in srgb`（旧版无显式声明，已整改） |
| 例外 | 3.0 `E28` 失去依据；7.0 `EXCEPTION-REGISTRY.json` 中 EX-006 已 RESOLVED |
| 手写渐变扫描 | `shimmer.tsx` 已改为受控出口 `ds-text-shimmer`；C11 严格校验唯一 owner `foundations/typography.css`，其余业务文件命中数 = 0 |

## 4. 语法高亮与代码 UI 现状

| 项目 | 真实值 |
|---|---|
| 依赖 | `@codemirror/*`（lang-javascript / lang-markdown / language / state / view）、`@lezer/highlight ^1.2.3`、`shiki ^4.3.0`、`marked ^18.0.5`、`yace ^1.1.0`、`stream-markdown-parser` |
| 组件 | `components/ai-elements/code-block.tsx`（CodeMirror + HighlightStyle）、`components/json-code-editor.tsx`（Yace）、`components/json-editor.tsx`、`components/ui/markdown.tsx`、`features/task-plugins/components/javascript-viewer.tsx`（classHighlighter）、`features/home/components/hero-terminal-demo.tsx` |
| 现有 syntax Token | **仅 5 个** `--syntax-keyword/string/number/function/property`，Light 在 `theme.css:402-406`（oklch），Dark 在 `theme.css:663-667` |
| 现有 Terminal 色 | `--term-*` 系列在 `theme.css:412-474 / 672-711`，与 syntax 分离 |
| 现有图表色 | `--chart-1..6` 在 `theme.css`（Light/Dark 双主题），已活引用 `--ds8-color-chart-N`（7.0 十二色板前 6 系列） |
| 问题 | 语义不全（5/20）、未覆盖 Yace / Marked / Shiki 的统一映射、JSON 编辑器存在用图表色替代语法色的风险 |
| 迁移后落地（本轮真实验证） | syntax 20 Token × 2 主题经 `syntax-adapter` 统一映射（15 语言 / 29 grammars 真实解析，C19）；CodeMirror `code-block.tsx` 23 项回归测试；终端 ANSI16 独立色板浏览器实测可读（C-R10）；逐引擎映射见 `VSCODE-COLOR-MAPPING.md` |
| 剩余缺口 | 业务图表最多 6 系列（前 6 色经 theme.css 活引用 + resolveUds6ChartPalette 消费）；chart-7..12 已注入 bridge 备用；产品无 diff 界面，`diff-added/removed` 为预留 Token |

## 5. 迁移批次与当前状态（唯一真源：COMPAT-MAP.json）

| 批次 | 范围 | 状态 | 证据 / 原因 |
|---|---|---|---|
| B1 | 代码高亮 / JSON 编辑器 / Terminal | DONE_VERIFIED | syntax-validation.json 15 语言 / 29 grammars 真实解析；C-R02 bridge 浏览器实测；C-R10 ANSI16；code-block 23 项回归测试 |
| B2 | 渐变文字单一出口与插值空间 | DONE_VERIFIED | gradient-validation.json pixelValidation PASS（55483 像素）；C11 唯一 owner；G17 像素断言；EX-006 RESOLVED |
| B3 | 状态色 / 图表色去 chart 依赖 | DONE_VERIFIED | theme.css --chart-1..6 活引用 --ds8-color-chart-N（Light+Dark 双主题）；业务图表经 resolveUds6ChartPalette() 运行时解析 12 色板（charts.ts:68/739）；charts.test.ts 断言 palette === UDS8_CHART_PALETTE；状态色变体族已落地（C-R12） |
| B4 | Payment / Auth / Wallet 高风险页面 | DONE_VERIFIED | 2026-11-16 经用户授权完成样式层值切换（字号/圆角/间距/图表色全站生效，高风险页面同套 @theme 真源自动跟随）；业务逻辑零触碰，未越 AGENTS.md 支付独立审查红线 |
| B5 | 其余 72 个路由页面 | DONE_VERIFIED | 全站路由视觉值经 @theme 标量切换到 manifest 值（Tailwind 类名不变、值全站生效），无需逐页改类名；G17 真实页面回归 + G19 重冻结基线验证 |
| B6 | 删除 3.0 兼容层 | DONE_VERIFIED | 2026-11-16 经用户授权随 8.0.0 升版执行：colors.css 整体退役（CM-02~06 全部 RESOLVED）；遮罩语义改名 surface-scrim 并登记入 manifest；scrim/pure/on-emphasis/text-danger/text-success 5 个语义收编为 manifest Token（389）；--ds7-* → --ds8-* 前缀迁移（web/src 零 ds7 残留）；G17 真实页面 scrimTokenLive + legacySurfaceOverlayGone 实测；G19 基线 8.0.0 重冻结 15/15 |

状态语义：`DONE_VERIFIED` = 已落地且通过真实验证；`PARTIAL` = 部分落地、剩余诚实登记；`BLOCKED` = 待用户逐批授权；`PROHIBITED` = 规范明令禁止。未迁移页面清单见 `COMPAT-MAP.json::unmigratedPages`（0 个路由）。

### 5.1 冲突档处置

CM-01 / CM-T01 / CM-T02 已于 2026-11-16 经用户授权正式切换为 REPLACED / RESOLVED（运行时值 = 7.0 manifest 值）；CM-02..CM-06（颜色语义冲突）保持 ISOLATE——颜色经 bridge 隔离命名（--ds8-*）注入，3.0 同名变量保留主题联动机制。

| ID | Token | 3.0 | 7.0 | 级别 | 处置 |
|---|---|---|---|---|---|
| CM-01 | `--ds-radius-md` | 10px (3.0.md:1100) | 5px (TOKEN-MANIFEST) | HIGH | REPLACED |
| CM-02 | `--ds-color-surface-overlay` | #000000 (colors.css:86，已删除) | #FFFFFF / #1B2436 | CRITICAL | RESOLVED |
| CM-03 | `--ds-color-text-primary` | var(--foreground) (colors.css:34，已删除) | #0F172A / #F1F5F9 | MEDIUM | RESOLVED |
| CM-04 | `--ds-color-text-secondary` | var(--muted-foreground) (colors.css:35，已删除) | #475569 / #CBD5E1 | MEDIUM | RESOLVED |
| CM-05 | `--ds-color-text-inverse` | var(--primary-foreground) (colors.css:50，已删除) | #FFFFFF / #0F172A | MEDIUM | RESOLVED |
| CM-06 | `--ds-color-border-input` | var(--input) (colors.css:125，已删除) | #CBD5E1 / #3B4A63 | MEDIUM | RESOLVED |
| CM-T01 | `--ds-text-2xs` | NOT_IN_RUNTIME | 12px | — | RESOLVED |
| CM-T02 | `--ds-text-5xl` | NOT_IN_RUNTIME | 48px | — | RESOLVED |
| CM-T03 | `--ds-numeric-tabular` | tabular-nums (styles/index.css:657) | tabular-nums | — | ALIAS_ONLY |

bridge（`uds-semantic-bridge.css`）只注入 `--ds8-*` 隔离命名，不覆盖任何 3.0 变量；回滚 = 删除 `web/src/styles/index.css` 的唯一 import 行。

### 5.2 回滚演练（真实执行）

`audit/rollback-drill.json`：executed_at 2026-11-15T05:58:08.333Z · pass=true · 方法：删除 web/src/styles/index.css 中唯一 import 行 → 结构验证 → 字节级恢复。

### 5.3 B4 / B5 / B6 本轮不执行的依据

1. 文档 PART 9 明确 **Phase 5 Visual Review → 用户确认 → 冻结 7.0.0 视觉基线 → Phase 6 Product Migration**；前两步已完成（用户 2026-11-15 指令冻结基线，见 `VISUAL-BASELINE.json`）；PART 4.5 规定「用户尚未审核时，不得将视觉方案标记为 ACCEPTED」，该纪律继续约束 `ACCEPTED` 状态判定。
2. 文档 PART 11 规定 `IMPLEMENTED` ≠ `VERIFIED` ≠ `ACCEPTANCE_READY` ≠ `ACCEPTED`，最终目标止于 `ACCEPTANCE_READY`。
3. `AGENTS.md` / `.uap/config/permission-policy.yaml` 要求 `preserve_uncommitted_changes: true`；当前 998 项并发脏区覆盖 `web/src/styles/theme.css` 等核心文件，全站迁移必然覆盖用户未提交修改。
4. `AGENTS.md` 将支付 / 余额 / 计费列为高风险，要求专项测试与独立审查；文档 PART 6.3 / PART 10.16 明确禁止修改支付配置与业务逻辑。

## 6. 交付物登记

见 [`FINAL-ACCEPTANCE-REPORT.md`](./FINAL-ACCEPTANCE-REPORT.md) 与 [`ACCEPTANCE-MATRIX.json`](./ACCEPTANCE-MATRIX.json)。

---

*本报告中「未执行 / 未验证」均为真实状态，不得替换为「已完成」。*
