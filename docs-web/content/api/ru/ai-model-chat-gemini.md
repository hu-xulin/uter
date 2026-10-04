# gemini

## Распознавание медиа Gemini

Запрос на распознавание изображений, PDF, аудио и видео в Gemini.

⚠️ Внимание: в нативном формате запроса Gemini медиаданные можно передавать через inlineData (base64) или fileData.fileUri (общедоступный URL, поддерживаются ссылки YouTube). Доступность URI файлов, загруженных через Gemini File API, зависит от прав ключа вышестоящего канала; рекомендуется в приоритетном порядке использовать общедоступные URL. При преобразовании запросов в формате OpenAI (chat/completions) в Gemini медиаданные единообразно загружаются и преобразуются в inlineData (base64).

`POST` `/v1beta/models/{model}:generateContent`

### Параметры запроса

| Параметр | Расположение | Тип | Обязательно | Описание |
|---|---|---|---|---|
| `model` | path | string | да | Название модели |

### Тело запроса (`application/json`)

| Поле | Тип | Обязательно | Описание |
|---|---|---|---|
| `contents` | array&lt;object&gt; | нет | — |
| `generationConfig.temperature` | number | нет | — |
| `generationConfig.topP` | number | нет | — |
| `generationConfig.topK` | integer | нет | — |
| `generationConfig.maxOutputTokens` | integer | нет | — |
| `generationConfig.stopSequences` | array&lt;string&gt; | нет | — |
| `safetySettings` | array&lt;object&gt; | нет | — |
| `tools` | array&lt;object&gt; | нет | — |
| `systemInstruction.parts` | array&lt;object&gt; | нет | — |

### Ответ

| Код статуса | Описание |
|---|---|
| `200` | Успешно |

#### Поля ответа `200`

| Поле | Тип | Описание |
|---|---|---|
| `candidates` | array&lt;object&gt; | — |
| `usageMetadata.promptTokenCount` | integer | — |
| `usageMetadata.candidatesTokenCount` | integer | — |
| `usageMetadata.totalTokenCount` | integer | — |

## Текстовый чат Gemini

Проксирование запросов к Gemini API.
Формат пути: `/v1beta/models/{model_name}:{action}`

Например:
- `/v1beta/models/gemini-2.5-pro:generateContent`
- `/v1beta/models/gemini-2.5-pro:streamGenerateContent?alt=sse`

`POST` `/v1beta/models/{model}:generateContent`

### Параметры запроса

| Параметр | Расположение | Тип | Обязательно | Описание |
|---|---|---|---|---|
| `model` | path | string | да | Название модели |

### Тело запроса (`application/json`)

| Поле | Тип | Обязательно | Описание |
|---|---|---|---|
| `contents` | array&lt;object&gt; | нет | — |
| `generationConfig.temperature` | number | нет | — |
| `generationConfig.topP` | number | нет | — |
| `generationConfig.topK` | integer | нет | — |
| `generationConfig.maxOutputTokens` | integer | нет | — |
| `generationConfig.stopSequences` | array&lt;string&gt; | нет | — |
| `safetySettings` | array&lt;object&gt; | нет | — |
| `tools` | array&lt;object&gt; | нет | — |
| `systemInstruction.parts` | array&lt;object&gt; | нет | — |

### Ответ

| Код статуса | Описание |
|---|---|
| `200` | Успешно |

#### Поля ответа `200`

| Поле | Тип | Описание |
|---|---|---|
| `candidates` | array&lt;object&gt; | — |
| `usageMetadata.promptTokenCount` | integer | — |
| `usageMetadata.candidatesTokenCount` | integer | — |
| `usageMetadata.totalTokenCount` | integer | — |
