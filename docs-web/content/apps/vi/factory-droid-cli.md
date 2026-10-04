# Factory Droid CLI

> **Giới thiệu dự án**
>
> Droid CLI là một công cụ dòng lệnh được phát triển bởi Factory AI, được thiết kế để chạy như một tác nhân kỹ sư phần mềm AI. Nó cho phép người dùng tương tác với nhiều mô hình ngôn ngữ lớn thông qua terminal, xây dựng, gỡ lỗi và tái cấu trúc mã, thậm chí tạo ra các ứng dụng hoàn chỉnh.
>
>   - Trang chủ chính thức: [https://factory.ai/product/cli](https://factory.ai/product/cli)
>   - Tài liệu chính thức: [https://docs.factory.ai/cli/getting-started/quickstart](https://docs.factory.ai/cli/getting-started/quickstart)

## Bản demo

![droid.webp](/apps-assets/factory_droid_cli/droid_example.webp)

### Tính năng

| Danh mục                       | Tính năng                                                                                                                     | Giá trị/Năng lực                                               | Ví dụ/Ghi chú                                                             |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Bắt đầu nhanh với CLI           | Cài đặt trong 30 giây; khởi chạy phiên tương tác droid trong thư mục dự án; hỗ trợ macOS/Linux và Windows             | Tích hợp nhanh vào dự án hiện tại, không cần công cụ mới | Cài đặt Windows: `irm https://app.factory.ai/cli/windows \| iex`; Khởi chạy: `droid` |
| Phát triển tính năng toàn diện | Tự động hóa quy trình đầy đủ từ lập kế hoạch đến triển khai đến kiểm thử; quy trình xem xét minh bạch                              | Tăng tốc giao hàng, duy trì sự giám sát của con người                  | Xem và phê duyệt diff bản địa (xem "Minh bạch và Kiểm soát") |
| Hiểu sâu codebase    | Tích hợp kiến thức chia sẻ tổ chức từ codebase, tài liệu, theo dõi sự cố; nhận thức ngữ cảnh, cải thiệp theo thời gian | Đưa ra gợi ý và thay đổi chính xác hơn                          | Liên tục tận dụng kiến thức qua các kho và tài liệu        |
| Tích hợp hệ thống kỹ thuật | Tích hợp nguyên sinh với Jira, Notion, Slack và các công cụ khác; công việc phát triển luôn đồng bộ với quy trình đội ngũ       | Giảm chuyển đổi công cụ và các silo thông tin                    | "etc." chỉ thị thêm các tích hợp                                        |
| Tự động hóa cấp sản xuất    | Quy trình có thể tái sử dụng cục bộ và trong CI/CD; bảo mật và tuân thủ cấp doanh nghiệp được tích hợp sẵn                                  | Tính nhất quán và khả năng kiểm toán                                   | Thích ứng với pipeline và môi trường doanh nghiệp                           |
| Năng lực doanh nghiệp        | Tùy chọn triển khai riêng tư, tuân thủ SOC-2, môi trường cách ly mạng (air-gapped)                                                       | Đáp ứng yêu cầu bảo mật và tuân thủ                     | Ưu tiên bảo mật và chất lượng                                          |
| Nâng cao công cụ hiện có         | Hoạt động trong terminal, IDE và môi trường phát triển hiện có; không cần chuyển trình soạn thảo hoặc học giao diện mới            | Duy trì thói quen làm việc hiện có, chi phí di chuyển thấp              | Tích hợp sâu với các công cụ quen thuộc                                      |
| Minh bạch và Kiểm soát       | Mọi quyết định đều hiển thị và có thể xem xét; giám sát hoàn toàn các thay đổi mã; xem và phê duyệt diff bản địa    | Giảm rủi ro, tăng khả năng kiểm soát                   | Thân thiện kiểm toán, có thể truy xuất                                                 |
| Linh hoạt mô hình              | Không bị khóa vào một nhà cung cấp AI duy nhất; chọn mô hình tốt nhất cho từng tác vụ; hành vi và bộ nhớ tổ chức nhất quán           | Lựa chọn tối ưu giữa hiệu năng và chi phí                    | Hỗ trợ định tuyến đa mô hình                                              |
| Bước tiếp theo & Tài nguyên         | Quickstart, Các trường hợp sử dụng phổ biến, Tích hợp IDE, Cấu hình, AGENTS.md                                                     | Hỗ trợ việc áp dụng và thực hành                              | Xem "Bước tiếp theo/Tài nguyên bổ sung" trên trang                         |

## Phương thức cấu hình mô hình AI

### Hướng dẫn đồ họa Windows

#### 1. Mở Terminal

![windows_open_terminal](/apps-assets/factory_droid_cli/windows_open_terminal.webp)

#### 2. Cài đặt Factory Droid CLI

Lệnh cài đặt một cú nhấp chính thức:

> **Lệnh cài đặt một cú nhấp**
>
> ```powershell
>   irm https://app.factory.ai/cli/windows | iex
>   ```

![windows-install](/apps-assets/factory_droid_cli/windows_install_droid.webp)

#### 3. Sửa đổi tệp cấu hình

Droid CLI yêu cầu sửa đổi tệp cấu hình để sử dụng API bên thứ ba.

![windows-configure.webp](/apps-assets/factory_droid_cli/factory_cli_setup_windows.webp)

> **Sửa đổi biến môi trường**
>
> ```powershell
>   iex (irm 'https://raw.githubusercontent.com/Uter.ai/uter-docs/refs/heads/main/helper/factory-cli-setup.ps1')
>   ```

#### 4. Bắt đầu sử dụng Droid CLI

Bây giờ bạn có thể bắt đầu sử dụng Droid CLI!

> **Khởi chạy Droid CLI**
>
> Khởi chạy Droid CLI trực tiếp:
>
>   ```bash
>   droid
>   ```
>
>   Sử dụng trong một dự án cụ thể:
>
>   ```bash
>   # Điều hướng đến thư mục dự án của bạn
>   cd C:\path\to\your\project
>
>   # Khởi chạy Droid CLI
>   droid
>   ```
>
>   Nhấn Enter để khởi chạy Droid CLI.

Droid CLI yêu cầu người dùng đăng nhập vào tài khoản chính thức (miễn phí) trước khi sử dụng.

#### 5. Giải pháp vấn đề thường gặp trên Windows

> Đây thường là vấn đề quyền. Hãy thử các giải pháp sau:
>
>   - Chạy PowerShell với quyền quản trị
>   - Hoặc cấu hình `npm` sử dụng thư mục người dùng: `npm config set prefix %APPDATA%\npm`

> **Lỗi chính sách thực thi PowerShell**
>
> Nếu gặp hạn chế chính sách thực thi, hãy chạy:
>
>   ```powershell
>   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
>   ```

### Hướng dẫn đồ họa macOS/Linux

#### 1. Cài đặt Droid CLI

> **Cài đặt Droid CLI**
>
> Mở terminal và chạy lệnh sau:
>
>   ```bash
>   curl -fsSL https://app.factory.ai/cli | sh
>   ```

![macos-open-terminal](/apps-assets/factory_droid_cli/macos_install_droid.webp)

![macos-img-02.webp](/apps-assets/factory_droid_cli/macos_install_droid_2.webp)

Làm theo hướng dẫn cài đặt để sửa đổi biến môi trường (sao chép mã gợi ý cài đặt trực tiếp):

Với Linux, chọn `~/.bashrc` hoặc `~/.zshrc` tùy thích hợp.

> **Biến môi trường Droid CLI (chỉ ví dụ)**
>
> ```bash
>   echo 'export PATH=/Users/modify_here/.local/bin:$PATH' >> ~/.zshrc
>   source ~/.zshrc
>   ```

#### 2. Sửa đổi tệp cấu hình

Droid CLI yêu cầu sửa đổi tệp cấu hình để sử dụng API bên thứ ba.

> **Sửa đổi tệp cấu hình một cú nhấp**
>
> ```bash
>   curl -fsSL https://raw.githubusercontent.com/Uter.ai/uter-docs/refs/heads/main/helper/factory-cli-setup.sh | bash
>   ```

![macos-img-03.webp](/apps-assets/factory_droid_cli/macos_configure.webp)

#### 3. Bắt đầu sử dụng Droid CLI

Bây giờ bạn có thể bắt đầu sử dụng Droid CLI!

> **Khởi chạy Droid CLI**
>
> Khởi chạy Droid CLI trực tiếp:
>
>   ```bash
>   droid
>   ```
>
>   Sử dụng trong một dự án cụ thể:
>
>   ```bash
>   # Điều hướng đến thư mục dự án của bạn
>   cd /path/to/your/project
>
>   # Khởi chạy Droid CLI
>   droid
>   ```
>
>   Nhấn Enter để khởi chạy Droid CLI.

> Droid CLI yêu cầu người dùng đăng nhập vào tài khoản chính thức (miễn phí) trước khi sử dụng.
