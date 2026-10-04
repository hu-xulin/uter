# qwen

## Генерация изображений

Генерация изображений серии 百炼 qwen-image.

`POST` `/v1/images/generations`

### Тело запроса (`application/json`)

| Поле | Тип | Обязательно | Описание |
|---|---|---|---|
| `model` | string | да | — |
| `input.messages` | array&lt;object&gt; | нет | — |
| `parameters.negative_prompt` | string | нет | — |
| `parameters.prompt_extend` | boolean | нет | — |
| `parameters.watermark` | boolean | нет | — |
| `parameters.size` | string | нет | — |

### Ответ

| Код статуса | Описание |
|---|---|
| `200` | Изображение успешно сгенерировано |

#### Поля ответа `200`

| Поле | Тип | Описание |
|---|---|---|
| `created` | integer | — |
| `data` | array&lt;object&gt; | — |

## Редактирование изображения

Редактирование изображений серии 百炼 qwen-image.

`POST` `/v1/images/edits`

### Тело запроса (`application/json`)

| Поле | Тип | Обязательно | Описание |
|---|---|---|---|
| `model` | string | да | — |
| `input.messages` | array&lt;object&gt; | нет | — |
| `parameters.n` | integer | нет | — |
| `parameters.negative_prompt` | string | нет | — |
| `parameters.prompt_extend` | boolean | нет | — |
| `parameters.watermark` | boolean | нет | — |
| `parameters.size` | string | нет | — |

### Ответ

| Код статуса | Описание |
|---|---|
| `200` | Изображение успешно сгенерировано |

#### Поля ответа `200`

| Поле | Тип | Описание |
|---|---|---|
| `created` | integer | — |
| `data` | array&lt;object&gt; | — |
