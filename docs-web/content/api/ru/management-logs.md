# logs

## Delete Historical Logs

👨‍💼 需要管理员权限（Admin）

`DELETE` `/api/log/`

### 响应

| 状态码 | 说明 |
|---|---|
| `200` | 成功 |

## Get All Logs

👨‍💼 需要管理员权限（Admin）

`GET` `/api/log/`

### 请求参数

| 参数名 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `p` | query | integer | 否 | — |
| `page_size` | query | integer | 否 | — |

### 响应

| 状态码 | 说明 |
|---|---|
| `200` | 成功 |

## Search Logs

👨‍💼 需要管理员权限（Admin）

`GET` `/api/log/search`

### 请求参数

| 参数名 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `keyword` | query | string | 否 | — |

### 响应

| 状态码 | 说明 |
|---|---|
| `200` | 成功 |

## Get Personal Logs

🔐 需要登录（User权限）

`GET` `/api/log/self`

### 响应

| 状态码 | 说明 |
|---|---|
| `200` | 成功 |

## Search Personal Logs

🔐 需要登录（User权限）

`GET` `/api/log/self/search`

### 请求参数

| 参数名 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `keyword` | query | string | 否 | — |

### 响应

| 状态码 | 说明 |
|---|---|
| `200` | 成功 |

## Get Personal Log Statistics

🔐 需要登录（User权限）

`GET` `/api/log/self/stat`

### 响应

| 状态码 | 说明 |
|---|---|
| `200` | 成功 |

## Get Log Statistics

👨‍💼 需要管理员权限（Admin）

`GET` `/api/log/stat`

### 响应

| 状态码 | 说明 |
|---|---|
| `200` | 成功 |

## Get Logs by Token

🔓 无需鉴权（通过令牌查询）

`GET` `/api/log/token`

### 请求参数

| 参数名 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `key` | query | string | 否 | — |

### 响应

| 状态码 | 说明 |
|---|---|
| `200` | 成功 |
