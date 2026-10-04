# Mã đổi thưởng (redemption)

## Lấy tất cả mã đổi thưởng (Get All Redemption Codes)

👨‍💼 Yêu cầu quyền quản trị viên (Admin)

`GET` `/api/redemption/`

### Tham số yêu cầu

| Tên tham số | Vị trí | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|---|
| `p` | query | integer | Không | — |
| `page_size` | query | integer | Không | — |

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Xóa mã đổi thưởng (Delete Redemption Code)

👨‍💼 Yêu cầu quyền quản trị viên (Admin)

`DELETE` `/api/redemption/{id}`

### Tham số yêu cầu

| Tên tham số | Vị trí | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|---|
| `id` | path | integer | Có | — |

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Lấy mã đổi thưởng cụ thể (Get Specific Redemption Code)

👨‍💼 Yêu cầu quyền quản trị viên (Admin)

`GET` `/api/redemption/{id}`

### Tham số yêu cầu

| Tên tham số | Vị trí | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|---|
| `id` | path | integer | Có | — |

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Xóa các mã đổi thưởng không hợp lệ (Delete Invalid Redemption Codes)

👨‍💼 Yêu cầu quyền quản trị viên (Admin)

`DELETE` `/api/redemption/invalid`

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Tạo mã đổi thưởng (Create Redemption Code)

👨‍💼 Yêu cầu quyền quản trị viên (Admin)

`POST` `/api/redemption/`

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Cập nhật mã đổi thưởng (Update Redemption Code)

👨‍💼 Yêu cầu quyền quản trị viên (Admin)

`PUT` `/api/redemption/`

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Tìm kiếm mã đổi thưởng (Search Redemption Codes)

👨‍💼 Yêu cầu quyền quản trị viên (Admin)

`GET` `/api/redemption/search`

### Tham số yêu cầu

| Tên tham số | Vị trí | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|---|
| `keyword` | query | string | Không | — |

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |
