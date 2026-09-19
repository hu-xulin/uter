# Native Gemini Format

The native Gemini audio generation endpoint. Synthesize speech directly with models such as `gemini-2.5-flash-preview-tts`, returning audio in PCM / WAV and other formats.

Unlike the "Native OpenAI Format", this endpoint follows Google Gemini's `v1beta` protocol: you submit content to the `generateContent` endpoint and control the output modality and voice via `generationConfig`. URouters unifies access to the Gemini family of models — keys, quotas and billing all use the platform account system.

## Authorization

Authenticate with a Bearer token.

`Authorization: Bearer <token>`

| Parameter | In | Description |
|---|---|---|
| `Authorization` | header | Bearer token, format `Bearer sk-xxxxxx` |

## Path Parameters

| Parameter | Type | Required | Description |
|---|---|---|---|
| `model` | string | yes | Model name, e.g. `gemini-2.5-flash-preview-tts` |

## Request Body

`Content-Type: application/json`

| Field | Type | Required | Description |
|---|---|---|---|
| `contents` | array&lt;object&gt; | yes | Conversation content; each entry is one input turn |
| `generationConfig` | object | yes | Generation configuration controlling output modality and voice |

### generationConfig fields

| Field | Type | Required | Description |
|---|---|---|---|
| `responseModalities` | array&lt;string&gt; | no | Output modalities; audio use cases must include `AUDIO` |
| `speechConfig` | object | no | Speech configuration |
| `speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName` | string | no | Prebuilt voice name, e.g. `Kore` |

## Response

`200` the request succeeded and JSON is returned. The generated audio is inlined in `candidates[].content.parts[]`.

### Request example

```bash
curl -X POST "https://urouters.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent" \
  -H "Authorization: Bearer $URouters_API_KEY" \
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

### Response example

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

> Tip: the audio is inlined as base64 in `inlineData.data`; decode it according to `inlineData.mimeType` to play. Billing is based on input tokens — the synthesized audio is not billed as extra tokens.
