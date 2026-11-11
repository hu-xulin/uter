# Kling

## Chuyển ảnh sang video Kling (Kling Image to Video)

Sử dụng mô hình Kling để tạo video từ hình ảnh.

Hỗ trợ truyền URL hình ảnh hoặc dữ liệu ảnh mã hóa Base64 qua tham số image.

`POST` `/kling/v1/videos/image2video`

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

## Kling Tạo video từ văn bản (Kling Text-to-Video)

Sử dụng mô hình Kling để tạo video từ mô tả văn bản.

Các mô hình hỗ trợ: kling-v1, kling-v1-5, v.v.

`POST` `/kling/v1/videos/text2video`

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

## Lấy trạng thái tác vụ Kling Image-to-Video

Truy vấn trạng thái và kết quả của tác vụ Kling tạo video từ ảnh.

`GET` `/kling/v1/videos/image2video/{task_id}`

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

## Lấy trạng thái tác vụ Kling Text-to-Video

Truy vấn trạng thái và kết quả của tác vụ Kling tạo video từ văn bản.

`GET` `/kling/v1/videos/text2video/{task_id}`

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
