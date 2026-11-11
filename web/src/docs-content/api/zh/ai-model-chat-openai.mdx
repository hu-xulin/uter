# 原生OpenAI格式

## ChatCompletions格式

根据对话历史创建模型响应。支持流式和非流式响应。

兼容 OpenAI Chat Completions API。

`POST` `/v1/chat/completions`

### 请求体（`application/json`）

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `model` | string | 是 | 模型 ID |
| `messages` | array&lt;object&gt; | 是 | 对话消息列表 |
| `temperature` | number | 否 | 采样温度 |
| `top_p` | number | 否 | 核采样参数 |
| `n` | integer | 否 | 生成数量 |
| `stream` | boolean | 否 | 是否流式响应 |
| `stream_options.include_usage` | boolean | 否 | — |
| `max_tokens` | integer | 否 | 最大生成 Token 数 |
| `max_completion_tokens` | integer | 否 | 最大补全 Token 数 |
| `presence_penalty` | number | 否 | — |
| `frequency_penalty` | number | 否 | — |
| `logit_bias` | object | 否 | — |
| `user` | string | 否 | — |
| `tools` | array&lt;object&gt; | 否 | — |
| `response_format.type` | enum（`text`, `json_object`, `json_schema`） | 否 | — |
| `response_format.json_schema` | object | 否 | JSON Schema 定义 |
| `seed` | integer | 否 | — |
| `reasoning_effort` | enum（`low`, `medium`, `high`） | 否 | 推理强度 (用于支持推理的模型) |
| `modalities` | array&lt;enum（`text`, `audio`）&gt; | 否 | — |
| `audio.voice` | string | 否 | — |
| `audio.format` | string | 否 | — |

### 响应

| 状态码 | 说明 |
|---|---|
| `200` | 成功创建响应 |
| `400` | 请求参数错误 |
| `429` | 请求频率限制 |

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
| `system_fingerprint` | string | — |

#### `400` 响应字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `error.message` | string | 错误信息 |
| `error.type` | string | 错误类型 |
| `error.param` | string | 相关参数 |
| `error.code` | string | 错误代码 |

#### `429` 响应字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `error.message` | string | 错误信息 |
| `error.type` | string | 错误类型 |
| `error.param` | string | 相关参数 |
| `error.code` | string | 错误代码 |

## Responses格式

OpenAI Responses API，用于创建模型响应。
支持多轮对话、工具调用、推理等功能。

`POST` `/v1/responses`

### 请求体（`application/json`）

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `model` | string | 是 | — |
| `instructions` | string | 否 | — |
| `max_output_tokens` | integer | 否 | — |
| `temperature` | number | 否 | — |
| `top_p` | number | 否 | — |
| `stream` | boolean | 否 | — |
| `tools` | array&lt;object&gt; | 否 | — |
| `reasoning.effort` | enum（`low`, `medium`, `high`） | 否 | — |
| `reasoning.summary` | string | 否 | — |
| `previous_response_id` | string | 否 | — |
| `truncation` | enum（`auto`, `disabled`） | 否 | — |

### 响应

| 状态码 | 说明 |
|---|---|
| `200` | 成功创建响应 |

#### `200` 响应字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | — |
| `object` | string | — |
| `created_at` | integer | — |
| `status` | enum（`completed`, `failed`, `in_progress`, `incomplete`） | — |
| `model` | string | — |
| `output` | array&lt;object&gt; | — |
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
