# gemini

## Gemini Native Format

Gemini 画像生成です。

`POST` `/v1beta/models/{model}:generateContent/`

### リクエストパラメータ

| パラメータ名 | 位置 | 型 | 必須 | 説明 |
|---|---|---|---|---|
| `model` | path | string | 必須 | モデル名 |

### リクエストボディ（`application/json`）

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `contents` | array&lt;object&gt; | 必須 | — |
| `generationConfig.thinkingConfig.includeThoughts` | boolean | 任意 | 思考内容を返すかどうか |
| `generationConfig.responseModalities` | array&lt;string&gt; | 任意 | — |
| `generationConfig.imageConfig.aspectRatio` | string | 任意 | — |
| `generationConfig.imageConfig.imageSize` | string | 任意 | — |

### レスポンス

| ステータスコード | 説明 |
|---|---|
| `200` | 成功 |

#### `200` レスポンスフィールド

| フィールド | 型 | 説明 |
|---|---|---|
| `candidates` | array&lt;object&gt; | — |
| `usageMetadata.promptTokenCount` | integer | — |
| `usageMetadata.candidatesTokenCount` | integer | — |
| `usageMetadata.totalTokenCount` | integer | — |

## OpenAI Chat Format

Gemini 画像生成です。

`POST` `/v1/chat/completions`

### リクエストボディ（`application/json`）

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `model` | string | 必須 | — |
| `stream` | boolean | 必須 | — |
| `messages` | array&lt;object&gt; | 必須 | — |
| `extra_body.google.image_config.aspect_ratio` | string | 任意 | — |
| `extra_body.google.image_config.image_size` | string | 任意 | — |
| `contents` | array&lt;object&gt; | 必須 | — |

### レスポンス

| ステータスコード | 説明 |
|---|---|
| `200` | 成功 |

#### `200` レスポンスフィールド

| フィールド | 型 | 説明 |
|---|---|---|
| `id` | string | — |
| `model` | string | — |
| `object` | string | — |
| `created` | integer | — |
| `choices` | array&lt;object&gt; | — |
| `usage.prompt_tokens` | integer | — |
| `usage.completion_tokens` | integer | — |
| `usage.total_tokens` | integer | — |
