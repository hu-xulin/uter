# Định dạng Google Veo

Tạo video Google Veo 3.1: gọi toàn bộ họ mô hình Veo 3.1 qua API tác vụ bất đồng bộ, hỗ trợ tạo video từ văn bản và từ hình ảnh, kèm âm thanh đồng bộ tùy chọn (đầu ra tối đa 4K).

## Các mô hình được hỗ trợ

Cả ba mô hình dùng chung một endpoint và chỉ phân biệt qua trường `model`. Mọi mô hình đều hỗ trợ tạo video từ văn bản và từ hình ảnh, với âm thanh tùy chọn.

| ID mô hình | Phiên bản | Điểm nhấn | Phù hợp nhất cho |
|---|---|---|---|
| `veo-3.1-generate-001` | Veo 3.1 | Chất lượng cao nhất, 4K, âm thanh gốc | Sáng tạo và thương mại chất lượng cao |
| `veo-3.1-fast-generate-001` | Veo 3.1 Fast | Nhanh hơn, chất lượng cân bằng | Lặp nhanh, tạo hàng loạt |
| `veo-3.1-lite-generate-001` | Veo 3.1 Lite | Nhanh nhất, chi phí thấp nhất | Nguyên mẫu, các trường hợp nhạy cảm chi phí |

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
| `model` | string | Có | ID mô hình Veo 3.1, xem bảng trên |
| `prompt` | string | Có | Prompt video; hỗ trợ tiếng Trung và tiếng Anh, khuyến nghị dùng tiếng Anh để có kết quả tốt nhất |
| `size` | string | Không | Độ phân giải: `720p` / `1080p` / `4000` (4K, chỉ một số mô hình), mặc định `1080p` |
| `resolution` | string | Không | Giống `size` (khuyến nghị, khớp với thượng nguồn; thắng khi cả hai đều được đặt) |
| `duration` | int | Không | Thời lượng tính bằng giây: `4` / `6` / `8`, mặc định `8` |
| `seconds` | string | Không | Dạng chuỗi của `duration` (để tương thích API OpenAI Sora) |
| `aspect_ratio` | string | Không | Tỷ lệ khung hình: `16:9` / `9:16`, mặc định `16:9` |
| `generate_audio` | bool | Không | Tạo âm thanh đồng bộ (giọng nói, hiệu ứng, không khí). **Mặc định `true`**; đặt rõ ràng thành `false` để tiết kiệm chi phí |
| `negative_prompt` | string | Không | Prompt tiêu cực mô tả những gì cần tránh |
| `image` | string | Không | Ảnh khung hình đầu cho i2v; URL HTTP(S) / data URI / base64 thô |
| `images` | string[] | Không | Mảng ảnh khung hình đầu cho i2v; chỉ dùng `images[0]`, và `image` thắng nếu gửi cả hai |
| `last_frame_image` | string | Không | Ảnh khung hình cuối (kèm `image` / `images[0]` → nội suy khung hình đầu + cuối, độc quyền của Veo 3.1). Cùng định dạng với `image` |
| `reference_images` | string[] | Không | Ảnh tham chiếu, tối đa 3 ảnh; được gửi lên thượng nguồn với `referenceType="asset"`. **Loại trừ với `image` / `last_frame_image`**, và chỉ hỗ trợ khi `duration=8` |
| `metadata` | object | Không | Container tham số gốc của Veo, xem «Tham số nâng cao metadata» |

> Các trường snake_case ở cấp cao nhất như `generate_audio` / `negative_prompt` / `aspect_ratio` sẽ được tự động ánh xạ sang tham số camelCase phía thượng nguồn. Bạn cũng có thể đặt chúng bên trong `metadata` (snake_case hoặc camelCase), tương đương với cấp cao nhất.
>
> `generate_audio: true` làm tăng chi phí đáng kể (khoảng 2 lần). Vì mặc định tính phí là `true`, hãy đặt rõ ràng `generate_audio: false` khi không cần âm thanh.

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
| `data.task_id` | string | ID tác vụ |
| `data.status` | string | Trạng thái tác vụ: `queued` / `processing` / `succeeded` / `failed` |
| `data.error` | string / null | Lý do thất bại; `null` khi thành công |
| `data.format` | string / null | Định dạng đầu ra (ví dụ `mp4`); `null` khi đang xử lý hoặc khi thất bại |
| `data.metadata` | object / null | Metadata bổ sung |
| `data.url` | string / null | URL tải video xuống; `null` khi đang xử lý hoặc khi thất bại (liên kết chữ ký tạm thời, hợp lệ 24 giờ) |

#### Enum trạng thái

| Trạng thái | Mô tả |
|---|---|
| `queued` | Đã gửi, đang chờ xử lý |
| `processing` | Đang tạo |
| `succeeded` | Hoàn tất; `data.url` chứa địa chỉ tải xuống |
| `failed` | Thất bại; `data.error` giải thích lý do |

## Định dạng đầu vào hình ảnh

`image` / `images[0]` chấp nhận ba định dạng sau; Uter phát hiện và chuyển đổi chúng thành base64 nội tuyến mà Veo yêu cầu:

| Định dạng | Ví dụ | Mô tả |
|---|---|---|
| URL HTTP(S) | `https://example.com/foo.png` | Được backend tải xuống và mã hóa base64; URL phải truy cập công khai được và chưa hết hạn |
| data URI | `data:image/png;base64,iVBOR...` | Dữ liệu nội tuyến được truyền thẳng; không cần mạng |
| base64 thô | `iVBORw0KGgo...` (không có tiền tố) | Base64 thuần; kiểu MIME được nhận diện tự động |

Giới hạn: kích thước sau giải mã ≤ **20 MB**; thời gian chờ tải URL **30 giây**; lỗi phân tích (URL không truy cập được / quá lớn / base64 không hợp lệ) trả về `400 parse images[0] failed: ...` và **không tính phí**. URI GCS gốc `gs://` không được hỗ trợ; hãy dùng `https://storage.googleapis.com/...` thay thế.

## Tham số nâng cao metadata

`metadata` là container tham số gốc của Veo cho các tùy chọn nâng cao không có trong phong cách OpenAI. Mọi trường ở cấp cao nhất cũng có thể đặt bên trong `metadata` (snake_case hoặc camelCase).

| Trường | Kiểu | Mô tả |
|---|---|---|
| `seed` | int | Hạt giống ngẫu nhiên (vị trí khuyến nghị) |
| `personGeneration` / `person_generation` | string | Chính sách tạo người: `allow_all` / `allow_adult` / `dont_allow` |
| `storageUri` / `storage_uri` | string | Ghi kết quả trực tiếp vào một đường dẫn bucket GCS (chỉ kênh vertex; cần có quyền) |
| `compressionQuality` / `compression_quality` | string | Chất lượng nén: `optimized` (mặc định) / `lossless` |
| `resizeMode` / `resize_mode` | string | Chế độ đổi kích thước i2v: `crop` / `fit` |
| `sampleCount` / `sample_count` | int | Số video mỗi yêu cầu; **hiện cố định là 1**, mọi giá trị đều bị ghi đè |

> Thứ tự ưu tiên: camelCase đã có trong metadata > snake_case trong metadata > trường ở cấp cao nhất.

## So sánh mô hình

| Hạng mục | Veo 3.1 | Veo 3.1 Fast | Veo 3.1 Lite |
|---|---|---|---|
| **ID mô hình** | `veo-3.1-generate-001` | `veo-3.1-fast-generate-001` | `veo-3.1-lite-generate-001` |
| **Chất lượng** | Cao nhất | Cân bằng | Cơ bản |
| **Tốc độ (đo thực tế, video 8 giây)** | 90–130 giây | 75–105 giây | 50–80 giây |
| **Độ phân giải tối đa** | 4K | 1080p | 1080p |
| **Hỗ trợ âm thanh** | ✓ | ✓ | ✓ |
| **Từ hình ảnh sang video** | ✓ | ✓ | ✓ |

## Endpoint tương thích OpenAI

Ngoài `/v1/video/generations`, còn có endpoint `/v1/videos` theo phong cách OpenAI; hai endpoint hoàn toàn tương đương.

- Gửi: `POST` `/v1/videos` (các trường body giống hệt)
- Truy vấn: `GET` `/v1/videos/{task_id}` (trả về định dạng phẳng của OpenAI)

> Phản hồi truy vấn tương thích OpenAI không bao gồm URL video. Để lấy địa chỉ tải xuống, hãy dùng `/v1/video/generations/{task_id}` và đọc `data.url`.

## Tính phí

```
quota = modelPrice × QuotaPerUnit × groupRatio × pricingRatio × seconds

QuotaPerUnit = 500,000
groupRatio   = 1.0 (nhóm mặc định khi vận hành)
```

### Chỉ video (`generate_audio: false`)

| Mô hình | 720p | 1080p | 4K |
|---|---|---|---|
| `veo-3.1-generate-001` | $0,20 / giây | $0,20 / giây | $0,40 / giây |
| `veo-3.1-fast-generate-001` | $0,08 / giây | $0,10 / giây | $0,25 / giây |
| `veo-3.1-lite-generate-001` | $0,03 / giây | $0,05 / giây | — |

### Video + âm thanh (`generate_audio: true`)

| Mô hình | 720p | 1080p | 4K |
|---|---|---|---|
| `veo-3.1-generate-001` | $0,40 / giây | $0,40 / giây | $0,60 / giây |
| `veo-3.1-fast-generate-001` | $0,10 / giây | $0,12 / giây | $0,30 / giây |
| `veo-3.1-lite-generate-001` | $0,05 / giây | $0,08 / giây | — |

Khi `failed`, Uter tự động hoàn tiền.

## Ví dụ đầy đủ

```bash
# Text-to-video
curl -X POST https://uter.ai/v1/video/generations \
  -H "Authorization: Bearer sk-your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "veo-3.1-generate-001",
    "prompt": "A golden retriever playing fetch on a sunny beach, cinematic wide shot, slow motion",
    "size": "1080p",
    "duration": 8,
    "aspect_ratio": "16:9"
  }'

# Poll (every 10~15 seconds)
curl https://uter.ai/v1/video/generations/task_xxx \
  -H "Authorization: Bearer sk-your-api-key"

# Once data.status == "succeeded", download from data.url
curl -o output.mp4 "https://uter.ai/v1/videos/task_xxx/content"
```

Nội suy khung hình đầu + cuối (độc quyền của Veo 3.1):

```bash
curl -X POST https://uter.ai/v1/video/generations \
  -H "Authorization: Bearer sk-your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "veo-3.1-generate-001",
    "prompt": "Smooth cinematic transition between a serene garden and a bustling city.",
    "image": "https://example.com/start.jpg",
    "last_frame_image": "https://example.com/end.jpg",
    "size": "1080p",
    "duration": 8,
    "aspect_ratio": "16:9"
  }'
```

- `reference_images` không thể kết hợp với `image` / `images` / `last_frame_image`, nếu không sẽ trả về `400 reference_images is mutually exclusive ...`.
- `reference_images` chỉ nhận tối đa 3 mục; nhiều hơn sẽ trả về `400 reference_images supports at most 3 entries`.
- `reference_images` chỉ được hỗ trợ khi `duration=8`.

## Mã trạng thái và lỗi

| Trạng thái | Lý do | Hành động |
|---|---|---|
| `400` | Lỗi tham số (thiếu `prompt`, `duration` không hợp lệ, hoặc lỗi phân tích hình ảnh `parse images[0] failed: ...`) | Kiểm tra các trường trong body yêu cầu |
| `401` | API key không hợp lệ hoặc đã hết hạn | Kiểm tra header `Authorization` |
| `403` | API key không được phép truy cập mô hình này | Kiểm tra danh sách mô hình được phép của token |
| `402` | Số dư không đủ | Nạp thêm trong bảng điều khiển Uter |

Các nguyên nhân thường gặp của `failed`: bị từ chối do an toàn nội dung (điều chỉnh prompt; thêm `negative_prompt`), URL hình ảnh không truy cập được, `duration` nằm ngoài phạm vi, hoặc yêu cầu 4K trên mô hình Lite.
