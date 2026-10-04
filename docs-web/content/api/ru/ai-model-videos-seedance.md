# Формат Seedance

Генерация видео Seedance (Dreamina): обращение к семейству моделей Dreamina Seedance 2.0 через асинхронный API задач; поддерживаются генерация по тексту, по изображению, а также продолжение / редактирование видео.

## Поддерживаемые модели

| Модель | Описание | Возможности |
|---|---|---|
| `dreamina-seedance-2-0` | Стандартная Seedance 2.0, в приоритете качество | Генерация по тексту, по изображению, продолжение видео |
| `dreamina-seedance-2-0-fast` | Быстрая Seedance 2.0, меньшая задержка | Генерация по тексту, по изображению, продолжение видео |

Обе модели поддерживают **видео как вход** (продолжение / редактирование), передавая `video_url` внутри `metadata.content`.

## Создание видео

`POST` `/v1/video/generations`

### Заголовки запроса

| Заголовок | Обязательно | Описание |
|---|---|---|
| `Authorization` | Да | `Bearer sk-your-api-key` |
| `Content-Type` | Да | `application/json` |

### Тело запроса (`application/json`)

| Поле | Тип | Обязательно | Описание |
|---|---|---|---|
| `model` | string | Да | Название модели Seedance, см. таблицу выше |
| `prompt` | string | Да | Видеоподсказка |
| `image` | string | Нет | Эталонное изображение для генерации по изображению (URL или data URI base64); взаимоисключающе с `images` |
| `images` | string[] | Нет | Мультиизображение (URL или data URI base64) |
| `duration` | int | Нет | Длительность в секундах; обычно 5 / 10, по умолчанию 5 |
| `seconds` | string | Нет | Строковая форма `duration` (для совместимости с OpenAI Sora API). Должна быть простой числовой строкой (напр. `"5"`, `"10"`) без единиц. Действует только когда верхуровневый `duration` равен `0` или опущен |
| `metadata` | object | Нет | Контейнер параметров, специфичных для Seedance, см. «Специфичные параметры» |

### Ответ

| Статус | Описание |
|---|---|
| `200` | Задача видео успешно создана |
| `400` | Недопустимые параметры запроса |

#### Поля ответа `200`

| Поле | Тип | Описание |
|---|---|---|
| `id` / `task_id` | string | Публичный ID задачи (префикс `task_`) для последующих запросов |
| `object` | string | Тип объекта (`video`) |
| `model` | string | Использованная модель |
| `status` | string | Состояние задачи (сразу после отправки — `queued`) |
| `progress` | integer | Прогресс в процентах |
| `created_at` | integer | Временная метка создания |

> `id` / `task_id` генерируется Uter и не является upstream-идентификатором задачи.

## Получение состояния задачи видео

`GET` `/v1/video/generations/{task_id}`

Ответ имеет форму конверта `{code, message, data}`; при успехе `code` равен `"success"`, а `data` — объекту деталей задачи.

### Параметры запроса

| Имя | Расположение | Тип | Обязательно | Описание |
|---|---|---|---|---|
| `task_id` | path | string | Да | ID задачи видео |

### Ответ

| Статус | Описание |
|---|---|
| `200` | Состояние задачи успешно получено |
| `404` | Задача не найдена |

#### Поля ответа `200` (`data`)

| Поле | Тип | Описание |
|---|---|---|
| `data.id` | int | Внутренний автоинкрементный ID задачи |
| `data.task_id` | string | Публичный ID задачи (префикс `task_`) |
| `data.platform` | string | Код upstream-платформы |
| `data.user_id` | int | ID пользователя |
| `data.group` | string | Название группы |
| `data.channel_id` | int | Фактически использованный ID канала |
| `data.quota` | int | Исходная квота, списанная за эту задачу |
| `data.action` | string | Действие задачи, обычно `generate` |
| `data.status` | string | Состояние задачи: `SUBMITTED` / `QUEUED` / `IN_PROGRESS` / `SUCCESS` / `FAILURE` |
| `data.fail_reason` | string | Причина сбоя (только когда `status = FAILURE`) |
| `data.result_url` | string | URL результата видео (возвращается только при успехе; временная upstream-ссылка) |
| `data.progress` | string | Прогресс, напр. `"100%"` |
| `data.submit_time` / `start_time` / `finish_time` | int64 | Unix-метки времени отправки / начала / завершения (секунды) |
| `data.properties.upstream_model_name` | string | Название модели, фактически отправленной upstream |
| `data.data` | object | Исходный ответ upstream (`usage`, `content.video_url`, `resolution`, `framespersecond`, …) |

#### Перечисление статусов

| Статус | Описание |
|---|---|
| `SUBMITTED` | Отправлено |
| `QUEUED` | В очереди upstream |
| `IN_PROGRESS` | Генерация |
| `SUCCESS` | Завершено; `result_url` содержит видео |
| `FAILURE` | Сбой; `fail_reason` объясняет причину |

## Получение содержимого видео

`GET` `/v1/videos/{task_id}/content`

Возвращает поток необработанного видео (`Content-Type: video/mp4`). Uter проксирует upstream-URL.

### Параметры запроса

| Имя | Расположение | Тип | Обязательно | Описание |
|---|---|---|---|---|
| `task_id` | path | string | Да | ID задачи видео |

> **Настоятельно рекомендуется**: загружайте через прокси `/content`, а не обращаясь к `result_url` напрямую, — это временная upstream-ссылка с ограниченным сроком действия.

## Специфичные параметры (`metadata`)

Все поля, специфичные для Seedance, передаются через объект `metadata` тела запроса и перенаправляются upstream.

### Разрешение / соотношение сторон / длительность

| Поле | Тип | Описание |
|---|---|---|
| `resolution` | string | Уровень разрешения: `480p` `720p` `1080p` |
| `ratio` | string | Соотношение сторон: `16:9` `9:16` `1:1` `4:3` `3:4` `21:9` `adaptive` |
| `duration` | int | Длительность видео в секундах: `5` `10`. **Примечание:** верхуровневый `duration` (или `seconds`) имеет приоритет над `metadata.duration` |
| `frames` | int | Количество кадров (необязательно, взаимоисключающе с `duration`), напр. `121` |
| `seed` | int | Случайное зерно, `0` – `2^31-1` |

### Управление камерой и содержимым

| Поле | Тип | Описание |
|---|---|---|
| `camera_fixed` | bool | Зафиксировать камеру (`true` = статичная) |
| `watermark` | bool | Добавлять ли официальный водяной знак |

### Расширенные параметры

| Поле | Тип | Описание |
|---|---|---|
| `service_tier` | string | Сервисный уровень, влияющий на скорость и квоту (напр. `auto` / `default` / `priority`) |
| `execution_expires_after` | int | Таймаут выполнения задачи в секундах |
| `generate_audio` | bool | Генерировать ли аудио |
| `draft` | bool | Черновой режим (быстрее и дешевле, качество чуть ниже) |
| `return_last_frame` | bool | Возвращать ли в ответе изображение последнего кадра |
| `callback_url` | string | Callback-URL, уведомляемый о завершении задачи |

### Мультимодальный ввод (массив `content`)

Помимо верхуровневых полей `image` / `images`, можно передать мультимодальный массив ввода в `metadata.content`, смешивая **изображения** и **видео**:

| `type` | Назначение |
|---|---|
| `image_url` + `image_url.url` | Эталонное изображение (изображение-в-видео) |
| `video_url` + `video_url.url` | Видеоввод (продолжение / редактирование) |

```json
{
  "model": "dreamina-seedance-2-0",
  "prompt": "Extend this video so the cat walks out of frame",
  "metadata": {
    "content": [
      { "type": "video_url", "video_url": { "url": "https://example.com/cat.mp4" } }
    ],
    "resolution": "720p"
  }
}
```

## Полный пример

```bash
# Text-to-video
curl -X POST https://uter.ai/v1/video/generations \
  -H "Authorization: Bearer sk-your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "dreamina-seedance-2-0",
    "prompt": "A cat strolling on the lunar surface under a starry sky",
    "duration": 5,
    "metadata": { "resolution": "720p", "ratio": "16:9", "seed": 42 }
  }'

# Poll the task
curl https://uter.ai/v1/video/generations/task_xxx \
  -H "Authorization: Bearer sk-your-api-key"

# Download the video
curl https://uter.ai/v1/videos/task_xxx/content \
  -H "Authorization: Bearer sk-your-api-key" \
  -o cat_on_moon.mp4
```

## Коды состояния и ошибки

| Случай | Описание |
|---|---|
| `400` | Модель не найдена или нет доступа (`model not allowed`), пустая `prompt` (`prompt is required`), недопустимое разрешение / длительность |
| `401` / `403` | Недействительный API-ключ / нет доступа к этой модели (проверьте белый список моделей токена) |
| `402` | Недостаточный баланс (`insufficient user quota`) |
| Задача `FAILURE` | Сбой upstream (модерация / недоступный URL изображения или видео / таймаут upstream); Uter автоматически возвращает списанные средства |

Рекомендуемая обработка: при сбоях модерации скорректируйте подсказку; если URL недоступны — переключитесь на base64; при таймаутах upstream повторите позже или переключитесь на `dreamina-seedance-2-0-fast`.
