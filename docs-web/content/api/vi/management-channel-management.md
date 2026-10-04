# Quản lý kênh (channel-management)

## Xóa hàng loạt kênh (Batch Delete Channels)

👨‍💼 Yêu cầu quyền quản trị viên (Admin)

`POST` `/api/channel/batch`

### Thân yêu cầu (`application/json`)

| Trường | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `ids` | array&lt;integer&gt; | Không | — |

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Thiết lập thẻ kênh hàng loạt (Batch Set Channel Tags)

👨‍💼 Yêu cầu quyền quản trị viên (Admin)

`POST` `/api/channel/batch/tag`

### Thân yêu cầu (`application/json`)

| Trường | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `ids` | array&lt;integer&gt; | Không | — |
| `tag` | string | Không | — |

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Sao chép kênh (Copy Channel)

👨‍💼 Yêu cầu quyền quản trị viên (Admin)

`POST` `/api/channel/copy/{id}`

### Tham số yêu cầu

| Tên tham số | Vị trí | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|---|
| `id` | path | integer | Có | — |
| `suffix` | query | string | Không | — |
| `reset_balance` | query | boolean | Không | — |

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Xóa các kênh đã tắt (Delete Disabled Channels)

👨‍💼 Yêu cầu quyền quản trị viên (Admin)

`DELETE` `/api/channel/disabled`

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Lấy danh sách mô hình upstream (Get Upstream Model List)

👨‍💼 Yêu cầu quyền quản trị viên (Admin)

`GET` `/api/channel/fetch_models/{id}`

### Tham số yêu cầu

| Tên tham số | Vị trí | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|---|
| `id` | path | integer | Có | — |

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Lấy danh sách mô hình (Get Model List)

👨‍💼 Yêu cầu quyền quản trị viên (Admin)

`POST` `/api/channel/fetch_models`

### Thân yêu cầu (`application/json`)

| Trường | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `base_url` | string | Không | — |
| `type` | integer | Không | — |
| `key` | string | Không | — |

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Sửa năng lực kênh (Fix Channel Capability)

👨‍💼 Yêu cầu quyền quản trị viên (Admin)

`POST` `/api/channel/fix`

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Lấy tất cả kênh (Get All Channels)

👨‍💼 Yêu cầu quyền quản trị viên (Admin)

`GET` `/api/channel/`

### Tham số yêu cầu

| Tên tham số | Vị trí | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|---|
| `p` | query | integer | Không | — |
| `page_size` | query | integer | Không | — |
| `id_sort` | query | boolean | Không | — |
| `tag_mode` | query | boolean | Không | — |
| `status` | query | string | Không | — |
| `type` | query | integer | Không | — |

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Xóa kênh (Delete Channel)

👨‍💼 Yêu cầu quyền quản trị viên (Admin)

`DELETE` `/api/channel/{id}`

### Tham số yêu cầu

| Tên tham số | Vị trí | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|---|
| `id` | path | integer | Có | — |

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Lấy kênh cụ thể (Get Specific Channel)

👨‍💼 Yêu cầu quyền quản trị viên (Admin)

`GET` `/api/channel/{id}`

### Tham số yêu cầu

| Tên tham số | Vị trí | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|---|
| `id` | path | integer | Có | — |

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Lấy khóa kênh (Get Channel Key)

👑 Yêu cầu quyền siêu quản trị viên (Root) + xác minh bảo mật

`POST` `/api/channel/{id}/key`

### Tham số yêu cầu

| Tên tham số | Vị trí | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|---|
| `id` | path | integer | Có | — |

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Lấy danh sách mô hình kênh (Get Channel Model List)

👨‍💼 Yêu cầu quyền quản trị viên (Admin)

`GET` `/api/channel/models`

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Lấy danh sách mô hình đã bật (Get Enabled Model List)

👨‍💼 Yêu cầu quyền quản trị viên (Admin)

`GET` `/api/channel/models_enabled`

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Quản lý nhiều khóa (Manage Multiple Keys)

👨‍💼 Yêu cầu quyền quản trị viên (Admin)

`POST` `/api/channel/multi_key/manage`

### Thân yêu cầu (`application/json`)

| Trường | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `channel_id` | integer | Không | — |
| `action` | enum (`get_key_status`, `disable_key`, `enable_key`, `delete_key`, `delete_disabled_keys`, `enable_all_keys` …) | Không | — |
| `key_index` | integer | Không | — |

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Thêm kênh (Add Channel)

👨‍💼 Yêu cầu quyền quản trị viên (Admin)

`POST` `/api/channel/`

### Thân yêu cầu (`application/json`)

| Trường | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `mode` | enum (`single`, `batch`, `multi_to_single`) | Không | — |
| `channel` | object | Không | Unresolved $ref: #/definitions/224188811 |

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Cập nhật kênh (Update Channel)

👨‍💼 Yêu cầu quyền quản trị viên (Admin)

`PUT` `/api/channel/`

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Tìm kiếm kênh (Search Channels)

👨‍💼 Yêu cầu quyền quản trị viên (Admin)

`GET` `/api/channel/search`

### Tham số yêu cầu

| Tên tham số | Vị trí | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|---|
| `keyword` | query | string | Không | — |
| `group` | query | string | Không | — |
| `model` | query | string | Không | — |

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Tắt kênh theo thẻ (Disable Tag Channel)

👨‍💼 Yêu cầu quyền quản trị viên (Admin)

`POST` `/api/channel/tag/disabled`

### Thân yêu cầu (`application/json`)

| Trường | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `tag` | string | Không | — |

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Bật kênh theo thẻ (Enable Tag Channel)

👨‍💼 Yêu cầu quyền quản trị viên (Admin)

`POST` `/api/channel/tag/enabled`

### Thân yêu cầu (`application/json`)

| Trường | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `tag` | string | Không | — |

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Lấy mô hình theo thẻ (Get Tag Models)

👨‍💼 Yêu cầu quyền quản trị viên (Admin)

`GET` `/api/channel/tag/models`

### Tham số yêu cầu

| Tên tham số | Vị trí | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|---|
| `tag` | query | string | Có | — |

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Chỉnh sửa kênh theo thẻ (Edit Tag Channel)

👨‍💼 Yêu cầu quyền quản trị viên (Admin)

`PUT` `/api/channel/tag`

### Thân yêu cầu (`application/json`)

| Trường | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `tag` | string | Không | — |
| `new_tag` | string | Không | — |
| `priority` | integer | Không | — |
| `weight` | integer | Không | — |

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Kiểm tra tất cả kênh (Test All Channels)

👨‍💼 Yêu cầu quyền quản trị viên (Admin)

`GET` `/api/channel/test`

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Kiểm tra kênh cụ thể (Test Specific Channel)

👨‍💼 Yêu cầu quyền quản trị viên (Admin)

`GET` `/api/channel/test/{id}`

### Tham số yêu cầu

| Tên tham số | Vị trí | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|---|
| `id` | path | integer | Có | — |

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Cập nhật số dư tất cả kênh (Update All Channel Balances)

👨‍💼 Yêu cầu quyền quản trị viên (Admin)

`GET` `/api/channel/update_balance`

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Cập nhật số dư kênh được chỉ định (Update Specified Channel Balance)

👨‍💼 Yêu cầu quyền quản trị viên (Admin)

`GET` `/api/channel/update_balance/{id}`

### Tham số yêu cầu

| Tên tham số | Vị trí | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|---|
| `id` | path | integer | Có | — |

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |
