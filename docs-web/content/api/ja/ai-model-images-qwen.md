# qwen

## Generate Images

Bailian qwen-image シリーズの画像生成です。

`POST` `/v1/images/generations`

### リクエストボディ（`application/json`）

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `model` | string | 必須 | — |
| `input.messages` | array&lt;object&gt; | 任意 | — |
| `parameters.negative_prompt` | string | 任意 | — |
| `parameters.prompt_extend` | boolean | 任意 | — |
| `parameters.watermark` | boolean | 任意 | — |
| `parameters.size` | string | 任意 | — |

### レスポンス

| ステータスコード | 説明 |
|---|---|
| `200` | 画像の生成に成功 |

#### `200` レスポンスフィールド

| フィールド | 型 | 説明 |
|---|---|---|
| `created` | integer | — |
| `data` | array&lt;object&gt; | — |

## Edit Image

Bailian qwen-image シリーズの画像編集です。

`POST` `/v1/images/edits`

### リクエストボディ（`application/json`）

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `model` | string | 必須 | — |
| `input.messages` | array&lt;object&gt; | 任意 | — |
| `parameters.n` | integer | 任意 | — |
| `parameters.negative_prompt` | string | 任意 | — |
| `parameters.prompt_extend` | boolean | 任意 | — |
| `parameters.watermark` | boolean | 任意 | — |
| `parameters.size` | string | 任意 | — |

### レスポンス

| ステータスコード | 説明 |
|---|---|
| `200` | 画像の生成に成功 |

#### `200` レスポンスフィールド

| フィールド | 型 | 説明 |
|---|---|---|
| `created` | integer | — |
| `data` | array&lt;object&gt; | — |
