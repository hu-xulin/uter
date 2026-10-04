# Native OpenAI Format

## Native OpenAI Format

テキスト内容が利用ポリシーに違反していないかを確認します。

`POST` `/v1/moderations`

### リクエストボディ（`application/json`）

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `model` | string | 任意 | — |

### レスポンス

| ステータスコード | 説明 |
|---|---|
| `200` | 審査に成功 |

#### `200` レスポンスフィールド

| フィールド | 型 | 説明 |
|---|---|---|
| `id` | string | — |
| `model` | string | — |
| `results` | array&lt;object&gt; | — |
