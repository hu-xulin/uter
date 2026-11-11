# Seedance格式

Seedance 视频生成（Dreamina）：通过异步任务接口调用 Dreamina Seedance 2.0 系列模型，支持文生视频、图生视频、视频续写 / 编辑。

## 支持的模型

| 模型 | 说明 | 支持能力 |
|---|---|---|
| `dreamina-seedance-2-0` | 标准版，画质优先 | 文生视频、图生视频、视频续写 |
| `dreamina-seedance-2-0-fast` | 快速版，延迟更低 | 文生视频、图生视频、视频续写 |

两个模型都支持**视频作为输入**（视频续写 / 编辑），在 `metadata.content` 中传入 `video_url` 即可。

## 创建视频

`POST` `/v1/video/generations`

### 请求头

| Header | 必填 | 说明 |
|---|---|---|
| `Authorization` | 是 | `Bearer sk-你的APIKey` |
| `Content-Type` | 是 | `application/json` |

### 请求体（`application/json`）

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `model` | string | 是 | Seedance 模型名，见上表 |
| `prompt` | string | 是 | 视频描述提示词 |
| `image` | string | 否 | 图生视频的参考图（URL 或 base64 data URI）；与 `images` 二选一 |
| `images` | string[] | 否 | 多图参考（URL 或 base64 data URI） |
| `duration` | int | 否 | 视频时长（秒），常见 5 / 10 秒，默认 5 |
| `seconds` | string | 否 | `duration` 的字符串形式（兼容 OpenAI Sora API）。必须是纯数字字符串（如 `"5"`、`"10"`），不能带单位。仅在顶层 `duration` 为 `0` 或未传时生效 |
| `metadata` | object | 否 | Seedance 特有参数容器，见「特有参数」 |

### 响应

| 状态码 | 说明 |
|---|---|
| `200` | 成功创建视频任务 |
| `400` | 请求参数错误 |

#### `200` 响应字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` / `task_id` | string | 公开任务 ID（`task_` 前缀），用于后续查询 |
| `object` | string | 对象类型（`video`） |
| `model` | string | 使用的模型 |
| `status` | string | 任务状态（提交后为 `queued`） |
| `progress` | integer | 进度百分比 |
| `created_at` | integer | 创建时间戳 |

> `id` / `task_id` 由优特智能生成，不等于上游任务 id。

## 获取视频任务状态

`GET` `/v1/video/generations/{task_id}`

响应结构为 `{code, message, data}` 包装；成功时 `code` 为 `"success"`，`data` 是任务详情对象。

### 请求参数

| 参数名 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `task_id` | path | string | 是 | 视频任务 ID |

### 响应

| 状态码 | 说明 |
|---|---|
| `200` | 成功获取视频任务状态 |
| `404` | 任务不存在 |

#### `200` 响应字段（`data`）

| 字段 | 类型 | 说明 |
|---|---|---|
| `data.id` | int | 内部任务自增 ID |
| `data.task_id` | string | 公开任务 ID（`task_` 前缀） |
| `data.platform` | string | 上游平台编号 |
| `data.user_id` | int | 用户 ID |
| `data.group` | string | 所属分组 |
| `data.channel_id` | int | 实际调用的渠道 ID |
| `data.quota` | int | 本次任务扣费的 quota 原始值 |
| `data.action` | string | 任务动作，通常为 `generate` |
| `data.status` | string | 任务状态：`SUBMITTED` / `QUEUED` / `IN_PROGRESS` / `SUCCESS` / `FAILURE` |
| `data.fail_reason` | string | 失败原因（仅 `status = FAILURE` 时非空） |
| `data.result_url` | string | 视频结果 URL（仅成功时返回，为上游临时链接） |
| `data.progress` | string | 进度，形如 `"100%"` |
| `data.submit_time` / `start_time` / `finish_time` | int64 | 提交 / 开始 / 完成的 Unix 时间戳（秒） |
| `data.properties.upstream_model_name` | string | 实际发给上游的模型名 |
| `data.data` | object | 上游原始响应（含 `usage`、`content.video_url`、`resolution`、`framespersecond` 等） |

#### 状态枚举

| 状态 | 说明 |
|---|---|
| `SUBMITTED` | 已提交 |
| `QUEUED` | 已进入上游队列 |
| `IN_PROGRESS` | 生成中 |
| `SUCCESS` | 已完成，`result_url` 为视频地址 |
| `FAILURE` | 生成失败，`fail_reason` 为失败原因 |

## 获取视频内容

`GET` `/v1/videos/{task_id}/content`

直接返回视频二进制流（`Content-Type: video/mp4`）。优特智能自动代理上游 URL。

### 请求参数

| 参数名 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `task_id` | path | string | 是 | 视频任务 ID |

> **强烈推荐**使用 `/content` 代理接口下载视频，而不是直接访问 `result_url`。后者是上游的临时链接，有效期有限。

## 特有参数（`metadata`）

所有 Seedance 特有字段都通过请求体的 `metadata` 对象传递，优特智能会透传给上游。

### 分辨率 / 宽高比 / 时长

| 字段 | 类型 | 说明 |
|---|---|---|
| `resolution` | string | 分辨率档位：`480p` `720p` `1080p` |
| `ratio` | string | 宽高比：`16:9` `9:16` `1:1` `4:3` `3:4` `21:9` `adaptive`（自适应） |
| `duration` | int | 视频时长（秒），`5` `10`。**注意：**顶层 `duration`（或 `seconds`）优先级高于 `metadata.duration` |
| `frames` | int | 指定帧数（可选，与 `duration` 互斥），如 `121` |
| `seed` | int | 随机种子，`0` ~ `2^31-1` |

### 镜头与内容控制

| 字段 | 类型 | 说明 |
|---|---|---|
| `camera_fixed` | bool | 是否固定镜头（`true` = 镜头静止） |
| `watermark` | bool | 是否添加官方水印 |

### 高级参数

| 字段 | 类型 | 说明 |
|---|---|---|
| `service_tier` | string | 服务档位，影响速度与配额（如 `auto` / `default` / `priority`） |
| `execution_expires_after` | int | 任务执行超时时间（秒） |
| `generate_audio` | bool | 是否同步生成音频 |
| `draft` | bool | 草稿模式（更快速、更便宜，质量略降） |
| `return_last_frame` | bool | 是否在响应中返回视频最后一帧图片 |
| `callback_url` | string | 任务完成后的回调通知 URL |

### 多模态输入（`content` 数组）

除顶层 `image` / `images` 字段外，也可直接在 `metadata.content` 传递多模态输入数组，支持**图片**和**视频**混合输入：

| `type` | 用途 |
|---|---|
| `image_url` + `image_url.url` | 图片参考（图生视频） |
| `video_url` + `video_url.url` | 视频输入（视频续写 / 编辑） |

```json
{
  "model": "dreamina-seedance-2-0",
  "prompt": "把这段视频延长，让猫咪走到画面外",
  "metadata": {
    "content": [
      { "type": "video_url", "video_url": { "url": "https://example.com/cat.mp4" } }
    ],
    "resolution": "720p"
  }
}
```

## 完整调用示例

```bash
# 文生视频
curl -X POST https://uter.ai/v1/video/generations \
  -H "Authorization: Bearer sk-你的APIKey" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "dreamina-seedance-2-0",
    "prompt": "一只猫在月球表面漫步，背景是璀璨的星空",
    "duration": 5,
    "metadata": { "resolution": "720p", "ratio": "16:9", "seed": 42 }
  }'

# 轮询任务
curl https://uter.ai/v1/video/generations/task_xxx \
  -H "Authorization: Bearer sk-你的APIKey"

# 下载视频
curl https://uter.ai/v1/videos/task_xxx/content \
  -H "Authorization: Bearer sk-你的APIKey" \
  -o cat_on_moon.mp4
```

## 状态码与错误

| 场景 | 说明 |
|---|---|
| `400` | 模型不存在或未授权（`model not allowed`）、`prompt` 为空（`prompt is required`）、分辨率 / 时长参数非法 |
| `401` / `403` | API Key 无效 / 无权访问此模型（检查 token 模型白名单） |
| `402` | 余额不足（`insufficient user quota`） |
| 任务 `FAILURE` | 上游生成失败（内容审核失败 / 图片视频 URL 不可访问 / 上游超时）；优特智能会自动退回已扣费用 |

常见处理建议：内容审核失败时调整 prompt；URL 不可访问时改为 base64；上游超时时稍后重试或切换到 `dreamina-seedance-2-0-fast`。
