# payment

## Creem Webhook

🔓 認証不要（Webhookコールバック）

`POST` `/api/creem/webhook`

### レスポンス

| ステータスコード | 説明 |
|---|---|
| `200` | 成功 |

## Stripe Webhook

🔓 認証不要（Webhookコールバック）

`POST` `/api/stripe/webhook`

### レスポンス

| ステータスコード | 説明 |
|---|---|
| `200` | 成功 |

## 決済金額の取得

🔐 ログインが必要（User権限）

`POST` `/api/user/amount`

### レスポンス

| ステータスコード | 説明 |
|---|---|
| `200` | 成功 |

## Creem 決済の開始

🔐 ログインが必要（User権限）

`POST` `/api/user/creem/pay`

### レスポンス

| ステータスコード | 説明 |
|---|---|
| `200` | 成功 |

## Epay コールバック

🔓 認証不要（決済コールバック）

`GET` `/api/user/epay/notify`

### レスポンス

| ステータスコード | 説明 |
|---|---|
| `200` | 成功 |

## Easy Payment 決済の開始

🔐 ログインが必要（User権限）

`POST` `/api/user/pay`

### レスポンス

| ステータスコード | 説明 |
|---|---|
| `200` | 成功 |

## Stripe 決済金額の取得

🔐 ログインが必要（User権限）

`POST` `/api/user/stripe/amount`

### レスポンス

| ステータスコード | 説明 |
|---|---|
| `200` | 成功 |

## Stripe 決済の開始

🔐 ログインが必要（User権限）

`POST` `/api/user/stripe/pay`

### レスポンス

| ステータスコード | 説明 |
|---|---|
| `200` | 成功 |

## チャージ情報の取得

🔐 ログインが必要（User権限）

`GET` `/api/user/topup/info`

### レスポンス

| ステータスコード | 説明 |
|---|---|
| `200` | 成功 |

## ユーザーチャージ記録の取得

🔐 ログインが必要（User権限）

`GET` `/api/user/topup/self`

### レスポンス

| ステータスコード | 説明 |
|---|---|
| `200` | 成功 |
