# Sử dụng API và Playground

## Playground

* Playground dùng để kiểm thử trực tuyến đơn giản và trải nghiệm các mô hình AI. Bạn có thể nhập câu hỏi hoặc chỉ dẫn, tương tác với mô hình và xem kết quả được tạo ra.
  


1. Chọn nhóm và mô hình: ở góc phải dưới ô nhập, hãy chọn nhóm mô hình khả dụng và mô hình cụ thể dùng cho cuộc hội thoại này.
2. Thiết lập tham số yêu cầu: Nhấn nút cài đặt tham số để bật và điều chỉnh các tham số sinh như Temperature, Top P, Frequency Penalty, Presence Penalty và Max Tokens.
3. Nhập nội dung hội thoại: Nhập câu hỏi, chỉ dẫn hoặc prompt vào ô nhập phía dưới; tìm kiếm, tải tệp lên, tải ảnh lên, chụp màn hình và chụp ảnh chưa được triển khai.
4. Gửi yêu cầu: Sau khi xác nhận mô hình, tham số và nội dung, nhấn nút "Gửi" để gửi yêu cầu.
5. Xem kết quả: Sau khi mô hình tạo xong, bạn có thể xem nội dung trả về trong khu vực hội thoại và tiếp tục đặt câu hỏi mới cho các lượt tiếp theo.

<img alt="Trang Playground" src="01-playground.webp" />

## Địa chỉ API và xác thực

Địa chỉ tương thích OpenAI của gateway thường là:

```text
https://your-host/v1
```

Dùng khóa API của bạn làm Bearer Token:

```http
Authorization: Bearer YOUR_API_KEY
```

Ví dụ với chat completions:

```bash
curl https://your-host/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"你好"}]}'
```

## Ví dụ SDK

### Python (OpenAI SDK)

```python
from openai import OpenAI

client = OpenAI(
    api_key="sk-xxxxxxxx",
    base_url="https://your-host/v1",
)

response = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[{"role": "user", "content": "你好"}],
)
print(response.choices[0].message.content)
```

### Định dạng gốc Claude

```bash
curl https://your-platform.com/v1/messages \
  -H "x-api-key: sk-xxxxxxxx" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{"model": "claude-3-5-sonnet-20241022", "max_tokens": 1024, "messages": [{"role": "user", "content": "Hello"}]}'
```

### Định dạng gốc Gemini

```bash
curl "https://your-platform.com/v1beta/models/gemini-1.5-pro:generateContent?key=sk-xxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{"contents": [{"parts": [{"text": "Hello"}]}]}'
```

## Các API endpoint được hỗ trợ

| Giao diện | Đường dẫn | Mô tả |
| --- | --- | --- |
| Chat Completions | `POST /v1/chat/completions` | Giao diện tương thích OpenAI Chat Completions, yêu cầu `model` và `messages`, hỗ trợ cả phản hồi dạng luồng và thông thường. |
| Playground Chat | `POST /pg/chat/completions` | Giao diện riêng cho playground web, dùng phiên đăng nhập để chọn nhóm và mô hình, tái sử dụng cơ chế phân tải lưu lượng, chuyển đổi giao thức, tính phí và thử lại thống nhất. |
| Text Completions | `POST /v1/completions` | Giao diện hoàn thành văn bản truyền thống, yêu cầu `prompt` và `model`. |
| Vector Embeddings | `POST /v1/embeddings` | Chuyển văn bản hoặc mảng văn bản thành vector, yêu cầu `input`, được bộ chuyển đổi kênh đổi sang định dạng phía trên. |
| Gemini Embeddings Compatible Interface | `POST /v1/engines/{model}/embeddings` | Tương thích với các đường dẫn embedding kiểu Gemini cũ, xử lý yêu cầu embedding dựa trên tên mô hình trong URL. |
| Image Generation | `POST /v1/images/generations` | Tạo ảnh từ prompt; mô hình, kích thước, chất lượng và số lượng phụ thuộc vào tham số yêu cầu và các kênh đã cấu hình. |
| Image Editing | `POST /v1/images/edits` | Chỉnh sửa ảnh dựa trên ảnh đầu vào và prompt, hỗ trợ yêu cầu JSON và `multipart/form-data`. |
| Legacy Edit Interface | `POST /v1/edits` | Đường dẫn tương thích được giữ lại, mã sẽ đi vào xử lý Relay hình ảnh; client mới nên ưu tiên dùng `/v1/images/edits`. |
| Speech to Text | `POST /v1/audio/transcriptions` | Chuyển âm thanh thành văn bản và chuyển tiếp tới kênh nhận dạng giọng nói tương ứng theo định dạng giao diện âm thanh của OpenAI. |
| Audio Translation | `POST /v1/audio/translations` | Nhận dạng nội dung âm thanh và trả về văn bản đã dịch. |
| Text to Speech | `POST /v1/audio/speech` | Chuyển văn bản đầu vào thành âm thanh. |
| Rerank | `POST /v1/rerank` | Sắp xếp lại các `documents` ứng viên theo mức độ liên quan đối với `query`, yêu cầu nội dung truy vấn không rỗng và danh sách tài liệu. |
| Content Moderation | `POST /v1/moderations` | Thực hiện kiểm duyệt nội dung trên văn bản hoặc đầu vào khác; nếu không cung cấp mô hình thì sẽ dùng mô hình kiểm duyệt mặc định. |
| Responses API | `POST /v1/responses` | Giao diện định dạng OpenAI Responses, hỗ trợ các khả năng như đầu vào, công cụ và sự kiện phản hồi. |
| Responses Compression | `POST /v1/responses/compact` | Thực hiện nén ngữ cảnh của yêu cầu Responses. |
| Codex Web Search | `POST /v1/alpha/search` | Giao diện định dạng tìm kiếm web độc lập của Codex, hiện chỉ cho phép Sub2API, Uter, Codex và các kênh tùy chỉnh nâng cao có hỗ trợ khả năng này xử lý. |
| Claude Messages | `POST /v1/messages` | Giao diện tương thích Anthropic Claude Messages, yêu cầu `model` và nội dung tin nhắn, khi cần Uter sẽ chuyển đổi sang giao thức phía trên. |
| Realtime Conversation | `GET /v1/realtime` (WebSocket) | Giao diện giao tiếp hai chiều thời gian thực kiểu OpenAI Realtime, mô hình thường được truyền qua tham số truy vấn, khóa API có thể truyền qua Bearer Token hoặc subprotocol WebSocket. |
| Gemini Native Model Invocation | `POST /v1beta/models/{model}:{action}` | Giao diện định dạng gốc Gemini, hỗ trợ các đường dẫn thao tác mô hình như `generateContent`, `streamGenerateContent` và các thao tác liên quan embedding. |
| Gemini Compatible Model Invocation | `POST /v1/models/{model}:{action}` | Nhận yêu cầu thao tác mô hình kiểu Gemini với tiền tố `/v1`, được Gemini Relay phân tích và chuyển đổi. |
| Model List | `GET /v1/models` | Mặc định trả về danh sách mô hình định dạng OpenAI; trả về định dạng Claude khi dùng header yêu cầu Anthropic, và định dạng Gemini khi dùng `x-goog-api-key` hoặc tham số truy vấn `key`. |
| Model Details | `GET /v1/models/{model}` | Truy vấn thông tin của một mô hình; trả về đối tượng lỗi `model_not_found` nếu mô hình không tồn tại. |
| Gemini Model List | `GET /v1beta/models` | Trả về danh sách mô hình khả dụng ở định dạng Gemini, các trường phản hồi gồm `models` và `nextPageToken`. |
| OpenAI Format Model List | `GET /v1beta/openai/models` | Trả về danh sách mô hình ở định dạng OpenAI dưới không gian tên tương thích Gemini. |
