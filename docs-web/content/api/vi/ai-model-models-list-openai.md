# Định dạng Native OpenAI

Lấy danh sách mô hình hiện có sẵn.

Tự động nhận diện định dạng trả về dựa trên header yêu cầu:
- Trả về định dạng Anthropic khi chứa header `x-api-key` và `anthropic-version`
- Trả về định dạng Gemini khi chứa header `x-goog-api-key` hoặc tham số query `key`
- Các trường hợp khác trả về định dạng OpenAI

`GET` `/v1/models`

### Tham số yêu cầu

| Tên tham số | Vị trí | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|---|
| `key` | query | string | Không | Google API Key (dùng cho định dạng Gemini) |
| `x-api-key` | header | string | Không | Anthropic API Key (dùng cho định dạng Claude) |
| `anthropic-version` | header | string | Không | Phiên bản Anthropic API |
| `x-goog-api-key` | header | string | Không | Google API Key (dùng cho định dạng Gemini) |

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Lấy danh sách mô hình thành công |
| `401` | Xác thực thất bại |

#### Trường phản hồi `200`

| Trường | Kiểu | Mô tả |
|---|---|---|
| `object` | string | — |
| `data` | array&lt;object&gt; | — |

#### Trường phản hồi `401`

| Trường | Kiểu | Mô tả |
|---|---|---|
| `error.message` | string | Thông báo lỗi |
| `error.type` | string | Loại lỗi |
| `error.param` | string | Tham số liên quan |
| `error.code` | string | Mã lỗi |
