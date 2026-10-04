# Tổng quan và Bảng điều khiển

## Trang tổng quan

* Sau khi đăng nhập, nhấp vào nút "Tổng quan" ở thanh điều hướng bên trái để vào trang tổng quan `/dashboard/overview`.
  Bạn có thể xem các thẻ như Hướng dẫn bắt đầu nhanh, Mức sử dụng và Tình trạng hệ thống, Thông tin API, Thông báo, Câu hỏi thường gặp và Thời gian hoạt động.

### Hướng dẫn bắt đầu nhanh

1. Nhấn "Tạo khóa API" để đến `/keys`.
2. Nạp thêm hạn mức vào ví của bạn (nếu đã bật tính phí).
3. Mở khu thử nghiệm hoặc dùng client của bạn để gửi yêu cầu đầu tiên nhằm xác minh đường đi.

<img alt="Trang bắt đầu nhanh" src="01-overview-get-started.webp" />

### Mức sử dụng và Tình trạng hệ thống

Trang này tổng hợp các chỉ số như số dư, mức tiêu thụ, số lượng yêu cầu, tỷ lệ thành công, độ trễ và thông lượng, dựa trên dữ liệu tài khoản và phiên bản hiện tại.

<img alt="Trang thông tin tổng quan 1" src="02-overview-info-1.webp" />

### Thông tin API, Thông báo, Câu hỏi thường gặp và Thời gian hoạt động

Trang này hiển thị các thông tin như Thông tin API, Thông báo, Câu hỏi thường gặp và Thời gian hoạt động.

<img alt="Trang thông tin tổng quan 2" src="03-overview-info-2.webp" />

<Callout type="info">
  Các thẻ này được Root cấu hình trong "Cài đặt hệ thống" → "Nội dung bảng điều khiển".
</Callout>

## Bảng điều khiển

* Sau khi đăng nhập, nhấp vào nút "Bảng điều khiển" ở thanh điều hướng bên trái để vào trang bảng điều khiển `/dashboard/models`.
  Bạn có thể xem phân tích lượt gọi mô hình và phân tách lưu lượng; để xem thống kê người dùng, vui lòng đến `/dashboard/users` (chỉ dành cho quản trị viên Admin và Root).

### Phân tích lượt gọi mô hình

Xem số lượt gọi, mức sử dụng token, phân bổ mức tiêu thụ và các chỉ số hiệu năng theo khoảng thời gian, mô hình và nhóm.

<img alt="Trang thông tin bảng điều khiển dữ liệu 1" src="04-dashboard-info-1.webp" />

### Phân tách lưu lượng

Xem luồng yêu cầu giữa người dùng, khóa API, nhóm, mô hình và kênh.

<img alt="Trang thông tin bảng điều khiển dữ liệu 2" src="05-dashboard-info-2.webp" />

### Thống kê người dùng

Chỉ Admin và Root mới có thể truy cập `/dashboard/users` để xem phân tích người dùng; mục này sẽ không hiển thị trong phần điều hướng của người dùng thông thường.

<img alt="Trang thông tin bảng điều khiển dữ liệu 3" src="06-dashboard-info-3.webp" />
