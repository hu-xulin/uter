# Định dạng Seedance

Tạo video Seedance (Dreamina): gọi họ mô hình Dreamina Seedance 2.0 qua API tác vụ bất đồng bộ, hỗ trợ tạo video từ văn bản, từ hình ảnh và tiếp nối / chỉnh sửa video.

## Các mô hình được hỗ trợ

| Mô hình | Mô tả | Khả năng |
|---|---|---|
| `dreamina-seedance-2-0` | Seedance 2.0 tiêu chuẩn, ưu tiên chất lượng | Từ văn bản sang video, từ hình ảnh sang video, tiếp nối video |
| `dreamina-seedance-2-0-fast` | Seedance 2.0 nhanh, độ trễ thấp hơn | Từ văn bản sang video, từ hình ảnh sang video, tiếp nối video |

Cả hai mô hình đều hỗ trợ **video làm đầu vào** (tiếp nối / chỉnh sửa) bằng cách truyền `video_url` bên trong `metadata.content`.

## Tạo video

`POST` `/v1/video/generations`

### Header yêu cầu

| Header | Bắt buộc | Mô tả |
|---|---|---|
| `Authorization` | Có | `Bearer sk-your-api-key` |
| `Content-Type` | Có | `application/json` |

### Body yêu cầu (`application/json`)

| Trường | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `model` | string | Có | Tên mô hình Seedance, xem bảng trên |
| `prompt` | string | Có | Prompt video |
| `image` | string | Không | Ảnh tham chiếu cho chế độ từ hình ảnh sang video (URL hoặc data URI base64); loại trừ với `images` |
| `images` | string[] | Không | Tham chiếu nhiều hình ảnh (URL hoặc data URI base64) |
| `duration` | int | Không | Thời lượng tính bằng giây; thường là 5 / 10, mặc định 5 |
| `seconds` | string | Không | Dạng chuỗi của `duration` (để tương thích API OpenAI Sora). Phải là chuỗi số thuần (ví dụ `"5"`, `"10"`) không có đơn vị. Chỉ có hiệu lực khi `duration` ở cấp cao nhất là `0` hoặc bị bỏ qua |
| `metadata` | object | Không | Container tham số riêng của Seedance, xem «Tham số riêng» |

### Phản hồi

| Trạng thái | Mô tả |
|---|---|
| `200` | Tạo tác vụ video thành công |
| `400` | Tham số yêu cầu không hợp lệ |

#### Trường phản hồi `200`

| Trường | Kiểu | Mô tả |
|---|---|---|
| `id` / `task_id` | string | ID tác vụ công khai (tiền tố `task_`) dùng cho các truy vấn sau |
| `object` | string | Loại đối tượng (`video`) |
| `model` | string | Mô hình đã sử dụng |
| `status` | string | Trạng thái tác vụ (`queued` ngay sau khi gửi) |
| `progress` | integer | Phần trăm tiến độ |
| `created_at` | integer | Dấu thời gian tạo |

> `id` / `task_id` do Uter tạo ra và không phải ID tác vụ phía thượng nguồn.

## Lấy trạng thái tác vụ video

`GET` `/v1/video/generations/{task_id}`

Phản hồi là lớp bọc `{code, message, data}`; khi thành công `code` là `"success"` và `data` là object chi tiết tác vụ.

### Tham số yêu cầu

| Tên | Vị trí | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|---|
| `task_id` | path | string | Có | ID tác vụ video |

### Phản hồi

| Trạng thái | Mô tả |
|---|---|
| `200` | Lấy trạng thái tác vụ thành công |
| `404` | Không tìm thấy tác vụ |

#### Trường phản hồi `200` (`data`)

| Trường | Kiểu | Mô tả |
|---|---|---|
| `data.id` | int | ID tác vụ nội bộ tự tăng |
| `data.task_id` | string | ID tác vụ công khai (tiền tố `task_`) |
| `data.platform` | string | Mã nền tảng thượng nguồn |
| `data.user_id` | int | ID người dùng |
| `data.group` | string | Tên nhóm |
| `data.channel_id` | int | ID kênh thực sự được sử dụng |
| `data.quota` | int | Hạn mức thô bị tính phí cho tác vụ này |
| `data.action` | string | Hành động của tác vụ, thường là `generate` |
| `data.status` | string | Trạng thái tác vụ: `SUBMITTED` / `QUEUED` / `IN_PROGRESS` / `SUCCESS` / `FAILURE` |
| `data.fail_reason` | string | Lý do thất bại (chỉ khi `status = FAILURE`) |
| `data.result_url` | string | URL kết quả video (chỉ trả về khi thành công; liên kết tạm thời phía thượng nguồn) |
| `data.progress` | string | Tiến độ, ví dụ `"100%"` |
| `data.submit_time` / `start_time` / `finish_time` | int64 | Dấu thời gian Unix gửi / bắt đầu / kết thúc (giây) |
| `data.properties.upstream_model_name` | string | Tên mô hình thực tế đã gửi lên thượng nguồn |
| `data.data` | object | Phản hồi thô phía thượng nguồn (`usage`, `content.video_url`, `resolution`, `framespersecond`, …) |

#### Enum trạng thái

| Trạng thái | Mô tả |
|---|---|
| `SUBMITTED` | Đã gửi |
| `QUEUED` | Đang xếp hàng ở thượng nguồn |
| `IN_PROGRESS` | Đang tạo |
| `SUCCESS` | Hoàn tất; `result_url` chứa video |
| `FAILURE` | Thất bại; `fail_reason` giải thích lý do |

## Lấy nội dung video

`GET` `/v1/videos/{task_id}/content`

Trả về luồng video thô (`Content-Type: video/mp4`). Uter làm proxy URL thượng nguồn.

### Tham số yêu cầu

| Tên | Vị trí | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|---|
| `task_id` | path | string | Có | ID tác vụ video |

> **Khuyến nghị mạnh**: hãy tải qua proxy `/content` thay vì truy cập trực tiếp `result_url`, vì đó là liên kết tạm thời phía thượng nguồn có thời hạn giới hạn.

## Tham số riêng (`metadata`)

Mọi trường riêng của Seedance đều được truyền qua object `metadata` trong body yêu cầu và chuyển tiếp lên thượng nguồn.

### Độ phân giải / tỷ lệ khung hình / thời lượng

| Trường | Kiểu | Mô tả |
|---|---|---|
| `resolution` | string | Bậc độ phân giải: `480p` `720p` `1080p` |
| `ratio` | string | Tỷ lệ khung hình: `16:9` `9:16` `1:1` `4:3` `3:4` `21:9` `adaptive` |
| `duration` | int | Thời lượng video tính bằng giây: `5` `10`. **Lưu ý:** `duration` (hoặc `seconds`) ở cấp cao nhất được ưu tiên hơn `metadata.duration` |
| `frames` | int | Số khung hình (tùy chọn, loại trừ với `duration`), ví dụ `121` |
| `seed` | int | Hạt giống ngẫu nhiên, `0` – `2^31-1` |

### Điều khiển camera và nội dung

| Trường | Kiểu | Mô tả |
|---|---|---|
| `camera_fixed` | bool | Cố định camera (`true` = tĩnh) |
| `watermark` | bool | Có thêm watermark chính thức hay không |

### Tham số nâng cao

| Trường | Kiểu | Mô tả |
|---|---|---|
| `service_tier` | string | Bậc dịch vụ ảnh hưởng đến tốc độ và hạn mức (ví dụ `auto` / `default` / `priority`) |
| `execution_expires_after` | int | Thời gian chờ thực thi tác vụ tính bằng giây |
| `generate_audio` | bool | Có tạo âm thanh hay không |
| `draft` | bool | Chế độ nháp (nhanh hơn và rẻ hơn, chất lượng thấp hơn một chút) |
| `return_last_frame` | bool | Có trả về ảnh khung hình cuối trong phản hồi hay không |
| `callback_url` | string | URL callback được thông báo khi tác vụ hoàn tất |

### Đầu vào đa phương thức (mảng `content`)

Ngoài các trường `image` / `images` ở cấp cao nhất, bạn có thể truyền một mảng đầu vào đa phương thức trong `metadata.content`, kết hợp **hình ảnh** và **video**:

| `type` | Mục đích |
|---|---|
| `image_url` + `image_url.url` | Tham chiếu hình ảnh (từ hình ảnh sang video) |
| `video_url` + `video_url.url` | Đầu vào video (tiếp nối / chỉnh sửa) |

```json
{
  "model": "dreamina-seedance-2-0",
  "prompt": "Extend this video so the cat walks out of frame",
  "metadata": {
    "content": [
      { "type": "video_url", "video_url": { "url": "https://example.com/cat.mp4" } }
    ],
    "resolution": "720p"
  }
}
```

## Ví dụ đầy đủ

```bash
# Text-to-video
curl -X POST https://uter.ai/v1/video/generations \
  -H "Authorization: Bearer sk-your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "dreamina-seedance-2-0",
    "prompt": "A cat strolling on the lunar surface under a starry sky",
    "duration": 5,
    "metadata": { "resolution": "720p", "ratio": "16:9", "seed": 42 }
  }'

# Poll the task
curl https://uter.ai/v1/video/generations/task_xxx \
  -H "Authorization: Bearer sk-your-api-key"

# Download the video
curl https://uter.ai/v1/videos/task_xxx/content \
  -H "Authorization: Bearer sk-your-api-key" \
  -o cat_on_moon.mp4
```

## Mã trạng thái và lỗi

| Trường hợp | Mô tả |
|---|---|
| `400` | Không tìm thấy mô hình hoặc không được phép (`model not allowed`), `prompt` rỗng (`prompt is required`), độ phân giải / thời lượng không hợp lệ |
| `401` / `403` | API key không hợp lệ / không được phép truy cập mô hình này (kiểm tra danh sách mô hình được phép của token) |
| `402` | Số dư không đủ (`insufficient user quota`) |
| Tác vụ `FAILURE` | Thất bại phía thượng nguồn (kiểm duyệt / URL ảnh hoặc video không truy cập được / hết thời gian chờ thượng nguồn); Uter tự động hoàn lại khoản phí |

Cách xử lý đề xuất: điều chỉnh prompt khi bị kiểm duyệt từ chối; chuyển sang base64 khi URL không truy cập được; thử lại sau hoặc chuyển sang `dreamina-seedance-2-0-fast` khi thượng nguồn hết thời gian chờ.
