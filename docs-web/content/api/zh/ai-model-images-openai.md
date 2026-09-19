# 原生OpenAI格式

## 编辑图像

在给定原始图像和提示的情况下创建编辑或扩展图像。

`POST` `/v1/images/edits/`

### 请求体（`multipart/form-data`）

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `image` | string（binary） | 是 | 要编辑的图像。必须是有效的 PNG 文件，小于 4MB，并且是方形的。如果未提供遮罩，图像必须具有透明度，将用作遮罩。 |
| `mask` | string（binary） | 否 | 附加图像，其完全透明区域（例如，alpha 为零的区域）指示image应编辑的位置。必须是有效的 PNG 文件，小于 4MB，并且尺寸与原始image相同。 |
| `prompt` | string | 是 | 所需图像的文本描述。最大长度为 1000 个字符。 |
| `n` | string | 否 | 要生成的图像数。必须介于 1 和 10 之间。 |
| `size` | string | 否 | 生成图像的大小。必须是`256x256`、`512x512`或 `1024x1024`之一。 |
| `response_format` | string | 否 | 生成的图像返回的格式。必须是`url`或`b64_json`。 |
| `user` | string | 否 | 代表您的最终用户的唯一标识符，可以帮助 OpenAI 监控和检测滥用行为。[了解更多](https://platform.openai.com/docs/guides/safety-best-practices/end-user-ids)。 |
| `model` | string | 否 | — |

### 响应

| 状态码 | 说明 |
|---|---|
| `200` | Response |

## 生成图像

在给定提示的情况下创建图像。[了解更多](https://platform.openai.com/docs/guides/images)。

`POST` `/v1/images/generations/`

### 请求体（`application/json`）

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `model` | string | 否 | 用于图像生成的模型。`dall-e-2`、`dall-e-3` 或 `gpt-image-1` 之一。默认为 `dall-e-2`，除非使用特定于 `gpt-image-1` 的参数。 |
| `prompt` | string | 是 | 所需图像的文本描述。`gpt-image-1` 的最大长度为 32000 个字符，`dall-e-2` 的最大长度为 1000 个字符，`dall-e-3` 的最大长度为 4000 个字符。 |
| `n` | integer | 否 | 要生成的图像数量。必须介于 1 到 10 之间。对于 `dall-e-3`，仅支持 `n=1`。 |
| `size` | string | 否 | 生成的图像的大小。`对于 gpt-image-1`，必须是 `1024x1024`、`1536x1024`（横向）、`1024x1536`（纵向）或`自动`（默认值）之一，`对于 dall-e-2`，必须是 `256x256、``512x512` 或 `1024x1024` 之一，对于 `dall-e-3`，必须是 `1024x1024`、`1792x1024` 或 `1024x1792` 之一。 |
| `background` | string | 否 | 允许为生成的图像的背景设置透明度。此参数仅支持 `gpt-image-1`。必须是以下之一 `透明`、`不透明`或`自动`（默认值）。使用`自动`时，模型将自动确定图像的最佳背景。  如果`是透明`的，则输出格式需要支持透明度，因此应将其设置为 `png`（默认值）或 `webp`。 |
| `moderation` | string | 否 | 控制 `gpt-image-1` 生成的图像的内容审核级别。必须为`低，` 以进行限制较少的筛选或`自动`（默认值）。 |
| `quality` | string | 否 | 将生成的图像的质量。 |
| `stream` | string | 否 | — |
| `style` | string | 否 | — |
| `user` | string | 否 | — |

### 响应

| 状态码 | 说明 |
|---|---|
| `200` | Response |

#### `200` 响应字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `created` | integer | — |
| `data` | array&lt;object&gt; | — |
| `usage.total_tokens` | integer | — |
| `usage.input_tokens` | integer | — |
| `usage.output_tokens` | integer | — |
| `usage.input_tokens_details.text_tokens` | integer | — |
| `usage.input_tokens_details.image_tokens` | integer | — |
