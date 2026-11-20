# UTER 统一上游模型与价格体系整改执行报告

- 执行对象：Qoder
- 分支：`main`（未创建分支/PR）
- 基准提交：`5128c53e08dc1851786703df2c6d6aabb11e5b0f`
- 最终提交：`54a41c9ef`（代码与 UAP 证据提交；后续仅格式化/证据提交不再改动行为）
- 执行日期：2026-11-20
- 最终状态：**IMPLEMENTED_WITH_EXTERNAL_BLOCKERS**

> 本报告只记录实际执行过的命令与结果。未执行或环境不满足的项目在“未完成事项”中逐条列出，不以文档或接口可访问冒充通过。

---

## 1. 执行摘要

| 项目 | 结果 |
| --- | --- |
| 基准 SHA | `5128c53e0` |
| 分支 | `main` |
| 数据库迁移 | 1 个：渠道价格身份从 `(channel, model)` 升级为 `(channel, provider, region, deployment, model)` |
| 完成的 Phase | 0、1、2、3、4（Uter 可计费维度）、5（等价实现）、6、7、8（真实百炼闭环）、9、10、11、12 |
| 未完成项 | 见第 5 节，主要是供应商采购价无授权接口/凭据、8 个 DreamRouter 视频模型上游只发布 ratio |

本轮在基准之上完成的提交：

| 提交 | 内容 |
| --- | --- |
| `7897888b6` | 后端：统一价格分层、身份迁移、供应商适配、同步/批量、计费修复（42 文件） |
| `9977d9389` | 前端：渠道定价工作台、百炼面板、定价页筛选（27 文件） |
| `5798da115` | 版本 `v1.6.39` |
| `845d62b2d` | 账单快照记录渠道定价模式 |
| `d609cb853` | Apiko 渠道 + 百炼同步后自动售价（30 文件） |
| `818d6bc2d` | 版本 `v1.6.40` |
| `700f629e4` | Apiko 渠道默认 Base URL 与必填校验 |
| `c9905236a` | 百炼目录价格来源收敛与旧价格重放 |
| `02d994a9e` | 清理未使用符号，复用 DreamRouter URL 常量 |
| `99e365e20` | oxfmt 统一渠道/定价页格式 |
| `54a41c9ef` | UAP doctor/validate 与质量门禁证据 |
| `c80e860ba` | 百炼组件价格/更多价格类型；Apiko 同步返回跳过原因 |
| `e205dab65` | 百炼品牌图标、渠道深色 Logo 与同步跳过原因 UI |
| `230a06109` | 版本 `v1.6.41` |
| `e51627de2` | 渠道品牌名称与 Logo 的服务端校验 |
| `a128ee1b9` | 价格同步页导入顺序修正 |

> 报告提交本身在其后追加，不再包含代码变更。

---

## 2. 功能实现与代码位置

### 2.1 统一价格数据模型（Phase 1）

- `model/channel_model_pricing.go`
  - `OfficialPricing`：上游原始负载，原样保留。
  - `NormalizedPricing`：归一化官方视图（币种、汇率、单位、阶梯、采购价、折扣组、审核原因）。
  - `InternalPricing`：运营销售价（按 1M token / 按次 / 按秒 / 按分钟 / 阶梯表达式），并记录来源（手动、同步派生、批量、回滚）。
  - `PricingVersion`：行内容 sha256；`PricingSource`、`FetchedAt`、`UpdatedAt` 可追溯。
- 三类价格不共用字段、不互相覆盖；官方同步永不自动把官方价当成售价（百炼自动配置是独立、显式的销售价写入，见 2.3）。

### 2.2 模型身份与迁移（Phase 2）

- 唯一键：`(channel_id, provider, region, deployment_id, model_name)`。
- `model/channel_model_pricing_migration.go`：启动时先按新身份合并重复行（保留已配置/最新行），再删除旧 `idx_channel_model_pricing`，由 AutoMigrate 建立新唯一索引；`model/main.go` 中作为启动硬门禁执行。
- 解析入口 `GetChannelModelPricing` 在多个身份共存时优先返回已配置行，其次最新同步身份；`SetChannelInternalPricing` / 版本校验写入 / 官方视图更新均定位同一行。
- 同步 Upsert 按完整身份匹配，并兼容升级旧的无身份行（补写 provider/region/deployment，不产生重复行）。
- 三库迁移测试：`model/channel_pricing_multidb_test.go`，SQLite、MySQL 8.0、PostgreSQL 16 全部通过（含二次迁移幂等、旧索引移除、旧数据保留、区域/部署隔离）。

### 2.3 供应商适配与识别安全（Phase 3）

- `service/upstream_provider.go`：适配器注册表；DreamRouter、百炼、Apiko（公开控制面目录）可拉取；OpenAI、Anthropic、Gemini、Azure、AWS、腾讯、火山明确声明 MANUAL_ONLY，不伪造同步。
- `service/upstream_capability.go`：按渠道类型/官方 host 返回逐维度能力矩阵（token/图片/视频/音频/按次/按秒/按分钟/部署/阶梯/地区/计划同步）；Apiko 依据公开目录声明为可同步。
- `service/upstream_host.go`：严格 hostname 匹配（exact 或 `.domain` 后缀，拒绝 `dreamrouter.ai.evil.example` 一类仿冒）；上游请求校验 http(s)、禁止内嵌凭据、屏蔽云元数据地址（169.254.169.254、metadata.google.internal、100.100.100.200、link-local）、重定向最多 3 次且禁止换 host，解析后再次校验（DNS rebinding 缓解）。
- DreamRouter：公开 `/api/pricing` + 折扣组 + 阶梯表达式；修复上游把 `(…duration…) * x` 改为裸 `duration * x` 导致的解析失败（`service/dreamrouter_pricing_expr.go`）。
- 百炼：原生 `/api/v1/models` 分页目录，保留人民币原值、显式记录 `FXRateToUSD` 与 `CurrencyInferred` 后换算美元；区域由 workspace/区域 host 判定。

### 2.4 计价维度与批量定价（Phase 4）

- `service/channel_batch_pricing.go`
  - 规则：折扣、乘数、加价、加价率、固定价、不修改、仅空价、仅变化。
  - 维度：`input`、`output`、`cache_read`、`cache_write`、`per_call`、`per_second`、`per_minute`。
  - 预览返回官方价、采购价、当前售价、新售价、变化比例、预计毛利/毛利率、跳过与审核原因；支持版本冲突检测（`ExpectedVersions`）与手动价保护（`OverwriteManual`）。
  - 空输入不会解释为 0；非法/负数/非有限值直接拒绝。
- 阶梯/时段/媒体/部署价格在官方视图中完整保留（`ChannelPricingTier`、`ChannelPriceTiers`、`ChannelOfficialPricing.PerUnitUSD`），不强行折算成 token 价；无法表示为单一金额的形状标记 `needs_review`。
- 批次执行记录、审计与历史：`service/channel_pricing_audit.go`、`model/channel_pricing_history.go`、`model/channel_pricing_review.go`。

### 2.5 B2B / C 端差异定价（Phase 5，等价实现）

- 复用既有体系，未另造身份系统：用户组倍率（B2B/C 分组）、模型倍率、渠道价、用户月度消费分层价。
- 优先级（高 → 低）：用户分层价 × 渠道价（客户/渠道合同）→ 组倍率 → 模型默认价；`setting/custom_pricing/channel_price.go` 的 `EffectiveMultiplier` 是唯一入口，预扣、实时补扣、任务结算共用。
- 历史账单不因价格修改而变化：消费日志写入当时的价格版本、模式、倍率与单价（见 2.7）。

### 2.6 渠道流程与定价 UI（Phase 6）

- 渠道抽屉内嵌 `ChannelPricingPanel` 与 `BailianChannelPanel`：模型搜索/多选/按价格状态筛选、按维度批量规则、服务端预览、差异/毛利/审核提示、执行与回滚入口。
- 百炼创建后自动执行：目录拉取 → 模型对齐 → 官方价落库 → 无售价模型自动配置渠道售价（保留手动价），每一步独立记录状态，失败不影响已创建的渠道。
- 定价页支持供应商/模型类型/价格状态筛选、多渠道报价；打开抽屉/弹窗时隐藏悬浮客服入口。

### 2.7 同步生命周期与计费闭环（Phase 7–8）

- 同步：快照、版本、差异历史、按渠道的同步锁、计划任务、失败重试；一次失败不清空已有有效价格。
- 计费：`relay/helper/price.go` 统一解析渠道价与上游价；任务按秒/按分钟走 `relay/relay_task.go`；预扣与结算使用同一 `EffectiveMultiplier`。
- 账单快照（`service/log_info_generate.go`、`service/task_billing.go`）：`channel_pricing_version`、`channel_pricing_mode`、`channel_pricing_model_ratio`、`channel_pricing_completion_ratio`、`channel_pricing_cache_ratio`、`channel_pricing_model_price`、`channel_pricing_use_price`，以及使用量、quota、渠道与分组。

---

## 3. 供应商验证结果

| 供应商 | 模型发现 | 官方价格 | 采购价 | 维度 | 结果 | 真实/模拟 |
| --- | --- | --- | --- | --- | --- | --- |
| DreamRouter | 公开接口可用 | 公开 `/api/pricing` | 折扣组可解析；账户采购价无授权接口 | token/缓存/按次/按秒/阶梯/时段 | 86 个模型中 78 个解析出绝对价；8 个仅 ratio | 真实线上拉取 |
| 阿里云百炼 | `/api/v1/models` 分页 | 原生目录含价格（人民币，按区域） | workspace 合同价无接口，需人工 | token/缓存/按次/按秒/阶梯/多档 | 379 个模型；真实请求走通并正确计费 | 真实线上拉取 + 真实请求 |
| Apiko | 渠道 `/v1/models` 与控制面目录 | 公开控制面 `https://apiko.app/api/public/models?billing=all`（免密钥，USD） | 合同价需人工 | token/上下文阶梯/按次；分辨率或时长档跳过并给出原因 | 68 个模型实拉成功，价格转为计费表达式 | 真实线上拉取 |
| OpenAI/Anthropic/Gemini/Azure/AWS/腾讯/火山 | 使用各自渠道适配 | 无供应商价格 API | 人工 | 按渠道类型通用 | 声明 MANUAL_ONLY | 不适用 |

DreamRouter 仅 ratio、无绝对价的 8 个模型（2026-11-20 线上数据）：
`doubao-seedance-2-0-260128`、`doubao-seedance-2-5-260628`、`seedance-2.0`、`seedance-2.0-ab`、`seedance-2.0-fast`、`seedance-2.0-mini`、`seedance-2.5`、`seedance-2.5-ab`。
它们的 `PriceStatus` 为 `RATIO_ONLY_NO_ABSOLUTE_PRICE`，原始 ratio、billing_expr、端点类型完整保留，不做猜测换算。

### 3.1 真实计费闭环证据（百炼渠道）

在隔离栈（生产库只读副本，后端 :3100）中以现有百炼渠道完成一次真实请求：

- 渠道：#31，workspace 百炼，模型 `qwen4-max`。
- 配置的渠道售价：输入 `$0.4 / 1M`，输出 `$0.8 / 1M`（`per_1m_token`）。
- 上游响应：`prompt_tokens=28`，`completion_tokens=8`，HTTP 200。
- 消费日志：`quota=9`，`admin_info` 包含
  `channel_pricing_mode=per_1m_token`、`channel_pricing_model_ratio=0.2`、
  `channel_pricing_completion_ratio=2`、`channel_pricing_version=<sha256>`、
  `channel_pricing_use_price=false`，与
  `(28 + 8×2) × 0.2 = 8.8 → 9` 的取整结果一致。
- 同库中 DreamRouter 渠道（#32）的历史消费日志也记录了模型倍率与缓存倍率，说明多渠道价格互不覆盖。

---

## 4. 测试结果（实际命令与结果）

### 4.1 后端

| 门禁 | 命令 | 结果 |
| --- | --- | --- |
| 构建 | `go build ./...` | 通过 |
| 静态检查 | `go vet ./...` | 通过 |
| 全量测试 | `UTER_TEST_MYSQL_DSN=... UTER_TEST_POSTGRES_DSN=... go test ./... -count=1` | 通过（57 个包 ok，0 FAIL） |
| Race | `go test -race ./model/ -run 'TestChannelPricing…'` 等 4 组 | 全部通过 |
| 三库迁移 | `TestChannelPricingTablesAcrossDatabases`、`TestChannelPricingIdentityMigrationAcrossDatabases` | SQLite / MySQL 8.0 / PostgreSQL 16 全部通过 |
| DreamRouter 表达式 | `go test ./service/ -run TestDreamRouter` | 通过（含裸 duration 解析/缩放回归） |
| 全量测试（最终提交） | 同上命令重跑 | 通过（57 个包 ok，0 FAIL） |
| UAP 诊断 | `./uap doctor` | 组件全部 ok，恢复演练 SUCCEEDED |
| UAP 校验 | `./uap validate --all` | **32/32 validators passed** |
| 统一门禁 | `./scripts/verify-all.sh --quick` | 9 项通过、0 失败（Go 测试/前端测试/构建按设计跳过） |
| GolangCI（新增问题门禁） | `golangci-lint run --new-from-rev 5128c53e0 ./...` | **0 issues**；全量 123 项均为基准提交已存在的历史问题 |

### 4.2 前端

| 门禁 | 命令 | 结果 |
| --- | --- | --- |
| 类型检查 | `bun run typecheck` | 通过 |
| Lint / i18n | `bun run lint` | 0 errors / 0 warnings；i18n:check 通过 |
| 设计系统 | `bun run lint:design:strict` | 通过 |
| 版权头 | `bun run copyright:check` | 通过（新增 0） |
| 构建 | `bun run build:check` | 通过 |
| 全量测试 | `bun run test` | **312/312 文件、3182/3182 用例全部通过**（首轮曾出现 1 例并发超时，单独重跑与最终全量重跑均通过） |
| 定价相关套件 | `bunx vitest run src/features/channels src/features/pricing src/features/system-settings/billing src/features/models` | 58 文件 / 755 例全部通过 |

---

## 5. 未完成事项与外部限制

1. **采购价（BLOCKED_BY_MISSING_CREDENTIALS）**
   - 除 DreamRouter 公开折扣组外，各供应商不提供可用渠道凭据调用的“账户合同价”接口；OpenAI/Anthropic/Gemini/Azure/AWS/腾讯/火山按 MANUAL_ONLY 处理；Apiko 官方目录价可同步，但合同采购价仍需人工，销售价由运营确认。
   - 影响：无法自动计算“账户专属采购成本”；系统明确标记而不是猜测。
2. **DreamRouter 8 个视频模型仅发布 ratio**
   - 上游无绝对价、无表达式，系统保留原始 ratio 并标记 `RATIO_ONLY_NO_ABSOLUTE_PRICE`；不按 token 价强行换算。
3. **同步任务状态**
   - 复用现有 `SystemTask`（pending/running/succeeded/failed）与同步锁；部分成功的细分结果记录在任务 State 与百炼分步状态中，未新增独立的 `PARTIAL_SUCCESS`/`CANCELLED` 枚举。
4. **计价维度边界的显式声明**
   - Uter 不提供按字符/按像素计费的请求链路，因此这两个维度在能力矩阵中声明为不支持，而不是错误地折算成 token；图片/视频/音频的可计费形态通过按次、按秒、按分钟与阶梯表达式覆盖。
5. **环境性未执行**
   - 未执行视觉回归（`test:visual` / `test:visual:e2e` 为本地专用、非 CI 门禁）。
   - 本地已安装 `golangci-lint v2.15.0` 并执行全量与新增问题检查（新增 0）。

---

## 6. 最终状态

**IMPLEMENTED_WITH_EXTERNAL_BLOCKERS**

理由：代码、迁移、前后端、真实百炼计费闭环与质量门禁均已完成并通过；剩余缺口全部来自供应商不提供授权价格接口/采购合同数据，或上游只发布 ratio 的客观限制，且系统对这些情况均给出明确状态而非静默处理。