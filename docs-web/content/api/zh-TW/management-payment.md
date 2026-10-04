# 充值

## Creem Webhook

🔓 無需鑑權（Webhook回撥）

`POST` `/api/creem/webhook`

### 響應

| 狀態碼 | 說明 |
|---|---|
| `200` | 成功 |

## Stripe Webhook

🔓 無需鑑權（Webhook回撥）

`POST` `/api/stripe/webhook`

### 響應

| 狀態碼 | 說明 |
|---|---|
| `200` | 成功 |

## 獲取支付金額

🔐 需要登入（User許可權）

`POST` `/api/user/amount`

### 響應

| 狀態碼 | 說明 |
|---|---|
| `200` | 成功 |

## 發起Creem支付

🔐 需要登入（User許可權）

`POST` `/api/user/creem/pay`

### 響應

| 狀態碼 | 說明 |
|---|---|
| `200` | 成功 |

## 易支付回撥

🔓 無需鑑權（支付回撥）

`GET` `/api/user/epay/notify`

### 響應

| 狀態碼 | 說明 |
|---|---|
| `200` | 成功 |

## 發起易支付

🔐 需要登入（User許可權）

`POST` `/api/user/pay`

### 響應

| 狀態碼 | 說明 |
|---|---|
| `200` | 成功 |

## 獲取Stripe支付金額

🔐 需要登入（User許可權）

`POST` `/api/user/stripe/amount`

### 響應

| 狀態碼 | 說明 |
|---|---|
| `200` | 成功 |

## 發起Stripe支付

🔐 需要登入（User許可權）

`POST` `/api/user/stripe/pay`

### 響應

| 狀態碼 | 說明 |
|---|---|
| `200` | 成功 |

## 獲取充值資訊

🔐 需要登入（User許可權）

`GET` `/api/user/topup/info`

### 響應

| 狀態碼 | 說明 |
|---|---|
| `200` | 成功 |

## 獲取使用者充值記錄

🔐 需要登入（User許可權）

`GET` `/api/user/topup/self`

### 響應

| 狀態碼 | 說明 |
|---|---|
| `200` | 成功 |
