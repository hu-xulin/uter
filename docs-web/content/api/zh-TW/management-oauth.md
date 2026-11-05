# OAuth

## Discord OAuth登入

🔓 無需鑑權（OAuth回撥）

`GET` `/api/oauth/discord`

### 請求引數

| 引數名 | 位置 | 型別 | 必填 | 說明 |
|---|---|---|---|---|
| `code` | query | string | 否 | — |

### 響應

| 狀態碼 | 說明 |
|---|---|
| `200` | 成功 |

## 繫結郵箱

🔓 無需鑑權

`GET` `/api/oauth/email/bind`

### 請求引數

| 引數名 | 位置 | 型別 | 必填 | 說明 |
|---|---|---|---|---|
| `email` | query | string | 否 | — |
| `code` | query | string | 否 | — |

### 響應

| 狀態碼 | 說明 |
|---|---|
| `200` | 成功 |

## GitHub OAuth登入

🔓 無需鑑權（OAuth回撥）

`GET` `/api/oauth/github`

### 請求引數

| 引數名 | 位置 | 型別 | 必填 | 說明 |
|---|---|---|---|---|
| `code` | query | string | 否 | — |

### 響應

| 狀態碼 | 說明 |
|---|---|
| `200` | 成功 |

## LinuxDO OAuth登入

🔓 無需鑑權（OAuth回撥）

`GET` `/api/oauth/linuxdo`

### 響應

| 狀態碼 | 說明 |
|---|---|
| `200` | 成功 |

## OIDC登入

🔓 無需鑑權（OAuth回撥）

`GET` `/api/oauth/oidc`

### 響應

| 狀態碼 | 說明 |
|---|---|
| `200` | 成功 |

## 生成OAuth State

🔓 無需鑑權

`GET` `/api/oauth/state`

### 響應

| 狀態碼 | 說明 |
|---|---|
| `200` | 成功 |

## 繫結Telegram

🔓 無需鑑權

`GET` `/api/oauth/telegram/bind`

### 響應

| 狀態碼 | 說明 |
|---|---|
| `200` | 成功 |

## Telegram登入

🔓 無需鑑權（OAuth回撥）

`GET` `/api/oauth/telegram/login`

### 響應

| 狀態碼 | 說明 |
|---|---|
| `200` | 成功 |

## 微信OAuth登入

🔓 無需鑑權（OAuth回撥）

`GET` `/api/oauth/wechat`

### 響應

| 狀態碼 | 說明 |
|---|---|
| `200` | 成功 |
