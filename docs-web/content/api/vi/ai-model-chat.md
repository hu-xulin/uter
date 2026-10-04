# Định dạng Native của Claude

## Định dạng Native của Claude

Yêu cầu ở định dạng Anthropic Claude Messages API.
Cần bao gồm `anthropic-version` trong header của yêu cầu.

`POST` `/v1/messages`

### Tham số yêu cầu

| Tên tham số | Vị trí | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|---|
| `anthropic-version` | header | string | Có | Phiên bản Anthropic API |
| `x-api-key` | header | string | Không | Anthropic API Key (tùy chọn, cũng có thể sử dụng Bearer Token) |

### Thân yêu cầu (`application/json`)

| Trường | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `model` | string | Có | — |
| `messages` | array&lt;object&gt; | Có | — |
| `max_tokens` | integer | Có | — |
| `temperature` | number | Không | — |
| `top_p` | number | Không | — |
| `top_k` | integer | Không | — |
| `stream` | boolean | Không | — |
| `stop_sequences` | array&lt;string&gt; | Không | — |
| `tools` | array&lt;object&gt; | Không | — |
| `tool_choice.type` | enum (`auto`, `any`, `tool`) | Không | — |
| `tool_choice.name` | string | Không | — |
| `thinking.type` | enum (`enabled`, `disabled`) | Không | — |
| `thinking.budget_tokens` | integer | Không | — |
| `metadata.user_id` | string | Không | — |

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Tạo phản hồi thành công |

#### Trường phản hồi `200`

| Trường | Kiểu | Mô tả |
|---|---|---|
| `id` | string | — |
| `type` | string | — |
| `role` | string | — |
| `content` | array&lt;object&gt; | — |
| `model` | string | — |
| `stop_reason` | enum (`end_turn`, `max_tokens`, `stop_sequence`, `tool_use`) | — |
| `usage.input_tokens` | integer | — |
| `usage.output_tokens` | integer | — |
| `usage.cache_creation_input_tokens` | integer | — |
| `usage.cache_read_input_tokens` | integer | — |
