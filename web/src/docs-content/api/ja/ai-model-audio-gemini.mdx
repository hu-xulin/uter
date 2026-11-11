# Native Gemini Format

ネイティブ Gemini 音声生成エンドポイントです。 `gemini-2.5-flash-preview-tts` などのモデルで音声を直接合成し、PCM / WAV などの形式で音声を返します。

「ネイティブ OpenAI 形式」とは異なり、このエンドポイントは Google Gemini の `v1beta` プロトコルに準拠します。 `generateContent` エンドポイントにコンテンツを送信し、出力モダリティと音声は `generationConfig` で制御します。Uter は Gemini ファミリーのモデルへのアクセスを統合しており、キー、クォータ、課金はすべてプラットフォームのアカウントシステムを使用します。

## 認証

Bearer トークンで認証します。

`Authorization: Bearer <token>`

| パラメータ | 場所 | 説明 |
|---|---|---|
| `Authorization` | header | Bearer トークン。形式は `Bearer sk-xxxxxx` |

## パスパラメータ

| パラメータ | 型 | 必須 | 説明 |
|---|---|---|---|
| `model` | string | 必須 | モデル名。例: `gemini-2.5-flash-preview-tts` |

## リクエストボディ

`Content-Type: application/json`

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `contents` | array&lt;object&gt; | 必須 | 会話コンテンツ。各要素は1つの入力ターン |
| `generationConfig` | object | 必須 | 出力モダリティと音声を制御する生成設定 |

### generationConfig フィールド

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `responseModalities` | array&lt;string&gt; | 任意 | 出力モダリティ。音声用途では `AUDIO` を含める必要があります |
| `speechConfig` | object | 任意 | 音声設定 |
| `speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName` | string | 任意 | 組み込み音声名。例: `Kore` |

## レスポンス

`200` リクエストが成功し、JSON が返されます。生成された音声は `candidates[].content.parts[]` にインラインで格納されます。

### リクエスト例

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

### レスポンス例

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

> ヒント: 音声は `inlineData.data` に base64 でインライン格納されています。 `inlineData.mimeType` に従ってデコードして再生してください。課金は入力トークンに基づきます — 合成された音声は追加トークンとして課金されません。
