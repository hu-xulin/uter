import type { DocsLocale } from '../i18n';

/**
 * Content for the "Features Introduction" page.
 * Adapted from Uter's features-introduction page.
 */
export type FeaturesContent = {
  title: string;
  description: string;
  /**
   * Heading for the feature list itself. The page had no headings at all
   * before, which left the right-hand TOC empty — this gives it one.
   */
  featuresHeading: string;
  features: string[];
  featureDetails?: { text: string; subItems?: string[] }[];
};

const ZH_CONTENT: FeaturesContent = {
  title: '特性说明',
  description: 'Uter 的完整特性列表',
  featuresHeading: '全部特性',
  features: [
    '全新的 UI 界面',
    '多语言支持',
    '添加 Midjourney-Proxy(Plus) 接口支持（使用前需确认第三方项目和上游服务授权、内容安全和服务条款要求）',
    '支持合法授权部署中的内部余额、成本分摊或企业客户账务管理，可在系统设置中设置：易支付',
    '支持查询合法授权渠道的用量或余额信息：配合项目 uter-key-tool 可实现用 key 查询使用',
    '分页支持选择每页显示数量',
    '支持 SQLite 数据库存储，开箱即用，轻量便捷',
    '支持组织内部成本核算或企业客户账务计量，可在系统设置-运营设置中设置',
    '支持渠道加权随机',
    '数据看板（管理）',
    '可设置令牌能调用的模型',
    '支持 Telegram 授权登录',
    '添加 Suno API 接口支持（使用前需确认第三方项目和上游服务授权、内容安全和服务条款要求）',
    '支持 Rerank 模型，目前兼容 Cohere 和 Jina，可接入 Dify',
    'OpenAI Realtime API - 支持 OpenAI 的 Realtime API，支持 Azure 渠道',
    '支持使用路由 /chat2link 进入聊天界面',
    '支持通过模型名称后缀设置 reasoning effort',
    '思考转内容，支持在渠道-编辑-渠道额外设置中设置 thinking_to_content 选项',
    '模型限流，支持在系统设置-速率限制设置中设置模型限流',
    '缓存计费支持，开启后可以在缓存命中时按照设定的比例计费',
  ],
  featureDetails: [
    {
      text: '支持 Telegram 授权登录：',
      subItems: [
        '系统设置-配置登录注册-允许通过 Telegram 登录',
        '对 @Botfather 输入指令 /setdomain',
        '选择你的 bot，然后输入 http(s)://你的网站地址/login',
        'Telegram Bot 名称是 bot username 去掉 @后的字符串',
      ],
    },
    {
      text: '支持通过模型名称后缀设置 reasoning effort：',
      subItems: [
        'OpenAI o 系列模型：添加后缀 -high 设置为 high reasoning effort (例如: o3-mini-high)',
        '添加后缀 -medium 设置为 medium reasoning effort (例如: o3-mini-medium)',
        '添加后缀 -low 设置为 low reasoning effort (例如: o3-mini-low)',
        'Claude 思考模型：添加后缀 -thinking 启用思考模式 (例如: claude-3-7-sonnet-20250219-thinking)',
      ],
    },
    {
      text: '缓存计费支持，开启后可以在缓存命中时按照设定的比例计费：',
      subItems: [
        '在系统设置-运营设置中设置提示缓存倍率选项',
        '在渠道中设置提示缓存倍率，范围 0-1，例如设置为 0.5 表示缓存命中时按照 50% 计费',
        '支持的渠道：OpenAI、Azure、DeepSeek、Claude',
      ],
    },
  ],
};

const EN_CONTENT: FeaturesContent = {
  title: 'Features',
  description: 'Complete feature list of Uter',
  featuresHeading: 'All Features',
  features: [
    'Brand new UI interface (some interfaces still being updated)',
    'Multi-language support (to be improved)',
    'Added Midjourney-Proxy(Plus) interface support (verify third-party project and upstream service authorization, content safety, and terms of service before use)',
    'Support for internal balance, cost allocation, or enterprise billing in authorized deployments, configurable in system settings: EasyPay',
    'Support for querying usage or balance of authorized channels: use with uter-key-tool to query usage by key',
    'Pagination supports selecting items per page',
    'Support for SQLite database storage, out of the box, lightweight and convenient',
    'Support for organizational cost accounting or enterprise billing, configurable in System Settings - Operations Settings',
    'Support for channel weighted random',
    'Data dashboard (console)',
    'Configurable token-to-model access',
    'Support for Telegram authorized login',
    'Added Suno API interface support (verify third-party project and upstream service authorization, content safety, and terms of service before use)',
    'Support for Rerank models, currently compatible with Cohere and Jina, can be integrated with Dify',
    'OpenAI Realtime API - supports OpenAI\'s Realtime API, supports Azure channels',
    'Support for route /chat2link to enter the chat interface',
    'Support for setting reasoning effort via model name suffix',
    'Thinking-to-content, supports setting thinking_to_content option in channel edit - extra settings',
    'Model rate limiting, supports configuring in System Settings - Rate Limit Settings',
    'Cache billing support, can bill at a configured ratio on cache hits',
  ],
  featureDetails: [
    {
      text: 'Support for Telegram authorized login:',
      subItems: [
        'System Settings - Login/Register Config - Allow Telegram login',
        'Send command /setdomain to @Botfather',
        'Select your bot, then enter http(s)://your-site-address/login',
        'Telegram Bot name is the bot username without @',
      ],
    },
    {
      text: 'Support for setting reasoning effort via model name suffix:',
      subItems: [
        'OpenAI o-series models: add suffix -high for high reasoning effort (e.g., o3-mini-high)',
        'Add suffix -medium for medium reasoning effort (e.g., o3-mini-medium)',
        'Add suffix -low for low reasoning effort (e.g., o3-mini-low)',
        'Claude thinking models: add suffix -thinking to enable thinking mode (e.g., claude-3-7-sonnet-20250219-thinking)',
      ],
    },
    {
      text: 'Cache billing support, can bill at a configured ratio on cache hits:',
      subItems: [
        'Set prompt cache ratio option in System Settings - Operations Settings',
        'Set prompt cache ratio in channel, range 0-1, e.g., 0.5 means 50% billing on cache hit',
        'Supported channels: OpenAI, Azure, DeepSeek, Claude',
      ],
    },
  ],
};

const FR_CONTENT: FeaturesContent = {
  title: 'Fonctionnalités',
  description: 'Liste complète des fonctionnalités de Uter',
  featuresHeading: 'Toutes les fonctionnalités',
  features: [
    'Interface UI entièrement nouvelle (certaines interfaces sont encore en cours de mise à jour)',
    'Prise en charge multilingue (à améliorer)',
    'Ajout de la prise en charge de l\'interface Midjourney-Proxy(Plus) (vérifiez l\'autorisation du projet tiers et du service en amont, la sécurité du contenu et les conditions d\'utilisation avant utilisation)',
    'Prise en charge du solde interne, de la répartition des coûts ou de la facturation entreprise dans les déploiements autorisés, configurable dans les paramètres système : EasyPay',
    'Prise en charge de la consultation de l\'utilisation ou du solde des canaux autorisés : utilisez avec uter-key-tool pour consulter l\'utilisation par clé',
    'La pagination prend en charge la sélection du nombre d\'éléments par page',
    'Prise en charge du stockage de base de données SQLite, prêt à l\'emploi, léger et pratique',
    'Prise en charge de la comptabilité analytique organisationnelle ou de la facturation entreprise, configurable dans Paramètres système - Paramètres d\'exploitation',
    'Prise en charge du choix aléatoire pondéré des canaux',
    'Tableau de bord de données (console)',
    'Accès token-vers-modèle configurable',
    'Prise en charge de la connexion autorisée Telegram',
    'Ajout de la prise en charge de l\'interface Suno API (vérifiez l\'autorisation du projet tiers et du service en amont, la sécurité du contenu et les conditions d\'utilisation avant utilisation)',
    'Prise en charge des modèles Rerank, actuellement compatibles avec Cohere et Jina, peut être intégré à Dify',
    'OpenAI Realtime API - prend en charge l\'API Realtime d\'OpenAI, prend en charge les canaux Azure',
    'Prise en charge de la route /chat2link pour accéder à l\'interface de chat',
    'Prise en charge du réglage de l\'effort de raisonnement via le suffixe du nom de modèle',
    'Thinking-to-content, prend en charge le réglage de l\'option thinking_to_content dans l\'édition de canal - paramètres supplémentaires',
    'Limitation de débit par modèle, prend en charge la configuration dans Paramètres système - Paramètres de limite de débit',
    'Prise en charge de la facturation par cache, facturable selon un ratio configuré lors des accès au cache',
  ],
  featureDetails: [
    {
      text: 'Prise en charge de la connexion autorisée Telegram :',
      subItems: [
        'Paramètres système - Configuration de connexion/inscription - Autoriser la connexion Telegram',
        'Envoyez la commande /setdomain à @Botfather',
        'Sélectionnez votre bot, puis saisissez http(s)://votre-site-address/login',
        'Le nom du Telegram Bot est le nom d\'utilisateur du bot sans @',
      ],
    },
    {
      text: 'Prise en charge du réglage de l\'effort de raisonnement via le suffixe du nom de modèle :',
      subItems: [
        'Modèles OpenAI de la série o : ajoutez le suffixe -high pour un effort de raisonnement élevé (ex. : o3-mini-high)',
        'Ajoutez le suffixe -medium pour un effort de raisonnement moyen (ex. : o3-mini-medium)',
        'Ajoutez le suffixe -low pour un effort de raisonnement faible (ex. : o3-mini-low)',
        'Modèles de réflexion Claude : ajoutez le suffixe -thinking pour activer le mode de réflexion (ex. : claude-3-7-sonnet-20250219-thinking)',
      ],
    },
    {
      text: 'Prise en charge de la facturation par cache, facturable selon un ratio configuré lors des accès au cache :',
      subItems: [
        'Définissez l\'option de ratio du cache de prompt dans Paramètres système - Paramètres d\'exploitation',
        'Définissez le ratio du cache de prompt dans le canal, plage 0-1, ex. : 0.5 signifie 50% de facturation lors d\'un accès au cache',
        'Canaux pris en charge : OpenAI, Azure, DeepSeek, Claude',
      ],
    },
  ],
};

const JA_CONTENT: FeaturesContent = {
  title: '機能紹介',
  description: 'Uter の完全な機能一覧',
  featuresHeading: 'すべての機能',
  features: [
    '新しい UI インターフェース（一部の画面は引き続き更新中）',
    '多言語対応（改善予定）',
    'Midjourney-Proxy(Plus) インターフェースのサポートを追加（使用前にサードパーティプロジェクトおよび上流サービスの認可、コンテンツセーフティ、利用規約を確認してください）',
    '認可されたデプロイメントにおける内部残高、コスト按分、または企業課金のサポート。システム設定で設定可能：EasyPay',
    '認可されたチャンネルの利用量または残高の照会をサポート：uter-key-tool と組み合わせてキー別の利用状況を照会可能',
    'ページネーションは1ページあたりの表示件数の選択をサポート',
    'SQLite データベースストレージのサポート、すぐに使えて軽量で便利',
    '組織内のコスト会計または企業課金のサポート。システム設定 - 運用設定で設定可能',
    'チャンネルの重み付きランダムのサポート',
    'データダッシュボード（コンソール）',
    'トークンからモデルへのアクセスを設定可能',
    'Telegram 認可ログインのサポート',
    'Suno API インターフェースのサポートを追加（使用前にサードパーティプロジェクトおよび上流サービスの認可、コンテンツセーフティ、利用規約を確認してください）',
    'Rerank モデルのサポート、現在 Cohere および Jina と互換、Dify と統合可能',
    'OpenAI Realtime API - OpenAI の Realtime API をサポート、Azure チャンネルをサポート',
    'チャット画面に入るためのルート /chat2link のサポート',
    'モデル名のサフィックスによる reasoning effort の設定サポート',
    '思考をコンテンツに変換（Thinking-to-content）、チャンネル編集 - 追加設定で thinking_to_content オプションの設定をサポート',
    'モデルのレート制限、システム設定 - レート制限設定での設定をサポート',
    'キャッシュ課金のサポート、キャッシュヒット時に設定した比率で課金可能',
  ],
  featureDetails: [
    {
      text: 'Telegram 認可ログインのサポート：',
      subItems: [
        'システム設定 - ログイン/登録設定 - Telegram ログインを許可',
        '@Botfather にコマンド /setdomain を送信',
        'ボットを選択し、http(s)://あなたのサイトアドレス/login を入力',
        'Telegram Bot 名は @ を除いた bot username です',
      ],
    },
    {
      text: 'モデル名のサフィックスによる reasoning effort の設定サポート：',
      subItems: [
        'OpenAI o シリーズモデル：サフィックス -high を追加して高い reasoning effort に設定（例：o3-mini-high）',
        'サフィックス -medium を追加して中程度の reasoning effort に設定（例：o3-mini-medium）',
        'サフィックス -low を追加して低い reasoning effort に設定（例：o3-mini-low）',
        'Claude 思考モデル：サフィックス -thinking を追加して思考モードを有効化（例：claude-3-7-sonnet-20250219-thinking）',
      ],
    },
    {
      text: 'キャッシュ課金のサポート、キャッシュヒット時に設定した比率で課金可能：',
      subItems: [
        'システム設定 - 運用設定でプロンプトキャッシュ比率オプションを設定',
        'チャンネルでプロンプトキャッシュ比率を設定、範囲 0-1、例：0.5 はキャッシュヒット時に 50% で課金することを意味する',
        '対応チャンネル：OpenAI、Azure、DeepSeek、Claude',
      ],
    },
  ],
};

const RU_CONTENT: FeaturesContent = {
  title: 'Возможности',
  description: 'Полный список возможностей Uter',
  featuresHeading: 'Все возможности',
  features: [
    'Абсолютно новый UI интерфейс (некоторые интерфейсы всё ещё обновляются)',
    'Поддержка нескольких языков (будет улучшена)',
    'Добавлена поддержка интерфейса Midjourney-Proxy(Plus) (перед использованием убедитесь в авторизации стороннего проекта и вышестоящего сервиса, безопасности контента и условиях использования)',
    'Поддержка внутреннего баланса, распределения затрат или корпоративной тарификации в авторизованных развёртываниях, настраивается в системных настройках: EasyPay',
    'Поддержка запроса использования или баланса авторизованных каналов: используйте вместе с uter-key-tool для запроса использования по ключу',
    'Пагинация поддерживает выбор количества элементов на странице',
    'Поддержка хранения в базе данных SQLite, готово к использованию, лёгкое и удобное',
    'Поддержка организационного учёта затрат или корпоративной тарификации, настраивается в Системных настройках - Настройках операций',
    'Поддержка взвешенного случайного выбора канала',
    'Панель данных (консоль)',
    'Настраиваемый доступ токен-к-модели',
    'Поддержка авторизованного входа Telegram',
    'Добавлена поддержка интерфейса Suno API (перед использованием убедитесь в авторизации стороннего проекта и вышестоящего сервиса, безопасности контента и условиях использования)',
    'Поддержка моделей Rerank, в настоящее время совместимы с Cohere и Jina, может быть интегрирована с Dify',
    'OpenAI Realtime API - поддерживает Realtime API от OpenAI, поддерживает каналы Azure',
    'Поддержка маршрута /chat2link для входа в чат-интерфейс',
    'Поддержка настройки reasoning effort через суффикс имени модели',
    'Thinking-to-content, поддерживает настройку опции thinking_to_content в редактировании канала - дополнительных настройках',
    'Ограничение скорости модели, поддерживает настройку в Системных настройках - Настройках ограничения скорости',
    'Поддержка кэш-тарификации, тарификация по настроенному коэффициенту при попадании в кэш',
  ],
  featureDetails: [
    {
      text: 'Поддержка авторизованного входа Telegram:',
      subItems: [
        'Системные настройки - Настройки входа/регистрации - Разрешить вход через Telegram',
        'Отправьте команду /setdomain боту @Botfather',
        'Выберите своего бота, затем введите http(s)://адрес-вашего-сайта/login',
        'Имя Telegram Bot — это bot username без @',
      ],
    },
    {
      text: 'Поддержка настройки reasoning effort через суффикс имени модели:',
      subItems: [
        'Модели OpenAI серии o: добавьте суффикс -high для высокого reasoning effort (напр., o3-mini-high)',
        'Добавьте суффикс -medium для среднего reasoning effort (напр., o3-mini-medium)',
        'Добавьте суффикс -low для низкого reasoning effort (напр., o3-mini-low)',
        'Модели мышления Claude: добавьте суффикс -thinking для включения режима мышления (напр., claude-3-7-sonnet-20250219-thinking)',
      ],
    },
    {
      text: 'Поддержка кэш-тарификации, тарификация по настроенному коэффициенту при попадании в кэш:',
      subItems: [
        'Установите опцию коэффициента кэша промпта в Системных настройках - Настройках операций',
        'Установите коэффициент кэша промпта в канале, диапазон 0-1, напр., 0.5 означает 50% тарификации при попадании в кэш',
        'Поддерживаемые каналы: OpenAI, Azure, DeepSeek, Claude',
      ],
    },
  ],
};

const VI_CONTENT: FeaturesContent = {
  title: 'Tính năng',
  description: 'Danh sách đầy đủ các tính năng của Uter',
  featuresHeading: 'Tất cả tính năng',
  features: [
    'Giao diện UI hoàn toàn mới (một số giao diện vẫn đang được cập nhật)',
    'Hỗ trợ đa ngôn ngữ (sẽ được cải thiện)',
    'Đã thêm hỗ trợ giao diện Midjourney-Proxy(Plus) (xác minh dự án bên thứ ba và ủy quyền dịch vụ thượng nguồn, an toàn nội dung và điều khoản dịch vụ trước khi sử dụng)',
    'Hỗ trợ số dư nội bộ, phân bổ chi phí hoặc thanh toán doanh nghiệp trong các triển khai được ủy quyền, có thể cấu hình trong cài đặt hệ thống: EasyPay',
    'Hỗ trợ truy vấn mức sử dụng hoặc số dư của các kênh được ủy quyền: sử dụng cùng uter-key-tool để truy vấn mức sử dụng theo khóa',
    'Phân trang hỗ trợ chọn số lượng mục trên mỗi trang',
    'Hỗ trợ lưu trữ cơ sở dữ liệu SQLite, cài đặt sẵn sàng sử dụng, nhẹ và tiện lợi',
    'Hỗ trợ kế toán chi phí tổ chức hoặc thanh toán doanh nghiệp, có thể cấu hình trong Cài đặt hệ thống - Cài đặt vận hành',
    'Hỗ trợ chọn ngẫu nhiên có trọng số kênh',
    'Bảng điều khiển dữ liệu (bảng điều khiển)',
    'Truy cập token-to-model có thể cấu hình',
    'Hỗ trợ đăng nhập được ủy quyền Telegram',
    'Đã thêm hỗ trợ giao diện Suno API (xác minh dự án bên thứ ba và ủy quyền dịch vụ thượng nguồn, an toàn nội dung và điều khoản dịch vụ trước khi sử dụng)',
    'Hỗ trợ mô hình Rerank, hiện tương thích với Cohere và Jina, có thể tích hợp với Dify',
    'OpenAI Realtime API - hỗ trợ Realtime API của OpenAI, hỗ trợ các kênh Azure',
    'Hỗ trợ tuyến đường /chat2link để vào giao diện trò chuyện',
    'Hỗ trợ thiết lập reasoning effort qua hậu tố tên mô hình',
    'Thinking-to-content, hỗ trợ thiết lập tùy chọn thinking_to_content trong chỉnh sửa kênh - cài đặt bổ sung',
    'Giới hạn tốc độ mô hình, hỗ trợ cấu hình trong Cài đặt hệ thống - Cài đặt giới hạn tốc độ',
    'Hỗ trợ thanh toán bộ nhớ đệm, có thể tính phí theo tỷ lệ đã cấu hình khi truy cập vào bộ nhớ đệm',
  ],
  featureDetails: [
    {
      text: 'Hỗ trợ đăng nhập được ủy quyền Telegram:',
      subItems: [
        'Cài đặt hệ thống - Cấu hình Đăng nhập/Đăng ký - Cho phép đăng nhập Telegram',
        'Gửi lệnh /setdomain cho @Botfather',
        'Chọn bot của bạn, sau đó nhập http(s)://địa-chỉ-trang-web-của-bạn/login',
        'Tên Telegram Bot là bot username không có @',
      ],
    },
    {
      text: 'Hỗ trợ thiết lập reasoning effort qua hậu tố tên mô hình:',
      subItems: [
        'Mô hình dòng OpenAI o: thêm hậu tố -high để đặt reasoning effort cao (vd.: o3-mini-high)',
        'Thêm hậu tố -medium để đặt reasoning effort trung bình (vd.: o3-mini-medium)',
        'Thêm hậu tố -low để đặt reasoning effort thấp (vd.: o3-mini-low)',
        'Mô hình suy luận Claude: thêm hậu tố -thinking để bật chế độ suy luận (vd.: claude-3-7-sonnet-20250219-thinking)',
      ],
    },
    {
      text: 'Hỗ trợ thanh toán bộ nhớ đệm, có thể tính phí theo tỷ lệ đã cấu hình khi truy cập vào bộ nhớ đệm:',
      subItems: [
        'Đặt tùy chọn tỷ lệ bộ nhớ đệm prompt trong Cài đặt hệ thống - Cài đặt vận hành',
        'Đặt tỷ lệ bộ nhớ đệm prompt trong kênh, phạm vi 0-1, vd.: 0.5 nghĩa là tính 50% khi truy cập vào bộ nhớ đệm',
        'Các kênh được hỗ trợ: OpenAI, Azure, DeepSeek, Claude',
      ],
    },
  ],
};

export function getFeaturesContent(locale: DocsLocale): FeaturesContent {
  switch (locale) {
    case 'zh': return ZH_CONTENT;
    case 'zh-TW': return ZH_CONTENT;
    case 'fr': return FR_CONTENT;
    case 'ja': return JA_CONTENT;
    case 'ru': return RU_CONTENT;
    case 'vi': return VI_CONTENT;
    default: return EN_CONTENT;
  }
}
