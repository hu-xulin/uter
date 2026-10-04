# AstrBot - Chatbot tác nhân

> AstrBot là một nền tảng chatbot tác nhân mã nguồn mở, tất cả trong một, tích hợp liền mạch năng lực của các mô hình ngôn ngữ lớn vào phần mềm nhắn tin tức thời phổ biến như QQ, Feishu, DingTalk và WeChat Work, tạo ra một cơ sở hạ tầng trò chuyện AI đáng tin cậy và có khả năng mở rộng cho cá nhân, nhà phát triển và đội ngũ. Dù là bạn đồng hành AI cá nhân, dịch vụ khách hàng thông minh, trợ lý tự động hóa hay cơ sở kiến thức doanh nghiệp, AstrBot đều có thể nhanh chóng xây dựng các ứng dụng AI sẵn sàng sản xuất trong quy trình làm việc của nền tảng nhắn tin tức thời của bạn.

- Trang chủ: [https://astrbot.app](https://astrbot.app)
- Tài liệu chính thức: [https://docs.astrbot.app](https://docs.astrbot.app)
- Trang dự án: [https://github.com/astrbotdevs/astrbot](https://github.com/astrbotdevs/astrbot)

## Phương thức tích hợp Uter

AstrBot hỗ trợ tích hợp Uter như một nhà cung cấp mô hình, cho phép người dùng truy cập và sử dụng nhiều dịch vụ mô hình AI thông qua Uter.

### Các bước cấu hình

#### Lấy API Key của Uter

Sau khi đăng ký và đăng nhập Uter, nhấn 'Console' trên thanh điều hướng trên cùng, sau đó nhấn 'Token Management', rồi nhấn nút 'Add Token' để tạo một Key uter. Chọn quyền hạn phù hợp và nhấn 'Create'.

![tạo-api-key](/apps-assets/astrbot/image.webp)

Sau khi tạo thành công, nhấn nút 'Copy Key' để sao chép API Key đã tạo.

![sao-chép-api-key](/apps-assets/astrbot/image-1.webp)

#### Cấu hình nhà cung cấp dịch vụ Uter trong AstrBot

Mở bảng quản trị AstrBot, đi tới trang 'Model Providers', sau đó nhấn nút 'Add Model Provider'.

Uter hỗ trợ hoàn hảo các giao diện OpenAI Chat Completion và Responses. Nhấn 'OpenAI' để vào trang cấu hình nhà cung cấp OpenAI.

Trong hộp thoại bật lên, đặt API Base URL thành địa chỉ giao diện Uter. Vui lòng sử dụng Uter do chính bạn triển khai, hoặc đảm bảo rằng nhà cung cấp dịch vụ có ủy quyền upstream hợp pháp và các nghĩa vụ tuân thủ cho dịch vụ Uter. Nếu bạn đã triển khai Uter cục bộ, hãy điền địa chỉ cục bộ, ví dụ `http://localhost:3000/v1`. Không kết nối địa chỉ API hoặc khóa từ nguồn không xác định vào môi trường sản xuất.

Sau đó, nhập API Key vào trường 'API Key' và nhấn nút 'Save'.

![cấu-hình-nhà-cung-cấp-astrbot](/apps-assets/astrbot/image-2.webp)

Sau đó nhấn 'Save' để hoàn tất cấu hình nhà cung cấp Uter.

#### Áp dụng nhà cung cấp dịch vụ

Đi tới trang 'Configuration File', tìm phần 'Model', đổi 'Default Chat Model' thành nhà cung cấp Uter bạn vừa tạo, và nhấn nút 'Save'.

![áp-dụng](/apps-assets/astrbot/image-3.webp)

Lúc này, bạn đã cấu hình thành công Uter làm nhà cung cấp mô hình cho AstrBot. Giờ đây, bạn có thể truy cập và sử dụng các dịch vụ mô hình AI mà Uter cung cấp thông qua AstrBot.
