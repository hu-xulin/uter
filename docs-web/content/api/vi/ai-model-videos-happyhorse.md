# Định dạng HappyHorse

Tạo video HappyHorse: gọi toàn bộ họ mô hình HappyHorse 1.0 qua API tác vụ bất đồng bộ, hỗ trợ tạo video từ văn bản, từ hình ảnh, từ hình tham chiếu và chỉnh sửa video.

## Các mô hình được hỗ trợ

Cả bốn mô hình dùng chung một endpoint `/v1/video/generations` và chỉ phân biệt qua trường `model`; cấu trúc phản hồi là như nhau.

| Mô hình | Khả năng | Đầu vào media bắt buộc | Mô tả |
|---|---|---|---|
| `happyhorse-1.0-t2v` | Từ văn bản sang video | — | Tạo video chỉ từ mô tả văn bản |
| `happyhorse-1.0-i2v` | Từ hình ảnh sang video | 1 ảnh khung hình đầu | Hoạt ảnh từ ảnh khung hình đầu theo prompt |
| `happyhorse-1.0-r2v` | Từ hình tham chiếu sang video | 1–9 ảnh tham chiếu | Tham chiếu nhiều hình ảnh; tham chiếu ảnh bằng `[Image N]` trong prompt |
| `happyhorse-1.0-video-edit` | Chỉnh sửa video | 1 video + 0–5 ảnh tham chiếu | Chuyển style, thay thế cục bộ và các chỉnh sửa khác trên video |

## Tạo video

Gửi một tác vụ tạo video và nhận về ID tác vụ; thăm dò endpoint trạng thái để lấy kết quả.

`POST` `/v1/video/generations`

### Header yêu cầu

| Header | Bắt buộc | Mô tả |
|---|---|---|
| `Authorization` | Có | `Bearer sk-your-api-key` |
| `Content-Type` | Có | `application/json` |

### Body yêu cầu (`application/json`)

| Trường | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `model` | string | Có | Tên mô hình HappyHorse, xem bảng trên |
| `prompt` | string | Có | Prompt văn bản, tối đa 5000 ký tự phi Trung Quốc hoặc 2500 ký tự Trung Quốc; đầu vào dài hơn sẽ bị cắt bớt |
| `size` | string | Không | Bậc độ phân giải: `720P` / `1080P`; mặc định `1080P` |
| `duration` | int | Không | Thời lượng video tính bằng giây, `3`–`15`, mặc định `5`; bị bỏ qua với `video-edit` (theo video đầu vào, tối đa 15 giây) |
| `input_reference` | string | Không | Chỉ dùng cho i2v: URL công khai của ảnh khung hình đầu |
| `metadata` | object | Không | Container tham số riêng của HappyHorse, xem bên dưới |

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

> `id` / `task_id` do Uter tạo ra và không phải task_id DashScope phía thượng nguồn. Luôn sử dụng giá trị được trả về tại đây.

## Lấy trạng thái tác vụ video

`GET` `/v1/video/generations/{task_id}`

Phản hồi sử dụng lớp bọc `{code, message, data}` thống nhất của Uter.

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
| `data.task_id` | string | ID tác vụ công khai |
| `data.status` | string | Trạng thái tác vụ: `NOT_START` / `QUEUED` / `IN_PROGRESS` / `SUCCESS` / `FAILURE` |
| `data.result_url` | string | URL kết quả video (chỉ có giá trị khi `SUCCESS`; liên kết chữ ký OSS phía thượng nguồn, thường hợp lệ 24 giờ) |
| `data.fail_reason` | string | Lý do thất bại (chỉ có giá trị khi `FAILURE`) |
| `data.quota` | int | Hạn mức thô bị tính phí cho tác vụ này |
| `data.progress` | string | Chuỗi tiến độ, ví dụ `"30%"` / `"100%"` |
| `data.submit_time` / `start_time` / `finish_time` | int64 | Dấu thời gian Unix gửi / bắt đầu / kết thúc (giây) |
| `data.properties.upstream_model_name` | string | Tên mô hình thực tế đã gửi lên thượng nguồn |
| `data.data` | object | Phản hồi DashScope thô phía thượng nguồn (`output.video_url`, `usage`, `request_id`) |

#### Enum trạng thái

| Trạng thái | Trạng thái thượng nguồn | Mô tả |
|---|---|---|
| `NOT_START` | `PENDING` | Đã tạo, chưa xử lý |
| `QUEUED` | `PENDING` | Đang xếp hàng ở thượng nguồn |
| `IN_PROGRESS` | `RUNNING` | Đang tạo |
| `SUCCESS` | `SUCCEEDED` | Hoàn tất; `result_url` chứa video |
| `FAILURE` | `FAILED` / `CANCELED` / `UNKNOWN` | Thất bại; `fail_reason` giải thích lý do |

## Tham số riêng (`metadata`)

Truyền các mục sau qua object `metadata` trong body yêu cầu; Uter chuyển tiếp chúng tới DashScope phía thượng nguồn.

### Tham số điều khiển video

| Trường | Kiểu | Áp dụng cho | Mô tả | Mặc định |
|---|---|---|---|---|
| `ratio` | string | t2v / r2v | Tỷ lệ khung hình: `16:9` / `9:16` / `1:1` / `4:3` / `3:4` | `16:9` |
| `watermark` | bool | Tất cả | Có thêm watermark hay không (chữ «Happy Horse» ở góc dưới bên phải) | `true` |
| `seed` | int | Tất cả | Hạt giống ngẫu nhiên, `0`–`2147483647`; tự động sinh nếu bị bỏ qua | — |
| `audio_setting` | string | video-edit | Điều khiển âm thanh: `auto` (do mô hình kiểm soát) / `origin` (giữ nguyên âm thanh gốc) | `auto` |

> i2v không hỗ trợ `ratio`; tỷ lệ khung hình theo ảnh khung hình đầu đầu vào.

### Đầu vào đa phương tiện (`metadata.input.media`)

r2v và video-edit truyền media qua mảng `metadata.input.media`:

| `type` | Vai trò | Giới hạn số lượng |
|---|---|---|
| `reference_image` | Ảnh tham chiếu (r2v và video-edit hỗ trợ) | r2v: 1–9; video-edit: 0–5 |
| `video` | Video cần chỉnh sửa (chỉ video-edit) | Chính xác 1 |
| `first_frame` | Ảnh khung hình đầu (chỉ i2v; cũng có thể dùng `input_reference` ở cấp cao nhất) | Chính xác 1 |

Với r2v, tham chiếu ảnh theo thứ tự trong mảng bằng `[Image 1]`, `[Image 2]` trong prompt.

### Ràng buộc media

| Loại | Định dạng | Độ phân giải | Dung lượng | Ràng buộc khác |
|---|---|---|---|---|
| Ảnh (khung hình đầu i2v) | JPEG / JPG / PNG / WEBP | Chiều rộng và chiều cao ≥ 300 px | ≤ 10 MB | Tỷ lệ khung hình 1:2,5 – 2,5:1 |
| Ảnh (tham chiếu r2v) | JPEG / JPG / PNG / WEBP | Cạnh ngắn ≥ 400 px | ≤ 10 MB | Nên dùng ảnh sắc nét |
| Ảnh (tham chiếu video-edit) | JPEG / JPG / PNG / WEBP | Chiều rộng và chiều cao ≥ 300 px | ≤ 10 MB | Tỷ lệ khung hình 1:2,5 – 2,5:1 |
| Video (đầu vào video-edit) | MP4 / MOV (H.264) | Cạnh dài ≤ 2160, cạnh ngắn ≥ 320 | ≤ 100 MB | 3–60 giây, >8 fps, tỷ lệ 1:2,5 – 2,5:1 |

> Độ dài đầu ra video-edit: đầu vào ≤ 15 giây cho độ dài tương ứng; đầu vào > 15 giây bị cắt còn 15 giây đầu.

## Endpoint tương thích OpenAI

Ngoài `/v1/video/generations`, còn có endpoint `/v1/videos` theo phong cách OpenAI; hai endpoint hoàn toàn tương đương (cùng một tác vụ backend).

- Gửi: `POST` `/v1/videos` (các trường body giống hệt)
- Truy vấn: `GET` `/v1/videos/{task_id}` (trả về định dạng phẳng của OpenAI)

| Trạng thái OpenAI | Trạng thái thống nhất |
|---|---|
| `queued` | `NOT_START` / `QUEUED` |
| `in_progress` | `IN_PROGRESS` |
| `completed` | `SUCCESS` |
| `failed` | `FAILURE` |

## Ví dụ đầy đủ

```bash
# Step 1: submit the task
curl -X POST https://uter.ai/v1/video/generations \
  -H "Authorization: Bearer sk-your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "happyhorse-1.0-t2v",
    "prompt": "A cat dozing in the sunlight, fur gently swaying in the breeze",
    "size": "720P",
    "duration": 5,
    "metadata": { "ratio": "16:9", "seed": 42, "watermark": false }
  }'

# Step 2: poll (every 10~15 seconds)
curl https://uter.ai/v1/video/generations/task_xxx \
  -H "Authorization: Bearer sk-your-api-key"

# Step 3: once data.status == "SUCCESS", download from data.result_url
```

## Mã trạng thái và lỗi

| Trường hợp | Mô tả |
|---|---|
| `400` | Lỗi tham số (thiếu `prompt`, mô hình không xác định, …); bị từ chối trước khi gửi, không tính phí |
| `401` / `403` | API key không hợp lệ / không được phép truy cập mô hình này (kiểm tra danh sách mô hình được phép của token) |
| `402` | Số dư không đủ (`insufficient user quota`); nạp thêm trong bảng điều khiển Uter |
| Tác vụ `FAILURE` | Tạo video phía thượng nguồn thất bại, xem `data.fail_reason`; Uter tự động hoàn tiền và khoản hoàn hiện trong nhật ký |

Các nguyên nhân thường gặp của `FAILURE`: bị kiểm duyệt nội dung từ chối (điều chỉnh prompt), thiếu `input_reference` cho i2v, không có ảnh tham chiếu cho r2v, thiếu video cho video-edit, URL media không truy cập được, hoặc media vi phạm các ràng buộc nêu trên.
