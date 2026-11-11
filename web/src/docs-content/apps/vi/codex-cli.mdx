# OpenAI Codex CLI

> **Giới thiệu dự án**
>
> Codex CLI là một tác nhân mã hóa từ OpenAI, chạy cục bộ trên máy tính của bạn.
>
>   - Trang chủ chính thức: [https://chatgpt.com/codex](https://chatgpt.com/codex)
>   - Trang dự án: [https://github.com/openai/codex](https://github.com/openai/codex)

## Bản demo

![introduce-01.webp](/apps-assets/codex/introduce-01.webp)

### Tính năng

| Danh mục | Tính năng |
| --- | --- |
| Trợ lý mã hóa dựa trên terminal | Codex CLI là trợ lý mã hóa tương tác dựa trên terminal để chỉnh sửa mã, tạo bản vá và chạy lệnh trên dòng lệnh. |
| Kiến trúc hướng công cụ  | Cung cấp các công cụ như `apply_patch`, `shell`, `update_plan` và `multi_tool_use` để sửa đổi có kiểm soát các tệp và thao tác kho mã. |
| Chỉnh sửa bản vá nguyên tử      | Sử dụng định dạng bản vá chuyên biệt để thêm/cập nhật/xóa tệp một cách nguyên tử qua `apply_patch`, hỗ trợ kiểm toán và hoàn tác. |
| Hộp cát và phê duyệt      | Hỗ trợ các chính sách hộp cát (ví dụ `workspace-write`, `read-only`) và chế độ phê duyệt (`on-request`, `on-failure`, `never`) để kiểm soát quyền ghi và quyền truy cập mạng. |
| Theo dõi kế hoạch             | `update_plan` được dùng để liệt kê các bước và theo dõi trạng thái, yêu cầu chỉ một bước `in_progress` tại mọi thời điểm để duy trì tiến độ rõ ràng. |
| Giao thức tương tác      | Gửi các giải thích giới thiệu ngắn gọn trước các thao tác quan trọng, duy trì giọng điệu thân thiện, súc tích và cung cấp cập nhật tiến độ. |
| Ràng buộc bảo mật      | Tuân thủ các quy tắc nghiêm ngặt (không tự ý thay đổi tệp không liên quan, không thêm tiêu đề bản quyền, không thực thi lệnh phá hoại), yêu cầu người dùng phê duyệt các thao tác nhạy cảm. |
| Kiểm thử và định dạng    | Khuyên chạy các test và công cụ định dạng liên quan sau khi chỉnh sửa, nhưng không chịu trách nhiệm sửa các vấn đề không liên quan đến tác vụ hiện tại. |
| Đầu ra và phong cách          | Đầu ra cuối cùng tuân thủ quy cách hiển thị CLI (ví dụ `**` cho tiêu đề, dấu backtick cho đường dẫn/lệnh), duy trì cấu trúc súc tích, dễ quét. |
| Thực thi song song        | Hỗ trợ chạy nhiều công cụ song song qua `multi_tool_use.parallel` để cải thiện hiệu quả. |

## Phương thức cấu hình mô hình AI

### Hướng dẫn đồ họa Windows

#### 1. Mở Terminal

![windows_open_terminal](/apps-assets/codex/windows_open_terminal.webp)

#### 2. Cài đặt WSL

Để có hiệu năng tối ưu trên Windows, vui lòng cài đặt và sử dụng Windows Subsystem for Linux (WSL2).

> **Cài đặt WSL2, khởi động lại máy tính Windows**
>
> ```powershell
>   wsl --install
>   ```
>
>   Khởi động lại máy tính Windows sau khi cài đặt.

> **Lưu ý Windows**
>
> - Khuyên dùng PowerShell thay vì CMD.
>   - Nếu gặp vấn đề quyền, hãy thử chạy với quyền quản trị.
>   - Một số phần mềm diệt virus có thể báo false positive; bạn cần thêm ngoại lệ.

![windows-img-03.webp](/apps-assets/codex/windows-img-03.webp)

> **Tải trình quản lý phiên bản Node (NVM)**
>
> ```bash
>   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/master/install.sh | bash
>   ```

![windows-img-04.webp](/apps-assets/codex/windows-img-04.webp)

> **NVM cài đặt Node.js 22**
>
> Mở một cửa sổ PowerShell mới trong thanh tab và mở WSL:
>
>   ```bash
>   wsl
>   ```
>
>   Cài đặt Node.js (số phiên bản thay đổi theo thời gian; vui lòng cài đặt phiên bản tương ứng theo yêu cầu của [trang chủ OpenAI](https://developers.openai.com/codex/windows)):
>
>   ```bash
>   nvm install 22
>   ```

![windows-img-05.webp](/apps-assets/codex/windows-img-05.webp)

#### 3. Cài đặt Codex CLI

> **Cài đặt Codex CLI**
>
> ```bash
>   npm i -g @openai/codex
>   ```
>
>   Lệnh này sẽ tải xuống và cài đặt phiên bản mới nhất của Codex CLI từ kho npm chính thức.

![windows-img-06.webp](/apps-assets/codex/windows-img-06.webp)

#### 4. Sửa đổi tệp cấu hình

> **Sửa đổi một cú nhấp tệp cấu hình Codex CLI**
>
> ```powershell
>   iex (irm 'https://raw.githubusercontent.com/Uter.ai/uter-docs/refs/heads/main/helper/codex-cli-setup.ps1')
>   ```

![windows-configure](/apps-assets/codex/windows_configure.webp)

#### 5. Bắt đầu sử dụng Codex CLI

Bây giờ bạn có thể bắt đầu sử dụng Codex CLI!

> **Khởi chạy Codex CLI**
>
> Khởi chạy WSL2:
>
>   ```bash
>   wsl
>   ```
>
>   Khởi chạy Codex CLI trực tiếp:
>
>   ```bash
>   codex
>   ```
>
>   Sử dụng trong một dự án cụ thể:
>
>   ```bash
>   cd mnt/c/path/to/your/project
>   codex
>   ```
>
>   Nhấn Enter để khởi chạy Codex CLI.

![windows-img-09.webp](/apps-assets/codex/windows-img-09.webp)

![windows-img-10.webp](/apps-assets/codex/windows-img-10.webp)

> Đặt quyền Codex CLI: 1. Cho phép Codex sửa đổi tệp trực tiếp; 2. Codex yêu cầu phê duyệt thủ công để sửa đổi tệp.

> **Chọn mô hình**
>
> ```bash
>   /model
>   ```

![windows-img-11.webp](/apps-assets/codex/windows-img-11.webp)

![windows-img-12.webp](/apps-assets/codex/windows-img-12.webp)

![windows-img-13.webp](/apps-assets/codex/windows-img-13.webp)

![windows-img-14.webp](/apps-assets/codex/windows-img-14.webp)

> Lưu ý: Sau khi sửa đổi địa chỉ API, tất cả mô hình (bao gồm cả các mô hình được cài sẵn chính thức) sẽ gọi điểm truy cập do bạn cấu hình, thuộc sở hữu tổ chức hoặc cá nhân, được ủy quyền hợp pháp. Vui lòng sử dụng Uter tự triển khai của bạn, hoặc xác nhận rằng nhà cung cấp dịch vụ có dịch vụ Uter với ủy quyền upstream hợp pháp và các nghĩa vụ tuân thủ. Không kết nối địa chỉ API hoặc khóa từ nguồn không xác định vào môi trường sản xuất.

### Hướng dẫn đồ họa macOS

#### 1. Cài đặt Homebrew (Bỏ qua nếu đã cài)

Homebrew là trình quản lý gói còn thiếu cho macOS.

Trang chủ: https://brew.sh

![macos-img-01.webp](/apps-assets/codex/macos-img-01.webp)

> **Cài đặt Homebrew**
>
> ```bash
>   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
>   ```

![macos-img-02.webp](/apps-assets/codex/macos-img-02.webp)

![macos-img-03.webp](/apps-assets/codex/macos-img-03.webp)

![macos-img-04.webp](/apps-assets/codex/macos-img-04.webp)

#### 2. Cài đặt môi trường Node.js

> **Các bước cài đặt môi trường Node.js**
>
> Cập nhật Homebrew:
>
>   ```bash
>   brew update
>   ```
>
>   Cài đặt Node.js:
>
>   ```bash
>   brew install node
>   ```

> **Lưu ý macOS**
>
> - Nếu gặp vấn đề quyền, bạn có thể cần dùng `sudo`.
>   - Lần chạy đầu có thể yêu cầu quyền trong System Preferences.
>   - Khuyên dùng Terminal hoặc iTerm2.

![macos-img-05.webp](/apps-assets/codex/macos-img-05.webp)

![macos-img-06.webp](/apps-assets/codex/macos-img-06.webp)

> **Xác minh cài đặt thành công**
>
> Sau khi cài đặt, mở terminal và nhập các lệnh sau:
>
>   ```bash
>   node --version
>   npm --version
>   ```
>
>   Nếu hiển thị số phiên bản, cài đặt đã thành công.

#### 3. Cài đặt Codex CLI

> **Cài đặt Codex CLI**
>
> Mở terminal và chạy lệnh sau:
>
>   ```bash
>   # Cài đặt Codex CLI toàn cục
>   npm install -g @openai/codex
>   ```
>
>   Nếu gặp vấn đề quyền, bạn có thể dùng sudo:
>
>   ```bash
>   sudo npm install -g @openai/codex
>   ```

![macos-img-07.webp](/apps-assets/codex/macos-img-07.webp)

> **Xác minh cài đặt Codex CLI**
>
> Sau khi cài đặt, nhập lệnh sau để kiểm tra xem cài đặt đã thành công chưa:
>
>   ```bash
>   codex --version
>   ```
>
>   Nếu hiển thị số phiên bản, xin chúc mừng! Codex CLI đã được cài đặt thành công.

#### 4. Sửa đổi tệp cấu hình

> **Sửa đổi một cú nhấp tệp cấu hình Codex CLI**
>
> ```bash
>   curl -fsSL https://raw.githubusercontent.com/Uter.ai/uter-docs/refs/heads/main/helper/codex-cli-setup.sh | bash
>   ```

![macos-configure](/apps-assets/codex/macos_configure.webp)

#### 5. Bắt đầu sử dụng Codex CLI

Bây giờ bạn có thể bắt đầu sử dụng Codex CLI!

> **Khởi chạy Codex CLI**
>
> Khởi chạy Codex CLI trực tiếp:
>
>   ```bash
>   codex
>   ```
>
>   Sử dụng trong một dự án cụ thể:
>
>   ```bash
>   cd /path/to/your/project
>   codex
>   ```
>
>   Nhấn Enter để khởi chạy Codex CLI.

![macos-img-09.webp](/apps-assets/codex/macos-img-09.webp)

![macos-img-10.webp](/apps-assets/codex/macos-img-10.webp)

> Đặt quyền Codex CLI: 1. Cho phép Codex sửa đổi tệp trực tiếp; 2. Codex yêu cầu phê duyệt thủ công để sửa đổi tệp.

![macos-img-11.webp](/apps-assets/codex/macos-img-11.webp)

![macos-img-12.webp](/apps-assets/codex/macos-img-12.webp)

![macos-img-13.webp](/apps-assets/codex/macos-img-13.webp)

![macos-img-14.webp](/apps-assets/codex/macos-img-14.webp)

> Lưu ý: Sau khi sửa đổi địa chỉ API, tất cả mô hình (bao gồm cả các mô hình được cài sẵn chính thức) sẽ gọi điểm truy cập do bạn cấu hình, thuộc sở hữu tổ chức hoặc cá nhân, được ủy quyền hợp pháp.

#### 6. Các vấn đề và giải pháp thường gặp trên macOS

> **Lỗi quyền khi cài đặt**
>
> Hãy thử các giải pháp sau:
>
>   - Cài đặt với `sudo`: `sudo npm install -g @openai/codex`
>   - Hoặc cấu hình `npm` sử dụng thư mục người dùng: `npm config set prefix ~/.npm-global`

> **Cài đặt bảo mật macOS ngăn chặn việc chạy**
>
> Nếu hệ thống ngăn Codex CLI chạy:
>
>   - Mở "System Preferences" → "Security & Privacy"
>   - Nhấn "Open Anyway" hoặc "Allow"
>   - Hoặc chạy trong Terminal: `sudo spctl --master-disable`

### Hướng dẫn đồ họa Linux

#### 1. Cài đặt môi trường Node.js

Codex CLI yêu cầu môi trường Node.js để chạy.

> **Các bước cài đặt môi trường Node.js**
>
> Thêm kho NodeSource:
>
>   ```bash
>   sudo curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
>   ```
>
>   Cài đặt Node.js:
>
>   ```bash
>   sudo apt-get install -y nodejs
>   ```

> **Lưu ý Linux**
>
> - Một số bản phân phối có thể yêu cầu thêm các phụ thuộc.
>   - Nếu gặp vấn đề quyền, hãy dùng sudo.
>   - Đảm bảo người dùng của bạn có quyền ghi trong thư mục toàn cục của npm.

![linux-img-01.webp](/apps-assets/codex/linux-img-01.webp)

![linux-img-02.webp](/apps-assets/codex/linux-img-02.webp)

> **Xác minh cài đặt thành công**
>
> Sau khi cài đặt, mở terminal và nhập các lệnh sau:
>
>   ```bash
>   node --version
>   npm --version
>   ```
>
>   Nếu hiển thị số phiên bản, cài đặt đã thành công.

#### 2. Cài đặt Codex CLI

> **Cài đặt Codex CLI**
>
> Mở terminal và chạy lệnh sau:
>
>   ```bash
>   # Cài đặt Codex CLI toàn cục
>   npm install -g @openai/codex
>   ```
>
>   Nếu gặp vấn đề quyền, bạn có thể dùng sudo:
>
>   ```bash
>   sudo npm install -g @openai/codex
>   ```

![linux-img-03.webp](/apps-assets/codex/linux-img-03.webp)

> **Xác minh cài đặt Codex CLI**
>
> Sau khi cài đặt, nhập lệnh sau để kiểm tra xem cài đặt đã thành công chưa:
>
>   ```bash
>   codex --version
>   ```
>
>   Nếu hiển thị số phiên bản, xin chúc mừng! Codex CLI đã được cài đặt thành công.

#### 3. Sửa đổi tệp cấu hình

> **Sửa đổi một cú nhấp tệp cấu hình Codex CLI**
>
> ```bash
>   curl -fsSL https://raw.githubusercontent.com/Uter.ai/uter-docs/refs/heads/main/helper/codex-cli-setup.sh | bash
>   ```

![macos-configure](/apps-assets/codex/macos_configure.webp)

#### 4. Bắt đầu sử dụng Codex CLI

Bây giờ bạn có thể bắt đầu sử dụng Codex CLI!

> **Khởi chạy Codex CLI**
>
> Khởi chạy Codex CLI trực tiếp:
>
>   ```bash
>   codex
>   ```
>
>   Sử dụng trong một dự án cụ thể:
>
>   ```bash
>   # Điều hướng đến thư mục dự án của bạn
>   cd /path/to/your/project
>
>   # Khởi chạy Codex CLI
>   codex
>   ```
>
>   Nhấn Enter để khởi chạy Codex CLI.

![linux-img-05.webp](/apps-assets/codex/linux-img-05.webp)

![linux-img-06.webp](/apps-assets/codex/linux-img-06.webp)

> Đặt quyền Codex CLI: 1. Cho phép Codex sửa đổi tệp trực tiếp; 2. Codex yêu cầu phê duyệt thủ công để sửa đổi tệp.

![linux-img-07.webp](/apps-assets/codex/linux-img-07.webp)

![linux-img-08.webp](/apps-assets/codex/linux-img-08.webp)

![linux-img-09.webp](/apps-assets/codex/linux-img-09.webp)

![linux-img-10.webp](/apps-assets/codex/linux-img-10.webp)

> Lưu ý: Sau khi sửa đổi địa chỉ API, tất cả mô hình (bao gồm cả các mô hình được cài sẵn chính thức) sẽ gọi điểm truy cập do bạn cấu hình, thuộc sở hữu tổ chức hoặc cá nhân, được ủy quyền hợp pháp.

#### 5. Các vấn đề và giải pháp thường gặp trên Linux

> **Lỗi quyền khi cài đặt**
>
> Hãy thử các giải pháp sau:
>
>   - Cài đặt với `sudo`: `sudo npm install -g @openai/codex`
>   - Hoặc cấu hình `npm` sử dụng thư mục người dùng: `npm config set prefix ~/.npm-global`
>   - Sau đó thêm vào PATH: `export PATH=~/.npm-global/bin:$PATH`

> **Thiếu thư viện phụ thuộc**
>
> Một số bản phân phối Linux yêu cầu thêm các phụ thuộc:
>
>   ```bash
>   # Ubuntu/Debian
>   sudo apt install build-essential
>   ```
>
>   ```bash
>   # CentOS/RHEL
>   sudo dnf groupinstall "Development Tools"
>   ```
