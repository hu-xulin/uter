# Xác thực hai yếu tố (two-factor-auth)

## Tạo lại mã dự phòng (Regenerate Backup Codes)

🔐 Yêu cầu đăng nhập (quyền User)

`POST` `/api/user/2fa/backup_codes`

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Tắt 2FA (Disable 2FA)

🔐 Yêu cầu đăng nhập (quyền User)

`POST` `/api/user/2fa/disable`

### Thân yêu cầu (`application/json`)

| Trường | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `code` | string | Không | — |

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Bật 2FA (Enable 2FA)

🔐 Yêu cầu đăng nhập (quyền User)

`POST` `/api/user/2fa/enable`

### Thân yêu cầu (`application/json`)

| Trường | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `code` | string | Không | — |

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Thiết lập 2FA (Set Up 2FA)

🔐 Yêu cầu đăng nhập (quyền User)

`POST` `/api/user/2fa/setup`

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Lấy thống kê 2FA (Get 2FA Statistics)

👨‍💼 Yêu cầu quyền quản trị viên (Admin)

`GET` `/api/user/2fa/stats`

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Lấy trạng thái 2FA (Get 2FA Status)

🔐 Yêu cầu đăng nhập (quyền User)

`GET` `/api/user/2fa/status`

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |
