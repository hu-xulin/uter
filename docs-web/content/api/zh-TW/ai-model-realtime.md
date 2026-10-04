# 實時語音（Realtime）

## 原生OpenAI格式

建立 WebSocket 連線用於實時對話。

**注意**: 這是一個 WebSocket 端點，需要使用 WebSocket 協議連線。

連線 URL 示例: `wss://api.example.com/v1/realtime?model=gpt-4o-realtime`

`GET` `/v1/realtime`

### 請求引數

| 引數名 | 位置 | 型別 | 必填 | 說明 |
|---|---|---|---|---|
| `model` | query | string | 否 | 要使用的模型 |

### 響應

| 狀態碼 | 說明 |
|---|---|
| `101` | WebSocket 協議切換 |
| `400` | 請求錯誤 |

#### `400` 響應欄位

| 欄位 | 型別 | 說明 |
|---|---|---|
| `error.message` | string | 錯誤資訊 |
| `error.type` | string | 錯誤型別 |
| `error.param` | string | 相關引數 |
| `error.code` | string | 錯誤程式碼 |
