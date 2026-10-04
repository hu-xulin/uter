# Ví và Gói đăng ký

Sau khi đăng nhập, nhấp vào 'Ví' ở thanh điều hướng bên trái, hoặc trực tiếp truy cập `/wallet` để vào trang ví. Trang ví cung cấp tập trung các chức năng như thống kê số dư, nạp tiền trực tuyến, mã đổi thưởng, lịch sử đơn hàng, các gói đăng ký, gói đăng ký của tôi và phần thưởng giới thiệu. Các khu vực hiển thị, số tiền, phương thức thanh toán và nội dung gói cụ thể được quyết định bởi cấu hình của nền tảng.

<img alt="Trang ví và gói đăng ký" src="01-wallet-subscriptions.webp" />

## Xem số dư và mức sử dụng

Khu vực thống kê ví bao gồm các thông tin sau:

* **Số dư hiện tại**: Hạn mức nội bộ dùng để gọi mô hình hoặc thực hiện các thao tác tính phí khác, không phải số dư tiền mặt.
* **Tổng mức tiêu thụ tích luỹ**: Số hạn mức mà tài khoản đã sử dụng từ trước đến nay.
* **Yêu cầu API**: Số lượng yêu cầu API mà tài khoản đã khởi tạo.

<Callout type="warn">
  1. Đơn vị hiển thị của số dư và mức sử dụng được quyết định bởi loại tiền tệ và quy tắc hiển thị hạn mức do Root cấu hình trong 'Cài đặt hệ thống' → 'Thanh toán và tính phí'.
  2. Không nên suy luận tỷ giá cố định dựa trên ký hiệu hoặc giá trị trên trang; việc trừ phí thực tế còn chịu ảnh hưởng của các quy tắc tính phí theo mô hình, nhóm, kênh và phiên bản.
</Callout>

## Nạp tiền trực tuyến

Nếu nền tảng đã bật thanh toán trực tuyến, khu vực nạp tiền của ví sẽ hiển thị các lựa chọn nạp tiền khả dụng. Số tiền nạp, các mức có sẵn, số tiền nạp tối thiểu, chiết khấu và tỷ giá đều do cấu hình của nền tảng quyết định.

1. Trong khu vực 'Nạp tiền', chọn một mức có sẵn do trang cung cấp, hoặc nhập một số tiền tùy chỉnh.
2. Xem số hạn mức nạp và số tiền cần trả do hệ thống tính toán.
3. Chọn phương thức thanh toán do nền tảng hiện tại cung cấp.
4. Trong cửa sổ xác nhận, kiểm tra số hạn mức nạp, số tiền cần trả, chiết khấu và phương thức thanh toán.
5. Sau khi xác nhận, bạn sẽ được chuyển hướng đến trang thanh toán của bên thứ ba để hoàn tất thanh toán.
6. Sau khi hoàn tất thanh toán, quay lại ví và chờ trạng thái đơn hàng cùng số dư được cập nhật.

<Callout type="warn">
  1) Mã dự án hỗ trợ các cổng thanh toán như EPay, Stripe, Creem, Waffo và Waffo Pancake, nhưng chỉ những phương thức thanh toán đã được bật, cấu hình đầy đủ và hiện khả dụng mới được hiển thị. Các cổng khác nhau cũng có thể có thêm hạn chế về số tiền hoặc thanh toán; vui lòng tham khảo thông báo trên trang. Nếu không có phương thức thanh toán khả dụng, vui lòng liên hệ quản trị viên nền tảng.
  2) Thanh toán thành công cần có callback thanh toán từ bên thứ ba để xác nhận đơn hàng; số dư có thể không cập nhật ngay sau khi thanh toán. Nếu thanh toán thành công nhưng số dư chưa thay đổi, vui lòng lưu lại số đơn hàng và liên hệ quản trị viên; không thực hiện thanh toán trùng lặp.
  3) Phương thức thanh toán, số tiền nạp tối thiểu, chiết khấu, tỷ giá và các mức có sẵn không phải là giá trị cố định của Uter; bạn không thể suy luận quy tắc của phiên bản hiện tại dựa trên các phiên bản khác hoặc trang ví dụ.
</Callout>

## Mã đổi thưởng

Khi có mã đổi thưởng, khu vực nạp tiền sẽ hiển thị một ô nhập mã đổi thưởng; nếu quản trị viên đã cấu hình địa chỉ nhận mã đổi thưởng, trang cũng sẽ hiển thị một liên kết bên ngoài tương ứng.

1. Xác định ô nhập 'Mã đổi thưởng' trong khu vực nạp tiền.
2. Nhập mã đổi thưởng do quản trị viên cung cấp.
3. Nhấn 'Đổi', chờ thông báo kết quả và làm mới số dư của bạn.

<Callout type="info">
  1) Mã đổi thưởng phải thỏa mãn thời hạn hiệu lực và quy tắc sử dụng do nền tảng cấu hình, đồng thời phải ở trạng thái đã bật và chưa sử dụng. Mỗi mã đổi thưởng chỉ có thể sử dụng thành công một lần.
  2) Nếu đổi thưởng thất bại, trang có thể không hiển thị lý do cụ thể như 'đã sử dụng', 'hết hạn' hoặc 'không tồn tại'. Vui lòng kiểm tra xem mã đổi thưởng có đầy đủ hay không và xác nhận trạng thái với quản trị viên.
  3) Nếu nền tảng chưa hoàn tất cấu hình tuân thủ thanh toán liên quan, việc nhập và đổi mã đổi thưởng sẽ bị vô hiệu hóa và trang sẽ hiển thị thông báo tương ứng.
</Callout>

## Gói đăng ký

Các gói đăng ký nằm trong khu vực đăng ký của trang ví. Chỉ những gói đã được bật và vượt qua kiểm tra tuân thủ thanh toán trên nền tảng hiện tại mới được API trả về và hiển thị; nếu không có gói nào khả dụng, khu vực đăng ký sẽ không hiển thị.

Thẻ gói bao gồm các thông tin sau:

| Mục                   | Mô tả                                                                                                                                                                                                                                              |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tiêu đề và phụ đề   | Tên và mô tả do quản trị viên đặt cho gói.                                                                                                                                                                                                         |
| Giá                  | Số tiền cần thiết để mua gói; giá trị cụ thể do cấu hình của phiên bản quyết định.                                                                                                                                                                 |
| Thời hạn hiệu lực    | Có thể cấu hình theo năm, tháng, ngày, giờ hoặc thời lượng tùy chỉnh (giây).                                                                                                                                                                     |
| Tổng hạn mức         | Hạn mức đăng ký có trong gói; cấu hình là 0 nghĩa là không giới hạn tổng hạn mức.                                                                                                                                                                   |
| Chu kỳ đặt lại hạn mức | Có thể cấu hình là không đặt lại, hằng ngày, hằng tuần, hằng tháng hoặc chu kỳ tùy chỉnh.                                                                                                                                                              |
| Giới hạn mua         | Giới hạn số lần mà cùng một người dùng có thể mua; cấu hình là 0 nghĩa là không giới hạn.                                                                                                                                                           |
| Nhóm nâng cấp        | Có thể chuyển sang nhóm do quản trị viên cấu hình sau khi mua thành công.                                                                                                                                                                           |
| Nhóm hạ cấp          | Có thể chuyển sang nhóm do quản trị viên cấu hình sau khi gói đăng ký hết hạn; nếu không thiết lập, chỉ khi đã chuyển nhóm qua nhóm nâng cấp lúc mua và vẫn còn ở nhóm đó khi hết hạn thì thường mới trở lại nhóm trước khi mua.                            |

<Callout type="warn">
  'Tổng hạn mức không giới hạn' chỉ có nghĩa là bản thân gói đăng ký không đặt giới hạn tổng hạn mức, và không có nghĩa là lời gọi không giới hạn. Các yêu cầu vẫn phải tuân theo quy tắc của mô hình, định tuyến, nhóm và tính phí.
</Callout>

## Mua một gói đăng ký

1. Mở khu vực đăng ký của trang ví.
2. Chọn một gói và xem thời hạn hiệu lực, hạn mức, chu kỳ đặt lại và giới hạn mua của gói đó.
3. Chọn phương thức mua được hiển thị trên trang.
4. Sau khi xác minh thông tin đơn hàng, hoàn tất việc trừ số dư hoặc thanh toán qua bên thứ ba.
5. Khi sử dụng thanh toán của bên thứ ba, quay lại ví và chờ callback thanh toán; xác nhận gói đăng ký đã kích hoạt hay chưa sau khi trạng thái được cập nhật.

Các phương thức mua khả dụng phụ thuộc vào cổng thanh toán toàn cục và cấu hình riêng của gói, và có thể bao gồm:

* **Số dư Ví**: Khả dụng khi gói cho phép thanh toán bằng số dư và số dư tài khoản đủ. Số hạn mức bị trừ được tính là 'Giá gói × `QuotaPerUnit`' và làm tròn lên; đơn vị cụ thể do cấu hình nền tảng quyết định.
* **EPay**: Yêu cầu nền tảng bật thanh toán EPay và cấu hình thanh toán hiện tại phải khả dụng.
* **Stripe, Creem hoặc Waffo Pancake**: Ngoài việc cổng toàn cục khả dụng, gói còn phải được cấu hình với sản phẩm thanh toán tương ứng.

<Callout type="warn">
  Khi phương thức thanh toán Waffo thông thường được dùng để nạp tiền trực tuyến, điều đó không có nghĩa là hỗ trợ mua gói đăng ký. Nút mua có thể bị vô hiệu hóa hoặc thao tác có thể thất bại nếu đã đạt giới hạn mua của người dùng, gói bị vô hiệu hóa, phương thức thanh toán không khả dụng, hoặc số dư không đủ.
</Callout>

## Xem trạng thái đăng ký

Khu vực 'Gói đăng ký của tôi' hiển thị trạng thái đăng ký hiện tại và trước đây, các trạng thái phổ biến gồm:

* **Đang hoạt động**: Gói đăng ký đang có hiệu lực. Trang sẽ hiển thị số ngày còn lại và thời điểm kết thúc; nếu có cấu hình thời điểm đặt lại tiếp theo thì cũng sẽ hiển thị; với các gói đăng ký có giới hạn hạn mức, tổng hạn mức, hạn mức đã dùng, hạn mức còn lại và tiến độ sử dụng cũng sẽ được hiển thị.
* **Đã hết hạn**: Gói đăng ký đã hết hạn và không thể sử dụng hạn mức đăng ký nữa.
* **Đã hủy**: Gói đăng ký đã bị hủy hoặc vô hiệu hóa trước thời hạn. Không có mục hủy tự phục vụ ở phía người dùng; trạng thái này thường do thao tác của quản trị viên tạo ra.

<Callout type="info">
  1. Sau khi đến thời điểm đặt lại hạn mức, hạn mức đã dùng của các gói đăng ký có giới hạn hạn mức sẽ được xóa và một chu kỳ hạn mức mới bắt đầu. Nếu thời điểm đặt lại tiếp theo đã vượt qua thời điểm kết thúc của gói đăng ký thì sẽ không thiết lập lần đặt lại đó.
  2. Nhóm sau khi gói đăng ký hết hạn được quyết định bởi cấu hình của gói: nếu có thiết lập nhóm hạ cấp thì thường sẽ chuyển sang nhóm đó; nếu không thiết lập, chỉ khi đã chuyển nhóm qua nhóm nâng cấp lúc mua và vẫn còn ở nhóm nâng cấp đó khi hết hạn thì thường mới trở lại nhóm trước khi mua. Nếu không có nâng cấp nào, hoặc nếu tài khoản còn các gói đăng ký nâng cấp khác đang hoạt động, nhóm hiện tại có thể được giữ nguyên; nhóm cuối cùng sẽ được xử lý kết hợp với các trạng thái đăng ký khác.
  3. Hiện chưa có tính năng tự động gia hạn cho các gói đăng ký. Nếu muốn tiếp tục sử dụng sau khi gói đăng ký hết hạn, vui lòng mua lại gói.
</Callout>

## Chọn tùy chọn tính phí

Trang ví cho phép chọn thứ tự trừ hạn mức cho các yêu cầu. Sau khi lưu tùy chọn, phần backend sẽ xử lý theo các quy tắc sau:

| Tùy chọn tính phí           | Quy tắc trừ tiền                                                                                                                                                                                                                                     |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Ưu tiên Gói đăng ký**    | Trừ từ các gói đăng ký đang hoạt động trước; nếu hạn mức đăng ký không đủ, ví chỉ được dùng khi tất cả các gói đăng ký đang hoạt động đều cho phép chuyển về ví. Nếu không có gói đăng ký đang hoạt động thì dùng ví. |
| **Ưu tiên Ví**              | Trừ từ ví trước; nếu số dư ví không đủ thì mới thử dùng gói đăng ký.                                                                                                                                                                                 |
| **Chỉ Gói đăng ký**         | Chỉ dùng gói đăng ký. Nếu không có gói đăng ký đang hoạt động hoặc hạn mức đăng ký không đủ, yêu cầu sẽ thất bại và không chuyển sang ví.                                                                                                             |
| **Chỉ Ví**                  | Chỉ dùng ví. Nếu số dư không đủ, yêu cầu sẽ thất bại và không dùng gói đăng ký.                                                                                                                                                                         |

<Callout type="info">
  Quy tắc 'Cho phép chuyển về ví khi vượt hạn mức' của gói ảnh hưởng đến kết quả của 'Ưu tiên Gói đăng ký': nếu chỉ một gói đăng ký đang hoạt động bất kỳ cấm chuyển về ví thì không thể dùng ví khi hạn mức đăng ký không đủ. Khi không có gói đăng ký đang hoạt động, các tùy chọn 'Ưu tiên Gói đăng ký' và 'Chỉ Gói đăng ký' sẽ bị vô hiệu hóa trên trang.
</Callout>

## Phần thưởng giới thiệu

Khu vực phần thưởng giới thiệu của trang ví hiển thị liên kết giới thiệu, phần thưởng đang chờ, tổng phần thưởng tích luỹ trước đây và số người được mời. Mã giới thiệu được nhúng trong tham số `aff` của liên kết giới thiệu; định dạng liên kết là:

```text
Địa chỉ trang hiện tại/sign-up?aff=<mã giới thiệu>
```

Quy trình sử dụng:

1. Sao chép liên kết giới thiệu trong khu vực phần thưởng giới thiệu.
2. Gửi liên kết cho người dùng mới, họ có thể đăng ký tài khoản qua liên kết này; một số quy trình đăng ký người dùng mới qua đăng ký bằng mật khẩu tài khoản và OAuth sẽ đọc tham số này, còn các quy trình đăng nhập độc lập như WeChat và Telegram thì không áp dụng.
3. Sau khi đáp ứng điều kiện giới thiệu do nền tảng cấu hình, phần thưởng sẽ được phân phối theo quy tắc.
4. Phần thưởng của người giới thiệu thường phải vào phần thưởng đang chờ trước; một khi phần thưởng đáp ứng điều kiện chuyển nhượng, hãy nhấn 'Chuyển vào số dư' để cộng vào số dư chính.

<Callout type="warn">
  * Phần thưởng của người được mời (nếu nền tảng bật) sẽ được cộng trực tiếp vào hạn mức tài khoản của họ; phần thưởng của người giới thiệu thường phải vào phần thưởng đang chờ trước.
  * Số tiền, điều kiện phân phối và số tiền chuyển nhượng tối thiểu cho phần thưởng giới thiệu do cấu hình nền tảng quyết định.
  * Việc chuyển vào số dư hỗ trợ chuyển một phần, nhưng không được vượt quá số phần thưởng đang chờ hiện tại và không được thấp hơn yêu cầu về đơn vị hạn mức của nền tảng; đây không phải là rút tiền mặt, hoàn tiền hay đơn đăng ký rút tiền.
  * Nếu không đáp ứng yêu cầu về trạng thái tuân thủ thanh toán, phần thưởng có thể không được phát và thao tác 'Chuyển vào số dư' cũng có thể không khả dụng.
  * Mã giới thiệu không hợp lệ sẽ không ngăn cản việc đăng ký, và người dùng đã đăng ký sẽ không nhận lại phần thưởng khi sử dụng lại mã giới thiệu.
</Callout>

## Lịch sử đơn hàng

* Nhấp vào 'Lịch sử đơn hàng' ở góc trên bên phải của thẻ nạp tiền để xem các bản ghi đơn hàng nạp tiền và thanh toán.
* Trang hỗ trợ tìm kiếm theo số đơn hàng và phân trang, đồng thời hiển thị số đơn hàng, thời gian tạo, phương thức thanh toán, hạn mức hoặc số tiền nạp, số tiền thanh toán và trạng thái đơn hàng.

<Callout type="info">
  1. Người dùng thông thường chỉ có thể truy vấn bản ghi của mình trong 30 ngày gần nhất; tiêu chí tìm kiếm chỉ khớp với số đơn hàng.
  2. Danh sách này chủ yếu để xem các đơn hàng nạp tiền và thanh toán, không bảo đảm bao phủ toàn bộ đơn hàng đăng ký.
</Callout>

## Hạn chế thường gặp

Các tình huống sau có thể khiến các tính năng liên quan đến ví hoặc gói đăng ký không khả dụng:

1. Nền tảng chưa cấu hình cổng thanh toán hoặc sản phẩm thanh toán, dẫn đến không có phương thức thanh toán hoặc gói đăng ký khả dụng.
2. Chưa đáp ứng yêu cầu về trạng thái tuân thủ thanh toán, dẫn đến phương thức thanh toán hoặc gói đăng ký không khả dụng và thao tác mã đổi thưởng hiển thị ở trạng thái bị vô hiệu hóa.
3. Số tiền nạp thấp hơn mức tối thiểu mà nền tảng hoặc cổng thanh toán yêu cầu.
4. Số dư không đủ, gói bị vô hiệu hóa, hoặc đã đạt giới hạn mua cá nhân.
5. Callback thanh toán của bên thứ ba chưa hoàn tất và đơn hàng vẫn đang được xử lý.

<Callout type="warn">
  Nếu thanh toán thành công nhưng đơn hàng hoặc số dư lâu không được cập nhật, vui lòng lưu lại số đơn hàng, bằng chứng thanh toán và thời điểm xảy ra, liên hệ quản trị viên nền tảng để xác minh, và không thực hiện thanh toán trùng lặp.
</Callout>
