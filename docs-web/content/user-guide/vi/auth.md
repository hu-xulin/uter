# Đăng ký và Đăng nhập

Hỗ trợ đăng ký tài khoản, đặt lại mật khẩu khi quên, đăng nhập bằng mật khẩu tài khoản, cùng đăng nhập một chạm bằng Passkey và các nhà cung cấp OAuth bên thứ ba. Vui lòng hoàn tất đăng ký trước lần sử dụng đầu tiên.

## Đăng nhập

### Đăng nhập bằng mật khẩu tài khoản

1. Mở trang chủ của nền tảng, nhấp vào nút "Đăng nhập" ở góc trên bên phải, hoặc trực tiếp truy cập `/sign-in`.
2. Nhập tên người dùng hoặc email cùng mật khẩu.
3. Nếu Cloudflare Turnstile hiển thị trên trang, bạn cần hoàn thành xác minh người dùng.
4. Trước tiên, nhấp để xác nhận rằng bạn đã đọc và đồng ý với điều khoản sử dụng và chính sách bảo mật, sau đó nhấn "Đăng nhập".
5. Khi tài khoản đã bật 2FA, quá trình đăng nhập sẽ yêu cầu nhập thêm mã xác minh một lần hoặc mã dự phòng.

<img alt="Trang đăng nhập" src="01-login.webp" />

### Đăng nhập bằng Passkey và OAuth bên thứ ba

Trang đăng nhập sẽ hiển thị các biểu tượng của những nền tảng bên thứ ba như GitHub, Discord, LinuxDO, hoặc Passkey, tùy theo những gì nền tảng đã bật. Để đăng nhập bằng tài khoản bên thứ ba hoặc Passkey:

1. Nhấp để xác nhận rằng bạn đã đọc và đồng ý với điều khoản sử dụng và chính sách bảo mật.
2. Nhấp vào biểu tượng của nền tảng tương ứng (GitHub, Discord, LinuxDO, v.v.) hoặc biểu tượng Passkey ở dưới cùng trang.
3. Khi dùng tài khoản bên thứ ba, bạn sẽ được chuyển hướng đến trang cấp quyền của bên thứ ba để hoàn tất cấp quyền; khi dùng Passkey, hãy hoàn tất xác minh theo hướng dẫn từ trình duyệt hoặc thiết bị của bạn.

<img alt="Trang đăng nhập OAuth" src="02-login.webp" />

<Callout type="info">
  Các phương thức đăng nhập bằng Passkey và OAuth bên thứ ba, cùng việc có bật xác minh người dùng hay không, được quản trị viên cấp cao nhất (Root) của nền tảng cấu hình trong "Cài đặt hệ thống" → "Xác thực". Các phương thức bị vô hiệu hóa sẽ không hiển thị trên trang đăng nhập.
</Callout>

## Đăng ký

### Quy trình đăng ký

1. Trên trang đăng nhập, nhấn "Đăng ký", hoặc trực tiếp truy cập `/sign-up`.
2. Nhập tên người dùng, mật khẩu và xác nhận mật khẩu.
3. Nếu cài đặt nền tảng yêu cầu xác minh email, hãy nhập email của bạn, gửi mã xác minh và nhập mã đã nhận được.
4. Nếu Cloudflare Turnstile được bật trên nền tảng, bạn cần hoàn thành xác minh người dùng.
5. Trước tiên, nhấp để xác nhận rằng bạn đã đọc và đồng ý với điều khoản sử dụng và chính sách bảo mật, sau đó nhấn "Tạo tài khoản" để hoàn tất đăng ký.

<img alt="Trang đăng ký" src="03-register.webp" />

<Callout type="info">
  Việc cho phép đăng ký bằng mật khẩu, đăng ký qua OAuth, xác minh email, và hạn chế theo tên miền/alias email hay không được quyết định bởi cài đặt xác thực của Root.
</Callout>

### Quản lý phiên đăng nhập

Sau khi đăng nhập thành công, một phiên độc lập sẽ được thiết lập. Người dùng đã đăng nhập có thể nhấn "Hồ sơ" → "Phiên đăng nhập" ở thanh bên trái để xem các phiên đăng nhập hiện tại với các thiết bị khác, thu hồi từng phiên, hoặc đăng xuất khỏi tất cả các phiên khác cùng lúc; việc thu hồi phiên hiện tại sẽ đưa bạn trở lại trang đăng nhập.

<img alt="Trang phiên đăng nhập" src="04-login-session.webp" />

## Đặt lại mật khẩu khi quên

1. Trên trang đăng nhập, nhấn "Quên mật khẩu".
2. Nhập email liên kết với tài khoản của bạn và gửi.
3. Mở liên kết đặt lại do hệ thống gửi.
4. Đặt mật khẩu mới trên trang đặt lại, sau đó đăng nhập lại.

<img alt="Trang quên mật khẩu" src="05-forgot-password.webp" />
