# Sora格式

## 建立影片 

OpenAI 相容的影片生成介面。

參考文件: https://platform.openai.com/docs/api-reference/videos/create

`POST` `/v1/videos`

### 請求體（`multipart/form-data`）

| 欄位 | 型別 | 必填 | 說明 |
|---|---|---|---|
| `model` | string | 否 | 模型/風格 ID |
| `prompt` | string | 否 | 文字描述提示詞 |
| `image` | string | 否 | 圖片輸入 (URL 或 Base64) |
| `duration` | number | 否 | 影片時長（秒） |
| `width` | integer | 否 | 影片寬度 |
| `height` | integer | 否 | 影片高度 |
| `fps` | integer | 否 | 影片幀率 |
| `seed` | integer | 否 | 隨機種子 |
| `n` | integer | 否 | 生成影片數量 |
| `response_format` | string | 否 | 響應格式 |
| `user` | string | 否 | 使用者標識 |
| `metadata` | object | 否 | 擴充套件引數 (如 negative_prompt, style, quality_level 等) |

### 響應

| 狀態碼 | 說明 |
|---|---|
| `200` | 成功建立影片任務 |
| `400` | 請求引數錯誤 |

#### `200` 響應欄位

| 欄位 | 型別 | 說明 |
|---|---|---|
| `id` | string | 影片 ID |
| `object` | string | 物件型別 |
| `model` | string | 使用的模型 |
| `status` | string | 任務狀態 |
| `progress` | integer | 進度百分比 |
| `created_at` | integer | 建立時間戳 |
| `seconds` | string | 影片時長 |
| `completed_at` | integer | 完成時間戳 |
| `expires_at` | integer | 過期時間戳 |
| `size` | string | 影片尺寸 |
| `error.message` | string | 錯誤資訊 |
| `error.code` | string | 錯誤碼 |
| `metadata` | object | 額外後設資料 |

#### `400` 響應欄位

| 欄位 | 型別 | 說明 |
|---|---|---|
| `error.message` | string | 錯誤資訊 |
| `error.type` | string | 錯誤型別 |
| `error.param` | string | 相關引數 |
| `error.code` | string | 錯誤程式碼 |

## 獲取影片任務狀態 

OpenAI 相容的影片任務狀態查詢介面。

返回影片任務的詳細狀態資訊。

`GET` `/v1/videos/{task_id}`

### 請求引數

| 引數名 | 位置 | 型別 | 必填 | 說明 |
|---|---|---|---|---|
| `task_id` | path | string | 是 | 影片任務 ID |

### 響應

| 狀態碼 | 說明 |
|---|---|
| `200` | 成功獲取影片任務狀態 |
| `404` | 任務不存在 |

#### `200` 響應欄位

| 欄位 | 型別 | 說明 |
|---|---|---|
| `id` | string | — |
| `object` | string | — |
| `model` | string | — |
| `status` | string | — |
| `progress` | integer | — |
| `created_at` | integer | — |
| `seconds` | string | — |

#### `404` 響應欄位

| 欄位 | 型別 | 說明 |
|---|---|---|
| `error.message` | string | 錯誤資訊 |
| `error.type` | string | 錯誤型別 |
| `error.param` | string | 相關引數 |
| `error.code` | string | 錯誤程式碼 |

## 獲取影片內容

獲取已完成影片任務的影片檔案內容。

此介面會代理返回影片檔案流。

`GET` `/v1/videos/{task_id}/content`

### 請求引數

| 引數名 | 位置 | 型別 | 必填 | 說明 |
|---|---|---|---|---|
| `task_id` | path | string | 是 | 影片任務 ID |

### 響應

| 狀態碼 | 說明 |
|---|---|
| `200` | 成功獲取影片內容 |
| `404` | 影片不存在或未完成 |

#### `404` 響應欄位

| 欄位 | 型別 | 說明 |
|---|---|---|
| `error.message` | string | 錯誤資訊 |
| `error.type` | string | 錯誤型別 |
| `error.param` | string | 相關引數 |
| `error.code` | string | 錯誤程式碼 |
