# Native OpenAI Format

## Native OpenAI Format

リアルタイム対話のための WebSocket 接続を確立します。

**注意**: これは WebSocket エンドポイントであり、WebSocket プロトコルでの接続が必要です。

接続 URL の例: `wss://api.example.com/v1/realtime?model=gpt-4o-realtime`

`GET` `/v1/realtime`

### リクエストパラメータ

| パラメータ名 | 位置 | 型 | 必須 | 説明 |
|---|---|---|---|---|
| `model` | query | string | 任意 | 使用するモデル |

### レスポンス

| ステータスコード | 説明 |
|---|---|
| `101` | WebSocket プロトコル切り替え |
| `400` | リクエストエラー |

#### `400` レスポンスフィールド

| フィールド | 型 | 説明 |
|---|---|---|
| `error.message` | string | エラーメッセージ |
| `error.type` | string | エラータイプ |
| `error.param` | string | 関連パラメータ |
| `error.code` | string | エラーコード |
