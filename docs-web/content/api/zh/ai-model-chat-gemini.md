# 原生Gemini格式

## Gemini媒体识别

Gemini图像、PDF、音频、视频识别请求

⚠️注意：原生 Gemini 格式请求支持通过 inlineData（base64）或 fileData.fileUri（可公开访问的 URL，支持 YouTube 链接）传递媒体。通过 Gemini File API 上传的文件 URI 能否访问，取决于上游渠道 Key 的权限，建议优先使用可公开访问的 URL。OpenAI 格式（chat/completions）请求转换为 Gemini 时，媒体将统一下载并转换为 inlineData（base64）传递。

`POST` `/v1beta/models/{model}:generateContent`

### 请求参数

| 参数名 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `model` | path | string | 是 | 模型名称 |

### 请求体（`application/json`）

| 字段 | 类型 | 必填 | 说明 |
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

### 响应

| 状态码 | 说明 |
|---|---|
| `200` | 成功 |

#### `200` 响应字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `candidates` | array&lt;object&gt; | — |
| `usageMetadata.promptTokenCount` | integer | — |
| `usageMetadata.candidatesTokenCount` | integer | — |
| `usageMetadata.totalTokenCount` | integer | — |

## Gemini文本聊天

代理 Gemini API 请求。
路径格式: `/v1beta/models/{model_name}:{action}`

例如:
- `/v1beta/models/gemini-2.5-pro:generateContent`
- `/v1beta/models/gemini-2.5-pro:streamGenerateContent?alt=sse`

`POST` `/v1beta/models/{model}:generateContent`

### 请求参数

| 参数名 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `model` | path | string | 是 | 模型名称 |

### 请求体（`application/json`）

| 字段 | 类型 | 必填 | 说明 |
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

### 响应

| 状态码 | 说明 |
|---|---|
| `200` | 成功 |

#### `200` 响应字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `candidates` | array&lt;object&gt; | — |
| `usageMetadata.promptTokenCount` | integer | — |
| `usageMetadata.candidatesTokenCount` | integer | — |
| `usageMetadata.totalTokenCount` | integer | — |
