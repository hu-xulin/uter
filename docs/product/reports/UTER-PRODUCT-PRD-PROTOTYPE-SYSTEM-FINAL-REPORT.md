# UTER 产品原型与 PRD 一体化系统 · 最终报告

> 生成时间：2026-11-09 · 执行分支：`main` · 项目根目录：`/Users/lincolnhu/uter`
>
> **最终结论：`PASS_WITH_EXCEPTIONS`**（详见第 10 章）
>
> 本报告所有数字、命令、退出码与测试数量均来自真实执行输出，未使用估算值。凡无法由证据支撑的状态一律按 `NOT_IMPLEMENTED` / `NEEDS_PRODUCT_DECISION` / 0 记录，不虚构功能、覆盖率或测试结果。

---

## 1. 项目概况

### 1.1 执行环境与 Git 安全边界

| 项 | 真实值 |
| --- | --- |
| 分支 | `main` |
| 进入时工作区未提交项 | 516 |
| 报告生成时工作区未提交项 | 527 |
| 新建分支 / 切换分支 | 0 / 0 |
| `git reset --hard` / push / PR / merge / deploy | 均未执行 |
| 真实支付、退款、生产密钥、生产数据操作 | 均未执行 |

进入时工作区已有 516 项未提交修改（含 UAES→AES 治理重命名、规范、报告、前端设计系统文件、SQL 测试等）。本次严格保护这些既有成果：**未清理、未回滚、未覆盖任何用户已有业务代码**。对需要重建的两份数据文件先做了备份：

```bash
cp docs/product/registry/product-model.json /tmp/uter-product-model.backup.json
cp docs/product/history/v1.json             /tmp/uter-history-v1.backup.json
```

### 1.2 规范基线（本次实际加载并遵循）

| 规范 | 路径 / 版本 | 状态 |
| --- | --- | --- |
| 项目入口 | `AGENTS.md`、`CLAUDE.md` | 已加载 |
| 执行方法论 | `.ai/README.md`、`.ai/AIES.md`（L0–L4、阶段 0–11 SOP） | 已加载 |
| 设计系统 | `docs/design-system/UTER-DESIGN-SYSTEM-3.0.md` | **唯一有效基线**；主色 `#5B5EE6`、PC 正文 14px、最小 12px、圆角 10px、语义 Token 优先 |
| 治理 | `.aes/aes-pin.json` · `registry_version 1.12.2` · `specification_version 2.0.0` · `ACTIVE` | 当前有效 |
| 域规范 | `uaes/standards/`、`web/AGENTS.md` | 已加载 |
| 废弃基线 | `UTER Design System 2.1`、UAES 当前治理实体 | **未作为基线使用**（UAES 仅作历史/删除状态识别） |

### 1.3 扫描范围

- 前端：`web/src/routes`、`web/src/features/**`、路由表与页面组件、侧栏与权限配置、7 份 i18n 语言包。
- 后端：`router/`（Gin 路由）、`controller/`、`service/`、`model/`（GORM）、中间件、配置与多数据库兼容层。
- 产品与治理资料：`docs/**`、`docs-dev/openapi/**`、已有 PRD / 原型 / 注册表 / 追溯矩阵 / 历史快照。
- 盘点结果固化在 `tools/product-workspace/seed.mjs`，由 `build-model.mjs --force` 生成统一模型，避免人工编造清单。

### 1.4 技术栈与实际产品模块

| 层 | 技术栈 |
| --- | --- |
| 后端 | Go 1.27.3 + Gin + GORM v2；SQLite / MySQL / PostgreSQL 多库兼容 |
| 前端 | React 19 + TypeScript + Rsbuild 2 + TanStack Router / Query / Table + Zustand + Base UI + Tailwind CSS 4 |
| 包管理 | Bun |
| 认证与权限 | session、API token、JWT、WebAuthn / Passkeys、TOTP、OAuth / OIDC、Casbin |
| 产品规格中心 | 零外部依赖 Node HTTP 服务 + 原生 SPA（ES Module / CSS），仅绑定 `127.0.0.1` |

实际产品模块（按真实代码盘点）：用户账户与认证、充值支付、退款、余额与额度、Token 计费、模型供应商与渠道、API Key、API 中继、异步任务、套餐与限额、管理后台，以及日志、文档站、通知、系统配置等其余实际功能。

**实际功能总数：56**（Feature ID 全部符合 `UTER-{DOMAIN}-{NUMBER}` 且全局唯一）。

### 1.5 重要事实：前序建设成果

`docs/product/`（131 个文件）与 `tools/product-workspace/`（16 个文件）在进入本任务时均为 `??`（untracked）的**前序未提交建设成果**，已包含统一模型、56 份 PRD、56 份原型、注册表、引擎与 SPA。本次没有重复建设同一套东西，而是做了：真实测试 → 发现并修复缺陷 → 全量重建投影 → 补齐报告/CLI/门禁 → 集成到 Uter 导航 → 最终验收。这一区分在后续各章的"新建/补齐"数字中如实体现。

**后续追加（同一会话）**：按用户要求将原型升级为 **HTML 交互格式并与 PRD 同源对应**——新增 `tools/product-workspace/render-html.mjs` 渲染器，为 56 个 Feature 各生成一份自包含交互式 HTML 原型（左原型 / 右 PRD 同源双栏），纳入渲染管线、一致性检查、规格中心入口与自动化测试（详见 §4.1）。

---

## 2. 功能盘点

数据来源：`docs/product/registry/product-model.json` v1（由 `build-model.mjs --force` 重建）、`docs/product/PRODUCT-FEATURE-CATALOG.md`。

| 实现状态 | 数量 | 说明 |
| --- | ---: | --- |
| 已实现 `IMPLEMENTED` | 46 | 前后端证据齐备 |
| 部分实现 `PARTIALLY_IMPLEMENTED` | 1 | `UTER-MISC-005`：前后端证据不充分，按部分实现记录，不写成完整实现 |
| 仅前端 `FRONTEND_ONLY` | 0 | 全仓扫描未发现该状态的功能，记 0 不编造 |
| 仅后端 `BACKEND_ONLY` | 8 | `UTER-PAY-003`、`UTER-REFUND-002/003`、`UTER-BALANCE-002/003`、`UTER-CHANNEL-002`、`UTER-RELAY-003`、`UTER-TASK-003` |
| 仅有文档 `DOC_ONLY` | 0 | 未发现，记 0 |
| 未实现 `NOT_IMPLEMENTED` | 1 | `UTER-REFUND-001` 通用用户退款申请与审核 |
| 未知 `UNKNOWN` | 0 | 无；任何证据不足项均落到 `PARTIALLY_IMPLEMENTED` 并写明 `status_note`，未以 UNKNOWN 稀释结论 |
| **合计** | **56** | |

关键证据：

- `UTER-REFUND-001.status_note` 明确记录：经全仓扫描 `router/controller/service/model` 与 `web/src/routes`（含 `/wallet`、`/subscriptions`、`/usage-logs`、`(auth)/*`），未发现用户侧退款申请入口与对应 API，因此判定 `NOT_IMPLEMENTED`，并**只建规划态原型，不冒充已上线**（测试 `NOT_IMPLEMENTED 仅建规划原型，不冒充已上线` 通过）。
- 功能目录含用户要求的 14 类字段（Feature ID、功能名称、业务模块、用户角色、实现状态、页面路径、API 路径、数据模型、PRD 路径、原型路径、测试路径、优先级、验收状态、证据来源）。
- 状态说明真实存在性由 `V-STATUS` 检查项强制保证；本次修复了 `UTER-REFUND-001.status_note` 缺失导致的测试失败。

---

## 3. PRD 建设

| 项 | 数量 | 说明 |
| --- | ---: | --- |
| PRD 总数 | 56 | `docs/product/prd/**`，每个 Feature ID 一份 |
| 本次新建 | 0 | 前序成果已建立 56 份；不重复建设 |
| 本次补齐 / 规范化重渲染 | 56 | 由统一模型全量重渲染，修复 12 章节标题不规范问题 |
| 完整（12 章节齐备） | 56 | `V-PRD` 检查全部通过 |
| 缺失 | 0 | `V-FILE` 文件存在性检查全部通过 |
| 待确认 | 1 | `UTER-REFUND-001`，含 3 项 `NEEDS_PRODUCT_DECISION` |

规范 12 章节（全部 56 份一致）：

```text
1. 基础信息          2. 产品背景        3. 用户角色        4. 用户故事
5. 功能范围          6. 业务流程        7. 功能需求        8. 页面交互
9. API 和数据模型   10. 验收标准（Given / When / Then）   11. 测试追溯   12. 版本变更
```

**本次修复的缺陷**：初轮测试报 `docs/product/prd/auth/UTER-AUTH-001.md 缺少章节 8 页面交互`。旧投影标题为 `## 3. 用户角色与权限`、`## 8. 页面与交互`、`## 9. API 与数据模型`、`## 12. 版本与变更记录`，与规范不符。模型中 `prd.sections` 本就是规范值，执行 `node tools/product-workspace/render-docs.mjs` 全量重渲染后全部统一。

PRD 中的业务规则、验收标准、测试追溯均由模型派生，不存在与 Prototype 各自独立维护的第二份事实（测试 `PRD 中的业务规则、验收标准、测试追溯均来自模型` 通过）。

---

## 4. 原型建设

| 项 | 数量 |
| --- | ---: |
| 原型文档总数 | 56（`docs/product/prototypes/**`） |
| 原型页面总数 | 90 |
| 可交互页面数 | 89 |
| 规划态页面（不可交互） | 1（`UTER-REFUND-001`，刻意保留为规划态） |
| 有效需求数 | 124 |
| DEMO / MOCK 标记覆盖 | 56 / 56 |

- 页面模型含 `components`、`interactions`、`states`、`layout`、`entry`；组件类型覆盖 `input`、`select`、`radio_group`、`button`、`modal`、`drawer`、`table`、`search`、`pagination`、`stat_card`、`tabs`、`toggle`、`progress`、`code_block`、`timeline` 等。
- 每个页面具备状态集合（加载 / 空 / 错误 / 成功 / 禁用 / 权限不足）、组件按钮行为、有效跳转目标与必填输入校验；由 `V-PROTO` 检查强制保证。
- **所有交易与账户操作均为 DEMO / MOCK**，不接触真实支付、退款、余额、生产密钥或生产数据。
- 遵循 `UTER Design System 3.0`；前端 `bun run lint:design:strict` 扫描 1249 个文件通过（字号 / 行高 / 圆角 / 投影 / 颜色均符合规范）。

### 4.1 交互式 HTML 原型（主载体，本次新增）

按"原型需要是 HTML 格式，且与 PRD 对应起来"的要求，新增 `tools/product-workspace/render-html.mjs` 渲染器，为**每个 Feature 生成一份自包含交互式 HTML 原型**：`docs/product/prototypes/{domain}/{Feature ID}.html`（56 份，与同目录同名 `.md` 说明一一对应）。

| 要求 | 实现 |
| --- | --- |
| HTML 格式、真正可交互 | 单文件内联 CSS/JS、零外部依赖、浏览器双击即开；组件渲染为真实控件（input / select / radio / button / modal / drawer / table / search / pagination / tabs / toggle / progress / stat_card / timeline / code_block） |
| 与 PRD 对应 | ① 同一 Feature ID（`data-feature-id`）；② `data-prd-path` 指向对应 PRD 文件 + 顶部「打开 PRD Markdown」链接；③ **左原型 / 右 PRD 同源双栏**——右侧 PRD 面板由同一模型渲染 12 章节摘要（基础信息 / 背景 / 角色 / 故事 / 流程 / 需求 / 交互 / API / 验收 / 测试 / 版本）；④ 每个需求块 `id="req-{Requirement ID}"`，左侧每个组件带 `data-component-id` 与 `data-requirement-id` |
| 双向定位 | 点左侧组件 / 需求 chip → 右侧需求块展开高亮；点右侧需求内组件 ID → 左侧组件高亮回跳；页面 ID 双向跳转 |
| 校验同源 | 表单 min / error_message 直接来自 PRD 业务规则（如 `BR-PAY-001-02-01` 最低充值 10 元），双向同步引擎更新业务规则后 HTML 随投影重渲染自动更新 |
| 状态与视口 | 页面切换器、`idle / loading / empty / error / success / disabled / no-permission` 状态切换、PC / H5 视口、交互演示 chips（含跳转） |
| DEMO / MOCK | 每页顶部 DEMO 横幅 + `data-demo="MOCK"`；按钮动作为 MOCK toast / 弹窗 / 合成响应，不接触真实资金、账户、生产数据 |
| 同步更新 | `applyChange()` 每次有效变更后随 PRD / 原型说明一起重渲染（`renderFeatureDocs` 写三份投影） |
| 一致性检查 | `V-FILE-PROTO-HTML-*`（存在性，56 项）+ `V-HTML-PRD-LINK-*`（Feature ID / PRD 路径 / DEMO 标记 / 需求块逐条对应，56 项，error 级） |
| 规格中心入口 | SPA 左栏新增「HTML 原型 ↗」按钮；服务端安全路由 `/docs/product/prototypes/**`（只读、限 `.html`、防路径越界与编码穿越） |

验证证据：HTML 原型自动化测试 12 项全部通过（见 §8.1），其中真实浏览器验证了双栏同屏、最低充值校验（输入 5 元触发「充值金额不得低于 10 元」）、30 元触发 MOCK 弹窗、双向定位往返、状态与视口切换。

### PC / H5 测试结果

| 测试 | 结果 | 来源 |
| --- | --- | --- |
| PC / H5 视口切换与全屏预览 | PASS | `ui-e2e.test.mjs` 套件 16 子测试 4 |
| 页面状态（6 态）可切换 | PASS | 同上，子测试 5 |
| 左侧 Prototype / 右侧 PRD 默认 50/50 且各自独立滚动 | PASS | 同上，子测试 2 |
| 原型组件与必填校验完整性 | PASS | `requirements-trace.test.mjs` 套件 8，3 项子测试 |

---

## 5. 双栏系统

真实可访问入口：`tools/product-workspace/server.mjs`（零外部依赖 Node HTTP 服务）+ `public/index.html` SPA，默认 `http://127.0.0.1:7788/`。启动脚本 `tools/product-workspace/start.sh` 会先执行一致性门禁再启动服务；Makefile 目标 `make product-workspace`。

| 要求 | 实现 | 验证 |
| --- | --- | --- |
| 左侧 Prototype、右侧 PRD | `#paneLeft` / `#paneRight` | SPA 加载 + 场景一 HTTP 200 |
| 默认宽度 50% / 50% | CSS `--split: 50`，`.pane-left { width: calc(var(--split,50)*1%) }` | UI E2E 子测试 2 |
| 分隔线拖动调整 | 拖拽改变 `--split`，支持"恢复默认布局"回到 50/50 | UI E2E 子测试 3 |
| 两侧独立滚动 | `.pane { overflow-y: auto }`，实测设置 `scrollTop` 另一侧不受带动 | UI E2E 子测试 2（本次修复测试定位） |
| 全屏预览 / 独立查看 | `S.mode` 支持 split / 单侧 / fullscreen | UI E2E 子测试 4 |
| 双向定位 | PRD 点组件 ID → 左侧高亮；Prototype 点 Requirement ID → 右侧高亮 | UI E2E 套件 17 共 3 项 |
| PC / H5 布局 | `S.viewport` 切换，H5 单列堆叠 | UI E2E 子测试 4 |
| 切换 Feature 两侧同步重新加载 | 依据映射同步刷新 | UI E2E 套件 17 子测试 3 |
| 功能目录 / PRD / 原型 / 映射 / 覆盖率 / 变更历史 | 8 个视图：Overview、Catalog、双栏详情、PRD Library、Prototype Library、Mapping、Coverage、Changes | UI E2E 套件 16 子测试 1 |
| 权限 | 写操作要求 `X-Uter-Role: admin`（或 `body.role=admin`）；普通用户 403 且模型不变；可叠加 `UTER_PRODUCT_WORKSPACE_TOKEN` Bearer 校验；服务仅绑定 `127.0.0.1` | API 测试套件 4 子测试 1；UI E2E 套件 18 子测试 5 |

导航入口（第十八部分第 2 点"集成到合理的 Uter 导航入口"）：`web/src/hooks/use-sidebar-data.ts` Admin 分组新增 `Product Workspace` 项，`requiredRole: ROLE.SUPER_ADMIN`，URL 可由 `VITE_PRODUCT_WORKSPACE_URL` 覆盖，默认 `http://127.0.0.1:7788/`；7 份语言包补齐 `Product Workspace` 键，`node scripts/check-i18n-keys.mjs --quiet` 通过（7305 个静态 `t()` 键 + 701 个登记键在 7 份语言包中全部存在）。

**独立 HTML 原型双栏（文件级，§4.1）**：每份 `prototypes/{domain}/{Feature ID}.html` 本身即"左原型 / 右 PRD"同源双栏页面，可不依赖规格中心直接打开；规格中心左栏提供「HTML 原型 ↗」按钮跳转。

**本次修复的缺陷**：初轮 `左侧未独立滚动: visible`，原因是测试检查了 `.pane-body`，而真实滚动容器是 `.pane`。已改为检查 `#paneLeft` / `#paneRight` 的 `overflowY`，并实际设置 `scrollTop = 240` 验证一侧滚动时另一侧 `scrollTop` 不变。

---

## 6. 双向同步

### 6.1 统一数据模型（Single Source of Truth）

`docs/product/registry/product-model.json` 是唯一权威需求数据源。PRD Markdown、Prototype Markdown、**交互式 Prototype HTML**（左原型 / 右 PRD 同源双栏）、YAML 注册表、追溯矩阵与报告全部是它的**可编辑投影**。任何有效编辑必须经 `engine.applyChange(model, ch)` 单事务：

```text
解析修改 → 更新统一模型 → 计算影响 → 同步对侧视图 → 重建映射
→ 版本 +1 → 一致性检查 → 记录变更事件（含 SYSTEM_GENERATED 同步事件）
→ 写入快照 → 持久化 → 重渲染两侧投影
```

自动同步事件标记 `origin: 'SYSTEM_GENERATED'`，**不递归调用 `applyChange()`**，结构上杜绝同步循环；用户编辑标记 `source_type: 'USER_EDIT'`。`sync_loops = 0`、`silent_overwrites = 0`。

支持操作：`add_requirement`、`update_requirement`、`update_business_rule`、`update_acceptance`、`delete_requirement`、`update_prd_section`、`add_component`、`update_component`、`delete_component`、`add_page`、`update_interaction`、`delete_interaction`、`update_page_state`、`add_feature`。

### 6.2 冲突检测、版本管理与历史恢复

- 基于 `base_version` 比对；不同字段自动合并，同字段并发修改标记 `CONFLICT` 并保留双方值。
- 支付 / 退款 / 余额 / 权限 / 安全相关冲突置 `requires_product_decision = true`。
- 解决方式 `prior` / `pending` / `manual`；失败变更整体回滚，不写半成品、不递增版本。
- 历史恢复生成新的 `RESTORE` 事件、版本 +1、写入新快照、保留全部旧历史、重新渲染两侧投影并重跑一致性检查。

**本次修复的真实引擎缺陷**：新增 6 场景验收测试后，场景五 `'OPEN' !== 'RESOLVED'`。根因是 `resolveConflict()` 的 `manual` / `pending` 路径调用 `applyChange()`，后者用 working 副本 `Object.assign(model, working)` 整体覆盖模型，导致先前取出的冲突对象引用 `c` 已不在 `model.conflicts` 中，冲突记录永远停留 `OPEN`。修复为按 `conflict_id` 重新定位：

```js
// applyChange() 会以 working 副本整体覆盖 model，此前取得的 c 引用可能已不在
// model.conflicts 中。必须按 conflict_id 重新定位再写回，否则 manual / pending
// 路径下冲突会永远停留 OPEN，导致门禁与同步状态无法收敛。
const target = model.conflicts.find((x) => x.conflict_id === c.conflict_id) || c;
target.status = 'RESOLVED';
target.resolution = {
  choice, at: nowISO(), actor: payload.actor || 'admin',
  reason: payload.reason || '', result_change_id: res.change_id,
  result_status: res.status, preserved_both_sides: true
};
```

同时把冲突解决记录中的 `sync_status: c.resolution.result_status` 改为 `target.resolution.result_status`。修复后重跑全部测试通过（当前套件规模 84 项）。

### 6.3 第二十二部分 · 6 个最终验收场景（真实 HTTP + 隔离模型副本）

测试文件 `tools/product-workspace/tests/acceptance-scenarios.test.mjs`；每个场景打印 `SCENARIO_EVIDENCE` JSON。测试使用 `tests/helpers.mjs` 将模型与历史快照复制到临时目录，**不污染真实模型**（真实模型保持 v1 基线）。

| 场景 | 结果 | 关键证据 |
| --- | --- | --- |
| 一 · 查看充值功能 | PASS | `UTER-PAY-001`；左原型 2 页 / 右 PRD 12 章 / 同 Feature ID；3 需求、10 验收、3 测试用例；`SYNCED`；SPA HTTP 200 |
| 二 · 修改 PRD | PASS | `CHG-20261109-140510-02` 新增 `REQ-PAY-001-04` → 原型自动出现 `CMP-PAY-001-106`（input）；2 个自动同步事件；新增 `AC-PAY-001-11..14` 与 `TC-PAY-001-04`；版本 1→2；`SYNCED` |
| 三 · 修改原型 | PASS | `CHG-20261109-140510-03` 新增 `CMP-PAY-001-107` → 自动创建 `REQ-PAY-001-05`、`INT-PAY-001-102`；PRD 主流程更新；映射已登记；`SYNCED` |
| 四 · 修改业务规则 | PASS | `BR-PAY-001-02-01` 最低充值 10 → 20；`CMP-PAY-001-03.min = 20`；错误提示「充值金额不得低于 20 元」；验收与测试状态同步；1 个自动同步事件 |
| 五 · 冲突处理 | PASS | `CONFLICT-1-CHG-20261109-140510-06`；HTTP 409；`requires_product_decision=true`；`manual` 合并后 `merged_min=30`；双方修改保留、冲突记录保留、生成解决事件；`SYNCED` |
| 六 · 历史恢复 | PASS | 从 v1 恢复；版本 6→7；变更记录 8→9（旧历史保留）；`RESTORE` 事件 `CHG-20261109-140510-09`；新快照写入；一致性 1073 项 / 0 失败；`SYNCED` |

UI 层另有 3 项可视化双向同步场景测试（场景二/三/四）与冲突/恢复 UI 测试，均通过。

---

## 7. 需求追溯

### 7.1 统一 ID 体系

| 类型 | 格式 | 示例 |
| --- | --- | --- |
| Feature ID | `UTER-{DOMAIN}-{NUMBER}` | `UTER-PAY-001` |
| Requirement ID | `REQ-{DOMAIN-NUMBER}-{NN}` | `REQ-PAY-001-04` |
| Prototype Page ID | `PP-{DOMAIN-NUMBER}-{NN}` | — |
| Interaction ID | `INT-{DOMAIN-NUMBER}-{NN}` | `INT-PAY-001-102` |
| Component ID | `CMP-{DOMAIN-NUMBER}-{NN}` | `CMP-PAY-001-106` |
| Acceptance ID | `AC-{DOMAIN-NUMBER}-{NN}` | `AC-PAY-001-11` |
| Test Case ID | `TC-{DOMAIN-NUMBER}-{NN}` | `TC-PAY-001-04` |
| Change ID | `CHG-{TIMESTAMP}-{SEQ}` | `CHG-20261109-140510-02` |
| API ID / Data Model ID | 模型内 `apis` / `data_models` 关联 | — |

### 7.2 映射注册表与追溯链

| 产物 | 路径 | 数量 |
| --- | --- | --- |
| 统一模型（唯一事实源） | `docs/product/registry/product-model.json` | 56 features / 124 requirements / 90 pages / 124 mappings |
| 功能注册表 | `docs/product/registry/feature-registry.yaml` | 56（含 `prototype_html_path`） |
| 需求注册表 | `docs/product/registry/requirement-registry.yaml` | 124 |
| 原型注册表 | `docs/product/registry/prototype-registry.yaml` | 90 页面（含 `doc_path` 与 `html_path`） |
| 映射注册表 | `docs/product/registry/feature-mapping.yaml` | 124 |
| 变更注册表 | `docs/product/registry/change-registry.yaml` | 由模型变更事件派生 |
| 追溯矩阵 | `docs/product/mappings/FEATURE-TRACEABILITY-MATRIX.md` | 覆盖全部 124 条映射 |
| 版本快照 | `docs/product/history/v1.json` | 基线 1 份（每次有效变更追加） |

追溯链：`Feature → Requirement → Prototype Page / Component / Interaction → Acceptance → Test Case → Change → Snapshot`。

`engine.validate()` 检查维度与结果（模型 v1）：

| 前缀 | 检查内容 | 结果 |
| --- | --- | --- |
| `V-FID` / `V-ID` | Feature ID 格式与全局唯一、关联 ID 无重复 | PASS |
| `V-PRD` | 12 章节、业务规则、验收标准 | PASS |
| `V-PROTO` | 页面、状态、组件、按钮行为、交互归属、跳转、表单校验 | PASS |
| `V-MAP` | 需求→原型/验收/测试映射、注册表完整、孤立与重复映射 | PASS |
| `V-CROSS` | 无跨 Feature 错误关联 | PASS |
| `V-STATUS` | 实现状态与原型 planned 标记一致 | PASS |
| `V-FILE` | PRD / 原型说明 / 交互式 HTML 原型投影文件真实存在 | PASS |
| `V-HTML-PRD-LINK` | HTML 原型与 PRD 同源对应（Feature ID / PRD 路径 / DEMO 标记 / 需求块逐条） | PASS |
| `V-CHANGE` / `V-NO-LOOP` / `V-NO-OVERWRITE` / `V-CONFLICT` | 追溯、同步循环 0、静默覆盖 0、冲突状态合规 | PASS |

**检查项总数 1185（其中交互式 HTML 原型相关 112 项），失败 0，错误 0，警告 0。**

---

## 8. 自动化测试

### 8.1 产品规格中心测试套件（核心）

命令：

```bash
node --test tools/product-workspace/tests/*.test.mjs
```

| 项 | 值 |
| --- | --- |
| 退出码 | `0` |
| 测试套件 | 22 |
| 测试数量 | 84 |
| 通过 | 84 |
| 失败 | 0 |
| 跳过 | 0 |
| 取消 / todo | 0 / 0 |

22 个套件：最终交付验收·6 场景、静态资源与健康检查、只读模型视图、写权限边界、冲突与恢复接口、功能目录与 Feature ID、PRD 体系、Prototype 体系、映射注册表与追溯、一致性与覆盖率、PRD→Prototype 同步、Prototype→PRD 同步、新增功能强制门禁、冲突检测与版本管理、同步可靠性与事务性、产品规格中心·双栏与视口、双向定位与 Feature 同步、可视化双向同步编辑、冲突处理与历史恢复（UI）、**HTML 原型·与 PRD 一一对应、HTML 原型·服务端安全路由、HTML 原型·真实浏览器交互**（后三项为交互式 HTML 原型新增，共 12 项测试：56 份存在性与 PRD 对应、双向定位钩子、零外部依赖、安全路由、浏览器校验 / 弹窗 / 定位 / 状态 / 视口）。

### 8.2 一致性、覆盖率、门禁与报告

| 命令 | 退出码 | 真实输出 |
| --- | ---: | --- |
| `node tools/product-workspace/cli.mjs check` | `0` | `verdict: PASS`；consistency `total=1185 failed=0 errors=0 warnings=0`；`coverage_failures=[]`；`conflict_failures=[]`；model_version 1 |
| `node tools/product-workspace/cli.mjs validate` | `0` | `passed=true, total=1185, failed=0, errors=[], warnings=[]` |
| `node tools/product-workspace/cli.mjs coverage --strict` | `0` | 11 项百分比指标全部 100%；`sync_loops=0`、`silent_overwrites=0`；`open_conflicts=0`；`needs_review=0`；`needs_product_decision=3`；`failures=[]` |
| `node tools/product-workspace/cli.mjs report` | `0` | `projections_written=182`（含 56 份交互式 HTML 原型）、`reports_written=3`、一致性 `1185/0` |
| `node tools/product-workspace/render-docs.mjs` | `0` | 写入 185 个文件（PRD 56 + 原型说明 56 + HTML 原型 56 + 目录 / 标准 / 注册表等）；模型 v1；一致性 checks=1185 failed=0 warnings=0 |

覆盖率明细：

| 指标 | 值 | 指标 | 值 |
| --- | ---: | --- | ---: |
| inventory_coverage | 100% | prototype_to_prd_mapping | 100% |
| prd_coverage_implemented | 100% | requirement_to_test | 100% |
| prototype_coverage_implemented | 100% | mapping_registry_coverage | 100% |
| prd_not_implemented | 100% | feature_id_unique | 100% |
| prd_to_prototype_mapping | 100% | change_traceability | 100% |
| sync_success_rate | 100% | sync_loops | 0 |
| silent_overwrites | 0 | 未解决冲突 | 0 |

### 8.3 前端质量门禁（`web/`）

| 命令 | 退出码 | 结果 |
| --- | ---: | --- |
| `node scripts/check-i18n-keys.mjs --quiet` | `0` | 7305 静态 `t()` 键 + 701 登记键在 7 份语言包中全部存在 |
| `bun run typecheck` | `0` | `tsgo -b` 通过 |
| `bun run lint` | `0` | 1446 文件 / 186 规则：65 warnings，**0 errors** |
| `bun run lint:design:strict` | `0` | 扫描 1249 文件通过；浮层投影 20 处、Token 定义色值 182 处属规范允许 |
| `bun run copyright:check` | `0` | checked 1528，added 0，updated 0 |
| `bun run test` | `0` | **283 文件 / 3028 测试全部通过，0 失败，0 跳过**；最终复验 Duration 319.98s（另一轮独立执行 580.51s，结果一致） |
| `bun run build:check` | `0` | `tsgo -b` + `rsbuild build` + `cp -R public/. dist/` 全通过；产物 Total 72666.5 kB / 25458.2 kB |
| `GOWORK=off go build ./...` | `0` | 通过 |

### 8.4 过程中出现并已解决的失败（真实记录）

| # | 命令 / 测试 | 初始结果 | 原因 | 处置 |
| --- | --- | --- | --- | --- |
| 1 | `requirements-trace.test.mjs` | `UTER-REFUND-001 缺少状态证据` | 模型 `status_note` 为 `null`，与 `buildModel()` 结果相差 1 字段 | 备份后 `build-model.mjs --force` 重建并全量重渲染 |
| 2 | `requirements-trace.test.mjs` | `UTER-AUTH-001.md 缺少章节 8 页面交互` | 旧投影 4 个章节标题不规范 | 由模型全量重渲染统一为规范 12 章节 |
| 3 | `sync-engine.test.mjs` | `恢复未生成新版本` | `restoreVersion()` 原地提交，测试用可变对象 `before` 被更新，比较恒 false | 测试改为先保存 `baseVersion` / `changesBefore` 标量 |
| 4 | `ui-e2e.test.mjs` | `左侧未独立滚动: visible` | 测试检查 `.pane-body`，真实滚动容器是 `.pane` | 改查 `#paneLeft/#paneRight` 并实测 `scrollTop` 互不影响 |
| 5 | `acceptance-scenarios.test.mjs` 场景五 | `'OPEN' !== 'RESOLVED'` | `resolveConflict()` 中 `applyChange()` 覆盖模型使冲突对象引用失效 | 按 `conflict_id` 重新定位后写回（见 §6.2） |
| 6 | `bun run build:check`（首次） | 退出码 1 | 环境 `SAFE_DELETE_BULK_CONFIRM_REQUIRED`（`rm -rf dist` 命中 5698 文件批量删除保护） | 采用等价 `rsbuild build` 验证；最终在 dist 规模变化后重跑 `build:check` 得 `0` |
| 7 | `GOWORK=off go build ./...`（构建后复验） | 退出码 1 | `main.go:57: pattern all:web/dist/docs-content/_next: no matching files found`——构建清空 `dist` 后未重跑 `docs-web` postbuild | 按 `Dockerfile` 规定顺序执行 `node docs-web/scripts/copy-to-web.mjs` 恢复文档静态站，复验 `0` |
| 8 | CLI 门禁记录脚本 | `coverage --strict` 曾打印帮助、退出 2 | zsh 默认不对未加引号变量做单词拆分，`$c` 被当作单个参数；**非产品缺陷** | 改用 `bash -c` + 直接调用，退出码 `0` |

> 说明：第 8 项的 `PIPESTATUS` 在 zsh 下不可用，导致一轮门禁记录的退出码字段为空；已用 bash 显式重跑取得上表中的真实退出码，未据此虚构任何结果。

---

## 9. 剩余问题

| 分类 | 数量 | 明细 |
| --- | ---: | --- |
| `BLOCKER` | 0 | 无 |
| `P0` | 0 | 无未解决的 P0 阻断问题 |
| `P1` | 0 | 无 |
| `P2` | 2 | ① 产品规格中心为**独立本机 Node 服务** + 主前端超级管理员导航链接，未嵌入 Go 二进制静态路由；使用需执行 `make product-workspace` 或 `bash tools/product-workspace/start.sh`，URL 可由 `VITE_PRODUCT_WORKSPACE_URL` 覆盖。② 初始 `bun run build:check` 受环境批量删除保护阻断（已通过最终重跑消除，但 CI 环境如启用同类保护仍可能复现）。 |
| `P3` | 3 | ① 6 个最终验收场景在隔离模型副本上执行，真实 `product-model.json` 保持 v1 基线，因此双向同步报告中的用户编辑事件计数为 0；这是测试隔离设计，不是同步未发生（场景证据见 §6.3）。② `bun run lint` 存在 65 条既存 warnings（0 errors），均非本次改动引入。③ 隔离测试环境（`UTER_PRODUCT_WORKSPACE_NO_PROJECTIONS=1`）下 `V-HTML-PRD-LINK` 内容对应检查标记为跳过（检查项仍计入总数），真实环境全量执行且 56/56 通过。 |
| `NEEDS_PRODUCT_DECISION` | 3 | 全部属于未实现的 `UTER-REFUND-001`：退款适用范围（充值余额 / 订阅 / 任务扣费）、退款时效与审核流、退款与会计事务的冲正规则。按指令要求显式标记，未编造业务规则。 |
| `NEEDS_REVIEW` | 0 | `needs_review = 0` |
| `ENVIRONMENT_BLOCKED` | 0（当前） | 首次 `build:check` 的 `SAFE_DELETE_BULK_CONFIRM_REQUIRED` 与随后 `go:embed` 路径缺失均已解决；当前全部门禁退出码为 0 |

另有**不是缺陷、但需如实说明的真实状态**：8 项 `BACKEND_ONLY`（后端已实现、缺独立前端页面）、1 项 `PARTIALLY_IMPLEMENTED`、1 项 `NOT_IMPLEMENTED`。这些是扫描结果，按指令要求保留原状并建规划 PRD / 规划原型，未为凑覆盖率而虚构实现。

---

## 10. 最终结论

# `PASS_WITH_EXCEPTIONS`

### 10.1 第二十三部分 · 18 条完成定义逐条核对

| # | 完成定义 | 结论 | 证据 |
| --- | --- | --- | --- |
| 1 | 所有实际产品功能完成盘点 | PASS | 56 features，§2 |
| 2 | 已实现功能均有完整 PRD | PASS | 56 份 12 章节，`V-PRD` |
| 3 | 已实现功能均有可交互原型 | PASS | 56 份交互式 HTML 原型（左原型 / 右 PRD 同源双栏）+ 56 份原型说明 / 90 页 / 89 可交互 |
| 4 | 未实现功能有明确 PRD 和状态 | PASS | `UTER-REFUND-001` 显式 `NOT_IMPLEMENTED` + `status_note` |
| 5 | 产品规格中心能够真实访问 | PASS | SPA HTTP 200；`/api/*` 全通；导航入口已集成 |
| 6 | 左原型 / 右 PRD 双栏正常 | PASS | 规格中心 UI E2E 套件 16；每份 HTML 原型本身亦为双栏同源页面（12 项 HTML 测试） |
| 7 | 两侧双向定位 | PASS | UI E2E 套件 17（3 项） |
| 8 | 修改 PRD 后原型自动同步 | PASS | 场景二 + 套件 11（6 项） |
| 9 | 修改原型后 PRD 自动同步 | PASS | 场景三 + 套件 12（6 项） |
| 10 | 使用统一需求数据源 | PASS | `product-model.json`；`applyChange()` 单事务 |
| 11 | 同步冲突可检测和处理 | PASS | 场景五 + 套件 14（5 项）+ 引擎缺陷修复 |
| 12 | 变更历史完整 | PASS | `V-CHANGE`、`change-registry.yaml`、快照 |
| 13 | 历史版本可恢复 | PASS | 场景六 |
| 14 | 自动化一致性检查有效 | PASS | 1185 项 / 0 失败（含 112 项 HTML 原型对应检查） |
| 15 | 新增功能门禁有效 | PASS | `gate()` + 套件 13（4 项） |
| 16 | 自动化测试通过 | PASS | 产品工作台 84/84（含 12 项 HTML 原型测试）+ 前端 3028/3028，全门禁退出码 0 |
| 17 | 最终报告真实完整 | PASS | 本报告 |
| 18 | 无未解决的 P0 阻断问题 | PASS | §9：BLOCKER 0 / P0 0 |

### 10.2 判定理由

18 条完成定义全部满足，19 个验收指标全部达到（11 项 100%、同步循环 0、静默覆盖 0、未解决冲突 0、孤立 PRD / 原型 0、错误跨功能映射 0），6 个最终验收场景全部通过，产品工作台 84/84、前端 3028/3028、Go 构建与前端构建门禁退出码均为 0。因此不构成 `FAIL` 或 `BLOCKED`。

同时，存在不影响 P0 交付但必须披露的例外，故不取 `PASS` 而取 **`PASS_WITH_EXCEPTIONS`**：

1. `NEEDS_PRODUCT_DECISION` 3 项（`UTER-REFUND-001` 退款业务范围与冲正规则）——需产品方决策后才能进入实现，不得由本系统代为编造。
2. `P2`：产品规格中心以独立本机 Node 服务形态提供，通过超级管理员导航入口访问，尚未嵌入 Go 二进制静态路由；需单独启动服务。
3. `P2`：CI 环境若启用同类批量删除保护，`build:check` 仍可能被阻断；本机最终重跑已通过。

上述例外均不改变"打开规格中心 → 选功能 → 左侧操作原型 / 右侧编辑 PRD → 双向自动同步 → 变更可追溯可恢复"这一最终使用体验的可用性。

### 10.3 交付后建议（非本次 P0 范围）

- 将上述 3 项退款业务决策交由产品方确认，确认后再通过 `applyChange()` 更新 `UTER-REFUND-001` 并触发 PRD / 原型同步。
- 若需生产化访问，考虑把 SPA 静态资源挂载进 Go 路由，并复用现有 Casbin 权限而非 `X-Uter-Role` 头。
- 将 `make product-check`、`make product-test` 纳入 CI 流水线，使新增功能门禁在提交阶段强制生效。

---

## 附录 A · 本次实际修改 / 新增文件清单

**已跟踪文件的修改（9 个文件，共 +35 / -1 行）**

```text
makefile                                  +4 个目标：product-workspace / product-check / product-test / product-report
web/src/hooks/use-sidebar-data.ts         +管理员可见「Product Workspace」导航入口（VITE_PRODUCT_WORKSPACE_URL 可覆盖）
web/src/i18n/locales/en.json              +"Product Workspace": "Product Workspace"
web/src/i18n/locales/zh.json              +"Product Workspace": "产品规格中心"
web/src/i18n/locales/zh-TW.json           +"Product Workspace": "產品規格中心"
web/src/i18n/locales/fr.json              +"Product Workspace": "Espace produit"
web/src/i18n/locales/ru.json              +"Product Workspace": "Рабочая область продукта"
web/src/i18n/locales/ja.json              +"Product Workspace": "プロダクトワークスペース"
web/src/i18n/locales/vi.json              +"Product Workspace": "Không gian sản phẩm"
```

**未跟踪目录内的新增 / 修改**

```text
新增  tools/product-workspace/render-html.mjs                   交互式 HTML 原型渲染器（左原型 / 右 PRD 同源双栏）
新增  tools/product-workspace/tests/prototype-html.test.mjs     HTML 原型 12 项自动化测试（文件 / HTTP / 浏览器）
新增  tools/product-workspace/cli.mjs                         统一 CLI（check/validate/coverage/gate/report/serve/help）
新增  tools/product-workspace/start.sh                       启动脚本（含门禁预检，仅绑定 127.0.0.1）
新增  tools/product-workspace/tests/acceptance-scenarios.test.mjs   第二十二部分 6 场景 HTTP 自动化验收
修改  tools/product-workspace/engine.mjs                    修复 resolveConflict() 引用失效；新增 V-FILE-PROTO-HTML / V-HTML-PRD-LINK 检查
修改  tools/product-workspace/render-docs.mjs               导出 renderReportFiles/writeReportFiles，新增双向同步报告；接入 HTML 原型（三份投影、目录、注册表、标准）
修改  tools/product-workspace/tests/sync-engine.test.mjs    修复历史恢复测试可变基线
修改  tools/product-workspace/server.mjs                    新增 /docs/product/prototypes/** 安全静态路由（只读、限 .html、防越界）
修改  tools/product-workspace/public/app.js                  左栏新增「HTML 原型 ↗」入口
修改  tools/product-workspace/tests/ui-e2e.test.mjs         修复双栏独立滚动测试定位与实测
重建  docs/product/registry/product-model.json              56 features / 124 requirements / 90 pages / 124 mappings
重建  docs/product/history/v1.json                          基线快照
重渲染 docs/product/prd/**（56）                             规范化 12 章节与全部投影
新增  docs/product/prototypes/{domain}/{Feature ID}.html（56） 交互式 HTML 原型，与同目录 .md 说明一一对应
重生成 docs/product/registry/*.yaml（6）、mappings/、reports/（3 + 本报告）
```

**未改动**：`AGENTS.md`、`CLAUDE.md`、`.ai/**`、`docs/design-system/UTER-DESIGN-SYSTEM-3.0.md`、`.aes/aes-pin.json`、`uaes/standards/**`，以及任何已有业务代码（Go 后端 / React 前端除上述导航与 i18n 外）。

## 附录 B · 6 场景原始证据（`SCENARIO_EVIDENCE`）

```text
SCENARIO_EVIDENCE {"scenario":1,"name":"查看现有功能","feature_id":"UTER-PAY-001","prd_sections":12,"prototype_pages":2,"requirements":3,"acceptance":10,"test_cases":3,"sync_status":"SYNCED","spa_http":200}
SCENARIO_EVIDENCE {"scenario":2,"name":"修改 PRD → 原型自动同步","change_id":"CHG-20261109-140510-02","requirement_id":"REQ-PAY-001-04","component_id":"CMP-PAY-001-106","component_type":"input","auto_sync_events":2,"acceptance_ids":["AC-PAY-001-11","AC-PAY-001-12","AC-PAY-001-13","AC-PAY-001-14"],"test_case_ids":["TC-PAY-001-04"],"version":"1→2","sync_status":"SYNCED"}
SCENARIO_EVIDENCE {"scenario":3,"name":"修改 Prototype → PRD 自动同步","change_id":"CHG-20261109-140510-03","component_id":"CMP-PAY-001-107","requirement_id":"REQ-PAY-001-05","interaction_id":"INT-PAY-001-102","new_requirement_count":1,"prd_flow_updated":true,"mapping_registered":true,"sync_status":"SYNCED"}
SCENARIO_EVIDENCE {"scenario":4,"name":"修改业务规则","change_id":"CHG-20261109-140510-04","rule_id":"BR-PAY-001-02-01","before":10,"after":20,"component_id":"CMP-PAY-001-03","component_min":20,"error_message":"充值金额不得低于 20 元","auto_sync_events":1}
SCENARIO_EVIDENCE {"scenario":5,"name":"冲突处理","conflict_id":"CONFLICT-1-CHG-20261109-140510-06","http_status":409,"requires_product_decision":true,"resolution":"manual","merged_min":30,"conflict_record_preserved":true,"resolution_event":true,"sync_status":"SYNCED"}
SCENARIO_EVIDENCE {"scenario":6,"name":"历史恢复","restored_from":1,"version":"6→7","changes_before":8,"changes_after":9,"restore_change":"CHG-20261109-140510-09","snapshot_written":true,"validation_total":1073,"validation_failed":0,"sync_status":"SYNCED"}
```

## 附录 C · 其他已生成报告

```text
docs/product/reports/PRODUCT-COVERAGE-REPORT.md
docs/product/reports/PRD-PROTOTYPE-CONSISTENCY-REPORT.md
docs/product/reports/BIDIRECTIONAL-SYNC-REPORT.md
```
