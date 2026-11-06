# API-CONTRACT-STANDARD
# Uter API 接口契约规范

**项目：** Uter  
**文档类型：** API 与接口契约标准  
**适用范围：** 前端 API、后端 API、内部服务接口及第三方集成  
**规范级别：** 强制执行
**规范版本：** 1.0.0（统一版本登记）  
**规范状态：** Active  
**最后更新：** 2026-11-05  
**下次复核：** 2027-02-03  
**维护责任：** Uter Engineering Maintainers  
**版本追溯：** 以 Git 文件历史及对应 Commit SHA 为准  

---

## 1. 规范目标

确保 API 的请求、响应、错误、数据类型和行为具有一致性。

前端和后端必须遵循同一份接口契约，不得分别猜测或维护不一致的数据结构。

## 2. API 设计原则

- 接口职责清晰。
- 命名统一。
- 输入明确。
- 输出稳定。
- 错误可识别。
- 权限明确。
- 兼容性可控。
- 行为可测试。
- 文档与实现同步。

## 3. 接口命名

API 路径必须遵循项目既有命名风格。

不得在同一资源中随意混用不同命名习惯。

HTTP Method 应符合操作语义：

- GET：读取。
- POST：创建或执行操作。
- PUT：整体替换。
- PATCH：部分更新。
- DELETE：删除或执行删除语义。

不得为了方便使用不符合语义的方法。

## 4. Request 契约

每个接口必须明确：

- 请求方法。
- 路径。
- Header。
- Query 参数。
- Path 参数。
- Body。
- 字段类型。
- 是否必填。
- 默认值。
- 格式要求。
- 校验规则。
- 权限要求。

外部输入必须进行服务端校验。

不能仅依赖前端校验保证数据安全。

## 5. Response 契约

每个接口必须定义：

- 成功响应。
- 失败响应。
- 字段类型。
- 可空规则。
- 时间格式。
- 金额单位。
- 分页结构。
- 数据兼容规则。

禁止同一字段在不同接口中使用不一致的含义。

## 6. 数据格式

必须明确以下内容：

### 时间

- 明确使用的时间格式。
- 明确时区。
- 明确时间戳单位。
- 避免前后端对 UTC 和本地时间产生误解。

### 金额

- 明确币种。
- 明确单位。
- 明确精度。
- 避免使用不安全的浮点数进行金额运算。

### Token

- 明确 Token 数量的类型。
- 明确输入、输出和缓存 Token 的区分。
- 明确计费精度和舍入规则。

### 空值

明确区分：

- 字段不存在。
- null。
- 空字符串。
- 空数组。
- 数值 0。

不得让前端通过猜测判断字段含义。

## 7. 统一错误处理（以实际契约为准）

Uter 存在**两套并存的错误体系**，新增接口必须沿用所属域的既有结构，不得引入第三套：

### 管理面（/api 组）

统一封装在 `common/gin.go`：成功体 `ApiSuccess` 返回 `{success: true, message, data}`，HTTP 状态码恒为 200；失败体 `ApiError` 返回 `{success: false, message}`。**没有数字错误码体系**——业务判断不能依赖错误码，只能依赖 `success` 布尔值与 message 语义。

i18n 变体：`ApiErrorI18n`/`ApiSuccessI18n`（服务端翻译）；`ApiErrorT`/`ApiSuccessT` 走 `common/message.go` 的 `Message` 结构——Key 为英文源文本（同时是 `web/src/i18n/locales/*.json` 的 key），失败体额外展开 `message_key` + `message_params`（`{{name}}` 占位符），由前端自行翻译。后端只渲染英文。

### Relay 面（/v1、/v1beta 等）

OpenAI 风格错误包裹：中间件 abort 时输出 `{"error": {"message", "type": "new_api_error", "code"}}`（`middleware/utils.go` 的 abortWithOpenAiMessage）。错误码是**字符串 ErrorCode**（如 `invalid_request`、`insufficient_user_quota`、`channel:no_available_key`），定义在 `relaykit/types/error.go`（ErrorCode、UterError）；错误类型分类 ErrorType：uter_error/openai_error/claude_error/midjourney_error/gemini_error/rerank_error/upstream_error。

### 分页契约

统一分页结构 `common/page_info.go`（PageInfo）：返回字段 `page`/`page_size`/`total`/`items`；查询参数兼容 `p`/`page_size`/`ps`/`size`，页大小上限 100。

错误响应必须具有稳定结构，不得在同一域内混用两种结构。

## 8. 身份认证与权限

必须明确：

- 是否需要认证。
- 使用何种认证机制。
- 权限要求。
- 资源归属校验。
- 管理员权限。
- API Key 权限。
- 限流策略。

必须在服务端执行权限检查。

隐藏前端按钮不等于完成权限控制。

## 9. 幂等性

涉及以下操作时必须评估幂等性：

- 支付。
- 充值。
- 余额调整。
- 订单创建。
- Token 结算。
- 退款。
- 外部 Webhook。
- 任务触发。

必须明确幂等键的生成、作用范围、保存期限和重复请求行为。

## 10. API 兼容性

修改公共 API 前必须评估：

- 已有前端调用。
- 外部 API 使用者。
- 第三方集成。
- 移动端版本。
- 历史数据。
- API SDK。

破坏性变更必须制定版本、迁移或兼容方案。

不得无提示地删除已有字段或改变字段含义。

## 11. API Schema

建议使用项目已有的 OpenAPI 或等价契约工具。

要求：

- 契约有唯一事实来源。
- 前后端类型尽量自动生成。
- 契约变更纳入代码审查。
- 检查不兼容修改。
- 自动校验实现与契约一致性。

不得为了形式化而重复维护多份互相独立的接口定义。

## 12. 第三方 API

必须评估：

- 认证方式。
- 请求签名。
- 超时。
- 重试。
- 限流。
- 错误转换。
- 版本变化。
- 数据校验。
- 敏感信息脱敏。

第三方响应不得未经校验直接进入核心业务状态。

## 13. 测试要求

API 测试至少覆盖：

- 正常请求。
- 参数错误。
- 未认证。
- 权限不足。
- 资源不存在。
- 重复请求。
- 异常响应。
- 超时。
- 兼容性。

核心接口必须覆盖关键业务边界。

## 14. Uter 代码事实锚点（2026-11-01 校准）

新增或修改接口前，以下事实为契约基线：

| 事实 | 代码位置 |
|---|---|
| 路由前缀：`/api`（管理面）、`/v1`、`/v1beta`（Gemini）、`/pg`（playground，UserAuth+Distribute）、`/mj`（Midjourney）、`/api/costopt`（降本指标，AdminAuth） | `router/api-router.go`、`router/relay-router.go` |
| relay 链固定中间件顺序：RouteTag("relay") → SystemPerformanceCheck → TokenAuth → ModelRequestRateLimit → Distribute | `router/relay-router.go` |
| 控制台认证：UserAuth/AdminAuth/RootAuth（authHelper 按 minRole 分档），支持 session 与 PAT 双凭据，PAT 需过 enforceAccessTokenRoute scope 校验；TryUserAuth 为可选认证（无效凭据保持匿名） | `middleware/auth.go` |
| API token 认证：TokenAuth() 从 Bearer/x-api-key/query key/x-goog-api-key/mj-api-secret 提取 `sk-` 前缀 key，调 model.ValidateUserToken，含 token IP 白名单 | `middleware/auth.go`(TokenAuth) |
| 限流键前缀分档：`GA`（GlobalAPIRateLimit 按 IP）、`CT`（CriticalRateLimit 按 IP，登录失败可退款 RefundIPRateLimit）、`UC:<scope>`（UserCriticalRateLimit 按用户）、`DW`/`UP`（下载/上传）；SessionRateLimit 按 SID | `middleware/rate-limit.go` |
| 响应封装：ApiSuccess/ApiError/ApiErrorStatus/ApiErrorI18n/ApiErrorT | `common/gin.go` |
| i18n 契约：Message{Key(英文源文本), Params}，前端用 message_key/message_params 翻译 | `common/message.go`、`web/src/i18n/locales/` |
| 分页：PageInfo{page, page_size, total, items}，GetPageQuery 兼容 p/ps/size，上限 100 | `common/page_info.go` |
| 配置读取单一源：`common.OptionMap["Key"]`，UpdateOption 白名单收敛（validateOptionValue → 落库 → updateOptionMap 巨型 switch 反序列化到全局变量），SyncOptions 周期热同步 | `model/option.go`、`common/constants.go`(OptionMap) |
| 幂等实现范式：条件更新 + RowsAffected 判定（如 claimPendingTopUp 的 `WHERE status='pending'`），支付回调三件套（验签/幂等/实付金额比对）见 DATABASE-STANDARD §8 锚点 | `model/topup.go` |

## 15. 完成定义

API 只有在契约、实现、权限、错误处理、测试和文档保持一致时，才可标记为完成。

---

**API 契约是前后端和服务之间的共同事实来源。**