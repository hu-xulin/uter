# Формат Google Veo

Генерация видео Google Veo 3.1: обращение к полному семейству моделей Veo 3.1 через асинхронный API задач; поддерживаются генерация по тексту и по изображению с опциональным синхронизированным аудио (выход до 4K).

## Поддерживаемые модели

Все три модели используют один конечный путь и различаются только полем `model`. Каждая модель поддерживает генерацию по тексту и по изображению с опциональной генерацией аудио.

| ID модели | Версия | Особенности | Лучше всего для |
|---|---|---|---|
| `veo-3.1-generate-001` | Veo 3.1 | Наивысшее качество, 4K, нативное аудио | Качественная креативная и коммерческая работа |
| `veo-3.1-fast-generate-001` | Veo 3.1 Fast | Быстрее, сбалансированное качество | Быстрая итерация, пакетная генерация |
| `veo-3.1-lite-generate-001` | Veo 3.1 Lite | Самая быстрая, наименьшая стоимость | Прототипирование, чувствительные к цене случаи |

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
| `model` | string | Да | ID модели Veo 3.1, см. таблицу выше |
| `prompt` | string | Да | Видеоподсказка; поддерживаются китайский и английский, для лучших результатов рекомендуется английский |
| `size` | string | Нет | Разрешение: `720p` / `1080p` / `4000` (4K, только некоторые модели), по умолчанию `1080p` |
| `resolution` | string | Нет | То же, что `size` (рекомендуется, совпадает с upstream; имеет приоритет при указании обоих) |
| `duration` | int | Нет | Длительность в секундах: `4` / `6` / `8`, по умолчанию `8` |
| `seconds` | string | Нет | Строковая форма `duration` (для совместимости с OpenAI Sora API) |
| `aspect_ratio` | string | Нет | Соотношение сторон: `16:9` / `9:16`, по умолчанию `16:9` |
| `generate_audio` | bool | Нет | Генерировать синхронизированное аудио (речь, эффекты, фон). **По умолчанию `true`**; явно задайте `false`, чтобы сэкономить |
| `negative_prompt` | string | Нет | Негативная подсказка с описанием того, чего избежать |
| `image` | string | Нет | Первый кадр для i2v; URL HTTP(S) / data URI / чистый base64 |
| `images` | string[] | Нет | Массив первых кадров для i2v; используется только `images[0]`, а `image` имеет приоритет, если переданы оба |
| `last_frame_image` | string | Нет | Изображение последнего кадра (вместе с `image` / `images[0]` → интерполяция первый+последний кадр, эксклюзивно для Veo 3.1). Тот же формат, что у `image` |
| `reference_images` | string[] | Нет | Эталонные изображения ассетов, до 3; отправляются upstream как `referenceType="asset"`. **Взаимоисключающе с `image` / `last_frame_image`** и поддерживается только для `duration=8` |
| `metadata` | object | Нет | Контейнер нативных параметров Veo, см. «Расширенные параметры metadata» |

> Верхуровневые поля snake_case, такие как `generate_audio` / `negative_prompt` / `aspect_ratio`, автоматически отображаются в camelCase-параметры upstream. Их также можно помещать внутрь `metadata` (snake_case или camelCase) — это эквивалентно верхуровневым.

> `generate_audio: true` значительно увеличивает стоимость (примерно в 2×). Поскольку по умолчанию тарификация `true`, явно задавайте `generate_audio: false`, когда аудио не нужно.

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

## Получение состояния задачи видео

`GET` `/v1/video/generations/{task_id}`

Ответ использует единый конверт Uter `{code, message, data}`.

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
| `data.task_id` | string | ID задачи |
| `data.status` | string | Состояние задачи: `queued` / `processing` / `succeeded` / `failed` |
| `data.error` | string / null | Причина сбоя; `null` при успехе |
| `data.format` | string / null | Выходной формат (напр. `mp4`); `null` во время обработки или при сбое |
| `data.metadata` | object / null | Дополнительные метаданные |
| `data.url` | string / null | URL загрузки видео; `null` во время обработки или при сбое (временная подписанная ссылка, действительна 24 часа) |

#### Перечисление статусов

| Статус | Описание |
|---|---|
| `queued` | Отправлено, ожидает обработки |
| `processing` | Генерация |
| `succeeded` | Завершено; `data.url` содержит адрес загрузки |
| `failed` | Сбой; `data.error` объясняет причину |

## Форматы входных изображений

`image` / `images[0]` принимают следующие три формата; Uter определяет их и преобразует во встроенный base64, который ожидает Veo:

| Формат | Пример | Описание |
|---|---|---|
| HTTP(S) URL | `https://example.com/foo.png` | Загружается и кодируется в base64 бэкендом; URL должен быть публично доступен и не просрочен |
| data URI | `data:image/png;base64,iVBOR...` | Встроенные данные передаются напрямую; сеть не требуется |
| чистый base64 | `iVBORw0KGgo...` (без префикса) | «Голый» base64; MIME-тип определяется автоматически |

Ограничения: декодированный размер ≤ **20 МБ**; таймаут загрузки URL — **30 секунд**; при ошибках разбора (недоступный URL / слишком большой / неверный base64) возвращается `400 parse images[0] failed: ...` **без списания**. Нативные URI `gs://` GCS не поддерживаются; используйте `https://storage.googleapis.com/...`.

## Расширенные параметры metadata

`metadata` — нативный контейнер параметров Veo для расширенных опций, отсутствующих в стиле OpenAI. Все верхуровневые поля также можно помещать внутрь `metadata` (snake_case или camelCase).

| Поле | Тип | Описание |
|---|---|---|
| `seed` | int | Случайное зерно (рекомендуемое место) |
| `personGeneration` / `person_generation` | string | Политика генерации персон: `allow_all` / `allow_adult` / `dont_allow` |
| `storageUri` / `storage_uri` | string | Прямая запись результата в путь GCS-бакета (только канал vertex; требует прав) |
| `compressionQuality` / `compression_quality` | string | Качество сжатия: `optimized` (по умолчанию) / `lossless` |
| `resizeMode` / `resize_mode` | string | Режим изменения размера i2v: `crop` / `fit` |
| `sampleCount` / `sample_count` | int | Количество видео на запрос; **в настоящее время зафиксировано на 1**, любое значение переопределяется |

> Приоритет: camelCase уже в metadata > snake_case в metadata > верхуровневые поля.

## Сравнение моделей

| Пункт | Veo 3.1 | Veo 3.1 Fast | Veo 3.1 Lite |
|---|---|---|---|
| **ID модели** | `veo-3.1-generate-001` | `veo-3.1-fast-generate-001` | `veo-3.1-lite-generate-001` |
| **Качество** | Наивысшее | Сбалансированное | Базовое |
| **Скорость (замер, 8с видео)** | 90–130 с | 75–105 с | 50–80 с |
| **Макс. разрешение** | 4K | 1080p | 1080p |
| **Поддержка аудио** | ✓ | ✓ | ✓ |
| **Изображение-в-видео** | ✓ | ✓ | ✓ |

## Совместимая с OpenAI конечная точка

Помимо `/v1/video/generations`, доступна конечная точка в стиле OpenAI `/v1/videos`; они полностью эквивалентны.

- Отправка: `POST` `/v1/videos` (идентичные поля тела)
- Запрос: `GET` `/v1/videos/{task_id}` (возвращает плоский формат OpenAI)

> Ответ совместимого с OpenAI запроса не содержит URL видео. Чтобы получить адрес загрузки, используйте `/v1/video/generations/{task_id}` и прочитайте `data.url`.

## Тарификация

```
quota = modelPrice × QuotaPerUnit × groupRatio × pricingRatio × seconds

QuotaPerUnit = 500,000
groupRatio   = 1.0 (производственная группа по умолчанию)
```

### Только видео (`generate_audio: false`)

| Модель | 720p | 1080p | 4K |
|---|---|---|---|
| `veo-3.1-generate-001` | $0.20 / с | $0.20 / с | $0.40 / с |
| `veo-3.1-fast-generate-001` | $0.08 / с | $0.10 / с | $0.25 / с |
| `veo-3.1-lite-generate-001` | $0.03 / с | $0.05 / с | — |

### Видео + аудио (`generate_audio: true`)

| Модель | 720p | 1080p | 4K |
|---|---|---|---|
| `veo-3.1-generate-001` | $0.40 / с | $0.40 / с | $0.60 / с |
| `veo-3.1-fast-generate-001` | $0.10 / с | $0.12 / с | $0.30 / с |
| `veo-3.1-lite-generate-001` | $0.05 / с | $0.08 / с | — |

При `failed` Uter автоматически возвращает средства.

## Полный пример

```bash
# Text-to-video
curl -X POST https://uter.ai/v1/video/generations \
  -H "Authorization: Bearer sk-your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "veo-3.1-generate-001",
    "prompt": "A golden retriever playing fetch on a sunny beach, cinematic wide shot, slow motion",
    "size": "1080p",
    "duration": 8,
    "aspect_ratio": "16:9"
  }'

# Poll (every 10~15 seconds)
curl https://uter.ai/v1/video/generations/task_xxx \
  -H "Authorization: Bearer sk-your-api-key"

# Once data.status == "succeeded", download from data.url
curl -o output.mp4 "https://uter.ai/v1/videos/task_xxx/content"
```

Интерполяция первый+последний кадр (эксклюзивно для Veo 3.1):

```bash
curl -X POST https://uter.ai/v1/video/generations \
  -H "Authorization: Bearer sk-your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "veo-3.1-generate-001",
    "prompt": "Smooth cinematic transition between a serene garden and a bustling city.",
    "image": "https://example.com/start.jpg",
    "last_frame_image": "https://example.com/end.jpg",
    "size": "1080p",
    "duration": 8,
    "aspect_ratio": "16:9"
  }'
```

- `reference_images` нельзя комбинировать с `image` / `images` / `last_frame_image`, иначе возвращается `400 reference_images is mutually exclusive ...`.
- `reference_images` принимает не более 3 элементов; при большем числе возвращается `400 reference_images supports at most 3 entries`.
- `reference_images` поддерживается только для `duration=8`.

## Коды состояния и ошибки

| Статус | Причина | Действие |
|---|---|---|
| `400` | Ошибка параметра (отсутствует `prompt`, недопустимый `duration` или сбой разбора изображения `parse images[0] failed: ...`) | Проверьте поля тела запроса |
| `401` | Недействительный или просроченный API-ключ | Проверьте заголовок `Authorization` |
| `403` | API-ключ не имеет доступа к этой модели | Проверьте белый список моделей токена |
| `402` | Недостаточный баланс | Пополните в консоли Uter |

Частые причины `failed`: отклонение службой безопасности контента (скорректируйте подсказку; добавьте `negative_prompt`), недоступный URL изображения, `duration` вне диапазона или запрос 4K на модели Lite.
