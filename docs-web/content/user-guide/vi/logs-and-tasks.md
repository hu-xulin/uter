# Nhật ký và Tác vụ bất đồng bộ

* Uter lưu riêng biệt chi tiết yêu cầu, bản ghi vẽ và các tác vụ bất đồng bộ như video và nhạc.
* Sau khi đăng nhập, bạn có thể truy cập "Nhật ký sử dụng" hoặc "Nhật ký tác vụ" từ thanh điều hướng bên trái.
* Trang này giải thích thống nhất ba phân vùng dữ liệu, các trạng thái tác vụ và phương thức truy vấn API.

Ba phân vùng tương ứng với các đường dẫn sau:

* `/usage-logs/common`: Nhật ký sử dụng API chung và chi tiết tính phí;
* `/usage-logs/drawing`: Tác vụ vẽ Midjourney;
* `/usage-logs/task`: Tác vụ bất đồng bộ chung như Suno và video.

<Callout type="info">
  Người dùng thông thường chỉ có thể xem bản ghi của chính họ. Admin và Root có thể chuyển đổi giữa "Tất cả" và "Chỉ của tôi" ở góc trên bên phải của trang; khi chuyển sang "Chỉ của tôi", trang sẽ trả về dữ liệu theo các trường và quyền của người dùng thông thường.
</Callout>

## Nhật ký sử dụng

* Nhấp vào "Nhật ký sử dụng" ở thanh bên trái hoặc truy cập `/usage-logs/common` để xem các yêu cầu API và chi tiết tính phí.

### Lọc bản ghi

Các tùy chọn lọc có sẵn cho truy vấn bản ghi nhật ký sử dụng như sau:

| Tùy chọn lọc                   | Mô tả                                                                                                    |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Khoảng thời gian                | Lọc theo thời gian tạo bản ghi, trong đó cả thời điểm bắt đầu và kết thúc đều được tính trong phạm vi truy vấn. |
| Tên mô hình                    | Lọc theo tên mô hình.                                                                                     |
| Nhóm                           | Lọc theo nhóm được sử dụng trong yêu cầu.                                                                 |
| Loại nhật ký                   | Tất cả loại, Nạp tiền, Tiêu thụ, Quản lý, Hệ thống, Lỗi, Hoàn tiền, Đăng nhập.                             |
| Tên khóa API| Lọc theo tên khóa API.                                                                                     |
| Request ID                     | Xác định một yêu cầu theo Uter Request ID.                                                                  |
| Upstream Request ID             | Xác định một yêu cầu theo Request ID được trả về hoặc ghi nhận bởi dịch vụ thượng nguồn.                   |
| Tên người dùng (chỉ Admin/Root) | Lọc theo tên người dùng trong chế độ xem của quản trị viên.                                                |
| Channel ID (chỉ Admin/Root)    | Lọc theo Channel ID trong chế độ xem của quản trị viên.                                                     |

### Thống kê trang

Các giá trị thống kê trong thanh lọc phụ thuộc vào quyền hiện tại và điều kiện lọc:

* **Mức sử dụng**: Tổng hợp hạn mức của các bản ghi tiêu thụ, có thể lọc theo điều kiện thời gian, mô hình, nhóm, khóa, kênh và người dùng.
* **RPM**: Số lượng yêu cầu tiêu thụ trong 60 giây gần nhất.
* **TPM**: Tổng số token đầu vào và token đầu ra trong 60 giây gần nhất.

### Danh sách và chi tiết

* Người dùng thông thường có thể thấy các cột Thời gian và Loại, Token, Mô hình, Luồng, Số token, Chi phí, Thời lượng và Chi tiết.
* Chế độ xem của Admin/Root còn có thể hiển thị thêm các cột Kênh và Người dùng.

<img alt="Trang nhật ký sử dụng" src="01-usage-logs.webp" />

<Callout type="info">
  1. **Số token**: Hiển thị token đầu vào / token đầu ra; khi có sử dụng cache, số lượng đọc và ghi cache cũng có thể được hiển thị.
  2. **Chi phí**: Hiển thị kết quả tiêu thụ hoặc hoàn tiền hạn mức cho bản ghi này; định dạng cụ thể phụ thuộc vào cách hiển thị hạn mức của phiên bản.
  3. **Thời lượng**: Hiển thị thời lượng phản hồi cho các bản ghi tiêu thụ hoặc lỗi có dữ liệu thời gian; các yêu cầu dạng luồng còn có thể hiển thị Thời gian phản hồi đầu tiên (FRT) và thông tin thông lượng.
  4. **Chi tiết**: Nhấp vào một bản ghi sẽ mở hộp thoại chi tiết. Tùy thuộc vào loại nhật ký và các trường thực sự được lưu trong bản ghi, nội dung có thể bao gồm Request ID, ánh xạ mô hình, lý do lỗi hoặc hoàn tiền, chi tiết token, chi tiết tính phí, mức sử dụng cache/âm thanh/hình ảnh, trạng thái luồng, v.v. Không phải bản ghi nào cũng hiển thị tất cả các khối.
  5. Quản trị viên còn có thể thấy chuỗi thử lại kênh, các biến đổi yêu cầu, đường dẫn tính phí, kiểm toán nạp tiền hoặc kiểm toán thao tác quản lý trong phần chi tiết.
</Callout>

<Callout type="warn">
  * **Tại sao tôi không thấy một bản ghi cụ thể?**
    Việc ghi nhật ký tiêu thụ có được ghi hay không do công tắc "Ghi lại mức sử dụng hạn mức" trong "Cài đặt hệ thống" → "Vận hành" → "Bảo trì nhật ký" của nền tảng quyết định. Nếu Root tắt cài đặt này, các bản ghi tiêu thụ mới có thể không được tạo. Nhật ký lỗi cũng phụ thuộc vào công tắc nhật ký lỗi và các loại lỗi có thể ghi nhận; không phải mọi phản hồi thất bại đều tạo ra bản ghi Lỗi. Tùy chọn "Ghi lại địa chỉ IP" trong hồ sơ người dùng chỉ kiểm soát việc có lưu IP yêu cầu cho nhật ký tiêu thụ và nhật ký yêu cầu lỗi hay không; các nhật ký khác như đăng nhập, kiểm toán quản lý và nạp tiền có thể ghi IP theo quy trình kiểm toán riêng của chúng.
</Callout>

## Nhật ký tác vụ

* "Nhật ký tác vụ" bao gồm "Nhật ký vẽ" và "Nhật ký tác vụ bất đồng bộ".

1. "Nhật ký vẽ": Ghi lại nhật ký các tác vụ vẽ của Midjourney.
2. "Nhật ký tác vụ bất đồng bộ": Ghi lại các tác vụ bất đồng bộ như tạo video từ văn bản, tạo video từ hình ảnh và tạo âm thanh.

## Nhật ký vẽ

* Nhấp vào "Nhật ký tác vụ" → "Nhật ký vẽ" ở thanh bên trái hoặc truy cập `/usage-logs/drawing` để xem bản ghi tác vụ vẽ của Midjourney.
* Người dùng thông thường chỉ có thể xem tác vụ của chính họ; Admin/Root có thể xem các tác vụ trong phạm vi quản lý của mình ở chế độ xem "Tất cả" và còn có thể thấy kênh cùng kết quả gửi tác vụ.

Nhật ký vẽ hỗ trợ lọc theo các điều kiện sau:

1. Khoảng ngày;
2. Midjourney Task ID;
3. Channel ID (chỉ Admin/Root).

<img alt="Trang nhật ký vẽ" src="02-drawing-logs.webp" />

<Callout type="info">
  1. Danh sách bao gồm thời gian gửi và trạng thái, Channel ID (chỉ Admin/Root), loại thao tác, Task ID, thời lượng, kết quả gửi tác vụ, tiến độ, hình ảnh, prompt và lý do thất bại. Nhấp vào hình ảnh sẽ mở bản xem trước; nhấp vào prompt sẽ hiện nội dung đầy đủ; nhấp vào lý do thất bại sẽ hiện thông báo lỗi đầy đủ.
  2. Các trạng thái vẽ bao gồm: Chưa bắt đầu, Đang xếp hàng, Đang xử lý, Thành công, Thất bại, Đang chờ cửa sổ.
  3. Trạng thái vẽ được cập nhật bằng cách thăm dò nền các tác vụ thượng nguồn. Do có khoảng thời gian giữa các lần thăm dò, trạng thái tác vụ có thể bị chậm; khi phần backend lấy được dữ liệu tác vụ thượng nguồn tương ứng, hệ thống sẽ đánh dấu các tác vụ Midjourney đã gửi từ khoảng 1 giờ trước đó mà vẫn chưa hoàn tất là thất bại.
</Callout>

## Nhật ký tác vụ (Nhật ký tác vụ bất đồng bộ)

* Nhấp vào "Nhật ký tác vụ" → "Nhật ký tác vụ bất đồng bộ" ở thanh bên trái hoặc truy cập `/usage-logs/task` để xem nhật ký tác vụ bất đồng bộ. Người dùng thông thường chỉ có thể xem tác vụ của chính họ; chế độ xem của Admin/Root còn hiển thị thêm Channel ID và Người dùng.
* Các API bất đồng bộ cho video, nhạc, v.v. không trả về kết quả cuối cùng ngay khi gửi yêu cầu. Sau khi gửi thành công, Uter trả về một Task ID có thể truy cập công khai và lưu bản ghi tác vụ, sau đó phần backend thăm dò dịch vụ thượng nguồn để cập nhật trạng thái, tiến độ và kết quả.

### Lọc tác vụ

Nhật ký tác vụ hỗ trợ lọc theo các điều kiện sau:

1. Khoảng ngày;
2. Task ID;
3. Channel ID (chỉ Admin/Root).

### Danh sách và kết quả

Danh sách tác vụ hiển thị thời gian gửi và thời gian hoàn thành, kênh, người dùng, Task ID, nền tảng và thao tác, thời lượng, trạng thái, tiến độ và chi tiết:

* Khi một tác vụ Suno thành công và trả về địa chỉ âm thanh, cột chi tiết cung cấp bản nghe thử âm thanh;
* Một số tác vụ video sẽ hiển thị mục xem trước khi thành công; bạn cũng có thể dùng phiên đăng nhập hoặc khóa API của cùng tài khoản đó để yêu cầu `/v1/videos/{task_id}/content` nhằm lấy nội dung video của các tác vụ đã hoàn thành. API này xác minh quyền sở hữu tác vụ; nó sẽ không trả về nội dung nếu tác vụ chưa hoàn tất hoặc không thuộc về người dùng hiện tại;
* Các bản ghi thất bại khác sẽ hiển thị lý do thất bại trong cột chi tiết, có thể nhấp để xem thông tin đầy đủ.

## Trạng thái tác vụ và xử lý phía backend

Nhật ký tác vụ bất đồng bộ sử dụng các giá trị trạng thái sau. Các bộ chuyển tiếp nền tảng khác nhau đôi khi có thể giữ nguyên khác biệt về chữ hoa/thường hoặc về nền tảng của trạng thái thượng nguồn, do đó giá trị trả về của API nên dựa trên bản ghi tác vụ thực tế:

| Trạng thái     | Ý nghĩa                                                                                              |
| -------------- | ----------------------------------------------------------------------------------------------------- |
| `Not Started`  | Bản ghi tác vụ đã được tạo nhưng chưa bắt đầu xử lý.                                                  |
| `Queued`       | Đã gửi lên thượng nguồn, đang chờ xử lý tiếp.                                                         |
| `In Queue`     | Đã vào hàng đợi xử lý.                                                                                |
| `In Progress`  | Đang được xử lý.                                                                                      |
| `Success`      | Đã hoàn tất, có thể xem hoặc lấy kết quả.                                                            |
| `Failed`       | Xử lý thất bại; lý do thất bại sẽ được ghi vào bản ghi tác vụ (nếu thượng nguồn cung cấp).           |
| `Unknown`      | Giá trị dự phòng được định nghĩa nội bộ cho trạng thái không xác định.                                |

<img alt="Trang nhật ký tác vụ" src="03-task-logs.webp" />

<Callout type="info">
  Trạng thái tác vụ được cập nhật bằng cách thăm dò nền, do đó trạng thái của các tác vụ mới gửi có thể bị chậm. Mặc định, tác vụ bất đồng bộ được thăm dò khoảng 15 giây một lần; việc thăm dò chỉ chạy khi `UPDATE_TASK` được bật và có tác vụ chưa hoàn tất. Ngưỡng thời gian chờ của tác vụ bất đồng bộ do `TASK_TIMEOUT_MINUTES` kiểm soát, mặc định là 1440 phút; đặt thành `0` sẽ vô hiệu hóa việc xử lý thời gian chờ.
</Callout>

### Thất bại, hết thời gian chờ và hoàn tiền

Sau khi một tác vụ ở trạng thái kết thúc thất bại, nếu tác vụ đó đã bị trừ trước hạn mức trong giai đoạn gửi, hệ thống thường sẽ thử hoàn tiền và ghi một bản nhật ký `Refund` khi hoàn tiền thành công. Sau khi hoàn tiền thành công, hạn mức hoàn tiền đang chờ trong bản ghi tác vụ sẽ được xóa và mức sử dụng tích luỹ của người dùng và kênh sẽ được giảm; số lượng yêu cầu sẽ không được hoàn tác vì lý do này.

<Callout type="warn">
  Các tình huống sau có thể dẫn đến số dư tạm thời không khớp với trạng thái trên trang:

  1. Tác vụ không bị trừ trước hạn mức (`quota = 0`);
  2. Hoàn tiền từ nguồn cấp vốn thất bại, hệ thống sẽ giữ lại hạn mức của tác vụ để thử lại hoặc đối soát thủ công;

  * Khi khắc phục sự cố hoàn tiền, vui lòng kiểm tra cả số dư ví hoặc hạn mức đăng ký còn lại (cùng hạn mức của các khóa API đang hoạt động) và các bản ghi "Hoàn tiền" trong nhật ký sử dụng chung. Không nên chỉ dựa vào trạng thái "Thất bại" để xác định việc hoàn tiền đã hoàn tất hay chưa.
</Callout>

## Tham chiếu API

### API truy vấn nhật ký

Nếu sử dụng API thay vì bảng điều khiển, bạn có thể gọi các API chỉ đọc sau đây. Các API này vẫn chịu sự ràng buộc về xác thực và quyền hạn, và kết quả cho người dùng thông thường sẽ bị giới hạn chặt chẽ ở tài khoản hiện tại:

| Dữ liệu              | API quản trị         | API người dùng            | Đơn vị tham số thời gian     |
| -------------------- | -------------------- | ------------------------- | ---------------------------- |
| Nhật ký chung        | `GET /api/log/`     | `GET /api/log/self`      | Giây (`created_at`)          |
| Thống kê nhật ký     | `GET /api/log/stat` | `GET /api/log/self/stat` | Giây                          |
| Vẽ Midjourney        | `GET /api/mj/`      | `GET /api/mj/self`       | Mili giây (`submit_time`)     |
| Tác vụ bất đồng bộ  | `GET /api/task/`    | `GET /api/task/self`     | Giây (`submit_time`)         |

Các API danh sách nhật ký và tác vụ sử dụng tham số phân trang `p` và `page_size`; số trang bắt đầu từ `1`. Khi dùng số nguyên dương thông thường, `page_size` vượt quá `100` sẽ bị cắt còn `100`. Tổng số bản ghi nhật ký của người dùng cũng chịu ảnh hưởng của giới hạn truy vấn nội bộ của phiên bản. Dữ liệu tác vụ trả về sẽ không bao gồm các trường riêng tư có thể chứa khóa, định danh tác vụ thượng nguồn hoặc ngữ cảnh tính phí.

Ngoài ra, `GET /api/log/token` có thể được dùng cùng khóa API để đọc nhật ký gần nhất của khóa đó. API này dùng xác thực token chỉ đọc: nó xác minh rằng khóa tồn tại, không bị vô hiệu hóa rõ ràng và người dùng sở hữu khóa còn khả dụng, nhưng sẽ không từ chối truy vấn do khóa hết hạn hoặc hết hạn mức; nó trả về tối đa `1000` bản ghi gần nhất.

Các tham số truy vấn phổ biến của API danh sách tác vụ như sau:

| Phạm vi      | Phương thức và đường dẫn | Tham số truy vấn phổ biến                                                                                     |
| ------------ | ----------------------- | ------------------------------------------------------------------------------------------------------------- |
| Người dùng hiện tại | `GET /api/task/self` | `p`, `page_size`, `task_id`, `start_timestamp`, `end_timestamp`; cũng chấp nhận `platform`, `action`, `status`. |
| Admin/Root   | `GET /api/task/`        | Bổ sung `channel_id` vào các tham số API người dùng và có thể lọc theo `platform`, `action`, `status`.       |

<Callout type="info">
  `start_timestamp` và `end_timestamp` của API tác vụ dùng dấu thời gian Unix tính bằng giây; các tham số thời gian của API vẽ Midjourney dùng mili giây.
</Callout>

### API tạo nội dung bất đồng bộ và tác vụ

Các API tạo nội dung bất đồng bộ và truy vấn tác vụ thượng nguồn sau đây do phiên bản cung cấp theo các kênh và bộ chuyển tiếp đã cấu hình. Các API gửi và truy vấn thường dùng xác thực khóa API. Proxy nội dung video hỗ trợ cả khóa API lẫn phiên đăng nhập và tuân thủ việc xác minh quyền sở hữu tác vụ; proxy hình ảnh Midjourney là ngoại lệ và không yêu cầu khóa API; API danh sách `/api/task` bên dưới sử dụng quyền của người dùng đã đăng nhập hoặc quản trị viên. Phương thức xác thực cụ thể phụ thuộc vào yêu cầu của API.

| API                                  | Đường dẫn                                                                                              | Mô tả                                                                                                                                                        |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tạo video OpenAI                     | `POST /v1/videos`                                                                                       | Tạo một tác vụ tạo video bất đồng bộ tương thích OpenAI, trả về định danh tác vụ khi thành công.                                                             |
| Truy vấn tác vụ video OpenAI         | `GET /v1/videos/{task_id}`                                                                              | Truy vấn trạng thái, tiến độ và thông tin kết quả của một tác vụ tạo video.                                                                                    |
| Lấy nội dung video                   | `GET /v1/videos/{task_id}/content`                                                                      | Truyền trả nội dung video đã hoàn tất; hệ thống lấy nội dung từ thượng nguồn dựa trên kết quả tác vụ hoặc giải mã các data URL đã lưu.                |
| Video Remix                          | `POST /v1/videos/{video_id}/remix`                                                                      | Gửi một tác vụ bất đồng bộ Remix mới dựa trên một video hiện có.                                                                                              |
| Tạo video phiên bản cũ                | `POST /v1/video/generations`                                                                            | Tương thích với các đường dẫn tạo video phiên bản cũ, tạo tác vụ video bất đồng bộ.                                                                          |
| Truy vấn tác vụ video phiên bản cũ   | `GET /v1/video/generations/{task_id}`                                                                   | Truy vấn trạng thái và kết quả của các tác vụ tạo video phiên bản cũ.                                                                                          |
| Kling tạo video từ văn bản           | `POST /kling/v1/videos/text2video`                                                                      | Gửi tác vụ tạo video từ văn bản theo định dạng Kling; hệ thống sẽ thực hiện chuyển đổi định dạng yêu cầu trước.                                            |
| Kling tạo video từ hình ảnh           | `POST /kling/v1/videos/image2video`                                                                     | Gửi tác vụ tạo video từ hình ảnh theo định dạng Kling.                                                                                                        |
| Truy vấn tác vụ Kling                | `GET /kling/v1/videos/text2video/{task_id}` `GET /kling/v1/videos/image2video/{task_id}`               | Truy vấn kết quả của tác vụ Kling tạo video từ văn bản hoặc từ hình ảnh.                                                                                       |
| API chính thức Jimeng                 | `POST /jimeng/`                                                                                         | Tương thích với định dạng API chính thức của Jimeng, phân biệt thao tác gửi tác vụ và truy vấn thông qua các tham số như `Action` và `Version`. |
| Gửi tác vụ Suno                      | `POST /suno/submit/{action}`                                                                            | Gửi một tác vụ tạo nhạc Suno; loại tác vụ cụ thể được xác định bởi tham số `action`.                                                                            |
| Truy vấn tác vụ Suno                 | `POST /suno/fetch` `GET /suno/fetch/{id}`                                                               | Truy vấn danh sách tác vụ Suno hoặc trạng thái và kết quả của một tác vụ cụ thể.                                                                             |
| Gửi tác vụ Midjourney                | `POST /mj/submit/{action}` `POST /{mode}/mj/submit/{action}`                                           | Hỗ trợ các thao tác tác vụ như `imagine`, `describe`, `blend`, `change`, `simple-change`, `edits`, `video`, `action`, `modal` và `shorten`.              |
| Truy vấn tác vụ Midjourney           | `GET /mj/task/{id}/fetch` `GET /mj/task/{id}/image-seed` `POST /mj/task/list-by-condition`              | Truy vấn trạng thái tác vụ, seed hình ảnh hoặc danh sách tác vụ theo điều kiện; cũng hỗ trợ các đường dẫn có tiền tố `{mode}`.                                  |
| Proxy hình ảnh Midjourney            | `GET /mj/image/{id}` `GET /{mode}/mj/image/{id}`                                                       | Lấy hoặc làm proxy hình ảnh đã tạo dựa trên Midjourney Task ID.                                                                                               |
| Tác vụ mở rộng Midjourney            | `POST /mj/insight-face/swap` `POST /mj/submit/upload-discord-images`                                   | Cung cấ các chức năng mở rộng như hoán đổi khuôn mặt và tải lên hình ảnh Discord.                                                                                |

## Quan hệ với Bảng điều khiển dữ liệu

* Nhật ký là các bản ghi chi tiết, còn bảng điều khiển dữ liệu cung cấp số liệu thống kê được tổng hợp theo thời gian, mô hình, người dùng hoặc kênh.
* Phạm vi lọc, thời điểm làm mới và phương pháp thống kê của chúng có thể khác nhau;
* Yêu cầu mới sẽ xuất hiện trong nhật ký trước tiên, còn dữ liệu biểu đồ có thể cần được tổng hợp hoặc làm mới trước khi cập nhật.

<Callout type="info">
  Khi khắc phục sự cố một lời gọi, nên định vị yêu cầu trong nhật ký chung theo thời gian, mô hình, Request ID hoặc Upstream Request ID trước; với các yêu cầu bất đồng bộ, hãy ghi lại `task_id` do API gửi tác vụ trả về, rồi truy vấn trạng thái tác vụ cuối cùng và chi tiết lỗi. Nếu một tác vụ không thay đổi trong thời gian dài, hãy kiểm tra tính khả dụng của kênh, công tắc thăm dò tác vụ, cài đặt thời gian chờ và các bản nhật ký "Hoàn tiền" tương ứng.
</Callout>
