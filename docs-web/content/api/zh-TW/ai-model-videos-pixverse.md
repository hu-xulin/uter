# PixVerse格式

PixVerse 影片生成：透過 OpenAI 相容的 `/v1/videos` 介面呼叫 PixVerse 全系列模型（C1 / V6 / V5.6 / V5.5 / V5 / V4.5 / V4 / V3.5），支援文生影片、圖生影片。

## 支援的模型

呼叫時在 `model` 欄位統一使用 `PixVerse/<版本号>` 的形式，例如 `PixVerse/v5.6`。

| 模型 | 特點 | 時長檔位 | 音訊支援 |
|---|---|---|---|
| `PixVerse/c1` | 旗艦版，按秒計費最靈活 | 1~15 秒（按秒） | ✓ |
| `PixVerse/v6` | 最新代，按秒計費 | 1~15 秒（按秒） | ✓ |
| `PixVerse/v5.6` | 單片段模式，畫質穩定 | 5 / 8 / 10 秒 | ✓ |
| `PixVerse/v5.5` | 支援 Multi-Clip 拼接 | 5 / 8 / 10 秒 | ✓ |
| `PixVerse/v5` | 第 5 代基礎版 | 5 / 8 秒 | ✗ |
| `PixVerse/v4.5` | 第 4.5 代，支援 Fast Motion | 5 / 8 秒 | ✗ |
| `PixVerse/v4` | 第 4 代，支援 Fast Motion | 5 / 8 秒 | ✗ |
| `PixVerse/v3.5` | 第 3.5 代，支援 Fast Motion | 5 / 8 秒 | ✗ |

> 模型名中 `PixVerse/` 字首大小寫敏感，建議嚴格使用 `PixVerse/v5.6` 這種格式；版本號部分（`v5.6`、`c1`）支援大小寫自動 normalize。

## 建立影片

`POST` `/v1/videos`

### 請求頭

| Header | 必填 | 說明 |
|---|---|---|
| `Authorization` | 是 | `Bearer sk-你的APIKey` |
| `Content-Type` | 是 | `application/json` |

### 請求體（`application/json`）

| 欄位 | 型別 | 必填 | 說明 |
|---|---|---|---|
| `model` | string | 是 | PixVerse 模型名，見上表 |
| `prompt` | string | 是 | 影片描述提示詞，最長 2048 字元 |
| `image` | string | 否 | 圖生影片模式的原圖（URL 或 base64 data URI），傳入後自動切換為圖生影片 |
| `images` | string[] | 否 | `image` 的陣列形式（與 `image` 二選一） |
| `duration` | int | 否 | 影片時長（秒），預設 5，不同模型支援的檔位不同 |
| `resolution` | string | 否 | 解析度檔位（同 `size`，推薦使用，與其他模型對齊）：`720P` / `1080P` |
| `size` | string | 否 | 解析度，支援 `360p` `540p` `720p` `1080p`，或 `1920x1080` 這類畫素格式。`resolution` 與 `size` 並存時 `resolution` 優先 |
| `metadata` | object | 否 | PixVerse 特有引數容器，見「特有引數」 |

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

> `id` / `task_id` 由優特智慧生成，不等於 PixVerse 上游的 `video_id`，請務必使用此處返回的值。

## 獲取影片任務狀態

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
| `id` | string | 影片 ID |
| `status` | string | 任務狀態，見狀態列舉 |
| `progress` | integer | 進度百分比 |
| `created_at` | integer | 建立時間戳 |
| `completed_at` | integer | 完成時間戳（成功時） |
| `size` | string | 影片尺寸（成功時） |
| `metadata.url` | string | 影片地址（僅 `completed` 時） |
| `error.message` | string | 失敗原因（僅 `failed` 時） |

#### 狀態列舉

| 狀態 | 說明 |
|---|---|
| `queued` | 已提交，排隊中 |
| `in_progress` | 生成中 |
| `completed` | 已完成，`metadata.url` 為影片地址 |
| `failed` | 生成失敗，`error.message` 為失敗原因 |

## 獲取影片內容

`GET` `/v1/videos/{task_id}/content`

直接返回影片二進位制流（`Content-Type: video/mp4`）。優特智慧會自動代理 PixVerse 的臨時 URL，避免向客戶端暴露上游地址，也避免臨時 URL 過期問題。

### 請求引數

| 引數名 | 位置 | 型別 | 必填 | 說明 |
|---|---|---|---|---|
| `task_id` | path | string | 是 | 影片任務 ID |

### 響應

| 狀態碼 | 說明 |
|---|---|
| `200` | 成功獲取影片內容 |
| `404` | 影片不存在或未完成 |

> **強烈推薦**使用 `/content` 代理介面下載影片，而不是直接訪問 `metadata.url`。後者是 PixVerse 的臨時連結，有效期有限（通常數小時）；而代理介面只要任務記錄未清理就永不過期。

## 特有引數（`metadata`）

所有 PixVerse 特有欄位都透過請求體的 `metadata` 物件傳遞。

### 通用欄位

| 欄位 | 型別 | 適用模型 | 說明 |
|---|---|---|---|
| `quality` | string | 所有 | 解析度，覆蓋頂層 `size`，可選 `360p` `540p` `720p` `1080p` |
| `aspect_ratio` | string | 文生影片 | 寬高比，如 `16:9` `9:16` `1:1` `4:3` `3:4` `2:3` `3:2` `21:9` |
| `motion_mode` | string | V4.5 / V4 / V3.5 | 運動模式，`normal`（預設）或 `fast`（×2 價格，僅 360p/540p/720p 的 5s 支援） |
| `camera_movement` | string | 所有 | 鏡頭運動，如 `zoom_in` `zoom_out` `pan_left` `pan_right` 等 |
| `seed` | int | 所有 | 隨機種子，0 ~ 2147483647 |
| `template_id` | int | 所有 | 模板 ID |
| `style` | string | 所有 | 風格，如 `anime` |
| `water_mark` | bool | 所有 | 是否新增水印 |
| `negative_prompt` | string | 所有 | 負面提示詞 |

> `motion_mode: fast` 有嚴格限制：僅 V4.5 / V4 / V3.5 模型、5 秒時長、360p/540p/720p 解析度支援。傳入其他組合（如 `1080p + fast` 或 `8s + fast`）會直接返回 `400` 錯誤，不會產生扣費。

### 影片音訊生成（C1 / V6 / V5.6 / V5.5）

| 欄位 | 型別 | 適用模型 | 說明 |
|---|---|---|---|
| `generate_audio_switch` | bool | C1 / V6 / V5.6 / V5.5 | 切換到「有音訊」計費檔位（由上游同步生成音訊） |

> V5 / V4.5 / V4 / V3.5 **不支援**音訊生成。這幾個模型傳入 `generate_audio_switch: true` 會返回 `400` 錯誤。

### 圖生影片高階欄位

PixVerse 圖生影片要求先把圖片上傳到上游獲取 `img_id`。優特智慧已**自動封裝了上傳流程**：直接在請求體傳 `image: "https://..."` 或 `image: "data:image/png;base64,..."`，優特智慧會自動上傳到 PixVerse、取回 `img_id` 後轉發給影片生成介面。

如果你已經有 `img_id`（高階場景），可直接傳：

| 欄位 | 型別 | 說明 |
|---|---|---|
| `img_id` | int | 預上傳的圖片 ID，優先順序高於 `image` 自動上傳 |

## 完整呼叫示例

```bash
# Step 1: 提交任务
curl -X POST https://uter.ai/v1/videos \
  -H "Authorization: Bearer sk-你的APIKey" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "PixVerse/v5.6",
    "prompt": "一只猫在月球表面漫步，背景是璀璨的星空",
    "duration": 5,
    "size": "720p",
    "metadata": { "aspect_ratio": "16:9", "seed": 42 }
  }'

# Step 2: 轮询任务状态（建议间隔 3~5 秒）
curl https://uter.ai/v1/videos/task_xxx \
  -H "Authorization: Bearer sk-你的APIKey"

# Step 3: 状态变为 completed 后，下载视频
curl https://uter.ai/v1/videos/task_xxx/content \
  -H "Authorization: Bearer sk-你的APIKey" \
  -o cat_on_moon.mp4
```

## 狀態碼與錯誤

| 場景 | 說明 |
|---|---|
| `400` | 引數組合非法（如 V5 傳 `generate_audio_switch: true`、fast 模式配 1080p/8s、不支援的 quality × duration 組合、未知模型名），提交前攔截，不扣費 |
| `401` | API Key 無效或已過期 |
| `403` | API Key 無權訪問此模型（檢查 token 模型白名單） |
| `402` | 餘額不足（`insufficient user quota`），請前往優特智慧控制檯充值 |
| 任務 `failed` | 上游生成失敗（內容稽核 / 生成失敗 / 上游超時）；優特智慧會**自動退款**，可在日誌頁面查詢退款記錄 |
