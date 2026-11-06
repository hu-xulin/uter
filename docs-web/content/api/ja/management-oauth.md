# oauth

## Discord OAuth ログイン

🔓 認証不要（OAuthコールバック）

`GET` `/api/oauth/discord`

### リクエストパラメータ

| パラメータ名 | 位置 | 型 | 必須 | 説明 |
|---|---|---|---|---|
| `code` | query | string | いいえ | — |

### レスポンス

| ステータスコード | 説明 |
|---|---|
| `200` | 成功 |

## メールの紐付け

🔓 認証不要

`GET` `/api/oauth/email/bind`

### リクエストパラメータ

| パラメータ名 | 位置 | 型 | 必須 | 説明 |
|---|---|---|---|---|
| `email` | query | string | いいえ | — |
| `code` | query | string | いいえ | — |

### レスポンス

| ステータスコード | 説明 |
|---|---|
| `200` | 成功 |

## GitHub OAuth ログイン

🔓 認証不要（OAuthコールバック）

`GET` `/api/oauth/github`

### リクエストパラメータ

| パラメータ名 | 位置 | 型 | 必須 | 説明 |
|---|---|---|---|---|
| `code` | query | string | いいえ | — |

### レスポンス

| ステータスコード | 説明 |
|---|---|
| `200` | 成功 |

## LinuxDO OAuth ログイン

🔓 認証不要（OAuthコールバック）

`GET` `/api/oauth/linuxdo`

### レスポンス

| ステータスコード | 説明 |
|---|---|
| `200` | 成功 |

## OIDC ログイン

🔓 認証不要（OAuthコールバック）

`GET` `/api/oauth/oidc`

### レスポンス

| ステータスコード | 説明 |
|---|---|
| `200` | 成功 |

## OAuth State の生成

🔓 認証不要

`GET` `/api/oauth/state`

### レスポンス

| ステータスコード | 説明 |
|---|---|
| `200` | 成功 |

## Telegram の紐付け

🔓 認証不要

`GET` `/api/oauth/telegram/bind`

### レスポンス

| ステータスコード | 説明 |
|---|---|
| `200` | 成功 |

## Telegram ログイン

🔓 認証不要（OAuthコールバック）

`GET` `/api/oauth/telegram/login`

### レスポンス

| ステータスコード | 説明 |
|---|---|
| `200` | 成功 |

## WeChat OAuth ログイン

🔓 認証不要（OAuthコールバック）

`GET` `/api/oauth/wechat`

### レスポンス

| ステータスコード | 説明 |
|---|---|
| `200` | 成功 |
