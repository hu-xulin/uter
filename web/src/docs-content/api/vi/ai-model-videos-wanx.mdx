# Định dạng Wanx

Tạo video Wan 2.7: gọi toàn bộ họ mô hình Wan 2.7 qua API tác vụ bất đồng bộ, hỗ trợ tạo video từ văn bản, từ hình ảnh, từ hình tham chiếu và chỉnh sửa video, với đầu ra 1080P, video dài tối đa 15 giây, tự sự nhiều cảnh và đồng bộ âm thanh gốc.

## Các mô hình được hỗ trợ

Cả bốn mô hình dùng chung một endpoint `/v1/video/generations` và chỉ phân biệt qua trường `model`; cấu trúc phản hồi là như nhau.

| Mô hình | Khả năng | Đầu vào media bắt buộc | Mô tả |
|---|---|---|---|
| `wan2.7-t2v` | Từ văn bản sang video | — | Tạo video từ văn bản; hỗ trợ tự sự nhiều cảnh và đồng bộ âm thanh |
| `wan2.7-i2v` | Từ hình ảnh sang video | 1 ảnh khung hình đầu | Hoạt ảnh từ ảnh khung hình đầu theo prompt |
| `wan2.7-r2v` | Từ hình tham chiếu sang video | 1–9 ảnh tham chiếu | Tham chiếu nhiều hình ảnh, giữ tính nhất quán của chủ thể; tham chiếu ảnh bằng `[Image N]` |
| `wan2.7-videoedit` | Chỉnh sửa video | 1 video + 0–3 ảnh tham chiếu | Chuyển style, thay thế phần tử và chỉnh sửa cục bộ bằng chỉ dẫn văn bản |

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
| `model` | string | Có | Tên mô hình Wan 2.7, xem bảng trên |
| `prompt` | string | Có | Prompt văn bản, tối đa 5000 ký tự, hỗ trợ tiếng Trung và tiếng Anh |
| `resolution` | string | Không | Bậc độ phân giải: `720P` / `1080P`, mặc định `720P`. **Khuyến nghị**; khớp với tên trường chính thức của Alibaba Cloud |
| `size` | string | Không | Tên trường cũ. Khi gửi cả hai, `resolution` được ưu tiên; khi chỉ gửi `size` thì giá trị đó được dùng làm độ phân giải. Tích hợp mới nên dùng `resolution` |
| `duration` | int | Không | Thời lượng tính bằng giây: `2`–`15` cho t2v/i2v, mặc định `5`; `2`–`10` cho r2v có video tham chiếu; bị bỏ qua với `videoedit` (theo video đầu vào, tối đa 15 giây) |
| `input_reference` | string | Không | Chỉ dùng cho i2v: URL công khai của ảnh khung hình đầu |
| `images` | array | Không | Chỉ dùng cho videoedit: mảng URL media; phần tử thứ nhất là video cần chỉnh sửa (MP4/MOV), các phần tử còn lại là ảnh tham chiếu tùy chọn (tối đa 3 ảnh) |
| `metadata` | object | Không | Container tham số riêng của Wan 2.7, xem bên dưới |

> Trường `images` đang trong giai đoạn chuyển tiếp: trước khi phát hành, hãy truyền media qua mảng `metadata.input.media`; sau khi phát hành, hệ thống suy luận loại media từ phần mở rộng URL và có thể dùng `images` trực tiếp.

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
| `data.result_url` | string | URL kết quả video (chỉ có giá trị khi `SUCCESS`; liên kết chữ ký OSS thượng nguồn hợp lệ 24 giờ) |
| `data.fail_reason` | string | Lý do thất bại (chỉ có giá trị khi `FAILURE`) |
| `data.quota` | int | Hạn mức thô bị tính phí cho tác vụ này |
| `data.progress` | string | Chuỗi tiến độ, ví dụ `"40%"` / `"100%"` |
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

### Tham số điều khiển chung

| Trường | Kiểu | Áp dụng cho | Mô tả | Mặc định |
|---|---|---|---|---|
| `ratio` | string | t2v / r2v | Tỷ lệ khung hình: `16:9` / `9:16` / `1:1` / `4:3` / `3:4` | `16:9` |
| `seed` | int | Tất cả | Hạt giống ngẫu nhiên, `0`–`2147483647`; tự động sinh nếu bị bỏ qua | — |
| `negative_prompt` | string | Tất cả | Prompt tiêu cực, tối đa 500 ký tự | — |

> i2v không hỗ trợ `ratio`; tỷ lệ khung hình theo ảnh khung hình đầu đầu vào.

### Đầu vào đa phương tiện (`metadata.input.media`)

Với r2v và videoedit, hãy truyền media qua mảng `metadata.input.media`:

| `type` | Mục đích | Giới hạn số lượng |
|---|---|---|
| `reference_image` | Ảnh tham chiếu | r2v: 1–9; videoedit: 0–3 |
| `video` | Video cần chỉnh sửa (chỉ videoedit) | Chính xác 1 |
| `first_frame` | Ảnh khung hình đầu (chỉ i2v; cũng có thể dùng `input_reference` ở cấp cao nhất) | Chính xác 1 |

Với r2v, tham chiếu ảnh theo thứ tự trong mảng bằng `[Image 1]`, `[Image 2]` trong prompt.

### Ràng buộc media

| Loại | Định dạng | Độ phân giải | Dung lượng | Ràng buộc khác |
|---|---|---|---|---|
| Ảnh (khung hình đầu i2v) | JPEG / JPG / PNG / WEBP | 240–8000 px | ≤ 10 MB | Tỷ lệ khung hình 1:8 – 8:1 |
| Ảnh (tham chiếu r2v) | JPEG / JPG / PNG / WEBP | Cạnh ngắn ≥ 300 px | ≤ 10 MB | Nên dùng ảnh sắc nét |
| Ảnh (tham chiếu videoedit) | JPEG / JPG / PNG / BMP / WEBP | 240–8000 px | ≤ 20 MB | Tỷ lệ khung hình 1:8 – 8:1 |
| Video (đầu vào videoedit) | MP4 / MOV (H.264) | 240–4096 px | ≤ 100 MB | 2–10 giây, tỷ lệ khung hình 1:8 – 8:1 |

## Endpoint tương thích OpenAI

Ngoài `/v1/video/generations`, còn có endpoint `/v1/videos` theo phong cách OpenAI; hai endpoint hoàn toàn tương đương.

- Gửi: `POST` `/v1/videos` (các trường body giống hệt)
- Truy vấn: `GET` `/v1/videos/{task_id}` (trả về định dạng phẳng của OpenAI)

| Trạng thái OpenAI | Trạng thái thống nhất |
|---|---|
| `queued` | `NOT_START` / `QUEUED` |
| `in_progress` | `IN_PROGRESS` |
| `completed` | `SUCCESS` |
| `failed` | `FAILURE` |

## Tính phí

Wan 2.7 tính phí theo **số giây × hệ số độ phân giải**:

| Độ phân giải | Đơn giá | Ví dụ 5 giây |
|---|---|---|
| `720P` | $0,10 / giây | $0,50 |
| `1080P` | $0,15 / giây | $0,75 |

```
quota = modelPrice × QuotaPerUnit × groupRatio × seconds × resolutionRatio

QuotaPerUnit    = 500,000
modelPrice      = 0.10 (all wan2.7 models)
groupRatio      = 1.0 (production default group)
resolutionRatio = 720P → 1.0, 1080P → 1.5
```

Khi `FAILURE`, Uter tự động hoàn tiền.

## Ví dụ đầy đủ

```bash
# Step 1: submit the task
curl -X POST https://uter.ai/v1/video/generations \
  -H "Authorization: Bearer sk-your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "wan2.7-t2v",
    "prompt": "A kitten running under the moonlight, fur drifting in the wind, cinematic slow motion",
    "resolution": "720P",
    "duration": 5,
    "metadata": { "ratio": "16:9", "seed": 42 }
  }'

# Step 2: poll (every 10~15 seconds)
curl https://uter.ai/v1/video/generations/task_xxx \
  -H "Authorization: Bearer sk-your-api-key"

# Step 3: once data.status == "SUCCESS", download from data.result_url
```

Đối với videoedit, hãy truyền media qua mảng `images`: MP4/MOV đầu tiên là video cần chỉnh sửa và các mục PNG/JPG/WEBP còn lại là ảnh tham chiếu; `duration` không bắt buộc (nó theo video đầu vào).

## Mã trạng thái và lỗi

| Trường hợp | Mô tả |
|---|---|
| `400` | Lỗi tham số (thiếu `prompt`, mô hình không xác định, `images` rỗng cho videoedit, …); bị từ chối trước khi gửi, không tính phí |
| `401` / `403` | API key không hợp lệ / không được phép truy cập mô hình này |
| `402` | Số dư không đủ (`insufficient user quota`); nạp thêm trong bảng điều khiển Uter |
| Tác vụ `FAILURE` | Tạo video phía thượng nguồn thất bại, xem `fail_reason`; Uter tự động hoàn tiền |

Các nguyên nhân thường gặp của `FAILURE`: `DataInspectionFailed` (bị từ chối do kiểm duyệt thượng nguồn — điều chỉnh prompt hoặc tài nguyên), thiếu `input_reference` cho i2v, không có ảnh tham chiếu cho r2v, `images[0]` không phải MP4/MOV cho videoedit, URL media không truy cập được, hoặc media vi phạm các ràng buộc nêu trên.
