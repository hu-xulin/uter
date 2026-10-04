# Использование API и песочницы

## Песочница

* Песочница предназначена для простого онлайн-тестирования ИИ-моделей и знакомства с ними. Можно ввести вопрос или инструкцию, взаимодействовать с моделью и просматривать полученные результаты.
  


1. Выберите группу и модель: в правом нижнем углу поля ввода выберите доступную группу моделей и конкретную модель для этого диалога.
2. Настройте параметры запроса: нажмите кнопку настройки параметров, чтобы включить и при необходимости изменить Temperature, Top P, Frequency Penalty, Presence Penalty и Max Tokens.
3. Введите содержимое диалога: введите вопрос, инструкцию или промпт в поле ввода внизу; поиск, загрузка файлов, загрузка фотографий, снимок экрана и съёмка пока не реализованы.
4. Отправьте запрос: убедившись, что модель, параметры и введённое содержимое верны, нажмите кнопку «Отправить».
5. Посмотрите результат: после завершения генерации вы сможете прочитать ответ в области диалога и продолжить диалог несколькими раундами.

<img alt="Страница песочницы" src="01-playground.webp" />

## Адрес API и аутентификация

Совместимый с OpenAI адрес шлюза обычно выглядит так:

```text
https://your-host/v1
```

Используйте ваш ключ API в качестве Bearer-токена:

```http
Authorization: Bearer YOUR_API_KEY
```

Например, для чат-комплитов:

```bash
curl https://your-host/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"你好"}]}'
```

## Примеры SDK

### Python (OpenAI SDK)

```python
from openai import OpenAI

client = OpenAI(
    api_key="sk-xxxxxxxx",
    base_url="https://your-host/v1",
)

response = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[{"role": "user", "content": "你好"}],
)
print(response.choices[0].message.content)
```

### Нативный формат Claude

```bash
curl https://your-platform.com/v1/messages \
  -H "x-api-key: sk-xxxxxxxx" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{"model": "claude-3-5-sonnet-20241022", "max_tokens": 1024, "messages": [{"role": "user", "content": "Hello"}]}'
```

### Нативный формат Gemini

```bash
curl "https://your-platform.com/v1beta/models/gemini-1.5-pro:generateContent?key=sk-xxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{"contents": [{"parts": [{"text": "Hello"}]}]}'
```

## Поддерживаемые эндпоинты

| Интерфейс                              | Путь                                    | Описание                                                                                                                                                                               |
| -------------------------------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Chat Completions                       | `POST /v1/chat/completions`             | Совместимый с OpenAI Chat Completions интерфейс, требует `model` и `messages`, поддерживает потоковые и обычные ответы.                                                                  |
| Playground Chat                        | `POST /pg/chat/completions`             | Специальный интерфейс веб-песочницы: группа и модель выбираются через сеанс входа, используются единые механизмы распределения трафика, преобразования протокола, тарификации и повторных попыток. |
| Text Completions                       | `POST /v1/completions`                  | Классический интерфейс дополнения текста, требует `prompt` и `model`.                                                                                                                    |
| Vector Embeddings                      | `POST /v1/embeddings`                   | Преобразует текст или массив текстов в векторы, требует `input`; адаптер канала приводит его к формату вышестоящего провайдера.                                                          |
| Gemini Embeddings Compatible Interface | `POST /v1/engines/{model}/embeddings`   | Совместим со старыми путями эмбеддинга в стиле Gemini, обрабатывает запросы по имени модели из URL.                                                                                    |
| Image Generation                       | `POST /v1/images/generations`           | Создаёт изображения по промпту; конкретная модель, размер, качество и количество зависят от параметров запроса и настроенных каналов.                                                      |
| Image Editing                          | `POST /v1/images/edits`                 | Редактирует изображение по входному изображению и промпту, поддерживает запросы JSON и `multipart/form-data`.                                                                            |
| Legacy Edit Interface                  | `POST /v1/edits`                        | Сохранённый совместимый путь, код переходит к обработке Relay для изображений; новым клиентам рекомендуется использовать `/v1/images/edits`.                                                    |
| Speech to Text                         | `POST /v1/audio/transcriptions`         | Преобразует аудио в текст и передаёт его на соответствующий канал распознавания речи в формате аудиоинтерфейса OpenAI.                                                                 |
| Audio Translation                      | `POST /v1/audio/translations`           | Распознаёт аудио и выводит переведённый текст.                                                                                                                                        |
| Text to Speech                         | `POST /v1/audio/speech`                 | Преобразует введённый текст в аудио.                                                                                                                                                   |
| Rerank                                 | `POST /v1/rerank`                       | Переупорядочивает кандидатов `documents` по релевантности относительно `query`; требует непустого запроса и списка документов.                                                          |
| Content Moderation                     | `POST /v1/moderations`                 | Выполняет модерацию содержимого текста или других входных данных; если модель не указана, используется модель модерации по умолчанию.                                                    |
| Responses API                          | `POST /v1/responses`                    | Интерфейс формата OpenAI Responses, поддерживает ввод, инструменты и события ответа.                                                                                                    |
| Responses Compression                  | `POST /v1/responses/compact`            | Выполняет сжатие контекста запросов Responses.                                                                                                                                         |
| Codex Web Search                       | `POST /v1/alpha/search`                 | Независимый интерфейс веб-поиска Codex; в настоящее время обрабатывается только Sub2API, Uter, Codex и продвинутыми пользовательскими каналами с такой поддержкой.                                 |
| Claude Messages                        | `POST /v1/messages`                     | Совместимый с Anthropic Claude Messages интерфейс, требует `model` и содержимого сообщений; при необходимости Uter преобразует протокол к формату вышестоящего провайдера.                          |
| Realtime Conversation                  | `GET /v1/realtime` (WebSocket)          | Двунаправленный интерфейс реального времени в стиле OpenAI Realtime; модель обычно передаётся через параметры запроса, а ключ API — через Bearer-токен или подпротокол WebSocket.                      |
| Gemini Native Model Invocation         | `POST /v1beta/models/{model}:{action}`  | Интерфейс в нативном формате Gemini, поддерживает пути операций с моделью, например `generateContent`, `streamGenerateContent` и операции эмбеддинга.                                              |
| Gemini Compatible Model Invocation     | `POST /v1/models/{model}:{action}`      | Принимает запросы операций с моделью в стиле Gemini с префиксом `/v1`; разбираются и преобразуются Relay Gemini.                                                                         |
| Model List                             | `GET /v1/models`                        | По умолчанию возвращает список моделей в формате OpenAI; в формате Claude — при заголовках запросов Anthropic, в формате Gemini — при `x-goog-api-key` или параметре запроса `key`.                          |
| Model Details                          | `GET /v1/models/{model}`                | Возвращает сведения об одной модели; если модель не существует, возвращается объект ошибки `model_not_found`.                                                                            |
| Gemini Model List                      | `GET /v1beta/models`                    | Возвращает список доступных моделей в формате Gemini; поля ответа включают `models` и `nextPageToken`.                                                                                  |
| OpenAI Format Model List               | `GET /v1beta/openai/models`             | Возвращает список моделей в формате OpenAI в пространстве имён совместимости Gemini.                                                                                                  |
