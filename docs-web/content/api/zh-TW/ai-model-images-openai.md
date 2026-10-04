# 原生OpenAI格式

## 編輯影象

在給定原始影象和提示的情況下建立編輯或擴充套件影象。

`POST` `/v1/images/edits/`

### 請求體（`multipart/form-data`）

| 欄位 | 型別 | 必填 | 說明 |
|---|---|---|---|
| `image` | string（binary） | 是 | 要編輯的影象。必須是有效的 PNG 檔案，小於 4MB，並且是方形的。如果未提供遮罩，影象必須具有透明度，將用作遮罩。 |
| `mask` | string（binary） | 否 | 附加影象，其完全透明區域（例如，alpha 為零的區域）指示image應編輯的位置。必須是有效的 PNG 檔案，小於 4MB，並且尺寸與原始image相同。 |
| `prompt` | string | 是 | 所需影象的文字描述。最大長度為 1000 個字元。 |
| `n` | string | 否 | 要生成的影象數。必須介於 1 和 10 之間。 |
| `size` | string | 否 | 生成影象的大小。必須是`256x256`、`512x512`或 `1024x1024`之一。 |
| `response_format` | string | 否 | 生成的影象返回的格式。必須是`url`或`b64_json`。 |
| `user` | string | 否 | 代表您的終端使用者的唯一識別符號，可以幫助 OpenAI 監控和檢測濫用行為。[瞭解更多](https://platform.openai.com/docs/guides/safety-best-practices/end-user-ids)。 |
| `model` | string | 否 | — |

### 響應

| 狀態碼 | 說明 |
|---|---|
| `200` | Response |

## 生成影象

在給定提示的情況下建立影象。[瞭解更多](https://platform.openai.com/docs/guides/images)。

`POST` `/v1/images/generations/`

### 請求體（`application/json`）

| 欄位 | 型別 | 必填 | 說明 |
|---|---|---|---|
| `model` | string | 否 | 用於影象生成的模型。`dall-e-2`、`dall-e-3` 或 `gpt-image-1` 之一。預設為 `dall-e-2`，除非使用特定於 `gpt-image-1` 的引數。 |
| `prompt` | string | 是 | 所需影象的文字描述。`gpt-image-1` 的最大長度為 32000 個字元，`dall-e-2` 的最大長度為 1000 個字元，`dall-e-3` 的最大長度為 4000 個字元。 |
| `n` | integer | 否 | 要生成的影象數量。必須介於 1 到 10 之間。對於 `dall-e-3`，僅支援 `n=1`。 |
| `size` | string | 否 | 生成的影象的大小。`对于 gpt-image-1`，必須是 `1024x1024`、`1536x1024`（橫向）、`1024x1536`（縱向）或`自动`（預設值）之一，`对于 dall-e-2`，必須是 `256x256、``512x512` 或 `1024x1024` 之一，對於 `dall-e-3`，必須是 `1024x1024`、`1792x1024` 或 `1024x1792` 之一。 |
| `background` | string | 否 | 允許為生成的影象的背景設定透明度。此引數僅支援 `gpt-image-1`。必須是以下之一 `透明`、`不透明`或`自动`（預設值）。使用`自动`時，模型將自動確定影象的最佳背景。  如果`是透明`的，則輸出格式需要支援透明度，因此應將其設定為 `png`（預設值）或 `webp`。 |
| `moderation` | string | 否 | 控制 `gpt-image-1` 生成的影象的內容稽核級別。必須為`低，` 以進行限制較少的篩選或`自动`（預設值）。 |
| `quality` | string | 否 | 將生成的影象的質量。 |
| `stream` | string | 否 | — |
| `style` | string | 否 | — |
| `user` | string | 否 | — |

### 響應

| 狀態碼 | 說明 |
|---|---|
| `200` | Response |

#### `200` 響應欄位

| 欄位 | 型別 | 說明 |
|---|---|---|
| `created` | integer | — |
| `data` | array&lt;object&gt; | — |
| `usage.total_tokens` | integer | — |
| `usage.input_tokens` | integer | — |
| `usage.output_tokens` | integer | — |
| `usage.input_tokens_details.text_tokens` | integer | — |
| `usage.input_tokens_details.image_tokens` | integer | — |
