# HappyHorse格式

HappyHorse（快樂馬）影片生成：透過非同步任務介面呼叫 HappyHorse 1.0 全系列模型，支援文生影片、圖生影片、參考生影片、影片編輯四種能力。

## 支援的模型

4 個模型統一使用同一介面路徑 `/v1/video/generations`，僅透過 `model` 欄位區分能力，響應體結構完全一致。

| 模型 | 能力 | 必傳媒體輸入 | 說明 |
|---|---|---|---|
| `happyhorse-1.0-t2v` | 文生影片 | — | 純文字描述生成影片 |
| `happyhorse-1.0-i2v` | 圖生影片 | 1 張首幀圖 | 以首幀圖為起點，按 prompt 生成後續動作 |
| `happyhorse-1.0-r2v` | 參考生影片 | 1~9 張參考圖 | 多圖參考生成，prompt 中用 `[Image N]` 指代 |
| `happyhorse-1.0-video-edit` | 影片編輯 | 1 段影片 + 0~5 張參考圖 | 對影片做風格變換、區域性替換等編輯 |

## 建立影片

提交影片生成任務，返回任務 ID，可透過查詢介面輪詢狀態。

`POST` `/v1/video/generations`

### 請求頭

| Header | 必填 | 說明 |
|---|---|---|
| `Authorization` | 是 | `Bearer sk-你的APIKey` |
| `Content-Type` | 是 | `application/json` |

### 請求體（`application/json`）

| 欄位 | 型別 | 必填 | 說明 |
|---|---|---|---|
| `model` | string | 是 | HappyHorse 模型名，見上表 |
| `prompt` | string | 是 | 文字提示詞，不超過 5000 個非中文字元或 2500 箇中文字元，超長自動截斷 |
| `size` | string | 否 | 解析度檔位，可選 `720P` / `1080P`，預設 `1080P` |
| `duration` | int | 否 | 影片時長（秒），取值 `3 ~ 15`，預設 `5`；`video-edit` 忽略此欄位（時長跟隨輸入影片，最長 15 秒） |
| `input_reference` | string | 否 | i2v 專用：首幀圖 URL（公網可訪問） |
| `metadata` | object | 否 | HappyHorse 特有引數容器，見「特有引數」 |

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

> `id` / `task_id` 由優特智慧生成，不等於上游 DashScope 的 task_id，請使用此處返回的值。

## 獲取影片任務狀態

`GET` `/v1/video/generations/{task_id}`

響應採用優特智慧統一的 `{code, message, data}` 包裝格式。

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
| `data.task_id` | string | 公開任務 ID |
| `data.status` | string | 任務狀態：`NOT_START` / `QUEUED` / `IN_PROGRESS` / `SUCCESS` / `FAILURE` |
| `data.result_url` | string | 影片結果 URL（僅 `SUCCESS` 時非空，為上游 OSS 臨時簽名連結，一般 24 小時有效） |
| `data.fail_reason` | string | 失敗原因（僅 `FAILURE` 時非空） |
| `data.quota` | int | 本次任務扣費的 quota 原始值 |
| `data.progress` | string | 進度字串，形如 `"30%"` / `"100%"` |
| `data.submit_time` / `start_time` / `finish_time` | int64 | 提交 / 開始 / 完成的 Unix 時間戳（秒） |
| `data.properties.upstream_model_name` | string | 實際發給上游的模型名 |
| `data.data` | object | 上游 DashScope 原始響應（含 `output.video_url`、`usage`、`request_id`） |

#### 狀態列舉

| 狀態 | 上游狀態 | 說明 |
|---|---|---|
| `NOT_START` | `PENDING` | 已建立，尚未開始處理（提交瞬間） |
| `QUEUED` | `PENDING` | 已進入上游佇列 |
| `IN_PROGRESS` | `RUNNING` | 生成中 |
| `SUCCESS` | `SUCCEEDED` | 已完成，`result_url` 為影片地址 |
| `FAILURE` | `FAILED` / `CANCELED` / `UNKNOWN` | 生成失敗，`fail_reason` 為失敗原因 |

## 特有引數（`metadata`）

以下欄位透過請求體的 `metadata` 物件傳遞，優特智慧會透傳給上游 DashScope。

### 影片控制引數

| 欄位 | 型別 | 適用模型 | 說明 | 預設值 |
|---|---|---|---|---|
| `ratio` | string | t2v / r2v | 寬高比：`16:9` / `9:16` / `1:1` / `4:3` / `3:4` | `16:9` |
| `watermark` | bool | 所有 | 是否新增水印（右下角 "Happy Horse" 字樣） | `true` |
| `seed` | int | 所有 | 隨機種子，取值 `0 ~ 2147483647`，未指定自動生成 | — |
| `audio_setting` | string | video-edit | 聲音控制：`auto`（模型控制）/ `origin`（保留原影片聲音） | `auto` |

> i2v 不支援 `ratio`，圖生影片的寬高比自動跟隨輸入首幀圖的比例。

### 多媒體輸入（`metadata.input.media`）

r2v 與 video-edit 透過 `metadata.input.media` 陣列傳入媒體素材：

| `type` | 用途 | 數量限制 |
|---|---|---|
| `reference_image` | 參考圖片（r2v 和 video-edit 均支援） | r2v：1~9 張；video-edit：0~5 張 |
| `video` | 待編輯影片（僅 video-edit 使用） | 必須且僅有 1 個 |
| `first_frame` | 首幀圖（僅 i2v 使用，也可透過頂層 `input_reference` 傳遞） | 僅 1 張 |

r2v 提示詞規範：在 prompt 中透過 `[Image 1]`、`[Image 2]` 按陣列順序指代參考圖。

### 媒體素材限制

| 型別 | 格式 | 解析度 | 檔案大小 | 其他限制 |
|---|---|---|---|---|
| 圖片（i2v 首幀） | JPEG / JPG / PNG / WEBP | 寬高 ≥ 300 畫素 | ≤ 10 MB | 寬高比 1:2.5 ~ 2.5:1 |
| 圖片（r2v 參考圖） | JPEG / JPG / PNG / WEBP | 短邊 ≥ 400 畫素（推薦 720P+） | ≤ 10 MB | 推薦清晰圖，避免模糊過壓 |
| 圖片（video-edit 參考圖） | JPEG / JPG / PNG / WEBP | 寬高 ≥ 300 畫素 | ≤ 10 MB | 寬高比 1:2.5 ~ 2.5:1 |
| 影片（video-edit 輸入） | MP4 / MOV（推薦 H.264） | 長邊 ≤ 2160，短邊 ≥ 320 | ≤ 100 MB | 3~60 秒，>8 fps，寬高比 1:2.5 ~ 2.5:1 |

> video-edit 輸出時長規則：輸入影片 ≤ 15 秒時輸出等同長度；輸入影片 > 15 秒時系統自動擷取前 15 秒。

## OpenAI 相容介面

除 `/v1/video/generations` 外，同時相容 OpenAI 風格的 `/v1/videos` 介面，兩套介面完全等價（同一後端任務）。

- 提交：`POST` `/v1/videos`（請求體欄位完全一致）
- 查詢：`GET` `/v1/videos/{task_id}`（返回 OpenAI 扁平格式）

| OpenAI 狀態 | 對應統一狀態 |
|---|---|
| `queued` | `NOT_START` / `QUEUED` |
| `in_progress` | `IN_PROGRESS` |
| `completed` | `SUCCESS` |
| `failed` | `FAILURE` |

## 完整呼叫示例

```bash
# Step 1: 提交任务
curl -X POST https://uter.ai/v1/video/generations \
  -H "Authorization: Bearer sk-你的APIKey" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "happyhorse-1.0-t2v",
    "prompt": "一只猫在阳光下打盹，毛毛随风轻轻摇曳",
    "size": "720P",
    "duration": 5,
    "metadata": { "ratio": "16:9", "seed": 42, "watermark": false }
  }'

# Step 2: 轮询任务状态（建议间隔 10~15 秒）
curl https://uter.ai/v1/video/generations/task_xxx \
  -H "Authorization: Bearer sk-你的APIKey"

# Step 3: data.status == "SUCCESS" 后，从 data.result_url 下载视频
```

## 狀態碼與錯誤

| 場景 | 說明 |
|---|---|
| `400` | 引數錯誤（未傳 `prompt`、模型名未知等），提交前攔截，不扣費 |
| `401` / `403` | API Key 無效 / 無權訪問此模型（檢查 token 模型白名單） |
| `402` | 餘額不足（`insufficient user quota`），請前往優特智慧控制檯充值 |
| 任務 `FAILURE` | 上游生成失敗，見 `data.fail_reason`；優特智慧會自動退款，可在日誌頁面查詢退款記錄 |

常見 `FAILURE` 原因：內容稽核失敗（調整 prompt）、i2v 未提供 `input_reference`、r2v 參考圖為 0 張、video-edit 未提供影片、媒體 URL 不可訪問或不符合素材規格。
