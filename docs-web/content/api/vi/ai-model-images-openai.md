# OpenAI

## Chỉnh sửa ảnh (Edit Image)

Tạo ảnh chỉnh sửa hoặc mở rộng dựa trên ảnh gốc và prompt đã cho.

`POST` `/v1/images/edits/`

### Thân yêu cầu (`multipart/form-data`)

| Trường | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `image` | string (binary) | Có | Hình ảnh cần chỉnh sửa. Phải là tệp PNG hợp lệ, nhỏ hơn 4MB và có dạng hình vuông. Nếu không cung cấp mask, hình ảnh phải có độ trong suốt và sẽ được dùng làm mask. |
| `mask` | string (binary) | Không | Hình ảnh bổ sung, các vùng hoàn toàn trong suốt (ví dụ vùng có alpha bằng 0) chỉ định vị trí ảnh cần chỉnh sửa. Phải là tệp PNG hợp lệ, nhỏ hơn 4MB và có kích thước giống với ảnh gốc. |
| `prompt` | string | Có | Mô tả văn bản của ảnh mong muốn. Độ dài tối đa 1000 ký tự. |
| `n` | string | Không | Số lượng ảnh cần tạo. Phải nằm trong khoảng 1 đến 10. |
| `size` | string | Không | Kích thước ảnh tạo ra. Phải là một trong `256x256`, `512x512` hoặc `1024x1024`. |
| `response_format` | string | Không | Định dạng trả về của ảnh tạo ra. Phải là `url` hoặc `b64_json`. |
| `user` | string | Không | Định danh duy nhất đại diện cho người dùng cuối của bạn, giúp OpenAI giám sát và phát hiện hành vi lạm dụng. [Tìm hiểu thêm](https://platform.openai.com/docs/guides/safety-best-practices/end-user-ids). |
| `model` | string | Không | — |

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Phản hồi |

## Tạo ảnh (Generate Images)

Tạo ảnh dựa trên prompt đã cho. [Tìm hiểu thêm](https://platform.openai.com/docs/guides/images).

`POST` `/v1/images/generations/`

### Thân yêu cầu (`application/json`)

| Trường | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `model` | string | Không | Mô hình dùng để tạo ảnh. Một trong `dall-e-2`, `dall-e-3` hoặc `gpt-image-1`. Mặc định là `dall-e-2`, trừ khi sử dụng các tham số riêng cho `gpt-image-1`. |
| `prompt` | string | Có | Mô tả văn bản của ảnh mong muốn. Độ dài tối đa cho `gpt-image-1` là 32000 ký tự, `dall-e-2` là 1000 ký tự, `dall-e-3` là 4000 ký tự. |
| `n` | integer | Không | Số lượng ảnh cần tạo. Phải nằm trong khoảng 1 đến 10. Với `dall-e-3`, chỉ hỗ trợ `n=1`. |
| `size` | string | Không | Kích thước ảnh tạo ra. Với `gpt-image-1`, phải là một trong `1024x1024`, `1536x1024` (ngang), `1024x1536` (dọc) hoặc `auto` (mặc định); với `dall-e-2`, phải là một trong `256x256`, `512x512` hoặc `1024x1024`; với `dall-e-3`, phải là một trong `1024x1024`, `1792x1024` hoặc `1024x1792`. |
| `background` | string | Không | Cho phép thiết lập độ trong suốt cho nền của ảnh tạo ra. Tham số này chỉ hỗ trợ `gpt-image-1`. Phải là một trong `transparent` (trong suốt), `opaque` (đục) hoặc `auto` (mặc định). Khi dùng `auto`, mô hình sẽ tự động xác định nền tối ưu. Nếu là `transparent`, định dạng đầu ra cần hỗ trợ trong suốt, do đó nên đặt là `png` (mặc định) hoặc `webp`. |
| `moderation` | string | Không | Kiểm soát mức độ kiểm duyệt nội dung của ảnh tạo bởi `gpt-image-1`. Phải là `low` để lọc ít hạn chế hơn hoặc `auto` (mặc định). |
| `quality` | string | Không | Chất lượng của ảnh tạo ra. |
| `stream` | string | Không | — |
| `style` | string | Không | — |
| `user` | string | Không | — |

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Phản hồi |

#### Trường phản hồi `200`

| Trường | Kiểu | Mô tả |
|---|---|---|
| `created` | integer | — |
| `data` | array&lt;object&gt; | — |
| `usage.total_tokens` | integer | — |
| `usage.input_tokens` | integer | — |
| `usage.output_tokens` | integer | — |
| `usage.input_tokens_details.text_tokens` | integer | — |
| `usage.input_tokens_details.image_tokens` | integer | — |
