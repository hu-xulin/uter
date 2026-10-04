# Khóa API

Nhấp vào 'Khóa API' ở thanh điều hướng bên trái, hoặc trực tiếp truy cập `/keys`. Trang hiển thị các thông tin như tên khóa, khóa đã che, trạng thái bật, mức sử dụng hạn mức và nhóm, đồng thời hỗ trợ lọc, sao chép, chỉnh sửa, bật/tắt và xóa hàng loạt. Menu của từng hàng còn cho phép sao chép thông tin kết nối, mở các preset trò chuyện do quản trị viên cấu hình, và gửi khóa đến các tích hợp client được hỗ trợ.

<img alt="Trang thông tin khóa API" src="01-keys-info.webp" />

## Tạo khóa API

1. Mở 'Khóa API' và nhấn 'Tạo khóa API'.
2. Nhập tên khóa để dễ dàng phân biệt các ứng dụng hoặc môi trường.
3. Đặt hạn mức, thời hạn hết hạn, hạn chế mô hình, hạn chế IP và nhóm theo nhu cầu.
4. Sau khi lưu, xem và sao chép khóa đầy đủ từ danh sách.

<img alt="Trang tạo khóa API" src="02-create-key.webp" />

### Mô tả các mục cấu hình

| Thiết lập                      | Chức năng                                                                                                                                                                                          |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tên                           | Tên khóa API (khuyến nghị đặt tên theo mục đích, ví dụ "Môi trường Production", "Dùng để kiểm thử")                                   |
| Nhóm                          | Chỉ định nhóm kênh được token này sử dụng                                                                                                                                                        |
| Thứ tự nhóm tự động           | Chỉ hiển thị khi nhóm là `auto`; có thể kế thừa thứ tự toàn cục của Root, hoặc đặt thứ tự ở cấp khóa                                                |
| Công tắc thử lại đa nhóm      | Khi được bật, nếu kênh của nhóm hiện tại thất bại, hệ thống sẽ thử kênh của nhóm tiếp theo theo thứ tự                                   |
| Thời hạn hết hạn             | Từ chối sử dụng khóa này sau khi hết hạn                                                                                                                                                           |
| Số lượng                      | Có thể tạo nhiều khóa API cùng lúc (một hậu tố ngẫu nhiên sẽ được thêm vào tên)                                                         |
| Hạn mức                      | Giới hạn số hạn mức mà khóa này có thể tiêu thụ                                                                                                                                                     |
| Công tắc hạn mức không giới hạn | Bật hạn mức không giới hạn cho khóa API này khi được bật                                                                                                                                       |
| Hạn chế mô hình               | Giới hạn token này chỉ được gọi các mô hình đã chỉ định; để trống nghĩa là không có hạn chế                                             |
| Danh sách IP cho phép          | Hỗ trợ nhập IP hoặc CIDR theo từng dòng; để trống nghĩa là không có hạn chế; nên dùng cùng với proxy đảo chiều/CDN đáng tin cậy |

<Callout type="warn">
  Khóa API tương đương với mật khẩu. Không gửi toàn bộ khóa vào kho mã nguồn, ảnh chụp màn hình, nhật ký hoặc công cụ trò chuyện; nếu bạn nghi ngờ bị rò rỉ, hãy xóa ngay lập tức và tạo khóa mới.
</Callout>

## Xem và sao chép khóa API

Trong danh sách khóa API, nhấp vào khóa đã che để xem và sao chép giá trị đầy đủ theo hướng dẫn trên trang. Khóa đầy đủ là thông tin xác thực nhạy cảm và việc xem có thể yêu cầu xác minh bảo mật bổ sung.

'Sao chép thông tin kết nối' sẽ sao chép khóa và địa chỉ nền tảng dưới dạng thông tin nhập cho ứng dụng; nhấp vào ứng dụng trò chuyện preset mục tiêu trong mục 'Trò chuyện' ở thanh bên trái, trình duyệt sẽ cố gắng mở ứng dụng trò chuyện đã cài đặt và tự động chuyển đến để điền thông tin cấu hình.

<img alt="Trang xem khóa API" src="03-view-key.webp" />

## Chỉnh sửa khóa API

Trong danh sách khóa API, tìm khóa cần xử lý, nhấn nút 'Chỉnh sửa' ở bên phải để thay đổi các tùy chọn cấu hình của khóa (không bao gồm bản thân khóa API).

<img alt="Trang chỉnh sửa khóa API" src="04-edit-key.webp" />

## Bật, tắt và xóa khóa API

Bạn có thể bật, tắt hoặc xóa khóa trong thao tác trên từng hàng của danh sách; có thể chọn nhiều hàng để xóa hàng loạt. Việc tắt sẽ giữ lại cấu hình và ngừng gọi, còn việc xóa là không thể hoàn tác.

<img alt="Trang xóa khóa API" src="05-delete-key.webp" />

<Callout type="warn">
  Sau khi xác nhận xóa, khóa API sẽ mất hiệu lực ngay lập tức và không thể khôi phục. Trước khi xóa, vui lòng kiểm tra lại khóa đã chọn để tránh nhầm lẫn xóa khóa production.
</Callout>
