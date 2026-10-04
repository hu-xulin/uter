# Нативный формат OpenAI

Создаёт текстовое дополнение на основе заданной подсказки.

`POST` `/v1/completions`

### Тело запроса (`application/json`)

| Поле | Тип | Обязательно | Описание |
|---|---|---|---|
| `model` | string | да | — |
| `max_tokens` | integer | нет | — |
| `temperature` | number | нет | — |
| `top_p` | number | нет | — |
| `n` | integer | нет | — |
| `stream` | boolean | нет | — |
| `suffix` | string | нет | — |
| `echo` | boolean | нет | — |

### Ответ

| Код статуса | Описание |
|---|---|
| `200` | Успешно создан ответ |

#### Поля ответа `200`

| Поле | Тип | Описание |
|---|---|---|
| `id` | string | — |
| `object` | string | — |
| `created` | integer | — |
| `model` | string | — |
| `choices` | array&lt;object&gt; | — |
| `usage.prompt_tokens` | integer | Количество токенов подсказки |
| `usage.completion_tokens` | integer | Количество токенов дополнения |
| `usage.total_tokens` | integer | Общее количество токенов |
| `usage.prompt_tokens_details.cached_tokens` | integer | — |
| `usage.prompt_tokens_details.text_tokens` | integer | — |
| `usage.prompt_tokens_details.audio_tokens` | integer | — |
| `usage.prompt_tokens_details.image_tokens` | integer | — |
| `usage.completion_tokens_details.text_tokens` | integer | — |
| `usage.completion_tokens_details.audio_tokens` | integer | — |
| `usage.completion_tokens_details.reasoning_tokens` | integer | — |
