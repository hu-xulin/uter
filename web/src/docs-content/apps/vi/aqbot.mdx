# AQBot - Bàn làm việc AI máy tính để bàn ưu tiên cục bộ

> **Tùy chọn cài đặt trò chuyện**
>
> Trong bảng điều khiển Uter, đi tới System Settings -> Chat Settings và thêm
>   tùy chọn lối tắt sau. Nó cho phép người dùng điền AQBot từ trang quản lý
>   token chỉ với một cú nhấp:

    ```json
    { "AQBot": "aqbot://providers?name=New%20API&baseurl={address}&apikey={key}&type=openai" }
    ```

> AQBot là một bàn làm việc AI máy tính để bàn ưu tiên cục bộ, mã nguồn mở (AGPL-3.0). Nó
>   hợp nhất trò chuyện đa nhà cung cấp, tác nhân ACP, cơ sở kiến thức, công cụ MCP và một
>   cổng API cục bộ, đồng thời giữ dữ liệu ứng dụng và tệp người dùng trên máy.

- Trang chủ: [https://app.aqbot.top](https://app.aqbot.top)
- GitHub: [https://github.com/AQBot-Desktop/AQBot](https://github.com/AQBot-Desktop/AQBot)
- Tải xuống: [GitHub Releases](https://github.com/AQBot-Desktop/AQBot/releases)
- Tài liệu chính thức: [Bắt đầu](https://app.aqbot.top/guide/getting-started)

## Tính năng cốt lõi

- **Trò chuyện đa nhà cung cấp** — Kết nối OpenAI, Claude, Gemini, DeepSeek, Qwen và bất kỳ điểm cuối tương thích OpenAI nào
- **Nhập nhà cung cấp** — Nhập một nhà cung cấp từ liên kết `aqbot://` sau khi xác nhận
- **Quản lý mô hình** — Đồng bộ danh sách mô hình từ xa, thẻ năng lực và kiểm tra độ trễ
- **Tác nhân** — Tác nhân Agent trong trò chuyện (sử dụng API nhà cung cấp đã cấu hình của bạn) cùng với bàn làm việc ACP Agent
- **Dữ liệu cục bộ** — Trạng thái ứng dụng nằm trong `~/.aqbot/`; tệp người dùng nằm trong `~/Documents/aqbot/`

Xem [trang web AQBot](https://app.aqbot.top) để biết bộ tính năng đầy đủ. Trang này chỉ đề cập đến tích hợp Uter.

## Phương thức tích hợp Uter

Vui lòng sử dụng Uter tự triển khai của bạn, hoặc đảm bảo rằng nhà cung cấp dịch vụ có dịch vụ Uter với ủy quyền upstream hợp pháp và các nghĩa vụ tuân thủ. Không tích hợp địa chỉ API hoặc khóa từ nguồn không xác định vào môi trường sản xuất.

### Phương pháp 1: Nhập một cú nhấp (Khuyên dùng)

1. Cài đặt AQBot và mở ít nhất một lần để hệ thống đăng ký giao thức `aqbot://`
2. Trong bảng điều khiển Uter, thêm JSON ở trên vào **System Settings → Chat Settings**
3. Mở **Token Management** và chọn **AQBot** từ các thao tác token
4. Trình duyệt khởi chạy AQBot. Xác nhận tên nhà cung cấp, máy chủ API, kiểu `openai` và tiền tố khóa
5. Sau khi xác nhận, AQBot mở **Settings → Provider Management**. Nó sẽ sử dụng lại một nhà cung cấp có cùng máy chủ API + kiểu, hoặc tạo một nhà cung cấp mới
6. Mở nhà cung cấp đó, nhấn **Sync Models**, sau đó quay lại trò chuyện và chọn một mô hình

`{address}` là gốc trang Uter (ví dụ `https://your-uter.example`), không có chuỗi truy vấn. Với kiểu OpenAI, AQBot tự động thêm `/v1`. Việc nhập không xác thực khóa hay đồng bộ mô hình.

### Phương pháp 2: Cấu hình thủ công

1. Sao chép API Key từ Token Management của Uter
2. Trong AQBot, đi tới **Settings → Provider Management → Add Provider**
3. Điền vào:

| Trường | Giá trị |
| --- | --- |
| Provider Name | Ví dụ `Uter` |
| Provider Type | `OpenAI` (khuyên dùng) |
| API Host | Địa chỉ trang Uter, chẳng hạn `https://your-uter.example` |
| API Key | Token Uter của bạn |

4. Nhấn **Sync Models** để kéo các mô hình hiện đang được Uter hiển thị
5. Quay lại trò chuyện và chọn một mô hình đã đồng bộ

![Chuyển đổi mô hình](/apps-assets/aqbot/switch-model.webp)

### Lưu ý về máy chủ API

- Nên dùng gốc trang và để AQBot tự thêm `/v1`
- Nếu máy chủ đã kết thúc bằng `/v1`, AQBot sẽ không thêm thêm một cái nữa
- Chỉ thêm dấu `!` ở cuối khi bạn phải tắt tính năng tự động hoàn thành

### Tùy chọn: Giao thức gốc

Nếu Uter cũng hiển thị API gốc của Claude hoặc Gemini, hãy thêm một nhà cung cấp khác:

| Mục đích | Provider Type | API Host |
| --- | --- | --- |
| Chat Completions (mặc định) | OpenAI | Gốc trang |
| Claude gốc `/v1/messages` | Anthropic | Gốc trang |
| Gemini gốc | Gemini | Gốc trang |

Đổi `type` trong mẫu một cú nhấp thành `anthropic` hoặc `gemini`. Cùng một API key có thể hỗ trợ nhiều nhà cung cấp.

## Câu hỏi thường gặp

- **Nhấn AQBot không mở ứng dụng**: Cài đặt và khởi chạy ứng dụng máy tính để bàn trước. Chỉ mở trang web hoặc máy chủ phát triển Vite không đăng ký được `aqbot://`
- **Nhập thành công nhưng trò chuyện thất bại**: Nhấn **Sync Models**, và đảm bảo ID mô hình khớp với tên Uter thực sự hiển thị
- **macOS báo ứng dụng bị hỏng hoặc không thể xác minh nhà phát triển**: Làm theo [README AQBot](https://github.com/AQBot-Desktop/AQBot) và [Bắt đầu](https://app.aqbot.top/guide/getting-started) để cho phép ứng dụng này. Bạn không cần tắt Gatekeeper
- **Liên kết một cú nhấp chứa API key**: Chỉ tạo nó trên trang token đã đăng nhập. Không đăng tải URL có chứa khóa thực

## Liên kết liên quan

- [AQBot GitHub](https://github.com/AQBot-Desktop/AQBot)
- [Cấu hình nhà cung cấp (tài liệu chính thức)](https://app.aqbot.top/guide/providers)
- [Tải xuống](https://github.com/AQBot-Desktop/AQBot/releases)
