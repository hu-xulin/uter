# Claude Code

> **Введение в проект**
>
> Раскройте чистую мощь Claude прямо в вашем терминале. Мгновенно ищите кодовые базы в миллионы строк. Превращайте многочасовые рабочие процессы в единственную команду. Ваши инструменты. Ваш рабочий процесс. Ваша кодовая база, развивающаяся со скоростью мысли.
>
>   - Официальная домашняя страница: [https://www.anthropic.com/claude-code](https://www.anthropic.com/claude-code)

## Демонстрация

![introduce-01.webp](/apps-assets/claude_code/introduce-01.webp)

![introduce-02.webp](/apps-assets/claude_code/introduce-02.webp)

### Возможности

| **Категория** | **Возможность** |
| --- | --- |
| **Понимание кода** | Глубокий анализ кодовой базы с использованием интеллектуальных агентов для поиска и понимания структуры проекта и зависимостей |
|  | Автоматически генерирует высокоуровневые обзоры кода, помогая пользователям быстро понять кодовую базу |
| **Редактирование кода** | Поддерживает совместное редактирование нескольких файлов, подходит для сложных изменений кода |
|  | Предоставляет практичные и применимые предложения кода, соответствующие шаблонам и архитектуре проекта |
| **Возможности интеграции** | Поддерживает прямое выполнение в терминале, устраняя переключение контекста |
|  | Бесшовная интеграция с VS Code и IDE JetBrains, без необходимости копирования и вставки |
| **Генерация и оптимизация кода** | Автоматически генерирует код, создаёт тесты, исправляет ошибки, поддерживая полный процесс от концепции до коммита |
|  | Оптимизирован для генерации и понимания кода, сочетая продвинутые модели, такие как Claude Opus 4 |
| **Безопасность и гибкость** | Изменения требуют явного разрешения пользователя, обеспечивая более безопасные операции с файлами и командами |
|  | Адаптируется к стандартам кода пользователя, поддерживает пользовательские конфигурации |
| **Интеграция с инструментарием** | Поддерживает интеграцию с инструментами, такими как GitHub и GitLab, для автоматизированных рабочих процессов |
|  | Интегрируется с тестовыми наборами и системами сборки, расширяя существующие инструменты разработки |
| **Кроссплатформенность и расширяемость** | Поддерживает операционные системы Windows, macOS и Linux |
|  | Настраивается для запуска в SDK или GitHub Actions, гибко адаптируясь к разным потребностям |
| **Ключевые сценарии применения** | Адаптация к кодовой базе и её понимание, быстрый старт для новых участников |
|  | Процессы исправления и оптимизации проблем с кодом, от анализа проблемы до отправки PR |
|  | Рефакторинг кода проекта и реализация новых функций |
| **Основные моменты отзывов пользователей** | Повышает повседневную эффективность разработки, экономя время на рутинных задачах |
|  | Отличная производительность при обработке сложных многошаговых задач, расширяя возможности разработки |

## Способ настройки ИИ-модели

### Графическое руководство для Windows

#### 1. Установите среду Node.js

Claude Code требует среды Node.js для запуска.

> **Шаги установки среды Node.js**
>
> - Откройте браузер и перейдите на https://nodejs.org/
>   - Нажмите версию «LTS», чтобы загрузить (рекомендуется версия с долгосрочной поддержкой)
>   - После загрузки дважды щёлкните файл .msi
>   - Следуйте мастеру установки, сохраняя настройки по умолчанию

> **Примечания для Windows**
>
> - Рекомендуется использовать PowerShell вместо CMD
>   - При возникновении проблем с правами попробуйте запустить от имени администратора
>   - Некоторое антивирусное ПО может выдавать ложные срабатывания; возможно, потребуется добавить исключение

![windows-img-01.webp](/apps-assets/claude_code/windows-img-01.webp)

![windows-img-02.webp](/apps-assets/claude_code/windows-img-02.webp)

![windows-img-03.webp](/apps-assets/claude_code/windows-img-03.webp)

![windows-img-04.webp](/apps-assets/claude_code/windows-img-04.webp)

![windows-img-05.webp](/apps-assets/claude_code/windows-img-05.webp)

> **Проверка успешности установки**
>
> После установки откройте PowerShell или CMD и введите следующие команды:
>
>   ```bash
>   node --version
>   npm --version
>   ```
>
>   Если отображаются номера версий, установка прошла успешно.

#### 2. Установите Git Bash

> **Примечания для Windows**
>
> В среде Windows для установки Claude Code требуется Git Bash. После установки настройка переменных среды и использование Claude Code по-прежнему выполняются в обычном PowerShell или CMD.

> **Загрузка и установка Git для Windows**
>
> - Перейдите на https://git-scm.com/downloads/win
>   - Нажмите «Download for Windows», чтобы загрузить установщик
>   - Запустите загруженный .exe файл установки
>   - Сохраняйте настройки по умолчанию во время установки и нажимайте «Next», чтобы завершить установку

![windows-img-06.webp](/apps-assets/claude_code/windows-img-06.webp)

![windows-img-07.webp](/apps-assets/claude_code/windows-img-07.webp)

![windows-img-08.webp](/apps-assets/claude_code/windows-img-08.webp)

> **Проверка установки Git Bash**
>
> После установки откройте Git Bash и введите следующую команду для проверки:
>
>   ```bash
>   git --version
>   ```
>
>   Если отображается номер версии, установка прошла успешно.

#### 3. Установите Claude Code

> **Установка Claude Code**
>
> Откройте PowerShell и выполните следующую команду:
>
>   ```bash
>   npm install -g @anthropic-ai/claude-code
>   ```
>
>   Эта команда загрузит и установит последнюю версию Claude Code из официального репозитория npm.

![windows-img-09.webp](/apps-assets/claude_code/windows-img-09.webp)

> **Добавьте ~/.local/bin в PATH (только если появится запрос)**
>
> ```powershell
>   [Environment]::SetEnvironmentVariable('Path', ([Environment]::GetEnvironmentVariable('Path','User') + ";$HOME\.local\bin"), 'User')
>   ```

> **Проверка установки Claude Code**
>
> После установки введите следующую команду, чтобы проверить успешность установки:
>
>   ```bash
>   claude --version
>   ```
>
>   Если отображается номер версии, поздравляем! Claude Code успешно установлен.

#### 4. Настройте переменные среды

> **Команда быстрой настройки (система Windows)**
>
> Чтобы позволить Claude Code подключаться к вашему relay-сервису, необходимо задать несколько переменных среды:

```powershell
iex (irm 'https://raw.githubusercontent.com/Uter.ai/uter-docs/refs/heads/main/helper/claude-cli-setup.ps1')
```

![windows-configure](/apps-assets/claude_code/windows_configure.webp)

#### 5. Начните использовать Claude Code

Теперь вы можете начать использовать Claude Code!

> **Запуск Claude Code**
>
> Откройте PowerShell и запустите Claude Code напрямую:
>
>   ```bash
>   claude
>   ```
>
>   Для использования в определённом проекте:
>
>   ```bash
>   # Перейдите в каталог вашего проекта
>   cd C:\path\to\your\project
>
>   # Запустите Claude Code
>   claude
>   ```

![windows-img-11.webp](/apps-assets/claude_code/windows-img-11.webp)

![windows-img-12.webp](/apps-assets/claude_code/windows-img-12.webp)

![windows-img-13.webp](/apps-assets/claude_code/windows-img-13.webp)

![windows-img-14.webp](/apps-assets/claude_code/windows-img-14.webp)

![windows-img-15.webp](/apps-assets/claude_code/windows-img-15.webp)

> **Выбор модели**
>
> Введите команду:
>
>   ```bash
>   /model
>   ```
>
>   Нажмите Enter для выбора модели; обычно достаточно настроек по умолчанию.

![windows-img-16.webp](/apps-assets/claude_code/windows-img-16.webp)

![windows-img-17.webp](/apps-assets/claude_code/windows-img-17.webp)

> Примечание: после изменения переменных среды все модели (включая предустановленные официальные модели) будут вызывать пользовательскую точку доступа вместо использования квот официальной учётной записи.

### Графическое руководство для macOS

#### 1. Установите CLI Claude Code

Откройте Терминал

![macos-img-01.webp](/apps-assets/claude_code/macos-img-01.webp)

> **Установка Claude Code**
>
> Откройте Терминал и выполните следующую команду:
>
>   ```bash
>   curl -fsSL https://claude.ai/install.sh | bash
>   ```
>
>   Необязательно: выполните предложенную команду при запросе
>
>   ```bash
>   echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc && source ~/.bashrc
>   ```

![macos-img-02.webp](/apps-assets/claude_code/macos-img-02.webp)

#### 2. Настройте переменные среды

Чтобы позволить Claude Code подключаться к стороннему relay-сервису, необходимо задать переменные среды:

> **Быстрая настройка переменных среды Claude Code**
>
> Введите команду:
>
>   ```bash
>   curl -fsSL https://raw.githubusercontent.com/Uter.ai/uter-docs/refs/heads/main/helper/claude-cli-setup.sh | bash
>   ```

![macos-configure](/apps-assets/claude_code/macos_configure.webp)

> **Проверка установки Claude Code**
>
> После установки введите следующую команду, чтобы проверить успешность установки:
>
>   ```bash
>   claude --version
>   ```
>
>   Если отображается номер версии, поздравляем! Claude Code успешно установлен.

#### 3. Начните использовать Claude Code

Теперь вы можете начать использовать Claude Code!

> **Запуск Claude Code**
>
> Запустите Claude Code напрямую:
>
>   ```bash
>   claude
>   ```
>
>   Для использования в определённом проекте:
>
>   ```bash
>   # Перейдите в каталог вашего проекта
>   cd /path/to/your/project
>
>   # Запустите Claude Code
>   claude
>   ```

![macos-img-04.webp](/apps-assets/claude_code/macos-img-04.webp)

![macos-img-05.webp](/apps-assets/claude_code/macos-img-05.webp)

![macos-img-06.webp](/apps-assets/claude_code/macos-img-06.webp)

![macos-img-07.webp](/apps-assets/claude_code/macos-img-07.webp)

![macos-img-08.webp](/apps-assets/claude_code/macos-img-08.webp)

> **Выбор модели (необязательно)**
>
> Введите команду:
>
>   ```bash
>   /model
>   ```
>
>   Нажмите Enter для выбора официальной модели; обычно достаточно модели по умолчанию.

![macos-img-09.webp](/apps-assets/claude_code/macos-img-09.webp)

![macos-img-10.webp](/apps-assets/claude_code/macos-img-10.webp)

![macos-img-11.webp](/apps-assets/claude_code/macos-img-11.webp)

> Примечание: после изменения переменной среды `ANTHROPIC_BASE_URL` все модели (включая предустановленные официальные модели) будут вызывать пользовательскую точку доступа вместо использования квот официальной учётной записи.

#### 4. Распространённые проблемы macOS

> **Настройки безопасности macOS препятствуют выполнению**
>
> Если система препятствует запуску Claude Code:
>
>   - Откройте «Системные настройки» → «Безопасность и конфиденциальность»
>   - Нажмите «Открыть всё равно» или «Разрешить»
>   - Или выполните в Терминале: `sudo spctl --master-disable`

### Графическое руководство для Linux

#### 1. Установите Claude Code

![linux-img-01.webp](/apps-assets/claude_code/linux-img-01.webp)

> **Установка Claude Code**
>
> Откройте Терминал и выполните следующую команду:
>
>   ```bash
>   curl -fsSL https://claude.ai/install.sh | bash
>   ```
>
>   При возникновении проблем с правами можно использовать sudo:
>
>   ```bash
>   sudo curl -fsSL https://claude.ai/install.sh | bash
>   ```

![linux-img-03.webp](/apps-assets/claude_code/linux-img-03.webp)

> **Проверка установки Claude Code**
>
> После установки введите следующую команду, чтобы проверить успешность установки:
>
>   ```bash
>   claude --version
>   ```
>
>   Если отображается номер версии, поздравляем! Claude Code успешно установлен.

#### 2. Настройте переменные среды

Чтобы позволить Claude Code подключаться к вашему relay-сервису, необходимо задать две переменные среды:

> **Быстрое изменение переменных среды**
>
> Введите команду:
>
>   ```bash
>   curl -fsSL https://raw.githubusercontent.com/Uter.ai/uter-docs/refs/heads/main/helper/claude-cli-setup.sh | bash
>   ```

![macos-configure](/apps-assets/claude_code/macos_configure.webp)

#### 3. Начните использовать Claude Code

Теперь вы можете начать использовать Claude Code!

> **Запуск Claude Code**
>
> Запустите Claude Code напрямую:
>
>   ```bash
>   claude
>   ```
>
>   Для использования в определённом проекте:
>
>   ```bash
>   # Перейдите в каталог вашего проекта
>   cd /path/to/your/project
>
>   # Запустите Claude Code
>   claude
>   ```

![linux-img-03.webp](/apps-assets/claude_code/linux-img-03.webp)

![linux-img-04.webp](/apps-assets/claude_code/linux-img-04.webp)

![linux-img-05.webp](/apps-assets/claude_code/linux-img-05.webp)

> **Выбор модели**
>
> Введите команду:
>
>   ```bash
>   /model
>   ```
>
>   Нажмите Enter для выбора официальной модели; обычно достаточно модели по умолчанию.

![linux-img-06.webp](/apps-assets/claude_code/linux-img-06.webp)

![linux-img-07.webp](/apps-assets/claude_code/linux-img-07.webp)

![linux-img-08.webp](/apps-assets/claude_code/linux-img-08.webp)

![linux-img-09.webp](/apps-assets/claude_code/linux-img-09.webp)

> Примечание: после изменения переменной среды `ANTHROPIC_BASE_URL` все модели (включая предустановленные официальные модели) будут вызывать пользовательскую точку доступа вместо использования квот официальной учётной записи.

#### 4. Распространённые проблемы Linux

> **Отсутствуют библиотеки зависимостей**
>
> Некоторым дистрибутивам Linux требуется установка дополнительных зависимостей:
>
>   ```bash
>   # Ubuntu/Debian
>   sudo apt install build-essential
>
>   # CentOS/RHEL
>   sudo dnf groupinstall "Development Tools"
>   ```

> **Переменные среды не вступают в силу**
>
> Проверьте следующие моменты:
>
>   - Убедитесь, что вы изменили правильный конфигурационный файл (`.bashrc` или `.zshrc`)
>   - Перезапустите терминал или выполните `source ~/.bashrc`
>   - Проверьте настройки: `echo $ANTHROPIC_BASE_URL`
