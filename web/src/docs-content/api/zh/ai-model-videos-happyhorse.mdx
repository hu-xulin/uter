# HappyHorse格式

HappyHorse（快乐马）视频生成：通过异步任务接口调用 HappyHorse 1.0 全系列模型，支持文生视频、图生视频、参考生视频、视频编辑四种能力。

## 支持的模型

4 个模型统一使用同一接口路径 `/v1/video/generations`，仅通过 `model` 字段区分能力，响应体结构完全一致。

| 模型 | 能力 | 必传媒体输入 | 说明 |
|---|---|---|---|
| `happyhorse-1.0-t2v` | 文生视频 | — | 纯文本描述生成视频 |
| `happyhorse-1.0-i2v` | 图生视频 | 1 张首帧图 | 以首帧图为起点，按 prompt 生成后续动作 |
| `happyhorse-1.0-r2v` | 参考生视频 | 1~9 张参考图 | 多图参考生成，prompt 中用 `[Image N]` 指代 |
| `happyhorse-1.0-video-edit` | 视频编辑 | 1 段视频 + 0~5 张参考图 | 对视频做风格变换、局部替换等编辑 |

## 创建视频

提交视频生成任务，返回任务 ID，可通过查询接口轮询状态。

`POST` `/v1/video/generations`

### 请求头

| Header | 必填 | 说明 |
|---|---|---|
| `Authorization` | 是 | `Bearer sk-你的APIKey` |
| `Content-Type` | 是 | `application/json` |

### 请求体（`application/json`）

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `model` | string | 是 | HappyHorse 模型名，见上表 |
| `prompt` | string | 是 | 文本提示词，不超过 5000 个非中文字符或 2500 个中文字符，超长自动截断 |
| `size` | string | 否 | 分辨率档位，可选 `720P` / `1080P`，默认 `1080P` |
| `duration` | int | 否 | 视频时长（秒），取值 `3 ~ 15`，默认 `5`；`video-edit` 忽略此字段（时长跟随输入视频，最长 15 秒） |
| `input_reference` | string | 否 | i2v 专用：首帧图 URL（公网可访问） |
| `metadata` | object | 否 | HappyHorse 特有参数容器，见「特有参数」 |

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

> `id` / `task_id` 由优特智能生成，不等于上游 DashScope 的 task_id，请使用此处返回的值。

## 获取视频任务状态

`GET` `/v1/video/generations/{task_id}`

响应采用优特智能统一的 `{code, message, data}` 包装格式。

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
| `data.task_id` | string | 公开任务 ID |
| `data.status` | string | 任务状态：`NOT_START` / `QUEUED` / `IN_PROGRESS` / `SUCCESS` / `FAILURE` |
| `data.result_url` | string | 视频结果 URL（仅 `SUCCESS` 时非空，为上游 OSS 临时签名链接，一般 24 小时有效） |
| `data.fail_reason` | string | 失败原因（仅 `FAILURE` 时非空） |
| `data.quota` | int | 本次任务扣费的 quota 原始值 |
| `data.progress` | string | 进度字符串，形如 `"30%"` / `"100%"` |
| `data.submit_time` / `start_time` / `finish_time` | int64 | 提交 / 开始 / 完成的 Unix 时间戳（秒） |
| `data.properties.upstream_model_name` | string | 实际发给上游的模型名 |
| `data.data` | object | 上游 DashScope 原始响应（含 `output.video_url`、`usage`、`request_id`） |

#### 状态枚举

| 状态 | 上游状态 | 说明 |
|---|---|---|
| `NOT_START` | `PENDING` | 已创建，尚未开始处理（提交瞬间） |
| `QUEUED` | `PENDING` | 已进入上游队列 |
| `IN_PROGRESS` | `RUNNING` | 生成中 |
| `SUCCESS` | `SUCCEEDED` | 已完成，`result_url` 为视频地址 |
| `FAILURE` | `FAILED` / `CANCELED` / `UNKNOWN` | 生成失败，`fail_reason` 为失败原因 |

## 特有参数（`metadata`）

以下字段通过请求体的 `metadata` 对象传递，优特智能会透传给上游 DashScope。

### 视频控制参数

| 字段 | 类型 | 适用模型 | 说明 | 默认值 |
|---|---|---|---|---|
| `ratio` | string | t2v / r2v | 宽高比：`16:9` / `9:16` / `1:1` / `4:3` / `3:4` | `16:9` |
| `watermark` | bool | 所有 | 是否添加水印（右下角 "Happy Horse" 字样） | `true` |
| `seed` | int | 所有 | 随机种子，取值 `0 ~ 2147483647`，未指定自动生成 | — |
| `audio_setting` | string | video-edit | 声音控制：`auto`（模型控制）/ `origin`（保留原视频声音） | `auto` |

> i2v 不支持 `ratio`，图生视频的宽高比自动跟随输入首帧图的比例。

### 多媒体输入（`metadata.input.media`）

r2v 与 video-edit 通过 `metadata.input.media` 数组传入媒体素材：

| `type` | 用途 | 数量限制 |
|---|---|---|
| `reference_image` | 参考图片（r2v 和 video-edit 均支持） | r2v：1~9 张；video-edit：0~5 张 |
| `video` | 待编辑视频（仅 video-edit 使用） | 必须且仅有 1 个 |
| `first_frame` | 首帧图（仅 i2v 使用，也可通过顶层 `input_reference` 传递） | 仅 1 张 |

r2v 提示词规范：在 prompt 中通过 `[Image 1]`、`[Image 2]` 按数组顺序指代参考图。

### 媒体素材限制

| 类型 | 格式 | 分辨率 | 文件大小 | 其他限制 |
|---|---|---|---|---|
| 图片（i2v 首帧） | JPEG / JPG / PNG / WEBP | 宽高 ≥ 300 像素 | ≤ 10 MB | 宽高比 1:2.5 ~ 2.5:1 |
| 图片（r2v 参考图） | JPEG / JPG / PNG / WEBP | 短边 ≥ 400 像素（推荐 720P+） | ≤ 10 MB | 推荐清晰图，避免模糊过压 |
| 图片（video-edit 参考图） | JPEG / JPG / PNG / WEBP | 宽高 ≥ 300 像素 | ≤ 10 MB | 宽高比 1:2.5 ~ 2.5:1 |
| 视频（video-edit 输入） | MP4 / MOV（推荐 H.264） | 长边 ≤ 2160，短边 ≥ 320 | ≤ 100 MB | 3~60 秒，>8 fps，宽高比 1:2.5 ~ 2.5:1 |

> video-edit 输出时长规则：输入视频 ≤ 15 秒时输出等同长度；输入视频 > 15 秒时系统自动截取前 15 秒。

## OpenAI 兼容接口

除 `/v1/video/generations` 外，同时兼容 OpenAI 风格的 `/v1/videos` 接口，两套接口完全等价（同一后端任务）。

- 提交：`POST` `/v1/videos`（请求体字段完全一致）
- 查询：`GET` `/v1/videos/{task_id}`（返回 OpenAI 扁平格式）

| OpenAI 状态 | 对应统一状态 |
|---|---|
| `queued` | `NOT_START` / `QUEUED` |
| `in_progress` | `IN_PROGRESS` |
| `completed` | `SUCCESS` |
| `failed` | `FAILURE` |

## 完整调用示例

```bash
# Step 1: 提交任务
curl -X POST https://uter.ai/v1/video/generations \
  -H "Authorization: Bearer sk-你的APIKey" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "happyhorse-1.0-t2v",
    "prompt": "一只猫在阳光下打盹，毛毛随风轻轻摇曳",
    "size": "720P",
    "duration": 5,
    "metadata": { "ratio": "16:9", "seed": 42, "watermark": false }
  }'

# Step 2: 轮询任务状态（建议间隔 10~15 秒）
curl https://uter.ai/v1/video/generations/task_xxx \
  -H "Authorization: Bearer sk-你的APIKey"

# Step 3: data.status == "SUCCESS" 后，从 data.result_url 下载视频
```

## 状态码与错误

| 场景 | 说明 |
|---|---|
| `400` | 参数错误（未传 `prompt`、模型名未知等），提交前拦截，不扣费 |
| `401` / `403` | API Key 无效 / 无权访问此模型（检查 token 模型白名单） |
| `402` | 余额不足（`insufficient user quota`），请前往优特智能控制台充值 |
| 任务 `FAILURE` | 上游生成失败，见 `data.fail_reason`；优特智能会自动退款，可在日志页面查询退款记录 |

常见 `FAILURE` 原因：内容审核失败（调整 prompt）、i2v 未提供 `input_reference`、r2v 参考图为 0 张、video-edit 未提供视频、媒体 URL 不可访问或不符合素材规格。
