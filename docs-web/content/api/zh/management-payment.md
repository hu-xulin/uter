# 充值

## Creem Webhook

🔓 无需鉴权（Webhook回调）

`POST` `/api/creem/webhook`

### 响应

| 状态码 | 说明 |
|---|---|
| `200` | 成功 |

## Stripe Webhook

🔓 无需鉴权（Webhook回调）

`POST` `/api/stripe/webhook`

### 响应

| 状态码 | 说明 |
|---|---|
| `200` | 成功 |

## 获取支付金额

🔐 需要登录（User权限）

`POST` `/api/user/amount`

### 响应

| 状态码 | 说明 |
|---|---|
| `200` | 成功 |

## 发起Creem支付

🔐 需要登录（User权限）

`POST` `/api/user/creem/pay`

### 响应

| 状态码 | 说明 |
|---|---|
| `200` | 成功 |

## 易支付回调

🔓 无需鉴权（支付回调）

`GET` `/api/user/epay/notify`

### 响应

| 状态码 | 说明 |
|---|---|
| `200` | 成功 |

## 发起易支付

🔐 需要登录（User权限）

`POST` `/api/user/pay`

### 响应

| 状态码 | 说明 |
|---|---|
| `200` | 成功 |

## 获取Stripe支付金额

🔐 需要登录（User权限）

`POST` `/api/user/stripe/amount`

### 响应

| 状态码 | 说明 |
|---|---|
| `200` | 成功 |

## 发起Stripe支付

🔐 需要登录（User权限）

`POST` `/api/user/stripe/pay`

### 响应

| 状态码 | 说明 |
|---|---|
| `200` | 成功 |

## 获取充值信息

🔐 需要登录（User权限）

`GET` `/api/user/topup/info`

### 响应

| 状态码 | 说明 |
|---|---|
| `200` | 成功 |

## 获取用户充值记录

🔐 需要登录（User权限）

`GET` `/api/user/topup/self`

### 响应

| 状态码 | 说明 |
|---|---|
| `200` | 成功 |
