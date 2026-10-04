# 渠道管理

## 批次刪除渠道

👨‍💼 需要管理員許可權（Admin）

`POST` `/api/channel/batch`

### 請求體（`application/json`）

| 欄位 | 型別 | 必填 | 說明 |
|---|---|---|---|
| `ids` | array&lt;integer&gt; | 否 | — |

### 響應

| 狀態碼 | 說明 |
|---|---|
| `200` | 成功 |

## 批次設定渠道標籤

👨‍💼 需要管理員許可權（Admin）

`POST` `/api/channel/batch/tag`

### 請求體（`application/json`）

| 欄位 | 型別 | 必填 | 說明 |
|---|---|---|---|
| `ids` | array&lt;integer&gt; | 否 | — |
| `tag` | string | 否 | — |

### 響應

| 狀態碼 | 說明 |
|---|---|
| `200` | 成功 |

## 複製渠道

👨‍💼 需要管理員許可權（Admin）

`POST` `/api/channel/copy/{id}`

### 請求引數

| 引數名 | 位置 | 型別 | 必填 | 說明 |
|---|---|---|---|---|
| `id` | path | integer | 是 | — |
| `suffix` | query | string | 否 | — |
| `reset_balance` | query | boolean | 否 | — |

### 響應

| 狀態碼 | 說明 |
|---|---|
| `200` | 成功 |

## 刪除已禁用渠道

👨‍💼 需要管理員許可權（Admin）

`DELETE` `/api/channel/disabled`

### 響應

| 狀態碼 | 說明 |
|---|---|
| `200` | 成功 |

## 獲取上游模型列表

👨‍💼 需要管理員許可權（Admin）

`GET` `/api/channel/fetch_models/{id}`

### 請求引數

| 引數名 | 位置 | 型別 | 必填 | 說明 |
|---|---|---|---|---|
| `id` | path | integer | 是 | — |

### 響應

| 狀態碼 | 說明 |
|---|---|
| `200` | 成功 |

## 獲取模型列表

👨‍💼 需要管理員許可權（Admin）

`POST` `/api/channel/fetch_models`

### 請求體（`application/json`）

| 欄位 | 型別 | 必填 | 說明 |
|---|---|---|---|
| `base_url` | string | 否 | — |
| `type` | integer | 否 | — |
| `key` | string | 否 | — |

### 響應

| 狀態碼 | 說明 |
|---|---|
| `200` | 成功 |

## 修復渠道能力

👨‍💼 需要管理員許可權（Admin）

`POST` `/api/channel/fix`

### 響應

| 狀態碼 | 說明 |
|---|---|
| `200` | 成功 |

## 獲取所有渠道

👨‍💼 需要管理員許可權（Admin）

`GET` `/api/channel/`

### 請求引數

| 引數名 | 位置 | 型別 | 必填 | 說明 |
|---|---|---|---|---|
| `p` | query | integer | 否 | — |
| `page_size` | query | integer | 否 | — |
| `id_sort` | query | boolean | 否 | — |
| `tag_mode` | query | boolean | 否 | — |
| `status` | query | string | 否 | — |
| `type` | query | integer | 否 | — |

### 響應

| 狀態碼 | 說明 |
|---|---|
| `200` | 成功 |

## 刪除渠道

👨‍💼 需要管理員許可權（Admin）

`DELETE` `/api/channel/{id}`

### 請求引數

| 引數名 | 位置 | 型別 | 必填 | 說明 |
|---|---|---|---|---|
| `id` | path | integer | 是 | — |

### 響應

| 狀態碼 | 說明 |
|---|---|
| `200` | 成功 |

## 獲取指定渠道

👨‍💼 需要管理員許可權（Admin）

`GET` `/api/channel/{id}`

### 請求引數

| 引數名 | 位置 | 型別 | 必填 | 說明 |
|---|---|---|---|---|
| `id` | path | integer | 是 | — |

### 響應

| 狀態碼 | 說明 |
|---|---|
| `200` | 成功 |

## 獲取渠道金鑰

👑 需要超級管理員許可權（Root）+ 安全驗證

`POST` `/api/channel/{id}/key`

### 請求引數

| 引數名 | 位置 | 型別 | 必填 | 說明 |
|---|---|---|---|---|
| `id` | path | integer | 是 | — |

### 響應

| 狀態碼 | 說明 |
|---|---|
| `200` | 成功 |

## 獲取渠道模型列表

👨‍💼 需要管理員許可權（Admin）

`GET` `/api/channel/models`

### 響應

| 狀態碼 | 說明 |
|---|---|
| `200` | 成功 |

## 獲取已啟用模型列表

👨‍💼 需要管理員許可權（Admin）

`GET` `/api/channel/models_enabled`

### 響應

| 狀態碼 | 說明 |
|---|---|
| `200` | 成功 |

## 管理多金鑰

👨‍💼 需要管理員許可權（Admin）

`POST` `/api/channel/multi_key/manage`

### 請求體（`application/json`）

| 欄位 | 型別 | 必填 | 說明 |
|---|---|---|---|
| `channel_id` | integer | 否 | — |
| `action` | enum（`get_key_status`, `disable_key`, `enable_key`, `delete_key`, `delete_disabled_keys`, `enable_all_keys` …） | 否 | — |
| `key_index` | integer | 否 | — |

### 響應

| 狀態碼 | 說明 |
|---|---|
| `200` | 成功 |

## 新增渠道

👨‍💼 需要管理員許可權（Admin）

`POST` `/api/channel/`

### 請求體（`application/json`）

| 欄位 | 型別 | 必填 | 說明 |
|---|---|---|---|
| `mode` | enum（`single`, `batch`, `multi_to_single`） | 否 | — |
| `channel` | object | 否 | Unresolved $ref: #/definitions/224188811 |

### 響應

| 狀態碼 | 說明 |
|---|---|
| `200` | 成功 |

## 更新渠道

👨‍💼 需要管理員許可權（Admin）

`PUT` `/api/channel/`

### 響應

| 狀態碼 | 說明 |
|---|---|
| `200` | 成功 |

## 搜尋渠道

👨‍💼 需要管理員許可權（Admin）

`GET` `/api/channel/search`

### 請求引數

| 引數名 | 位置 | 型別 | 必填 | 說明 |
|---|---|---|---|---|
| `keyword` | query | string | 否 | — |
| `group` | query | string | 否 | — |
| `model` | query | string | 否 | — |

### 響應

| 狀態碼 | 說明 |
|---|---|
| `200` | 成功 |

## 禁用標籤渠道

👨‍💼 需要管理員許可權（Admin）

`POST` `/api/channel/tag/disabled`

### 請求體（`application/json`）

| 欄位 | 型別 | 必填 | 說明 |
|---|---|---|---|
| `tag` | string | 否 | — |

### 響應

| 狀態碼 | 說明 |
|---|---|
| `200` | 成功 |

## 啟用標籤渠道

👨‍💼 需要管理員許可權（Admin）

`POST` `/api/channel/tag/enabled`

### 請求體（`application/json`）

| 欄位 | 型別 | 必填 | 說明 |
|---|---|---|---|
| `tag` | string | 否 | — |

### 響應

| 狀態碼 | 說明 |
|---|---|
| `200` | 成功 |

## 獲取標籤模型

👨‍💼 需要管理員許可權（Admin）

`GET` `/api/channel/tag/models`

### 請求引數

| 引數名 | 位置 | 型別 | 必填 | 說明 |
|---|---|---|---|---|
| `tag` | query | string | 是 | — |

### 響應

| 狀態碼 | 說明 |
|---|---|
| `200` | 成功 |

## 編輯標籤渠道

👨‍💼 需要管理員許可權（Admin）

`PUT` `/api/channel/tag`

### 請求體（`application/json`）

| 欄位 | 型別 | 必填 | 說明 |
|---|---|---|---|
| `tag` | string | 否 | — |
| `new_tag` | string | 否 | — |
| `priority` | integer | 否 | — |
| `weight` | integer | 否 | — |

### 響應

| 狀態碼 | 說明 |
|---|---|
| `200` | 成功 |

## 測試所有渠道

👨‍💼 需要管理員許可權（Admin）

`GET` `/api/channel/test`

### 響應

| 狀態碼 | 說明 |
|---|---|
| `200` | 成功 |

## 測試指定渠道

👨‍💼 需要管理員許可權（Admin）

`GET` `/api/channel/test/{id}`

### 請求引數

| 引數名 | 位置 | 型別 | 必填 | 說明 |
|---|---|---|---|---|
| `id` | path | integer | 是 | — |

### 響應

| 狀態碼 | 說明 |
|---|---|
| `200` | 成功 |

## 更新所有渠道餘額

👨‍💼 需要管理員許可權（Admin）

`GET` `/api/channel/update_balance`

### 響應

| 狀態碼 | 說明 |
|---|---|
| `200` | 成功 |

## 更新指定渠道餘額

👨‍💼 需要管理員許可權（Admin）

`GET` `/api/channel/update_balance/{id}`

### 請求引數

| 引數名 | 位置 | 型別 | 必填 | 說明 |
|---|---|---|---|---|
| `id` | path | integer | 是 | — |

### 響應

| 狀態碼 | 說明 |
|---|---|
| `200` | 成功 |
