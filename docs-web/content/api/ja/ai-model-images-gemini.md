# gemini

## Gemini Native Format

Gemini 图片生成

`POST` `/v1beta/models/{model}:generateContent/`

### 请求参数

| 参数名 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `model` | path | string | 是 | 模型名称 |

### 请求体（`application/json`）

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `contents` | array&lt;object&gt; | 是 | — |
| `generationConfig.thinkingConfig.includeThoughts` | boolean | 否 | 是否返回思考内容 |
| `generationConfig.responseModalities` | array&lt;string&gt; | 否 | — |
| `generationConfig.imageConfig.aspectRatio` | string | 否 | — |
| `generationConfig.imageConfig.imageSize` | string | 否 | — |

### 响应

| 状态码 | 说明 |
|---|---|
| `200` | 成功 |

#### `200` 响应字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `candidates` | array&lt;object&gt; | — |
| `usageMetadata.promptTokenCount` | integer | — |
| `usageMetadata.candidatesTokenCount` | integer | — |
| `usageMetadata.totalTokenCount` | integer | — |

## OpenAI Chat Format

Gemini 图片生成

`POST` `/v1/chat/completions`

### 请求体（`application/json`）

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `model` | string | 是 | — |
| `stream` | boolean | 是 | — |
| `messages` | array&lt;object&gt; | 是 | — |
| `extra_body.google.image_config.aspect_ratio` | string | 否 | — |
| `extra_body.google.image_config.image_size` | string | 否 | — |
| `contents` | array&lt;object&gt; | 是 | — |

### 响应

| 状态码 | 说明 |
|---|---|
| `200` | 成功 |

#### `200` 响应字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | — |
| `model` | string | — |
| `object` | string | — |
| `created` | integer | — |
| `choices` | array&lt;object&gt; | — |
| `usage.prompt_tokens` | integer | — |
| `usage.completion_tokens` | integer | — |
| `usage.total_tokens` | integer | — |
