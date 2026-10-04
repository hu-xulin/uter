# Gemini

## Định dạng Native Gemini

Tạo ảnh Gemini.

`POST` `/v1beta/models/{model}:generateContent/`

### Tham số yêu cầu

| Tên tham số | Vị trí | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|---|
| `model` | path | string | Có | Tên mô hình |

### Thân yêu cầu (`application/json`)

| Trường | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `contents` | array&lt;object&gt; | Có | — |
| `generationConfig.thinkingConfig.includeThoughts` | boolean | Không | Có trả về nội dung suy nghĩ hay không |
| `generationConfig.responseModalities` | array&lt;string&gt; | Không | — |
| `generationConfig.imageConfig.aspectRatio` | string | Không | — |
| `generationConfig.imageConfig.imageSize` | string | Không | — |

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

## Định dạng OpenAI Chat

Tạo ảnh Gemini.

`POST` `/v1/chat/completions`

### Thân yêu cầu (`application/json`)

| Trường | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `model` | string | Có | — |
| `stream` | boolean | Có | — |
| `messages` | array&lt;object&gt; | Có | — |
| `extra_body.google.image_config.aspect_ratio` | string | Không | — |
| `extra_body.google.image_config.image_size` | string | Không | — |
| `contents` | array&lt;object&gt; | Có | — |

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Thành công |

#### Trường phản hồi `200`

| Trường | Kiểu | Mô tả |
|---|---|---|
| `id` | string | — |
| `model` | string | — |
| `object` | string | — |
| `created` | integer | — |
| `choices` | array&lt;object&gt; | — |
| `usage.prompt_tokens` | integer | — |
| `usage.completion_tokens` | integer | — |
| `usage.total_tokens` | integer | — |
