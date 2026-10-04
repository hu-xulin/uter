# Нативный формат OpenAI

Получает список доступных в данный момент моделей.

Формат ответа определяется автоматически по заголовкам запроса:
- при наличии заголовков `x-api-key` и `anthropic-version` возвращается формат Anthropic
- при наличии заголовка `x-goog-api-key` или параметра запроса `key` возвращается формат Gemini
- в остальных случаях возвращается формат OpenAI

`GET` `/v1/models`

### Параметры запроса

| Параметр | Расположение | Тип | Обязательно | Описание |
|---|---|---|---|---|
| `key` | query | string | нет | Google API Key (для формата Gemini) |
| `x-api-key` | header | string | нет | Anthropic API Key (для формата Claude) |
| `anthropic-version` | header | string | нет | Версия Anthropic API |
| `x-goog-api-key` | header | string | нет | Google API Key (для формата Gemini) |

### Ответ

| Код статуса | Описание |
|---|---|
| `200` | Список моделей успешно получен |
| `401` | Ошибка аутентификации |

#### Поля ответа `200`

| Поле | Тип | Описание |
|---|---|---|
| `object` | string | — |
| `data` | array&lt;object&gt; | — |

#### Поля ответа `401`

| Поле | Тип | Описание |
|---|---|---|
| `error.message` | string | Текст ошибки |
| `error.type` | string | Тип ошибки |
| `error.param` | string | Связанный параметр |
| `error.code` | string | Код ошибки |
