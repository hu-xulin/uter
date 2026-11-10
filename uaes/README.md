# UAES — Uter 项目级规范（Uter Project-Level Standard）

> **定位**：`UAES` 是 **Uter 项目的项目级（project-level）规范集**，与 **`AES` 企业级规范（Enterprise Governance Authority）** 形成清晰的上下游关系。
>
> - `AES` = 企业级治理权威，唯一权威来源，覆盖 P00–P12 通用治理要求。仓库：`/Users/lincolnhu/aes`，远端 `hu-xulin/aes`。
> - `UAES` = Uter 项目级规范，描述 Uter **如何在本项目内落地、执行、扩展** 企业级要求，以及 Uter 业务域专属（含 UTER P13 业务域工程）的实现细则。
>
> **核心原则**：UAES 可以在 AES 规则基础上**扩展**（增加 Uter 特有的实现细节、业务规则、质量门禁参数），但**不得降低任何 AES 强制要求**。当 UAES 规定与 AES 冲突时，以 AES 为准。

---

## 1. 与企业级 AES 的绑定关系

| 项 | 值 |
|---|---|
| 企业级权威 | `AES`（仓库 `/Users/lincolnhu/aes`，远端 `hu-xulin/aes`） |
| AES 规范标识 | `AES-SPEC-CORE` / 版本 `2.0.0` / 状态 `ACTIVE` |
| AES 注册表 | `1.12.2` / `ACTIVE`，2150 条要求 |
| Uter 版本钉 | `.aes/aes-pin.json`（`schema_version 3.0.0`，`governed_fingerprint` 指纹绑定，非 commit SHA） |
| 当前治理指纹 | `e9e6274e47cd9293b872cae7745ccad6cfe1400481269b04081e5c5385e118ae` |
| 绑定状态 | `MIGRATION_PENDING`（Uter 侧集成仍由 Uter 仓库自身负责；AES 钉只证明企业级规则集未被篡改） |

Uter 通过 `.aes/aes-pin.json` 锁定其所遵循的 AES 版本；AES 升级后，Uter 应重新校验指纹并刷新钉，UAES 引用的 AES 规范 ID 随之更新。

## 2. 目录结构

```
uaes/
├── README.md                                 # 本文件：项目级规范总纲
├── uaes-standard-registry.yaml               # UAES 规范注册表（仅登记 Uter 项目级规范）
└── standards/
    ├── AI-EXECUTION-STANDARD.md              # AI 执行标准（Uter 执行层）
    ├── API-CONTRACT-STANDARD.md             # API 契约标准
    ├── ARCHITECTURE-STANDARD.md              # 架构标准
    ├── CHANGE-MANAGEMENT-STANDARD.md        # 变更管理标准
    ├── CONFLICT-REPORT.md                    # 规范间冲突裁定记录
    ├── DATABASE-STANDARD.md                 # 数据库标准
    ├── DEVELOPMENT-STANDARD.md              # 开发标准
    ├── DOCUMENTATION-STANDARD.md            # 文档标准
    ├── PRODUCT-REQUIREMENTS-STANDARD.md     # 产品需求标准（含支付/充值/退款/订单状态机/幂等/对账等业务规则）
    ├── SECURITY-STANDARD.md                 # 安全标准
    ├── UX-INTERACTION-STANDARD.md           # UX 交互标准
    ├── ENGINEERING-SYSTEM-ACCEPTANCE-REPORT.md  # 工程系统验收报告
    ├── UTER-AES-GOVERNANCE-ARCHITECTURE-WORKBUDDY-EXECUTION-SPECIFICATION.md  # Uter×AES 治理架构与执行规范
    └── engineering-quality/                 # Uter 工程质量管理体系（执行层）
        ├── README.md
        ├── CODE-REVIEW-STANDARD.md          # 代码审查（上位：AES P09）
        ├── AUTOMATED-TEST-STANDARD.md       # 自动化测试（上位：AES P09）
        ├── AUTO-FIX-STANDARD.md             # 自动修复（上位：AES P09）
        └── QUALITY-GATE-STANDARD.md         # 质量门禁（上位：AES P09/P10）
```

## 3. 规范分层（三段式治理）

Uter 的治理由三层组成，UAES 是第二层：

1. **AES 企业级通用治理 P00–P12**：由独立的 `aes` 仓库拥有，是所有下游项目的唯一权威来源。
2. **Uter 项目级治理（UAES，含 UTER P13 业务域工程）**：本目录拥有，描述 Uter 专属实现与业务规则，**扩展不降低** AES。
3. **执行与保证（WorkBuddy + CI + 独立自动复核）**：落地执行与证据收集。

> ⚠️ UAES 的 `engineering-quality/*` 四份文件是 **Uter 实施细则**，不得被视为与 AES 平行并列的企业级标准来源；其强制要求来自 AES P09/P10。

## 4. 命名空间约定（避免与 AES 混淆）

- 企业级引用一律使用 **`aes`**（仓库名、规范 ID 前缀 `AES-*`、远端 `hu-xulin/aes`）。
- 项目级引用使用 **`uaes`**（本目录、规范 ID 前缀 `UAES-*`、Uter 内部绑定）。
- 历史 `UAES`→`AES` 全局改名曾把 Uter 自有规范并入企业命名空间；本目录将 Uter 项目级规范**重新独立**为 `uaes`，消除命名歧义，同时所有企业级引用统一为 `aes`。
- 历史签署/证据字节因改名而改变者，按 `AES-LEGACY-ATTESTATION-VOID-REGISTER` 声明作废，不重签、不冒充。

## 5. 适用范围与强制要求

- 本目录规范适用于 Uter 项目内的开发、测试、审查、发布与治理活动。
- 支付、充值、退款、资金安全、订单状态机、幂等、并发、对账、数据库迁移、Outbox、任务恢复、缓存一致性、权限与审计等**业务专属要求必须保留**，不得因规范清理而丢失。
- `UTER Design System 3.0` 继续作为当前有效版本，不得被旧版本替代。

## 6. 版本与生命周期

UAES 规范遵循与 AES 一致的生命周期：
`DRAFT → VALIDATED → AUTO_APPROVED → ACTIVE → VERIFIED → DEPRECATED`
文件存在不等于生效；自动批准须有规则与证据；已废弃规范不得继续作为当前权威来源。

## 7. 与 AES 自动治理的关系

AES 企业级治理（自动审批、自动验收、自动整改、内部证据链、独立自动复核）由 `aes` 仓库的 `governance/ai-native/engine` 真实执行。UAES 作为被治理的下游项目级规范，其落地由 Uter 仓库内的接入（`.aes/`、`tools/aes`、`scripts/quality`、`web/scripts`）与 Uter 侧 `AI_NATIVE_INTERNAL_ACCEPTANCE_GATE` 独立验证，不依赖用户人工审批或第三方复核。
