# 验收清单 · 认证 / 支付 / 数据库（AUTH_SECURITY / PAYMENT_FINANCIAL / DATABASE）

> 依据：`AIES.md` §6.3/§6.4/§6.5、`AGENTS.md` Authentication Security (OWASP Mandatory) / Database compatibility / Billing safety invariants。
> **R2/R3 高风险**：资金、生产、不可逆操作须明确授权 + 回滚方案；关键信息不明时暂停相关操作。

## 开工前
- [ ] 核实当前 SDK 版本并使用匹配版本的官方文档
- [ ] 阅读适用 OWASP ASVS + Authentication / Session Management Cheat Sheet
- [ ] 梳理订单/资金状态机、权限、验签、幂等、事务、错误恢复
- [ ] 确认操作授权范围（R3：资金/生产/不可逆须明确授权 + 恢复/回滚方案）
- [ ] 记录修改前已有的失败基线

## 实现中 · 认证
- [ ] 服务端强制；前端校验不得替代服务端
- [ ] 保留 OTP / CAPTCHA / 会话 / 权限校验；检查过期凭据、重复请求、速率限制
- [ ] 审计日志排除密码/验证码/恢复码/私钥/可用会话令牌
- [ ] Uter：`POST /api/user/login` 的 `CriticalRateLimit` 通过 `RefundIPRateLimit` 退款——**不得回退**
- [ ] Uter：微信 OAuth state/nonce 防 CSRF（`POST /api/oauth/wechat[-web]/state` + AuthFlow 一次性消费）——**不得回退**

## 实现中 · 支付
- [ ] 服务端通知验签；核对订单号/商户号/金额/币种
- [ ] 幂等（同一通知重复到达不重复入账）；并发处理；事务；异常恢复
- [ ] 主动查单/补偿/对账（读时窗口 `readReconcileWindow=24h`，后台任务仍 20min 勿混）
- [ ] Uter 网关回调三件套 = 验签 + 幂等 + 实付金额比对（只拦少付）；入账恒取本地订单；Creem 用最小货币单位（分）
- [ ] Uter：微信只保留 Native + H5（小程序支付已删勿回退），不做 JSAPI；删路由须同步 `middleware/access_token_routes.go`
- [ ] 不信任客户端提供的支付成功状态；不绕过验签、不改金额校验、不降低幂等要求

## 实现中 · 数据库
- [ ] 三库兼容（SQLite/MySQL≥5.7.8/PostgreSQL≥9.6）；GORM 优先于裸 SQL
- [ ] 行锁用 `lockForUpdate(tx)`（勿用 v1 的 `Set("gorm:query_option",...)`）
- [ ] 迁移幂等（启动/迁移至少两次）、升级路径、数据/索引/约束/唯一性保留
- [ ] 未经授权不得操作生产数据库

## 必跑门禁（记录实际命令与退出码）
- [ ] 支付契约 `topup_gateway_contract_test.go`
- [ ] 专项失败 / 过期 / 重放 / 绕过用例
- [ ] 伪造回调、重复通知、金额不一致、并发、超时补偿
- [ ] `go build ./...` / `go test ./... -count=1`
- [ ] DB 变更：真实三库验证矩阵（记录版本、命令、结果）

## 禁止项
- 关闭 CAPTCHA / OTP / 验签 / 权限检查使登录或支付"表面恢复正常"
- 绕过服务端授权；日志/客户端暴露敏感信息；信任客户端支付状态
- 未运行即声称通过；把 BLOCKED/NOT_RUN 报成 PASS

## 交付（AIES 第九章）
状态｜授权范围与恢复方案｜专项测试证据（含失败/重放/绕过）｜逐项验收证据｜未解决风险｜Git 状态
