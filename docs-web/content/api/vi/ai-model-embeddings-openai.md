# Định dạng Native OpenAI

Chuyển đổi văn bản thành vector nhúng (embedding).

`POST` `/v1/embeddings`

### Thân yêu cầu (`application/json`)

| Trường | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `model` | string | Có | — |
| `encoding_format` | enum (`float`, `base64`) | Không | — |
| `dimensions` | integer | Không | Số chiều vector đầu ra |

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Tạo embedding thành công |

#### Trường phản hồi `200`

| Trường | Kiểu | Mô tả |
|---|---|---|
| `object` | string | — |
| `data` | array&lt;object&gt; | — |
| `model` | string | — |
| `usage.prompt_tokens` | integer | — |
| `usage.total_tokens` | integer | — |
