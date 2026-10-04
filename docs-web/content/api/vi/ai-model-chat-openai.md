# OpenAI

## Định dạng ChatCompletions

Tạo phản hồi mô hình dựa trên lịch sử hội thoại. Hỗ trợ phản hồi streaming và không streaming.

Tương thích với API OpenAI Chat Completions.

`POST` `/v1/chat/completions`

### Thân yêu cầu (`application/json`)

| Trường | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `model` | string | Có | ID mô hình |
| `messages` | array&lt;object&gt; | Có | Danh sách tin nhắn hội thoại |
| `temperature` | number | Không | Nhiệt độ lấy mẫu |
| `top_p` | number | Không | Tham số lấy mẫu hạt nhân |
| `n` | integer | Không | Số lượng tạo |
| `stream` | boolean | Không | Có phản hồi streaming hay không |
| `stream_options.include_usage` | boolean | Không | — |
| `max_tokens` | integer | Không | Số Token tạo tối đa |
| `max_completion_tokens` | integer | Không | Số Token hoàn thành tối đa |
| `presence_penalty` | number | Không | — |
| `frequency_penalty` | number | Không | — |
| `logit_bias` | object | Không | — |
| `user` | string | Không | — |
| `tools` | array&lt;object&gt; | Không | — |
| `response_format.type` | enum (`text`, `json_object`, `json_schema`) | Không | — |
| `response_format.json_schema` | object | Không | Định nghĩa JSON Schema |
| `seed` | integer | Không | — |
| `reasoning_effort` | enum (`low`, `medium`, `high`) | Không | Cường độ suy luận (dành cho các mô hình hỗ trợ suy luận) |
| `modalities` | array&lt;enum (`text`, `audio`)&gt; | Không | — |
| `audio.voice` | string | Không | — |
| `audio.format` | string | Không | — |

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Tạo phản hồi thành công |
| `400` | Tham số yêu cầu lỗi |
| `429` | Giới hạn tần suất yêu cầu |

#### Trường phản hồi `200`

| Trường | Kiểu | Mô tả |
|---|---|---|
| `id` | string | — |
| `object` | string | — |
| `created` | integer | — |
| `model` | string | — |
| `choices` | array&lt;object&gt; | — |
| `usage.prompt_tokens` | integer | Số Token prompt |
| `usage.completion_tokens` | integer | Số Token hoàn thành |
| `usage.total_tokens` | integer | Tổng số Token |
| `usage.prompt_tokens_details.cached_tokens` | integer | — |
| `usage.prompt_tokens_details.text_tokens` | integer | — |
| `usage.prompt_tokens_details.audio_tokens` | integer | — |
| `usage.prompt_tokens_details.image_tokens` | integer | — |
| `usage.completion_tokens_details.text_tokens` | integer | — |
| `usage.completion_tokens_details.audio_tokens` | integer | — |
| `usage.completion_tokens_details.reasoning_tokens` | integer | — |
| `system_fingerprint` | string | — |

#### Trường phản hồi `400`

| Trường | Kiểu | Mô tả |
|---|---|---|
| `error.message` | string | Thông báo lỗi |
| `error.type` | string | Loại lỗi |
| `error.param` | string | Tham số liên quan |
| `error.code` | string | Mã lỗi |

#### Trường phản hồi `429`

| Trường | Kiểu | Mô tả |
|---|---|---|
| `error.message` | string | Thông báo lỗi |
| `error.type` | string | Loại lỗi |
| `error.param` | string | Tham số liên quan |
| `error.code` | string | Mã lỗi |

## Định dạng Responses

API OpenAI Responses, dùng để tạo phản hồi mô hình.
Hỗ trợ hội thoại đa lượt, gọi công cụ, suy luận và các chức năng khác.

`POST` `/v1/responses`

### Thân yêu cầu (`application/json`)

| Trường | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `model` | string | Có | — |
| `instructions` | string | Không | — |
| `max_output_tokens` | integer | Không | — |
| `temperature` | number | Không | — |
| `top_p` | number | Không | — |
| `stream` | boolean | Không | — |
| `tools` | array&lt;object&gt; | Không | — |
| `reasoning.effort` | enum (`low`, `medium`, `high`) | Không | — |
| `reasoning.summary` | string | Không | — |
| `previous_response_id` | string | Không | — |
| `truncation` | enum (`auto`, `disabled`) | Không | — |

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Tạo phản hồi thành công |

#### Trường phản hồi `200`

| Trường | Kiểu | Mô tả |
|---|---|---|
| `id` | string | — |
| `object` | string | — |
| `created_at` | integer | — |
| `status` | enum (`completed`, `failed`, `in_progress`, `incomplete`) | — |
| `model` | string | — |
| `output` | array&lt;object&gt; | — |
| `usage.prompt_tokens` | integer | Số Token prompt |
| `usage.completion_tokens` | integer | Số Token hoàn thành |
| `usage.total_tokens` | integer | Tổng số Token |
| `usage.prompt_tokens_details.cached_tokens` | integer | — |
| `usage.prompt_tokens_details.text_tokens` | integer | — |
| `usage.prompt_tokens_details.audio_tokens` | integer | — |
| `usage.prompt_tokens_details.image_tokens` | integer | — |
| `usage.completion_tokens_details.text_tokens` | integer | — |
| `usage.completion_tokens_details.audio_tokens` | integer | — |
| `usage.completion_tokens_details.reasoning_tokens` | integer | — |
