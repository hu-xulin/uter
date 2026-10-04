# embeddings

## Native OpenAI Format

テキストをベクトル埋め込みに変換します。

`POST` `/v1/embeddings`

### リクエストボディ（`application/json`）

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `model` | string | 必須 | — |
| `encoding_format` | enum（`float`, `base64`） | 任意 | — |
| `dimensions` | integer | 任意 | 出力ベクトルの次元数 |

### レスポンス

| ステータスコード | 説明 |
|---|---|
| `200` | 埋め込みの作成に成功 |

#### `200` レスポンスフィールド

| フィールド | 型 | 説明 |
|---|---|---|
| `object` | string | — |
| `data` | array&lt;object&gt; | — |
| `model` | string | — |
| `usage.prompt_tokens` | integer | — |
| `usage.total_tokens` | integer | — |

## Native Gemini Format

指定したエンジン/モデルで埋め込みを作成します。

`POST` `/v1/engines/{model}/embeddings`

### リクエストパラメータ

| パラメータ名 | 位置 | 型 | 必須 | 説明 |
|---|---|---|---|---|
| `model` | path | string | 必須 | モデル/エンジン ID |

### リクエストボディ（`application/json`）

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `model` | string | 必須 | — |
| `encoding_format` | enum（`float`, `base64`） | 任意 | — |
| `dimensions` | integer | 任意 | 出力ベクトルの次元数 |

### レスポンス

| ステータスコード | 説明 |
|---|---|
| `200` | 埋め込みの作成に成功 |

#### `200` レスポンスフィールド

| フィールド | 型 | 説明 |
|---|---|---|
| `object` | string | — |
| `data` | array&lt;object&gt; | — |
| `model` | string | — |
| `usage.prompt_tokens` | integer | — |
| `usage.total_tokens` | integer | — |
