# 人工真实支付对账（Alipay · 2026-11-18）

> 范围：操作者在本机站点手工完成一笔 0.14 CNY 支付宝支付后，对**订单 → 回调/查单 → 余额 → 流水**的只读核对。
> 本报告是**人工验证证据**，不进入自动化 `payment_sandbox` 口径，也不改变 `financial_integrity=false` 的既有结论。
> 所有金额、时间、trade_no 均取自本地 SQLite `one-api.db` 与后端日志；未修改订单、余额或配置。

## 1. 结论

| 环节 | 结果 | 证据 |
| --- | --- | --- |
| 订单创建 | 成功 | `top_ups.id=20`；后端日志 17:13:04 `POST /api/user/alipay/webpay` 200，`amount=0.02 money=0.14` |
| 支付返回 | 成功 | 17:13:48 `GET /wallet?...out_trade_no=USR3NOjLUYF2bo1794993184...total_amount=0.14` |
| 异步回调（notify） | **未观测到** | 后端日志无 `/api/alipay/notify` 记录（本机 localhost 不可被支付宝回调）；见 §5 限制 |
| 查单确认 | 成功 | 17:13:49 `支付宝查单确认入账`，`POST /api/user/alipay/query` 200 |
| 订单终态 | 成功 | `status=success`，`complete_time=2026-11-18 17:13:49`，`provider_amount=14 CNY` |
| 余额入账 | 成功 | 日志 `quota_to_add=10000`；流水 `logs.id=7955`；余额差 10000（§4） |
| 流水 | 唯一一条 | `logs.id=7955`，时间戳与 `complete_time` 完全一致 |
| 幂等 | 通过 | 同一 `trade_no` 的 `top_ups` 行数 = 1；同一时刻的入账流水 = 1 |

## 2. 订单原始行

```
id=20  user_id=3  amount=0.02  money=0.14  trade_no=USR3NOjLUYF2bo1794993184
payment_method=alipay_web  payment_provider=alipay_official
create_time=1794993184 (2026-11-18 17:13:04)
complete_time=1794993229 (2026-11-18 17:13:49)
status=success  provider_amount=14  provider_currency=CNY  fail_reason=(空)
```

## 3. 回调 / 查单证据（后端日志 `logs/oneapi-20261118165317.log`）

```
L247 [INFO] 17:13:04 | ...R3iUjL9l | 支付宝电脑网站支付订单创建成功 user_id=3
     trade_no=USR3NOjLUYF2bo1794993184 amount=0.02 money=0.14 method=alipay.trade.page.pay
L248 [GIN]  17:13:04 | api | ...R3iUjL9l | 200 | POST /api/user/alipay/webpay
L255 [GIN]  17:13:48 | web | ...M23Vy1pJ | 200 | GET /wallet?…out_trade_no=USR3NOjLUYF2bo1794993184
     &total_amount=0.14&trade_no=…&sign=[REDACTED]
L271 [SYS]  17:13:49 | alipay_official 充值成功 trade_no=USR3NOjLUYF2bo1794993184 user_id=3
     quota_to_add=10000 money=0.14
L272 [INFO] 17:13:49 | ...wh1pNHYh | 支付宝查单确认入账 trade_no=USR3NOjLUYF2bo1794993184 user_id=3 source=::1
L273 [GIN]  17:13:49 | api | ...wh1pNHYh | 200 | 209.758363ms | POST /api/user/alipay/query
```

## 4. 余额与流水核对

- 入账流水 `logs.id=7955`（`type=1`，即充值）：
  `Online top-up succeeded, amount added: ＄0.020000 quota, payment amount: 0.140000`
- `other.admin_info`：`callback_payment_method=alipay_official`、`payment_method=alipay_web`、
  `caller_ip=::1`、`node_name=uter-master-1`、`version=v1.5.64`。
- 用户 3 当前 `quota=100043698`；对账时点之后该用户无消费日志（`type=2` 条数 0）、
  无签到（checkins=0）、无新充值，因此充值前余额可由 `100043698 − 10000 = 100033698` 反推，
  与 `quota_to_add=10000` 一致。
- `10000 quota = 0.02 USD × 500000（QuotaPerUnit）`，与订单 `amount=0.02` 一致；
  `0.14 CNY` 与站点汇率、`provider_amount=14`（分）一致。

## 5. 限制与边界（不造绿）

- **异步通知未验证**：本机地址无法接收支付宝服务器回调，日志中没有 `/api/alipay/notify` 命中；
  本次成功由**返回页触发查单**完成。生产环境需配置公网可达的 notify URL 后另行验证签名与幂等。
- 仅覆盖**一笔成功支付**；未覆盖支付失败、关闭、异步通知重放、金额不一致、退款等路径。
- 本次为操作者**人工真实支付**，不属于 `verify-payment`（LOCAL_SIMULATION）或
  `PAYMENT_SANDBOX_VERIFIED`（需服务商沙箱凭据）任何自动化能力卡；
  `financial_integrity` 仍为 false，自动化口径不变。

## 6. 复现命令（只读）

```bash
sqlite3 -readonly one-api.db \
  "SELECT id,user_id,amount,money,trade_no,payment_method,payment_provider,status,provider_amount,provider_currency FROM top_ups WHERE id=20;"
sqlite3 -readonly one-api.db \
  "SELECT id,created_at,type,content,other FROM logs WHERE id=7955;"
sqlite3 -readonly one-api.db \
  "SELECT COUNT(*) FROM top_ups WHERE trade_no='USR3NOjLUYF2bo1794993184';"
grep -n "USR3NOjLUYF2bo1794993184" logs/oneapi-20261118165317.log
```
