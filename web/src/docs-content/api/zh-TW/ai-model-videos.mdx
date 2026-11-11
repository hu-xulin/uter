# 影片（Videos）

## 建立影片生成任務

提交影片生成任務，支援文生影片和圖生影片。

返回任務 ID，可透過 GET 介面查詢任務狀態。

`POST` `/v1/video/generations`

### 請求體（`application/json`）

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
| `200` | 成功建立影片生成任務 |
| `400` | 請求引數錯誤 |

#### `200` 響應欄位

| 欄位 | 型別 | 說明 |
|---|---|---|
| `task_id` | string | 任務 ID |
| `status` | string | 任務狀態 |

#### `400` 響應欄位

| 欄位 | 型別 | 說明 |
|---|---|---|
| `error.message` | string | 錯誤資訊 |
| `error.type` | string | 錯誤型別 |
| `error.param` | string | 相關引數 |
| `error.code` | string | 錯誤程式碼 |

## 獲取影片生成任務狀態

查詢影片生成任務的狀態和結果。

任務狀態：
- `queued`: 排隊中
- `in_progress`: 生成中
- `completed`: 已完成
- `failed`: 失敗

`GET` `/v1/video/generations/{task_id}`

### 請求引數

| 引數名 | 位置 | 型別 | 必填 | 說明 |
|---|---|---|---|---|
| `task_id` | path | string | 是 | 任務 ID |

### 響應

| 狀態碼 | 說明 |
|---|---|
| `200` | 成功獲取任務狀態 |
| `404` | 任務不存在 |

#### `200` 響應欄位

| 欄位 | 型別 | 說明 |
|---|---|---|
| `task_id` | string | 任務 ID |
| `status` | enum（`queued`, `in_progress`, `completed`, `failed`） | 任務狀態 |
| `url` | string | 影片資源 URL（成功時） |
| `format` | string | 影片格式 |
| `metadata.duration` | number | 實際生成的影片時長 |
| `metadata.fps` | integer | 實際幀率 |
| `metadata.width` | integer | 實際寬度 |
| `metadata.height` | integer | 實際高度 |
| `metadata.seed` | integer | 使用的隨機種子 |
| `error.code` | integer | 錯誤碼 |
| `error.message` | string | 錯誤資訊 |

#### `404` 響應欄位

| 欄位 | 型別 | 說明 |
|---|---|---|
| `error.message` | string | 錯誤資訊 |
| `error.type` | string | 錯誤型別 |
| `error.param` | string | 相關引數 |
| `error.code` | string | 錯誤程式碼 |
