# Chợ Mô hình và Bảng xếp hạng

## Chợ Mô hình

* Nhấp vào "Chợ Mô hình" ở góc trên bên phải hoặc truy cập `/pricing` để vào Chợ Mô hình. Trang hiển thị các mức giá công khai dành cho người dùng trên nền tảng, những mức giá này có thể khác với giá gốc từ các nhà cung cấp thượng nguồn.
* Chợ Mô hình dùng để duyệt các mô hình AI đang được bật trên nền tảng, so sánh nhà cung cấp, giá tính phí, hiệu năng và trạng thái vận hành của các mô hình khác nhau, giúp người dùng chọn mô hình phù hợp với tình huống nghiệp vụ của mình.

1. **Tìm kiếm mô hình**: Hỗ trợ tìm nhanh mô hình mục tiêu dựa trên tên mô hình, nhà cung cấp, điểm cuối hoặc thẻ.
2. **Lọc mô hình**: Hỗ trợ lọc mô hình theo các điều kiện như Nhóm, nhà cung cấp, loại mô hình và thẻ, đồng thời có thể đặt lại toàn bộ điều kiện lọc.
3. **Xem giá**: Hiển thị giá đầu vào, đầu ra và cache của mô hình, đồng thời chỉ ra các phương thức tính phí như trả theo mức sử dụng.
4. **Chuyển đổi bảng giá**: Hỗ trợ chuyển đổi giữa giá tiêu chuẩn và giá nạp tiền, cho phép xem giá trên mỗi 1M Token hoặc mỗi 1K Token.
5. **Sắp xếp mô hình**: Hỗ trợ điều chỉnh thứ tự hiển thị của mô hình dựa trên các điều kiện như tên mô hình.
6. **Chế độ hiển thị**: Hỗ trợ chuyển đổi giữa chế độ lưới và chế độ danh sách.
7. **Thông tin hiệu năng**: Hiển thị độ trễ, thông lượng và trạng thái vận hành hiện tại của mô hình, thuận tiện cho việc đánh giá tính sẵn có và khả năng đáp ứng của mô hình.
8. **Chi tiết mô hình**: Nhấn "Chi tiết" để xem phần giới thiệu đầy đủ, năng lực và thông tin cấu hình liên quan của mô hình.
9. **Sao chép tên mô hình**: Nhấn nút sao chép để nhanh chóng sao chép tên mô hình, thuận tiện khi dùng trong lời gọi API hoặc cấu hình hệ thống.

<img alt="Trang chợ mô hình" src="01-model-marketplace.webp" />

## Bảng xếp hạng

* Nhấp vào "Bảng xếp hạng" ở góc trên bên phải hoặc truy cập `/rankings` để vào Bảng xếp hạng.
* Bảng xếp hạng dùng để xem thứ hạng và xu hướng sử dụng của các mô hình và nhà cung cấp trên nền tảng, với dữ liệu được cập nhật theo thời gian thực dựa trên mức sử dụng token.

1. **Chuyển đổi khoảng thời gian**: Hỗ trợ xem dữ liệu xếp hạng theo các khoảng thời gian khác nhau: Hôm nay, Tuần này, Tháng này và Năm này.
2. **Mô hình phổ biến**: Hiển thị mức sử dụng token hằng ngày của từng mô hình qua biểu đồ, thuận tiện cho việc so sánh độ phổ biến của các mô hình.
3. **Bảng xếp hạng LLM**: Hiển thị các mô hình phổ biến nhất trên nền tảng cùng thứ hạng của chúng dựa trên mức sử dụng token.
4. **Thị phần**: Hiển thị tỷ lệ mức sử dụng token của các nhà cung cấp mô hình khác nhau và biến động hằng ngày.
5. **Xếp hạng nhà cung cấp mô hình**: Xếp hạng các nhà cung cấp mô hình dựa trên tổng mức sử dụng token, thuận tiện cho việc hiểu quy mô sử dụng của từng nhà cung cấp.
6. **Xu hướng tăng**: Hiển thị các mô hình có thứ hạng tăng lên cùng mức thay đổi của thứ hạng.
7. **Xu hướng giảm**: Hiển thị các mô hình có thứ hạng giảm cùng mức thay đổi của thứ hạng.

<img alt="Trang bảng xếp hạng" src="02-leaderboard.webp" />

<Callout type="info">
  Root (quản trị viên hệ thống) có thể cấu hình trạng thái hiển thị và quyền truy cập của "Chợ Mô hình" và "Bảng xếp hạng" trong thanh điều hướng trên cùng.
</Callout>
