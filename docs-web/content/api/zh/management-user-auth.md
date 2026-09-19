# 用户登陆注册

## 发送密码重置邮件

🔓 无需鉴权

`GET` `/api/reset_password`

### 请求参数

| 参数名 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `email` | query | string | 是 | — |

### 响应

| 状态码 | 说明 |
|---|---|
| `200` | 成功 |

## 获取用户分组列表

🔓 无需鉴权

`GET` `/api/user/groups`

### 响应

| 状态码 | 说明 |
|---|---|
| `200` | 成功 |

## 两步验证登录

🔓 无需鉴权（登录流程）

`POST` `/api/user/login/2fa`

### 请求体（`application/json`）

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `code` | string | 否 | — |

### 响应

| 状态码 | 说明 |
|---|---|
| `200` | 成功 |

## 用户登录

🔓 无需鉴权

`POST` `/api/user/login`

### 请求体（`application/json`）

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `username` | string | 否 | — |
| `password` | string | 否 | — |

### 响应

| 状态码 | 说明 |
|---|---|
| `200` | 成功 |

## 用户登出

🔓 无需鉴权

`GET` `/api/user/logout`

### 响应

| 状态码 | 说明 |
|---|---|
| `200` | 成功 |

## 开始Passkey登录

🔓 无需鉴权

`POST` `/api/user/passkey/login/begin`

### 响应

| 状态码 | 说明 |
|---|---|
| `200` | 成功 |

## 完成Passkey登录

🔓 无需鉴权

`POST` `/api/user/passkey/login/finish`

### 响应

| 状态码 | 说明 |
|---|---|
| `200` | 成功 |

## 用户注册

🔓 无需鉴权

`POST` `/api/user/register`

### 请求体（`application/json`）

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `username` | string | 否 | — |
| `password` | string | 否 | — |
| `email` | string | 否 | — |
| `verification_code` | string | 否 | — |
| `aff_code` | string | 否 | — |

### 响应

| 状态码 | 说明 |
|---|---|
| `200` | 成功 |

## 重置密码

🔓 无需鉴权

`POST` `/api/user/reset`

### 请求体（`application/json`）

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `email` | string | 否 | — |
| `token` | string | 否 | — |
| `password` | string | 否 | — |

### 响应

| 状态码 | 说明 |
|---|---|
| `200` | 成功 |

## 发送邮箱验证码

🔓 无需鉴权

`GET` `/api/verification`

### 请求参数

| 参数名 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `email` | query | string | 是 | — |

### 响应

| 状态码 | 说明 |
|---|---|
| `200` | 成功 |
