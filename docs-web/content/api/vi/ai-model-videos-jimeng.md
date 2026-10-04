# Tạo video Jimeng

## Tạo video Jimeng

Giao diện tạo video định dạng API chính thức của Jimeng.

Hỗ trợ chỉ định loại thao tác qua tham số Action:
- `CVSync2AsyncSubmitTask`: Gửi tác vụ tạo video
- `CVSync2AsyncGetResult`: Lấy kết quả tác vụ

Cần chỉ định Action và Version trong tham số query.

`POST` `/jimeng/`

### Tham số yêu cầu

| Tên tham số | Vị trí | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|---|
| `Action` | query | enum (`CVSync2AsyncSubmitTask`, `CVSync2AsyncGetResult`) | Có | Loại thao tác API |
| `Version` | query | string | Có | Phiên bản API |

### Thân yêu cầu (`application/json`)

| Trường | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `req_key` | string | Không | Định danh loại yêu cầu |
| `prompt` | string | Không | Mô tả văn bản |
| `binary_data_base64` | array&lt;string&gt; | Không | Dữ liệu ảnh mã hóa Base64 |

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Xử lý yêu cầu thành công |
| `400` | Tham số yêu cầu lỗi |

#### Trường phản hồi `200`

| Trường | Kiểu | Mô tả |
|---|---|---|
| `code` | integer | Mã phản hồi |
| `message` | string | Thông báo phản hồi |
| `data` | object | Dữ liệu phản hồi |

#### Trường phản hồi `400`

| Trường | Kiểu | Mô tả |
|---|---|---|
| `error.message` | string | Thông báo lỗi |
| `error.type` | string | Loại lỗi |
| `error.param` | string | Tham số liên quan |
| `error.code` | string | Mã lỗi |
