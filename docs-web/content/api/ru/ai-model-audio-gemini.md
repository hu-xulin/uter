# Нативный формат Gemini

Нативная конечная точка генерации аудио Gemini. Синтезирует речь напрямую с помощью таких моделей, как `gemini-2.5-flash-preview-tts`, возвращая аудио в форматах PCM / WAV и других.

В отличие от «Нативного формата OpenAI», эта конечная точка следует протоколу `v1beta` Google Gemini: вы отправляете содержимое в конечную точку `generateContent` и управляете выходной модальностью и голосом через `generationConfig`. Uter унифицирует доступ к семейству моделей Gemini — ключи, квоты и биллинг используют систему учётных записей платформы.

## Авторизация

Аутентификация с помощью Bearer-токена.

`Authorization: Bearer <token>`

| Параметр | Расположение | Описание |
|---|---|---|
| `Authorization` | header | Bearer-токен, формат `Bearer sk-xxxxxx` |

## Параметры пути

| Параметр | Тип | Обязательно | Описание |
|---|---|---|---|
| `model` | string | да | Название модели, напр. `gemini-2.5-flash-preview-tts` |

## Тело запроса

`Content-Type: application/json`

| Поле | Тип | Обязательно | Описание |
|---|---|---|---|
| `contents` | array&lt;object&gt; | да | Содержимое диалога; каждая запись — один входной шаг |
| `generationConfig` | object | да | Конфигурация генерации, управляющая выходной модальностью и голосом |

### Поля generationConfig

| Поле | Тип | Обязательно | Описание |
|---|---|---|---|
| `responseModalities` | array&lt;string&gt; | нет | Выходные модальности; для аудио должно быть указано `AUDIO` |
| `speechConfig` | object | нет | Конфигурация речи |
| `speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName` | string | нет | Имя встроенного голоса, напр. `Kore` |

## Ответ

`200` запрос выполнен успешно и возвращён JSON. Сгенерированное аудио встроено в `candidates[].content.parts[]`.

### Пример запроса

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

### Пример ответа

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

> Совет: аудио встроено в base64 в `inlineData.data`; декодируйте его в соответствии с `inlineData.mimeType` для воспроизведения. Биллинг основан на входных токенах — синтезированное аудио не тарифицируется как дополнительные токены.
