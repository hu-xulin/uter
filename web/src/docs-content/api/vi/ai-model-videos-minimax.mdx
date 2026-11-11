# Định dạng MiniMax

Tạo video MiniMax H3 (`MiniMax-H3`): gọi MiniMax H3 qua API tác vụ bất đồng bộ, hỗ trợ tạo video từ văn bản, từ hình ảnh và từ hình tham chiếu, được tính phí chính xác theo mức sử dụng phía thượng nguồn.

## Mô hình và khả năng

Chỉ có một tên mô hình, `MiniMax-H3`. **Chế độ tạo được quyết định tự động dựa trên các đầu vào media mà yêu cầu mang theo:**

| Chế độ | Kích hoạt khi | Đầu vào media |
|---|---|---|
| Từ văn bản sang video (t2v) | Chỉ có `prompt` | Không |
| Từ hình ảnh sang video (i2v) | Ảnh khung hình đầu (ảnh khung hình cuối là tùy chọn) | `input_reference` / `images` |
| Từ hình tham chiếu sang video (r2v) | Ảnh / video / âm thanh tham chiếu | Mảng `media[]` ở cấp cao nhất |

Trong mọi chế độ, `prompt` **luôn bắt buộc**.

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
| `model` | string | Có | Cố định là `MiniMax-H3` |
| `prompt` | string | Có | Prompt văn bản |
| `resolution` | string | Không | Độ phân giải; hiện chỉ có `2K` (mặc định `2K`) |
| `duration` | int | Không | Thời lượng video tính bằng giây, `4`–`15`, mặc định `6` |
| `ratio` | string | Không | Tỷ lệ khung hình: `16:9` / `9:16` / `1:1` / `adaptive`. Mặc định `16:9` cho t2v và `adaptive` (theo khung hình đầu) cho i2v |
| `input_reference` | string | Không | URL ảnh khung hình đầu cho i2v (công khai hoặc base64) |
| `images` | string[] | Không | Mảng ảnh cho i2v: ảnh thứ nhất là khung hình đầu, ảnh thứ hai là khung hình cuối |
| `media` | object[] | Không | Đầu vào media có cấu trúc cho chế độ từ hình tham chiếu sang video, xem bên dưới |

### Các phần tử `media[]`

Dùng cho chế độ từ hình tham chiếu sang video (r2v) để chỉ rõ chính xác vai trò của từng tài nguyên tham chiếu:

| `type` | Vai trò | Mục đích |
|---|---|---|
| `reference_image` | Ảnh tham chiếu | (Các) ảnh tham chiếu |
| `reference_video` | Video tham chiếu | Video tham chiếu (thời lượng tính phí của nó được tính vào tổng số giây) |
| `reference_audio` | Âm thanh tham chiếu | Âm thanh tham chiếu |
| `first_frame` / `last_frame` | Khung hình đầu / cuối | Ảnh khung hình đầu / cuối cho i2v |

Khi bỏ qua `media` có cấu trúc, Uter suy luận tài nguyên từ `images` / `input_reference` dựa trên phần mở rộng và thứ tự: video → video tham chiếu, audio → âm thanh tham chiếu, ảnh thứ nhất → khung hình đầu, ảnh thứ hai → khung hình cuối. Hãy dùng `media[]` khi bạn cần kiểm soát vai trò chính xác.

> Âm thanh tham chiếu (`reference_audio`) hiện bị giới hạn bởi khả năng hỗ trợ phía thượng nguồn: trong quá trình thử nghiệm, thượng nguồn trả về tác vụ thất bại (Uter tự động hoàn tiền đầy đủ). Tạo video từ văn bản, từ hình ảnh (khung hình đầu / đầu + cuối) và từ ảnh/video tham chiếu đều hoạt động bình thường.

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

> `id` / `task_id` do Uter tạo ra và không phải task_id MiniMax phía thượng nguồn.

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
| `data.status` | string | Trạng thái tác vụ: `QUEUED` / `IN_PROGRESS` / `SUCCESS` / `FAILURE` |
| `data.result_url` | string | URL kết quả video (chỉ có giá trị khi `SUCCESS`) |
| `data.quota` | int | Hạn mức tính phí cuối cùng (đã quyết toán theo mức sử dụng thực tế) |
| `data.data.task.usage` | object | Mức sử dụng chính xác phía thượng nguồn, cơ sở tính phí (`total_seconds` / `input_seconds` / `output_seconds` / `input_image_count`) |

#### Enum trạng thái

| Trạng thái thống nhất | Trạng thái MiniMax | Mô tả |
|---|---|---|
| `QUEUED` | `queued` / `preparing` | Đang xếp hàng |
| `IN_PROGRESS` | `running` | Đang tạo |
| `SUCCESS` | `succeeded` | Hoàn tất; `result_url` chứa video |
| `FAILURE` | `failed` / `cancelled` / `expired` | Thất bại; `fail_reason` giải thích lý do |

## Tính phí

MiniMax H3 tính phí theo **mức sử dụng thực tế phía thượng nguồn**:

```
cost(USD) = total_billed_seconds × resolution_price + billable_reference_images × $0.04
where: total_billed_seconds = input_reference_video_seconds + generated_video_seconds
```

| Độ phân giải | Đơn giá |
|---|---|
| `2K` | $0,13 / giây |
| `768P` | $0,09 / giây (chưa khả dụng) |

Các điểm chính:

- **Video tham chiếu đầu vào cũng bị tính phí**: với r2v, thời lượng tính phí của một video tham chiếu được tính theo đơn giá của độ phân giải đầu ra.
- **Ảnh tham chiếu được tính phí riêng**: $0,04 cho mỗi ảnh tham chiếu có tính phí.
- **Tính trước khi gửi, quyết toán khi hoàn tất**: khoản tính phí tạm được trừ khi gửi, sau đó Uter tính lại chính xác dựa trên `usage` phía thượng nguồn khi thành công, hoàn tiền hoặc thu thêm phần chênh lệch.

## Ví dụ đầy đủ

```bash
# Step 1: submit the task
curl -X POST https://uter.ai/v1/video/generations \
  -H "Authorization: Bearer sk-your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "MiniMax-H3",
    "prompt": "A cat dozing in the sunlight, fur gently swaying in the breeze",
    "resolution": "2K",
    "duration": 6,
    "ratio": "16:9"
  }'

# Step 2: poll (every 10~15 seconds)
curl https://uter.ai/v1/video/generations/task_xxx \
  -H "Authorization: Bearer sk-your-api-key"

# Step 3: once data.status == "SUCCESS", download from data.result_url
```

Tạo video từ hình tham chiếu bằng mảng `media[]` ở cấp cao nhất:

```bash
curl -X POST https://uter.ai/v1/video/generations \
  -H "Authorization: Bearer sk-your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "MiniMax-H3",
    "prompt": "Generate a coherent video from the given assets",
    "resolution": "2K",
    "duration": 6,
    "media": [
      { "type": "reference_image", "url": "https://example.com/ref.jpg" },
      { "type": "reference_video", "url": "https://example.com/ref.mp4" }
    ]
  }'
```

## Mã trạng thái và lỗi

| Trường hợp | Mô tả |
|---|---|
| Thiếu `prompt` | `400`, `prompt is required` (bị từ chối trước khi gửi, không tính phí) |
| `401` / `403` | API key không hợp lệ / không được phép truy cập mô hình này |
| `402` | Số dư không đủ (`insufficient user quota`); nạp thêm trong bảng điều khiển Uter |
| Tác vụ `FAILURE` | Tạo video phía thượng nguồn thất bại, xem `fail_reason`; Uter tự động hoàn tiền |
