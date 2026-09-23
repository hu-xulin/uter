# MiniMax格式

MiniMax H3（`MiniMax-H3`）视频生成：通过异步任务接口调用 MiniMax H3，支持文生视频、图生视频、参考生视频，并按上游真实用量精确计费。

## 模型与能力

只有一个模型名：`MiniMax-H3`。**生成模式由请求中带了什么媒体输入自动决定**：

| 生成模式 | 触发条件 | 媒体输入 |
|---|---|---|
| 文生视频（t2v） | 只有 `prompt` | 无 |
| 图生视频（i2v） | 传入首帧图（可选尾帧图） | `input_reference` / `images` |
| 参考生视频（r2v） | 传入参考图 / 参考视频 / 参考音频 | 顶层 `media[]` 数组 |

无论哪种模式，`prompt`（文本提示词）**始终必填**。

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
| `model` | string | 是 | 固定为 `MiniMax-H3` |
| `prompt` | string | 是 | 文本提示词 |
| `resolution` | string | 否 | 分辨率，目前仅 `2K`（默认 `2K`） |
| `duration` | int | 否 | 生成视频时长（秒），取值 `4 ~ 15`，默认 `6` |
| `ratio` | string | 否 | 宽高比：`16:9` / `9:16` / `1:1` / `adaptive`。文生视频默认 `16:9`；图生视频默认 `adaptive`（跟随首帧图） |
| `input_reference` | string | 否 | 图生视频首帧图 URL（公网可访问 / base64） |
| `images` | string[] | 否 | 图生视频图像数组：第 1 张作首帧、第 2 张作尾帧 |
| `media` | object[] | 否 | 参考生视频结构化媒体输入，见下 |

### `media[]` 元素

用于参考生视频（r2v），精确指定每个参考素材的角色：

| `type` | 映射角色 | 用途 |
|---|---|---|
| `reference_image` | 参考图 | 参考图片（可多张） |
| `reference_video` | 参考视频 | 参考视频（其计费时长计入总秒数） |
| `reference_audio` | 参考音频 | 参考音频 |
| `first_frame` / `last_frame` | 首帧 / 尾帧 | 图生视频的首 / 尾帧图 |

未传结构化 `media` 时，优特智能会从 `images` / `input_reference` 按扩展名与顺序自动推断：视频 → 参考视频、音频 → 参考音频、第 1 张图 → 首帧、第 2 张图 → 尾帧。需要精确控制角色时请使用 `media[]`。

> 参考音频（`reference_audio`）目前受上游支持限制：实测上游会返回任务失败（优特智能自动全额退款）。文生视频、图生视频（首帧 / 首+尾帧）、参考图 / 参考视频生视频均可正常使用。

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

> `id` / `task_id` 由优特智能生成，不等于上游 MiniMax 的 task_id。

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
| `data.status` | string | 任务状态：`QUEUED` / `IN_PROGRESS` / `SUCCESS` / `FAILURE` |
| `data.result_url` | string | 视频结果 URL（仅 `SUCCESS` 时非空） |
| `data.quota` | int | 本次任务最终扣费 quota（完成后已按真实用量结算） |
| `data.data.task.usage` | object | 上游返回的精确用量，即计费依据（`total_seconds` / `input_seconds` / `output_seconds` / `input_image_count`） |

#### 状态枚举

| 统一状态 | 对应 MiniMax 状态 | 说明 |
|---|---|---|
| `QUEUED` | `queued` / `preparing` | 已进入队列 |
| `IN_PROGRESS` | `running` | 生成中 |
| `SUCCESS` | `succeeded` | 已完成，`result_url` 为视频地址 |
| `FAILURE` | `failed` / `cancelled` / `expired` | 生成失败，`fail_reason` 为失败原因 |

## 计费说明

MiniMax H3 按上游返回的**真实用量**精确计费：

```
费用(USD) = 总计费秒数 × 分辨率单价 + 计费参考图数 × $0.04
其中：总计费秒数 = 输入参考视频计费时长 + 生成视频时长
```

| 分辨率 | 单价 |
|---|---|
| `2K` | $0.13 / 秒 |
| `768P` | $0.09 / 秒（暂未开放调用） |

要点：

- **输入参考视频也计费**：r2v 传入参考视频时，其计费时长按输出视频的分辨率单价计入总秒数。
- **参考图另计**：每张计费参考图 $0.04。
- **提交时预扣、完成时按真实用量结算**：提交任务时按输出时长预扣一笔；任务成功后优特智能用上游返回的 `usage` 精确重算，多退少补。

## 完整调用示例

```bash
# Step 1: 提交任务
curl -X POST https://uter.ai/v1/video/generations \
  -H "Authorization: Bearer sk-你的APIKey" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "MiniMax-H3",
    "prompt": "一只猫在阳光下打盹，毛毛随风轻轻摇曳",
    "resolution": "2K",
    "duration": 6,
    "ratio": "16:9"
  }'

# Step 2: 轮询（建议间隔 10~15 秒）
curl https://uter.ai/v1/video/generations/task_xxx \
  -H "Authorization: Bearer sk-你的APIKey"

# Step 3: data.status == "SUCCESS" 后，从 data.result_url 下载视频
```

参考生视频使用顶层 `media[]` 传入参考素材：

```bash
curl -X POST https://uter.ai/v1/video/generations \
  -H "Authorization: Bearer sk-你的APIKey" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "MiniMax-H3",
    "prompt": "参考给定素材生成一段连贯的视频",
    "resolution": "2K",
    "duration": 6,
    "media": [
      { "type": "reference_image", "url": "https://example.com/ref.jpg" },
      { "type": "reference_video", "url": "https://example.com/ref.mp4" }
    ]
  }'
```

## 状态码与错误

| 场景 | 说明 |
|---|---|
| 未传 `prompt` | `400`，`prompt is required`（提交前拦截，不扣费） |
| `401` / `403` | API Key 无效 / 无权访问此模型 |
| `402` | 余额不足（`insufficient user quota`），请前往优特智能控制台充值 |
| 任务 `FAILURE` | 上游生成失败，见 `fail_reason`；优特智能会自动退款 |
