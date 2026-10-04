# 原生OpenAI格式

## ChatCompletions格式

根據對話歷史建立模型響應。支援流式和非流式響應。

相容 OpenAI Chat Completions API。

`POST` `/v1/chat/completions`

### 請求體（`application/json`）

| 欄位 | 型別 | 必填 | 說明 |
|---|---|---|---|
| `model` | string | 是 | 模型 ID |
| `messages` | array&lt;object&gt; | 是 | 對話訊息列表 |
| `temperature` | number | 否 | 取樣溫度 |
| `top_p` | number | 否 | 核取樣引數 |
| `n` | integer | 否 | 生成數量 |
| `stream` | boolean | 否 | 是否流式響應 |
| `stream_options.include_usage` | boolean | 否 | — |
| `max_tokens` | integer | 否 | 最大生成 Token 數 |
| `max_completion_tokens` | integer | 否 | 最大補全 Token 數 |
| `presence_penalty` | number | 否 | — |
| `frequency_penalty` | number | 否 | — |
| `logit_bias` | object | 否 | — |
| `user` | string | 否 | — |
| `tools` | array&lt;object&gt; | 否 | — |
| `response_format.type` | enum（`text`, `json_object`, `json_schema`） | 否 | — |
| `response_format.json_schema` | object | 否 | JSON Schema 定義 |
| `seed` | integer | 否 | — |
| `reasoning_effort` | enum（`low`, `medium`, `high`） | 否 | 推理強度 (用於支援推理的模型) |
| `modalities` | array&lt;enum（`text`, `audio`）&gt; | 否 | — |
| `audio.voice` | string | 否 | — |
| `audio.format` | string | 否 | — |

### 響應

| 狀態碼 | 說明 |
|---|---|
| `200` | 成功建立響應 |
| `400` | 請求引數錯誤 |
| `429` | 請求頻率限制 |

#### `200` 響應欄位

| 欄位 | 型別 | 說明 |
|---|---|---|
| `id` | string | — |
| `object` | string | — |
| `created` | integer | — |
| `model` | string | — |
| `choices` | array&lt;object&gt; | — |
| `usage.prompt_tokens` | integer | 提示詞 Token 數 |
| `usage.completion_tokens` | integer | 補全 Token 數 |
| `usage.total_tokens` | integer | 總 Token 數 |
| `usage.prompt_tokens_details.cached_tokens` | integer | — |
| `usage.prompt_tokens_details.text_tokens` | integer | — |
| `usage.prompt_tokens_details.audio_tokens` | integer | — |
| `usage.prompt_tokens_details.image_tokens` | integer | — |
| `usage.completion_tokens_details.text_tokens` | integer | — |
| `usage.completion_tokens_details.audio_tokens` | integer | — |
| `usage.completion_tokens_details.reasoning_tokens` | integer | — |
| `system_fingerprint` | string | — |

#### `400` 響應欄位

| 欄位 | 型別 | 說明 |
|---|---|---|
| `error.message` | string | 錯誤資訊 |
| `error.type` | string | 錯誤型別 |
| `error.param` | string | 相關引數 |
| `error.code` | string | 錯誤程式碼 |

#### `429` 響應欄位

| 欄位 | 型別 | 說明 |
|---|---|---|
| `error.message` | string | 錯誤資訊 |
| `error.type` | string | 錯誤型別 |
| `error.param` | string | 相關引數 |
| `error.code` | string | 錯誤程式碼 |

## Responses格式

OpenAI Responses API，用於建立模型響應。
支援多輪對話、工具呼叫、推理等功能。

`POST` `/v1/responses`

### 請求體（`application/json`）

| 欄位 | 型別 | 必填 | 說明 |
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

### 響應

| 狀態碼 | 說明 |
|---|---|
| `200` | 成功建立響應 |

#### `200` 響應欄位

| 欄位 | 型別 | 說明 |
|---|---|---|
| `id` | string | — |
| `object` | string | — |
| `created_at` | integer | — |
| `status` | enum（`completed`, `failed`, `in_progress`, `incomplete`） | — |
| `model` | string | — |
| `output` | array&lt;object&gt; | — |
| `usage.prompt_tokens` | integer | 提示詞 Token 數 |
| `usage.completion_tokens` | integer | 補全 Token 數 |
| `usage.total_tokens` | integer | 總 Token 數 |
| `usage.prompt_tokens_details.cached_tokens` | integer | — |
| `usage.prompt_tokens_details.text_tokens` | integer | — |
| `usage.prompt_tokens_details.audio_tokens` | integer | — |
| `usage.prompt_tokens_details.image_tokens` | integer | — |
| `usage.completion_tokens_details.text_tokens` | integer | — |
| `usage.completion_tokens_details.audio_tokens` | integer | — |
| `usage.completion_tokens_details.reasoning_tokens` | integer | — |
