# Hệ thống (system)

## Lấy thông tin giới thiệu (Get About Information)

🔓 Không cần xác thực

`GET` `/api/about`

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Lấy nội dung trang chủ (Get Home Page Content)

🔓 Không cần xác thực

`GET` `/api/home_page_content`

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Lấy danh sách mô hình (Get Model List)

🔐 Yêu cầu đăng nhập (quyền User)

`GET` `/api/models`

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Lấy thông báo (Get Announcements)

🔓 Không cần xác thực

`GET` `/api/notice`

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Lấy thông tin giá (Get Pricing Information)

🔓 Không cần xác thực (có thể đăng nhập tùy chọn)

`GET` `/api/pricing`

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Lấy chính sách bảo mật (Get Privacy Policy)

🔓 Không cần xác thực

`GET` `/api/privacy-policy`

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Lấy cấu hình tỷ lệ (Get Ratio Configuration)

🔓 Không cần xác thực

`GET` `/api/ratio_config`

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Lấy trạng thái khởi tạo (Get Initialization Status)

🔓 Không cần xác thực

`GET` `/api/setup`

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Khởi tạo hệ thống (Initialize System)

🔓 Không cần xác thực

`POST` `/api/setup`

### Thân yêu cầu (`application/json`)

| Trường | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `username` | string | Không | — |
| `password` | string | Không | — |

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Lấy trạng thái hệ thống (Get System Status)

🔓 Không cần xác thực

`GET` `/api/status`

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Kiểm tra trạng thái hệ thống (Test System Status)

👨‍💼 Yêu cầu quyền quản trị viên (Admin)

`GET` `/api/status/test`

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Lấy trạng thái Uptime Kuma (Get Uptime Kuma Status)

🔓 Không cần xác thực

`GET` `/api/uptime/status`

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Lấy thỏa thuận người dùng (Get User Agreement)

🔓 Không cần xác thực

`GET` `/api/user-agreement`

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |
