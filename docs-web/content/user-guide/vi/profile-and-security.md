# Hồ sơ và Bảo mật

* Sau khi đăng nhập, nhấp vào nút "Hồ sơ" ở thanh điều hướng bên trái để truy cập trang hồ sơ `/profile`.
  Tại đây bạn có thể xem hoặc quản lý thông tin tài khoản, liên kết tài khoản, tùy chọn thông báo và hành vi, ngôn ngữ giao diện, thanh bên cá nhân, điểm danh, 2FA, Passkey, token truy cập và phiên đăng nhập.

## Xem thông tin tài khoản

Xem thông tin tài khoản, bao gồm tên, ID người dùng, số dư còn lại, tổng hạn mức đã tiêu thụ, số lượng yêu cầu API và các chi tiết khác.

<img alt="Trang thông tin tài khoản cá nhân" src="01-personal.webp" />

## Quản lý thông tin liên kết tài khoản

Quản lý thông tin liên kết tài khoản, bao gồm email và các tài khoản OAuth bên thứ ba.

* Liên kết Email

1. Trong khu vực cài đặt, tìm "Liên kết tài khoản" → "Email" → nhấn "Liên kết".
2. Nhập địa chỉ email bạn muốn liên kết.
3. Nhấn "Gửi" để nhận mã xác minh.
4. Nhập mã xác minh và nhấn "Liên kết Email".

<img alt="Trang liên kết Email" src="02-personal-link-email.webp" />

* Liên kết tài khoản OAuth bên thứ ba

1. Trong khu vực cài đặt, tìm "Liên kết tài khoản" → "Tài khoản OAuth bên thứ ba".
2. Nhấp vào nút "Liên kết" tương ứng với nền tảng OAuth bên thứ ba bạn muốn liên kết.
3. Trang sẽ chuyển hướng đến trang cấp quyền của nền tảng; đăng nhập và nhấn "Cấp quyền".
4. Sau khi cấp quyền hoàn tất, trang sẽ tự động chuyển hướng trở lại và trạng thái liên kết sẽ đổi thành "Đã liên kết".

<img alt="Trang liên kết tài khoản OAuth bên thứ ba" src="03-personal-link-OAuth.webp" />

## Thiết lập tùy chọn thông báo và hành vi

Trang này dùng để cấu hình phương thức thông báo của tài khoản và tùy chọn sử dụng hệ thống.

* Cài đặt thông báo

1. **Phương thức thông báo**: Hỗ trợ chọn Email, Webhook, Bark hoặc Gotify để nhận thông báo từ hệ thống.
2. **Ngưỡng cảnh báo số dư**: Đặt mức số dư cảnh báo; khi số dư tài khoản thấp hơn giá trị này, một thông báo sẽ được gửi đi.
3. **Email thông báo**: Chỉ định địa chỉ email để nhận thông báo; nếu để trống, email đã liên kết của tài khoản sẽ được dùng mặc định.
4. Nhập thông tin tương ứng, sau khi cấu hình xong, nhấn "Lưu cài đặt" để thay đổi có hiệu lực.

* Cài đặt tùy chọn hành vi

1. **Nhận thông báo cập nhật mô hình thượng nguồn**: Khi được bật, nếu quá trình kiểm tra mô hình theo lịch phát hiện thay đổi ở mô hình thượng nguồn hoặc kiểm tra thất bại, một thông báo tóm tắt sẽ được gửi qua phương thức thông báo đã chọn; tính năng này chỉ dành cho quản trị viên.
2. **Chấp nhận mô hình chưa định giá**: Khi được bật, cho phép sử dụng các mô hình chưa được cấu hình giá. (Không khuyến nghị)
3. **Ghi lại địa chỉ IP**: Khi được bật, ghi lại địa chỉ IP của người dùng gọi mô hình và thời điểm yêu cầu gặp lỗi.
4. Nhập thông tin tương ứng, sau khi cấu hình xong, nhấn "Lưu cài đặt" để thay đổi có hiệu lực.

<img alt="Trang tùy chọn thông báo và hành vi" src="04-personal-notification-behavior-preferences.webp" />

<Callout type="warn">
  Bật "Chấp nhận mô hình chưa định giá" có thể dẫn đến mức tiêu thụ cao ngoài dự kiến. Nên giữ nguyên cài đặt mặc định tắt của "Chấp nhận mô hình chưa định giá".
</Callout>

## Thiết lập tùy chọn ngôn ngữ giao diện

Bạn có thể đặt tùy chọn ngôn ngữ giao diện của mình, tùy chọn này sẽ được đồng bộ trên tất cả thiết bị đang đăng nhập bằng tài khoản này và sẽ ảnh hưởng đến ngôn ngữ thông báo lỗi API.

<img alt="Trang cài đặt tùy chọn ngôn ngữ giao diện" src="05-personal-language-preferences.webp" />

## Cài đặt thanh bên trái cá nhân để hiển thị theo nhu cầu

* Trang này dùng để tùy chỉnh các mô-đun chức năng hiển thị trên thanh bên trái. Người dùng có thể bật hoặc ẩn các mục tương ứng dựa trên thói quen sử dụng cá nhân.

<img alt="Trang cài đặt thanh bên trái cá nhân" src="06-personal-sidebar-settings.webp" />

<Callout type="info">
  Điều này chỉ thay đổi phần hiển thị điều hướng cá nhân, không cấp quyền mới và không vô hiệu hóa giao diện tương ứng.
</Callout>

## Điểm danh hằng ngày

* Dùng để thực hiện điểm danh hằng ngày và xem lịch sử điểm danh cùng phần thưởng.

1. Nhấn "Điểm danh ngay" để nhận phần thưởng hạn mức ngẫu nhiên trong ngày. (Khoảng hạn mức ngẫu nhiên do quản trị viên hệ thống của nền tảng đặt)
2. Trang hiển thị số ngày điểm danh tích luỹ, hạn mức đã nhận trong tháng này và tổng hạn mức đã nhận tích luỹ.
3. Bạn chỉ có thể điểm danh một lần mỗi ngày. Phần thưởng sẽ được cộng vào số dư tài khoản của bạn và có thể bị chậm vài giây khi ghi nhận.

<img alt="Trang điểm danh hằng ngày" src="07-personal-check-in.webp" />

## Cài đặt bảo mật

* Trang này dùng để quản lý cấu hình bảo mật tài khoản và quyền truy cập tài khoản.

1. **Đổi mật khẩu**: Dùng để cập nhật mật khẩu đăng nhập của tài khoản nhằm tăng cường bảo mật.
2. **Token truy cập**: Dùng để tạo và quản lý token truy cập API, cho phép ứng dụng hoặc dịch vụ bên ngoài truy cập các giao diện liên quan bằng token.
3. **Xóa tài khoản**: Dùng để xóa vĩnh viễn tài khoản hiện tại và toàn bộ dữ liệu liên kết. Thao tác này không thể hoàn tác và cần được xác nhận cẩn thận trước khi thực hiện.

<img alt="Trang cài đặt bảo mật" src="08-personal-security.webp" />

<Callout type="info">
  * Nếu bạn nghi ngờ token truy cập API đã bị lộ, bạn có thể đặt lại token đó:

  1. Trên trang hồ sơ, tìm khu vực "Cài đặt bảo mật".
  2. Nhấn "Token truy cập" → "Tạo lại".
  3. Sau khi xác nhận thao tác, hệ thống sẽ tạo một token truy cập uter mới.
  4. Token truy cập API cũ sẽ mất hiệu lực ngay lập tức và mọi dịch vụ đang dùng token truy cập API cũ sẽ cần được cấu hình lại bằng token mới.
</Callout>

<Callout type="warn">
  * Token truy cập được dùng cho các giao diện quản lý tài khoản và khác với khóa API dùng để gọi mô hình; không nên nhập chúng vào các client AI bên thứ ba.
  * Sau khi đặt lại một token truy cập API, tất cả các token truy cập API hiện có sẽ mất hiệu lực và cần tạo lại token truy cập uter.
</Callout>

## Bật hoặc tắt Xác thực hai yếu tố (2FA)

* Trang này dùng để bật hoặc tắt Xác thực hai yếu tố (2FA) cho tài khoản của bạn, bổ sung thêm một lớp bảo mật ngoài mật khẩu.

1. **Bật Xác thực hai yếu tố**: Trên trang hồ sơ, nhấp vào nút "Bật" bên cạnh "Xác thực hai yếu tố".
2. **Quét mã QR**: Dùng ứng dụng xác thực như Google Authenticator hoặc Microsoft Authenticator để quét mã QR trên trang, hoặc nhập khóa theo cách thủ công để liên kết.
3. **Lưu mã dự phòng**: Lưu các mã dự phòng do hệ thống tạo ra. Mỗi mã thường chỉ có thể dùng một lần để khôi phục quyền truy cập tài khoản khi không dùng được ứng dụng xác thực.
4. **Nhập mã xác minh**: Mở ứng dụng xác thực của bạn và nhập mã xác minh 6 chữ số hiện tại.
5. **Hoàn tất bật**: Nhấp vào nút "Bật 2FA". Sau khi xác minh, việc thiết lập Xác thực hai yếu tố sẽ hoàn tất.
6. **Tạo lại mã dự phòng hoặc tắt 2FA**: Nhấp vào nút "Tạo lại mã dự phòng" hoặc nút "Tắt 2FA" và làm theo hướng dẫn để hoàn tất thao tác tương ứng.

<img alt="Trang cài đặt 2FA" src="09-personal-2fa.webp" />

<Callout type="warn">
  Mã dự phòng chỉ hiển thị một lần và không thể xem lại sau khi đóng cửa sổ bật lên. Nếu làm mất mã dự phòng và không thể dùng ứng dụng xác thực, bạn cần liên hệ quản trị viên để đặt lại.
</Callout>

## Bật hoặc tắt đăng nhập không mật khẩu qua Passkey

* Bạn có thể bật hoặc tắt tính năng đăng nhập bằng Passkey cho tài khoản này. Sau khi bật, bạn có thể đăng nhập bằng sinh trắc học, khóa màn hình hoặc khóa bảo mật của thiết bị, mà không cần nhập mật khẩu.

1. **Bật Passkey**: Trong khu vực "Đăng nhập bằng Passkey", nhấn "Bật Passkey".
2. **Hoàn tất xác minh bảo mật**: Theo hướng dẫn, nhập mã xác minh động 6 chữ số do ứng dụng xác thực tạo ra, hoặc nhập mã dự phòng 8 chữ số và nhấn "Kiểm tra".
3. **Đăng ký Passkey**: Trình duyệt sẽ hiển thị lời nhắc xác minh của hệ thống. Làm theo hướng dẫn để hoàn tất đăng ký Passkey bằng vân tay, nhận diện khuôn mặt, PIN hoặc các phương thức xác minh hệ thống khác của thiết bị.
4. **Xem trạng thái**: Sau khi đăng ký thành công, trang sẽ hiển thị "Xác thực Passkey · Đang bật" và ghi lại thời điểm sử dụng gần nhất.
5. **Hủy liên kết Passkey**: Để tắt tính năng này, nhấn "Hủy liên kết Passkey". Sau khi hoàn tất xác minh danh tính, đăng nhập bằng Passkey của tài khoản hiện tại sẽ bị gỡ bỏ.

<img alt="Trang cài đặt Passkey" src="10-personal-passkey.webp" />

## Quản lý phiên đăng nhập

* Dùng để xem và quản lý các phiên đăng nhập của tài khoản hiện tại trên các thiết bị và trình duyệt khác nhau, giúp người dùng nhanh chóng phát hiện và loại bỏ các trạng thái đăng nhập bất thường.

1. **Xem thông tin phiên**: Xem thiết bị đã đăng nhập, hệ điều hành, trình duyệt, địa chỉ IP, phương thức đăng nhập, thời điểm hoạt động gần nhất và thời điểm hết hạn phiên.
2. **Đăng xuất khỏi phiên cụ thể**: Nhấn "Đăng xuất" hoặc "Thu hồi" ở phía bên phải của phiên đăng nhập tương ứng để đăng thiết bị đó ra khỏi tài khoản hiện tại.
3. **Đăng xuất khỏi các phiên khác**: Nhấn "Đăng xuất khỏi các phiên khác" ở góc trên bên phải của trang để đăng xuất khỏi tất cả thiết bị đã đăng nhập khác ngoài thiết bị hiện tại.
4. **Quản lý trạng thái đăng nhập**: Nếu phát hiện thiết bị lạ hoặc bản ghi đăng nhập bất thường, hãy thu hồi phiên tương ứng ngay lập tức và kịp thời đổi mật khẩu tài khoản.

<img alt="Trang quản lý phiên đăng nhập" src="11-personal-login-sessions.webp" />
