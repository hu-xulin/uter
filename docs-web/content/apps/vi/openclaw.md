# OpenClaw - Nền tảng trợ lý AI tự lưu trữ

> **Giới thiệu dự án**
>
> OpenClaw là một nền tảng trợ lý AI cá nhân tự lưu trữ, mã nguồn mở, kết nối
>   các ứng dụng nhắn tin với các tác nhân AI chạy trên phần cứng của chính bạn.
>   Được thiết kế cho nhà phát triển và người dùng nâng cao, nó cho phép bạn có một
>   trợ lý AI tự chủ mà không phải từ bỏ quyền kiểm soát dữ liệu của mình.
>
>   - Trang chủ chính thức: [https://openclaw.ai](https://openclaw.ai)
>   - Tài liệu dự án: [https://docs.openclaw.ai](https://docs.openclaw.ai)
>   - GitHub: [https://github.com/openclaw/openclaw](https://github.com/openclaw/openclaw)

OpenClaw hoàn toàn là mã nguồn mở. Bạn có thể duyệt mã nguồn, gửi issue hoặc đóng góp trên [kho GitHub của OpenClaw](https://github.com/openclaw/openclaw). Hướng dẫn này bao gồm các bước đầy đủ để cài đặt, cấu hình và tích hợp OpenClaw với Uter.

## 🌟 Tính năng cốt lõi

### Tích hợp đa kênh

- **Tích hợp đa kênh**: Hỗ trợ nhiều kênh nhắn tin như Telegram, Discord, WhatsApp, iMessage, và có thể mở rộng sang nhiều nền tảng hơn qua plugin.
- **Cổng đơn**: Quản lý thống nhất tất cả kênh thông qua một tiến trình Gateway duy nhất.
- **Hỗ trợ giọng nói**: Hỗ trợ tương tác giọng nói trên macOS/iOS/Android.
- **Giao diện Canvas**: Có thể hiển thị các giao diện Canvas tương tác.

### Tự lưu trữ và bảo mật dữ liệu

- **Tự lưu trữ hoàn toàn**: Chạy trên máy hoặc máy chủ của riêng bạn.
- **Minh bạch mã nguồn mở**: Giấy phép mã nguồn mở MIT, mã nguồn hoàn toàn minh bạch.
- **Dữ liệu cục bộ**: Ngữ cảnh và kỹ năng được lưu trên máy tính cục bộ của bạn, không phải trên đám mây.

### Năng lực tác nhân thông minh

- **Hoạt động liên tục**: Hỗ trợ hoạt động nền bền vững với bộ nhớ dài hạn.
- **Tác vụ lập lịch**: Hỗ trợ tác vụ lập lịch cron.
- **Cách ly phiên**: Cách ly phiên theo tác nhân/workspace/người gửi.
- **Định tuyến đa tác nhân**: Hỗ trợ làm việc cộng tác giữa nhiều tác nhân.
- **Gọi công cụ**: Hỗ trợ nguyên sinh cho việc gọi công cụ và thực thi mã.

## 📦 Chuẩn bị trước khi tích hợp

> **Thông tin chuẩn bị**
>
> - Node.js 22 trở lên
>   - Một địa chỉ Uter khả dụng (thường kết thúc bằng `/v1`)
>   - Một API Key Uter khả dụng
>   - Vui lòng sử dụng Uter do chính bạn triển khai, hoặc xác nhận rằng nhà cung cấp dịch vụ có ủy quyền upstream hợp pháp và các nghĩa vụ tuân thủ cho dịch vụ Uter của họ. Không kết nối địa chỉ API hoặc khóa không xác định vào môi trường sản xuất.

Trước khi tích hợp Uter, khuyên bạn nên chạy thử Gateway và Control UI theo quy trình khuyến nghị hiện tại của OpenClaw. Việc này giúp dễ dàng phân biệt sau này là OpenClaw tự nó không khởi chạy hay là cấu hình nhà cung cấp mô hình bị sai khi gỡ lỗi.

### 1. Cài đặt OpenClaw (macOS/Linux)

```bash
curl -fsSL https://openclaw.ai/install.sh | bash
```

Để biết các phương thức cài đặt khác, tham khảo tài liệu chính thức của OpenClaw: [Bắt đầu](https://docs.openclaw.ai/start/getting-started).

### 2. Chạy trình hướng dẫn khởi tạo

```bash
openclaw onboard --install-daemon
```

Trình hướng dẫn này sẽ hoàn tất xác thực cơ bản, thiết lập Gateway và khởi tạo kênh tùy chọn. Mục tiêu ở đây là để OpenClaw chạy trước, sau đó chuyển mô hình mặc định sang Uter sau.

### 3. Kiểm tra Gateway và Control UI

```bash
openclaw gateway status
```

```bash
openclaw dashboard
```

Nếu trình duyệt có thể mở Control UI, nghĩa là hoạt động cơ bản của OpenClaw bình thường. Ở giai đoạn này, chưa cần cấu hình Telegram, Discord, Feishu hay các kênh nhắn tin khác.

### 4. Định vị tệp cấu hình

Tệp cấu hình của OpenClaw thường nằm tại `~/.openclaw/openclaw.json`. Bạn có thể tiếp tục chỉnh sửa dựa trên những gì trình hướng dẫn khởi tạo đã tạo ra.

> **Biến môi trường liên quan đến đường dẫn**
>
> Nếu bạn chạy OpenClaw dưới một tài khoản dịch vụ chuyên dụng, hoặc muốn tùy chỉnh thư mục cấu hình/trạng thái, bạn có thể sử dụng:
>
>   - `OPENCLAW_HOME`
>   - `OPENCLAW_STATE_DIR`
>   - `OPENCLAW_CONFIG_PATH`
>
>   Để biết hướng dẫn chi tiết, xem tài liệu biến môi trường chính thức: [Biến môi trường](https://docs.openclaw.ai/help/environment).

## 🚀 Sử dụng Uter làm nhà cung cấp mô hình

OpenClaw hỗ trợ tích hợp các cổng mô hình tùy chỉnh hoặc tương thích OpenAI qua `models.providers`. Đối với Uter, cách tiếp cận phổ biến nhất là thêm nó như một nhà cung cấp tùy chỉnh vào cấu hình, sau đó trỏ mô hình mặc định đến `uter/model-ID`.

### Cách tiếp cận tích hợp

1. Khai báo một nhà cung cấp `uter` dưới `models.providers`.
2. Trỏ `baseUrl` đến địa chỉ Uter của bạn, đảm bảo bao gồm `/v1`.
3. Đặt `api` thành `openai-completions`.
4. Liệt kê các ID mô hình bạn muốn OpenClaw sử dụng trong `models`.
5. Chuyển mô hình mặc định trong `agents.defaults.model.primary` thành `uter/...`.

### Thực hành khuyên dùng: Lưu API Key vào biến môi trường

Đầu tiên, cung cấp key Uter của bạn trong shell hiện tại, môi trường dịch vụ, hoặc một tệp `.env` mà OpenClaw có thể đọc:

```bash
export UTER_API_KEY="sk-your-uter-key"
```

Sau đó, thêm hoặc sửa đổi đoạn mã sau trong `openclaw.json`:

```json5
{
  models: {
    mode: "merge",
    providers: {
      uter: {
        baseUrl: "https://<your-uter-domain>/v1",
        apiKey: "${UTER_API_KEY}",
        api: "openai-completions",
        models: [
          { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash" },
          { id: "kimi-k2.5", name: "Kimi K2.5" },
        ],
      },
    },
  },

  agents: {
    defaults: {
      model: {
        primary: "uter/gemini-2.5-flash",
        fallbacks: ["uter/kimi-k2.5"],
      },
      models: {
        "uter/gemini-2.5-flash": { alias: "flash" },
        "uter/kimi-k2.5": { alias: "kimi" },
      },
    },
  },
}
```

Đây không phải là một cấu hình hoàn chỉnh cần sao chép chính xác, mà là phần quan trọng nhất để tích hợp Uter. Miễn là `provider`, ID mô hình và tham chiếu mô hình mặc định là đúng, OpenClaw sẽ có thể gọi các tài nguyên mô hình bạn đã hiển thị qua Uter.

### Chi tiết cấu hình chính

| Mục cấu hình | Mô tả |
| --- | --- |
| `models.mode` | Khuyên đặt thành `merge`, thêm `uter` trong khi giữ lại các nhà cung cấp tích hợp sẵn của OpenClaw |
| `models.providers.uter.baseUrl` | Địa chỉ Uter của bạn, thường cần bao gồm `/v1` |
| `models.providers.uter.apiKey` | Key Uter, khuyên tiêm qua `${UTER_API_KEY}` |
| `models.providers.uter.api` | Với các cổng tương thích OpenAI như Uter, dùng `openai-completions` |
| `models.providers.uter.models` | Các ID mô hình được liệt kê ở đây phải khớp với tên mô hình thực tế mà Uter của bạn hiển thị |
| `agents.defaults.model.primary` | Mô hình chính mặc định, định dạng phải là `provider/model-id` |
| `agents.defaults.model.fallbacks` | Danh sách mô hình dự phòng, tự động chuyển đổi nếu mô hình chính thất bại |
| `agents.defaults.models` | Tùy chọn, dùng để tạo bí danh cho mô hình, tiện lợi khi tham chiếu trong UI hoặc phiên |

### Xác minh tích hợp thành công

Sau khi hoàn tất cấu hình, quay lại Control UI hoặc mở lại nó:

```bash
openclaw dashboard
```

Nếu bạn có thể bắt đầu hội thoại bình thường trong OpenClaw và mô hình mặc định đã trở thành `uter/...`, thì tích hợp thành công. Bạn cũng có thể dùng:

```bash
openclaw models list
```

để xác nhận rằng các mô hình có tiền tố `uter/` xuất hiện trong danh sách có thể chọn.

### Các vấn đề thường gặp

- `baseUrl` thiếu `/v1`: Đây là một trong những lỗi tích hợp phổ biến nhất.
- ID mô hình không chính xác: `primary` và `fallbacks` phải tương ứng với `id` trong `models.providers.uter.models`.
- API key chỉ có hiệu lực trong terminal hiện tại: Nếu Gateway chạy như một dịch vụ nền, hãy đảm bảo tiến trình dịch vụ cũng có thể đọc `UTER_API_KEY`.
- Để gỡ lỗi tiền cảnh: Sử dụng phương thức chạy tiền cảnh chính thức `openclaw gateway --port 18789` để quan sát log và lỗi.
