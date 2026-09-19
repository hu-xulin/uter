# 原生Gemini格式

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
