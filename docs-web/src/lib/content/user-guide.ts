import type { DocsLocale } from '../i18n';

/**
 * Content for the "User Guide" page.
 */
export type UserGuideContent = {
  title: string;
  description: string;
  sections: {
    heading: string;
    paragraphs: string[];
    list?: string[];
    subSections?: {
      heading: string;
      paragraphs: string[];
      list?: string[];
    }[];
  }[];
};

const ZH_CONTENT: UserGuideContent = {
  title: '用户指南',
  description: 'Uter 使用指南：从注册登录到模型调用、聊天应用集成与日志审计',
  sections: [
    {
      heading: '注册与登录',
      paragraphs: [
        '在开始使用 Uter 之前，您需要先注册一个账号。',
        '管理员可以在系统设置中配置是否允许新用户注册，以及允许哪些第三方登录方式。',
      ],
      subSections: [
        {
          heading: '注册流程',
          paragraphs: [
            '访问 Uter 首页，点击右上角的「注册」按钮，进入注册页面。',
            '填写用户名、邮箱、密码等必要信息后提交即可完成注册。',
            '如果系统启用了邮箱验证，注册完成后还需要登录邮箱完成验证。',
          ],
        },
        {
          heading: '登录方式',
          paragraphs: [
            'Uter 支持以下登录方式：',
          ],
          list: [
            '账号密码登录',
            '邮箱验证链接登录（如已启用）',
            'GitHub OAuth 登录（如已启用）',
            'Google OAuth 登录（如已启用）',
            'OIDC 通用登录（如已启用）',
            'Telegram 登录（如已启用）',
          ],
        },
        {
          heading: '找回密码',
          paragraphs: [
            '如果忘记密码，可以点击登录页面的「忘记密码」链接。',
            '系统会向注册邮箱发送一封密码重置邮件，按照邮件中的指引完成密码重置即可。',
          ],
        },
      ],
    },
    {
      heading: '概览与数据看板',
      paragraphs: [
        '登录后，Uter 会自动跳转到管理首页，展示当前账号的概览信息。',
        '管理员可以在管理中查看系统整体运行情况，普通用户可以查看自己账号的使用统计。',
      ],
      subSections: [
        {
          heading: '数据看板',
          paragraphs: [
            '数据看板展示当前账号的关键运行指标：',
          ],
          list: [
            '请求总量统计（按日/周/月）',
            'Token 用量统计',
            '费用消耗统计',
            '渠道健康状态',
            '错误率监控',
            '近期调用明细',
          ],
        },
        {
          heading: '公告与通知',
          paragraphs: [
            '系统公告会展示在数据看板顶部。',
            '管理员发布的维护通知、版本更新、计费调整等信息都会通过公告传达。',
          ],
        },
      ],
    },
    {
      heading: '个人资料与安全',
      paragraphs: [
        '在「个人中心」中，您可以查看和修改自己的账号资料、修改密码、配置两步验证等。',
        '建议定期更换密码，并启用两步验证以提升账号安全。',
      ],
      subSections: [
        {
          heading: '资料管理',
          paragraphs: [
            '在个人中心可以修改：',
          ],
          list: [
            '用户名（部分系统设置后允许）',
            '显示名称',
            '头像',
            '邮箱地址',
            '密码',
          ],
        },
        {
          heading: '两步验证（2FA）',
          paragraphs: [
            '启用两步验证后，登录时除密码外还需要输入一次性验证码，大幅提升账号安全。',
            '推荐使用 Google Authenticator、Microsoft Authenticator 等兼容 TOTP 的应用。',
          ],
        },
        {
          heading: '登录设备',
          paragraphs: [
            '个人中心会列出最近的登录设备与登录时间、IP 地址。',
            '如果发现陌生登录记录，请立即修改密码并启用两步验证。',
          ],
        },
      ],
    },
    {
      heading: 'API 密钥',
      paragraphs: [
        '令牌（Token）是调用 Uter AI 接口的凭证，每个令牌独立计费、独立限流。',
        '您可以为不同的应用、不同的团队创建不同的令牌，便于权限隔离和用量追踪。',
      ],
      subSections: [
        {
          heading: '创建令牌',
          paragraphs: [
            '在「令牌管理」页面点击「新建令牌」，填写名称、额度、过期时间等参数。',
            '创建成功后系统会一次性返回完整的令牌字符串，请妥善保存，关闭页面后将无法再次查看。',
          ],
        },
        {
          heading: '令牌权限',
          paragraphs: [
            '可以为令牌配置以下权限：',
          ],
          list: [
            '可调用的模型范围',
            '令牌额度限制（按美元、人民币或自定义单位）',
            '令牌过期时间',
            '允许调用的 IP 白名单',
            '分组权限（仅允许访问指定渠道分组）',
          ],
        },
        {
          heading: '令牌使用统计',
          paragraphs: [
            '每个令牌都有独立的使用统计，包括请求次数、Token 用量、消耗金额、错误率等。',
            '管理员可以查看所有令牌的统计，普通用户只能查看自己创建的令牌。',
          ],
        },
        {
          heading: '重置与吊销',
          paragraphs: [
            '如果令牌泄露，可以立即在令牌管理页吊销该令牌，吊销后所有使用该令牌的请求都会失败。',
            '也可以选择重置令牌（生成新字符串），原有的令牌立即失效。',
          ],
        },
      ],
    },
    {
      heading: '使用 API 与游乐场',
      paragraphs: [
        'Uter 提供与 OpenAI 完全兼容的 API 接口，可以使用任何支持 OpenAI 协议的客户端连接。',
        '同时内置「游乐场」（Playground）功能，可以在 Web 上直接测试模型。',
      ],
      subSections: [
        {
          heading: 'API 基础调用',
          paragraphs: [
            '将客户端的 base_url 设置为 Uter 的 API 地址，请求头带上 Authorization: Bearer YOUR_TOKEN 即可。',
            '示例（cURL）：',
          ],
          list: [
            'POST /v1/chat/completions',
            'POST /v1/completions',
            'POST /v1/embeddings',
            'POST /v1/images/generations',
            'GET  /v1/models',
          ],
        },
        {
          heading: '流式响应',
          paragraphs: [
            '在请求体中设置 "stream": true 即可开启流式响应（SSE），客户端会逐 token 收到模型输出。',
            '流式响应可显著降低首字延迟，提升聊天应用的交互体验。',
          ],
        },
        {
          heading: '游乐场（Playground）',
          paragraphs: [
            '在「游乐场」页面可以直接选择模型、输入 system / user prompt，调整 temperature、top_p 等参数。',
            '支持对话模式（多轮）和补全模式（单轮），便于调试和效果对比。',
          ],
        },
        {
          heading: '自定义请求头',
          paragraphs: [
            '部分上游渠道支持自定义请求头（如用户标识、组织标识）。',
            'Uter 允许在创建令牌时设置附加请求头，会在转发请求时自动带上。',
          ],
        },
      ],
    },
    {
      heading: '聊天应用集成',
      paragraphs: [
        'Uter 兼容 OpenAI 接口协议，可以无缝接入 Cherry Studio、ChatBox、Claude Code 等 14+ 客户端。',
        '只需在客户端中将 base_url 配置为 Uter 的 API 入口、API key 配置为您的令牌即可。',
      ],
      subSections: [
        {
          heading: 'Cherry Studio 集成',
          paragraphs: [
            '在 Cherry Studio 的设置中，添加自定义服务商：',
          ],
          list: [
            '服务商名称：Uter',
            'API 地址：Uter 的 API base_url',
            'API 密钥：您在 Uter 创建的令牌',
            '模型列表：在 Cherry Studio 中选择需要的模型',
          ],
        },
        {
          heading: 'Claude Code 集成',
          paragraphs: [
            'Claude Code 支持自定义 OpenAI 兼容的 endpoint，配置步骤：',
          ],
          list: [
            '设置环境变量 ANTHROPIC_BASE_URL 为 Uter API 地址',
            '设置环境变量 ANTHROPIC_AUTH_TOKEN 为您的令牌',
            '在 Claude Code 配置中选择 Uter 支持的模型',
          ],
        },
        {
          heading: 'Cline / Continue / Roo Code 等 IDE 插件',
          paragraphs: [
            '这些 VS Code AI 插件都支持自定义 OpenAI 兼容服务。',
            '在插件设置中填入 Uter 的 API 地址和令牌即可使用，模型按 Uter 中已配置的可用模型列出。',
          ],
        },
        {
          heading: '其他常见客户端',
          paragraphs: [
            'Uter 同时兼容：',
          ],
          list: [
            'ChatBox',
            'NextChat',
            'Lobe Chat',
            'Open WebUI',
            '沉浸式翻译',
            '更多客户端……',
          ],
        },
      ],
    },
    {
      heading: '日志与异步任务',
      paragraphs: [
        'Uter 记录所有 API 请求的详细日志，便于排查问题、审计调用、计费核对。',
        '管理员还可以查看所有管理操作的审计日志。',
      ],
      subSections: [
        {
          heading: '请求日志',
          paragraphs: [
            '请求日志记录每次 API 调用的完整信息：',
          ],
          list: [
            '请求时间、响应时间、耗时',
            '请求的模型名称',
            '输入 / 输出 Token 数量',
            '使用的渠道和分组',
            '客户端 IP、User-Agent',
            '响应状态、错误码、错误信息',
            '消耗金额（按计费倍率计算）',
          ],
        },
        {
          heading: '审计日志',
          paragraphs: [
            '管理员的敏感操作会记录在审计日志中：',
          ],
          list: [
            '用户登录、登出',
            '渠道的增删改',
            '令牌操作',
            '模型配置变更',
            '系统设置变更',
            '充值、退款操作',
          ],
        },
        {
          heading: '异步任务',
          paragraphs: [
            '部分操作（如批量导入、批量导出、数据看板预聚合）是异步执行的，会在后台队列中排队处理。',
            '异步任务中心可以查看任务进度、状态、错误信息。',
          ],
        },
        {
          heading: '日志保留与导出',
          paragraphs: [
            '管理员可以配置日志的保留天数，过期的日志会被后台任务自动清理。',
            '所有日志支持 CSV 格式导出，便于二次分析或合规审计。',
          ],
        },
      ],
    },
    {
      heading: '钱包与订阅',
      paragraphs: [
        'Uter 支持预付费（充值）与订阅两种计费模式。',
        '普通用户可以通过钱包余额调用 API；订阅用户可以使用包月 / 包年套餐，享受折扣定价。',
      ],
      subSections: [
        {
          heading: '钱包充值',
          paragraphs: [
            '在「钱包」页面选择充值金额与支付方式即可完成充值。',
            '支持多种支付方式（以管理员配置的为准）：',
          ],
          list: [
            '易支付（微信、支付宝）',
            'Stripe（信用卡）',
            'PayPal',
            'GitHub Sponsor',
            '管理员手动加款',
          ],
        },
        {
          heading: '余额消费',
          paragraphs: [
            '调用 API 时会根据实际消耗自动从余额中扣除。',
            '每个令牌都可以设置独立的余额上限，防止异常调用导致过度扣费。',
          ],
        },
        {
          heading: '订阅套餐',
          paragraphs: [
            '订阅用户每月享有固定的调用额度或套餐折扣。',
            '套餐到期后可以自动续费或手动续费，过期未续费会切换到普通按量计费模式。',
          ],
        },
        {
          heading: '充值与账单',
          paragraphs: [
            '「账单」页面记录所有充值、消费、退款明细。',
            '管理员可以为指定用户充值、赠送额度、调整余额。',
          ],
        },
      ],
    },
    {
      heading: '定价和排行',
      paragraphs: [
        '定价展示 Uter 中所有可用的模型，包含模型简介、定价、上下文长度、可用渠道数等信息。',
        '排行展示按调用次数、消耗金额、错误率等维度排序的热门模型与活跃用户。',
      ],
      subSections: [
        {
          heading: '定价',
          paragraphs: [
            '在定价可以：',
          ],
          list: [
            '按关键词搜索模型',
            '按定价、上下文长度、可用性筛选',
            '查看模型详情（支持的渠道、当前状态、定价历史）',
            '一键复制模型名称到剪贴板',
            '跳转到游乐场测试模型效果',
          ],
        },
        {
          heading: '模型排行',
          paragraphs: [
            '排行按不同维度展示当前最活跃的模型：',
          ],
          list: [
            '今日调用次数排行',
            '本周 Token 消耗排行',
            '本月消耗金额排行',
            '错误率最低模型排行',
          ],
        },
        {
          heading: '用户排行',
          paragraphs: [
            '对于活跃社区版本，还会展示用户活跃度排行，鼓励大家多尝试不同的模型与场景。',
          ],
        },
        {
          heading: '订阅与收藏',
          paragraphs: [
            '可以收藏常用的模型，方便下次快速访问。',
            '管理员可以为指定模型设置「推荐」标记，在定价优先展示。',
          ],
        },
      ],
    },
  ],
};

const EN_CONTENT: UserGuideContent = {
  title: 'User Guide',
  description: 'Uter user guide: from registration and login to model invocation, app integration, and log auditing',
  sections: [
    {
      heading: 'Registration & Login',
      paragraphs: [
        'Before you can use Uter, you need to register an account.',
        'Administrators can configure whether new users are allowed to register, and which third-party login methods are enabled.',
      ],
      subSections: [
        {
          heading: 'Registration',
          paragraphs: [
            'Visit the Uter home page and click the "Sign up" button in the top right corner.',
            'Fill in the required information such as username, email, and password to complete the registration.',
            'If email verification is enabled, you also need to verify your email address.',
          ],
        },
        {
          heading: 'Login Methods',
          paragraphs: [
            'Uter supports the following login methods:',
          ],
          list: [
            'Username and password',
            'Email verification link (if enabled)',
            'GitHub OAuth (if enabled)',
            'Google OAuth (if enabled)',
            'Generic OIDC (if enabled)',
            'Telegram (if enabled)',
          ],
        },
        {
          heading: 'Password Recovery',
          paragraphs: [
            'If you forget your password, click the "Forgot password" link on the login page.',
            'The system will send a password reset email to your registered email address.',
          ],
        },
      ],
    },
    {
      heading: 'Overview & Dashboard',
      paragraphs: [
        'After signing in, you are redirected to the console home page which shows your account overview.',
        'Administrators can see the system-wide status, while regular users see their own usage statistics.',
      ],
      subSections: [
        {
          heading: 'Dashboard',
          paragraphs: [
            'The dashboard shows the key metrics for the current account:',
          ],
          list: [
            'Total request counts (daily/weekly/monthly)',
            'Token usage statistics',
            'Cost statistics',
            'Channel health status',
            'Error rate monitoring',
            'Recent call details',
          ],
        },
        {
          heading: 'Announcements',
          paragraphs: [
            'System announcements are displayed at the top of the dashboard.',
            'Maintenance notices, version updates and billing changes are all published through announcements.',
          ],
        },
      ],
    },
    {
      heading: 'Profile & Security',
      paragraphs: [
        'In "Profile" you can view and update your account information, change password, and configure two-factor authentication.',
        'We recommend changing passwords regularly and enabling 2FA to keep your account secure.',
      ],
      subSections: [
        {
          heading: 'Profile Management',
          paragraphs: [
            'You can update:',
          ],
          list: [
            'Username (if allowed by system settings)',
            'Display name',
            'Avatar',
            'Email address',
            'Password',
          ],
        },
        {
          heading: 'Two-Factor Authentication (2FA)',
          paragraphs: [
            'When 2FA is enabled, signing in is required to enter a one-time code in addition to the password.',
            'We recommend TOTP-compatible apps such as Google Authenticator or Microsoft Authenticator.',
          ],
        },
        {
          heading: 'Login Devices',
          paragraphs: [
            'The profile center lists the recent login devices, login times and IP addresses.',
            'If you spot an unfamiliar login, change your password immediately and enable 2FA.',
          ],
        },
      ],
    },
    {
      heading: 'API Keys',
      paragraphs: [
        'Tokens are the credentials used to call Uter APIs. Each token is billed and rate-limited independently.',
        'You can create separate tokens for different applications or teams to isolate permissions and track usage.',
      ],
      subSections: [
        {
          heading: 'Creating Tokens',
          paragraphs: [
            'Click "New Token" on the Token Management page, then fill in the parameters such as name, quota and expiration.',
            'The full token string is returned exactly once after creation — save it securely, you will not be able to view it again.',
          ],
        },
        {
          heading: 'Token Permissions',
          paragraphs: [
            'You can configure:',
          ],
          list: [
            'Allowed model scope',
            'Quota limits (USD, CNY or custom currency)',
            'Expiration time',
            'IP whitelist',
            'Group permissions (allowed channel groups only)',
          ],
        },
        {
          heading: 'Token Usage Statistics',
          paragraphs: [
            'Each token has independent usage statistics: request counts, token usage, cost and error rate.',
            'Administrators can view all tokens; regular users can only see their own.',
          ],
        },
        {
          heading: 'Reset & Revoke',
          paragraphs: [
            'If a token is leaked, revoke it immediately on the Token Management page.',
            'You can also reset the token (a new string is generated) and the old token becomes invalid instantly.',
          ],
        },
      ],
    },
    {
      heading: 'Using the API & Playground',
      paragraphs: [
        'Uter exposes APIs fully compatible with OpenAI, so any OpenAI-compatible client can connect.',
        'A built-in Playground lets you test models directly on the web.',
      ],
      subSections: [
        {
          heading: 'Basic API Calls',
          paragraphs: [
            'Point the client base_url at Uter and add Authorization: Bearer YOUR_TOKEN to the headers.',
            'Available endpoints:',
          ],
          list: [
            'POST /v1/chat/completions',
            'POST /v1/completions',
            'POST /v1/embeddings',
            'POST /v1/images/generations',
            'GET  /v1/models',
          ],
        },
        {
          heading: 'Streaming Responses',
          paragraphs: [
            'Set "stream": true in the request body to enable streaming (SSE) responses.',
            'Streaming significantly reduces the time-to-first-token for chat applications.',
          ],
        },
        {
          heading: 'Playground',
          paragraphs: [
            'On the Playground page you can pick a model, write system / user prompts and tune temperature, top_p, etc.',
            'Both chat (multi-turn) and completion (single-turn) modes are supported.',
          ],
        },
        {
          heading: 'Custom Headers',
          paragraphs: [
            'Some upstream channels accept custom request headers.',
            'Uter lets you set extra headers on the token — they are attached automatically when forwarding.',
          ],
        },
      ],
    },
    {
      heading: 'App Integration',
      paragraphs: [
        'Uter is OpenAI-compatible, so it integrates seamlessly with Cherry Studio, ChatBox, Claude Code and 14+ other clients.',
        'Just set the base_url to Uter and the API key to your token in the client.',
      ],
      subSections: [
        {
          heading: 'Cherry Studio',
          paragraphs: [
            'Add a custom provider in Cherry Studio settings:',
          ],
          list: [
            'Provider name: Uter',
            'API base URL: Uter API base_url',
            'API key: the token you created in Uter',
            'Model list: pick the models you need',
          ],
        },
        {
          heading: 'Claude Code',
          paragraphs: [
            'Claude Code supports custom OpenAI-compatible endpoints:',
          ],
          list: [
            'Set ANTHROPIC_BASE_URL to Uter API base URL',
            'Set ANTHROPIC_AUTH_TOKEN to your token',
            'Pick an Uter-supported model in Claude Code',
          ],
        },
        {
          heading: 'IDE Plugins (Cline / Continue / Roo Code)',
          paragraphs: [
            'These VS Code AI plugins support custom OpenAI-compatible services.',
            'Just configure Uter base URL and token in the plugin settings.',
          ],
        },
        {
          heading: 'Other Popular Clients',
          paragraphs: [
            'Uter is also compatible with:',
          ],
          list: [
            'ChatBox',
            'NextChat',
            'Lobe Chat',
            'Open WebUI',
            'Immersive Translate',
            'and more …',
          ],
        },
      ],
    },
    {
      heading: 'Logs & Async Tasks',
      paragraphs: [
        'Uter records every request in detail, so you can debug, audit and reconcile billing easily.',
        'Administrators can also see all admin operations in the audit log.',
      ],
      subSections: [
        {
          heading: 'Request Logs',
          paragraphs: [
            'Each request log records:',
          ],
          list: [
            'Request time, response time, latency',
            'Model name',
            'Input / output token counts',
            'Channel and group used',
            'Client IP and User-Agent',
            'Response status, error code, error info',
            'Cost (calculated by billing multipliers)',
          ],
        },
        {
          heading: 'Audit Logs',
          paragraphs: [
            'Sensitive admin actions are recorded:',
          ],
          list: [
            'User login / logout',
            'Channel create / update / delete',
            'Token operations',
            'Model configuration changes',
            'System settings changes',
            'Top-ups and refunds',
          ],
        },
        {
          heading: 'Async Tasks',
          paragraphs: [
            'Some operations (bulk imports, exports, dashboard pre-aggregation) run asynchronously.',
            'The Async Tasks center shows the progress, status and errors of each task.',
          ],
        },
        {
          heading: 'Retention & Export',
          paragraphs: [
            'Administrators can configure log retention days; expired logs are cleaned up by background tasks.',
            'All logs can be exported as CSV for offline analysis or compliance audits.',
          ],
        },
      ],
    },
    {
      heading: 'Wallet & Subscription',
      paragraphs: [
        'Uter supports prepaid wallet top-ups and recurring subscriptions.',
        'Regular users pay per request from their wallet balance; subscription users enjoy monthly quotas or discounts.',
      ],
      subSections: [
        {
          heading: 'Top-ups',
          paragraphs: [
            'Pick an amount and payment method on the Wallet page to top up.',
            'Supported payment methods (depends on admin config):',
          ],
          list: [
            'YiPay (WeChat / Alipay)',
            'Stripe (credit card)',
            'PayPal',
            'GitHub Sponsor',
            'Manual top-up by admin',
          ],
        },
        {
          heading: 'Balance Spending',
          paragraphs: [
            'API calls automatically deduct from your balance based on actual usage.',
            'You can set per-token balance caps to prevent runaway consumption.',
          ],
        },
        {
          heading: 'Subscriptions',
          paragraphs: [
            'Subscribers get a fixed monthly quota or discount.',
            'Subscriptions can auto-renew or be renewed manually; after expiry the account falls back to per-request billing.',
          ],
        },
        {
          heading: 'Bills',
          paragraphs: [
            'The Bills page lists every top-up, charge and refund.',
            'Administrators can top up users, grant quotas, or adjust balances.',
          ],
        },
      ],
    },
    {
      heading: 'Model Hub & Leaderboard',
      paragraphs: [
        'The Model Hub lists every model with description, price, context length and available channels.',
        'The Leaderboard ranks models by call counts, spend and error rate.',
      ],
      subSections: [
        {
          heading: 'Model Hub',
          paragraphs: [
            'On the Model Hub you can:',
          ],
          list: [
            'Search models by keyword',
            'Filter by price, context length, availability',
            'View model details (channels, status, price history)',
            'Copy the model name to clipboard',
            'Open the Playground to try it out',
          ],
        },
        {
          heading: 'Model Leaderboard',
          paragraphs: [
            'Rankings are organised by:',
          ],
          list: [
            'Today call counts',
            'This week token spend',
            'This month cost',
            'Lowest error rate',
          ],
        },
        {
          heading: 'User Leaderboard',
          paragraphs: [
            'Community builds also expose a user activity leaderboard to encourage exploration of different models.',
          ],
        },
        {
          heading: 'Favorites & Featured',
          paragraphs: [
            'Bookmark frequently used models for quick access.',
            'Administrators can mark certain models as "Featured" so they appear at the top of the Hub.',
          ],
        },
      ],
    },
  ],
};

/**
 * Per-locale identity for the guide: its page title, its meta description,
 * and the label of each of the nine chapters.
 *
 * A chapter's *body* comes from `content/user-guide/<locale>/<slug>.md`,
 * but its *name* has to exist for all seven languages whether or not that
 * file has been written yet — otherwise the sidebar loses a chapter in
 * exactly the languages that are still being filled in, and the landing
 * page's cards fall back to raw slugs like `wallet-and-subscription`.
 *
 * Keyed by {@link USER_GUIDE_CHAPTER_SLUGS} in the same order, so the
 * labels cannot drift out of alignment with the chapter list the way a
 * positional `sections` array inside the prose can.
 */
const USER_GUIDE_IDENTITY: Record<
  DocsLocale,
  { title: string; description: string; chapters: string[] }
> = {
  zh: {
    title: ZH_CONTENT.title,
    description: ZH_CONTENT.description,
    chapters: [
      '注册与登录',
      '概览与数据看板',
      '个人资料与安全',
      'API 密钥',
      '使用 API 与游乐场',
      '聊天应用集成',
      '日志与异步任务',
      '钱包与订阅',
      '定价和排行',
    ],
  },
  'zh-TW': {
    title: '使用者指南',
    description: 'Uter 使用指南：從註冊登入到模型呼叫、聊天應用整合與日誌稽核',
    chapters: [
      '註冊與登入',
      '概覽與資料儀表板',
      '個人資料與安全性',
      'API 金鑰',
      '使用 API 與遊樂場',
      '聊天應用整合',
      '日誌與非同步任務',
      '錢包與訂閱',
      '定價與排行',
    ],
  },
  en: {
    title: EN_CONTENT.title,
    description: EN_CONTENT.description,
    chapters: [
      'Registration & Login',
      'Overview & Dashboard',
      'Profile & Security',
      'API Keys',
      'Using the API & Playground',
      'App Integration',
      'Logs & Async Tasks',
      'Wallet & Subscription',
      'Model Hub & Leaderboard',
    ],
  },
  fr: {
    title: 'Guide de l’utilisateur',
    description:
      'Guide de l’utilisateur Uter : de l’inscription et de la connexion à l’appel de modèles, à l’intégration d’applications et à l’audit des journaux',
    chapters: [
      'Inscription et connexion',
      'Vue d’ensemble et tableau de bord',
      'Profil et sécurité',
      'Clés API',
      'Utiliser l’API et le bac à sable',
      'Intégration d’applications',
      'Journaux et tâches asynchrones',
      'Portefeuille et abonnement',
      'Hub de modèles et classement',
    ],
  },
  ja: {
    title: 'ユーザーガイド',
    description:
      'Uter ユーザーガイド：登録・ログインからモデル呼び出し、チャットアプリ連携、ログ監査まで',
    chapters: [
      '登録とログイン',
      '概要とダッシュボード',
      'プロフィールとセキュリティ',
      'API キー',
      'API とプレイグラウンド',
      'アプリ連携',
      'ログと非同期タスク',
      'ウォレットとサブスクリプション',
      'モデルハブとランキング',
    ],
  },
  ru: {
    title: 'Руководство пользователя',
    description:
      'Руководство пользователя Uter: от регистрации и входа до вызова моделей, интеграции приложений и аудита журналов',
    chapters: [
      'Регистрация и вход',
      'Обзор и панель',
      'Профиль и безопасность',
      'API-ключи',
      'Работа с API и песочницей',
      'Интеграция приложений',
      'Журналы и асинхронные задачи',
      'Кошелёк и подписка',
      'Каталог моделей и рейтинг',
    ],
  },
  vi: {
    title: 'Hướng dẫn sử dụng',
    description:
      'Hướng dẫn sử dụng Uter: từ đăng ký, đăng nhập đến gọi mô hình, tích hợp ứng dụng và kiểm tra nhật ký',
    chapters: [
      'Đăng ký và đăng nhập',
      'Tổng quan và bảng điều khiển',
      'Hồ sơ và bảo mật',
      'Khóa API',
      'Sử dụng API và khu thử nghiệm',
      'Tích hợp ứng dụng',
      'Nhật ký và tác vụ bất đồng bộ',
      'Ví và gói đăng ký',
      'Trung tâm mô hình và bảng xếp hạng',
    ],
  },
};

export function getUserGuideContent(locale: DocsLocale): UserGuideContent {
  // The structured objects above are the pre-Markdown fallback, kept for
  // the chapters that have no file yet. Chinese copy is authored; every
  // other locale reads the English write-up.
  return locale === 'zh' || locale === 'zh-TW' ? ZH_CONTENT : EN_CONTENT;
}

/** The guide's own title and meta description, in the reader's language. */
export function getUserGuideIdentity(locale: DocsLocale): {
  title: string;
  description: string;
} {
  const { title, description } = USER_GUIDE_IDENTITY[locale];
  return { title, description };
}

/** Where the guide's pages live under a locale root. */
export const USER_GUIDE_PATH = 'guide/wiki/user-guide';

/**
 * The guide's chapters, in sidebar order.
 *
 * Each chapter is a page of its own at
 * `/docs/<lang>/guide/wiki/user-guide/<slug>/`, so it needs a slug for
 * its URL and a label for the navigation. Both are declared here rather
 * than read out of the Markdown, for two reasons: the sidebar has to
 * render a chapter whose Markdown has not been written yet, and the label
 * has to exist in *both* locales while only one of them may have a file
 * (the Chinese chapter can land weeks before its English counterpart).
 *
 * The Markdown therefore supplies a chapter's **body**, and this list
 * supplies its identity. The order of the array is what the sidebar and
 * the landing page use, and the parallel `sections` array in
 * `UserGuideContent` is where the labels come from — so a chapter that
 * has already been migrated and one that has not are labelled alike.
 *
 * Slugs are locale-neutral, like the rest of the site: one URL serves
 * `zh` and `en`, which is what lets the language switch keep the reader
 * on the chapter they were reading.
 */
export const USER_GUIDE_CHAPTER_SLUGS = [
  'auth',
  'dashboard',
  'profile-and-security',
  'api-keys',
  'api-and-playground',
  'app-integration',
  'logs-and-tasks',
  'wallet-and-subscription',
  'pricing-and-ranking',
] as const;

export type UserGuideChapterSlug = (typeof USER_GUIDE_CHAPTER_SLUGS)[number];

/** Position of a slug in the guide, or `-1`. */
export function userGuideChapterIndex(slug: string): number {
  return (USER_GUIDE_CHAPTER_SLUGS as readonly string[]).indexOf(slug);
}

/** A chapter's URL under a locale root. Trailing slash matches the export. */
export function userGuideChapterUrl(locale: DocsLocale, slug: UserGuideChapterSlug): string {
  return `/docs/${locale}/${USER_GUIDE_PATH}/${slug}/`;
}

/**
 * A chapter's label, from the per-locale identity table rather than the
 * structured prose, so the sidebar reads the same whether the body comes
 * from Markdown or not — and so a language with a translated label but no
 * Markdown file yet still shows a real name instead of a raw slug.
 */
export function userGuideChapterTitle(locale: DocsLocale, slug: string): string | undefined {
  const index = userGuideChapterIndex(slug);
  if (index === -1) return undefined;
  return USER_GUIDE_IDENTITY[locale].chapters[index];
}