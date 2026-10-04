# OAuth

## Đăng nhập Discord OAuth (Discord OAuth Login)

🔓 Không cần xác thực (callback OAuth)

`GET` `/api/oauth/discord`

### Tham số yêu cầu

| Tên tham số | Vị trí | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|---|
| `code` | query | string | Không | — |

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Liên kết Email (Bind Email)

🔓 Không cần xác thực

`GET` `/api/oauth/email/bind`

### Tham số yêu cầu

| Tên tham số | Vị trí | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|---|
| `email` | query | string | Không | — |
| `code` | query | string | Không | — |

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Đăng nhập GitHub OAuth (GitHub OAuth Login)

🔓 Không cần xác thực (callback OAuth)

`GET` `/api/oauth/github`

### Tham số yêu cầu

| Tên tham số | Vị trí | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|---|
| `code` | query | string | Không | — |

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Đăng nhập LinuxDO OAuth (LinuxDO OAuth Login)

🔓 Không cần xác thực (callback OAuth)

`GET` `/api/oauth/linuxdo`

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Đăng nhập OIDC (OIDC Login)

🔓 Không cần xác thực (callback OAuth)

`GET` `/api/oauth/oidc`

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Tạo OAuth State (Generate OAuth State)

🔓 Không cần xác thực

`GET` `/api/oauth/state`

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Liên kết Telegram (Bind Telegram)

🔓 Không cần xác thực

`GET` `/api/oauth/telegram/bind`

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Đăng nhập Telegram (Telegram Login)

🔓 Không cần xác thực (callback OAuth)

`GET` `/api/oauth/telegram/login`

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Liên kết WeChat (Bind WeChat)

🔓 Không cần xác thực

`GET` `/api/oauth/wechat/bind`

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Đăng nhập WeChat OAuth (WeChat OAuth Login)

🔓 Không cần xác thực (callback OAuth)

`GET` `/api/oauth/wechat`

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |
