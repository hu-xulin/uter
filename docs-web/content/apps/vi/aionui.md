# AionUi - Công cụ văn phòng máy tính để bàn mã nguồn mở miễn phí

> 🚀 AionUi là một công cụ văn phòng (Cowork) cục bộ, mã nguồn mở và miễn phí, hỗ trợ nhiều tác nhân AI như Gemini CLI, Claude Code, Codex, OpenCode, Qwen Code, Goose CLI, Auggie. Nó cung cấp giao diện GUI hoàn chỉnh và tính năng truy cập từ xa qua WebUI, đóng vai trò là giải pháp thay thế mã nguồn mở cho Cowork.

- Trang chủ: [https://www.aionui.com](https://www.aionui.com)
- Kho GitHub: [https://github.com/iOfficeAI/AionUi](https://github.com/iOfficeAI/AionUi)
- Liên kết tải xuống: [https://github.com/iOfficeAI/AionUi/releases](https://github.com/iOfficeAI/AionUi/releases)

![Logo AionUi](/apps-assets/aionui/aionui-logo.webp)

## Tính năng cốt lõi

### 💬 Trò chuyện đa phiên

- **Đa phiên + Ngữ cảnh độc lập** - Cho phép mở nhiều phiên trò chuyện đồng thời, mỗi phiên có bộ nhớ ngữ cảnh độc lập riêng.
- **Lưu trữ cục bộ** - Tất cả dữ liệu hội thoại được lưu trữ cục bộ trong cơ sở dữ liệu SQLite và sẽ không bị mất.

### 🤖 Hỗ trợ đa mô hình

- **Hỗ trợ đa nền tảng** - Hỗ trợ các mô hình phổ biến như Gemini, OpenAI, Claude, Qwen, với khả năng chuyển đổi linh hoạt.
- **Hỗ trợ mô hình cục bộ** - Hỗ trợ triển khai mô hình cục bộ qua Ollama, LM Studio, v.v.

### 🤝 Chế độ đa tác nhân

- **Chạy nhiều tác nhân AI đồng thời** - Cho phép chạy nhiều tác nhân AI cùng lúc (ví dụ: Gemini CLI, Claude Code, Codex, OpenCode, Qwen Code, Goose CLI, Auggie, v.v.).
- **Quản lý MCP thống nhất** - Quản lý và cấu hình tất cả tác nhân thông qua Model Context Protocol (MCP), đơn giản hóa thao tác.
- **Cấu hình Skills** - Hỗ trợ cấu hình Skills riêng cho từng tác nhân để mở rộng năng lực.
- **Tùy chỉnh trợ lý** - Hỗ trợ cấu hình trợ lý tùy chỉnh để tạo quy trình làm việc AI cá nhân hóa.
- **Cấu hình độc lập** - Mỗi tác nhân có thể được cấu hình và sử dụng độc lập mà không bị can thiệp.
- **Chuyển đổi linh hoạt** - Chuyển đổi liền mạch giữa các tác nhân khác nhau để đáp ứng các yêu cầu kịch bản khác nhau.

### 🗂️ Quản lý tệp

- **Duyệt cây tệp + Kéo thả tải lên** - Duyệt tệp như một thư mục, hỗ trợ kéo thả tệp hoặc thư mục để nhập chỉ với một cú nhấp.
- **Tổ chức thông minh** - AI có thể giúp sắp xếp thư mục và tự động phân loại chúng.

### 📄 Bảng xem trước

- **Xem trước 9+ định dạng** - Hỗ trợ các định dạng như PDF, Word, Excel, PPT, mã, Markdown, hình ảnh, v.v.
- **Theo dõi thời gian thực + Có thể chỉnh sửa** - Tự động theo dõi thay đổi tệp, hỗ trợ chỉnh sửa và gỡ lỗi thời gian thực cho Markdown, mã, HTML.

### 🎨 Tạo và chỉnh sửa hình ảnh AI

- **Tạo hình ảnh thông minh** - Hỗ trợ nhiều mô hình tạo hình ảnh như Gemini 2.5 Flash Image Preview, Nano, Banana, v.v.
- **Nhận diện và chỉnh sửa hình ảnh** - Các tính năng phân tích và chỉnh sửa hình ảnh được hỗ trợ bởi AI.

### 🌐 Truy cập đa kênh

- **Truy cập từ xa WebUI** - Có thể truy cập qua trình duyệt từ bất kỳ thiết bị nào trong mạng, hỗ trợ thiết bị di động.
- **Tích hợp Telegram** - Hỗ trợ tương tác qua bot Telegram.
- **Tích hợp Feishu** - Hỗ trợ truy cập và tương tác qua Feishu.
- **Bảo mật dữ liệu cục bộ** - Tất cả dữ liệu được lưu trữ trong cơ sở dữ liệu SQLite cục bộ, phù hợp để triển khai trên máy chủ.

## Phương thức tích hợp Uter

### Nhập tham số

Provider Type: Các loại được Uter hỗ trợ
API Key: Lấy từ Uter
API Address: Địa chỉ trang Uter (ví dụ: `https://<your-uter-domain>/v1`)

Vui lòng sử dụng Uter tự triển khai của bạn, hoặc đảm bảo rằng nhà cung cấp dịch vụ cung cấp dịch vụ Uter với ủy quyền upstream hợp pháp và các nghĩa vụ tuân thủ. Không kết nối địa chỉ API hoặc khóa từ nguồn không xác định vào môi trường sản xuất.

### Các bước cấu hình

1.  **Sao chép API key trong Uter**
    ![Sao chép API Key](/apps-assets/aionui/copy_apikey.webp)

2.  **Mở Cài đặt AionUi**
    - Truy cập trang cài đặt trong AionUi
    - Tìm tab Cấu hình mô hình
    - Nhấn "Add Model"
    ![Mở Cài đặt](/apps-assets/aionui/add-model-1.webp)

3.  **Thêm nhà cung cấp mới**
    - Nhấn "Add Model"
    - Chọn Uter
    ![Thêm nhà cung cấp Uter](/apps-assets/aionui/newapi_provider.webp)

4.  **Cấu hình thông tin API**
    - API Address: Nhập địa chỉ trang Uter của bạn (định dạng: `https://<your-uter-domain>/v1`)
    - API Key: Dán API Key đã sao chép từ bảng điều khiển Uter

5.  **Thêm mô hình**
    - Chọn mô hình cần thêm từ menu thả xuống
    - Tên mô hình phải khớp với tên mô hình đã cấu hình trong Uter
    - Chọn giao thức yêu cầu phù hợp

6.  **Bắt đầu sử dụng**
    - Quay lại trang trò chuyện
    - Chọn mô hình Uter đã cấu hình để bắt đầu cuộc hội thoại

## Liên kết liên quan

- [Kho GitHub](https://github.com/iOfficeAI/AionUi)
- [Hướng dẫn sử dụng đầy đủ](https://github.com/iOfficeAI/AionUi#-detailed-usage-guide)
- [Câu hỏi thường gặp FAQ](https://github.com/iOfficeAI/AionUi#-support--help)
