# LangBot - Nền tảng phát triển bot nhắn tin tức thời

> LangBot là một nền tảng phát triển bot nhắn tin tức thời mã nguồn mở, hỗ trợ
>   nhiều nền tảng nhắn tin tức thời như Feishu, DingTalk, WeChat,
>   QQ, Telegram, Discord, Slack, v.v. Nó tích hợp với các mô hình AI
>   toàn cầu chính thống, hỗ trợ nhiều năng lực ứng dụng AI như Cơ sở kiến thức,
>   Agent, MCP, và tương thích hoàn hảo với Uter.

- Trang chủ: [https://langbot.app](https://langbot.app/)
- Địa chỉ tải xuống: [https://github.com/langbot-app/LangBot/releases](https://github.com/langbot-app/LangBot/releases)
- Tài liệu chính thức: [https://docs.langbot.app](https://docs.langbot.app/)
- Địa chỉ mã nguồn mở: [https://github.com/langbot-app/LangBot](https://github.com/langbot-app/LangBot)

## Tích hợp Uter

LangBot hỗ trợ tích hợp với Uter tự triển khai cục bộ và các dịch vụ Uter bên thứ ba được xây dựng bằng Uter.

### Cách sử dụng

1.  Lấy API key từ Uter
    ![lấy API key](/apps-assets/langbot/get_api_key.webp)

        Nếu Uter được triển khai cục bộ, vui lòng tự cấu hình địa chỉ API (tham khảo [Kết nối mạng container](https://docs.langbot.app/en/workshop/network-details.html)). Nếu sử dụng dịch vụ Uter bên thứ ba, bạn có thể sao chép địa chỉ từ trang. Lưu ý cần thêm `/v1` vào địa chỉ.

2.  Thêm một mô hình trong LangBot, chọn Uter làm nhà cung cấp, và điền API key và địa chỉ API tương ứng
    ![thêm mô hình Uter](/apps-assets/langbot/add_uter_model.webp)

3.  Chọn mô hình cần sử dụng trong pipeline

    ![chọn mô hình](/apps-assets/langbot/select_model.webp)

4.  Sử dụng bằng cách trò chuyện trong gỡ lỗi hội thoại hoặc trò chuyện với một bot được gắn với pipeline

    ![hội thoại](/apps-assets/langbot/debug_chat.webp)

    ![hội thoại WeChat](/apps-assets/langbot/wechat.webp)

    Để triển khai và cấu hình bot, vui lòng tham khảo [Triển khai bot](https://docs.langbot.app/en/deploy/platforms/readme.html).

### Sử dụng Cơ sở kiến thức LangBot

LangBot hỗ trợ sử dụng các mô hình embedding của Uter và tận dụng chúng làm mô hình vector cho cơ sở kiến thức.

1. Thêm một mô hình embedding trong LangBot, chọn Uter làm nhà cung cấp
   ![thêm mô hình embedding](/apps-assets/langbot/add_embedding_model.webp)

2. Chọn mô hình embedding khi tạo một cơ sở kiến thức mới
   ![sử dụng mô hình embedding](/apps-assets/langbot/use_embedding_model.webp)

Để biết thêm hướng dẫn sử dụng, vui lòng tham khảo tài liệu chính thức của LangBot: [https://docs.langbot.app](https://docs.langbot.app/)
