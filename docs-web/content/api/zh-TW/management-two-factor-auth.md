# 兩步驗證

## 重新生成備用碼

🔐 需要登入（User許可權）

`POST` `/api/user/2fa/backup_codes`

### 響應

| 狀態碼 | 說明 |
|---|---|
| `200` | 成功 |

## 禁用2FA

🔐 需要登入（User許可權）

`POST` `/api/user/2fa/disable`

### 請求體（`application/json`）

| 欄位 | 型別 | 必填 | 說明 |
|---|---|---|---|
| `code` | string | 否 | — |

### 響應

| 狀態碼 | 說明 |
|---|---|
| `200` | 成功 |

## 啟用2FA

🔐 需要登入（User許可權）

`POST` `/api/user/2fa/enable`

### 請求體（`application/json`）

| 欄位 | 型別 | 必填 | 說明 |
|---|---|---|---|
| `code` | string | 否 | — |

### 響應

| 狀態碼 | 說明 |
|---|---|
| `200` | 成功 |

## 設定2FA

🔐 需要登入（User許可權）

`POST` `/api/user/2fa/setup`

### 響應

| 狀態碼 | 說明 |
|---|---|
| `200` | 成功 |

## 獲取2FA統計

👨‍💼 需要管理員許可權（Admin）

`GET` `/api/user/2fa/stats`

### 響應

| 狀態碼 | 說明 |
|---|---|
| `200` | 成功 |

## 獲取2FA狀態

🔐 需要登入（User許可權）

`GET` `/api/user/2fa/status`

### 響應

| 狀態碼 | 說明 |
|---|---|
| `200` | 成功 |
