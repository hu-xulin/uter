# AES-P05-AES-LIBRARY-ALIGNMENT — Alignment with the AES Standard Library

| Field | Value |
|---|---|
| Report ID | AES-P05-AES-LIBRARY-ALIGNMENT |
| Version | 1.0.0 |
| Status | DRAFT |
| Domain | AES-05 Experience & Design |
| Phase | P4 |
| Gate | AES-05-GATE-001 |
| Result | NOT_RUN |

> 本文件是**实施证据记录**，不是 AES 标准文件。
> 权威资产位于 AES 规范库：`quality/acceptance/AES-P05-ACCEPTANCE-BASELINE.md`、
> `quality/gates/AES-05-GATE-001-DESIGN-QUALITY-GATE.md`；
> 唯一事实源为规范库 `.aes/STANDARD-REGISTRY.yaml`。本仓库不另立注册表。
> 依门禁 §4/§6，`NOT_RUN` / `NOT_VERIFIED` 不得记为 `PASS`。

## 1. Background

本分支的实现资产已按规范库的文件夹与文档规则导入 AES 规范库。
规范库在 v1.6.0/v1.7.0 将 P4 交付物统一为域对齐命名：

| 旧命名（本分支历史） | 规范库权威命名 |
|---|---|
| `quality/acceptance/AES-P4-ACCEPTANCE-BASELINE.md` | `quality/acceptance/AES-P05-ACCEPTANCE-BASELINE.md` |
| `quality/gates/AES-05-GATE-001-EXPERIENCE-AND-DESIGN-GATE.md` | `quality/gates/AES-05-GATE-001-DESIGN-QUALITY-GATE.md` |
| `standards/05-experience-design/AES-05-014-*` | `standards/05-experience-design/AES-05-006-COMPONENT-CONTRACT.md`（05-014 从未登记） |
| `reports/aes/` | `reports/{baseline,compliance,quality,release,security}/` |
| `reports/quality/AES-P4-*` | `reports/quality/AES-P05-*` |

## 2. Changes in this commit

1. **报告对齐**：6 份实施证据报告改为 `AES-P05-*` 命名、规范库表格化元数据头，
   并改写所有指向已废弃权威文件的引用。
2. **历史权威副本标记 DEPRECATED**：本仓库内两份旧版验收基线/门禁副本保留
   Git 历史，但加显著声明指向规范库权威版本；依「冲突/重复以规范库为准」，
   不得再据此修改或覆盖权威资产。
3. **代码按规范修正**：
   - `AES-05-002` §6 / `AES-05-011-006`：生成 CSS 补 `Generator version`、
     `Source version` 与规范条款，生成器重新产出 `brand.css`。
   - `AES-05-003` §6 / P05 §L.4：`verify-contrast.mjs` 明确标注导航选中态
     已整改组合（`#5558D8` on `#F0F0FF` = 4.93:1），新增负向测试证明旧组合
     `#5B5EE6` on `#F0F0FF` = 4.44:1 被 AA 规则拒绝，不得以差距很小豁免。
   - `AES-05-001-009`：Token 源新增 `changeApproval: NOT_VERIFIED` 与治理指针，
     不臆造 Exception ID、审批人或批准日期；测试增加对应断言。
   - 无法执行的检查显式输出 `NOT_RUN`，不记为 `PASS`。

## 3. Division of authority

| 内容 | 权威位置 |
|---|---|
| AES 标准、Schema、门禁、验收基线、注册表 | AES 规范库（本项目之外的 `uter-ai` 目录） |
| React 组件树、完整 CI、视觉回归、运行时 CSS | 本产品仓库 |
| 导入后规范化实现资产副本、导入校验报告 | AES 规范库 `design-system/`、`quality/scripts/design-system/`、`reports/quality/` |

## 4. Open items

- 组件注册表仍未满足规范库 `.aes/schemas/component-contract.schema.json`
  的 9 个必填字段；差距在规范库侧记为 `NOT_VERIFIED`，不得伪造契约数据。
- 品牌主色变更缺正式审批；P05 验收仍为 BLOCKED。
