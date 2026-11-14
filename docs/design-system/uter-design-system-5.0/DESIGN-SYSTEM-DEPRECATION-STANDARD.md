# DESIGN-SYSTEM-DEPRECATION-STANDARD — 废弃规范治理标准

| 字段 | 值 |
|---|---|
| 文档 ID | `UDS5-S28` |
| 版本 | `5.0.0` |
| 状态 | `ACTIVE` |
| 上级规范 | `UDS5-S01` |
| 生效日期 | `2026-11-14` |
| 适用范围 | UTER Design System 5.0 全部规范文档、Token、组件、例外与待办条目的废弃判定、登记、迁移、自动注册检查与退出条件治理 |
| 验证状态 | `NOT_VERIFIED`（本轮仅撰写治理标准；注册表已由 5.0 建立并 ACTIVE，本文未执行任何废弃或状态变更） |

---

## 1. 治理对象与范围

| 项 | 内容 |
|---|---|
| 治理对象 | 5.0 规范分册（含 `UDS5-S28` 自身）、组件条目、Token / 例外 / 待办登记（E24 / E28 / P1–P3 / 字体轴 / PageHeader 等）、展示与注册产物 |
| 治理动作 | 废弃判定 → 登记 → 迁移 → 自动注册检查 → 退出条件核验 → 状态变更 |
| 强制约束 | **禁止失效规范继续作为正式标准**、**禁止草稿（DRAFT）当正式规范**、**禁止失效 / 草稿条目被验收清单或迁移指南当作有效依据** |
| 注册表 | `DESIGN-STANDARD-REGISTRY.yaml`：**已建立、ACTIVE、37 条注册条目**，是 5.0 唯一正式规范注册真源，用于机器可校验的 `status` 管理（validator：`web/scripts/check-design-system-5.0.mjs`） |

### 1.1 注册表存在性如实声明（2026-11-14 口径统一后）

| 项 | 事实 |
|---|---|
| 当前状态 | `DESIGN-STANDARD-REGISTRY.yaml` **已在仓库中建立**：`UDS5-R01`、`status: ACTIVE`、`effective_date: 2026-11-14`、**37 条注册条目**（35 份 `.md` + 2 份注册表 `.yaml`） |
| 本文动作 | 本文定义其 schema、`status` 取值与校验规则；**注册表由 5.0 体系建立，本文不创建、不重复创建** |
| 关联既有真源 | `web/src/design-system/component-registry.json`（65 条 / 2,094 行，`registryVersion 1.0.0`）仍是组件注册唯一真源；`web/src/design-system/source/brand.tokens.json` 存在 `status: DRAFT` / `decision: AUTO_BLOCKED` |
| 依据 | 注册表 `:1-9`、`:21-501`；`UDS5-S26` CHANGELOG 节点五/六实测 `standards: 37` / `registeredDocIds: 37`；`bun run design:5:check` |

---

## 2. 废弃判定标准

> 一个规范条目只有**同时满足**下列 D1–D6 才可进入废弃流程；任何一条不满足即保持 `ACTIVE` 或 `DRAFT`，不得废弃。

| # | 判定条件 | 判定方式 | 依据 |
|---|---|---|---|
| D1 | **无有效引用**：全仓无页面 / 组件 / 规范 / 测试引用该条目，或全部引用已迁移到替代项 | `UDS5-S24` S04 / A4 引用扫描；`@theme` / Tailwind 间接消费须逐项验证 | `UDS5-AUDIT-01` §11.4、§4.3 |
| D2 | **有明确替代**：存在 `替代` 字段指向的 5.0 有效规范 / 组件 / Token；无替代者只能标「保持 Pending」，不得废弃 | 登记格式 §3 校验 | `UDS5-S27` §5 |
| D3 | **不影响业务**：废弃不触及支付 / 余额 / 订单 / 退款 / 认证 / 授权 / 数据库契约 | 业务红线拦截器（`UDS5-S22` §1） | `UDS5-AUDIT-01` §13 第 2 条 |
| D4 | **证据齐备**：具备退出条件达成的可执行证据（对比度 / 门禁 / 视觉回归 / 注册一致性） | §7 退出条件台账 | `UDS5-S25` |
| D5 | **先登记后变更**：先在注册表写入 `DEPRECATED` 并附 7 字段登记，再执行物理迁移 / 删除 | §3 / §5 流程 | 本规范 |
| D6 | **批次受限**：删除 / 归档类动作每批 ≤ 10，逐批重跑只读门禁 | `UDS5-S27` §5.1 D5 | `UDS5-AUDIT-01` §13 第 4 条（本轮不执行删除） |

> 判定结论三态：`可废弃`（D1–D6 全满足）/ `保持 Pending`（缺证据或替代，维持 ACTIVE 登记）/ `拒绝废弃`（影响业务或仍有引用）。**本轮所有现存条目均处于 `保持 Pending` 或 `拒绝废弃`，不执行废弃**（`UDS5-AUDIT-01` §11.4 明确「须先补证据，本轮不执行删除」）。

---

## 3. 登记格式（7 字段，强制）

### 3.1 字段定义

| # | 字段 | 类型 | 必填 | 说明 |
|---|---|---|:--:|---|
| 1 | `编号` | string | 是 | 稳定唯一编号，如 `DEP-5.0-001`；与 `E24` / `E28` / `P1`–`P3` 等历史编号建立映射，不得复用 |
| 2 | `生效版本` | string | 是 | 废弃决定生效的规范版本，须为 `5.0.0`（或按 `UDS5-S26` 时间线的后续版本）；禁止写 `3.1` 等未说明版本（见 `UDS5-S27` §2.2） |
| 3 | `原因` | string | 是 | 废弃理由（被替代 / 证据已达成 / 过时叙述 / 重复实现 / 业务下线），须可复核 |
| 4 | `替代` | string | 是 | 指向 5.0 有效规范 ID / 组件路径 / Token 名；无替代写 `NONE（保持 Pending）` 并禁止进入废弃 |
| 5 | `迁移期限` | date / string | 是 | 引用方完成迁移的截止日期或里程碑；未定写 `UNSCHEDULED` 并保持 Pending |
| 6 | `责任人` | string | 是 | 负责迁移与复核的角色 / 会话标识；不得为空 |
| 7 | `证据` | list | 是 | 退出条件达成证据（脚本名 + 结果 + 路径），如 `verify-contrast.mjs 31 PASS`；未齐备写 `NOT_VERIFIED` |

### 3.2 登记表模板

| 编号 | 生效版本 | 原因 | 替代 | 迁移期限 | 责任人 | 证据 |
|---|---|---|---|---|---|---|
| `DEP-5.0-XXX` | `5.0.0` | `<可复核理由>` | `<UDS5-Sxx / 路径 / NONE>` | `<日期 / UNSCHEDULED>` | `<角色>` | `<脚本 + 结果 / NOT_VERIFIED>` |

### 3.3 YAML 投影格式（供 `DESIGN-STANDARD-REGISTRY.yaml`，已建立）

```
- id: DEP-5.0-XXX
  status: DEPRECATED          # 仅 ACTIVE | DEPRECATED | PENDING | DRAFT
  effectiveVersion: 5.0.0
  reason: <原因>
  replacement: <替代>
  migrationDeadline: <迁移期限>
  owner: <责任人>
  evidence:
    - <证据 1>
    - <证据 2>
```

> 注册表为**规范注册真源**；`component-registry.json` 仍为**组件注册唯一真源**（`UDS5-AUDIT-01` §11.2 第 5 条：JSON 仍为唯一真源，YAML 为其投影）。二者不得互相覆盖。

---

## 4. 迁移机制

### 4.1 状态机

```
DRAFT ──(证据齐备 + 审批)──→ ACTIVE ──(D1–D6 全满足 + 登记)──→ DEPRECATED ──(归档 / 删除候选)──→ [退出]
  │                              │                                    │
  └── 不得当正式规范 ────────────┴── 失效后不得作为正式标准 ──────────┘
```

| 迁移 | 触发 | 前置 | 产出 |
|---|---|---|---|
| `DRAFT → ACTIVE` | 草稿完成评审、证据齐备 | `UDS5-S24` S05 文档存在非空 ≥100 行 + 必备章节；对比度 / 门禁证据 | 注册表 `status: ACTIVE` |
| `ACTIVE → DEPRECATED` | §2 D1–D6 全满足 | 7 字段登记完整、`替代` 有效、引用数 0 | 注册表 `status: DEPRECATED` + 变更日志条目 |
| `DEPRECATED → 归档` | 迁移期限到达且无残留引用 | 批次 ≤10、先备份、走废纸篓、重跑只读门禁 | 归档记录（非永久删除） |
| 任意态 → `ACTIVE` 回退 | 发现误废弃 / 引用残留 | 按 `UDS5-S27` 回滚方式还原备份 | 状态回退 + 证据复核 |

### 4.2 迁移流程

| 步骤 | 动作 | 门禁 / 证据 |
|---|---|---|
| M1 | 引用扫描，确认 D1（无有效引用） | `UDS5-S24` S04 / A4 |
| M2 | 确认 `替代` 有效且指向 5.0 有效条目（S03 / S04 路径有效） | 规范一致性检查 |
| M3 | 补齐 7 字段登记，写入注册表 `status: DEPRECATED` | §3 登记格式 |
| M4 | 通知引用方在 `迁移期限` 内迁移；逐批 ≤10 执行 | `UDS5-S27` §5.1 |
| M5 | 每批后重跑只读门禁：`lint:design:strict`、`design:showcase:check`、`verify:contrast`、`components:registry:check` | `UDS5-S24` §10 |
| M6 | 迁移期限到达且证据齐备 → 归档；否则保持 `DEPRECATED` 并标注 `UNSCHEDULED` | §7 退出条件 |
| M7 | 更新 `UDS5-S26` 变更日志与 `UDS5-S25` 验收台账 | 台账一致性 |

---

## 5. 自动注册检查（`DESIGN-STANDARD-REGISTRY.yaml`）

### 5.1 `status` 取值约束

| 取值 | 含义 | 是否可作为正式标准 | 约束 |
|---|---|:--:|---|
| `ACTIVE` | 现行有效规范 | **是** | 必须存在且非空、含必备章节、文档 ID 唯一 |
| `DEPRECATED` | 已废弃、仅作历史留痕 | **否** | 必须有 7 字段登记与有效 `替代`；失效后不得被验收 / 迁移指南当作有效依据 |
| `DRAFT` | 草稿 / 未定案 | **否** | **DRAFT 不得当正式规范**；不得被引用为验收依据、不得勾选通过、不得作为迁移目标 |
| `PENDING` | 已登记待补齐（证据未齐） | **否** | 不得作为正式规范 / 验收依据；证据齐备后转 `ACTIVE` |

> `status` **只允许** `ACTIVE` / `DEPRECATED` / `PENDING` / `DRAFT` **四个枚举值**（与注册表 `status_values` 一致）；`PENDING` = 已登记但证据未齐，不得作为正式规范 / 验收依据；出现其他值（如 `OBSOLETE` / `REMOVED` / `null` / `ARCHIVED`）一律校验失败。

### 5.2 自动检查规则

| 规则 | 检查内容 | 失败输出格式 | 修复建议 |
|---|---|---|---|
| `R1` status 枚举合法 | 每条记录 `status ∈ {ACTIVE, DEPRECATED, PENDING, DRAFT}` | `[UDS5-S28-R1][BLOCK] registry:line — 非法 status`；`actual=OBSOLETE`，`expected=四枚举之一` | 修正为合法枚举 |
| `R2` DRAFT 不得当正式规范 | 验收清单 / 迁移指南 / 组件注册不得引用 `status: DRAFT` 条目 | `[UDS5-S28-R2][BLOCK] file:line — 引用 DRAFT 规范`；`actual=引用 DRAFT`，`expected=仅引用 ACTIVE` | 移除引用或先完成 `DRAFT → ACTIVE` 评审 |
| `R3` 失效规范不得作为正式标准 | `status: DEPRECATED` 条目不得出现在「有效依据 / 验收方法 / 改造要求」中 | `[UDS5-S28-R3][BLOCK] file:line — 引用已废弃规范`；`actual=引用 DEPRECATED`，`expected=引用其 replacement` | 改指向 `替代` 字段 |
| `R4` ACTIVE 文档有效 | `ACTIVE` 条目对应文档存在、非空、≥100 行、4 个必备章节齐全 | `[UDS5-S28-R4][BLOCK] file:line — ACTIVE 文档无效`；`actual=0 行 / 缺章节`，`expected=有效` | 补齐文档（`UDS5-S24` S05） |
| `R5` DEPRECATED 登记完整 | 7 字段齐全、`替代` 有效、`证据` 非 `NOT_VERIFIED` | `[UDS5-S28-R5][BLOCK] registry:line — 废弃登记不完整`；`actual=缺证据`，`expected=7 字段齐备` | 补齐登记；证据未齐备则保持 `ACTIVE` + Pending |
| `R6` 编号唯一 | 全部 `编号` 全局唯一，与 `UDS5-Sxx` / `E24` / `P1–P3` 映射不冲突 | `[UDS5-S28-R6][BLOCK] registry:line — 编号重复`；`actual=重复`，`expected=唯一` | 重新分配编号 |
| `R7` 引用路径有效 | `替代` / `证据` 指向真实路径 / 脚本 / 结果，禁止虚构 | `[UDS5-S28-R7][BLOCK] registry:line — 引用路径无效`；`actual=路径不存在`，`expected=真实存在` | 修正为真实路径（`UDS5-S24` S04 / S08） |

### 5.3 禁止事项复核

| # | 禁止项 | 落地规则 |
|---|---|---|
| B1 | 失效规范继续作为正式标准 | `R3` 拦截；`DEPRECATED` 仅作历史留痕，进入「有效依据」即 BLOCK |
| B2 | 草稿当正式规范 | `R2` 拦截；`DRAFT` 不得引用、不得勾选、不得作为迁移目标 |
| B3 | 3.0 §22 的 73 个未勾选状态被继承为「已通过」 | 5.0 重新逐项给证据（`UDS5-AUDIT-01` §11.4 第 2 条、`UDS5-S25` §1.2） |
| B4 | `brand.tokens.json` 的 `status: DRAFT` / `decision: AUTO_BLOCKED` 擅自变更 | 仅在 `verify-contrast.mjs` + 视觉回归证据链齐备后才可变更（`UDS5-AUDIT-01` §11.4 第 5 条、§7 本规范） |
| B5 | 通过忽略规则 / 降阈值 / 删测试制造 PASS | `UDS5-S24` G1–G3 |

---

## 6. 3.0 已登记条目的退出条件（逐条）

> 依据 `UDS5-AUDIT-01` §3.1 / §11.4 第 4 条：「E24 / P1–P3 / 字体轴 / PageHeader 的临时状态——5.0 给出明确退出条件，未达成前保持 Pending」。所有条目当前**不得废弃、不得勾选通过**。

| 编号 | 3.0 位置 / 内容 | 当前状态 | 退出条件（达成方可变更状态） | 所需证据 | 废弃判定 |
|---|---|---|---|---|---|
| `E24` | `:3228`、`:3587`：浅色溢价 **3.76:1**、深色折扣 **3.30:1** 低于 4.5:1；编号注销但缺陷须保持待修 | P1 无障碍缺陷，Pending | 两处对比度均修复至 **≥4.5:1**，且 `verify-contrast.mjs` 相应断言通过、视觉复核确认；编号注销状态不改 | `verify-contrast.mjs` 结果 + 视觉回归证据 + 修复 diff | **拒绝废弃**（缺陷未修，D4 不满足）；保持 Pending，不得勾选通过 |
| `E28` | `:3524-3532`：首屏品牌渐变标题 2.54 / 2.72 / 3.96:1 为**有意例外**（B 类验收口径），不进 ALLOWLIST | 登记例外，Pending | 例外边界持续清晰登记；若要调整例外范围，须补齐 `verify-contrast.mjs` 渐变锚定与负例拒绝证据并经评审；**不进 ALLOWLIST** | 例外台账 + `verify-contrast.mjs` 31 条（含渐变锚定） | **拒绝废弃**（刻意例外，需长期登记）；保持登记 |
| `P1` | `:4105`、`:4062`：Terminal ANSI 0–15 全色板未落地（早期 20 个 `...` 占位符） | Pending | 16 色 ANSI 色板全部落地、纳入 Token 注册表与 Manifest，占位符清零，并经色值一致性校验 | 色板定义文件 + Manifest 登记 + `design:tokens:check` | 未达成前保持 Pending；达成后按 §3 登记 `DEPRECATED`（临时状态）或 `ACTIVE`（色板规范） |
| `P2` | `:4106`、`:4063`：图表 text/axis/label/grid 独立 Token 未定义 | Pending | 定义图表四通道独立 Token，纳入颜色 / 数据展示规范与注册表，并与 `chart-typography.ts`（T4 TS 镜像）一致 | Token 定义 + 注册表 + 17 条 showcase 校验扩展 | 同上，保持 Pending 至证据齐备 |
| `P3` | `:4107`、`:4064`：装饰层 `--ds-decor-*` 未纳入 `colors.decoration` | Pending | `--ds-decor-*` 全部纳入 `colors.decoration` 并完成分层归属校验 | Token 定义 + `check-design-tokens.mjs --strict` | 同上，保持 Pending 至证据齐备 |
| 字体轴 | `:2625-2628`、`:3340`：`data-theme-font`（system/sans/serif）未落地，代码锁 Inter + Noto Sans SC | Pending | 二选一并登记：① 落地三维字体轴并经 `@theme` / `tokens.test.ts` 校验；② 经评审正式登记「不实现，锁 Inter + Noto Sans SC」决议并写入变更日志 | 实现 diff + 测试，或评审决议 + `UDS5-S26` 条目 | 未登记决议前保持 Pending；不得静默按「已实现」处理 |
| PageHeader | `:3339`：§13.1 定义的 PageHeader **尚无独立组件**，页面按 §3+§6 组合 | Pending / 补齐候选 | 二选一并登记：① 补齐独立 PageHeader 组件、登记 `UTER-CMP-*` ID 与 11 项字段；② 经评审正式登记「由 §3+§6 组合替代，不建独立组件」决议 | 组件 + 注册证据，或评审决议 + `UDS5-S26` 条目 | 未登记决议前保持 Pending |
| `brand.tokens.json` | `status: DRAFT` / `decision: AUTO_BLOCKED`（`:11.4` 第 5 条） | DRAFT | **仅在 `verify-contrast.mjs` + 视觉回归证据链齐备后**方可由 `DRAFT` 变更为 `ACTIVE`；`AUTO_BLOCKED` 同步解除 | 对比度 + 视觉回归证据链 + 评审记录 | **DRAFT 不得当正式规范**（B4 / R2）；保持 DRAFT 直至证据齐备 |

> 上述 8 类条目在 5.0 中一律保持 `ACTIVE`（「Pending」为中文描述词，指证据未齐的登记状态；注册表 `status` 仍写 `ACTIVE`，或按四枚举登记为 `PENDING`）或 `DRAFT`（brand.tokens.json），**本轮不执行废弃、不勾选通过、不改变状态**（`UDS5-AUDIT-01` §11.4、§14 结论 B/C）。

---

## 7. 与其他规范的关系

| 规范 ID | 关系 | 说明 |
|---|---|---|
| `UDS5-S01` | 上级 | 服从总纲效力、ID 体系与验证状态口径 |
| `UDS5-AUDIT-01` | 主要事实依据 | §3.1 未闭合项、§11.4 废弃决定、§14 结论 B/C、§4.4 门禁实测 |
| `UDS5-AUDIT-02` | 辅助依据 | Clerk Elements 弃用 / localization Experimental 作为「外部时效事实」登记示范（非 Uter 废弃项） |
| `UDS5-S23` | 关联 | `deprecated / replacement` 字段与「删组件检查引用」双向关联 A4 |
| `UDS5-S24` | 下游 / 执行 | 8 类 Validator 与 S01–S08 / C08 提供自动注册检查的落地；G1–G7 铁律一致 |
| `UDS5-S25` | 下游 | 8 状态与 12 必要条件；「失效 / 草稿不得作为验收依据」 |
| `UDS5-S26` | 关联 | 废弃 / 状态变更登记到变更日志时间线 |
| `UDS5-S27` | 关联 | 删除前置条件、批次 ≤10、回滚方式、旧版迁移历史保留 |

---

## 8. 代码实施位置

| 类别 | 真实路径 | 本文关联 | 本轮状态 |
|---|---|---|---|
| 规范注册真源 | `DESIGN-STANDARD-REGISTRY.yaml` | §1.1 / §3.3 / §5 | **已建立、ACTIVE、37 条**；本文仅定义 schema 与校验规则 |
| 组件注册真源 | `web/src/design-system/component-registry.json`（65 条 / 2,094 行，`registryVersion 1.0.0`） | §1.1 / §3.3 / §4 | 存在，未改造 |
| 注册校验 | `web/scripts/check-component-registry.mjs`（`:45` 硬编码 `designSystem`） | §6.1 关联（`UDS5-S27`） | 存在，未改造 |
| DRAFT 资产 | `web/src/design-system/source/brand.tokens.json`（`status: DRAFT` / `decision: AUTO_BLOCKED`） | §5.3 B4 / §6 | 存在，未改造 |
| 3.0 历史版本 | `docs/design-system/UTER-DESIGN-SYSTEM-3.0.md`（4,111 行 / 197,053 B） | §6 全部条目 | 存在，未改动 |
| 对比度门禁 | `web/scripts/verify-contrast.mjs`（31 条） | §6 E24 / E28 / brand.tokens.json | 存在，未改造 |
| Token 门禁 | `web/scripts/check-design-tokens.mjs`、`generate-design-tokens.mjs` | §6 P1–P3 | 存在，未改造 |
| 展示校验 | `web/scripts/sync-design-showcase.mjs`（17 条） | §6 P2 | 存在，未改造 |
| 变更日志 / 验收台账 | `UDS5-S26`、`UDS5-S25` 分册 | §4 M7 / §7 | 撰写中 |
| 规范分册 | `docs/design-system/uter-design-system-5.0/*.md`（`UDS5-S01`..`UDS5-S32`） | §5 R4 | 撰写中 |

> 本文为治理标准，**不重复创建已存在的 `DESIGN-STANDARD-REGISTRY.yaml`、不新增 / 修改任何代码或配置、不执行任何废弃动作**；§6 退出条件为规划项，本轮状态 `NOT_STARTED` / `NOT_VERIFIED`。

---

## 9. 自动化验证

| 验证项 | 现有实现 | 5.0 拟补充 | 当前结果 |
|---|---|---|---|
| `status` 枚举合法（R1） | 注册表 `status_values` 四值 + `design:5:check` | 完整枚举校验器（含 `PENDING` 语义） | 部分建立 `NOT_VERIFIED` |
| DRAFT / DEPRECATED 引用拦截（R2 / R3） | 无 | 验收清单 / 迁移指南 / 组件注册的引用扫描 | 未建立 `NOT_VERIFIED` |
| ACTIVE 文档有效（R4） | 无 | 复用 `UDS5-S24` S05（存在、非空、≥100 行、必备章节） | 未建立 `NOT_VERIFIED` |
| 废弃登记 7 字段完整（R5） | 无 | 登记表字段 + `替代` + `证据` 校验 | 未建立 `NOT_VERIFIED` |
| 编号唯一 / 路径有效（R6 / R7） | `design:5:check`（ID 唯一 / 文档路径有效） | 复用 `UDS5-S24` S01 / S04 / S08 | 部分建立 `NOT_VERIFIED` |
| 退出条件证据链 | `verify-contrast.mjs` 31 PASS、`check-design-tokens.mjs --strict` 违规 0（审计只读实测） | §6 逐条退出条件的可执行证据核对 | 未执行 `NOT_VERIFIED` |
| 组件废弃仍用检查 | `components:registry:check`（65/65/0）、`--strict` EXIT=1（未接 CI） | `deprecated / replacement` 字段补齐后 C08 校验 | `NOT_VERIFIED` |

> 本轮（本分册撰写）未运行验证命令；§9「现有实现」列复述自 `UDS5-AUDIT-01` §4.4 / §5 / §7 只读实测结论，以及 `design:5:check` 的实测输出。CI 已接 / 未接清单见 `UDS5-S24` §9（`components:registry:strict` / `test:axe` / `test:business:e2e` / `test:visual:e2e` / `format:check` 刻意未接）。

---

## 10. 验证状态

| 项 | 状态 | 说明 |
|---|---|---|
| 废弃判定 D1–D6 / 7 字段登记格式 / 迁移机制 / status 四枚举 | `IMPLEMENTED` | §2 / §3 / §4 / §5 已定义 |
| `DESIGN-STANDARD-REGISTRY.yaml` 已建立的事实声明 | `IMPLEMENTED` | §1.1 按注册表 `:1-9` 如实登记，未虚构 |
| 禁止失效规范 / 草稿当正式规范（B1 / B2 / B4 / R2 / R3） | `IMPLEMENTED` | §5.2 / §5.3 已定义 |
| 8 类条目退出条件（E24 / E28 / P1–P3 / 字体轴 / PageHeader / brand.tokens.json） | `IMPLEMENTED_NOT_VERIFIED` | §6 已逐条给出，未执行核验 |
| `DESIGN-STANDARD-REGISTRY.yaml` 创建 | `IMPLEMENTED` | 已由 5.0 体系建立并 ACTIVE（37 条） |
| 自动注册检查 R1–R7 落地 | `PARTIALLY_VERIFIED` | `design:5:check` 已覆盖 ID 唯一 / 路径有效 / 文档 ACTIVE 等结构项；R2 / R3 / R5 的引用扫描与废弃登记仍未建立 |
| 全部现存条目的废弃 / 状态变更 | `NOT_STARTED` | 本轮不执行（`UDS5-AUDIT-01` §11.4） |
| E24 修复 / E28 例外复核 / P1–P3 落地 / 字体轴 / PageHeader | `NOT_STARTED` | 保持 Pending |
| 全量构建 / 视觉双轨 / `test:axe` / `test:business:e2e` / 原生验收 | `NOT_EXECUTED` / `NOT_VERIFIED` | `UDS5-AUDIT-01` §14 |
| PC Web / H5 | `NOT_VERIFIED` | 未针对 5.0 重跑 |
| Android / iOS / HarmonyOS | `NOT_VERIFIED` | 无实现（决策 D4） |

**总体验证状态：`NOT_VERIFIED`**。本文不得被解读为 `FULLY_IMPLEMENTED_AND_VERIFIED`；废弃治理的最终状态以 `UDS5-S25`（验收规范）与最终验收报告为准。
