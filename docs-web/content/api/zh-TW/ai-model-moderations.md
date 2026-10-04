# 審查（Moderations）

## 原生OpenAI格式

檢查文字內容是否違反使用政策

`POST` `/v1/moderations`

### 請求體（`application/json`）

| 欄位 | 型別 | 必填 | 說明 |
|---|---|---|---|
| `model` | string | 否 | — |

### 響應

| 狀態碼 | 說明 |
|---|---|
| `200` | 成功稽核 |

#### `200` 響應欄位

| 欄位 | 型別 | 說明 |
|---|---|---|
| `id` | string | — |
| `model` | string | — |
| `results` | array&lt;object&gt; | — |
