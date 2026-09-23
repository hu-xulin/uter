# PixVerse格式

PixVerse 视频生成：通过 OpenAI 兼容的 `/v1/videos` 接口调用 PixVerse 全系列模型（C1 / V6 / V5.6 / V5.5 / V5 / V4.5 / V4 / V3.5），支持文生视频、图生视频。

## 支持的模型

调用时在 `model` 字段统一使用 `PixVerse/<版本号>` 的形式，例如 `PixVerse/v5.6`。

| 模型 | 特点 | 时长档位 | 音频支持 |
|---|---|---|---|
| `PixVerse/c1` | 旗舰版，按秒计费最灵活 | 1~15 秒（按秒） | ✓ |
| `PixVerse/v6` | 最新代，按秒计费 | 1~15 秒（按秒） | ✓ |
| `PixVerse/v5.6` | 单片段模式，画质稳定 | 5 / 8 / 10 秒 | ✓ |
| `PixVerse/v5.5` | 支持 Multi-Clip 拼接 | 5 / 8 / 10 秒 | ✓ |
| `PixVerse/v5` | 第 5 代基础版 | 5 / 8 秒 | ✗ |
| `PixVerse/v4.5` | 第 4.5 代，支持 Fast Motion | 5 / 8 秒 | ✗ |
| `PixVerse/v4` | 第 4 代，支持 Fast Motion | 5 / 8 秒 | ✗ |
| `PixVerse/v3.5` | 第 3.5 代，支持 Fast Motion | 5 / 8 秒 | ✗ |

> 模型名中 `PixVerse/` 前缀大小写敏感，建议严格使用 `PixVerse/v5.6` 这种格式；版本号部分（`v5.6`、`c1`）支持大小写自动 normalize。

## 创建视频

`POST` `/v1/videos`

### 请求头

| Header | 必填 | 说明 |
|---|---|---|
| `Authorization` | 是 | `Bearer sk-你的APIKey` |
| `Content-Type` | 是 | `application/json` |

### 请求体（`application/json`）

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `model` | string | 是 | PixVerse 模型名，见上表 |
| `prompt` | string | 是 | 视频描述提示词，最长 2048 字符 |
| `image` | string | 否 | 图生视频模式的原图（URL 或 base64 data URI），传入后自动切换为图生视频 |
| `images` | string[] | 否 | `image` 的数组形式（与 `image` 二选一） |
| `duration` | int | 否 | 视频时长（秒），默认 5，不同模型支持的档位不同 |
| `resolution` | string | 否 | 分辨率档位（同 `size`，推荐使用，与其他模型对齐）：`720P` / `1080P` |
| `size` | string | 否 | 分辨率，支持 `360p` `540p` `720p` `1080p`，或 `1920x1080` 这类像素格式。`resolution` 与 `size` 并存时 `resolution` 优先 |
| `metadata` | object | 否 | PixVerse 特有参数容器，见「特有参数」 |

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

> `id` / `task_id` 由优特智能生成，不等于 PixVerse 上游的 `video_id`，请务必使用此处返回的值。

## 获取视频任务状态

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
| `id` | string | 视频 ID |
| `status` | string | 任务状态，见状态枚举 |
| `progress` | integer | 进度百分比 |
| `created_at` | integer | 创建时间戳 |
| `completed_at` | integer | 完成时间戳（成功时） |
| `size` | string | 视频尺寸（成功时） |
| `metadata.url` | string | 视频地址（仅 `completed` 时） |
| `error.message` | string | 失败原因（仅 `failed` 时） |

#### 状态枚举

| 状态 | 说明 |
|---|---|
| `queued` | 已提交，排队中 |
| `in_progress` | 生成中 |
| `completed` | 已完成，`metadata.url` 为视频地址 |
| `failed` | 生成失败，`error.message` 为失败原因 |

## 获取视频内容

`GET` `/v1/videos/{task_id}/content`

直接返回视频二进制流（`Content-Type: video/mp4`）。优特智能会自动代理 PixVerse 的临时 URL，避免向客户端暴露上游地址，也避免临时 URL 过期问题。

### 请求参数

| 参数名 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `task_id` | path | string | 是 | 视频任务 ID |

### 响应

| 状态码 | 说明 |
|---|---|
| `200` | 成功获取视频内容 |
| `404` | 视频不存在或未完成 |

> **强烈推荐**使用 `/content` 代理接口下载视频，而不是直接访问 `metadata.url`。后者是 PixVerse 的临时链接，有效期有限（通常数小时）；而代理接口只要任务记录未清理就永不过期。

## 特有参数（`metadata`）

所有 PixVerse 特有字段都通过请求体的 `metadata` 对象传递。

### 通用字段

| 字段 | 类型 | 适用模型 | 说明 |
|---|---|---|---|
| `quality` | string | 所有 | 分辨率，覆盖顶层 `size`，可选 `360p` `540p` `720p` `1080p` |
| `aspect_ratio` | string | 文生视频 | 宽高比，如 `16:9` `9:16` `1:1` `4:3` `3:4` `2:3` `3:2` `21:9` |
| `motion_mode` | string | V4.5 / V4 / V3.5 | 运动模式，`normal`（默认）或 `fast`（×2 价格，仅 360p/540p/720p 的 5s 支持） |
| `camera_movement` | string | 所有 | 镜头运动，如 `zoom_in` `zoom_out` `pan_left` `pan_right` 等 |
| `seed` | int | 所有 | 随机种子，0 ~ 2147483647 |
| `template_id` | int | 所有 | 模板 ID |
| `style` | string | 所有 | 风格，如 `anime` |
| `water_mark` | bool | 所有 | 是否添加水印 |
| `negative_prompt` | string | 所有 | 负面提示词 |

> `motion_mode: fast` 有严格限制：仅 V4.5 / V4 / V3.5 模型、5 秒时长、360p/540p/720p 分辨率支持。传入其他组合（如 `1080p + fast` 或 `8s + fast`）会直接返回 `400` 错误，不会产生扣费。

### 视频音频生成（C1 / V6 / V5.6 / V5.5）

| 字段 | 类型 | 适用模型 | 说明 |
|---|---|---|---|
| `generate_audio_switch` | bool | C1 / V6 / V5.6 / V5.5 | 切换到「有音频」计费档位（由上游同步生成音频） |

> V5 / V4.5 / V4 / V3.5 **不支持**音频生成。这几个模型传入 `generate_audio_switch: true` 会返回 `400` 错误。

### 图生视频高级字段

PixVerse 图生视频要求先把图片上传到上游获取 `img_id`。优特智能已**自动封装了上传流程**：直接在请求体传 `image: "https://..."` 或 `image: "data:image/png;base64,..."`，优特智能会自动上传到 PixVerse、取回 `img_id` 后转发给视频生成接口。

如果你已经有 `img_id`（高级场景），可直接传：

| 字段 | 类型 | 说明 |
|---|---|---|
| `img_id` | int | 预上传的图片 ID，优先级高于 `image` 自动上传 |

## 完整调用示例

```bash
# Step 1: 提交任务
curl -X POST https://uter.ai/v1/videos \
  -H "Authorization: Bearer sk-你的APIKey" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "PixVerse/v5.6",
    "prompt": "一只猫在月球表面漫步，背景是璀璨的星空",
    "duration": 5,
    "size": "720p",
    "metadata": { "aspect_ratio": "16:9", "seed": 42 }
  }'

# Step 2: 轮询任务状态（建议间隔 3~5 秒）
curl https://uter.ai/v1/videos/task_xxx \
  -H "Authorization: Bearer sk-你的APIKey"

# Step 3: 状态变为 completed 后，下载视频
curl https://uter.ai/v1/videos/task_xxx/content \
  -H "Authorization: Bearer sk-你的APIKey" \
  -o cat_on_moon.mp4
```

## 状态码与错误

| 场景 | 说明 |
|---|---|
| `400` | 参数组合非法（如 V5 传 `generate_audio_switch: true`、fast 模式配 1080p/8s、不支持的 quality × duration 组合、未知模型名），提交前拦截，不扣费 |
| `401` | API Key 无效或已过期 |
| `403` | API Key 无权访问此模型（检查 token 模型白名单） |
| `402` | 余额不足（`insufficient user quota`），请前往优特智能控制台充值 |
| 任务 `failed` | 上游生成失败（内容审核 / 生成失败 / 上游超时）；优特智能会**自动退款**，可在日志页面查询退款记录 |
