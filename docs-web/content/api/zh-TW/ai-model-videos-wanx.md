# 萬相格式

萬相 2.7（Wan 2.7）影片生成：透過非同步任務介面呼叫萬相 2.7 全系列模型，支援文生影片、圖生影片、參考生影片、影片編輯四種能力，支援 1080P 畫質、最長 15 秒、多鏡頭敘事與原生音訊同步。

## 支援的模型

4 個模型統一使用同一介面路徑 `/v1/video/generations`，僅透過 `model` 欄位區分能力，響應體結構完全一致。

| 模型 | 能力 | 必傳媒體輸入 | 說明 |
|---|---|---|---|
| `wan2.7-t2v` | 文生影片 | — | 純文字描述生成影片，支援多鏡頭敘事與音訊同步 |
| `wan2.7-i2v` | 圖生影片 | 1 張首幀圖 | 以首幀圖為起點，按 prompt 生成後續動作 |
| `wan2.7-r2v` | 參考生影片 | 1~9 張參考圖 | 多圖參考生成，保持角色/物體一致性，prompt 中用 `[Image N]` 指代 |
| `wan2.7-videoedit` | 影片編輯 | 1 段影片 + 0~3 張參考圖 | 按文字指令對影片做風格轉換、元素替換、區域性修改 |

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
| `model` | string | 是 | 萬相 2.7 模型名，見上表 |
| `prompt` | string | 是 | 文字提示詞，最長 5000 字元，支援中英文 |
| `resolution` | string | 否 | 解析度檔位，可選 `720P` / `1080P`，預設 `720P`。**推薦使用此欄位**，與阿里雲官方 API 欄位名一致 |
| `size` | string | 否 | 相容舊版欄位名。與 `resolution` 同時傳入時 `resolution` 優先；僅傳 `size` 時以其值作解析度。新接入建議改用 `resolution` |
| `duration` | int | 否 | 影片時長（秒），t2v/i2v 取值 `2 ~ 15`，預設 `5`；r2v 含參考影片時取值 `2 ~ 10`；`videoedit` 忽略此欄位（跟隨輸入影片，最長 15 秒） |
| `input_reference` | string | 否 | i2v 專用：首幀圖公網 URL |
| `images` | array | 否 | videoedit 專用：媒體 URL 陣列，第 1 個元素為待編輯影片（MP4/MOV），後續元素為參考圖（可選，最多 3 張） |
| `metadata` | object | 否 | 萬相 2.7 特有引數容器，見「特有引數」 |

> `images` 欄位目前處於發版過渡期：發版前請使用 `metadata.input.media` 陣列傳入媒體素材；發版後系統會自動根據 URL 副檔名推斷媒體型別，`images` 欄位即可直接使用。

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
| `data.result_url` | string | 影片結果 URL（僅 `SUCCESS` 時非空，為上游 OSS 臨時簽名連結，24 小時有效） |
| `data.fail_reason` | string | 失敗原因（僅 `FAILURE` 時非空） |
| `data.quota` | int | 本次任務扣費的 quota 原始值 |
| `data.progress` | string | 進度字串，形如 `"40%"` / `"100%"` |
| `data.properties.upstream_model_name` | string | 實際發給上游的模型名 |
| `data.data` | object | 上游 DashScope 原始響應（含 `output.video_url`、`usage`、`request_id`） |

#### 狀態列舉

| 狀態 | 上游狀態 | 說明 |
|---|---|---|
| `NOT_START` | `PENDING` | 已建立，尚未開始處理 |
| `QUEUED` | `PENDING` | 已進入上游佇列 |
| `IN_PROGRESS` | `RUNNING` | 生成中 |
| `SUCCESS` | `SUCCEEDED` | 已完成，`result_url` 為影片地址 |
| `FAILURE` | `FAILED` / `CANCELED` / `UNKNOWN` | 生成失敗，`fail_reason` 為失敗原因 |

## 特有引數（`metadata`）

以下欄位透過請求體的 `metadata` 物件傳遞，優特智慧會透傳給上游 DashScope。

### 通用控制引數

| 欄位 | 型別 | 適用模型 | 說明 | 預設值 |
|---|---|---|---|---|
| `ratio` | string | t2v / r2v | 寬高比：`16:9` / `9:16` / `1:1` / `4:3` / `3:4` | `16:9` |
| `seed` | int | 所有 | 隨機種子，取值 `0 ~ 2147483647`，未指定自動生成 | — |
| `negative_prompt` | string | 所有 | 負向提示詞，最長 500 字元 | — |

> i2v 不支援 `ratio`，圖生影片的寬高比自動跟隨輸入首幀圖的比例。

### 多媒體輸入（`metadata.input.media`）

r2v 與 videoedit 如需透過 `metadata` 傳入媒體素材，使用 `metadata.input.media` 陣列：

| `type` | 用途 | 數量限制 |
|---|---|---|
| `reference_image` | 參考圖片 | r2v：1~9 張；videoedit：0~3 張 |
| `video` | 待編輯影片（僅 videoedit 使用） | 必須且僅有 1 個 |
| `first_frame` | 首幀圖（僅 i2v 使用，也可透過頂層 `input_reference` 傳遞） | 僅 1 張 |

r2v 提示詞規範：在 prompt 中透過 `[Image 1]`、`[Image 2]` 按陣列順序指代參考圖。

### 媒體素材限制

| 型別 | 格式 | 解析度 | 檔案大小 | 其他限制 |
|---|---|---|---|---|
| 圖片（i2v 首幀） | JPEG / JPG / PNG / WEBP | 寬高 240 ~ 8000 畫素 | ≤ 10 MB | 寬高比 1:8 ~ 8:1 |
| 圖片（r2v 參考圖） | JPEG / JPG / PNG / WEBP | 短邊 ≥ 300 畫素 | ≤ 10 MB | 推薦清晰圖，避免模糊過壓 |
| 圖片（videoedit 參考圖） | JPEG / JPG / PNG / BMP / WEBP | 240 ~ 8000 畫素 | ≤ 20 MB | 寬高比 1:8 ~ 8:1 |
| 影片（videoedit 輸入） | MP4 / MOV（推薦 H.264） | 寬高 240 ~ 4096 畫素 | ≤ 100 MB | 時長 2~10 秒，寬高比 1:8 ~ 8:1 |

## OpenAI 相容介面

除 `/v1/video/generations` 外，同時相容 OpenAI 風格的 `/v1/videos` 介面，兩套介面完全等價。

- 提交：`POST` `/v1/videos`（請求體欄位完全一致）
- 查詢：`GET` `/v1/videos/{task_id}`（返回 OpenAI 扁平格式）

| OpenAI 狀態 | 對應統一狀態 |
|---|---|
| `queued` | `NOT_START` / `QUEUED` |
| `in_progress` | `IN_PROGRESS` |
| `completed` | `SUCCESS` |
| `failed` | `FAILURE` |

## 計費說明

萬相 2.7 按**影片秒數 × 解析度係數**計費：

| 解析度 | 單價 | 5 秒示例 |
|---|---|---|
| `720P` | $0.10 / 秒 | $0.50 |
| `1080P` | $0.15 / 秒 | $0.75 |

```
quota = modelPrice × QuotaPerUnit × groupRatio × seconds × resolutionRatio

QuotaPerUnit    = 500,000
modelPrice      = 0.10（所有 wan2.7 模型）
groupRatio      = 1.0（生产 default 组）
resolutionRatio = 720P → 1.0，1080P → 1.5
```

任務 `FAILURE` 時優特智慧會自動退款到你的賬戶，無需手動處理。

## 完整呼叫示例

```bash
# Step 1: 提交任务
curl -X POST https://uter.ai/v1/video/generations \
  -H "Authorization: Bearer sk-你的APIKey" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "wan2.7-t2v",
    "prompt": "一只小猫在月光下奔跑，毛发随风轻轻飘动，电影感慢镜头",
    "resolution": "720P",
    "duration": 5,
    "metadata": { "ratio": "16:9", "seed": 42 }
  }'

# Step 2: 轮询（建议间隔 10~15 秒）
curl https://uter.ai/v1/video/generations/task_xxx \
  -H "Authorization: Bearer sk-你的APIKey"

# Step 3: data.status == "SUCCESS" 后，从 data.result_url 下载视频
```

videoedit 透過 `images` 陣列傳入：第 1 個 MP4/MOV 視為待編輯影片，其餘 PNG/JPG/WEBP 視為參考圖，無需指定 `duration`（跟隨輸入影片）。

## 狀態碼與錯誤

| 場景 | 說明 |
|---|---|
| `400` | 引數錯誤（未傳 `prompt`、模型名未知、videoedit 的 `images` 為空等），提交前攔截，不扣費 |
| `401` / `403` | API Key 無效 / 無權訪問此模型 |
| `402` | 餘額不足（`insufficient user quota`），請前往優特智慧控制檯充值 |
| 任務 `FAILURE` | 上游生成失敗，見 `fail_reason`；優特智慧會自動退款 |

常見 `FAILURE` 原因：`DataInspectionFailed`（上游安全稽核攔截，調整 prompt 或素材）、i2v 未提供 `input_reference`、r2v 參考圖為 0 張、videoedit 的 `images[0]` 不是 MP4/MOV、媒體 URL 不可訪問或不符合素材規格。
