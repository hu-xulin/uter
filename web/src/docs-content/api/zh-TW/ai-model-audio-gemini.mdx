# 原生Gemini格式

Gemini 原生音訊生成介面。可直接使用 `gemini-2.5-flash-preview-tts` 等模型進行語音合成，返回 PCM / WAV 等格式的音訊資料。

與「原生 OpenAI 格式」不同，本介面遵循 Google Gemini 的 `v1beta` 協議：以 `generateContent` 端點提交內容，由 `generationConfig` 控制輸出模態與音色。優特對 Gemini 系列模型做了統一接入，金鑰、配額與計費均沿用平臺賬戶體系。

## 鑑權

使用 Bearer Token 認證。

`Authorization: Bearer <token>`

| 引數 | 位置 | 說明 |
|---|---|---|
| `Authorization` | header | Bearer 令牌，格式 `Bearer sk-xxxxxx` |

## 路徑引數

| 引數 | 型別 | 必填 | 說明 |
|---|---|---|---|
| `model` | string | 是 | 模型名稱，例如 `gemini-2.5-flash-preview-tts` |

## 請求體

`Content-Type: application/json`

| 欄位 | 型別 | 必填 | 說明 |
|---|---|---|---|
| `contents` | array&lt;object&gt; | 是 | 對話內容，每一項為一段輸入 |
| `generationConfig` | object | 是 | 生成配置，控制輸出模態與音色 |

### generationConfig 欄位

| 欄位 | 型別 | 必填 | 說明 |
|---|---|---|---|
| `responseModalities` | array&lt;string&gt; | 否 | 輸出模態，音訊場景需包含 `AUDIO` |
| `speechConfig` | object | 否 | 語音配置 |
| `speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName` | string | 否 | 預置音色名稱，例如 `Kore` |

## 響應

`200` 請求成功，返回 JSON。生成的音訊內聯在 `candidates[].content.parts[]` 中。

### 請求示例

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

### 響應示例

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

> 提示：音訊以 base64 內聯在 `inlineData.data` 中，按 `inlineData.mimeType` 解碼即可播放；計費以輸入 token 為準，合成音訊不額外計 token。
