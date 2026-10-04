# Claude Code

> **Giới thiệu dự án**
>
> Giải phóng sức mạnh thô của Claude trực tiếp trong terminal của bạn. Tìm kiếm các codebase hàng triệu dòng ngay lập tức. Biến các quy trình làm việc tốn hàng giờ thành một lệnh duy nhất. Công cụ của bạn. Quy trình của bạn. Codebase của bạn, tiến hóa với tốc độ suy nghĩ.
>
>   - Trang chủ chính thức: [https://www.anthropic.com/claude-code](https://www.anthropic.com/claude-code)

## Bản demo

![introduce-01.webp](/apps-assets/claude_code/introduce-01.webp)

![introduce-02.webp](/apps-assets/claude_code/introduce-02.webp)

### Tính năng

| **Danh mục**                       | **Tính năng**                                                                                                        |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Hiểu mã**             | Phân tích sâu codebase, sử dụng các tác nhân thông minh để tìm kiếm và hiểu cấu trúc và phụ thuộc của dự án |
|                                    | Tự động tạo các tổng quan mã cấp cao, giúp người dùng nhanh chóng hiểu codebase                 |
| **Chỉnh sửa mã**                   | Hỗ trợ chỉnh sửa cộng tác đa tệp, phù hợp cho các sửa đổi mã phức tạp                               |
|                                    | Cung cấp các gợi ý mã thiết thực và có thể sử dụng, phù hợp với mẫu và kiến trúc dự án                 |
| **Năng lực tích hợp**       | Hỗ trợ thực thi trực tiếp trong terminal, loại bỏ việc chuyển ngữ cảnh                                         |
|                                    | Tích hợp liền mạch với VS Code và các IDE JetBrains, không cần sao chép-dán                                   |
| **Tạo và tối ưu mã** | Tự động tạo mã, viết test, sửa lỗi, hỗ trợ quy trình hoàn chỉnh từ ý tưởng đến commit  |
|                                    | Được tối ưu cho việc tạo và hiểu mã, kết hợp các mô hình tiên tiến như Claude Opus 4                    |
| **Bảo mật & Linh hoạt**         | Các thay đổi yêu cầu ủy quyền rõ ràng từ người dùng, đảm bảo thao tác tệp và lệnh an toàn hơn                          |
|                                    | Thích ứng với tiêu chuẩn mã của người dùng, hỗ trợ cấu hình tùy chỉnh                                                    |
| **Tích hợp chuỗi công cụ**          | Hỗ trợ tích hợp với các công cụ như GitHub và GitLab để đạt được quy trình làm việc tự động hóa                            |
|                                    | Tích hợp với bộ test và hệ thống build, nâng cao các công cụ phát triển hiện có                              |
| **Đa nền tảng & Mở rộng** | Hỗ trợ các hệ điều hành Windows, macOS và Linux                                                             |
|                                    | Có thể cấu hình để chạy trong SDK hoặc GitHub Actions, thích ứng linh hoạt với các nhu cầu khác nhau                              |
| **Các kịch bản ứng dụng chính**      | Làm quen và hiểu codebase, tăng tốc nhanh cho thành viên mới                                             |
|                                    | Quy trình sửa và tối ưu sự cố mã, từ phân tích vấn đề đến gửi PR                             |
|                                    | Tái cấu trúc mã dự án và triển khai tính năng mới                                                          |
| **Điểm nổi bật từ phản hồi người dùng**       | Cải thiện hiệu suất phát triển hàng ngày, tiết kiệm thời gian cho các tác vụ thường quy                                        |
|                                    | Hiệu suất xuất sắc trong xử lý các tác vụ đa bước phức tạp, mở rộng khả năng phát triển                  |

## Phương thức cấu hình mô hình AI

### Hướng dẫn đồ họa Windows

#### 1. Cài đặt môi trường Node.js

Claude Code yêu cầu môi trường Node.js để chạy.

> **Các bước cài đặt môi trường Node.js**
>
> - Mở trình duyệt và truy cập https://nodejs.org/
>   - Nhấn phiên bản "LTS" để tải xuống (khuyên dùng phiên bản Hỗ trợ dài hạn)
>   - Sau khi tải xuống, nhấp đúp tệp .msi
>   - Làm theo trình hướng dẫn cài đặt để hoàn tất, giữ cài đặt mặc định

> **Lưu ý Windows**
>
> - Khuyên dùng PowerShell thay vì CMD
>   - Nếu gặp vấn đề quyền, hãy thử chạy với quyền quản trị
>   - Một số phần mềm diệt virus có thể báo false positive; bạn có thể cần thêm ngoại lệ

![windows-img-01.webp](/apps-assets/claude_code/windows-img-01.webp)

![windows-img-02.webp](/apps-assets/claude_code/windows-img-02.webp)

![windows-img-03.webp](/apps-assets/claude_code/windows-img-03.webp)

![windows-img-04.webp](/apps-assets/claude_code/windows-img-04.webp)

![windows-img-05.webp](/apps-assets/claude_code/windows-img-05.webp)

> **Xác minh cài đặt thành công**
>
> Sau khi cài đặt, mở PowerShell hoặc CMD và nhập các lệnh sau:
>
>   ```bash
>   node --version
>   npm --version
>   ```
>
>   Nếu hiển thị số phiên bản, cài đặt đã thành công.

#### 2. Cài đặt Git Bash

> **Lưu ý Windows**
>
> Trong môi trường Windows, Git Bash là bắt buộc để cài đặt Claude Code. Sau khi cài đặt, việc thiết lập biến môi trường và sử dụng Claude Code vẫn được thực hiện trong PowerShell hoặc CMD thông thường.

> **Tải và cài đặt Git for Windows**
>
> - Truy cập https://git-scm.com/downloads/win
>   - Nhấn "Download for Windows" để tải trình cài đặt
>   - Chạy tệp .exe đã tải xuống
>   - Giữ cài đặt mặc định trong quá trình cài đặt, và nhấn "Next" để hoàn tất

![windows-img-06.webp](/apps-assets/claude_code/windows-img-06.webp)

![windows-img-07.webp](/apps-assets/claude_code/windows-img-07.webp)

![windows-img-08.webp](/apps-assets/claude_code/windows-img-08.webp)

> **Xác minh cài đặt Git Bash**
>
> Sau khi cài đặt, mở Git Bash và nhập lệnh sau để xác minh:
>
>   ```bash
>   git --version
>   ```
>
>   Nếu hiển thị số phiên bản, cài đặt đã thành công.

#### 3. Cài đặt Claude Code

> **Cài đặt Claude Code**
>
> Mở PowerShell và chạy lệnh sau:
>
>   ```bash
>   npm install -g @anthropic-ai/claude-code
>   ```
>
>   Lệnh này sẽ tải xuống và cài đặt phiên bản mới nhất của Claude Code từ kho npm chính thức.

![windows-img-09.webp](/apps-assets/claude_code/windows-img-09.webp)

> **Thêm ~/.local/bin vào PATH (chỉ khi được nhắc)**
>
> ```powershell
>   [Environment]::SetEnvironmentVariable('Path', ([Environment]::GetEnvironmentVariable('Path','User') + ";$HOME\.local\bin"), 'User')
>   ```

> **Xác minh cài đặt Claude Code**
>
> Sau khi cài đặt, nhập lệnh sau để kiểm tra xem đã cài đặt thành công chưa:
>
>   ```bash
>   claude --version
>   ```
>
>   Nếu hiển thị số phiên bản, xin chúc mừng! Claude Code đã được cài đặt thành công.

#### 4. Thiết lập biến môi trường

> **Lệnh thiết lập một cú nhấp (Hệ thống Windows)**
>
> Để cho phép Claude Code kết nối với dịch vụ chuyển tiếp của bạn, bạn cần thiết lập nhiều biến môi trường:

```powershell
iex (irm 'https://raw.githubusercontent.com/Uter.ai/uter-docs/refs/heads/main/helper/claude-cli-setup.ps1')
```

![windows-configure](/apps-assets/claude_code/windows_configure.webp)

#### 5. Bắt đầu sử dụng Claude Code

Bây giờ bạn có thể bắt đầu sử dụng Claude Code!

> **Khởi chạy Claude Code**
>
> Mở PowerShell và khởi chạy Claude Code trực tiếp:
>
>   ```bash
>   claude
>   ```
>
>   Để sử dụng trong một dự án cụ thể:
>
>   ```bash
>   # Điều hướng đến thư mục dự án của bạn
>   cd C:\path\to\your\project
>
>   # Khởi chạy Claude Code
>   claude
>   ```

![windows-img-11.webp](/apps-assets/claude_code/windows-img-11.webp)

![windows-img-12.webp](/apps-assets/claude_code/windows-img-12.webp)

![windows-img-13.webp](/apps-assets/claude_code/windows-img-13.webp)

![windows-img-14.webp](/apps-assets/claude_code/windows-img-14.webp)

![windows-img-15.webp](/apps-assets/claude_code/windows-img-15.webp)

> **Chọn mô hình**
>
> Nhập lệnh:
>
>   ```bash
>   /model
>   ```
>
>   Nhấn Enter để chọn một mô hình; thường thì cài đặt mặc định là đủ.

![windows-img-16.webp](/apps-assets/claude_code/windows-img-16.webp)

![windows-img-17.webp](/apps-assets/claude_code/windows-img-17.webp)

> Lưu ý: Sau khi sửa đổi biến môi trường, tất cả mô hình (bao gồm cả các mô hình được cài sẵn chính thức) sẽ gọi điểm truy cập tùy chỉnh thay vì sử dụng hạn ngạch tài khoản chính thức.

### Hướng dẫn đồ họa macOS

#### 1. Cài đặt Claude Code CLI

Mở Terminal

![macos-img-01.webp](/apps-assets/claude_code/macos-img-01.webp)

> **Cài đặt Claude Code**
>
> Mở Terminal và chạy lệnh sau:
>
>   ```bash
>   curl -fsSL https://claude.ai/install.sh | bash
>   ```
>
>   Tùy chọn: Chạy lệnh được cung cấp khi được nhắc
>
>   ```bash
>   echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc && source ~/.bashrc
>   ```

![macos-img-02.webp](/apps-assets/claude_code/macos-img-02.webp)

#### 2. Thiết lập biến môi trường

Để cho phép Claude Code kết nối với dịch vụ chuyển tiếp bên thứ ba, bạn cần thiết lập biến môi trường:

> **Thiết lập một cú nhấp cho biến môi trường Claude Code**
>
> Nhập lệnh:
>
>   ```bash
>   curl -fsSL https://raw.githubusercontent.com/Uter.ai/uter-docs/refs/heads/main/helper/claude-cli-setup.sh | bash
>   ```

![macos-configure](/apps-assets/claude_code/macos_configure.webp)

> **Xác minh cài đặt Claude Code**
>
> Sau khi cài đặt, nhập lệnh sau để kiểm tra xem đã cài đặt thành công chưa:
>
>   ```bash
>   claude --version
>   ```
>
>   Nếu hiển thị số phiên bản, xin chúc mừng! Claude Code đã được cài đặt thành công.

#### 3. Bắt đầu sử dụng Claude Code

Bây giờ bạn có thể bắt đầu sử dụng Claude Code!

> **Khởi chạy Claude Code**
>
> Khởi chạy Claude Code trực tiếp:
>
>   ```bash
>   claude
>   ```
>
>   Để sử dụng trong một dự án cụ thể:
>
>   ```bash
>   # Điều hướng đến thư mục dự án của bạn
>   cd /path/to/your/project
>
>   # Khởi chạy Claude Code
>   claude
>   ```

![macos-img-04.webp](/apps-assets/claude_code/macos-img-04.webp)

![macos-img-05.webp](/apps-assets/claude_code/macos-img-05.webp)

![macos-img-06.webp](/apps-assets/claude_code/macos-img-06.webp)

![macos-img-07.webp](/apps-assets/claude_code/macos-img-07.webp)

![macos-img-08.webp](/apps-assets/claude_code/macos-img-08.webp)

> **Chọn mô hình (Tùy chọn)**
>
> Nhập lệnh:
>
>   ```bash
>   /model
>   ```
>
>   Nhấn Enter để chọn một mô hình chính thức; thường thì mô hình mặc định là đủ.

![macos-img-09.webp](/apps-assets/claude_code/macos-img-09.webp)

![macos-img-10.webp](/apps-assets/claude_code/macos-img-10.webp)

![macos-img-11.webp](/apps-assets/claude_code/macos-img-11.webp)

> Lưu ý: Sau khi sửa đổi biến môi trường `ANTHROPIC_BASE_URL`, tất cả mô hình (bao gồm cả các mô hình được cài sẵn chính thức) sẽ gọi điểm truy cập tùy chỉnh thay vì sử dụng hạn ngạch tài khoản chính thức.

#### 4. Các vấn đề thường gặp trên macOS

> **Cài đặt bảo mật macOS ngăn chặn thực thi**
>
> Nếu hệ thống ngăn Claude Code chạy:
>
>   - Mở "System Preferences" → "Security & Privacy"
>   - Nhấn "Open Anyway" hoặc "Allow"
>   - Hoặc chạy trong Terminal: `sudo spctl --master-disable`

### Hướng dẫn đồ họa Linux

#### 1. Cài đặt Claude Code

![linux-img-01.webp](/apps-assets/claude_code/linux-img-01.webp)

> **Cài đặt Claude Code**
>
> Mở Terminal và chạy lệnh sau:
>
>   ```bash
>   curl -fsSL https://claude.ai/install.sh | bash
>   ```
>
>   Nếu gặp vấn đề quyền, bạn có thể dùng sudo:
>
>   ```bash
>   sudo curl -fsSL https://claude.ai/install.sh | bash
>   ```

![linux-img-03.webp](/apps-assets/claude_code/linux-img-03.webp)

> **Xác minh cài đặt Claude Code**
>
> Sau khi cài đặt, nhập lệnh sau để kiểm tra xem đã cài đặt thành công chưa:
>
>   ```bash
>   claude --version
>   ```
>
>   Nếu hiển thị số phiên bản, xin chúc mừng! Claude Code đã được cài đặt thành công.

#### 2. Thiết lập biến môi trường

Để cho phép Claude Code kết nối với dịch vụ chuyển tiếp của bạn, bạn cần thiết lập hai biến môi trường:

> **Sửa đổi biến môi trường một cú nhấp**
>
> Nhập lệnh:
>
>   ```bash
>   curl -fsSL https://raw.githubusercontent.com/Uter.ai/uter-docs/refs/heads/main/helper/claude-cli-setup.sh | bash
>   ```

![macos-configure](/apps-assets/claude_code/macos_configure.webp)

#### 3. Bắt đầu sử dụng Claude Code

Bây giờ bạn có thể bắt đầu sử dụng Claude Code!

> **Khởi chạy Claude Code**
>
> Khởi chạy Claude Code trực tiếp:
>
>   ```bash
>   claude
>   ```
>
>   Để sử dụng trong một dự án cụ thể:
>
>   ```bash
>   # Điều hướng đến thư mục dự án của bạn
>   cd /path/to/your/project
>
>   # Khởi chạy Claude Code
>   claude
>   ```

![linux-img-03.webp](/apps-assets/claude_code/linux-img-03.webp)

![linux-img-04.webp](/apps-assets/claude_code/linux-img-04.webp)

![linux-img-05.webp](/apps-assets/claude_code/linux-img-05.webp)

> **Chọn mô hình**
>
> Nhập lệnh:
>
>   ```bash
>   /model
>   ```
>
>   Nhấn Enter để chọn một mô hình chính thức; thường thì mô hình mặc định là đủ.

![linux-img-06.webp](/apps-assets/claude_code/linux-img-06.webp)

![linux-img-07.webp](/apps-assets/claude_code/linux-img-07.webp)

![linux-img-08.webp](/apps-assets/claude_code/linux-img-08.webp)

![linux-img-09.webp](/apps-assets/claude_code/linux-img-09.webp)

> Lưu ý: Sau khi sửa đổi biến môi trường `ANTHROPIC_BASE_URL`, tất cả mô hình (bao gồm cả các mô hình được cài sẵn chính thức) sẽ gọi điểm truy cập tùy chỉnh thay vì sử dụng hạn ngạch tài khoản chính thức.

#### 4. Các vấn đề thường gặp trên Linux

> **Thiếu thư viện phụ thuộc**
>
> Một số bản phân phối Linux yêu cầu cài đặt thêm các phụ thuộc:
>
>   ```bash
>   # Ubuntu/Debian
>   sudo apt install build-essential
>
>   # CentOS/RHEL
>   sudo dnf groupinstall "Development Tools"
>   ```

> **Biến môi trường không có hiệu lực**
>
> Kiểm tra các điểm sau:
>
>   - Xác nhận bạn đã sửa đúng tệp cấu hình (`.bashrc` hoặc `.zshrc`)
>   - Khởi động lại terminal hoặc chạy `source ~/.bashrc`
>   - Xác minh cài đặt: `echo $ANTHROPIC_BASE_URL`
