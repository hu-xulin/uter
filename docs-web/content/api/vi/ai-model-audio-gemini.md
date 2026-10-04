# Định dạng Native của Gemini

Endpoint tạo âm thanh native của Gemini. Tổng hợp giọng nói trực tiếp bằng các mô hình như `gemini-2.5-flash-preview-tts`, trả về âm thanh ở định dạng PCM / WAV và các định dạng khác.

Khác với "Định dạng Native OpenAI", endpoint này tuân theo giao thức `v1beta` của Google Gemini: bạn gửi nội dung đến endpoint `generateContent` và điều khiển phương thức đầu ra cũng như giọng nói thông qua `generationConfig`. Uter thống nhất truy cập vào họ mô hình Gemini — khóa, hạn ngạch và thanh toán đều sử dụng hệ thống tài khoản nền tảng.

## Xác thực

Xác thực bằng Bearer token.

`Authorization: Bearer <token>`

| Tham số | Vị trí | Mô tả |
|---|---|---|
| `Authorization` | header | Bearer token, định dạng `Bearer sk-xxxxxx` |

## Tham số đường dẫn

| Tham số | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `model` | string | Có | Tên mô hình, ví dụ `gemini-2.5-flash-preview-tts` |

## Thân yêu cầu

`Content-Type: application/json`

| Trường | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `contents` | array&lt;object&gt; | Có | Nội dung hội thoại; mỗi mục là một lượt đầu vào |
| `generationConfig` | object | Có | Cấu hình tạo, điều khiển phương thức đầu ra và giọng nói |

### Các trường generationConfig

| Trường | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `responseModalities` | array&lt;string&gt; | Không | Phương thức đầu ra; trường hợp sử dụng âm thanh phải bao gồm `AUDIO` |
| `speechConfig` | object | Không | Cấu hình giọng nói |
| `speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName` | string | Không | Tên giọng nói có sẵn, ví dụ `Kore` |

## Phản hồi

`200` yêu cầu thành công và JSON được trả về. Âm thanh được tạo được nhúng vào `candidates[].content.parts[]`.

### Ví dụ yêu cầu

```bash
curl -X POST "https://uter.ai/v1beta/models/gemini-2.5-flash-preview-tts:generateContent" \
  -H "Authorization: Bearer $Uter_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "contents": [
      {
        "parts": [
          { "text": "Read this text in a gentle female voice." }
        ]
      }
    ],
    "generationConfig": {
      "responseModalities": ["AUDIO"],
      "speechConfig": {
        "voiceConfig": {
          "prebuiltVoiceConfig": {
            "voiceName": "Kore"
          }
        }
      }
    }
  }'
```

### Ví dụ phản hồi

```json
{
  "candidates": [
    {
      "content": {
        "role": "model",
        "parts": [
          { "inlineData": { "mimeType": "audio/pcm", "data": "<base64>" } }
        ]
      },
      "finishReason": "STOP",
      "safetyRatings": []
    }
  ],
  "usageMetadata": {
    "promptTokenCount": 12,
    "candidatesTokenCount": 0,
    "totalTokenCount": 12
  }
}
```

> Mẹo: âm thanh được nhúng dưới dạng base64 trong `inlineData.data`; giải mã theo `inlineData.mimeType` để phát. Việc thanh toán dựa trên token đầu vào — âm thanh đã tổng hợp không bị tính thêm token.
