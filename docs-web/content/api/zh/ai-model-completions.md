# 补全（Completions）

## 原生OpenAI格式

基于给定提示创建文本补全

`POST` `/v1/completions`

### 请求体（`application/json`）

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `model` | string | 是 | — |
| `max_tokens` | integer | 否 | — |
| `temperature` | number | 否 | — |
| `top_p` | number | 否 | — |
| `n` | integer | 否 | — |
| `stream` | boolean | 否 | — |
| `suffix` | string | 否 | — |
| `echo` | boolean | 否 | — |

### 响应

| 状态码 | 说明 |
|---|---|
| `200` | 成功创建响应 |

#### `200` 响应字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | — |
| `object` | string | — |
| `created` | integer | — |
| `model` | string | — |
| `choices` | array&lt;object&gt; | — |
| `usage.prompt_tokens` | integer | 提示词 Token 数 |
| `usage.completion_tokens` | integer | 补全 Token 数 |
| `usage.total_tokens` | integer | 总 Token 数 |
| `usage.prompt_tokens_details.cached_tokens` | integer | — |
| `usage.prompt_tokens_details.text_tokens` | integer | — |
| `usage.prompt_tokens_details.audio_tokens` | integer | — |
| `usage.prompt_tokens_details.image_tokens` | integer | — |
| `usage.completion_tokens_details.text_tokens` | integer | — |
| `usage.completion_tokens_details.audio_tokens` | integer | — |
| `usage.completion_tokens_details.reasoning_tokens` | integer | — |
