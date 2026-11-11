# Memoh - Nền tảng tác nhân AI đóng gói trong container

> Memoh là một nền tảng tác nhân AI tự lưu trữ, mã nguồn mở, nơi mỗi bot chạy trong
>   container riêng biệt của nó với bộ nhớ bền vững và hệ thống tệp chuyên dụng.
>   Nó hỗ trợ 9 kênh bao gồm Telegram, Discord, Lark (Feishu), QQ, Matrix,
>   WeCom, WeChat, Email và một Web UI tích hợp sẵn, cùng với gọi công cụ MCP,
>   tự động hóa trình duyệt, tác vụ lập lịch và nhiều năng lực tác nhân phong phú khác.

- Trang web: [https://memoh.sh](https://memoh.sh)
- Tài liệu: [https://docs.memoh.ai](https://docs.memoh.ai)
- GitHub: [https://github.com/memohai/Memoh](https://github.com/memohai/Memoh)

## Tính năng chính

- **Cách ly bằng container**: Mỗi bot chạy trong container containerd riêng với hệ thống tệp và mạng chuyên dụng, hỗ trợ snapshot và nhập/xuất dữ liệu
- **Công cụ bộ nhớ**: Trích xuất sự thật dựa trên LLM, truy xuất kết hợp (dense + sparse + BM25), tải ngữ cảnh 24 giờ, nén và xây dựng lại bộ nhớ
- **Hỗ trợ đa kênh**: Telegram, Discord, Lark (Feishu), QQ, Matrix, WeCom, WeChat, Email, Web UI
- **Hỗ trợ MCP**: Hỗ trợ đầy đủ giao thức MCP (HTTP / SSE / Stdio / OAuth), với quản lý kết nối MCP độc lập cho từng bot
- **Tự động hóa trình duyệt**: Trình duyệt không giao diện tích hợp sẵn được hỗ trợ bởi Playwright, hỗ trợ duyệt web, điền biểu mẫu, chụp màn hình và hơn thế nữa
- **Bảng điều khiển web**: Giao diện quản lý hiện đại được xây dựng bằng Vue 3 + Tailwind CSS, với trò chuyện streaming, trực quan hóa lời gọi công cụ, quản lý tệp và hơn thế nữa

## Cài đặt nhanh

Memoh được triển khai qua Docker. Cài đặt một cú nhấp (yêu cầu Docker):

```bash
curl -fsSL https://memoh.sh | sudo sh
```

Hoặc cài đặt thủ công:

```bash
git clone --depth 1 https://github.com/memohai/Memoh.git
cd Memoh
cp conf/app.docker.toml config.toml
# Chỉnh sửa tệp cấu hình config.toml
sudo docker compose up -d
```

Sau khi khởi động, truy cập `http://localhost:8082`. Thông tin đăng nhập mặc định: `admin` / `admin123`.

## Tích hợp Uter

Memoh hỗ trợ mọi nhà cung cấp mô hình tương thích OpenAI, cho phép bạn sử dụng Uter để quản lý tập trung và truy cập nhiều dịch vụ mô hình AI.

### Các bước cấu hình

#### Lấy API Key của Uter

Sau khi đăng ký và đăng nhập Uter, nhấn "Console" trên thanh điều hướng trên cùng, sau đó nhấn "Token Management", và nhấn nút "Add Token" để tạo một Key uter. Chọn quyền hạn phù hợp và nhấn "Create".

Khi đã tạo, nhấn nút sao chép để sao chép API Key đã tạo.

![sao-chép-api-key](/apps-assets/memoh/copy_api_key.webp)

#### Thêm nhà cung cấp mô hình trong Memoh

Đăng nhập vào bảng điều khiển web Memoh, đi tới trang quản lý nhà cung cấp, và nhấn Uter.

![chuyển-sang-nhà-cung-cấp-uter](/apps-assets/memoh/switch_to_newapi_provider.webp)

Điền các thông tin sau trên trang cấu hình:

- **API Base URL**: Nhập URL điểm cuối Uter, ví dụ `https://api.example.com/v1` (dùng `http://localhost:3000/v1` cho triển khai cục bộ)
- **API Key**: Dán API Key đã sao chép từ Uter

Nhấn Save để hoàn tất cấu hình nhà cung cấp.

#### Nhập mô hình

Sau khi cấu hình nhà cung cấp, đi tới trang quản lý mô hình và nhấn tự động nhập hoặc thêm thủ công các mô hình bạn cần.

#### Cấu hình mô hình cho bot của bạn

Đi tới trang cài đặt bot, tìm phần cấu hình mô hình, chuyển mô hình trò chuyện mặc định sang mô hình đã thêm qua nhà cung cấp Uter, và nhấn Save.

![đặt_mô_hình_trò_chuyện](/apps-assets/memoh/set_chat_model.webp)

Bạn đã cấu hình thành công Uter làm nhà cung cấp mô hình cho Memoh. Bạn có thể trò chuyện với các bot AI qua bất kỳ kênh nào của Memoh (Telegram, Discord, Lark, v.v.), và tất cả yêu cầu sẽ được định tuyến qua Uter.
