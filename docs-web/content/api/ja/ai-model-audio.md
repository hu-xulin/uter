# Native Gemini Format

## Native Gemini Format

Gemini の音声生成インターフェースです。
`gemini-2.5-flash-preview-tts` などのモデルを使用できます。

`POST` `/v1beta/models/{model}:generateContent`

### リクエストパラメータ

| パラメータ名 | 位置 | 型 | 必須 | 説明 |
|---|---|---|---|---|
| `model` | path | string | 必須 | モデル名 |

### リクエストボディ（`application/json`）

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `contents` | array&lt;object&gt; | 必須 | — |
| `generationConfig.responseModalities` | array&lt;string&gt; | 任意 | — |

### レスポンス

| ステータスコード | 説明 |
|---|---|
| `200` | 成功 |

#### `200` レスポンスフィールド

| フィールド | 型 | 説明 |
|---|---|---|
| `candidates` | array&lt;object&gt; | — |
| `usageMetadata.promptTokenCount` | integer | — |
| `usageMetadata.candidatesTokenCount` | integer | — |
| `usageMetadata.totalTokenCount` | integer | — |
