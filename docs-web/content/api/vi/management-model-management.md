# Quản lý mô hình (model-management)

## Lấy tất cả siêu dữ liệu mô hình (Get All Model Metadata)

👨‍💼 Yêu cầu quyền quản trị viên (Admin)

`GET` `/api/models/`

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Xóa mô hình (Delete Model)

👨‍💼 Yêu cầu quyền quản trị viên (Admin)

`DELETE` `/api/models/{id}`

### Tham số yêu cầu

| Tên tham số | Vị trí | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|---|
| `id` | path | integer | Có | — |

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Lấy mô hình cụ thể (Get Specific Model)

👨‍💼 Yêu cầu quyền quản trị viên (Admin)

`GET` `/api/models/{id}`

### Tham số yêu cầu

| Tên tham số | Vị trí | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|---|
| `id` | path | integer | Có | — |

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Lấy các mô hình thiếu (Get Missing Models)

👨‍💼 Yêu cầu quyền quản trị viên (Admin)

`GET` `/api/models/missing`

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Tạo siêu dữ liệu mô hình (Create Model Metadata)

👨‍💼 Yêu cầu quyền quản trị viên (Admin)

`POST` `/api/models/`

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Cập nhật siêu dữ liệu mô hình (Update Model Metadata)

👨‍💼 Yêu cầu quyền quản trị viên (Admin)

`PUT` `/api/models/`

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Tìm kiếm mô hình (Search Models)

👨‍💼 Yêu cầu quyền quản trị viên (Admin)

`GET` `/api/models/search`

### Tham số yêu cầu

| Tên tham số | Vị trí | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|---|
| `keyword` | query | string | Không | — |

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Đồng bộ mô hình upstream (Sync Upstream Models)

👨‍💼 Yêu cầu quyền quản trị viên (Admin)

`POST` `/api/models/sync_upstream`

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Xem trước đồng bộ mô hình upstream (Preview Upstream Model Synchronization)

👨‍💼 Yêu cầu quyền quản trị viên (Admin)

`GET` `/api/models/sync_upstream/preview`

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |
