# Thanh toán (payment)

## Creem Webhook

🔓 Không cần xác thực (callback Webhook)

`POST` `/api/creem/webhook`

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Stripe Webhook

🔓 Không cần xác thực (callback Webhook)

`POST` `/api/stripe/webhook`

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Lấy số tiền thanh toán (Get Payment Amount)

🔐 Yêu cầu đăng nhập (quyền User)

`POST` `/api/user/amount`

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Khởi tạo thanh toán Creem (Initiate Creem Payment)

🔐 Yêu cầu đăng nhập (quyền User)

`POST` `/api/user/creem/pay`

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Callback Epay (Epay Callback)

🔓 Không cần xác thực (callback thanh toán)

`GET` `/api/user/epay/notify`

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Khởi tạo thanh toán Easy (Initiate Easy Payment)

🔐 Yêu cầu đăng nhập (quyền User)

`POST` `/api/user/pay`

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Lấy số tiền thanh toán Stripe (Get Stripe Payment Amount)

🔐 Yêu cầu đăng nhập (quyền User)

`POST` `/api/user/stripe/amount`

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Khởi tạo thanh toán Stripe (Initiate Stripe Payment)

🔐 Yêu cầu đăng nhập (quyền User)

`POST` `/api/user/stripe/pay`

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Lấy thông tin nạp tiền (Get Top-up Information)

🔐 Yêu cầu đăng nhập (quyền User)

`GET` `/api/user/topup/info`

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

## Lấy lịch sử nạp tiền người dùng (Get User Top-up Records)

🔐 Yêu cầu đăng nhập (quyền User)

`GET` `/api/user/topup/self`

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |
