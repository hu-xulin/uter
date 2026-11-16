# UDS 8.0.0 升级 — 最终执行报告（Phase 0–8）

> 本文件是 `uter-design-system-8.0.0/` 工程目录的执行结论。权威注册表与派生规范在
> `docs/design-system/`（TOKEN-MANIFEST.json / COMPAT-MAP.json / 00–35 规范 / SHOWCASE-8.0.0.html）。

## A. 最终结论（提交前实测）

- 目标版本：**UTER DESIGN SYSTEM 8.0.0**
- 分支：`main`（单分支工作模式，无 PR / 无新分支）
- 执行 HEAD 起点：`93a58c41e`
- 规范建设状态：38 规范模块全部重建（版本头 8.0.0，STATUS=ACCEPTANCE_READY）
- Token 建设状态：manifest **389 tokens**（+5 收编：surface.pure / surface.scrim / text.on-emphasis / text.danger / text.success）
- 组件迁移状态：65 组件经 @theme 真源自动跟随；4 个模态组件遮罩类迁移 `bg-surface-scrim/10`
- 页面迁移状态：72 路由（B5 DONE_VERIFIED 沿用 + G17 16/16 实测）
- 自动化治理状态：`design:8:check`（check-design-system-8.0.0.mjs）C01–C22 全 PASS；CI 已接 `bun run design:8:check`
- 旧版本清理状态：**B6 DONE_VERIFIED** —— colors.css 整体退役、CM-02~06 全 RESOLVED、web/src 零 `ds7-` 残留
- 测试状态：G14 全量 vitest EXIT=0；tsgo / oxlint EXIT=0
- 视觉验证状态：G19 基线 8.0.0 冻结 15/15 字节一致；G12/G13/G17 EXIT=0
- 独立复验状态：finalize.mjs 全部 15 项 G 门禁 EXIT=0（两轮，第二轮含 INC-01 修复）
- **最终验收状态：`PARTIALLY_VERIFIED`（诚实口径）** —— 自动化全绿，但 `accepted` 仍为 false，
  须用户最终验收；C-R01 探针 `unchangedVsHead` 在 AGENTS.md 治理更新落库前如实 PARTIAL（暂态）。

## B. 关键工程决议

1. **B6（删 3.0 兼容层）经用户本轮授权正式执行**：colors.css 删除；
   遮罩语义改名 `--ds-color-surface-scrim`（恒黑）并与 manifest 的 `surface-overlay`
   （浮层容器 #FFFFFF/#1B2436）语义分离 —— CM-02 语义反转风险以「改名 + 迁移 4 组件」闭合。
2. **仍有消费者的 5 个遗留语义收编进 manifest**（389 tokens），其余约 85 个零消费者遗留定义随文件删除。
3. **检查器/回归探针合同随版本迁移**（如实记录）：
   - C-R01：断言对象由「AGENTS.md 保留 3.0 权威声明」改为「AGENTS.md 声明 8.0.0 唯一权威」；
   - legacyTokenIsolated → scrimTokenLive（旧 token 不复存在 + 新 scrim token 恒黑）；
   - verify-contrast GRADIENT_6_LEGACY_TRIO_REMOVED 升级为 colors.css 整体退役断言。
4. **修复 finalize G16 隐藏 bug**：`design:7:check` 改名后 finalize 仍调用旧名导致 EXIT=1，已改 `design:8:check`。

## C. 自动化证据（第二轮 finalize，全部 EXIT=0）

G01 tsgo / G02 token 严格门禁 / G06 tokens:check / G07 showcase 同步 / G08 对比度 37/0 /
G09 版权头 / G10 全量 oxlint 0 error / G12 Showcase 视觉回归 / G13 axe / G14 全量 vitest /
G15 构建 / G16 C01–C22 / G17 真实页面回归（含隔离栈认证 8 场景）/ G18 整改验证器 50 探针 /
G19 视觉基线 15/15。证据文件：`docs/design-system/GATE-EVIDENCE.json` + 8 份 audit JSON。

## D. 遗留（如实登记）

- audit/ 下 10 份 7.0 时代审计 .md 保留为升级证据（HISTORICAL，非运行时）。
- `resolveUds6ChartPalette` 等内部代码标识符未重命名（代码名非版本声明，避免无谓 churn）。
- C-R01 PARTIAL 在本轮提交落库后自动解除（INC-03）。
