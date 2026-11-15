# UTER DESIGN SYSTEM 6.0 — 现状清单与迁移报告（Phase 1 / Phase 6 清单）

> 生成时间 2026-11-15T06:39:50.693Z · 分支 `main` · 工作区脏区 **998 项**（审计时实测）
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
| CSS 文件 | 20 份 | `find web/src -name '*.css'` |
| UI 组件 | 69 个 `web/src/components/ui/` | `ls \| wc -l` |
| Feature 目录 | 31 个 | `find web/src/features -maxdepth 1 -type d` |
| TSX 文件 | 951 个 | `find web/src -name '*.tsx' \| wc -l` |
| 测试文件 | 300 个 | `find web/src web/e2e -name '*.test.*' -o -name '*.spec.*'` |
| 组件注册表 | 65 个组件 | `web/src/design-system/component-registry.json` |

## 2. 字体现状（6.0 必须保留）

- `--font-ui` 定义于 `web/src/styles/theme.css:301-306`，与 6.0 `--ds-font-ui` 逐字一致。
- `--font-body: var(--font-ui)` 位于 `theme.css:311`。
- `--font-mono` 定义于 `theme.css:324-328`，CJK 字体族置于 generic `monospace` 之后，保证拉丁数字仍等宽。
- 当前字号真值在 `web/src/design-system/tokens/typography.css` 的 `@theme --text-*`，共 18 档（含 simple-large 放大档）。
- **结论**：6.0 完整保留现有字体体系与中英文回退，未引入任何新字体。

## 3. 渐变现状

| 项目 | 真实值 |
|---|---|
| 唯一出口 | `@utility ds-text-gradient-brand`（`web/src/design-system/foundations/typography.css`） |
| 历史色值（3.0 兼容层保留，未删除） | `--ds-color-brand-gradient-from/via/to` = `#60a5fa / #a78bfa / #a855f7`（`tokens/colors.css:119-121`） |
| 6.0 运行时色值 | `--ds6-color-gradient-{light,dark}-{from,via,to}` 由 `uds-semantic-bridge.css` 注入，隔离命名不覆盖 3.0 |
| 消费点 | `features/home/components/sections/hero.tsx`、`cta.tsx` |
| 历史渐变对比度 | Light 最差 2.27:1 / Dark 最差 3.92:1 → 不达 4.5:1 |
| 6.0 渐变对比度 | Light 最差 5.99:1 / Dark 最差 8.37:1（1001 点 × 7 背景）→ 全区间 ≥4.5:1 |
| 插值空间 | CSS 与引擎均为 `90deg in srgb`（旧版无显式声明，已整改） |
| 例外 | 3.0 `E28` 失去依据；6.0 `EXCEPTION-REGISTRY.json` 中 EX-006 已 RESOLVED |
| 手写渐变扫描 | `shimmer.tsx` 已改为受控出口 `ds-text-shimmer`；C11 严格校验唯一 owner `foundations/typography.css`，其余业务文件命中数 = 0 |

## 4. 语法高亮与代码 UI 现状

| 项目 | 真实值 |
|---|---|
| 依赖 | `@codemirror/*`（lang-javascript / lang-markdown / language / state / view）、`@lezer/highlight ^1.2.3`、`shiki ^4.3.0`、`marked ^18.0.5`、`yace ^1.1.0`、`stream-markdown-parser` |
| 组件 | `components/ai-elements/code-block.tsx`（CodeMirror + HighlightStyle）、`components/json-code-editor.tsx`（Yace）、`components/json-editor.tsx`、`components/ui/markdown.tsx`、`features/task-plugins/components/javascript-viewer.tsx`（classHighlighter）、`features/home/components/hero-terminal-demo.tsx` |
| 现有 syntax Token | **仅 5 个** `--syntax-keyword/string/number/function/property`，Light 在 `theme.css:402-406`（oklch），Dark 在 `theme.css:663-667` |
| 现有 Terminal 色 | `--term-*` 系列在 `theme.css:412-474 / 672-711`，与 syntax 分离 |
| 现有图表色 | `--chart-1..5` 在 `theme.css:389-393 / 645-649`（oklch） |
| 问题 | 语义不全（5/20）、未覆盖 Yace / Marked / Shiki 的统一映射、JSON 编辑器存在用图表色替代语法色的风险 |

## 5. 迁移清单（Phase 6，本轮 **未执行**）

| 批次 | 范围 | 风险 | 前置条件 |
|---|---|---|---|
| B1 | 6.0 Token 产物生成（已完成，位于 `docs/design-system/uter-design-system-6.0/runtime/`，与 TOKEN-MANIFEST.json 一致；**未接入 `web/src` 现行运行时**） | 低 | — |
| B2 | 渐变唯一出口换值 + 注销 E28 | 中 | 视觉基线已冻结（2026-11-15） |
| B3 | syntax 20 Token 接入 5 个引擎 Adapter | 中 | 视觉基线已冻结（2026-11-15）+ 逐引擎真实渲染验证 |
| B4 | 72 个路由 / 951 个 TSX 的 Token 与组件迁移 | 高 | 并发 WIP 收敛（视觉基线已冻结） |
| B5 | 支付 / 账单 / 认证页面视觉迁移 | **极高** | 业务专项测试 + 独立审查（不得由执行代理代做） |
| B6 | 旧 Token / 重复实现清理 | 高 | DEPENDENCY-GRAPH 零引用证明 |

### 5.1 本轮不执行 Phase 6 的依据

1. 文档 PART 9 明确 **Phase 5 Visual Review → 用户确认 → 冻结 6.0.0 视觉基线 → Phase 6 Product Migration**；前两步已完成（用户 2026-11-15 指令冻结基线，见 `VISUAL-BASELINE.json`）；PART 4.5 规定「用户尚未审核时，不得将视觉方案标记为 ACCEPTED」，该纪律继续约束 `ACCEPTED` 状态判定。
2. 文档 PART 11 规定 `IMPLEMENTED` ≠ `VERIFIED` ≠ `ACCEPTANCE_READY` ≠ `ACCEPTED`，最终目标止于 `ACCEPTANCE_READY`。
3. `AGENTS.md` / `.uap/config/permission-policy.yaml` 要求 `preserve_uncommitted_changes: true`；当前 998 项并发脏区覆盖 `web/src/styles/theme.css` 等核心文件，全站迁移必然覆盖用户未提交修改。
4. `AGENTS.md` 将支付 / 余额 / 计费列为高风险，要求专项测试与独立审查；文档 PART 6.3 / PART 10.16 明确禁止修改支付配置与业务逻辑。

## 6. 交付物登记

见 [`FINAL-ACCEPTANCE-REPORT.md`](./FINAL-ACCEPTANCE-REPORT.md) 与 [`ACCEPTANCE-MATRIX.json`](./ACCEPTANCE-MATRIX.json)。

---

*本报告中「未执行 / 未验证」均为真实状态，不得替换为「已完成」。*
