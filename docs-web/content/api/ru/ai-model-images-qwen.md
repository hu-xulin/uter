# qwen

## Generate Images

百炼qwen-image系列图片生成

`POST` `/v1/images/generations`

### 请求体（`application/json`）

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `model` | string | 是 | — |
| `input.messages` | array&lt;object&gt; | 否 | — |
| `parameters.negative_prompt` | string | 否 | — |
| `parameters.prompt_extend` | boolean | 否 | — |
| `parameters.watermark` | boolean | 否 | — |
| `parameters.size` | string | 否 | — |

### 响应

| 状态码 | 说明 |
|---|---|
| `200` | 成功生成图像 |

#### `200` 响应字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `created` | integer | — |
| `data` | array&lt;object&gt; | — |

## Edit Image

百炼qwen-image系列图片编辑

`POST` `/v1/images/edits`

### 请求体（`application/json`）

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `model` | string | 是 | — |
| `input.messages` | array&lt;object&gt; | 否 | — |
| `parameters.n` | integer | 否 | — |
| `parameters.negative_prompt` | string | 否 | — |
| `parameters.prompt_extend` | boolean | 否 | — |
| `parameters.watermark` | boolean | 否 | — |
| `parameters.size` | string | 否 | — |

### 响应

| 状态码 | 说明 |
|---|---|
| `200` | 成功生成图像 |

#### `200` 响应字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `created` | integer | — |
| `data` | array&lt;object&gt; | — |
