# gemini

## Gemini Media Recognition

Gemini による画像、PDF、音声、動画の認識リクエストです。

⚠️注意：ネイティブ Gemini 形式のリクエストは、inlineData（base64）または fileData.fileUri（公開アクセス可能な URL、YouTube リンク対応）でメディアを渡すことができます。Gemini File API でアップロードしたファイルの URI がアクセス可能かどうかは、上流チャネルの Key の権限に依存します。公開アクセス可能な URL の使用を推奨します。OpenAI 形式（chat/completions）のリクエストを Gemini に変換する際、メディアは一律にダウンロードされ inlineData（base64）に変換されて渡されます。

`POST` `/v1beta/models/{model}:generateContent`

### リクエストパラメータ

| パラメータ名 | 位置 | 型 | 必須 | 説明 |
|---|---|---|---|---|
| `model` | path | string | 必須 | モデル名 |

### リクエストボディ（`application/json`）

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `contents` | array&lt;object&gt; | 任意 | — |
| `generationConfig.temperature` | number | 任意 | — |
| `generationConfig.topP` | number | 任意 | — |
| `generationConfig.topK` | integer | 任意 | — |
| `generationConfig.maxOutputTokens` | integer | 任意 | — |
| `generationConfig.stopSequences` | array&lt;string&gt; | 任意 | — |
| `safetySettings` | array&lt;object&gt; | 任意 | — |
| `tools` | array&lt;object&gt; | 任意 | — |
| `systemInstruction.parts` | array&lt;object&gt; | 任意 | — |

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

## Gemini Text Chat

Gemini API リクエストのプロキシです。
パス形式: `/v1beta/models/{model_name}:{action}`

例:
- `/v1beta/models/gemini-2.5-pro:generateContent`
- `/v1beta/models/gemini-2.5-pro:streamGenerateContent?alt=sse`

`POST` `/v1beta/models/{model}:generateContent`

### リクエストパラメータ

| パラメータ名 | 位置 | 型 | 必須 | 説明 |
|---|---|---|---|---|
| `model` | path | string | 必須 | モデル名 |

### リクエストボディ（`application/json`）

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `contents` | array&lt;object&gt; | 任意 | — |
| `generationConfig.temperature` | number | 任意 | — |
| `generationConfig.topP` | number | 任意 | — |
| `generationConfig.topK` | integer | 任意 | — |
| `generationConfig.maxOutputTokens` | integer | 任意 | — |
| `generationConfig.stopSequences` | array&lt;string&gt; | 任意 | — |
| `safetySettings` | array&lt;object&gt; | 任意 | — |
| `tools` | array&lt;object&gt; | 任意 | — |
| `systemInstruction.parts` | array&lt;object&gt; | 任意 | — |

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
