# Nhà cung cấp (vendors)

## Lấy tất cả nhà cung cấp (Get All Vendors)

👨‍💼 Yêu cầu quyền quản trị viên (Admin)

`GET` `/api/vendors/`

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Xóa nhà cung cấp (Delete Vendor)

👨‍💼 Yêu cầu quyền quản trị viên (Admin)

`DELETE` `/api/vendors/{id}`

### Tham số yêu cầu

| Tên tham số | Vị trí | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|---|
| `id` | path | integer | Có | — |

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Lấy nhà cung cấp cụ thể (Get Specific Vendor)

👨‍💼 Yêu cầu quyền quản trị viên (Admin)

`GET` `/api/vendors/{id}`

### Tham số yêu cầu

| Tên tham số | Vị trí | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|---|
| `id` | path | integer | Có | — |

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Tạo nhà cung cấp (Create Vendor)

👨‍💼 Yêu cầu quyền quản trị viên (Admin)

`POST` `/api/vendors/`

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Cập nhật nhà cung cấp (Update Vendor)

👨‍💼 Yêu cầu quyền quản trị viên (Admin)

`PUT` `/api/vendors/`

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Tìm kiếm nhà cung cấp (Search Vendors)

👨‍💼 Yêu cầu quyền quản trị viên (Admin)

`GET` `/api/vendors/search`

### Tham số yêu cầu

| Tên tham số | Vị trí | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|---|
| `keyword` | query | string | Không | — |

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |
