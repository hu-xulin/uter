# Video

## Tạo tác vụ tạo video

Gửi tác vụ tạo video, hỗ trợ tạo video từ văn bản và từ hình ảnh.

Trả về ID tác vụ, có thể truy vấn trạng thái tác vụ qua giao diện GET.

`POST` `/v1/video/generations`

### Thân yêu cầu (`application/json`)

| Trường | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `model` | string | Không | ID mô hình/phong cách |
| `prompt` | string | Không | Prompt mô tả văn bản |
| `image` | string | Không | Đầu vào hình ảnh (URL hoặc Base64) |
| `duration` | number | Không | Thời lượng video (giây) |
| `width` | integer | Không | Chiều rộng video |
| `height` | integer | Không | Chiều cao video |
| `fps` | integer | Không | Tốc độ khung hình video |
| `seed` | integer | Không | Hạt ngẫu nhiên |
| `n` | integer | Không | Số lượng video tạo ra |
| `response_format` | string | Không | Định dạng phản hồi |
| `user` | string | Không | Định danh người dùng |
| `metadata` | object | Không | Tham số mở rộng (ví dụ negative_prompt, style, quality_level, v.v.) |

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Tạo tác vụ tạo video thành công |
| `400` | Tham số yêu cầu lỗi |

#### Trường phản hồi `200`

| Trường | Kiểu | Mô tả |
|---|---|---|
| `task_id` | string | ID tác vụ |
| `status` | string | Trạng thái tác vụ |

#### Trường phản hồi `400`

| Trường | Kiểu | Mô tả |
|---|---|---|
| `error.message` | string | Thông báo lỗi |
| `error.type` | string | Loại lỗi |
| `error.param` | string | Tham số liên quan |
| `error.code` | string | Mã lỗi |

## Lấy trạng thái tác vụ tạo video

Truy vấn trạng thái và kết quả của tác vụ tạo video.

Trạng thái tác vụ:
- `queued`: Đang chờ xếp hàng
- `in_progress`: Đang tạo
- `completed`: Đã hoàn thành
- `failed`: Thất bại

`GET` `/v1/video/generations/{task_id}`

### Tham số yêu cầu

| Tên tham số | Vị trí | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|---|
| `task_id` | path | string | Có | ID tác vụ |

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Lấy trạng thái tác vụ thành công |
| `404` | Tác vụ không tồn tại |

#### Trường phản hồi `200`

| Trường | Kiểu | Mô tả |
|---|---|---|
| `task_id` | string | ID tác vụ |
| `status` | enum (`queued`, `in_progress`, `completed`, `failed`) | Trạng thái tác vụ |
| `url` | string | URL tài nguyên video (khi thành công) |
| `format` | string | Định dạng video |
| `metadata.duration` | number | Thời lượng video thực tế được tạo |
| `metadata.fps` | integer | Tốc độ khung hình thực tế |
| `metadata.width` | integer | Chiều rộng thực tế |
| `metadata.height` | integer | Chiều cao thực tế |
| `metadata.seed` | integer | Hạt ngẫu nhiên đã sử dụng |
| `error.code` | integer | Mã lỗi |
| `error.message` | string | Thông báo lỗi |

#### Trường phản hồi `404`

| Trường | Kiểu | Mô tả |
|---|---|---|
| `error.message` | string | Thông báo lỗi |
| `error.type` | string | Loại lỗi |
| `error.param` | string | Tham số liên quan |
| `error.code` | string | Mã lỗi |
