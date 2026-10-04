# Sora

## Tạo video (Create Video)

Giao diện tạo video tương thích OpenAI.

Tài liệu tham khảo: https://platform.openai.com/docs/api-reference/videos/create

`POST` `/v1/videos`

### Thân yêu cầu (`multipart/form-data`)

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
| `200` | Tạo tác vụ video thành công |
| `400` | Tham số yêu cầu lỗi |

#### Trường phản hồi `200`

| Trường | Kiểu | Mô tả |
|---|---|---|
| `id` | string | ID video |
| `object` | string | Loại đối tượng |
| `model` | string | Mô hình được sử dụng |
| `status` | string | Trạng thái tác vụ |
| `progress` | integer | Phần trăm tiến độ |
| `created_at` | integer | Dấu thời gian tạo |
| `seconds` | string | Thời lượng video |
| `completed_at` | integer | Dấu thời gian hoàn thành |
| `expires_at` | integer | Dấu thời gian hết hạn |
| `size` | string | Kích thước video |
| `error.message` | string | Thông báo lỗi |
| `error.code` | string | Mã lỗi |
| `metadata` | object | Siêu dữ liệu bổ sung |

#### Trường phản hồi `400`

| Trường | Kiểu | Mô tả |
|---|---|---|
| `error.message` | string | Thông báo lỗi |
| `error.type` | string | Loại lỗi |
| `error.param` | string | Tham số liên quan |
| `error.code` | string | Mã lỗi |

## Lấy trạng thái tác vụ video (Get Video Task Status)

Giao diện truy vấn trạng thái tác vụ video tương thích OpenAI.

Trả về thông tin trạng thái chi tiết của tác vụ video.

`GET` `/v1/videos/{task_id}`

### Tham số yêu cầu

| Tên tham số | Vị trí | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|---|
| `task_id` | path | string | Có | ID tác vụ video |

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Lấy trạng thái tác vụ video thành công |
| `404` | Tác vụ không tồn tại |

#### Trường phản hồi `200`

| Trường | Kiểu | Mô tả |
|---|---|---|
| `id` | string | — |
| `object` | string | — |
| `model` | string | — |
| `status` | string | — |
| `progress` | integer | — |
| `created_at` | integer | — |
| `seconds` | string | — |

#### Trường phản hồi `404`

| Trường | Kiểu | Mô tả |
|---|---|---|
| `error.message` | string | Thông báo lỗi |
| `error.type` | string | Loại lỗi |
| `error.param` | string | Tham số liên quan |
| `error.code` | string | Mã lỗi |

## Lấy nội dung video (Get Video Content)

Lấy nội dung tệp video của tác vụ video đã hoàn thành.

Giao diện này sẽ proxy trả về luồng tệp video.

`GET` `/v1/videos/{task_id}/content`

### Tham số yêu cầu

| Tên tham số | Vị trí | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|---|
| `task_id` | path | string | Có | ID tác vụ video |

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Lấy nội dung video thành công |
| `404` | Video không tồn tại hoặc chưa hoàn thành |

#### Trường phản hồi `404`

| Trường | Kiểu | Mô tả |
|---|---|---|
| `error.message` | string | Thông báo lỗi |
| `error.type` | string | Loại lỗi |
| `error.param` | string | Tham số liên quan |
| `error.code` | string | Mã lỗi |
