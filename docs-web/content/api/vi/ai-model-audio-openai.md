# OpenAI

## Chuyển văn bản thành giọng nói (Text-to-Speech)

Chuyển đổi văn bản thành âm thanh.

`POST` `/v1/audio/speech`

### Thân yêu cầu (`application/json`)

| Trường | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `model` | string | Có | — |
| `input` | string | Có | Văn bản cần chuyển đổi |
| `voice` | enum (`alloy`, `echo`, `fable`, `onyx`, `nova`, `shimmer`) | Có | — |
| `response_format` | enum (`mp3`, `opus`, `aac`, `flac`, `wav`, `pcm`) | Không | — |
| `speed` | number | Không | — |

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Tạo âm thanh thành công |

## Chuyển âm thanh thành văn bản (Audio Transcriptions)

Chuyển đổi âm thanh thành văn bản.

`POST` `/v1/audio/transcriptions`

### Thân yêu cầu (`multipart/form-data`)

| Trường | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `file` | string (binary) | Có | Tệp âm thanh |
| `model` | string | Có | — |
| `language` | string | Không | Mã ngôn ngữ ISO-639-1 |
| `prompt` | string | Không | — |
| `response_format` | enum (`json`, `text`, `srt`, `verbose_json`, `vtt`) | Không | — |
| `temperature` | number | Không | — |
| `timestamp_granularities` | array&lt;enum (`word`, `segment`)&gt; | Không | — |

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Chuyển đổi thành công |

#### Trường phản hồi `200`

| Trường | Kiểu | Mô tả |
|---|---|---|
| `text` | string | — |

## Dịch âm thanh (Audio Translation)

Dịch âm thanh thành văn bản tiếng Anh.

`POST` `/v1/audio/translations`

### Thân yêu cầu (`multipart/form-data`)

| Trường | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `file` | string (binary) | Có | — |
| `model` | string | Có | — |
| `prompt` | string | Không | — |
| `response_format` | string | Không | — |
| `temperature` | number | Không | — |

### Phản hồi

| Mã trạng thái | Mô tả |
|---|---|
| `200` | Dịch thành công |

#### Trường phản hồi `200`

| Trường | Kiểu | Mô tả |
|---|---|---|
| `text` | string | — |
