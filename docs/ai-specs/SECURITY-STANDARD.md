# SECURITY-STANDARD
# Uter 安全开发规范

**项目：** Uter  
**文档类型：** 信息安全与安全开发标准  
**适用范围：** 所有代码、接口、数据、配置和外部集成  
**规范级别：** 强制执行
**规范版本：** 1.0.0（统一版本登记）  
**规范状态：** Active  
**最后更新：** 2026-11-05  
**维护责任：** Uter Engineering Maintainers  
**版本追溯：** 以 Git 文件历史及对应 Commit SHA 为准  

---

## 1. 规范目标

保证 Uter 在身份认证、权限管理、数据处理、支付、API Relay 和第三方集成中的安全性。

安全要求不得因开发便利而被绕过。

## 2. 安全基本原则

- 默认拒绝。
- 最小权限。
- 深度防御。
- 输入不可信。
- 输出受控。
- 敏感信息最小化。
- 安全失败关闭。
- 操作可审计。
- 依赖可追溯。

## 3. 身份认证

必须正确处理：

- 登录认证。
- Session / Token。
- 令牌过期。
- 令牌撤销。
- 密码或验证码验证。
- 多设备会话。
- 异常登录。
- 账户状态。

不得自行绕过已有认证中间件。

## 4. 权限控制

所有敏感操作必须在服务端验证权限。

包括：

- 用户数据访问。
- API Key 管理。
- 余额查询与调整。
- 充值订单。
- 退款。
- 模型管理。
- 渠道管理。
- 系统设置。
- 管理员操作。

必须防止越权访问和 IDOR。

## 5. 输入验证

所有外部输入都必须视为不可信。

重点检查：

- SQL 注入。
- 命令注入。
- XSS。
- SSRF。
- 路径穿越。
- 文件上传。
- 不安全反序列化。
- 参数污染。
- 请求体大小。
- 资源消耗攻击。

必须进行服务端验证。

## 6. API 安全

必须考虑：

- HTTPS。
- 认证。
- 授权。
- 限流。
- 请求大小限制。
- 超时。
- CORS。
- CSRF（适用时）。
- 重放攻击。
- 请求签名。
- 错误信息泄露。

不得仅依赖前端控制安全边界。

## 7. API Key 与密钥管理

必须：

- 使用安全随机数生成密钥。
- 限制密钥权限。
- 支持撤销和轮换。
- 限制密钥可见范围。
- 对日志进行脱敏。
- 使用受控 Secrets 管理。
- 避免将密钥写入代码和提交历史。

不得明文输出完整 API Key 或支付私钥。

## 8. 支付安全

支付相关实现必须：

- 验证签名。
- 验证订单号。
- 验证商户身份。
- 验证支付金额。
- 验证币种。
- 验证订单状态。
- 防止重复通知。
- 防止重放攻击。
- 保护回调入口。
- 保留审计证据。

支付成功不能仅根据浏览器跳转参数判断。

## 9. AI Relay 安全

必须考虑：

- API Key 泄露。
- 上游请求伪造。
- SSRF。
- 上游响应污染。
- 请求超时。
- 恶意超大响应。
- 流式连接耗尽。
- 越权模型访问。
- 价格和用量篡改。
- 计费数据伪造。

必须校验模型、渠道和用户权限之间的关系。

## 10. 数据保护

敏感数据必须：

- 限制访问。
- 必要时加密。
- 按最小范围展示。
- 避免进入普通日志。
- 避免进入调试输出。
- 按业务和合规要求保留或删除。

## 11. 文件上传

必须检查：

- 文件大小。
- 文件类型。
- 文件内容。
- 文件名。
- 存储路径。
- 访问权限。
- 恶意文件风险。

不得只根据扩展名判断文件安全。

## 12. 依赖安全

新增或更新依赖时必须检查：

- 已知漏洞。
- 来源可信度。
- License。
- 维护状态。
- 供应链风险。
- 锁文件变化。

不得随意执行不可信安装脚本。

## 13. 安全日志和审计

敏感操作应记录：

- 操作主体。
- 操作时间。
- 操作对象。
- 操作类型。
- 结果。
- 关联请求或任务标识。

不得在审计日志中保存完整秘密。

## 14. 安全禁止事项

AI 严禁为了通过测试或快速实现功能而：

- 关闭权限验证。
- 关闭支付验签。
- 关闭 TLS 验证。
- 允许任意跨域。
- 硬编码真实密钥。
- 使用固定弱密码。
- 放宽所有输入限制。
- 暴露内部错误堆栈。
- 禁用安全扫描。
- 删除安全测试。

确需改变安全策略时，必须先说明理由、风险和替代措施，并获得相应授权。

## 15. 安全测试

按适用情况执行：

- 静态安全扫描。
- 依赖漏洞扫描。
- Secret Scan。
- 权限测试。
- 输入验证测试。
- Webhook 验签测试。
- 越权测试。
- SSRF 测试。
- 并发与重放测试。

## 16. 漏洞处理

发现漏洞后：

1. 记录证据。
2. 判断严重程度。
3. 确认影响范围。
4. 制定缓解方案。
5. 在授权范围内修复。
6. 添加安全回归测试。
7. 复核相关调用路径。

重大安全问题必须优先处理。

## 17. 完成定义

必须满足：

- 认证和授权完整。
- 输入校验有效。
- 敏感数据受保护。
- 密钥管理合理。
- 外部集成经过验证。
- 安全测试已执行。
- 未解决风险已披露。

## 18. Uter 代码事实锚点（2026-11-01 校准）

### 18.1 认证与权限（真实实现，禁止绕过）

- 控制台认证：`middleware/auth.go` 的 UserAuth()/AdminAuth()/RootAuth()（authHelper 按 minRole 分档）；session 与 PAT（个人 access token）双凭据，PAT 需过 enforceAccessTokenRoute 的 scope 校验；AdminAuth 及以上自动挂管理员写操作审计（beginAdminAudit）。TryUserAuth 为可选认证（凭据无效保持匿名）。
- API token 认证：TokenAuth() 提取 `sk-` 前缀 key（Bearer / x-api-key / query key / x-goog-api-key / mj-api-secret），调 model.ValidateUserToken，含 token IP 白名单检查。
- Casbin 授权：`service/authz/`（StartPolicySync 周期重载策略）。
- 限流档位：`middleware/rate-limit.go`——GA（全局 API 按 IP）、CT（CriticalRateLimit 按 IP，登录成败都计数，退款走 RefundIPRateLimit）、`UC:<scope>`（用户级）、DW/UP（下载/上传）、SessionRateLimit（按 SID）、ModelRequestRateLimit（模型级，middleware/model-rate-limit.go）。

### 18.2 支付验签与金额核验（真实位置，回调三件套）

| 渠道 | 下单/回调 | 验签 | 实付金额比对 |
|---|---|---|---|
| Epay | controller/topup.go（RequestEpay / EpayNotify） | client.Verify(params) | paidAmountMatchesOrder |
| 支付宝 | controller/topup_alipay.go（RequestAlipayWeb / AlipayNotify） | service.AlipayVerifySign + app_id 校验 | alipayPaidAmountMatchesOrder（比对基准为下单落库的 ProviderAmount 分快照） |
| 微信 Native/H5 | controller/topup_wechat.go（RequestWechatPayWeb / WechatPayNotify） | Wechatpay-Timestamp/Nonce/Signature 头 + 5 分钟防重放 + WechatPayVerifyNotify/DecryptResource + mchid/appid 校验 | ProviderAmount/ProviderCurrency 快照比对 |
| Creem | controller/topup_creem.go（RequestCreemPay / CreemWebhook） | verifyCreemSignature + creemModeMatchesConfigured | creemOrderAmountsCoverOrder |
| Waffo(/Pancake) | controller/topup_waffo.go、topup_waffo_pancake.go | core.WebhookHandler | waffoPaidAmountMatchesOrder |
| Stripe | controller/topup_stripe.go（RequestStripePay / StripeWebhook / fulfillOrder） | Stripe Webhook 签名 | stripeCheckoutSubtotalMatchesOrder |

幂等通用范式：`claimPendingTopUp`（model/topup.go）条件更新 `WHERE status='pending'` + RowsAffected 判定；进程内订单锁 LockOrder/UnlockOrder（controller/topup.go）。通用分单位换算：providerExpectedMinorUnits / providerPaidAmountMatchesOrder / currencyMinorUnitExponent（controller/topup.go）。

### 18.3 密钥与敏感信息（真实机制）

- 密钥展示三件套 + maskSecret 掩码；`excludedOptionKeys` 整条剔除敏感 option 不下发前端（如 SMTPAccounts token），派生掩码视图（如 SMTPAccountsView）。
- options 落库经 validateOptionValue 校验；`.env`/`*.db`/`logs`/产物不进提交与文档（AGENTS.md 变更保护）。
- Root 超管只许登录不得修改；明文口令不进代码/git。
- 依赖安全：govulncheck 扫 root/relaykit/tokenkit 三模块（ci.yml vulnscan job）；Dependency Graph 快照规则见 docs/security/dependency-risk-acceptance.md。

### 18.4 认证相关变更的强制流程

任何认证相关实现/修改/评审必须先读 OWASP ASVS 与 Authentication/Session Management Cheat Sheet（AGENTS.md 认证安全节，OWASP Mandatory）——先识别适用控制项再实现；已有代码不是保留不安全模式的理由。

---

**任何 AI 不得以功能实现为理由降低 Uter 的安全等级。**