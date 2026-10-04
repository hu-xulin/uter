# openai

## ChatCompletions Format

会話履歴に基づいてモデルのレスポンスを作成します。ストリーミングおよび非ストリーミング応答に対応します。

OpenAI Chat Completions API 互換です。

`POST` `/v1/chat/completions`

### リクエストボディ（`application/json`）

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `model` | string | 必須 | モデル ID |
| `messages` | array&lt;object&gt; | 必須 | 会話メッセージのリスト |
| `temperature` | number | 任意 | サンプリング温度 |
| `top_p` | number | 任意 | 核サンプリングパラメータ |
| `n` | integer | 任意 | 生成数 |
| `stream` | boolean | 任意 | ストリーミング応答の有無 |
| `stream_options.include_usage` | boolean | 任意 | — |
| `max_tokens` | integer | 任意 | 最大生成 Token 数 |
| `max_completion_tokens` | integer | 任意 | 最大補完 Token 数 |
| `presence_penalty` | number | 任意 | — |
| `frequency_penalty` | number | 任意 | — |
| `logit_bias` | object | 任意 | — |
| `user` | string | 任意 | — |
| `tools` | array&lt;object&gt; | 任意 | — |
| `response_format.type` | enum（`text`, `json_object`, `json_schema`） | 任意 | — |
| `response_format.json_schema` | object | 任意 | JSON Schema 定義 |
| `seed` | integer | 任意 | — |
| `reasoning_effort` | enum（`low`, `medium`, `high`） | 任意 | 推論強度（推論対応モデル用） |
| `modalities` | array&lt;enum（`text`, `audio`）&gt; | 任意 | — |
| `audio.voice` | string | 任意 | — |
| `audio.format` | string | 任意 | — |

### レスポンス

| ステータスコード | 説明 |
|---|---|
| `200` | レスポンスの作成に成功 |
| `400` | リクエストパラメータエラー |
| `429` | リクエスト頻度制限 |

#### `200` レスポンスフィールド

| フィールド | 型 | 説明 |
|---|---|---|
| `id` | string | — |
| `object` | string | — |
| `created` | integer | — |
| `model` | string | — |
| `choices` | array&lt;object&gt; | — |
| `usage.prompt_tokens` | integer | プロンプト Token 数 |
| `usage.completion_tokens` | integer | 補完 Token 数 |
| `usage.total_tokens` | integer | 合計 Token 数 |
| `usage.prompt_tokens_details.cached_tokens` | integer | — |
| `usage.prompt_tokens_details.text_tokens` | integer | — |
| `usage.prompt_tokens_details.audio_tokens` | integer | — |
| `usage.prompt_tokens_details.image_tokens` | integer | — |
| `usage.completion_tokens_details.text_tokens` | integer | — |
| `usage.completion_tokens_details.audio_tokens` | integer | — |
| `usage.completion_tokens_details.reasoning_tokens` | integer | — |
| `system_fingerprint` | string | — |

#### `400` レスポンスフィールド

| フィールド | 型 | 説明 |
|---|---|---|
| `error.message` | string | エラーメッセージ |
| `error.type` | string | エラータイプ |
| `error.param` | string | 関連パラメータ |
| `error.code` | string | エラーコード |

#### `429` レスポンスフィールド

| フィールド | 型 | 説明 |
|---|---|---|
| `error.message` | string | エラーメッセージ |
| `error.type` | string | エラータイプ |
| `error.param` | string | 関連パラメータ |
| `error.code` | string | エラーコード |

## Responses Format

OpenAI Responses API で、モデルのレスポンスを作成します。
マルチターン対話、ツール呼び出し、推論などの機能に対応します。

`POST` `/v1/responses`

### リクエストボディ（`application/json`）

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `model` | string | 必須 | — |
| `instructions` | string | 任意 | — |
| `max_output_tokens` | integer | 任意 | — |
| `temperature` | number | 任意 | — |
| `top_p` | number | 任意 | — |
| `stream` | boolean | 任意 | — |
| `tools` | array&lt;object&gt; | 任意 | — |
| `reasoning.effort` | enum（`low`, `medium`, `high`） | 任意 | — |
| `reasoning.summary` | string | 任意 | — |
| `previous_response_id` | string | 任意 | — |
| `truncation` | enum（`auto`, `disabled`） | 任意 | — |

### レスポンス

| ステータスコード | 説明 |
|---|---|
| `200` | レスポンスの作成に成功 |

#### `200` レスポンスフィールド

| フィールド | 型 | 説明 |
|---|---|---|
| `id` | string | — |
| `object` | string | — |
| `created_at` | integer | — |
| `status` | enum（`completed`, `failed`, `in_progress`, `incomplete`） | — |
| `model` | string | — |
| `output` | array&lt;object&gt; | — |
| `usage.prompt_tokens` | integer | プロンプト Token 数 |
| `usage.completion_tokens` | integer | 補完 Token 数 |
| `usage.total_tokens` | integer | 合計 Token 数 |
| `usage.prompt_tokens_details.cached_tokens` | integer | — |
| `usage.prompt_tokens_details.text_tokens` | integer | — |
| `usage.prompt_tokens_details.audio_tokens` | integer | — |
| `usage.prompt_tokens_details.image_tokens` | integer | — |
| `usage.completion_tokens_details.text_tokens` | integer | — |
| `usage.completion_tokens_details.audio_tokens` | integer | — |
| `usage.completion_tokens_details.reasoning_tokens` | integer | — |
