# Cài đặt hệ thống (system-settings)

## Lấy tùy chọn hệ thống (Get System Options)

👑 Yêu cầu quyền siêu quản trị viên (Root)

`GET` `/api/option/`

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Di chuyển cài đặt bảng điều khiển (Migrate Console Settings)

👑 Yêu cầu quyền siêu quản trị viên (Root)

`POST` `/api/option/migrate_console_setting`

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Cập nhật tùy chọn hệ thống (Update System Options)

👑 Yêu cầu quyền siêu quản trị viên (Root)

`PUT` `/api/option/`

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Đặt lại tỷ lệ mô hình (Reset Model Ratio)

👑 Yêu cầu quyền siêu quản trị viên (Root)

`POST` `/api/option/rest_model_ratio`

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Lấy các kênh có thể đồng bộ (Get Syncable Channels)

👑 Yêu cầu quyền siêu quản trị viên (Root)

`GET` `/api/ratio_sync/channels`

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Lấy tỷ lệ upstream (Fetch Upstream Ratios)

👑 Yêu cầu quyền siêu quản trị viên (Root)

`POST` `/api/ratio_sync/fetch`

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |
