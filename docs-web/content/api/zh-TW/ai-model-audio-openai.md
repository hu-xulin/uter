# 原生OpenAI格式

## 文字轉語音

將文字轉換為音訊

`POST` `/v1/audio/speech`

### 請求體（`application/json`）

| 欄位 | 型別 | 必填 | 說明 |
|---|---|---|---|
| `model` | string | 是 | — |
| `input` | string | 是 | 要轉換的文字 |
| `voice` | enum（`alloy`, `echo`, `fable`, `onyx`, `nova`, `shimmer`） | 是 | — |
| `response_format` | enum（`mp3`, `opus`, `aac`, `flac`, `wav`, `pcm`） | 否 | — |
| `speed` | number | 否 | — |

### 響應

| 狀態碼 | 說明 |
|---|---|
| `200` | 成功生成音訊 |

## 音訊轉錄

將音訊轉換為文字

`POST` `/v1/audio/transcriptions`

### 請求體（`multipart/form-data`）

| 欄位 | 型別 | 必填 | 說明 |
|---|---|---|---|
| `file` | string（binary） | 是 | 音訊檔案 |
| `model` | string | 是 | — |
| `language` | string | 否 | ISO-639-1 語言程式碼 |
| `prompt` | string | 否 | — |
| `response_format` | enum（`json`, `text`, `srt`, `verbose_json`, `vtt`） | 否 | — |
| `temperature` | number | 否 | — |
| `timestamp_granularities` | array&lt;enum（`word`, `segment`）&gt; | 否 | — |

### 響應

| 狀態碼 | 說明 |
|---|---|
| `200` | 成功轉錄 |

#### `200` 響應欄位

| 欄位 | 型別 | 說明 |
|---|---|---|
| `text` | string | — |

## 音訊翻譯

將音訊翻譯為英文文字

`POST` `/v1/audio/translations`

### 請求體（`multipart/form-data`）

| 欄位 | 型別 | 必填 | 說明 |
|---|---|---|---|
| `file` | string（binary） | 是 | — |
| `model` | string | 是 | — |
| `prompt` | string | 否 | — |
| `response_format` | string | 否 | — |
| `temperature` | number | 否 | — |

### 響應

| 狀態碼 | 說明 |
|---|---|
| `200` | 成功翻譯 |

#### `200` 響應欄位

| 欄位 | 型別 | 說明 |
|---|---|---|
| `text` | string | — |
