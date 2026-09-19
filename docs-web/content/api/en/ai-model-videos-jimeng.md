# Jimeng Video Generation

## Jimeng Video Generation

即梦官方 API 格式的视频生成接口。

支持通过 Action 参数指定操作类型：
- `CVSync2AsyncSubmitTask`: 提交视频生成任务
- `CVSync2AsyncGetResult`: 获取任务结果

需要在查询参数中指定 Action 和 Version。

`POST` `/jimeng/`

### 请求参数

| 参数名 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `Action` | query | enum（`CVSync2AsyncSubmitTask`, `CVSync2AsyncGetResult`） | 是 | API 操作类型 |
| `Version` | query | string | 是 | API 版本 |

### 请求体（`application/json`）

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `req_key` | string | 否 | 请求类型标识 |
| `prompt` | string | 否 | 文本描述 |
| `binary_data_base64` | array&lt;string&gt; | 否 | Base64 编码的图片数据 |

### 响应

| 状态码 | 说明 |
|---|---|
| `200` | 成功处理请求 |
| `400` | 请求参数错误 |

#### `200` 响应字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `code` | integer | 响应码 |
| `message` | string | 响应消息 |
| `data` | object | 响应数据 |

#### `400` 响应字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `error.message` | string | 错误信息 |
| `error.type` | string | 错误类型 |
| `error.param` | string | 相关参数 |
| `error.code` | string | 错误代码 |
