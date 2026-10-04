# Нативный формат Claude

## Нативный формат Claude

Запрос в формате Anthropic Claude Messages API.
В заголовках запроса необходимо указать `anthropic-version`.

`POST` `/v1/messages`

### Параметры запроса

| Параметр | Расположение | Тип | Обязательно | Описание |
|---|---|---|---|---|
| `anthropic-version` | header | string | да | Версия Anthropic API |
| `x-api-key` | header | string | нет | Anthropic API Key (необязательно, также можно использовать Bearer Token) |

### Тело запроса (`application/json`)

| Поле | Тип | Обязательно | Описание |
|---|---|---|---|
| `model` | string | да | — |
| `messages` | array&lt;object&gt; | да | — |
| `max_tokens` | integer | да | — |
| `temperature` | number | нет | — |
| `top_p` | number | нет | — |
| `top_k` | integer | нет | — |
| `stream` | boolean | нет | — |
| `stop_sequences` | array&lt;string&gt; | нет | — |
| `tools` | array&lt;object&gt; | нет | — |
| `tool_choice.type` | enum（`auto`, `any`, `tool`） | нет | — |
| `tool_choice.name` | string | нет | — |
| `thinking.type` | enum（`enabled`, `disabled`） | нет | — |
| `thinking.budget_tokens` | integer | нет | — |
| `metadata.user_id` | string | нет | — |

### Ответ

| Код статуса | Описание |
|---|---|
| `200` | Успешно создан ответ |

#### Поля ответа `200`

| Поле | Тип | Описание |
|---|---|---|
| `id` | string | — |
| `type` | string | — |
| `role` | string | — |
| `content` | array&lt;object&gt; | — |
| `model` | string | — |
| `stop_reason` | enum（`end_turn`, `max_tokens`, `stop_sequence`, `tool_use`） | — |
| `usage.input_tokens` | integer | — |
| `usage.output_tokens` | integer | — |
| `usage.cache_creation_input_tokens` | integer | — |
| `usage.cache_read_input_tokens` | integer | — |
