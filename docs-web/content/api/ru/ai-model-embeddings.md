# embeddings

## Нативный формат OpenAI

Преобразует текст в векторные вложения (embeddings).

`POST` `/v1/embeddings`

### Тело запроса (`application/json`)

| Поле | Тип | Обязательно | Описание |
|---|---|---|---|
| `model` | string | да | — |
| `encoding_format` | enum（`float`, `base64`） | нет | — |
| `dimensions` | integer | нет | Размерность выходного вектора |

### Ответ

| Код статуса | Описание |
|---|---|
| `200` | Вложение успешно создано |

#### Поля ответа `200`

| Поле | Тип | Описание |
|---|---|---|
| `object` | string | — |
| `data` | array&lt;object&gt; | — |
| `model` | string | — |
| `usage.prompt_tokens` | integer | — |
| `usage.total_tokens` | integer | — |

## Нативный формат Gemini

Создаёт вложения с использованием указанного движка/модели.

`POST` `/v1/engines/{model}/embeddings`

### Параметры запроса

| Параметр | Расположение | Тип | Обязательно | Описание |
|---|---|---|---|---|
| `model` | path | string | да | Идентификатор модели/движка |

### Тело запроса (`application/json`)

| Поле | Тип | Обязательно | Описание |
|---|---|---|---|
| `model` | string | да | — |
| `encoding_format` | enum（`float`, `base64`） | нет | — |
| `dimensions` | integer | нет | Размерность выходного вектора |

### Ответ

| Код статуса | Описание |
|---|---|
| `200` | Вложение успешно создано |

#### Поля ответа `200`

| Поле | Тип | Описание |
|---|---|---|
| `object` | string | — |
| `data` | array&lt;object&gt; | — |
| `model` | string | — |
| `usage.prompt_tokens` | integer | — |
| `usage.total_tokens` | integer | — |
