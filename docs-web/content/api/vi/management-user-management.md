# Quản lý người dùng (user-management)

## Lấy mã mời (Get Invitation Code)

🔐 Yêu cầu đăng nhập (quyền User)

`GET` `/api/user/aff`

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Chuyển đổi hạn ngạch mời (Convert Invitation Quota)

🔐 Yêu cầu đăng nhập (quyền User)

`POST` `/api/user/aff_transfer`

### Thân yêu cầu (`application/json`)

| Trường | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `quota` | integer | Không | — |

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Lấy tất cả người dùng (Get All Users)

👨‍💼 Yêu cầu quyền quản trị viên (Admin)

`GET` `/api/user/`

### Tham số yêu cầu

| Tên tham số | Vị trí | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|---|
| `p` | query | integer | Không | — |
| `page_size` | query | integer | Không | — |

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Admin tắt 2FA người dùng (Admin Disable User 2FA)

👨‍💼 Yêu cầu quyền quản trị viên (Admin)

`DELETE` `/api/user/{id}/2fa`

### Tham số yêu cầu

| Tên tham số | Vị trí | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|---|
| `id` | path | integer | Có | — |

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Xóa người dùng (Delete User)

👨‍💼 Yêu cầu quyền quản trị viên (Admin)

`DELETE` `/api/user/{id}`

### Tham số yêu cầu

| Tên tham số | Vị trí | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|---|
| `id` | path | integer | Có | — |

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Lấy người dùng cụ thể (Get Specific User)

👨‍💼 Yêu cầu quyền quản trị viên (Admin)

`GET` `/api/user/{id}`

### Tham số yêu cầu

| Tên tham số | Vị trí | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|---|
| `id` | path | integer | Có | — |

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Admin đặt lại Passkey người dùng (Admin Reset User Passkey)

👨‍💼 Yêu cầu quyền quản trị viên (Admin)

`DELETE` `/api/user/{id}/reset_passkey`

### Tham số yêu cầu

| Tên tham số | Vị trí | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|---|
| `id` | path | integer | Có | — |

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Quản lý trạng thái người dùng (Manage User Status)

👨‍💼 Yêu cầu quyền quản trị viên (Admin)

`POST` `/api/user/manage`

### Thân yêu cầu (`application/json`)

| Trường | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `id` | integer | Không | — |
| `action` | enum (`disable`, `enable`, `delete`, `promote`, `demote`) | Không | — |

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Lấy mô hình khả dụng của người dùng (Get User Available Models)

🔐 Yêu cầu đăng nhập (quyền User)

`GET` `/api/user/models`

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Xóa Passkey (Delete Passkey)

🔐 Yêu cầu đăng nhập (quyền User)

`DELETE` `/api/user/passkey`

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Lấy trạng thái Passkey (Get Passkey Status)

🔐 Yêu cầu đăng nhập (quyền User)

`GET` `/api/user/passkey`

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Bắt đầu đăng ký Passkey (Start Passkey Registration)

🔐 Yêu cầu đăng nhập (quyền User)

`POST` `/api/user/passkey/register/begin`

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Hoàn tất đăng ký Passkey (Complete Passkey Registration)

🔐 Yêu cầu đăng nhập (quyền User)

`POST` `/api/user/passkey/register/finish`

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Bắt đầu xác minh Passkey (Start Passkey Verification)

🔐 Yêu cầu đăng nhập (quyền User)

`POST` `/api/user/passkey/verify/begin`

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Hoàn tất xác minh Passkey (Complete Passkey Verification)

🔐 Yêu cầu đăng nhập (quyền User)

`POST` `/api/user/passkey/verify/finish`

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Tạo người dùng (Create User)

👨‍💼 Yêu cầu quyền quản trị viên (Admin)

`POST` `/api/user/`

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Cập nhật người dùng (Update User)

👨‍💼 Yêu cầu quyền quản trị viên (Admin)

`PUT` `/api/user/`

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Tìm kiếm người dùng (Search Users)

👨‍💼 Yêu cầu quyền quản trị viên (Admin)

`GET` `/api/user/search`

### Tham số yêu cầu

| Tên tham số | Vị trí | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|---|
| `keyword` | query | string | Không | — |
| `group` | query | string | Không | — |

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Xóa người dùng hiện tại (Delete Current User)

🔐 Yêu cầu đăng nhập (quyền User)

`DELETE` `/api/user/self`

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Lấy thông tin người dùng hiện tại (Get Current User Information)

🔐 Yêu cầu đăng nhập (quyền User)

`GET` `/api/user/self`

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Lấy nhóm của người dùng hiện tại (Get Current User Groups)

🔐 Yêu cầu đăng nhập (quyền User)

`GET` `/api/user/self/groups`

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Cập nhật thông tin người dùng hiện tại (Update Current User Information)

🔐 Yêu cầu đăng nhập (quyền User)

`PUT` `/api/user/self`

### Thân yêu cầu (`application/json`)

| Trường | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `username` | string | Không | — |
| `display_name` | string | Không | — |
| `password` | string | Không | — |
| `original_password` | string | Không | — |

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Cập nhật cài đặt người dùng (Update User Settings)

🔐 Yêu cầu đăng nhập (quyền User)

`PUT` `/api/user/setting`

### Thân yêu cầu (`application/json`)

| Trường | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `notify_type` | string | Không | — |
| `quota_warning_threshold` | number | Không | — |
| `webhook_url` | string | Không | — |
| `notification_email` | string | Không | — |

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Tạo Access Token (Generate Access Token)

🔐 Yêu cầu đăng nhập (quyền User)

`GET` `/api/user/token`

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Admin hoàn tất nạp tiền (Admin Completes Top-up)

👨‍💼 Yêu cầu quyền quản trị viên (Admin)

`POST` `/api/user/topup/complete`

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Lấy tất cả lịch sử nạp tiền (Get All Top-up Records)

👨‍💼 Yêu cầu quyền quản trị viên (Admin)

`GET` `/api/user/topup`

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |
