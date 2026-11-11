# kling

## Kling Image to Video

使用 Kling 模型从图片生成视频。

支持通过 image 参数传入图片 URL 或 Base64 编码的图片数据。

`POST` `/kling/v1/videos/image2video`

### 请求体（`application/json`）

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
| `200` | 成功创建视频生成任务 |
| `400` | 请求参数错误 |

#### `200` 响应字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `task_id` | string | 任务 ID |
| `status` | string | 任务状态 |

#### `400` 响应字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `error.message` | string | 错误信息 |
| `error.type` | string | 错误类型 |
| `error.param` | string | 相关参数 |
| `error.code` | string | 错误代码 |

## Kling Text-to-Video

使用 Kling 模型从文本描述生成视频。

支持的模型：kling-v1, kling-v1-5 等

`POST` `/kling/v1/videos/text2video`

### 请求体（`application/json`）

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
| `200` | 成功创建视频生成任务 |
| `400` | 请求参数错误 |

#### `200` 响应字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `task_id` | string | 任务 ID |
| `status` | string | 任务状态 |

#### `400` 响应字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `error.message` | string | 错误信息 |
| `error.type` | string | 错误类型 |
| `error.param` | string | 相关参数 |
| `error.code` | string | 错误代码 |

## Get Kling Image-to-Video Task Status

查询 Kling 图生视频任务的状态和结果。

`GET` `/kling/v1/videos/image2video/{task_id}`

### 请求参数

| 参数名 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `task_id` | path | string | 是 | 任务 ID |

### 响应

| 状态码 | 说明 |
|---|---|
| `200` | 成功获取任务状态 |
| `404` | 任务不存在 |

#### `200` 响应字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `task_id` | string | 任务 ID |
| `status` | enum（`queued`, `in_progress`, `completed`, `failed`） | 任务状态 |
| `url` | string | 视频资源 URL（成功时） |
| `format` | string | 视频格式 |
| `metadata.duration` | number | 实际生成的视频时长 |
| `metadata.fps` | integer | 实际帧率 |
| `metadata.width` | integer | 实际宽度 |
| `metadata.height` | integer | 实际高度 |
| `metadata.seed` | integer | 使用的随机种子 |
| `error.code` | integer | 错误码 |
| `error.message` | string | 错误信息 |

#### `404` 响应字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `error.message` | string | 错误信息 |
| `error.type` | string | 错误类型 |
| `error.param` | string | 相关参数 |
| `error.code` | string | 错误代码 |

## Get Kling Text-to-Video Task Status

查询 Kling 文生视频任务的状态和结果。

`GET` `/kling/v1/videos/text2video/{task_id}`

### 请求参数

| 参数名 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `task_id` | path | string | 是 | 任务 ID |

### 响应

| 状态码 | 说明 |
|---|---|
| `200` | 成功获取任务状态 |
| `404` | 任务不存在 |

#### `200` 响应字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `task_id` | string | 任务 ID |
| `status` | enum（`queued`, `in_progress`, `completed`, `failed`） | 任务状态 |
| `url` | string | 视频资源 URL（成功时） |
| `format` | string | 视频格式 |
| `metadata.duration` | number | 实际生成的视频时长 |
| `metadata.fps` | integer | 实际帧率 |
| `metadata.width` | integer | 实际宽度 |
| `metadata.height` | integer | 实际高度 |
| `metadata.seed` | integer | 使用的随机种子 |
| `error.code` | integer | 错误码 |
| `error.message` | string | 错误信息 |

#### `404` 响应字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `error.message` | string | 错误信息 |
| `error.type` | string | 错误类型 |
| `error.param` | string | 相关参数 |
| `error.code` | string | 错误代码 |
