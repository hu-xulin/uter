# Định dạng PixVerse

Tạo video PixVerse: gọi toàn bộ họ mô hình PixVerse (C1 / V6 / V5.6 / V5.5 / V5 / V4.5 / V4 / V3.5) qua endpoint tương thích OpenAI `/v1/videos`, hỗ trợ tạo video từ văn bản và từ hình ảnh.

## Các mô hình được hỗ trợ

Trong trường `model`, luôn dùng dạng `PixVerse/<phiên bản>`, ví dụ `PixVerse/v5.6`.

| Mô hình | Điểm nhấn | Bậc thời lượng | Âm thanh |
|---|---|---|---|
| `PixVerse/c1` | Flagship, tính phí theo giây linh hoạt nhất | 1–15 giây (theo giây) | ✓ |
| `PixVerse/v6` | Thế hệ mới nhất, tính phí theo giây | 1–15 giây (theo giây) | ✓ |
| `PixVerse/v5.6` | Chế độ clip đơn, chất lượng ổn định | 5 / 8 / 10 giây | ✓ |
| `PixVerse/v5.5` | Hỗ trợ ghép nhiều clip | 5 / 8 / 10 giây | ✓ |
| `PixVerse/v5` | Phiên bản gốc thế hệ 5 | 5 / 8 giây | ✗ |
| `PixVerse/v4.5` | Thế hệ 4.5, hỗ trợ Fast Motion | 5 / 8 giây | ✗ |
| `PixVerse/v4` | Thế hệ 4, hỗ trợ Fast Motion | 5 / 8 giây | ✗ |
| `PixVerse/v3.5` | Thế hệ 3.5, hỗ trợ Fast Motion | 5 / 8 giây | ✗ |

> Tiền tố `PixVerse/` phân biệt chữ hoa chữ thường; hãy dùng chính xác `PixVerse/v5.6`. Phần phiên bản (`v5.6`, `c1`) được chuẩn hóa không phân biệt chữ hoa chữ thường.

## Tạo video

`POST` `/v1/videos`

### Header yêu cầu

| Header | Bắt buộc | Mô tả |
|---|---|---|
| `Authorization` | Có | `Bearer sk-your-api-key` |
| `Content-Type` | Có | `application/json` |

### Body yêu cầu (`application/json`)

| Trường | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `model` | string | Có | Tên mô hình PixVerse, xem bảng trên |
| `prompt` | string | Có | Prompt video, tối đa 2048 ký tự |
| `image` | string | Không | Ảnh nguồn cho chế độ từ hình ảnh sang video (URL hoặc data URI base64); có mặt thì chuyển sang từ hình ảnh sang video |
| `images` | string[] | Không | Dạng mảng của `image` (loại trừ với `image`) |
| `duration` | int | Không | Thời lượng tính bằng giây, mặc định 5; các bậc được hỗ trợ khác nhau theo mô hình |
| `resolution` | string | Không | Bậc độ phân giải (giống `size`, khuyến nghị để thống nhất giữa các mô hình): `720P` / `1080P` |
| `size` | string | Không | Độ phân giải: `360p` `540p` `720p` `1080p`, hoặc dạng pixel như `1920x1080`. Khi gửi cả hai, `resolution` được ưu tiên |
| `metadata` | object | Không | Container tham số riêng của PixVerse, xem bên dưới |

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

> `id` / `task_id` do Uter tạo ra và không phải `video_id` PixVerse phía thượng nguồn. Luôn sử dụng giá trị được trả về tại đây.

## Lấy trạng thái tác vụ video

`GET` `/v1/videos/{task_id}`

### Tham số yêu cầu

| Tên | Vị trí | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|---|
| `task_id` | path | string | Có | ID tác vụ video |

### Phản hồi

| Trạng thái | Mô tả |
|---|---|
| `200` | Lấy trạng thái tác vụ thành công |
| `404` | Không tìm thấy tác vụ |

#### Trường phản hồi `200`

| Trường | Kiểu | Mô tả |
|---|---|---|
| `id` | string | ID video |
| `status` | string | Trạng thái tác vụ, xem enum |
| `progress` | integer | Phần trăm tiến độ |
| `created_at` | integer | Dấu thời gian tạo |
| `completed_at` | integer | Dấu thời gian hoàn tất (khi thành công) |
| `size` | string | Kích thước video (khi thành công) |
| `metadata.url` | string | URL video (chỉ khi `completed`) |
| `error.message` | string | Lý do thất bại (chỉ khi `failed`) |

#### Enum trạng thái

| Trạng thái | Mô tả |
|---|---|
| `queued` | Đã gửi, đang xếp hàng |
| `in_progress` | Đang tạo |
| `completed` | Hoàn tất; `metadata.url` chứa video |
| `failed` | Thất bại; `error.message` giải thích lý do |

## Lấy nội dung video

`GET` `/v1/videos/{task_id}/content`

Trả về luồng video thô (`Content-Type: video/mp4`). Uter làm proxy URL tạm thời của PixVerse, tránh việc lộ địa chỉ thượng nguồn và vấn đề hết hạn.

### Tham số yêu cầu

| Tên | Vị trí | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|---|
| `task_id` | path | string | Có | ID tác vụ video |

### Phản hồi

| Trạng thái | Mô tả |
|---|---|
| `200` | Lấy nội dung video thành công |
| `404` | Không tìm thấy video hoặc video chưa hoàn tất |

> **Khuyến nghị mạnh**: hãy tải qua proxy `/content` thay vì truy cập trực tiếp `metadata.url`. Liên kết sau là liên kết tạm thời của PixVerse (thường chỉ hợp lệ vài giờ), trong khi proxy không hết hạn miễn là bản ghi tác vụ còn tồn tại.

## Tham số riêng (`metadata`)

Mọi trường riêng của PixVerse đều được truyền qua object `metadata` trong body yêu cầu.

### Trường chung

| Trường | Kiểu | Áp dụng cho | Mô tả |
|---|---|---|---|
| `quality` | string | Tất cả | Độ phân giải; ghi đè `size` ở cấp cao nhất: `360p` `540p` `720p` `1080p` |
| `aspect_ratio` | string | Từ văn bản sang video | Tỷ lệ khung hình: `16:9` `9:16` `1:1` `4:3` `3:4` `2:3` `3:2` `21:9` |
| `motion_mode` | string | V4.5 / V4 / V3.5 | Chế độ chuyển động: `normal` (mặc định) hoặc `fast` (giá ×2; chỉ 5 giây ở 360p/540p/720p) |
| `camera_movement` | string | Tất cả | Chuyển động camera, ví dụ `zoom_in` `zoom_out` `pan_left` `pan_right` |
| `seed` | int | Tất cả | Hạt giống ngẫu nhiên, 0–2147483647 |
| `template_id` | int | Tất cả | ID template |
| `style` | string | Tất cả | Phong cách, ví dụ `anime` |
| `water_mark` | bool | Tất cả | Có thêm watermark hay không |
| `negative_prompt` | string | Tất cả | Prompt tiêu cực |

> `motion_mode: fast` chỉ giới hạn nghiêm ngặt cho V4.5 / V4 / V3.5, thời lượng 5 giây và 360p/540p/720p. Các tổ hợp khác (ví dụ `1080p + fast` hoặc `8s + fast`) trả về `400` và không tính phí.

### Tạo âm thanh (C1 / V6 / V5.6 / V5.5)

| Trường | Kiểu | Áp dụng cho | Mô tả |
|---|---|---|---|
| `generate_audio_switch` | bool | C1 / V6 / V5.6 / V5.5 | Chuyển sang bậc tính phí «có âm thanh» (âm thanh được tạo phía thượng nguồn) |

> V5 / V4.5 / V4 / V3.5 **không** hỗ trợ âm thanh; gửi `generate_audio_switch: true` sẽ trả về `400`.

### Trường nâng cao cho từ hình ảnh sang video

Chế độ từ hình ảnh sang video của PixVerse yêu cầu tải ảnh lên thượng nguồn để lấy `img_id`. Uter **tự động bọc quy trình tải lên**: truyền `image: "https://..."` hoặc `image: "data:image/png;base64,..."` trong body, Uter sẽ tải lên PixVerse, lấy `img_id` và chuyển tiếp.

Nếu bạn đã có `img_id` (trường hợp nâng cao), hãy truyền trực tiếp:

| Trường | Kiểu | Mô tả |
|---|---|---|
| `img_id` | int | ID ảnh đã tải lên trước; được ưu tiên hơn việc tự động tải lên từ `image` |

## Ví dụ đầy đủ

```bash
# Step 1: submit the task
curl -X POST https://uter.ai/v1/videos \
  -H "Authorization: Bearer sk-your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "PixVerse/v5.6",
    "prompt": "A cat strolling on the lunar surface under a starry sky",
    "duration": 5,
    "size": "720p",
    "metadata": { "aspect_ratio": "16:9", "seed": 42 }
  }'

# Step 2: poll the task status (every 3~5 seconds)
curl https://uter.ai/v1/videos/task_xxx \
  -H "Authorization: Bearer sk-your-api-key"

# Step 3: once completed, download the video
curl https://uter.ai/v1/videos/task_xxx/content \
  -H "Authorization: Bearer sk-your-api-key" \
  -o cat_on_moon.mp4
```

## Mã trạng thái và lỗi

| Trường hợp | Mô tả |
|---|---|
| `400` | Tổ hợp tham số không hợp lệ (ví dụ `generate_audio_switch: true` trên V5, chế độ fast với 1080p/8s, quality × duration không được hỗ trợ, mô hình không xác định); bị từ chối trước khi gửi, không tính phí |
| `401` | API key không hợp lệ hoặc đã hết hạn |
| `403` | API key không được phép truy cập mô hình này (kiểm tra danh sách mô hình được phép của token) |
| `402` | Số dư không đủ (`insufficient user quota`); nạp thêm trong bảng điều khiển Uter |
| Tác vụ `failed` | Thất bại phía thượng nguồn (kiểm duyệt / tạo / hết thời gian chờ); Uter tự động hoàn tiền và khoản hoàn hiện trong nhật ký |
