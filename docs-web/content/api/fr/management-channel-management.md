# channel-management

## Batch Delete Channels

👨‍💼 需要管理员权限（Admin）

`POST` `/api/channel/batch`

### 请求体（`application/json`）

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `ids` | array&lt;integer&gt; | 否 | — |

### 响应

| 状态码 | 说明 |
|---|---|
| `200` | 成功 |

## Batch Set Channel Tags

👨‍💼 需要管理员权限（Admin）

`POST` `/api/channel/batch/tag`

### 请求体（`application/json`）

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `ids` | array&lt;integer&gt; | 否 | — |
| `tag` | string | 否 | — |

### 响应

| 状态码 | 说明 |
|---|---|
| `200` | 成功 |

## Copy Channel

👨‍💼 需要管理员权限（Admin）

`POST` `/api/channel/copy/{id}`

### 请求参数

| 参数名 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `id` | path | integer | 是 | — |
| `suffix` | query | string | 否 | — |
| `reset_balance` | query | boolean | 否 | — |

### 响应

| 状态码 | 说明 |
|---|---|
| `200` | 成功 |

## Delete Disabled Channels

👨‍💼 需要管理员权限（Admin）

`DELETE` `/api/channel/disabled`

### 响应

| 状态码 | 说明 |
|---|---|
| `200` | 成功 |

## Get Upstream Model List

👨‍💼 需要管理员权限（Admin）

`GET` `/api/channel/fetch_models/{id}`

### 请求参数

| 参数名 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `id` | path | integer | 是 | — |

### 响应

| 状态码 | 说明 |
|---|---|
| `200` | 成功 |

## Get Model List

👨‍💼 需要管理员权限（Admin）

`POST` `/api/channel/fetch_models`

### 请求体（`application/json`）

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `base_url` | string | 否 | — |
| `type` | integer | 否 | — |
| `key` | string | 否 | — |

### 响应

| 状态码 | 说明 |
|---|---|
| `200` | 成功 |

## Fix Channel Capability

👨‍💼 需要管理员权限（Admin）

`POST` `/api/channel/fix`

### 响应

| 状态码 | 说明 |
|---|---|
| `200` | 成功 |

## Get All Channels

👨‍💼 需要管理员权限（Admin）

`GET` `/api/channel/`

### 请求参数

| 参数名 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `p` | query | integer | 否 | — |
| `page_size` | query | integer | 否 | — |
| `id_sort` | query | boolean | 否 | — |
| `tag_mode` | query | boolean | 否 | — |
| `status` | query | string | 否 | — |
| `type` | query | integer | 否 | — |

### 响应

| 状态码 | 说明 |
|---|---|
| `200` | 成功 |

## Delete Channel

👨‍💼 需要管理员权限（Admin）

`DELETE` `/api/channel/{id}`

### 请求参数

| 参数名 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `id` | path | integer | 是 | — |

### 响应

| 状态码 | 说明 |
|---|---|
| `200` | 成功 |

## Get Specific Channel

👨‍💼 需要管理员权限（Admin）

`GET` `/api/channel/{id}`

### 请求参数

| 参数名 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `id` | path | integer | 是 | — |

### 响应

| 状态码 | 说明 |
|---|---|
| `200` | 成功 |

## Get Channel Key

👑 需要超级管理员权限（Root）+ 安全验证

`POST` `/api/channel/{id}/key`

### 请求参数

| 参数名 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `id` | path | integer | 是 | — |

### 响应

| 状态码 | 说明 |
|---|---|
| `200` | 成功 |

## Get Channel Model List

👨‍💼 需要管理员权限（Admin）

`GET` `/api/channel/models`

### 响应

| 状态码 | 说明 |
|---|---|
| `200` | 成功 |

## Get Enabled Model List

👨‍💼 需要管理员权限（Admin）

`GET` `/api/channel/models_enabled`

### 响应

| 状态码 | 说明 |
|---|---|
| `200` | 成功 |

## Manage Multiple Keys

👨‍💼 需要管理员权限（Admin）

`POST` `/api/channel/multi_key/manage`

### 请求体（`application/json`）

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `channel_id` | integer | 否 | — |
| `action` | enum（`get_key_status`, `disable_key`, `enable_key`, `delete_key`, `delete_disabled_keys`, `enable_all_keys` …） | 否 | — |
| `key_index` | integer | 否 | — |

### 响应

| 状态码 | 说明 |
|---|---|
| `200` | 成功 |

## Add Channel

👨‍💼 需要管理员权限（Admin）

`POST` `/api/channel/`

### 请求体（`application/json`）

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `mode` | enum（`single`, `batch`, `multi_to_single`） | 否 | — |
| `channel` | object | 否 | Unresolved $ref: #/definitions/224188811 |

### 响应

| 状态码 | 说明 |
|---|---|
| `200` | 成功 |

## Update Channel

👨‍💼 需要管理员权限（Admin）

`PUT` `/api/channel/`

### 响应

| 状态码 | 说明 |
|---|---|
| `200` | 成功 |

## Search Channels

👨‍💼 需要管理员权限（Admin）

`GET` `/api/channel/search`

### 请求参数

| 参数名 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `keyword` | query | string | 否 | — |
| `group` | query | string | 否 | — |
| `model` | query | string | 否 | — |

### 响应

| 状态码 | 说明 |
|---|---|
| `200` | 成功 |

## Disable Tag Channel

👨‍💼 需要管理员权限（Admin）

`POST` `/api/channel/tag/disabled`

### 请求体（`application/json`）

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `tag` | string | 否 | — |

### 响应

| 状态码 | 说明 |
|---|---|
| `200` | 成功 |

## Enable Tag Channel

👨‍💼 需要管理员权限（Admin）

`POST` `/api/channel/tag/enabled`

### 请求体（`application/json`）

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `tag` | string | 否 | — |

### 响应

| 状态码 | 说明 |
|---|---|
| `200` | 成功 |

## Get Tag Models

👨‍💼 需要管理员权限（Admin）

`GET` `/api/channel/tag/models`

### 请求参数

| 参数名 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `tag` | query | string | 是 | — |

### 响应

| 状态码 | 说明 |
|---|---|
| `200` | 成功 |

## Edit Tag Channel

👨‍💼 需要管理员权限（Admin）

`PUT` `/api/channel/tag`

### 请求体（`application/json`）

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `tag` | string | 否 | — |
| `new_tag` | string | 否 | — |
| `priority` | integer | 否 | — |
| `weight` | integer | 否 | — |

### 响应

| 状态码 | 说明 |
|---|---|
| `200` | 成功 |

## Test All Channels

👨‍💼 需要管理员权限（Admin）

`GET` `/api/channel/test`

### 响应

| 状态码 | 说明 |
|---|---|
| `200` | 成功 |

## Test Specific Channel

👨‍💼 需要管理员权限（Admin）

`GET` `/api/channel/test/{id}`

### 请求参数

| 参数名 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `id` | path | integer | 是 | — |

### 响应

| 状态码 | 说明 |
|---|---|
| `200` | 成功 |

## Update All Channel Balances

👨‍💼 需要管理员权限（Admin）

`GET` `/api/channel/update_balance`

### 响应

| 状态码 | 说明 |
|---|---|
| `200` | 成功 |

## Update Specified Channel Balance

👨‍💼 需要管理员权限（Admin）

`GET` `/api/channel/update_balance/{id}`

### 请求参数

| 参数名 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `id` | path | integer | 是 | — |

### 响应

| 状态码 | 说明 |
|---|---|
| `200` | 成功 |
