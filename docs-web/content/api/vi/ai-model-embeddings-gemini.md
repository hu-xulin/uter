# Định dạng Native Gemini

Tạo embedding bằng engine/mô hình được chỉ định.

`POST` `/v1/engines/{model}/embeddings`

### Tham số yêu cầu

| Tên tham số | Vị trí | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|---|
| `model` | path | string | Có | ID mô hình/engine |

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
