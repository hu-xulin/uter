# LunaTranslator — открытый переводчик GalGame

> **Параметры настроек чата**
>
> В «Системных настройках» → «Настройках чата» консоли Uter можно добавить
> следующий параметр быстрого доступа для заполнения в один клик в LunaTranslator
> со страницы управления токенами:

    ```json
    { "LunaTranslator": "lunatranslator://llmapi/base64?data={cheryConfig}" }
    ```

> LunaTranslator
> — это открытый и бесплатный переводчик визуальных новелл (GalGame), созданный для обеспечения игрового опыта уровня родного.

- Адрес проекта: [https://github.com/HIllya51/LunaTranslator](https://github.com/HIllya51/LunaTranslator)
- Документация проекта: [https://docs.lunatranslator.org/en/README.html](https://docs.lunatranslator.org/en/README.html)

## Поддерживаемые функции

- **HOOK** В основном использует HOOK для извлечения текста игры, адаптируясь почти ко всем распространённым и редким визуальным новеллам.
- **Внутриигровой перевод** Для некоторых игр перевод может быть встроен непосредственно в игру для иммерсивного опыта.
- **Эмулятор HOOK** Для большинства игр на NS/PSP/PSV/PS2 поддержка эмулятора HOOK позволяет напрямую считывать текст игры.
- **OCR** Встроенные высокоточные OCR-модели, а также поддержка множества других онлайн- и офлайн-движков OCR для гибкого считывания любого текста.
- **Богатые интерфейсы перевода** Поддерживает почти все движки перевода, включая перевод большими языковыми моделями, офлайн-перевод и др.
- **Изучение языка** Поддерживает японскую сегментацию слов и кану фуригану, AnkiConnect и плагин Yomitan.
- **Речевой синтез** Поддерживает большое количество онлайн- и офлайн-движков речевого синтеза.
- **Распознавание речи** В Windows 10 и Windows 11 можно использовать распознавание речи Windows.

## Способ установки

Загрузите и установите из [Документация LunaTranslator — Загрузка, запуск и обновление](https://docs.lunatranslator.org/en/README.html)

## Интеграция Uter в LunaTranslator

LunaTranslator поддерживает интеграцию с локально развёрнутым Uter. Используйте свой собственный развёрнутый экземпляр Uter или убедитесь, что поставщик услуг имеет легитимную апстрим-авторизацию и обязательства по соответствию для своего сервиса Uter. Не подключайте адреса API или ключи из неизвестных источников к производственным средам.

### Настройка в один клик

1. В «`System Settings`» → «`Chat Settings`» консоли Uter добавьте следующий параметр быстрого доступа:

   ```json
   { "LunaTranslator": "lunatranslator://llmapi/base64?data={cheryConfig}" }
   ```

   ![add_config](/apps-assets/luna_translator/add_config.webp)

2. На вкладке **`Uter`** → `Console` → `Token Management` выберите токен, который хотите использовать в LunaTranslator, нажмите раскрывающееся меню рядом с кнопкой чата, выберите `LunaTranslator`, и вы будете перенаправлены в LunaTranslator с автоматически настроенными адресом API и API-ключом.

   ![跳转到 LunaTranslator](/apps-assets/luna_translator/jump_to_app.webp)

3. В **`LunaTranslator`** → `Settings` → `Translation Settings` → `Large Models` появится новая конфигурация интерфейса большой языковой модели; нажмите Edit.

   ![设置api](/apps-assets/luna_translator/api_setting.webp)

4. Нажмите кнопку обновления рядом с выпадающим списком **model**, чтобы получить список моделей платформы Uter, выберите или введите название модели, затем нажмите OK для сохранения.

   ![设置模型](/apps-assets/luna_translator/setting_model.webp)

5. Проверьте, включён ли переключатель рядом с конфигурацией интерфейса большой языковой модели **uter**. Если не включён, активируйте интерфейс, чтобы начать использовать его.

   ![开启配置](/apps-assets/luna_translator/open_config.webp)

### Ручная настройка

1. На вкладке **`Uter`** → `Console` → `Token Management` получите API-ключ.

   ![获取 API Key](/apps-assets/luna_translator/copy_api_key.webp)

2. В **`LunaTranslator`** → `Settings` → `Translation Settings` → `Large Models` выберите Add.

   ![添加 API](/apps-assets/luna_translator/add_api.webp)

3. Скопируйте шаблон **Large Model General Interface** и добавьте новый интерфейс.

   ![添加 API2](/apps-assets/luna_translator/add_api_2.webp)

4. В **новом добавленном интерфейсе** заполните соответствующие адрес API и API-ключ.

   ![设置 API1](/apps-assets/luna_translator/setting_api.webp)

   ![设置 API2](/apps-assets/luna_translator/setting_api2.webp)

5. Нажмите кнопку обновления рядом с выпадающим списком **model**, чтобы получить список моделей платформы Uter, выберите или введите название модели, затем нажмите OK для сохранения.

   ![设置 API3](/apps-assets/luna_translator/setting_api3.webp)

6. Нажмите переключатель рядом с **Uter**, чтобы активировать интерфейс и начать использовать его.

   ![打开API](/apps-assets/luna_translator/open_api.webp)

Подробные способы использования см. в официальной документации LunaTranslator: [Документация LunaTranslator — Интерфейс перевода большими языковыми моделями](https://docs.lunatranslator.org/en/guochandamoxing.html)
