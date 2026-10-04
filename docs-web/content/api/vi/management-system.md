# system

## Get About Information

🔓 无需鉴权

`GET` `/api/about`

### 响应

| 状态码 | 说明 |
|---|---|
| `200` | 成功 |

## Get Home Page Content

🔓 无需鉴权

`GET` `/api/home_page_content`

### 响应

| 状态码 | 说明 |
|---|---|
| `200` | 成功 |

## Get Model List

🔐 需要登录（User权限）

`GET` `/api/models`

### 响应

| 状态码 | 说明 |
|---|---|
| `200` | 成功 |

## Get Announcements

🔓 无需鉴权

`GET` `/api/notice`

### 响应

| 状态码 | 说明 |
|---|---|
| `200` | 成功 |

## Get Pricing Information

🔓 无需鉴权（可选登录）

`GET` `/api/pricing`

### 响应

| 状态码 | 说明 |
|---|---|
| `200` | 成功 |

## Get Privacy Policy

🔓 无需鉴权

`GET` `/api/privacy-policy`

### 响应

| 状态码 | 说明 |
|---|---|
| `200` | 成功 |

## Get Ratio Configuration

🔓 无需鉴权

`GET` `/api/ratio_config`

### 响应

| 状态码 | 说明 |
|---|---|
| `200` | 成功 |

## Get Initialization Status

🔓 无需鉴权

`GET` `/api/setup`

### 响应

| 状态码 | 说明 |
|---|---|
| `200` | 成功 |

## Initialize System

🔓 无需鉴权

`POST` `/api/setup`

### 请求体（`application/json`）

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `username` | string | 否 | — |
| `password` | string | 否 | — |

### 响应

| 状态码 | 说明 |
|---|---|
| `200` | 成功 |

## Get System Status

🔓 无需鉴权

`GET` `/api/status`

### 响应

| 状态码 | 说明 |
|---|---|
| `200` | 成功 |

## Test System Status

👨‍💼 需要管理员权限（Admin）

`GET` `/api/status/test`

### 响应

| 状态码 | 说明 |
|---|---|
| `200` | 成功 |

## Get Uptime Kuma Status

🔓 无需鉴权

`GET` `/api/uptime/status`

### 响应

| 状态码 | 说明 |
|---|---|
| `200` | 成功 |

## Get User Agreement

🔓 无需鉴权

`GET` `/api/user-agreement`

### 响应

| 状态码 | 说明 |
|---|---|
| `200` | 成功 |
