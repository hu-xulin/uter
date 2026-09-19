# 音频（Audio）

## 原生Gemini格式

Gemini 音频生成接口。
可使用gemini-2.5-flash-preview-tts等模型

`POST` `/v1beta/models/{model}:generateContent`

### 请求参数

| 参数名 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `model` | path | string | 是 | 模型名称 |

### 请求体（`application/json`）

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `contents` | array&lt;object&gt; | 是 | — |
| `generationConfig.responseModalities` | array&lt;string&gt; | 否 | — |

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
