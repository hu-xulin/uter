# PHASE-1-AUDIT-REPORT — 7.0 / 7.0.1 全量审计（升级输入）

> 审计方法：不重扫已机检过的领域，直接消费 7.0 已固化的机器证据链（`check-design-system-7.0.mjs` 22 项检查、`check-uds7-remediation.mjs` 50 探针、`COMPAT-MAP.json`、`TOKEN-MANIFEST.json`），并对版本字符串分布、路由、门禁做实测复核。所有结论可由 PHASE-0 §9 命令原样重放。

## 1. 审计结论总表

| 领域 | 现状 | 判定 | 8.0.0 处置 |
|---|---|---|---|
| 规范文档 | 36 册 00–35 + 2 专项，入口 `00-UTER-DESIGN-SYSTEM-OVERVIEW.md` | 结构完整 | 就地升版 8.0.0，历史段落归档标记 |
| Token | MANIFEST v7.0.0，384 tokens，SSOT 成立 | 权威单一 | 标量归属改登 8.0；bridge 前缀迁移 |
| 颜色运行时 | `--ds7-*` 251 色 bridge；12 文件 / 1100 处引用 | 隔离有效但属过渡态 | **B6：消除 bridge，晋升 canonical** |
| 颜色冲突根因 | `tokens/colors.css` 遗留 `--ds-*`（CM-02 surface-overlay 语义反转 CRITICAL） | 真实缺陷 | 清除遗留定义，闭合 CM-01~06 |
| 标量 | 已切 7.0 值（字号/行高/圆角/间距），真源 `web/src` | 已验证 | 归属改登 8.0，值冻结 |
| 组件迁移 | B1–B5 全部 DONE_VERIFIED（含 B4 高风险页、B5 72 路由） | 已验证 | 8.0.0 复验而非重做 |
| 旧兼容层 | B6 PROHIBITED：theme.css/tokens/ 为 7.0 值运行时载体 | 唯一未竟工程 | **8.0.0 核心范围** |
| 注册表一致性 | `unmigratedPages=72` 与 B5 DONE_VERIFIED 矛盾 | 真实不一致 | 清零 + 建立一致性检查 |
| 整改验证器 | 50 探针 49 PASS / **1 FAIL**；1 finding OPEN | 未闭合 | 定位修复，8.0.0 内归零 |
| 最终验收 | `notAchieved FINAL_ACCEPTANCE_PASSED`，verdict PARTIALLY_VERIFIED | 诚实状态 | 8.0.0 达成后重跑 |
| 门禁 | 7:check / contrast 37:0 / tokens:sync 全绿 | 基线健康 | 升级后全量重跑对照 |

## 2. 8.0.0 核心工程定义（B6 执行方案，Phase 2 细化）

按依赖顺序四步，每步独立可回滚：

1. **遗留清理**：`web/src/design-system/tokens/colors.css` 中与 MANIFEST 冲突的遗留 `--ds-*` 定义（CM-02~06 对应项）删除或改由生成链派生；`--ds-color-brand-gradient-*` 等 3.0 命名 Token 收编进 8.0 生成链。
2. **前缀迁移**：bridge 生成器（`registry/build.mjs`）输出前缀 `--ds7-*` → `--ds8-*`；`web/src` 12 文件 1100 处消费者机械迁移；旧 `--ds7-*` 禁止残留为运行时别名。
3. **标量收编**：`theme.css` `@theme`（字号/行高）与 `primitives.css`（圆角）登记为 8.0-owned scalar 真源（值不变，归属改版）；`COMPAT-MAP` 改写为 8.0 消融态（isolation 段退役）。
4. **验证收口**：全量门禁 + 72 路由复验 + 视觉基线重冻结 8.0.0（`freeze-baseline.mjs --force` 须用户授权）+ 独立复验 + `FINAL_ACCEPTANCE_PASSED` 达成。

## 3. 已识别风险

| 风险 | 等级 | 缓解 |
|---|---|---|
| bridge 删除后站点崩塌（7.0 记录的教训） | CRITICAL | 四步顺序执行，每步后全量构建 + 门禁；`rollback` 开关保留至步骤 2 验证通过 |
| 1100 处 ds7 引用迁移引入遗漏 | HIGH | 迁移后 `grep -r "ds7-" web/src` 必须为 0，并加入 8.0 检查器 |
| 视觉基线重冻结覆盖历史 | MEDIUM | 归档旧基线至 `audit/baseline/archive-7.0.1/`，新基线独立冻结 |
| `.uap/**` 347 项并发 WIP | 纪律 | 全程排除，不进暂存区 |
| 1 个整改 FAIL 探针未定位 | MEDIUM | Phase 2 先定位（探针明细输出），修复后复跑 |

## 4. 与指令逐条对照（第五/六部分要求）

- 5.1 分层：MANIFEST 已有 primitive/semantic/component 结构 → 8.0.0 复核后沿用。
- 5.2 SSOT：已成立（384 tokens 单源生成）→ 8.0.0 保持，补 8.0 版本归属。
- 5.4 命名：`--ds7-*` → 8.0 独立前缀，全量消费者迁移，禁止双权威别名。
- 6.2 兼容层：7.0 兼容层存在理由（隔离注入）在 8.0.0 中被消除而非永久保留，符合「禁止无退出条件的兼容层」。
- 6.3 运行时禁止事项：以检查器新增 C 级规则固化（旧前缀零残留）。
