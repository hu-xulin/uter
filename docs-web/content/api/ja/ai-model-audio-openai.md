# openai

## Text-to-Speech

テキストを音声に変換します。

`POST` `/v1/audio/speech`

### リクエストボディ（`application/json`）

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `model` | string | 必須 | — |
| `input` | string | 必須 | 変換するテキスト |
| `voice` | enum（`alloy`, `echo`, `fable`, `onyx`, `nova`, `shimmer`） | 必須 | — |
| `response_format` | enum（`mp3`, `opus`, `aac`, `flac`, `wav`, `pcm`） | 任意 | — |
| `speed` | number | 任意 | — |

### レスポンス

| ステータスコード | 説明 |
|---|---|
| `200` | 音声の生成に成功 |

## Audio Transcriptions

音声をテキストに変換します。

`POST` `/v1/audio/transcriptions`

### リクエストボディ（`multipart/form-data`）

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `file` | string（binary） | 必須 | 音声ファイル |
| `model` | string | 必須 | — |
| `language` | string | 任意 | ISO-639-1 言語コード |
| `prompt` | string | 任意 | — |
| `response_format` | enum（`json`, `text`, `srt`, `verbose_json`, `vtt`） | 任意 | — |
| `temperature` | number | 任意 | — |
| `timestamp_granularities` | array&lt;enum（`word`, `segment`）&gt; | 任意 | — |

### レスポンス

| ステータスコード | 説明 |
|---|---|
| `200` | 書き起こしに成功 |

#### `200` レスポンスフィールド

| フィールド | 型 | 説明 |
|---|---|---|
| `text` | string | — |

## Audio Translation

音声を英語のテキストに翻訳します。

`POST` `/v1/audio/translations`

### リクエストボディ（`multipart/form-data`）

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `file` | string（binary） | 必須 | — |
| `model` | string | 必須 | — |
| `prompt` | string | 任意 | — |
| `response_format` | string | 任意 | — |
| `temperature` | number | 任意 | — |

### レスポンス

| ステータスコード | 説明 |
|---|---|
| `200` | 翻訳に成功 |

#### `200` レスポンスフィールド

| フィールド | 型 | 説明 |
|---|---|---|
| `text` | string | — |
