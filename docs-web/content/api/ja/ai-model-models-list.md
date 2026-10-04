# list

## Native OpenAI Format

現在利用可能なモデル一覧を取得します。

リクエストヘッダーに基づいて返却フォーマットを自動判定します：
- `x-api-key` と `anthropic-version` ヘッダーを含む場合は Anthropic 形式を返します
- `x-goog-api-key` ヘッダーまたは `key` クエリパラメータを含む場合は Gemini 形式を返します
- それ以外の場合は OpenAI 形式を返します

`GET` `/v1/models`

### リクエストパラメータ

| パラメータ名 | 位置 | 型 | 必須 | 説明 |
|---|---|---|---|---|
| `key` | query | string | 任意 | Google API Key（Gemini 形式用） |
| `x-api-key` | header | string | 任意 | Anthropic API Key（Claude 形式用） |
| `anthropic-version` | header | string | 任意 | Anthropic API のバージョン |
| `x-goog-api-key` | header | string | 任意 | Google API Key（Gemini 形式用） |

### レスポンス

| ステータスコード | 説明 |
|---|---|
| `200` | モデル一覧の取得に成功 |
| `401` | 認証失敗 |

#### `200` レスポンスフィールド

| フィールド | 型 | 説明 |
|---|---|---|
| `object` | string | — |
| `data` | array&lt;object&gt; | — |

#### `401` レスポンスフィールド

| フィールド | 型 | 説明 |
|---|---|---|
| `error.message` | string | エラーメッセージ |
| `error.type` | string | エラータイプ |
| `error.param` | string | 関連パラメータ |
| `error.code` | string | エラーコード |

## Native Gemini Format

Gemini API 形式で利用可能なモデル一覧を返します。

`GET` `/v1beta/models`

### レスポンス

| ステータスコード | 説明 |
|---|---|
| `200` | モデル一覧の取得に成功 |

#### `200` レスポンスフィールド

| フィールド | 型 | 説明 |
|---|---|---|
| `models` | array&lt;object&gt; | — |
