import type { DocsLocale } from '../i18n';

/**
 * Content for the "Features Introduction" page.
 * Adapted from NewAPI's features-introduction page.
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
    '支持查询合法授权渠道的用量或余额信息：配合项目 new-api-key-tool 可实现用 key 查询使用',
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
    'Support for querying usage or balance of authorized channels: use with new-api-key-tool to query usage by key',
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

export function getFeaturesContent(locale: DocsLocale): FeaturesContent {
  return locale === 'zh' ? ZH_CONTENT : EN_CONTENT;
}
