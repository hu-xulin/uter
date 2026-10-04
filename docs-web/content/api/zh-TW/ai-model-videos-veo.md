# 谷歌Veo格式

Google Veo 3.1 影片生成：透過非同步任務介面呼叫 Veo 3.1 全系列模型，支援文生影片、圖生影片，可選生成同步音訊（最高 4K 輸出）。

## 支援的模型

3 個模型統一使用同一介面路徑，僅透過 `model` 欄位區分。所有模型均支援文生影片與圖生影片，均可選擇是否生成音訊。

| 模型 ID | 版本 | 特點 | 適用場景 |
|---|---|---|---|
| `veo-3.1-generate-001` | Veo 3.1 | 最高畫質，支援 4K，原生音訊 | 高質量創意內容、商業製作 |
| `veo-3.1-fast-generate-001` | Veo 3.1 Fast | 更快速度，均衡畫質 | 快速迭代、批次生成 |
| `veo-3.1-lite-generate-001` | Veo 3.1 Lite | 最快速度，最低成本 | 原型驗證、低成本場景 |

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
| `model` | string | 是 | Veo 3.1 模型 ID，見上表 |
| `prompt` | string | 是 | 影片描述提示詞，支援中英文，建議英文獲得最佳效果 |
| `size` | string | 否 | 解析度：`720p` / `1080p` / `4000`（4K，部分模型支援），預設 `1080p` |
| `resolution` | string | 否 | 同 `size`（推薦使用，與上游一致；兩者並存時以本欄位為準） |
| `duration` | int | 否 | 影片時長（秒），可選 `4` / `6` / `8`，預設 `8` |
| `seconds` | string | 否 | `duration` 的字串形式（相容 OpenAI Sora API） |
| `aspect_ratio` | string | 否 | 寬高比，可選 `16:9` / `9:16`，預設 `16:9` |
| `generate_audio` | bool | 否 | 是否生成同步音訊（語音、音效、背景音），**預設 `true`**（如不需要音訊，強烈建議明確設為 `false` 以節省費用） |
| `negative_prompt` | string | 否 | 負向提示詞，描述不希望出現的內容 |
| `image` | string | 否 | 圖生影片首幀圖，支援 HTTP(S) URL / data URI / raw base64 |
| `images` | string[] | 否 | 圖生影片首幀圖陣列，僅 `images[0]` 生效；與 `image` 同時傳時 `image` 優先 |
| `last_frame_image` | string | 否 | 尾幀圖（與 `image` / `images[0]` 配合 → 首+尾幀插值生成過渡動畫，Veo 3.1 專屬）。格式同 `image` |
| `reference_images` | string[] | 否 | 資產參考圖陣列，最多 3 張；後臺會以 `referenceType="asset"` 遞交上游。**與 `image` / `last_frame_image` 互斥**，僅支援 `duration=8` |
| `metadata` | object | 否 | Veo 原生引數容器，見「metadata 高階引數」 |

> 頂層 `generate_audio` / `negative_prompt` / `aspect_ratio` 等 snake_case 欄位會被自動對映到上游 Veo 的 camelCase 引數；也可將它們放到 `metadata` 內（snake_case 與 camelCase 均可），與頂層等價。
>
> `generate_audio: true` 會顯著提高費用（約 2 倍）。計費預設值為 `true`，如不需要音訊請明確設定 `generate_audio: false`。

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
| `data.task_id` | string | 任務 ID |
| `data.status` | string | 任務狀態：`queued` / `processing` / `succeeded` / `failed` |
| `data.error` | string / null | 失敗原因，成功時為 `null` |
| `data.format` | string / null | 輸出格式（如 `mp4`），處理中或失敗時為 `null` |
| `data.metadata` | object / null | 附加後設資料 |
| `data.url` | string / null | 影片下載地址，處理中或失敗時為 `null`（臨時簽名連結，24 小時有效） |

#### 狀態列舉

| 狀態 | 說明 |
|---|---|
| `queued` | 已提交，等待處理 |
| `processing` | 生成中 |
| `succeeded` | 已完成，`data.url` 為影片下載地址 |
| `failed` | 生成失敗，`data.error` 為原因 |

## 圖片輸入格式

`image` / `images[0]` 均支援以下三種格式，優特智慧會自動識別並轉換為 Veo 上游所需的內聯 base64：

| 格式 | 示例 | 說明 |
|---|---|---|
| HTTP(S) URL | `https://example.com/foo.png` | 後端同步下載並 base64 編碼後轉發；URL 必須公網可達且未過期 |
| data URI | `data:image/png;base64,iVBOR...` | 直接透傳內聯資料，無需聯網 |
| raw base64 | `iVBORw0KGgo...`（不含字首） | 無字首純 base64，自動嗅探 MIME 型別 |

限制：單張圖片解碼後 ≤ **20 MB**；URL 形式下載超時 **30 秒**；解析失敗（URL 不可達 / 超大 / base64 非法）返回 `400 parse images[0] failed: ...`，**不會扣費**。`gs://` 形式的 GCS 原生 URI 暫不支援，請改用 `https://storage.googleapis.com/...`。

## metadata 高階引數

`metadata` 是 Veo 原生引數容器，可放置 OpenAI 風格中沒有的高階引數。所有頂層欄位也可放到 `metadata` 內（snake_case 與 camelCase 均可）。

| 欄位 | 型別 | 說明 |
|---|---|---|
| `seed` | int | 隨機種子（推薦放這裡） |
| `personGeneration` / `person_generation` | string | 人物生成策略：`allow_all` / `allow_adult` / `dont_allow` |
| `storageUri` / `storage_uri` | string | 直接把生成結果寫入指定 GCS 桶路徑（僅 vertex 渠道，需要許可權） |
| `compressionQuality` / `compression_quality` | string | 壓縮質量：`optimized`（預設）/ `lossless` |
| `resizeMode` / `resize_mode` | string | 圖生影片縮放策略：`crop` / `fit` |
| `sampleCount` / `sample_count` | int | 一次生成幾條影片，**當前固定為 1**，傳入會被覆蓋 |

> 優先順序：metadata 內已有的 camelCase > metadata 內的 snake_case > 頂層欄位。

## 模型對比

| 對比項 | Veo 3.1 | Veo 3.1 Fast | Veo 3.1 Lite |
|---|---|---|---|
| **模型 ID** | `veo-3.1-generate-001` | `veo-3.1-fast-generate-001` | `veo-3.1-lite-generate-001` |
| **畫質** | 最高 | 均衡 | 基礎 |
| **速度（實測 8s 影片）** | 90~130 秒 | 75~105 秒 | 50~80 秒 |
| **最高解析度** | 4K | 1080p | 1080p |
| **音訊支援** | ✓ | ✓ | ✓ |
| **圖生影片** | ✓ | ✓ | ✓ |

## OpenAI 相容介面

除 `/v1/video/generations` 外，也支援 OpenAI 風格的 `/v1/videos` 介面，兩者完全等價。

- 提交：`POST` `/v1/videos`（請求體欄位相同）
- 查詢：`GET` `/v1/videos/{task_id}`（返回 OpenAI 扁平格式）

> OpenAI 相容介面的查詢響應不包含影片 URL。如需獲取下載地址，請使用 `/v1/video/generations/{task_id}` 介面，從 `data.url` 獲取。

## 計費說明

```
quota = modelPrice × QuotaPerUnit × groupRatio × pricingRatio × seconds

QuotaPerUnit = 500,000
groupRatio   = 1.0（生产 default 组）
```

### 純影片（`generate_audio: false`）

| 模型 | 720p | 1080p | 4K |
|---|---|---|---|
| `veo-3.1-generate-001` | $0.20 / 秒 | $0.20 / 秒 | $0.40 / 秒 |
| `veo-3.1-fast-generate-001` | $0.08 / 秒 | $0.10 / 秒 | $0.25 / 秒 |
| `veo-3.1-lite-generate-001` | $0.03 / 秒 | $0.05 / 秒 | — |

### 影片 + 音訊（`generate_audio: true`）

| 模型 | 720p | 1080p | 4K |
|---|---|---|---|
| `veo-3.1-generate-001` | $0.40 / 秒 | $0.40 / 秒 | $0.60 / 秒 |
| `veo-3.1-fast-generate-001` | $0.10 / 秒 | $0.12 / 秒 | $0.30 / 秒 |
| `veo-3.1-lite-generate-001` | $0.05 / 秒 | $0.08 / 秒 | — |

任務失敗（`failed`）時優特智慧會自動退款。

## 完整呼叫示例

```bash
# 文生视频
curl -X POST https://uter.ai/v1/video/generations \
  -H "Authorization: Bearer sk-你的APIKey" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "veo-3.1-generate-001",
    "prompt": "A golden retriever playing fetch on a sunny beach, cinematic wide shot, slow motion",
    "size": "1080p",
    "duration": 8,
    "aspect_ratio": "16:9"
  }'

# 轮询（建议间隔 10~15 秒）
curl https://uter.ai/v1/video/generations/task_xxx \
  -H "Authorization: Bearer sk-你的APIKey"

# data.status == "succeeded" 后下载视频（data.url）
curl -o output.mp4 "https://uter.ai/v1/videos/task_xxx/content"
```

首+尾幀插值（Veo 3.1 專屬）與資產參考圖：

```bash
# 首+尾帧插值
curl -X POST https://uter.ai/v1/video/generations \
  -H "Authorization: Bearer sk-你的APIKey" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "veo-3.1-generate-001",
    "prompt": "Smooth cinematic transition between a serene garden and a bustling city.",
    "image": "https://example.com/start.jpg",
    "last_frame_image": "https://example.com/end.jpg",
    "size": "1080p",
    "duration": 8,
    "aspect_ratio": "16:9"
  }'
```

- `reference_images` 不能與 `image` / `images` / `last_frame_image` 同時使用，否則返回 `400 reference_images is mutually exclusive ...`。
- `reference_images` 最多 3 張，超過返回 `400 reference_images supports at most 3 entries`。
- `reference_images` 僅支援 `duration=8`。

## 狀態碼與錯誤

| 狀態碼 | 原因 | 處理 |
|---|---|---|
| `400` | 引數錯誤（缺少 `prompt`、非法 `duration` 值，或圖片解析失敗 `parse images[0] failed: ...`） | 檢查請求體欄位 |
| `401` | API Key 無效或過期 | 檢查 `Authorization` 頭 |
| `403` | API Key 無權訪問此模型 | 檢查 token 模型白名單 |
| `402` | 餘額不足 | 前往優特智慧控制檯充值 |

任務 `failed` 常見原因：內容安全策略攔截（調整 prompt，可加 `negative_prompt`）、圖片 URL 無法訪問、`duration` 不在支援範圍、Lite 模型不支援 4K。
