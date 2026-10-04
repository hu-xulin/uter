# MiniMax格式

MiniMax H3（`MiniMax-H3`）影片生成：透過非同步任務介面呼叫 MiniMax H3，支援文生影片、圖生影片、參考生影片，並按上游真實用量精確計費。

## 模型與能力

只有一個模型名：`MiniMax-H3`。**生成模式由請求中帶了什麼媒體輸入自動決定**：

| 生成模式 | 觸發條件 | 媒體輸入 |
|---|---|---|
| 文生影片（t2v） | 只有 `prompt` | 無 |
| 圖生影片（i2v） | 傳入首幀圖（可選尾幀圖） | `input_reference` / `images` |
| 參考生影片（r2v） | 傳入參考圖 / 參考影片 / 參考音訊 | 頂層 `media[]` 陣列 |

無論哪種模式，`prompt`（文字提示詞）**始終必填**。

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
| `model` | string | 是 | 固定為 `MiniMax-H3` |
| `prompt` | string | 是 | 文字提示詞 |
| `resolution` | string | 否 | 解析度，目前僅 `2K`（預設 `2K`） |
| `duration` | int | 否 | 生成影片時長（秒），取值 `4 ~ 15`，預設 `6` |
| `ratio` | string | 否 | 寬高比：`16:9` / `9:16` / `1:1` / `adaptive`。文生影片預設 `16:9`；圖生影片預設 `adaptive`（跟隨首幀圖） |
| `input_reference` | string | 否 | 圖生影片首幀圖 URL（公網可訪問 / base64） |
| `images` | string[] | 否 | 圖生影片影象陣列：第 1 張作首幀、第 2 張作尾幀 |
| `media` | object[] | 否 | 參考生影片結構化媒體輸入，見下 |

### `media[]` 元素

用於參考生影片（r2v），精確指定每個參考素材的角色：

| `type` | 對映角色 | 用途 |
|---|---|---|
| `reference_image` | 參考圖 | 參考圖片（可多張） |
| `reference_video` | 參考影片 | 參考影片（其計費時長計入總秒數） |
| `reference_audio` | 參考音訊 | 參考音訊 |
| `first_frame` / `last_frame` | 首幀 / 尾幀 | 圖生影片的首 / 尾幀圖 |

未傳結構化 `media` 時，優特智慧會從 `images` / `input_reference` 按副檔名與順序自動推斷：影片 → 參考影片、音訊 → 參考音訊、第 1 張圖 → 首幀、第 2 張圖 → 尾幀。需要精確控制角色時請使用 `media[]`。

> 參考音訊（`reference_audio`）目前受上游支援限制：實測上游會返回任務失敗（優特智慧自動全額退款）。文生影片、圖生影片（首幀 / 首+尾幀）、參考圖 / 參考影片生影片均可正常使用。

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

> `id` / `task_id` 由優特智慧生成，不等於上游 MiniMax 的 task_id。

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
| `data.status` | string | 任務狀態：`QUEUED` / `IN_PROGRESS` / `SUCCESS` / `FAILURE` |
| `data.result_url` | string | 影片結果 URL（僅 `SUCCESS` 時非空） |
| `data.quota` | int | 本次任務最終扣費 quota（完成後已按真實用量結算） |
| `data.data.task.usage` | object | 上游返回的精確用量，即計費依據（`total_seconds` / `input_seconds` / `output_seconds` / `input_image_count`） |

#### 狀態列舉

| 統一狀態 | 對應 MiniMax 狀態 | 說明 |
|---|---|---|
| `QUEUED` | `queued` / `preparing` | 已進入佇列 |
| `IN_PROGRESS` | `running` | 生成中 |
| `SUCCESS` | `succeeded` | 已完成，`result_url` 為影片地址 |
| `FAILURE` | `failed` / `cancelled` / `expired` | 生成失敗，`fail_reason` 為失敗原因 |

## 計費說明

MiniMax H3 按上游返回的**真實用量**精確計費：

```
费用(USD) = 总计费秒数 × 分辨率单价 + 计费参考图数 × $0.04
其中：总计费秒数 = 输入参考视频计费时长 + 生成视频时长
```

| 解析度 | 單價 |
|---|---|
| `2K` | $0.13 / 秒 |
| `768P` | $0.09 / 秒（暫未開放呼叫） |

要點：

- **輸入參考影片也計費**：r2v 傳入參考影片時，其計費時長按輸出影片的解析度單價計入總秒數。
- **參考圖另計**：每張計費參考圖 $0.04。
- **提交時預扣、完成時按真實用量結算**：提交任務時按輸出時長預扣一筆；任務成功後優特智慧用上游返回的 `usage` 精確重算，多退少補。

## 完整呼叫示例

```bash
# Step 1: 提交任务
curl -X POST https://uter.ai/v1/video/generations \
  -H "Authorization: Bearer sk-你的APIKey" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "MiniMax-H3",
    "prompt": "一只猫在阳光下打盹，毛毛随风轻轻摇曳",
    "resolution": "2K",
    "duration": 6,
    "ratio": "16:9"
  }'

# Step 2: 轮询（建议间隔 10~15 秒）
curl https://uter.ai/v1/video/generations/task_xxx \
  -H "Authorization: Bearer sk-你的APIKey"

# Step 3: data.status == "SUCCESS" 后，从 data.result_url 下载视频
```

參考生影片使用頂層 `media[]` 傳入參考素材：

```bash
curl -X POST https://uter.ai/v1/video/generations \
  -H "Authorization: Bearer sk-你的APIKey" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "MiniMax-H3",
    "prompt": "参考给定素材生成一段连贯的视频",
    "resolution": "2K",
    "duration": 6,
    "media": [
      { "type": "reference_image", "url": "https://example.com/ref.jpg" },
      { "type": "reference_video", "url": "https://example.com/ref.mp4" }
    ]
  }'
```

## 狀態碼與錯誤

| 場景 | 說明 |
|---|---|
| 未傳 `prompt` | `400`，`prompt is required`（提交前攔截，不扣費） |
| `401` / `403` | API Key 無效 / 無權訪問此模型 |
| `402` | 餘額不足（`insufficient user quota`），請前往優特智慧控制檯充值 |
| 任務 `FAILURE` | 上游生成失敗，見 `fail_reason`；優特智慧會自動退款 |
