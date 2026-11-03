# PRODUCT-REQUIREMENTS-STANDARD
# Uter 产品需求与业务规则规范

**项目：** Uter  
**文档类型：** 产品需求与业务规则标准  
**适用范围：** 所有产品功能、业务流程和用户操作  
**规范级别：** 强制执行

---

## 1. 规范目标

本规范用于保证 AI、开发人员和产品设计人员对 Uter 的产品目标、功能定义和业务规则具有一致理解。

所有功能必须以明确的产品需求和业务规则为依据。

禁止仅根据页面表现或局部代码推测完整业务逻辑。

## 2. 产品需求基本原则

每项功能必须明确：

1. 为什么需要该功能。
2. 谁使用该功能。
3. 在什么场景下使用。
4. 用户如何操作。
5. 系统如何响应。
6. 数据如何变化。
7. 失败时如何处理。
8. 如何判断功能完成。

## 3. 功能需求定义

每个功能应包含：

### 3.1 功能基本信息

- Feature ID。
- 功能名称。
- 所属模块。
- 功能目标。
- 优先级。
- 当前状态。
- 相关页面。
- 相关 API。
- 相关数据表。

### 3.2 用户角色

明确：

- 普通用户。
- 管理员。
- 系统任务。
- 外部服务。
- 其他实际存在的角色。

不得凭空创建项目中不存在的角色或权限。

### 3.3 前置条件

明确功能执行前必须满足的条件：

- 是否需要登录。
- 是否需要特定权限。
- 是否需要账户余额。
- 是否需要有效配置。
- 是否需要第三方服务可用。
- 是否需要特定订单状态。

### 3.4 正常流程

按照真实操作顺序描述：

用户操作 → 前端校验 → API 请求 → 后端处理 → 数据变化 → 返回结果 → UI 反馈。

### 3.5 异常流程

必须考虑：

- 参数错误。
- 权限不足。
- 资源不存在。
- 重复请求。
- 网络中断。
- 请求超时。
- 第三方服务失败。
- 数据库失败。
- 并发冲突。
- 状态不一致。

## 4. 业务规则

所有关键业务规则必须有明确、可验证的描述。

不得将以下概念混为一谈：

- 用户余额与账户流水。
- 订单创建与订单支付成功。
- 支付平台回调与浏览器跳转。
- Token 预估量与实际消耗量。
- 模型标价与用户实际计费价格。
- 请求成功与计费成功。
- 渠道可用与渠道健康。

业务规则必须说明适用范围、计算方式、精度、状态变化和失败处理。

## 5. Uter 核心业务专项要求

### 5.1 用户与认证

明确：

- 注册条件。
- 登录方式。
- 身份验证。
- 会话生命周期。
- 账户状态。
- 权限范围。
- 注销和封禁规则。

### 5.2 充值与支付

必须定义：

- 充值金额规则。
- 订单编号规则。
- 支付渠道。
- 支付状态机。
- 异步通知处理。
- 同步跳转处理。
- 重复通知处理。
- 金额核验。
- 订单对账。
- 充值到账条件。
- 退款规则。
- 异常恢复机制。

支付成功不能仅凭前端跳转判断。

### 5.3 余额与流水

必须定义：

- 余额计算规则。
- 余额扣减时机。
- 余额增加时机。
- 退款规则。
- 并发扣款规则。
- 重复请求防护。
- 流水追溯。
- 对账和修复机制。

### 5.4 Token 计费

必须定义：

- 输入 Token。
- 输出 Token。
- 缓存 Token。
- 模型价格。
- 用户倍率。
- 渠道倍率。
- 最终计费金额。
- 精度与舍入规则。
- 预扣费和结算规则。
- 请求失败时的处理。
- 流式请求中断时的处理。
- 计费记录与余额流水关联。

### 5.5 AI Relay

必须定义：

- 上游模型选择。
- 渠道路由。
- 模型映射。
- 请求参数转换。
- 响应转换。
- 重试规则。
- 超时规则。
- 熔断和降级。
- 上游错误处理。
- 用量统计。
- 计费关联。

## 6. 功能状态定义

每个具有生命周期的业务对象必须定义状态。

状态定义至少包含：

- 状态名称。
- 状态含义。
- 进入条件。
- 允许的后续状态。
- 禁止的状态转换。
- 是否可重试。
- 是否可恢复。
- 是否需要人工干预。

禁止未经定义直接修改核心业务状态。

## 7. 验收标准

每个功能必须具备可验证的验收条件。

建议采用 Given / When / Then：

- Given：前置条件。
- When：用户操作或系统事件。
- Then：预期结果。

验收必须覆盖：

- 正常路径。
- 异常路径。
- 边界条件。
- 权限检查。
- 重复操作。
- 并发场景。
- 数据一致性。

## 8. 需求变更

需求发生变化时，必须识别：

- 受影响页面。
- 受影响 API。
- 受影响数据表。
- 受影响模块。
- 兼容性影响。
- 测试影响。
- 文档影响。

重大业务规则变更必须记录决策。

## 9. 功能文档结构

建议：

docs/product/features/

每个功能使用独立文档，推荐结构：

1. 功能目标。
2. 用户角色。
3. 使用场景。
4. 前置条件。
5. 正常流程。
6. 异常流程。
7. 业务规则。
8. 状态机。
9. API 依赖。
10. 数据变化。
11. 安全要求。
12. 验收标准。
13. 未决问题。

## 10. Uter 代码事实锚点（2026-11-01 校准）

描述产品需求时，以下业务概念必须使用真实定义，不得编造近似概念：

| 业务概念 | 真实定义 | 代码位置 |
|---|---|---|
| 计费单位 | QuotaPerUnit = 500,000 配额 = 1 美元（$0.002/1K tokens） | `common/constants.go` |
| 充值定价 | 应付 = 金额 × EffectivePayPrice() × TopupGroupRatio × presetDiscount，roundPayMoneyToCent 收敛到分；PayPrice = 行情汇率 USDExchangeRate + 0.2（PriceAdjustmentRate） | `controller/topup.go`(getPayMoney)、`setting/operation_setting/payment_setting_old.go` |
| 订单状态机 | pending → success / failed / expired（TopUpStatus* 常量），状态迁移用条件更新赢得 | `common/constants.go`、`model/topup.go`(claimPendingTopUp、MarkFailed) |
| 订单号 | `USR{userId}NO{随机6位+Unix时间戳}` | `controller/topup.go` |
| 余额流水 | 即 `logs` 表（Type：1 充值/2 消费/3 管理/4 系统/5 错误/6 退款/7 登录），无独立流水表 | `model/log.go` |
| Token 计费链路 | 预扣（PreConsumeBilling，promptTokens×InputPreConsumeMultiplier×modelRatio×groupRatio）→ 结算（BillingSession.Settle，decimal 计算，缓存/图像/音频分列倍率）→ 记录（RecordConsumeLog 写 logs，倍率详情写 Other JSON） | `service/billing.go`、`service/billing_session.go`、`service/text_quota.go`、`model/log.go` |
| 倍率体系 | 模型倍率 GetModelRatio、补全倍率 GetCompletionRatio、缓存倍率 GetCacheRatio、分组倍率（含用户组特殊倍率 group_group_ratio）、充值分组倍率 GetTopupGroupRatio | `setting/ratio_setting/`、`common/topup-ratio.go` |
| 分层计费（C 类） | billing_expr 表达式计费：rawCost/1e6 × QuotaPerUnit；表达式不可解析标记 tiered_unparsable 并告警 | `relay/helper/price.go`(modelPriceHelperTiered)、`service/dreamrouter_sync.go` |
| 价格同步 | DreamRouter 同步每 10 分钟固定；uter 目标价 = 上游售价 × (r + step)；默认渠道 id=20 | `service/dreamrouter_sync.go` |
| 支付渠道 | Epay、支付宝官方（电脑+手机网站）、微信 Native/H5（无 JSAPI、无小程序）、Creem、Waffo(/Pancake)、Stripe；前端开关聚合 hasConfigurableTopup | `controller/topup*.go`、`web/src/features/wallet/components/recharge-form-card.tsx` |
| 对账与补单 | 支付宝/微信对账任务（读窗口 24h）+ 读时对账（GetUserTopUps）+ 人工补单 POST /api/user/topup/complete（AdminCompleteTopUp → ManualCompleteTopUp，幂等） | `controller/payment_reconcile_task.go`、`model/topup.go` |
| 降本红线 | 模型保真：绝不替换客户所选模型，ApplyArbitrage 恒 no-op，ApplyCascade/ComplexityRouting/RouterLM 硬 no-op | relay 降本相关代码 |
| 登录形态 | RegisterEnabled 只关自主注册表单，不阻断已验证身份登录即注册；邮箱验证码登录 EmailCodeLoginEnabled（登录即注册 provisionEmailCodeUser） | `service/`、`controller/user.go` |
| 微信登录 | 仅保留网站应用扫码（wechat_web），跨域两段式回调 | `controller/`、`oauth/` |

功能文档目录 `docs/product/features/` 目前不存在；当前真实文档布局为 `docs/`（ai-specs/、security/、engineering/、design-system/UTER-DESIGN-SYSTEM-3.0.md）、`docs-dev/`（开发文档）。建立功能文档前先与用户确认目录。

## 11. 完成定义

只有当需求、业务规则、异常流程和验收标准均已明确，且实际实现通过验收，才能将功能标记为完成。

---

**所有 AI 开发任务必须优先遵循已确认的产品需求和业务规则。**