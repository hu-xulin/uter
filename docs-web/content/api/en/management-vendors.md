# vendors

## Get All Vendors

👨‍💼 需要管理员权限（Admin）

`GET` `/api/vendors/`

### 响应

| 状态码 | 说明 |
|---|---|
| `200` | 成功 |

## Delete Vendor

👨‍💼 需要管理员权限（Admin）

`DELETE` `/api/vendors/{id}`

### 请求参数

| 参数名 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `id` | path | integer | 是 | — |

### 响应

| 状态码 | 说明 |
|---|---|
| `200` | 成功 |

## Get Specific Vendor

👨‍💼 需要管理员权限（Admin）

`GET` `/api/vendors/{id}`

### 请求参数

| 参数名 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `id` | path | integer | 是 | — |

### 响应

| 状态码 | 说明 |
|---|---|
| `200` | 成功 |

## Create Vendor

👨‍💼 需要管理员权限（Admin）

`POST` `/api/vendors/`

### 响应

| 状态码 | 说明 |
|---|---|
| `200` | 成功 |

## Update Vendor

👨‍💼 需要管理员权限（Admin）

`PUT` `/api/vendors/`

### 响应

| 状态码 | 说明 |
|---|---|
| `200` | 成功 |

## Search Vendors

👨‍💼 需要管理员权限（Admin）

`GET` `/api/vendors/search`

### 请求参数

| 参数名 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `keyword` | query | string | 否 | — |

### 响应

| 状态码 | 说明 |
|---|---|
| `200` | 成功 |
