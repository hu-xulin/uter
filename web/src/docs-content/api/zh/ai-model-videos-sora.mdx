# Sora格式

## 创建视频 

OpenAI 兼容的视频生成接口。

参考文档: https://platform.openai.com/docs/api-reference/videos/create

`POST` `/v1/videos`

### 请求体（`multipart/form-data`）

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `model` | string | 否 | 模型/风格 ID |
| `prompt` | string | 否 | 文本描述提示词 |
| `image` | string | 否 | 图片输入 (URL 或 Base64) |
| `duration` | number | 否 | 视频时长（秒） |
| `width` | integer | 否 | 视频宽度 |
| `height` | integer | 否 | 视频高度 |
| `fps` | integer | 否 | 视频帧率 |
| `seed` | integer | 否 | 随机种子 |
| `n` | integer | 否 | 生成视频数量 |
| `response_format` | string | 否 | 响应格式 |
| `user` | string | 否 | 用户标识 |
| `metadata` | object | 否 | 扩展参数 (如 negative_prompt, style, quality_level 等) |

### 响应

| 状态码 | 说明 |
|---|---|
| `200` | 成功创建视频任务 |
| `400` | 请求参数错误 |

#### `200` 响应字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | 视频 ID |
| `object` | string | 对象类型 |
| `model` | string | 使用的模型 |
| `status` | string | 任务状态 |
| `progress` | integer | 进度百分比 |
| `created_at` | integer | 创建时间戳 |
| `seconds` | string | 视频时长 |
| `completed_at` | integer | 完成时间戳 |
| `expires_at` | integer | 过期时间戳 |
| `size` | string | 视频尺寸 |
| `error.message` | string | 错误信息 |
| `error.code` | string | 错误码 |
| `metadata` | object | 额外元数据 |

#### `400` 响应字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `error.message` | string | 错误信息 |
| `error.type` | string | 错误类型 |
| `error.param` | string | 相关参数 |
| `error.code` | string | 错误代码 |

## 获取视频任务状态 

OpenAI 兼容的视频任务状态查询接口。

返回视频任务的详细状态信息。

`GET` `/v1/videos/{task_id}`

### 请求参数

| 参数名 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `task_id` | path | string | 是 | 视频任务 ID |

### 响应

| 状态码 | 说明 |
|---|---|
| `200` | 成功获取视频任务状态 |
| `404` | 任务不存在 |

#### `200` 响应字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | — |
| `object` | string | — |
| `model` | string | — |
| `status` | string | — |
| `progress` | integer | — |
| `created_at` | integer | — |
| `seconds` | string | — |

#### `404` 响应字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `error.message` | string | 错误信息 |
| `error.type` | string | 错误类型 |
| `error.param` | string | 相关参数 |
| `error.code` | string | 错误代码 |

## 获取视频内容

获取已完成视频任务的视频文件内容。

此接口会代理返回视频文件流。

`GET` `/v1/videos/{task_id}/content`

### 请求参数

| 参数名 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `task_id` | path | string | 是 | 视频任务 ID |

### 响应

| 状态码 | 说明 |
|---|---|
| `200` | 成功获取视频内容 |
| `404` | 视频不存在或未完成 |

#### `404` 响应字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `error.message` | string | 错误信息 |
| `error.type` | string | 错误类型 |
| `error.param` | string | 相关参数 |
| `error.code` | string | 错误代码 |
