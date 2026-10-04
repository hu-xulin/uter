# Qwen

## Tạo ảnh (Generate Images)

Tạo ảnh thuộc dòng qwen-image của Bailian.

`POST` `/v1/images/generations`

### Thân yêu cầu (`application/json`)

| Trường | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `model` | string | Có | — |
| `input.messages` | array&lt;object&gt; | Không | — |
| `parameters.negative_prompt` | string | Không | — |
| `parameters.prompt_extend` | boolean | Không | — |
| `parameters.watermark` | boolean | Không | — |
| `parameters.size` | string | Không | — |

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Tạo ảnh thành công |

#### Trường phản hồi `200`

| Trường | Kiểu | Mô tả |
|---|---|---|
| `created` | integer | — |
| `data` | array&lt;object&gt; | — |

## Chỉnh sửa ảnh (Edit Image)

Chỉnh sửa ảnh thuộc dòng qwen-image của Bailian.

`POST` `/v1/images/edits`

### Thân yêu cầu (`application/json`)

| Trường | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `model` | string | Có | — |
| `input.messages` | array&lt;object&gt; | Không | — |
| `parameters.n` | integer | Không | — |
| `parameters.negative_prompt` | string | Không | — |
| `parameters.prompt_extend` | boolean | Không | — |
| `parameters.watermark` | boolean | Không | — |
| `parameters.size` | string | Không | — |

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Tạo ảnh thành công |

#### Trường phản hồi `200`

| Trường | Kiểu | Mô tả |
|---|---|---|
| `created` | integer | — |
| `data` | array&lt;object&gt; | — |
