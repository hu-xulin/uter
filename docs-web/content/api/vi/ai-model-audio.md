# Định dạng Native của Gemini

## Định dạng Native của Gemini

Giao diện tạo âm thanh Gemini.
Có thể sử dụng các mô hình như gemini-2.5-flash-preview-tts.

`POST` `/v1beta/models/{model}:generateContent`

### Tham số yêu cầu

| Tên tham số | Vị trí | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|---|
| `model` | path | string | Có | Tên mô hình |

### Thân yêu cầu (`application/json`)

| Trường | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `contents` | array&lt;object&gt; | Có | — |
| `generationConfig.responseModalities` | array&lt;string&gt; | Không | — |

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

#### Trường phản hồi `200`

| Trường | Kiểu | Mô tả |
|---|---|---|
| `candidates` | array&lt;object&gt; | — |
| `usageMetadata.promptTokenCount` | integer | — |
| `usageMetadata.candidatesTokenCount` | integer | — |
| `usageMetadata.totalTokenCount` | integer | — |
