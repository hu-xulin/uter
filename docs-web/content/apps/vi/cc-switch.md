# CC Switch - Công cụ quản lý AI CLI tất cả trong một

> **Tùy chọn cài đặt trò chuyện**
>
> Trong bảng điều khiển Uter tại System Settings -> Chat Settings, bạn có thể thêm
>   lối tắt sau để bật điền một cú nhấp cho CC Switch từ trang quản lý token:

    ```json
    { "CC Switch": "ccswitch" }
    ```

> 🔀 CC Switch là một công cụ quản lý AI CLI đa nền tảng, mã nguồn mở, tất cả trong một. Nó hỗ trợ
>   chuyển đổi nhà cung cấp chỉ với một cú nhấp cho Claude Code, Codex và Gemini CLI, quản lý máy chủ
>   MCP thống nhất, quản lý lời nhắc hệ thống và quản lý mở rộng Skills — cho phép bạn tự do chuyển
>   đổi giữa nhiều trợ lý mã hóa AI mà không cần chỉnh sửa thủ công tệp cấu hình.

- Kho GitHub: [https://github.com/farion1231/cc-switch](https://github.com/farion1231/cc-switch)
- Tải xuống: [GitHub Releases](https://github.com/farion1231/cc-switch/releases)

## Tính năng chính

### 🔌 Quản lý nhà cung cấp

- **Chuyển đổi một cú nhấp** — Chuyển đổi tức thì giữa cấu hình API của Claude Code, Codex và Gemini, không cần biến môi trường hay chỉnh sửa tệp cấu hình thủ công
- **Hỗ trợ đa điểm cuối** — Cấu hình nhiều điểm cuối cho mỗi nhà cung cấp với quản lý khóa API và kiểm tra tốc độ độ trễ
- **Cấu hình mô hình 4 cấp** — Lựa chọn mô hình chi tiết qua các cấp Haiku / Sonnet / Opus / Tùy chỉnh

### 🛠️ Quản lý máy chủ MCP

- **Quản lý chéo ứng dụng thống nhất** — Quản lý máy chủ MCP cho Claude / Codex / Gemini từ một bảng duy nhất
- **Ba loại truyền tải** — Hỗ trợ stdio, HTTP và SSE (Server-Sent Events)
- **Đồng bộ tự động** — Nhập/xuất thống nhất với đồng bộ hóa hai chiều

### 💬 Quản lý lời nhắc

- **Nhiều lời nhắc hệ thống cài sẵn** — Không giới hạn cài sẵn với chuyển đổi nhanh
- **Hỗ trợ chéo ứng dụng** — Claude (`CLAUDE.md`), Codex (`AGENTS.md`), Gemini (`GEMINI.md`)
- **Trình soạn thảo Markdown** — CodeMirror 6 với xem trước trực tiếp

### 🌐 Hỗ trợ đa nền tảng

- **Ứng dụng máy tính để bàn** — Trình cài đặt gốc cho Windows, macOS và Linux
- **Phiên bản web** — Giao diện truy cập qua trình duyệt cho máy chủ không giao diện / môi trường SSH
- **Phiên bản CLI** — Cả chế độ menu tương tác và dòng lệnh

## Tích hợp Uter

CC Switch hỗ trợ giao thức Deep Link `ccswitch://`, cho phép nhập cấu hình nhà cung cấp chỉ với một cú nhấp từ trang quản lý token Uter.

### Các bước cấu hình

1. **Trên trang quản lý token Uter, nhấn menu thả xuống cho token tương ứng**
   Chọn tùy chọn **CC Switch** từ menu. Hệ thống sẽ tự động khởi chạy CC Switch và mở hộp thoại cấu hình.

2. **Hoàn tất cấu hình trong hộp thoại**
   ![Hộp thoại cấu hình CC Switch](/apps-assets/cc_switch/fill_dialog.webp)

   Mô tả các trường:
   - **Application**: Chuyển loại ứng dụng ở trên cùng — **Claude** / **Codex** / **Gemini**, chọn ứng dụng mục tiêu theo nhu cầu
   - **Name**: Nhập tên cho cấu hình này (ví dụ `My Claude`) để dễ dàng nhận diện và chuyển đổi trong CC Switch sau này
   - **Main Model** (bắt buộc) — Mô hình chính được sử dụng mặc định
   - **Haiku Model** — Mô hình nhẹ, nhanh
   - **Sonnet Model** — Mô hình cân bằng
   - **Opus Model** — Mô hình mạnh nhất

   Tất cả mô hình đều là lựa chọn từ menu thả xuống; các trường chưa chọn hiển thị "Please select model".

3. **Hoàn tất**
   Nhấn **"Open CC Switch"** để nhập cấu hình vào CC Switch và bắt đầu sử dụng; nhấn **"Cancel"** để hủy bỏ.

## Cài đặt

### macOS (Khuyên dùng dùng Homebrew)

```shell
brew tap farion1231/ccswitch
brew install --cask cc-switch
```

### Windows

Tải trình cài đặt `.msi` hoặc tệp `.zip` di động từ [Releases](https://github.com/farion1231/cc-switch/releases).

### Linux

Tải gói `.deb` hoặc `.AppImage` từ [Releases](https://github.com/farion1231/cc-switch/releases).

Người dùng ArchLinux:

```shell
paru -S cc-switch-bin
```

### Phiên bản Web (Máy chủ không giao diện / SSH)

```shell
wget https://github.com/farion1231/cc-switch/releases/latest/download/cc-switch-web-linux-x64.tar.gz
tar -xzf cc-switch-web-linux-x64.tar.gz
cd cc-switch-web/
./cc-switch-web
```

Cổng mặc định `17666`, truy cập qua trình duyệt tại `http://localhost:17666`.

## Liên kết liên quan

- [Kho GitHub](https://github.com/farion1231/cc-switch)
- [Nhật ký thay đổi](https://github.com/farion1231/cc-switch/blob/main/CHANGELOG.md)
- [Kho phiên bản Web](https://github.com/cp-yu/cc-switch-web)
- [Kho phiên bản CLI](https://github.com/thomas-jack/cc-switch-cli)
