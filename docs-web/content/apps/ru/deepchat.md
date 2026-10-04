# DeepChat — коммерчески-дружественный полнофункциональный ИИ-клиент-агент

> **Параметры настроек чата**
>
> В консоли Uter перейдите в «Системные настройки» → «Настройки чата» и добавьте
> следующий параметр быстрого доступа. Он позволяет пользователям заполнить DeepChat
> со страницы управления токенами в один клик:

    ```json
    { "DeepChat": "deepchat://provider/install?v=1&data={deepchatConfig}" }
    ```

> DeepChat — это открытый кроссплатформенный, коммерчески-дружественный
> полнофункциональный клиент-агент ИИ. Он поддерживает облачные и локальные модели,
> вызовы инструментов MCP, навыки (Skills), ACP, интеграцию агентов и удалённое
> управление рабочими процессами, что делает его подходящим для пользователей,
> которым нужно единое управление провайдерами и продвинутые ИИ-агенты.

- Официальный сайт: [https://deepchat.thinkinai.xyz](https://deepchat.thinkinai.xyz)
- Репозиторий на GitHub: [https://github.com/ThinkInAIXYZ/deepchat](https://github.com/ThinkInAIXYZ/deepchat)
- Адрес загрузки: [https://deepchat.thinkinai.xyz/#/download](https://deepchat.thinkinai.xyz/#/download)

## Способ интеграции с Uter

### Способ 1: импорт в один клик

1. В боковой панели консоли Uter откройте **Управление токенами** и найдите нужный токен
2. Выберите **DeepChat** в действиях с токеном
3. Разрешите браузеру запустить DeepChat и подтвердите открытие приложения
   ![Открытие DeepChat](/apps-assets/deepchat/3-open-deepchat.webp)
4. Подтвердите конфигурацию в предпросмотре импорта провайдера DeepChat
   ![Подтверждение конфигурации DeepChat](/apps-assets/deepchat/4-deepchat-ok.webp)
5. Откройте список моделей и выберите модель Uter, чтобы начать использовать её
   ![Открытие списка моделей](/apps-assets/deepchat/5-open-models.webp)

### Способ 2: ручной импорт

1. Скопируйте API-ключ и адрес сайта из консоли Uter
   ![Руководство по ручной настройке Uter](/apps-assets/deepchat/7-uter-manual-guidance.webp)
2. В настройках DeepChat добавьте или отредактируйте провайдера Uter, затем заполните адрес API и API-ключ
   ![Руководство по ручной настройке DeepChat](/apps-assets/deepchat/6-deepchat-manual-guidance.webp)
3. Откройте список моделей и выберите модель Uter, чтобы начать использовать её
   ![Открытие списка моделей](/apps-assets/deepchat/5-open-models.webp)

## Связанные ссылки

- [Репозиторий DeepChat на GitHub](https://github.com/ThinkInAIXYZ/deepchat)
- [Страница загрузки DeepChat](https://deepchat.thinkinai.xyz/#/download)
