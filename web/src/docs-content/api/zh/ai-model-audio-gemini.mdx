# 原生Gemini格式

Gemini 原生音频生成接口。可直接使用 `gemini-2.5-flash-preview-tts` 等模型进行语音合成，返回 PCM / WAV 等格式的音频数据。

与「原生 OpenAI 格式」不同，本接口遵循 Google Gemini 的 `v1beta` 协议：以 `generateContent` 端点提交内容，由 `generationConfig` 控制输出模态与音色。Uter 对 Gemini 系列模型做了统一接入，密钥、配额与计费均沿用平台账户体系。

## 鉴权

使用 Bearer Token 认证。

`Authorization: Bearer <token>`

| 参数 | 位置 | 说明 |
|---|---|---|
| `Authorization` | header | Bearer 令牌，格式 `Bearer sk-xxxxxx` |

## 路径参数

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `model` | string | 是 | 模型名称，例如 `gemini-2.5-flash-preview-tts` |

## 请求体

`Content-Type: application/json`

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `contents` | array&lt;object&gt; | 是 | 对话内容，每一项为一段输入 |
| `generationConfig` | object | 是 | 生成配置，控制输出模态与音色 |

### generationConfig 字段

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `responseModalities` | array&lt;string&gt; | 否 | 输出模态，音频场景需包含 `AUDIO` |
| `speechConfig` | object | 否 | 语音配置 |
| `speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName` | string | 否 | 预置音色名称，例如 `Kore` |

## 响应

`200` 请求成功，返回 JSON。生成的音频内联在 `candidates[].content.parts[]` 中。

### 请求示例

```bash
curl -X POST "https://uter.ai/v1beta/models/gemini-2.5-flash-preview-tts:generateContent" \
  -H "Authorization: Bearer $Uter_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "contents": [
      {
        "parts": [
          { "text": "用温柔的女声朗读这段文字。" }
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

### 响应示例

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

> 提示：音频以 base64 内联在 `inlineData.data` 中，按 `inlineData.mimeType` 解码即可播放；计费以输入 token 为准，合成音频不额外计 token。
