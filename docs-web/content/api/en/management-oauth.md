# oauth

## Discord OAuth Login

🔓 无需鉴权（OAuth回调）

`GET` `/api/oauth/discord`

### 请求参数

| 参数名 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `code` | query | string | 否 | — |

### 响应

| 状态码 | 说明 |
|---|---|
| `200` | 成功 |

## Bind Email

🔓 无需鉴权

`GET` `/api/oauth/email/bind`

### 请求参数

| 参数名 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `email` | query | string | 否 | — |
| `code` | query | string | 否 | — |

### 响应

| 状态码 | 说明 |
|---|---|
| `200` | 成功 |

## GitHub OAuth Login

🔓 无需鉴权（OAuth回调）

`GET` `/api/oauth/github`

### 请求参数

| 参数名 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `code` | query | string | 否 | — |

### 响应

| 状态码 | 说明 |
|---|---|
| `200` | 成功 |

## LinuxDO OAuth Login

🔓 无需鉴权（OAuth回调）

`GET` `/api/oauth/linuxdo`

### 响应

| 状态码 | 说明 |
|---|---|
| `200` | 成功 |

## OIDC Login

🔓 无需鉴权（OAuth回调）

`GET` `/api/oauth/oidc`

### 响应

| 状态码 | 说明 |
|---|---|
| `200` | 成功 |

## Generate OAuth State

🔓 无需鉴权

`GET` `/api/oauth/state`

### 响应

| 状态码 | 说明 |
|---|---|
| `200` | 成功 |

## Bind Telegram

🔓 无需鉴权

`GET` `/api/oauth/telegram/bind`

### 响应

| 状态码 | 说明 |
|---|---|
| `200` | 成功 |

## Telegram Login

🔓 无需鉴权（OAuth回调）

`GET` `/api/oauth/telegram/login`

### 响应

| 状态码 | 说明 |
|---|---|
| `200` | 成功 |

## WeChat OAuth Login

🔓 无需鉴权（OAuth回调）

`GET` `/api/oauth/wechat`

### 响应

| 状态码 | 说明 |
|---|---|
| `200` | 成功 |
