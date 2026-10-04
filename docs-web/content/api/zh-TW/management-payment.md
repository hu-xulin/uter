# payment

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

## Get Payment Amount

🔐 需要登录（User权限）

`POST` `/api/user/amount`

### 响应

| 状态码 | 说明 |
|---|---|
| `200` | 成功 |

## Initiate Creem Payment

🔐 需要登录（User权限）

`POST` `/api/user/creem/pay`

### 响应

| 状态码 | 说明 |
|---|---|
| `200` | 成功 |

## Epay Callback

🔓 无需鉴权（支付回调）

`GET` `/api/user/epay/notify`

### 响应

| 状态码 | 说明 |
|---|---|
| `200` | 成功 |

## Initiate Easy Payment

🔐 需要登录（User权限）

`POST` `/api/user/pay`

### 响应

| 状态码 | 说明 |
|---|---|
| `200` | 成功 |

## Get Stripe Payment Amount

🔐 需要登录（User权限）

`POST` `/api/user/stripe/amount`

### 响应

| 状态码 | 说明 |
|---|---|
| `200` | 成功 |

## Initiate Stripe Payment

🔐 需要登录（User权限）

`POST` `/api/user/stripe/pay`

### 响应

| 状态码 | 说明 |
|---|---|
| `200` | 成功 |

## Get Top-up Information

🔐 需要登录（User权限）

`GET` `/api/user/topup/info`

### 响应

| 状态码 | 说明 |
|---|---|
| `200` | 成功 |

## Get User Top-up Records

🔐 需要登录（User权限）

`GET` `/api/user/topup/self`

### 响应

| 状态码 | 说明 |
|---|---|
| `200` | 成功 |
