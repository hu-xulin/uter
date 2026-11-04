# ARCHITECTURE-STANDARD
# Uter 系统架构规范

**项目：** Uter  
**文档类型：** 系统架构与模块设计标准  
**适用范围：** 后端、前端、Go Modules、AI Relay、数据库及基础设施  
**规范级别：** 强制执行

---

## 1. 规范目标

建立稳定、清晰、可扩展、可维护的系统架构。

AI 必须理解现有架构后再进行修改，不得为了实现单项功能而破坏整体架构。

## 2. 架构基本原则

### 2.1 单一职责

每个模块必须具有清晰的职责。

不得将不相关的业务逻辑集中到一个模块中。

### 2.2 高内聚、低耦合

模块内部职责应保持一致。

模块之间通过明确接口协作，避免直接依赖其他模块的内部实现。

### 2.3 依赖方向明确

必须建立合理的依赖方向。

禁止：

- 循环依赖。
- 不必要的跨层调用。
- 业务模块直接操作不属于自己的内部状态。
- 为方便开发绕过公共接口。
- 将基础设施细节扩散到业务层。

### 2.4 遵循现有技术栈

新增实现必须优先遵循仓库已有技术选型。

更换框架、数据库、状态管理或核心组件必须进行影响分析。

## 3. 架构事实来源

AI 必须从真实仓库确认：

- 实际目录结构。
- 实际 Go Modules。
- 实际前端框架。
- 实际数据库。
- 实际缓存。
- 实际消息或任务机制。
- 实际部署方式。
- 实际 API 入口。
- 实际依赖关系。

不得将规划中的架构误认为已经实现的架构。

## 4. 模块边界

每个模块必须明确：

- 模块名称。
- 模块职责。
- 对外接口。
- 内部实现。
- 数据所有权。
- 依赖模块。
- 被依赖模块。
- 测试边界。

模块之间不得随意共享可变内部状态。

## 5. 后端分层（以实际代码为准）

Uter 实际分层为 **router → middleware → controller → service → model**，另有独立的 relay/、relaykit/、pkg/jsplugin。**不设独立 Domain 层与 Repository 层**：`model/` 同时承担 ORM 模型与数据访问，禁止为了形式化分层再抽出一层。

各层职责以真实代码为准：

### router/（路由装配层）

只做「路径 → 中间件 → controller 函数」装配，不含业务逻辑。引擎级入口 `router/main.go`（SetRouter）按域拆分：SetApiRouter / SetDashboardRouter / SetRelayRouter / SetTaskPluginProtocolRouter / SetVideoRouter / SetTaskRouter / SetPluginRouter / SetWebRouter；CORS 与 Gzip 在引擎级只注册一次。`router/api-router.go` 的 `/api` 组统一挂 AccessTokenAudit、BodyStorageCleanup、GlobalAPIRateLimit、DemoSiteReadOnly 四个全局中间件。

### middleware/（横切层）

认证（`middleware/auth.go`：UserAuth/AdminAuth/RootAuth/authHelper、TokenAuth）、限流（`middleware/rate-limit.go`：GA/CT/UC/DW/UP 键前缀分档）、渠道分发（`middleware/distributor.go`：Distribute）等横切关注点。新增横切逻辑优先落在此层，不得散落到 controller。

### controller/（HTTP 处理层）

gin handler：参数绑定、权限校验编排、调用 service/model、组装响应。如 `controller/access_token.go`、`controller/topup.go`（RequestEpay/EpayNotify）、`controller/payment_reconcile_task.go`（StartAlipayReconcileTask）。不得在 handler 内集中实现复杂业务规则——业务编排下沉 service。

### service/（业务编排层）

业务流程编排与跨模块协调：渠道选择（`service/channel_select.go`）、计费会话（`service/billing.go`、`service/billing_session.go`）、Token 结算（`service/text_quota.go`、`service/quota.go`）、系统任务 runner（`service/system_task.go`）、渠道价格同步（`service/dreamrouter_sync.go`）等。

### model/（数据模型与数据访问层）

GORM 模型 + 数据库/缓存访问 + 事务与并发控制（`model/topup.go` 的 claimPendingTopUp/creditTopUpQuota、`model/user.go` 的原子配额更新、`model/quota_reserve.go` 的 Redis Lua 预扣、`model/locking.go` 的 lockForUpdate）。数据所有权规则见第 8 节。

### relay/ 与 relaykit/（LLM 转发链路）

- `relay/`：按上游厂商分 20+ 子包（openai/claude/gemini/aws/ali…），adaptor 工厂在 `relay/relay_adaptor.go`；渠道分发前中间件链固定为 RouteTag("relay") → SystemPerformanceCheck() → TokenAuth() → ModelRequestRateLimit() → Distribute()（`router/relay-router.go`）。
- `relaykit/`：**独立 Go module**（`relaykit/go.mod`，运行时依赖仅 uuid/lo/gjson/sjson），只做 OpenAI Chat/Responses、Claude Messages、Gemini 四种协议间的请求/响应/流式转换（`relaykit/dto`、`relaykit/types`、`relaykit/relayconvert`、`relaykit/reasonmap`）。**HTTP 收发、SSE 读写、渠道选择、鉴权和计费由宿主程序完成**——这是硬边界，不得向 relaykit 塞 transport/认证/数据库/计费代码。

### 后台任务机制

无 cron 库，全部为 `go xxx()` goroutine + sleep/ticker 循环，启动点集中在 `main.go`：渠道缓存同步（model.SyncChannelCache）、DreamRouter 价格同步（service.DreamRouterSyncTask，每 10 分钟）、支付对账（controller.StartAlipayReconcileTask / StartWechatReconcileTask）、汇率同步（service.StartExchangeRateSync）等。另有结构化系统任务框架：RegisterScheduledSystemTasks（`controller/system_task_handlers.go`）注册 handler，由 service.StartSystemTaskRunner 用 DB lease 跨多 master 去重调度。

不得为了形式化分层而无意义地增加抽象。

## 6. 前端架构要求

必须明确：

- 页面与路由边界。
- 业务组件边界。
- 公共组件边界。
- API 请求层。
- 状态管理。
- 表单管理。
- 错误处理。
- 权限控制。
- 样式组织。
- 类型定义。

禁止：

- 页面中重复实现大量公共逻辑。
- 在 UI 组件中直接混入复杂数据访问逻辑。
- 绕过统一 API 客户端。
- 在多个地方维护相同业务状态。
- 未经分析引入新的全局状态管理方案。

## 7. AI Relay 架构要求

必须明确：

- 请求入口。
- 身份鉴权。
- API Key 校验。
- 模型映射。
- 渠道路由。
- 上游请求。
- 响应转换。
- Token 统计。
- 计费结算。
- 日志和追踪。
- 重试与超时。
- 故障隔离。

计费逻辑不得与不受控的上游请求代码混杂。

## 8. 数据所有权（实际归属）

以真实代码为准，每类核心数据的负责模块：

| 数据 | 所有模块 | 关键位置 |
|---|---|---|
| 用户账户/余额 | `model/user.go` | `User.Quota`、原子增减 `increaseUserQuota`/`decreaseUserQuota`、`AdjustUserQuota`（user_quota_adjustment.go） |
| 支付订单 | `model/topup.go` | `TopUp` struct、状态迁移 `claimPendingTopUp`、入账 `creditTopUpQuota` |
| 余额/消费流水 | `model/log.go` | `Log`（Type=1 充值/2 消费/3 管理/4 系统/5 错误/6 退款/7 登录），**无独立余额流水表** |
| Token（API Key） | `model/token.go` | `Token.RemainQuota`、`decreaseTokenQuota`（带余量条件） |
| 渠道配置 | `model/channel.go` + `model/channel_cache.go` | `Channel`、内存缓存 InitChannelCache/SyncChannelCache |
| 模型价格/倍率 | `setting/ratio_setting/` | GetModelRatio、GetCompletionRatio、GetCacheRatio、GetModelPrice |
| 计量聚合 | `model/usedata.go` | `QuotaData`（小时级聚合，非流水） |
| 系统配置 | `model/option.go` | `common.OptionMap`、UpdateOption、SyncOptions |

其他模块应通过定义好的服务或接口访问，不得随意绕过数据所有权边界。

## 9. 外部服务集成

第三方服务必须通过明确的适配层接入。

必须考虑：

- 超时。
- 重试。
- 错误转换。
- 限流。
- 熔断。
- 日志脱敏。
- 版本兼容。
- 服务不可用。

禁止让第三方 SDK 的数据结构直接成为整个系统的公共业务契约，除非经过明确设计。

## 10. 架构变更管理

以下变更必须先完成架构影响分析：

- 模块合并或拆分。
- 核心依赖调整。
- 数据库选型变化。
- 认证架构变化。
- 支付架构变化。
- 计费架构变化。
- Relay 核心链路变化。
- 公共接口不兼容修改。

重大决策应记录 ADR。

ADR 至少包含：

- 背景。
- 问题。
- 可选方案。
- 最终决策。
- 决策理由。
- 影响范围。
- 迁移方案。
- 回滚方案。

## 11. 架构图与文档

架构发生变化时，应同步：

- 系统上下文图。
- 模块关系图。
- 关键调用链。
- 数据流图。
- 关键业务时序图。

文档必须与实际代码一致。

## 12. 完成定义

架构修改必须满足：

- 职责清晰。
- 依赖合理。
- 无不必要循环依赖。
- 关键接口稳定。
- 相关测试通过。
- 架构文档同步。
- 兼容性风险已披露。

---

**任何 AI 不得仅为降低当前开发难度而牺牲 Uter 的长期架构质量。**

## 独立模块边界：tokenkit/tokenkit

tokenkit/tokenkit 是独立 Go module（module path: github.com/QuantumNous/new-api/tokenkit），拥有独立 go.mod、go.sum、源码和测试。它不受父目录 tokenkit 的 go test ./...、go vet ./... 或 go build ./... 覆盖。

修改该模块时，必须在 tokenkit/tokenkit 目录内以 GOWORK=off 独立执行 vet、build、test；CI、UEQE、Makefile 与 verify-all 必须将其作为独立模块登记。不得未经 ADR 批准将其合并到父模块或改变其 module path。
