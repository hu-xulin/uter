# Quản lý token (token-management)

## Xóa token hàng loạt (Batch Delete Tokens)

🔐 Yêu cầu đăng nhập (quyền User)

`POST` `/api/token/batch`

### Thân yêu cầu (`application/json`)

| Trường | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `ids` | array&lt;integer&gt; | Không | — |

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Lấy tất cả token (Get All Tokens)

🔐 Yêu cầu đăng nhập (quyền User)

`GET` `/api/token/`

### Tham số yêu cầu

| Tên tham số | Vị trí | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|---|
| `p` | query | integer | Không | — |
| `page_size` | query | integer | Không | — |

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Xóa token (Delete Token)

🔐 Yêu cầu đăng nhập (quyền User)

`DELETE` `/api/token/{id}`

### Tham số yêu cầu

| Tên tham số | Vị trí | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|---|
| `id` | path | integer | Có | — |

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Lấy token được chỉ định (Get Specified Token)

🔐 Yêu cầu đăng nhập (quyền User)

`GET` `/api/token/{id}`

### Tham số yêu cầu

| Tên tham số | Vị trí | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|---|
| `id` | path | integer | Có | — |

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Tạo token (Create Token)

🔐 Yêu cầu đăng nhập (quyền User)

`POST` `/api/token/`

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Cập nhật token (Update Token)

🔐 Yêu cầu đăng nhập (quyền User)

`PUT` `/api/token/`

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Tìm kiếm token (Search Tokens)

🔐 Yêu cầu đăng nhập (quyền User)

`GET` `/api/token/search`

### Tham số yêu cầu

| Tên tham số | Vị trí | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|---|
| `keyword` | query | string | Không | — |

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Lấy lượt sử dụng token (Get Token Usage)

🔑 Yêu cầu xác thực bằng token (TokenAuth)

`GET` `/api/usage/token/`

### Tham số yêu cầu

| Tên tham số | Vị trí | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|---|
| `Authorization` | header | string | Không | — |

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |
