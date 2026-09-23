# 谷歌Veo格式

Google Veo 3.1 视频生成：通过异步任务接口调用 Veo 3.1 全系列模型，支持文生视频、图生视频，可选生成同步音频（最高 4K 输出）。

## 支持的模型

3 个模型统一使用同一接口路径，仅通过 `model` 字段区分。所有模型均支持文生视频与图生视频，均可选择是否生成音频。

| 模型 ID | 版本 | 特点 | 适用场景 |
|---|---|---|---|
| `veo-3.1-generate-001` | Veo 3.1 | 最高画质，支持 4K，原生音频 | 高质量创意内容、商业制作 |
| `veo-3.1-fast-generate-001` | Veo 3.1 Fast | 更快速度，均衡画质 | 快速迭代、批量生成 |
| `veo-3.1-lite-generate-001` | Veo 3.1 Lite | 最快速度，最低成本 | 原型验证、低成本场景 |

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
| `model` | string | 是 | Veo 3.1 模型 ID，见上表 |
| `prompt` | string | 是 | 视频描述提示词，支持中英文，建议英文获得最佳效果 |
| `size` | string | 否 | 分辨率：`720p` / `1080p` / `4000`（4K，部分模型支持），默认 `1080p` |
| `resolution` | string | 否 | 同 `size`（推荐使用，与上游一致；两者并存时以本字段为准） |
| `duration` | int | 否 | 视频时长（秒），可选 `4` / `6` / `8`，默认 `8` |
| `seconds` | string | 否 | `duration` 的字符串形式（兼容 OpenAI Sora API） |
| `aspect_ratio` | string | 否 | 宽高比，可选 `16:9` / `9:16`，默认 `16:9` |
| `generate_audio` | bool | 否 | 是否生成同步音频（语音、音效、背景音），**默认 `true`**（如不需要音频，强烈建议明确设为 `false` 以节省费用） |
| `negative_prompt` | string | 否 | 负向提示词，描述不希望出现的内容 |
| `image` | string | 否 | 图生视频首帧图，支持 HTTP(S) URL / data URI / raw base64 |
| `images` | string[] | 否 | 图生视频首帧图数组，仅 `images[0]` 生效；与 `image` 同时传时 `image` 优先 |
| `last_frame_image` | string | 否 | 尾帧图（与 `image` / `images[0]` 配合 → 首+尾帧插值生成过渡动画，Veo 3.1 专属）。格式同 `image` |
| `reference_images` | string[] | 否 | 资产参考图数组，最多 3 张；后台会以 `referenceType="asset"` 递交上游。**与 `image` / `last_frame_image` 互斥**，仅支持 `duration=8` |
| `metadata` | object | 否 | Veo 原生参数容器，见「metadata 高级参数」 |

> 顶层 `generate_audio` / `negative_prompt` / `aspect_ratio` 等 snake_case 字段会被自动映射到上游 Veo 的 camelCase 参数；也可将它们放到 `metadata` 内（snake_case 与 camelCase 均可），与顶层等价。
>
> `generate_audio: true` 会显著提高费用（约 2 倍）。计费默认值为 `true`，如不需要音频请明确设置 `generate_audio: false`。

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
| `data.task_id` | string | 任务 ID |
| `data.status` | string | 任务状态：`queued` / `processing` / `succeeded` / `failed` |
| `data.error` | string / null | 失败原因，成功时为 `null` |
| `data.format` | string / null | 输出格式（如 `mp4`），处理中或失败时为 `null` |
| `data.metadata` | object / null | 附加元数据 |
| `data.url` | string / null | 视频下载地址，处理中或失败时为 `null`（临时签名链接，24 小时有效） |

#### 状态枚举

| 状态 | 说明 |
|---|---|
| `queued` | 已提交，等待处理 |
| `processing` | 生成中 |
| `succeeded` | 已完成，`data.url` 为视频下载地址 |
| `failed` | 生成失败，`data.error` 为原因 |

## 图片输入格式

`image` / `images[0]` 均支持以下三种格式，优特智能会自动识别并转换为 Veo 上游所需的内联 base64：

| 格式 | 示例 | 说明 |
|---|---|---|
| HTTP(S) URL | `https://example.com/foo.png` | 后端同步下载并 base64 编码后转发；URL 必须公网可达且未过期 |
| data URI | `data:image/png;base64,iVBOR...` | 直接透传内联数据，无需联网 |
| raw base64 | `iVBORw0KGgo...`（不含前缀） | 无前缀纯 base64，自动嗅探 MIME 类型 |

限制：单张图片解码后 ≤ **20 MB**；URL 形式下载超时 **30 秒**；解析失败（URL 不可达 / 超大 / base64 非法）返回 `400 parse images[0] failed: ...`，**不会扣费**。`gs://` 形式的 GCS 原生 URI 暂不支持，请改用 `https://storage.googleapis.com/...`。

## metadata 高级参数

`metadata` 是 Veo 原生参数容器，可放置 OpenAI 风格中没有的高级参数。所有顶层字段也可放到 `metadata` 内（snake_case 与 camelCase 均可）。

| 字段 | 类型 | 说明 |
|---|---|---|
| `seed` | int | 随机种子（推荐放这里） |
| `personGeneration` / `person_generation` | string | 人物生成策略：`allow_all` / `allow_adult` / `dont_allow` |
| `storageUri` / `storage_uri` | string | 直接把生成结果写入指定 GCS 桶路径（仅 vertex 渠道，需要权限） |
| `compressionQuality` / `compression_quality` | string | 压缩质量：`optimized`（默认）/ `lossless` |
| `resizeMode` / `resize_mode` | string | 图生视频缩放策略：`crop` / `fit` |
| `sampleCount` / `sample_count` | int | 一次生成几条视频，**当前固定为 1**，传入会被覆盖 |

> 优先级：metadata 内已有的 camelCase > metadata 内的 snake_case > 顶层字段。

## 模型对比

| 对比项 | Veo 3.1 | Veo 3.1 Fast | Veo 3.1 Lite |
|---|---|---|---|
| **模型 ID** | `veo-3.1-generate-001` | `veo-3.1-fast-generate-001` | `veo-3.1-lite-generate-001` |
| **画质** | 最高 | 均衡 | 基础 |
| **速度（实测 8s 视频）** | 90~130 秒 | 75~105 秒 | 50~80 秒 |
| **最高分辨率** | 4K | 1080p | 1080p |
| **音频支持** | ✓ | ✓ | ✓ |
| **图生视频** | ✓ | ✓ | ✓ |

## OpenAI 兼容接口

除 `/v1/video/generations` 外，也支持 OpenAI 风格的 `/v1/videos` 接口，两者完全等价。

- 提交：`POST` `/v1/videos`（请求体字段相同）
- 查询：`GET` `/v1/videos/{task_id}`（返回 OpenAI 扁平格式）

> OpenAI 兼容接口的查询响应不包含视频 URL。如需获取下载地址，请使用 `/v1/video/generations/{task_id}` 接口，从 `data.url` 获取。

## 计费说明

```
quota = modelPrice × QuotaPerUnit × groupRatio × pricingRatio × seconds

QuotaPerUnit = 500,000
groupRatio   = 1.0（生产 default 组）
```

### 纯视频（`generate_audio: false`）

| 模型 | 720p | 1080p | 4K |
|---|---|---|---|
| `veo-3.1-generate-001` | $0.20 / 秒 | $0.20 / 秒 | $0.40 / 秒 |
| `veo-3.1-fast-generate-001` | $0.08 / 秒 | $0.10 / 秒 | $0.25 / 秒 |
| `veo-3.1-lite-generate-001` | $0.03 / 秒 | $0.05 / 秒 | — |

### 视频 + 音频（`generate_audio: true`）

| 模型 | 720p | 1080p | 4K |
|---|---|---|---|
| `veo-3.1-generate-001` | $0.40 / 秒 | $0.40 / 秒 | $0.60 / 秒 |
| `veo-3.1-fast-generate-001` | $0.10 / 秒 | $0.12 / 秒 | $0.30 / 秒 |
| `veo-3.1-lite-generate-001` | $0.05 / 秒 | $0.08 / 秒 | — |

任务失败（`failed`）时优特智能会自动退款。

## 完整调用示例

```bash
# 文生视频
curl -X POST https://uter.ai/v1/video/generations \
  -H "Authorization: Bearer sk-你的APIKey" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "veo-3.1-generate-001",
    "prompt": "A golden retriever playing fetch on a sunny beach, cinematic wide shot, slow motion",
    "size": "1080p",
    "duration": 8,
    "aspect_ratio": "16:9"
  }'

# 轮询（建议间隔 10~15 秒）
curl https://uter.ai/v1/video/generations/task_xxx \
  -H "Authorization: Bearer sk-你的APIKey"

# data.status == "succeeded" 后下载视频（data.url）
curl -o output.mp4 "https://uter.ai/v1/videos/task_xxx/content"
```

首+尾帧插值（Veo 3.1 专属）与资产参考图：

```bash
# 首+尾帧插值
curl -X POST https://uter.ai/v1/video/generations \
  -H "Authorization: Bearer sk-你的APIKey" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "veo-3.1-generate-001",
    "prompt": "Smooth cinematic transition between a serene garden and a bustling city.",
    "image": "https://example.com/start.jpg",
    "last_frame_image": "https://example.com/end.jpg",
    "size": "1080p",
    "duration": 8,
    "aspect_ratio": "16:9"
  }'
```

- `reference_images` 不能与 `image` / `images` / `last_frame_image` 同时使用，否则返回 `400 reference_images is mutually exclusive ...`。
- `reference_images` 最多 3 张，超过返回 `400 reference_images supports at most 3 entries`。
- `reference_images` 仅支持 `duration=8`。

## 状态码与错误

| 状态码 | 原因 | 处理 |
|---|---|---|
| `400` | 参数错误（缺少 `prompt`、非法 `duration` 值，或图片解析失败 `parse images[0] failed: ...`） | 检查请求体字段 |
| `401` | API Key 无效或过期 | 检查 `Authorization` 头 |
| `403` | API Key 无权访问此模型 | 检查 token 模型白名单 |
| `402` | 余额不足 | 前往优特智能控制台充值 |

任务 `failed` 常见原因：内容安全策略拦截（调整 prompt，可加 `negative_prompt`）、图片 URL 无法访问、`duration` 不在支持范围、Lite 模型不支持 4K。
