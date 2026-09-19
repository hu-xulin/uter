# system-settings

## Get System Options

👑 需要超级管理员权限（Root）

`GET` `/api/option/`

### 响应

| 状态码 | 说明 |
|---|---|
| `200` | 成功 |

## Migrate Console Settings

👑 需要超级管理员权限（Root）

`POST` `/api/option/migrate_console_setting`

### 响应

| 状态码 | 说明 |
|---|---|
| `200` | 成功 |

## Update System Options

👑 需要超级管理员权限（Root）

`PUT` `/api/option/`

### 响应

| 状态码 | 说明 |
|---|---|
| `200` | 成功 |

## Reset Model Ratio

👑 需要超级管理员权限（Root）

`POST` `/api/option/rest_model_ratio`

### 响应

| 状态码 | 说明 |
|---|---|
| `200` | 成功 |

## Get Syncable Channels

👑 需要超级管理员权限（Root）

`GET` `/api/ratio_sync/channels`

### 响应

| 状态码 | 说明 |
|---|---|
| `200` | 成功 |

## Fetch Upstream Ratios

👑 需要超级管理员权限（Root）

`POST` `/api/ratio_sync/fetch`

### 响应

| 状态码 | 说明 |
|---|---|
| `200` | 成功 |
