# 原生Gemini格式

## Gemini媒體識別

Gemini影象、PDF、音訊、影片識別請求

⚠️注意：原生 Gemini 格式請求支援透過 inlineData（base64）或 fileData.fileUri（可公開訪問的 URL，支援 YouTube 連結）傳遞媒體。透過 Gemini File API 上傳的檔案 URI 能否訪問，取決於上游渠道 Key 的許可權，建議優先使用可公開訪問的 URL。OpenAI 格式（chat/completions）請求轉換為 Gemini 時，媒體將統一下載並轉換為 inlineData（base64）傳遞。

`POST` `/v1beta/models/{model}:generateContent`

### 請求引數

| 引數名 | 位置 | 型別 | 必填 | 說明 |
|---|---|---|---|---|
| `model` | path | string | 是 | 模型名稱 |

### 請求體（`application/json`）

| 欄位 | 型別 | 必填 | 說明 |
|---|---|---|---|
| `contents` | array&lt;object&gt; | 否 | — |
| `generationConfig.temperature` | number | 否 | — |
| `generationConfig.topP` | number | 否 | — |
| `generationConfig.topK` | integer | 否 | — |
| `generationConfig.maxOutputTokens` | integer | 否 | — |
| `generationConfig.stopSequences` | array&lt;string&gt; | 否 | — |
| `safetySettings` | array&lt;object&gt; | 否 | — |
| `tools` | array&lt;object&gt; | 否 | — |
| `systemInstruction.parts` | array&lt;object&gt; | 否 | — |

### 響應

| 狀態碼 | 說明 |
|---|---|
| `200` | 成功 |

#### `200` 響應欄位

| 欄位 | 型別 | 說明 |
|---|---|---|
| `candidates` | array&lt;object&gt; | — |
| `usageMetadata.promptTokenCount` | integer | — |
| `usageMetadata.candidatesTokenCount` | integer | — |
| `usageMetadata.totalTokenCount` | integer | — |

## Gemini文字聊天

代理 Gemini API 請求。
路徑格式: `/v1beta/models/{model_name}:{action}`

例如:
- `/v1beta/models/gemini-2.5-pro:generateContent`
- `/v1beta/models/gemini-2.5-pro:streamGenerateContent?alt=sse`

`POST` `/v1beta/models/{model}:generateContent`

### 請求引數

| 引數名 | 位置 | 型別 | 必填 | 說明 |
|---|---|---|---|---|
| `model` | path | string | 是 | 模型名稱 |

### 請求體（`application/json`）

| 欄位 | 型別 | 必填 | 說明 |
|---|---|---|---|
| `contents` | array&lt;object&gt; | 否 | — |
| `generationConfig.temperature` | number | 否 | — |
| `generationConfig.topP` | number | 否 | — |
| `generationConfig.topK` | integer | 否 | — |
| `generationConfig.maxOutputTokens` | integer | 否 | — |
| `generationConfig.stopSequences` | array&lt;string&gt; | 否 | — |
| `safetySettings` | array&lt;object&gt; | 否 | — |
| `tools` | array&lt;object&gt; | 否 | — |
| `systemInstruction.parts` | array&lt;object&gt; | 否 | — |

### 響應

| 狀態碼 | 說明 |
|---|---|
| `200` | 成功 |

#### `200` 響應欄位

| 欄位 | 型別 | 說明 |
|---|---|---|
| `candidates` | array&lt;object&gt; | — |
| `usageMetadata.promptTokenCount` | integer | — |
| `usageMetadata.candidatesTokenCount` | integer | — |
| `usageMetadata.totalTokenCount` | integer | — |
