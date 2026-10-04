# Xác thực người dùng (user-auth)

## Gửi email đặt lại mật khẩu (Send Password Reset Email)

🔓 Không cần xác thực

`GET` `/api/reset_password`

### Tham số yêu cầu

| Tên tham số | Vị trí | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|---|
| `email` | query | string | Có | — |

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Lấy danh sách nhóm người dùng (Get User Group List)

🔓 Không cần xác thực

`GET` `/api/user/groups`

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Đăng nhập xác thực hai yếu tố (Two-Factor Authentication Login)

🔓 Không cần xác thực (quy trình đăng nhập)

`POST` `/api/user/login/2fa`

### Thân yêu cầu (`application/json`)

| Trường | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `code` | string | Không | — |

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Đăng nhập người dùng (User Login)

🔓 Không cần xác thực

`POST` `/api/user/login`

### Thân yêu cầu (`application/json`)

| Trường | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `username` | string | Không | — |
| `password` | string | Không | — |

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Đăng xuất người dùng (User Logout)

🔓 Không cần xác thực

`GET` `/api/user/logout`

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Bắt đầu đăng nhập Passkey (Start Passkey Login)

🔓 Không cần xác thực

`POST` `/api/user/passkey/login/begin`

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Hoàn tất đăng nhập Passkey (Complete Passkey Login)

🔓 Không cần xác thực

`POST` `/api/user/passkey/login/finish`

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Đăng ký người dùng (User Registration)

🔓 Không cần xác thực

`POST` `/api/user/register`

### Thân yêu cầu (`application/json`)

| Trường | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `username` | string | Không | — |
| `password` | string | Không | — |
| `email` | string | Không | — |
| `verification_code` | string | Không | — |
| `aff_code` | string | Không | — |

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Đặt lại mật khẩu (Reset Password)

🔓 Không cần xác thực

`POST` `/api/user/reset`

### Thân yêu cầu (`application/json`)

| Trường | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `email` | string | Không | — |
| `token` | string | Không | — |
| `password` | string | Không | — |

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Gửi mã xác thực email (Send Email Verification Code)

🔓 Không cần xác thực

`GET` `/api/verification`

### Tham số yêu cầu

| Tên tham số | Vị trí | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|---|
| `email` | query | string | Có | — |

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |
