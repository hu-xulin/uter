# Tích hợp ứng dụng trò chuyện

* Uter hỗ trợ nhập nhanh cấu hình vào nhiều ứng dụng trò chuyện AI khác nhau, giúp thuận tiện cho việc kiểm thử và sử dụng hằng ngày.

## Các phương thức tích hợp trò chuyện

* Uter cung cấp ba phương thức tích hợp trò chuyện:

1. **Nhập preset trò chuyện bằng một cú nhấp**
2. **Nhập cấu hình khóa API bằng một cú nhấp**
3. **Cấu hình ứng dụng trò chuyện thủ công**

### Chuẩn bị trước khi sử dụng

1. Đăng nhập vào Uter và tạo một khóa trên trang 'Khóa API'.
2. Đảm bảo khóa đã được bật, có đủ hạn mức, chưa hết hạn và các hạn chế về IP, nhóm, mô hình hiện tại cho phép lời gọi.

<Callout type="info">
  **Để biết các bước chi tiết về cách tạo và sử dụng khóa API, vui lòng tham khảo trang [Khóa API](../api-keys/).**
</Callout>

### Nhập preset trò chuyện bằng một cú nhấp

1. Nhấp vào 'Trò chuyện' ở thanh bên trái để mở rộng các preset trò chuyện do nền tảng cấu hình.
2. Nhấp vào preset trò chuyện mục tiêu.
3. Trình duyệt sẽ cố gắng mở ứng dụng bên ngoài đã cài đặt trong một cửa sổ mới.
4. Hệ thống tự động chuyển đến ứng dụng mục tiêu và điền thông tin cấu hình.

<img alt="Trang nhập cấu hình preset trò chuyện bằng một cú nhấp" src="01-chat-presets-configuration-import.webp" />

<Callout type="info">
  Người dùng Root có thể duy trì và quản lý preset trò chuyện trong 'Cài đặt hệ thống' → 'Nội dung bảng điều khiển' → 'Trò chuyện'.
</Callout>

### Nhập cấu hình khóa API bằng một cú nhấp

1. Nhấp để vào 'Khóa API' ở thanh bên trái.
2. Chọn khóa API cần sử dụng.
3. Bên cạnh khóa đã chọn, nhấp '...' → 'Trò chuyện' → 'Ứng dụng trò chuyện mục tiêu'.
4. Nhanh chóng chuyển đến ứng dụng tương ứng và dùng khóa đã chọn để nhập cấu hình bằng một cú nhấp.

<img alt="Trang nhập cấu hình khóa API bằng một cú nhấp" src="02-api-key-configuration-import.webp" />

### Cấu hình ứng dụng trò chuyện thủ công

Đối với các ứng dụng không hỗ trợ nhập bằng một cú nhấp, bạn có thể cấu hình thủ công:

* Thu thập các thông tin cấu hình sau từ Uter:

| Mục cấu hình         | Mô tả                        | Nơi lấy thông tin                                                              |
| -------------------- | ---------------------------- | ------------------------------------------------------------------------------- |
| API Base URL         | Địa chỉ điểm cuối API        | Địa chỉ Uter, ví dụ `https://api.example.com/v1`                               |
| Khóa API             | Khóa API                     | Trang Khóa API                                                                  |
| Mô hình khả dụng     | Danh sách mô hình được hỗ trợ | Lọc và xem các mô hình khả dụng thuộc nhóm của khóa trong Chợ Mô hình           |

* Các bước cấu hình chung

1. Trong ứng dụng mục tiêu, tìm mục 'Cài đặt' hoặc 'Cấu hình'.
2. Xác định khu vực cấu hình 'API tùy chỉnh' hoặc 'Giao diện tương thích OpenAI'.
3. Nhập API Base URL và Khóa API.
4. Lưu cấu hình để bắt đầu sử dụng.

<Callout type="info">
  1) Phần lớn các ứng dụng hỗ trợ giao diện tương thích API OpenAI có thể tích hợp với Uter bằng cách nhập địa chỉ API tùy chỉnh.
  2) Nếu ứng dụng yêu cầu một điểm cuối đầy đủ, hãy dùng `https://api.example.com/v1/chat/completions`; tham khảo hướng dẫn cấu hình riêng của ứng dụng để bổ sung phần đường dẫn.
  3) **Hầu hết các ứng dụng AI chính thống đều có thể kết nối thông qua API tùy chỉnh mô tả ở trên; hãy làm theo hướng dẫn cấu hình riêng của từng ứng dụng.**
</Callout>

## Câu hỏi thường gặp

* **Không có preset trò chuyện trong thanh bên**: Xác nhận rằng mô-đun 'Trò chuyện' đã được bật trong 'Hồ sơ' → 'Cài đặt thanh bên trái cá nhân'.
* **Thông báo không có khóa khả dụng**: Hãy tạo hoặc bật một khóa API, đồng thời kiểm tra hạn mức, thời hạn hết hạn, hạn chế mô hình và danh sách IP cho phép.
* **Ứng dụng máy tính không mở**: Trước tiên, hãy cài đặt ứng dụng mục tiêu và xác nhận rằng hệ điều hành đã đăng ký giao thức tùy chỉnh tương ứng; trình duyệt cũng có thể yêu cầu xác nhận để mở ứng dụng bên ngoài.
* **Preset web bị trống hoặc từ chối tải**: Trang web mục tiêu có thể cấm iframe thông qua CSP hoặc `X-Frame-Options`. Trong trường hợp này, hãy chuyển sang cấu hình thủ công cho ứng dụng đó.
* **Khóa FluentRead không hợp lệ sau khi kết nối**: Xác nhận rằng tiện ích mở rộng đã được cài đặt và đang hoạt động trên trang hiện tại; phiên bản hiện tại có thể có khác biệt về khả năng tương thích với tiền tố khóa, nếu vẫn lỗi, hãy chuyển sang cấu hình thủ công hoặc một preset khác.
* **Yêu cầu trả về lỗi không được phép truy cập hoặc bị từ chối**: Kiểm tra định dạng header xác thực, tên mô hình, trạng thái khóa, quyền của nhóm và hạn chế IP; với các yêu cầu Claude và Gemini, cũng cần xác nhận rằng đã dùng đúng đường dẫn và header yêu cầu.
