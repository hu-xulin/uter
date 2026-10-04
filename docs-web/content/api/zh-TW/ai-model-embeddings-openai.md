# Native OpenAI Format

将文本转换为向量嵌入

`POST` `/v1/embeddings`

### 请求体（`application/json`）

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `model` | string | 是 | — |
| `encoding_format` | enum（`float`, `base64`） | 否 | — |
| `dimensions` | integer | 否 | 输出向量维度 |

### 响应

| 状态码 | 说明 |
|---|---|
| `200` | 成功创建嵌入 |

#### `200` 响应字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `object` | string | — |
| `data` | array&lt;object&gt; | — |
| `model` | string | — |
| `usage.prompt_tokens` | integer | — |
| `usage.total_tokens` | integer | — |
