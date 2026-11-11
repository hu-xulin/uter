# Seedance格式

Seedance 影片生成（Dreamina）：透過非同步任務介面呼叫 Dreamina Seedance 2.0 系列模型，支援文生影片、圖生影片、影片續寫 / 編輯。

## 支援的模型

| 模型 | 說明 | 支援能力 |
|---|---|---|
| `dreamina-seedance-2-0` | 標準版，畫質優先 | 文生影片、圖生影片、影片續寫 |
| `dreamina-seedance-2-0-fast` | 快速版，延遲更低 | 文生影片、圖生影片、影片續寫 |

兩個模型都支援**影片作為輸入**（影片續寫 / 編輯），在 `metadata.content` 中傳入 `video_url` 即可。

## 建立影片

`POST` `/v1/video/generations`

### 請求頭

| Header | 必填 | 說明 |
|---|---|---|
| `Authorization` | 是 | `Bearer sk-你的APIKey` |
| `Content-Type` | 是 | `application/json` |

### 請求體（`application/json`）

| 欄位 | 型別 | 必填 | 說明 |
|---|---|---|---|
| `model` | string | 是 | Seedance 模型名，見上表 |
| `prompt` | string | 是 | 影片描述提示詞 |
| `image` | string | 否 | 圖生影片的參考圖（URL 或 base64 data URI）；與 `images` 二選一 |
| `images` | string[] | 否 | 多圖參考（URL 或 base64 data URI） |
| `duration` | int | 否 | 影片時長（秒），常見 5 / 10 秒，預設 5 |
| `seconds` | string | 否 | `duration` 的字串形式（相容 OpenAI Sora API）。必須是純數字字串（如 `"5"`、`"10"`），不能帶單位。僅在頂層 `duration` 為 `0` 或未傳時生效 |
| `metadata` | object | 否 | Seedance 特有引數容器，見「特有引數」 |

### 響應

| 狀態碼 | 說明 |
|---|---|
| `200` | 成功建立影片任務 |
| `400` | 請求引數錯誤 |

#### `200` 響應欄位

| 欄位 | 型別 | 說明 |
|---|---|---|
| `id` / `task_id` | string | 公開任務 ID（`task_` 字首），用於後續查詢 |
| `object` | string | 物件型別（`video`） |
| `model` | string | 使用的模型 |
| `status` | string | 任務狀態（提交後為 `queued`） |
| `progress` | integer | 進度百分比 |
| `created_at` | integer | 建立時間戳 |

> `id` / `task_id` 由優特智慧生成，不等於上游任務 id。

## 獲取影片任務狀態

`GET` `/v1/video/generations/{task_id}`

響應結構為 `{code, message, data}` 包裝；成功時 `code` 為 `"success"`，`data` 是任務詳情物件。

### 請求引數

| 引數名 | 位置 | 型別 | 必填 | 說明 |
|---|---|---|---|---|
| `task_id` | path | string | 是 | 影片任務 ID |

### 響應

| 狀態碼 | 說明 |
|---|---|
| `200` | 成功獲取影片任務狀態 |
| `404` | 任務不存在 |

#### `200` 響應欄位（`data`）

| 欄位 | 型別 | 說明 |
|---|---|---|
| `data.id` | int | 內部任務自增 ID |
| `data.task_id` | string | 公開任務 ID（`task_` 字首） |
| `data.platform` | string | 上游平臺編號 |
| `data.user_id` | int | 使用者 ID |
| `data.group` | string | 所屬分組 |
| `data.channel_id` | int | 實際呼叫的渠道 ID |
| `data.quota` | int | 本次任務扣費的 quota 原始值 |
| `data.action` | string | 任務動作，通常為 `generate` |
| `data.status` | string | 任務狀態：`SUBMITTED` / `QUEUED` / `IN_PROGRESS` / `SUCCESS` / `FAILURE` |
| `data.fail_reason` | string | 失敗原因（僅 `status = FAILURE` 時非空） |
| `data.result_url` | string | 影片結果 URL（僅成功時返回，為上游臨時連結） |
| `data.progress` | string | 進度，形如 `"100%"` |
| `data.submit_time` / `start_time` / `finish_time` | int64 | 提交 / 開始 / 完成的 Unix 時間戳（秒） |
| `data.properties.upstream_model_name` | string | 實際發給上游的模型名 |
| `data.data` | object | 上游原始響應（含 `usage`、`content.video_url`、`resolution`、`framespersecond` 等） |

#### 狀態列舉

| 狀態 | 說明 |
|---|---|
| `SUBMITTED` | 已提交 |
| `QUEUED` | 已進入上游佇列 |
| `IN_PROGRESS` | 生成中 |
| `SUCCESS` | 已完成，`result_url` 為影片地址 |
| `FAILURE` | 生成失敗，`fail_reason` 為失敗原因 |

## 獲取影片內容

`GET` `/v1/videos/{task_id}/content`

直接返回影片二進位制流（`Content-Type: video/mp4`）。優特智慧自動代理上游 URL。

### 請求引數

| 引數名 | 位置 | 型別 | 必填 | 說明 |
|---|---|---|---|---|
| `task_id` | path | string | 是 | 影片任務 ID |

> **強烈推薦**使用 `/content` 代理介面下載影片，而不是直接訪問 `result_url`。後者是上游的臨時連結，有效期有限。

## 特有引數（`metadata`）

所有 Seedance 特有欄位都透過請求體的 `metadata` 物件傳遞，優特智慧會透傳給上游。

### 解析度 / 寬高比 / 時長

| 欄位 | 型別 | 說明 |
|---|---|---|
| `resolution` | string | 解析度檔位：`480p` `720p` `1080p` |
| `ratio` | string | 寬高比：`16:9` `9:16` `1:1` `4:3` `3:4` `21:9` `adaptive`（自適應） |
| `duration` | int | 影片時長（秒），`5` `10`。**注意：**頂層 `duration`（或 `seconds`）優先順序高於 `metadata.duration` |
| `frames` | int | 指定幀數（可選，與 `duration` 互斥），如 `121` |
| `seed` | int | 隨機種子，`0` ~ `2^31-1` |

### 鏡頭與內容控制

| 欄位 | 型別 | 說明 |
|---|---|---|
| `camera_fixed` | bool | 是否固定鏡頭（`true` = 鏡頭靜止） |
| `watermark` | bool | 是否新增官方水印 |

### 高階引數

| 欄位 | 型別 | 說明 |
|---|---|---|
| `service_tier` | string | 服務檔位，影響速度與配額（如 `auto` / `default` / `priority`） |
| `execution_expires_after` | int | 任務執行超時時間（秒） |
| `generate_audio` | bool | 是否同步生成音訊 |
| `draft` | bool | 草稿模式（更快速、更便宜，質量略降） |
| `return_last_frame` | bool | 是否在響應中返回影片最後一幀圖片 |
| `callback_url` | string | 任務完成後的回撥通知 URL |

### 多模態輸入（`content` 陣列）

除頂層 `image` / `images` 欄位外，也可直接在 `metadata.content` 傳遞多模態輸入陣列，支援**圖片**和**影片**混合輸入：

| `type` | 用途 |
|---|---|
| `image_url` + `image_url.url` | 圖片參考（圖生影片） |
| `video_url` + `video_url.url` | 影片輸入（影片續寫 / 編輯） |

```json
{
  "model": "dreamina-seedance-2-0",
  "prompt": "把这段视频延长，让猫咪走到画面外",
  "metadata": {
    "content": [
      { "type": "video_url", "video_url": { "url": "https://example.com/cat.mp4" } }
    ],
    "resolution": "720p"
  }
}
```

## 完整呼叫示例

```bash
# 文生视频
curl -X POST https://uter.ai/v1/video/generations \
  -H "Authorization: Bearer sk-你的APIKey" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "dreamina-seedance-2-0",
    "prompt": "一只猫在月球表面漫步，背景是璀璨的星空",
    "duration": 5,
    "metadata": { "resolution": "720p", "ratio": "16:9", "seed": 42 }
  }'

# 轮询任务
curl https://uter.ai/v1/video/generations/task_xxx \
  -H "Authorization: Bearer sk-你的APIKey"

# 下载视频
curl https://uter.ai/v1/videos/task_xxx/content \
  -H "Authorization: Bearer sk-你的APIKey" \
  -o cat_on_moon.mp4
```

## 狀態碼與錯誤

| 場景 | 說明 |
|---|---|
| `400` | 模型不存在或未授權（`model not allowed`）、`prompt` 為空（`prompt is required`）、解析度 / 時長引數非法 |
| `401` / `403` | API Key 無效 / 無權訪問此模型（檢查 token 模型白名單） |
| `402` | 餘額不足（`insufficient user quota`） |
| 任務 `FAILURE` | 上游生成失敗（內容稽核失敗 / 圖片影片 URL 不可訪問 / 上游超時）；優特智慧會自動退回已扣費用 |

常見處理建議：內容稽核失敗時調整 prompt；URL 不可訪問時改為 base64；上游超時時稍後重試或切換到 `dreamina-seedance-2-0-fast`。
