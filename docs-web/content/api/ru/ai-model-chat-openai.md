# openai

## Формат ChatCompletions

Создаёт ответ модели на основе истории диалога. Поддерживает потоковые и непотоковые ответы.

Совместимо с OpenAI Chat Completions API.

`POST` `/v1/chat/completions`

### Тело запроса (`application/json`)

| Поле | Тип | Обязательно | Описание |
|---|---|---|---|
| `model` | string | да | Идентификатор модели |
| `messages` | array&lt;object&gt; | да | Список сообщений диалога |
| `temperature` | number | нет | Температура выборки |
| `top_p` | number | нет | Параметр ядерной выборки |
| `n` | integer | нет | Количество генерируемых вариантов |
| `stream` | boolean | нет | Использовать ли потоковый ответ |
| `stream_options.include_usage` | boolean | нет | — |
| `max_tokens` | integer | нет | Максимальное количество генерируемых токенов |
| `max_completion_tokens` | integer | нет | Максимальное количество токенов дополнения |
| `presence_penalty` | number | нет | — |
| `frequency_penalty` | number | нет | — |
| `logit_bias` | object | нет | — |
| `user` | string | нет | — |
| `tools` | array&lt;object&gt; | нет | — |
| `response_format.type` | enum（`text`, `json_object`, `json_schema`） | нет | — |
| `response_format.json_schema` | object | нет | Определение JSON Schema |
| `seed` | integer | нет | — |
| `reasoning_effort` | enum（`low`, `medium`, `high`） | нет | Интенсивность рассуждения (для моделей с поддержкой рассуждений) |
| `modalities` | array&lt;enum（`text`, `audio`）&gt; | нет | — |
| `audio.voice` | string | нет | — |
| `audio.format` | string | нет | — |

### Ответ

| Код статуса | Описание |
|---|---|
| `200` | Успешно создан ответ |
| `400` | Ошибка параметров запроса |
| `429` | Ограничение частоты запросов |

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
| `system_fingerprint` | string | — |

#### Поля ответа `400`

| Поле | Тип | Описание |
|---|---|---|
| `error.message` | string | Текст ошибки |
| `error.type` | string | Тип ошибки |
| `error.param` | string | Связанный параметр |
| `error.code` | string | Код ошибки |

#### Поля ответа `429`

| Поле | Тип | Описание |
|---|---|---|
| `error.message` | string | Текст ошибки |
| `error.type` | string | Тип ошибки |
| `error.param` | string | Связанный параметр |
| `error.code` | string | Код ошибки |

## Формат Responses

OpenAI Responses API, используемый для создания ответов модели.
Поддерживает многораундовый диалог, вызов инструментов, рассуждения и другие функции.

`POST` `/v1/responses`

### Тело запроса (`application/json`)

| Поле | Тип | Обязательно | Описание |
|---|---|---|---|
| `model` | string | да | — |
| `instructions` | string | нет | — |
| `max_output_tokens` | integer | нет | — |
| `temperature` | number | нет | — |
| `top_p` | number | нет | — |
| `stream` | boolean | нет | — |
| `tools` | array&lt;object&gt; | нет | — |
| `reasoning.effort` | enum（`low`, `medium`, `high`） | нет | — |
| `reasoning.summary` | string | нет | — |
| `previous_response_id` | string | нет | — |
| `truncation` | enum（`auto`, `disabled`） | нет | — |

### Ответ

| Код статуса | Описание |
|---|---|
| `200` | Успешно создан ответ |

#### Поля ответа `200`

| Поле | Тип | Описание |
|---|---|---|
| `id` | string | — |
| `object` | string | — |
| `created_at` | integer | — |
| `status` | enum（`completed`, `failed`, `in_progress`, `incomplete`） | — |
| `model` | string | — |
| `output` | array&lt;object&gt; | — |
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
