# Mô tả hệ thống xác thực (Auth)

## Mô tả

Các giao diện quản lý backend áp dụng cơ chế xác thực đa cấp độ, thường gồm: **Public**, **User**, **Admin**, **Root**.

## Phương thức xác thực (Chọn một)

### Phiên (Session)

Lấy Session qua giao diện đăng nhập:

- `POST /api/user/login`

### Access Token (Khuyên dùng)

Mang theo trong header yêu cầu:

```text
Authorization: Bearer {token}
```

Token có thể được tạo trong "Cài đặt cá nhân - Cài đặt bảo mật - Token truy cập hệ thống".

## Header yêu cầu bắt buộc

Một số giao diện yêu cầu mang theo header định danh người dùng:

```text
Uter-User: {user_id}
```

Trong đó `{user_id}` phải khớp với người dùng đang đăng nhập.

## Cấp độ quyền

- **Public**: Không yêu cầu xác thực
- **User**: Yêu cầu đăng nhập hoặc Access Token
- **Admin**: Yêu cầu quyền quản trị viên
- **Root**: Quyền cao nhất
