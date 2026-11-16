# PHASE-0-BASELINE-REPORT — UTER DESIGN SYSTEM 8.0.0 升级基线

> 任务级别 P0 / RELEASE-BLOCKING。本报告为升级前真实状态快照，所有数据来自实际命令输出，禁止后续凭记忆改写。

## 1. Git 基线（2026-11-16 实测）

| 项 | 值 |
|---|---|
| 分支 | `main`（唯一工作分支，不建分支不建 PR） |
| HEAD SHA | `93a58c41eab00d24066171f9de42cd3acb02d428` |
| HEAD 前二提交 | `7eeae4bf6` 运行时标量正式切换到 7.0 值并重冻结基线 7.0.1；`26904e902` chore(uap) |
| 工作区脏区 | **347 项，全部位于 `.uap/**`**（并发 UAP 会话 WIP） |
| 升级操作面 | `web/src`、`docs/design-system`、`registry`、`web/scripts` **全部干净** |
| 处置纪律 | `.uap/**` 347 项 WIP 严格排除、不覆盖、不清理、不进本升级暂存区 |

## 2. 7.0 / 7.0.1 现有权威体系清单（实际文件）

- **规范文档**：`docs/design-system/` 顶层 `00-35-*.md` 共 36 册 + 专项 2 册（`CODE-SYNTAX-HIGHLIGHTING-STANDARD.md`、`GRADIENT-TYPOGRAPHY-STANDARD.md`）。
- **注册表**：`TOKEN-MANIFEST.json`（**version 7.0.0，384 tokens**，single_source_of_truth）、`TOKEN-REGISTRY.json`、`COMPONENT-REGISTRY.json`、`PAGE-REGISTRY.json`、`COMPAT-MAP.json`、`ACCEPTANCE-MATRIX.json`、`DEPENDENCY-GRAPH.json`、`EXCEPTION-REGISTRY.json`、`DEPRECATED-REGISTRY.json`、`VISUAL-BASELINE.json`。
- **生成链**：`docs/design-system/registry/` 22 个脚本（`tokens.mjs` / `build.mjs` / `finalize.mjs` / `contrast-engine.mjs` / `check-visual-baseline.mjs` / `freeze-baseline.mjs` / `check-uds7-remediation.mjs` 等）。
- **Showcase**：`SHOWCASE-7.0.html`。
- **迁移报告**：`UDS-7.0-MIGRATION-REPORT.md`。

## 3. 运行时架构基线（COMPAT-MAP.json 实测）

| 项 | 值 |
|---|---|
| policy | `COLOR_ISOLATE_SCALAR_REPLACED` |
| 颜色注入 | bridge `uds-semantic-bridge.css` 注入 **251 个 `--ds7-*`**；`web/src` 中 **12 文件 / 1100 处** `ds7-` 引用 |
| 标量 | 字号/行高/圆角/间距已于 2026-11-16 经用户授权在 `web/src` 真源切换为 7.0 值（`excludeScalarTokens=true`） |
| `--ds7-` 存在根因 | `tokens/colors.css` 遗留同名 `--ds-*` 且取值冲突（CM-02 `surface-overlay` 语义反转 CRITICAL） |
| 回滚开关 | 删除 `web/src/styles/index.css` 中 `uds-semantic-bridge.css` 一行 import |
| 7.0 切换条件（已满足） | 全站页面迁移 + 视觉回归无 P0/P1 + 用户授权（B4/B5 DONE_VERIFIED） |

**COMPAT-MAP 冲突登记（8.0.0 必须闭合）**：CM-01 `--ds-radius-md`(HIGH/REPLACED)、CM-02 `--ds-color-surface-overlay`(CRITICAL/ISOLATE)、CM-03/04/05 `--ds-color-text-primary/secondary/inverse`(MEDIUM/ISOLATE)、CM-06 `--ds-color-border-input`(MEDIUM/ISOLATE)。

## 4. 7.0 迁移批次状态（COMPAT-MAP `migrationBatches` 实测）

| 批次 | 范围 | 状态 |
|---|---|---|
| B1 | 代码高亮 / JSON 编辑器 / Terminal | DONE_VERIFIED |
| B2 | 渐变文字单一出口与插值空间 | DONE_VERIFIED |
| B3 | 状态色 / 图表色去 chart 依赖 | DONE_VERIFIED |
| B4 | Payment / Auth / Wallet 高风险页面 | DONE_VERIFIED |
| B5 | 其余 72 个路由页面 | DONE_VERIFIED |
| **B6** | **删除 3.0 兼容层** | **PROHIBITED（8.0.0 核心工程）** |

⚠️ **注册表不一致（Phase 1 登记）**：B5 已 `DONE_VERIFIED` 但 `unmigratedPages` 仍列 **72 个路由文件**——B5 完成后字段未清零，属「注册表与真实状态不一致」，8.0.0 必须修复并以此类问题为零目标。

## 5. 门禁基线（升级前快照，全部实测）

| 门禁 | 命令 | 退出码 | 结果 |
|---|---|---|---|
| 7.0 检查器 | `bun run design:7:check`（C01–C22） | 0 | PASS |
| 对比度/渐变审计 | `node scripts/verify-contrast.mjs` | 0 | **37 checks / 0 failed** |
| Token 同步 | `bun run design:tokens:check` | 0 | 源与生成 CSS 同步 |
| 7.0 整改验证器 | `node registry/check-uds7-remediation.mjs` | 0 | **50 探针 49 PASS / 1 FAIL**；checker 22/22；findings 47 RESOLVED / 0 PARTIAL / 1 OPEN；**verdict `PARTIALLY_VERIFIED`，notAchieved `FINAL_ACCEPTANCE_PASSED`** |

**7.0 未闭合项（8.0.0 必须闭合）**：① 1 个整改探针 FAIL；② 1 个 finding OPEN；③ B6 兼容层未删；④ `unmigratedPages` 72 项未清零；⑤ `FINAL_ACCEPTANCE_PASSED` 未达成。

## 6. 路由基线

`web/src/routes` 实际 **72 个 `.tsx` 路由文件**（与 PAGE-REGISTRY `scanned_route_files`、B5 批次范围一致）。

## 7. 版本字符串分布（迁移范围预判）

`docs/design-system` 中引用 `7.0.1` / `UDS 7.0` / `ds7-` 的文件 **26 个**。迁移纪律：只改版本标识与 Token 归属，不动历史记录、业务数据、无关数字与必须保留的兼容信息。

## 8. 8.0.0 升级架构决议（Phase 0 定案）

1. **唯一权威入口 = `docs/design-system/` 顶层现状体系就地升级**，不另建平行目录重复注册表（指令第十四部分「优先更新现有权威文件」）。
2. `uter-design-system-8.0.0/` 目录承载**升级工程文档**：阶段报告（本报告）、VERSION-MIGRATION-MAP、迁移证据；不承载运行时权威。
3. **8.0.0 核心工程 = 执行 B6**：① `tokens/colors.css` 遗留 `--ds-*` 冲突定义收编清除（闭合 CM-02~06）；② bridge `--ds7-*` → `--ds8-*`（或晋升 canonical `--ds-*`）全量消费者迁移；③ 标量真源归属 8.0 登记；④ 兼容层删除后全站复验 + 视觉基线重冻结（须用户授权）。
4. 版本升级必须有真实规范/代码/运行时/测试证据；禁止只改版本号。
5. 全部门禁通过前**不提交**（指令 2.2）；期间状态持久化于本目录阶段报告。

## 9. 测试基线命令（供独立复验原样重放）

```bash
git rev-parse HEAD                      # 93a58c41eab00d24066171f9de42cd3acb02d428
git status --short | wc -l              # 347（全部 .uap/**）
find web/src/routes -name "*.tsx" | wc -l   # 72
cd web && bun run design:7:check        # EXIT=0
cd web && node scripts/verify-contrast.mjs  # EXIT=0, 37/0
cd web && bun run design:tokens:check   # EXIT=0
node docs/design-system/registry/check-uds7-remediation.mjs  # EXIT=0, 49/50, PARTIALLY_VERIFIED
```
