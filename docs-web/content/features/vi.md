# Mô tả tính năng

1. 🎨 Giao diện UI hoàn toàn mới (một số giao diện vẫn chưa được cập nhật)
2. 🌍 Hỗ trợ đa ngôn ngữ (cần cải thiện)
3. 🎨 Đã thêm hỗ trợ API [Midjourney-Proxy(Plus)](https://github.com/novicezk/midjourney-proxy) (Trước khi sử dụng, vui lòng xác nhận ủy quyền dự án bên thứ ba và dịch vụ thượng nguồn, bảo mật nội dung và các yêu cầu điều khoản dịch vụ)
4. 💰 Hỗ trợ số dư nội bộ, phân bổ chi phí hoặc quản lý tài khoản khách hàng doanh nghiệp trong các triển khai được ủy quyền hợp pháp, có thể cấu hình trong cài đặt hệ thống:
   - [x] Epay
5. 🔍 Hỗ trợ truy vấn thông tin sử dụng hoặc số dư của các kênh được ủy quyền hợp pháp
6. 📑 Phân trang hỗ trợ chọn số lượng mục hiển thị trên mỗi trang
7. 🔄 Hỗ trợ lưu trữ cơ sở dữ liệu SQLite, sẵn sàng sử dụng, nhẹ và tiện lợi
8. 💵 Hỗ trợ kế toán chi phí nội bộ hoặc thanh toán khách hàng doanh nghiệp, có thể cấu hình trong Cài đặt hệ thống - Cài đặt vận hành
9. ⚖️ Hỗ trợ **Ngẫu nhiên có trọng số** cho kênh
10. 📈 Bảng điều khiển dữ liệu (Bảng điều khiển)
11. 🔒 Có thể thiết lập các mô hình mà một token có thể gọi
12. 🤖 Hỗ trợ đăng nhập được ủy quyền Telegram
13. 🎵 Đã thêm hỗ trợ API [Suno API](https://github.com/Suno-API/Suno-API) (Trước khi sử dụng, vui lòng xác nhận ủy quyền dự án bên thứ ba và dịch vụ thượng nguồn, bảo mật nội dung và các yêu cầu điều khoản dịch vụ)
14. 🔄 Hỗ trợ các mô hình Rerank, hiện tương thích với Cohere và Jina, và có thể tích hợp với Dify
15. ⚡ **[OpenAI Realtime API](https://platform.openai.com/docs/guides/realtime/integration)** - Hỗ trợ OpenAI Realtime API, hỗ trợ các kênh Azure
16. Hỗ trợ sử dụng tuyến đường /chat2link để vào giao diện trò chuyện
17. 🧠 Hỗ trợ thiết lập cường độ suy luận qua hậu tố tên mô hình:
    1. Các mô hình dòng OpenAI o
       - Thêm hậu tố `-high` để đặt thành cường độ suy luận cao (ví dụ: `o3-mini-high`)
       - Thêm hậu tố `-medium` để đặt thành cường độ suy luận trung bình (ví dụ: `o3-mini-medium`)
       - Thêm hậu tố `-low` để đặt thành cường độ suy luận thấp (ví dụ: `o3-mini-low`)
    2. Các mô hình suy luận Claude
       - Thêm hậu tố `-thinking` để bật chế độ suy luận (ví dụ: `claude-3-7-sonnet-20250219-thinking`)
18. 🔄 Thinking to Content: Hỗ trợ thiết lập tùy chọn `thinking_to_content` trong `Channel - Edit - Channel Extra Settings`. Mặc định là `false`. Khi được bật, nó sẽ chuyển đổi nội dung suy luận `reasoning_content` thành thẻ `<think>` và thêm vào nội dung trả về.
19. 🔄 Giới hạn tốc độ mô hình: Hỗ trợ thiết lập giới hạn tốc độ mô hình trong `System Settings - Rate Limit Settings`, bao gồm tổng giới hạn yêu cầu và giới hạn yêu cầu thành công.
20. 💰 Hỗ trợ thanh toán qua bộ nhớ đệm: Khi được bật, có thể thực hiện thanh toán theo tỷ lệ đã đặt khi truy cập bộ nhớ đệm thành công:
    1. Thiết lập tùy chọn `Prompt Cache Ratio` trong `System Settings - Operations Settings`.
    2. Thiết lập `Prompt Cache Ratio` trong kênh, phạm vi 0-1. Ví dụ, đặt thành 0.5 nghĩa là thanh toán với 50% khi truy cập bộ nhớ đệm thành công.
    3. Các kênh được hỗ trợ:
    - [x] OpenAI
    - [x] Azure
    - [x] DeepSeek
    - [x] Claude
