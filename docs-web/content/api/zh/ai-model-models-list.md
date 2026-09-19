# 列出模型

## 原生OpenAI格式

获取当前可用的模型列表。

根据请求头自动识别返回格式：
- 包含 `x-api-key` 和 `anthropic-version` 头时返回 Anthropic 格式
- 包含 `x-goog-api-key` 头或 `key` 查询参数时返回 Gemini 格式
- 其他情况返回 OpenAI 格式

`GET` `/v1/models`

### 请求参数

| 参数名 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `key` | query | string | 否 | Google API Key (用于 Gemini 格式) |
| `x-api-key` | header | string | 否 | Anthropic API Key (用于 Claude 格式) |
| `anthropic-version` | header | string | 否 | Anthropic API 版本 |
| `x-goog-api-key` | header | string | 否 | Google API Key (用于 Gemini 格式) |

### 响应

| 状态码 | 说明 |
|---|---|
| `200` | 成功获取模型列表 |
| `401` | 认证失败 |

#### `200` 响应字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `object` | string | — |
| `data` | array&lt;object&gt; | — |

#### `401` 响应字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `error.message` | string | 错误信息 |
| `error.type` | string | 错误类型 |
| `error.param` | string | 相关参数 |
| `error.code` | string | 错误代码 |

## 原生Gemini格式

以 Gemini API 格式返回可用模型列表

`GET` `/v1beta/models`

### 响应

| 状态码 | 说明 |
|---|---|
| `200` | 成功获取模型列表 |

#### `200` 响应字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `models` | array&lt;object&gt; | — |
