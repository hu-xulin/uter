import type { DocsLocale } from '../i18n';

/**
 * Content for the About page (`/about/<lang>/`).
 *
 * Transcribed from the company profile deck (「项目介绍」) — the Chinese
 * and English halves of that document are two independent write-ups of
 * the same nine chapters, not translations of each other, so both are
 * carried verbatim rather than derived.
 *
 * Shape mirrors the document's own outline, and every heading in the
 * document gets exactly one entry here:
 *
 *   - `sections`    — the nine numbered chapters (`01 — …` … `09 — …`),
 *                     rendered as `h2` and listed in the sidebar and TOC.
 *   - `subSections` — the headings nested inside a chapter, rendered as
 *                     `h3` and listed one level deeper in both.
 *
 * Two headings do not survive as headings, both because they name a
 * single value rather than open a topic:
 *
 *   - the founder's line (`胡旭林｜创始人兼首席执行官`) becomes
 *     `profile`, drawn as a name/role block under 「创始人」;
 *   - the contact addresses (`bd@…`) become `email`, drawn as the
 *     chapter's only link.
 *
 * The partner chapters also carry an instruction to the designer in the
 * source document (asking for a logo wall). That is a production note,
 * not page copy, and is deliberately not reproduced.
 */
export type AboutEntry = {
  label: string;
  value: string;
};

export type AboutSubSection = {
  heading: string;
  paragraphs?: string[];
  /** Rows of `label` + description, e.g. the partner categories. */
  entries?: AboutEntry[];
  /** The one address this heading introduces, rendered as a `mailto:` link. */
  email?: string;
  /**
   * Name, role and optional portrait, drawn as a profile block rather
   * than a heading. `avatar` is a root-relative URL: the portrait is a
   * file under `public/`, not an imported asset.
   */
  profile?: { name: string; role: string; avatar?: string };
};

/**
 * A model brand in the partner wall.
 *
 * `name` and `company` are per-locale because a brand does not read the
 * same way in both languages: the Chinese page says 「通义千问」 where the
 * English one says `Qwen`, and the company behind it is 「阿里巴巴」 or
 * `Alibaba`. The `id` is locale-neutral, and `group` splits the wall into
 * the two rows the chapter talks about.
 */
export type AboutPartner = {
  id: string;
  group: 'global' | 'china';
  name: Record<DocsLocale, string>;
  company: Record<DocsLocale, string>;
};

export type AboutSection = {
  heading: string;
  subSections?: AboutSubSection[];
  /** Lines that close the chapter, drawn after its sub-sections. */
  closing?: string[];
  /**
   * Brands drawn as a wall at the foot of the chapter, under their
   * origin heading. Only 「我们的合作伙伴」 carries one.
   */
  partnerWall?: AboutPartner[];
};

export type AboutContent = {
  title: string;
  description: string;
  sections: AboutSection[];
};

/**
 * URL segment per chapter, in document order. Locale-neutral, so
 * `/about/zh/our-team/` and `/about/en/our-team/` are the same page in
 * two languages — which is what lets the language switch and the search
 * index address a chapter without knowing which locale is live.
 *
 * Positional rather than a field on each chapter: both locales carry the
 * same nine chapters in the same order, and repeating the slug eighteen
 * times would let the two lists drift apart. `getAboutSection()` is the
 * only reader, and it bounds-checks.
 */
export const ABOUT_SECTION_SLUGS = [
  'who-we-are',
  'what-we-do',
  'our-team',
  'our-mission',
  'our-values',
  'our-story',
  'our-partners',
  'join-us',
  'contact-us',
] as const;

export type AboutSectionSlug = (typeof ABOUT_SECTION_SLUGS)[number];

/** Where a chapter lives. Trailing slash matches the export's canonical form. */
export function aboutSectionUrl(locale: DocsLocale, index: number): string {
  return `/about/${locale}/${ABOUT_SECTION_SLUGS[index]}/`;
}

/**
 * The model brands shown at the foot of 「我们的合作伙伴」.
 *
 * Grouped the way the chapter's own prose groups them — the models the
 * platform connects from outside China, then the ones from inside it.
 * Every entry has to correspond to an upstream the gateway really
 * serves (see `relay/channel/`), so the wall stays a description of the
 * product rather than a wish list.
 *
 * `id` is also the mark's filename in `public/img/partners/`. Marks come
 * from the MIT-licensed `@lobehub/icons-static-svg` set; they are
 * monochrome on purpose, so a single file serves both themes.
 */
const PARTNER_WALL: AboutPartner[] = [
  { id: 'openai', group: 'global', name: { zh: 'GPT', en: 'GPT' }, company: { zh: 'OpenAI', en: 'OpenAI' } },
  {
    id: 'anthropic',
    group: 'global',
    name: { zh: 'Claude', en: 'Claude' },
    company: { zh: 'Anthropic', en: 'Anthropic' },
  },
  {
    id: 'google',
    group: 'global',
    name: { zh: 'Gemini', en: 'Gemini' },
    company: { zh: 'Google', en: 'Google' },
  },
  { id: 'xai', group: 'global', name: { zh: 'Grok', en: 'Grok' }, company: { zh: 'xAI', en: 'xAI' } },
  {
    id: 'mistral',
    group: 'global',
    name: { zh: 'Mistral', en: 'Mistral' },
    company: { zh: 'Mistral AI', en: 'Mistral AI' },
  },
  { id: 'cohere', group: 'global', name: { zh: 'Command', en: 'Command' }, company: { zh: 'Cohere', en: 'Cohere' } },
  {
    id: 'deepseek',
    group: 'china',
    name: { zh: 'DeepSeek', en: 'DeepSeek' },
    company: { zh: '深度求索', en: 'DeepSeek' },
  },
  {
    id: 'qwen',
    group: 'china',
    name: { zh: '通义千问', en: 'Qwen' },
    company: { zh: '阿里巴巴', en: 'Alibaba' },
  },
  {
    id: 'hunyuan',
    group: 'china',
    name: { zh: '混元', en: 'Hunyuan' },
    company: { zh: '腾讯', en: 'Tencent' },
  },
  {
    id: 'doubao',
    group: 'china',
    name: { zh: '豆包', en: 'Doubao' },
    company: { zh: '字节跳动', en: 'ByteDance' },
  },
  {
    id: 'glm',
    group: 'china',
    name: { zh: '智谱 GLM', en: 'Zhipu GLM' },
    company: { zh: '智谱 AI', en: 'Zhipu AI' },
  },
  {
    id: 'kimi',
    group: 'china',
    name: { zh: 'Kimi', en: 'Kimi' },
    company: { zh: '月之暗面', en: 'Moonshot AI' },
  },
];

/** Row labels the wall is drawn under, matching the chapter's own wording. */
export const PARTNER_GROUP_LABELS: Record<
  AboutPartner['group'],
  Record<DocsLocale, string>
> = {
  global: { zh: '国外大模型', en: 'Global models' },
  china: { zh: '国内大模型', en: 'Models from China' },
};

/**
 * The founder's portrait, served from `public/about-assets/`.
 *
 * Root-relative and outside `/about/`, so the URL cannot be confused with
 * the SPA's own `/about` route when the page is framed.
 */
const FOUNDER_AVATAR = '/about-assets/founder.jpg';

const ZH_CONTENT: AboutContent = {
  title: '关于我们',
  description: '让智能连接世界，让技术创造价值。',
  sections: [
    {
      heading: '我们是谁',
      subSections: [
        {
          heading: '连接智能，创造可能',
          paragraphs: [
            'Uter.ai 优特智能，隶属于深圳优特网络有限公司，是一家专注于人工智能与大模型服务的科技公司。',
            '我们致力于打造面向开发者、企业和创新团队的智能大模型服务平台，连接全球领先的大语言模型与人工智能技术，为用户提供便捷、高效、稳定的智能服务。',
            '随着生成式人工智能快速发展，大模型正在从一种前沿技术，逐渐成为新一代数字生产力。',
            '然而，从模型能力到实际应用之间，仍然存在复杂的技术门槛。模型选择、技术接入、服务调用、应用开发以及不同人工智能能力之间的协同，都需要专业的技术基础设施支持。',
            '优特智能希望解决的，正是这一层复杂度。',
            '我们通过统一的平台连接多种大模型与人工智能服务，通过智能化的技术能力降低人工智能的使用门槛，让先进的大模型能力真正融入产品、企业与日常工作。',
            '从大模型服务，到智能路由；',
            '从开发者工具，到人工智能应用赋能；',
            '优特智能正在构建连接模型、开发者、企业与人工智能应用的新一代智能服务基础设施。',
          ],
        },
        {
          heading: '我们的目标',
          paragraphs: ['让每一个人和每一家企业，都能够更简单地使用人工智能。'],
        },
      ],
    },
    {
      heading: '我们提供什么',
      subSections: [
        {
          heading: '一站式智能大模型服务',
          paragraphs: [
            '优特智能专注于大模型及人工智能服务，为开发者和企业提供从模型接入到人工智能应用的一站式智能服务。',
          ],
        },
        {
          heading: '智能大模型服务',
          paragraphs: [
            '连接国内外主流大语言模型，为用户提供统一、便捷的模型服务入口。',
            '覆盖智能对话、文本生成、内容创作、代码生成、知识问答、数据分析等多种人工智能应用场景。',
          ],
        },
        {
          heading: '多模型接入',
          paragraphs: [
            '不同模型拥有不同的能力特点和适用场景。',
            '优特智能致力于构建开放的多模型服务体系，让开发者能够根据业务需求灵活选择和调用不同模型能力。',
            '通过统一的服务方式，降低多模型接入和维护的技术复杂度。',
          ],
        },
        {
          heading: '智能模型路由',
          paragraphs: [
            '不同应用场景对模型能力、响应速度、稳定性和成本有着不同要求。',
            '优特智能持续探索智能模型选择与服务调度技术，根据用户需求匹配不同模型服务，让人工智能应用更加高效、灵活。',
          ],
        },
        {
          heading: '人工智能应用赋能',
          paragraphs: [
            '模型只是开始，应用才是人工智能创造价值的地方。',
            '优特智能致力于帮助开发者和企业将大模型能力快速融入实际产品与业务场景，从智能应用开发到企业智能化升级，让人工智能真正成为新一代生产力。',
          ],
        },
        {
          heading: '开发者服务',
          paragraphs: [
            '面向开发者提供标准化、易用的人工智能服务与开发能力。',
            '通过简单的接入方式、完善的平台能力和持续优化的服务体验，让开发者将更多时间投入产品创新，而不是底层基础设施建设。',
          ],
        },
      ],
    },
    {
      heading: '我们的团队',
      subSections: [
        {
          heading: '创始人',
          profile: { name: '胡旭林', role: '创始人兼首席执行官', avatar: FOUNDER_AVATAR },
          paragraphs: [
            '原阿里巴巴副总裁、云胡科技创始人，曾任创梦天地云平台产品总监，并先后任职于百度、腾讯。',
            '拥有12年横跨云计算、企业服务及高并发产品架构的管理与创业经验。',
            '从互联网时代到移动互联网，再到云计算与今天的生成式人工智能时代，胡先生长期参与互联网技术与商业模式的演进，积累了丰富的平台型产品、技术架构和企业服务经验。',
            '如今，他将多年互联网平台与企业服务领域的经验带入大模型时代，专注于构建新一代人工智能服务平台。',
            '他认为，大模型的价值不应该停留在技术能力本身，而应该真正转化为开发者和企业可以使用、可以部署、可以规模化创造价值的生产力。',
            '基于这一理念，优特智能致力于构建开放、高效、智能的大模型服务体系，降低人工智能技术应用门槛，让先进的人工智能能力真正服务于各行各业。',
          ],
        },
      ],
    },
    {
      heading: '我们的使命',
      subSections: [
        {
          heading: '让人工智能更简单，让智能触手可及',
          paragraphs: [
            '人工智能正在成为新一轮技术革命的重要基础。',
            '但技术发展越快，人与技术之间的距离并不一定越近。',
            '优特智能希望成为连接先进人工智能技术与真实应用之间的桥梁。',
            '我们持续降低大模型使用与开发的门槛，让开发者更加专注于创造，让企业更加高效地拥抱人工智能，让更多创新想法能够快速成为真正的产品。',
            '让每一个想法，都有机会借助人工智能成为现实。',
          ],
        },
      ],
    },
    {
      heading: '我们的价值观',
      subSections: [
        {
          heading: '持续创新',
          paragraphs: [
            '人工智能技术正在快速演进。',
            '我们保持对新模型、新技术和新应用的持续探索，以开放的心态拥抱变化，不断突破技术与应用的边界。',
          ],
        },
        {
          heading: '简单至上',
          paragraphs: [
            '复杂的技术应该隐藏在简单的产品体验之后。',
            '我们希望让人工智能更容易理解、更容易接入、更容易使用。',
          ],
        },
        {
          heading: '值得信赖',
          paragraphs: [
            '人工智能服务正在成为数字业务的重要基础设施。',
            '我们重视稳定性、安全性和服务质量，为用户提供可靠的智能服务。',
          ],
        },
        {
          heading: '开放连接',
          paragraphs: [
            '我们相信未来的人工智能生态不会由单一模型定义。',
            '优特智能致力于连接不同模型、技术和应用，为开发者提供更加开放和灵活的选择。',
          ],
        },
        {
          heading: '用户至上',
          paragraphs: [
            '技术最终服务于人。',
            '我们从真实需求出发，不断优化产品与服务，让人工智能真正创造价值。',
          ],
        },
      ],
    },
    {
      heading: '我们的故事',
      subSections: [
        {
          heading: '从互联网时代走向人工智能时代',
          paragraphs: [
            '优特智能的故事，始于团队对互联网平台与技术服务的长期探索。',
            '过去20年，互联网经历了互联网、移动互联网、云计算等多个重要技术阶段。',
            '每一次技术革命，都伴随着基础设施的重新构建。',
            '今天，我们正在进入生成式人工智能时代。',
            '大模型正在成为新的技术底座，也正在重新定义软件、互联网以及企业服务。',
            '但从模型能力到真实应用之间，仍然存在一道巨大的鸿沟。',
            '优特智能希望成为跨越这道鸿沟的连接者。',
          ],
        },
        {
          heading: '第一阶段｜互联网平台经验',
          paragraphs: [
            '团队长期深耕互联网平台、云计算、企业服务和高并发产品。',
            '这些经历让我们更加理解，一个真正有价值的技术平台，不只是提供技术，更要让技术能够被规模化使用。',
          ],
        },
        {
          heading: '第二阶段｜探索大模型',
          paragraphs: [
            '随着生成式人工智能快速发展，大模型逐渐成为新的基础技术。',
            '我们开始思考：',
            '如何让更多模型能够被连接？',
            '如何让开发者更加简单地使用人工智能？',
            '如何让企业真正将人工智能转化为生产力？',
            '这些问题成为优特智能发展的重要起点。',
          ],
        },
        {
          heading: '第三阶段｜构建智能服务平台',
          paragraphs: [
            '优特智能持续建设大模型服务、多模型接入、智能路由、开发者服务与人工智能应用能力。',
            '我们希望将复杂的底层技术封装在平台之中，将简单、高效的人工智能能力交给用户。',
          ],
        },
        {
          heading: '第四阶段｜面向未来',
          paragraphs: [
            '人工智能时代才刚刚开始。',
            '未来，越来越多的产品、企业和个人将与人工智能深度协作。',
            '优特智能将持续连接更多模型、技术和应用，建设面向未来的智能大模型服务平台。',
            '让智能连接世界，让技术创造价值。',
          ],
        },
      ],
    },
    {
      heading: '我们的合作伙伴',
      subSections: [
        {
          heading: '共建开放的人工智能生态',
          paragraphs: [
            '优特智能致力于构建开放的人工智能生态，与国内外领先的大模型、人工智能及云服务企业建立合作与连接。',
            '通过连接多元化的人工智能能力，为开发者和企业提供更加丰富、灵活的智能服务。',
            '我们的合作生态包括：',
          ],
          entries: [
            {
              label: '大模型服务商',
              value: '连接国内外优秀的大语言模型与人工智能模型服务。',
            },
            {
              label: '人工智能技术伙伴',
              value: '与人工智能技术企业共同探索新的技术与应用场景。',
            },
            {
              label: '云计算与基础设施伙伴',
              value: '连接云计算、算力及相关基础设施服务。',
            },
            {
              label: '企业与行业伙伴',
              value: '与不同领域的企业共同探索人工智能在真实业务场景中的应用。',
            },
          ],
        },
      ],
      partnerWall: PARTNER_WALL,
    },
    {
      heading: '加入我们',
      subSections: [
        {
          heading: '与我们一起创造人工智能的未来',
          paragraphs: [
            '人工智能正在重新定义未来。',
            '我们正在寻找同样相信人工智能能够改变世界的人。',
            '无论你擅长产品、技术还是运营，如果你希望参与下一代智能服务平台的建设，欢迎加入优特智能。',
          ],
        },
        {
          heading: '产品岗位',
          paragraphs: [
            '参与人工智能产品设计、用户体验和产品创新，探索大模型在不同场景下的应用可能。',
          ],
        },
        {
          heading: '技术岗位',
          paragraphs: [
            '参与大模型平台、智能路由、人工智能基础设施、分布式系统等核心技术建设。',
          ],
        },
        {
          heading: '运营岗位',
          paragraphs: [
            '参与用户增长、内容运营、商业化与生态建设，推动人工智能产品进入更多真实应用场景。',
          ],
        },
        {
          heading: '招聘邮箱',
          email: 'hr@uter.ai',
        },
      ],
      closing: [
        '如果你对人工智能充满热情，希望与优秀团队一起创造下一代智能产品，我们期待认识你。',
      ],
    },
    {
      heading: '联系我们',
      subSections: [
        {
          heading: '与我们取得联系',
          paragraphs: [
            '无论是商务合作、技术合作、渠道合作还是媒体交流，我们期待与更多伙伴共同探索人工智能的未来。',
          ],
        },
        { heading: '商务合作', email: 'bd@uter.ai' },
        { heading: '技术支持', email: 'tech@uter.ai' },
        { heading: '渠道合作', email: 'partner@uter.ai' },
        { heading: '媒体合作', email: 'pr@uter.ai' },
        {
          heading: '深圳优特网络有限公司',
          paragraphs: [
            'Uter.ai 优特智能',
            '智能大模型服务平台',
            '让智能连接世界，让技术创造价值。',
          ],
        },
      ],
    },
  ],
};

const EN_CONTENT: AboutContent = {
  title: 'About Us',
  description: 'Connect Intelligence. Create Value.',
  sections: [
    {
      heading: 'Who We Are',
      subSections: [
        {
          heading: 'Connecting Intelligence. Creating Possibilities.',
          paragraphs: [
            'Uter, operated by Shenzhen Uter Network Technology Co., Ltd., is a technology company focused on artificial intelligence and large language model services.',
            'We are building an intelligent large language model service platform for developers, enterprises, and innovators, connecting leading large language models and AI technologies through a unified and efficient service platform.',
            'As generative AI continues to evolve, large language models are becoming a new form of digital infrastructure and an increasingly important source of productivity.',
            'Yet turning model capabilities into real-world applications still involves significant complexity — from model selection and technical integration to service management, application development, and coordination across different AI capabilities.',
            'Uter is built to simplify that complexity.',
            'Through a unified platform, we connect multiple large language models and AI services, helping users access and integrate advanced AI capabilities more efficiently.',
            'From model services and intelligent routing to developer tools and AI application enablement, Uter is building a new generation of intelligent infrastructure that connects models, developers, enterprises, and applications.',
          ],
        },
        {
          heading: 'Our Goal',
          paragraphs: ['Make AI simpler and more accessible to everyone.'],
        },
      ],
    },
    {
      heading: 'What We Do',
      subSections: [
        {
          heading: 'Intelligent Large Language Model Services',
          paragraphs: [
            'Uter provides intelligent model services for developers and enterprises, covering the journey from model access to AI applications.',
          ],
        },
        {
          heading: 'Intelligent LLM Services',
          paragraphs: [
            'We connect leading large language models and provide a unified gateway to a broad range of AI capabilities.',
            'Our services support a variety of applications, including intelligent conversations, content generation, coding, knowledge assistance, analysis, and more.',
          ],
        },
        {
          heading: 'Multi-Model Access',
          paragraphs: [
            'Different models excel at different tasks and offer different capabilities.',
            'Uter is building an open multi-model service ecosystem that enables developers to access and use different models according to their specific needs.',
            'By providing a unified service experience, we reduce the complexity of integrating and maintaining multiple models.',
          ],
        },
        {
          heading: 'Intelligent Model Routing',
          paragraphs: [
            'Different applications require different combinations of model capabilities, response speed, reliability, and cost.',
            'Uter is developing intelligent model selection and service routing technologies that help match users with suitable model services for different scenarios.',
          ],
        },
        {
          heading: 'AI Application Enablement',
          paragraphs: [
            'Models are only the beginning. Applications are where AI creates real value.',
            'We help developers and enterprises integrate large language models into real products, workflows, and business scenarios — transforming AI capabilities into practical productivity.',
          ],
        },
        {
          heading: 'Developer Services',
          paragraphs: [
            'We provide standardized and accessible AI services for developers.',
            'Through simple integration, comprehensive platform capabilities, and continuously improving service quality, we enable developers to focus on building products rather than managing complex underlying infrastructure.',
          ],
        },
      ],
    },
    {
      heading: 'Our Team',
      subSections: [
        {
          heading: 'Founder',
          profile: {
            name: 'Xulin Hu',
            role: 'Founder & Chief Executive Officer',
            avatar: FOUNDER_AVATAR,
          },
          paragraphs: [
            'Former Vice President of Alibaba Group and Founder of Yunhu Technology, Xulin Hu previously served as Product Director at iDreamsky and held positions at Baidu and Tencent.',
            "With 20 years of experience spanning cloud computing, enterprise services, and high-concurrency product architecture, he has worked across major stages of the internet industry's evolution and brings extensive experience in platform products, technology infrastructure, and enterprise services.",
            "From the early personal-computing internet era to mobile internet, cloud computing, and today's generative AI revolution, Mr.Hu has been deeply involved in the evolution of technology platforms and digital businesses.",
            'Today, he brings that experience into the era of large language models, focusing on building a new generation of intelligent AI services.',
            'He believes that the value of large language models should extend beyond technological capability. AI should become practical, accessible, deployable, and capable of creating scalable value for developers and enterprises.',
            'With this vision, Uter is building an open, efficient, and intelligent large language model service platform designed to lower the barriers to AI adoption and bring advanced AI capabilities to businesses and industries around the world.',
          ],
        },
      ],
    },
    {
      heading: 'Our Mission',
      subSections: [
        {
          heading: 'Make AI Simple. Make Intelligence Accessible.',
          paragraphs: [
            'Artificial intelligence is becoming one of the defining technologies of a new technological era.',
            'Yet as technology advances rapidly, the distance between people and technology does not necessarily become smaller.',
            'Uter aims to bridge the gap between advanced AI technologies and real-world applications.',
            'We continuously work to reduce the barriers to using and developing with large language models, enabling developers to focus on innovation and enterprises to adopt AI more efficiently.',
            'We want every idea to have the opportunity to become reality with the help of AI.',
          ],
        },
      ],
    },
    {
      heading: 'Our Values',
      subSections: [
        {
          heading: 'Innovation',
          paragraphs: [
            'AI is evolving at an unprecedented pace.',
            'We continuously explore new models, technologies, and applications while embracing change and pushing the boundaries of what AI can achieve.',
          ],
        },
        {
          heading: 'Simplicity',
          paragraphs: [
            'Complex technology should be hidden behind simple experiences.',
            'We strive to make AI easier to understand, integrate, and use.',
          ],
        },
        {
          heading: 'Reliability',
          paragraphs: [
            'AI services are becoming critical infrastructure for modern digital businesses.',
            'We prioritize reliability, security, and service quality to provide dependable AI services for our users.',
          ],
        },
        {
          heading: 'Openness',
          paragraphs: [
            'We believe the future of AI will not be defined by a single model.',
            'Uter is committed to connecting diverse models, technologies, and applications while giving developers greater freedom of choice.',
          ],
        },
        {
          heading: 'User First',
          paragraphs: [
            'Technology ultimately exists to serve people.',
            'We start with real user needs and continuously improve our products and services to create meaningful value through AI.',
          ],
        },
      ],
    },
    {
      heading: 'Our Story',
      subSections: [
        {
          heading: 'From the Internet Era to the Age of AI',
          paragraphs: [
            "The story of Uter began with our team's long-term experience in internet platforms and technology services.",
            'Over the past two decades, the internet has evolved through several major technological eras — from personal computing and mobile internet to cloud computing.',
            'Every technological transformation has required new infrastructure.',
            'Today, we are entering the era of generative AI.',
            'Large language models are becoming a new technological foundation, reshaping software, the internet, and enterprise services.',
            'Yet a significant gap still exists between model capabilities and real-world applications.',
            'Uter aims to bridge that gap.',
          ],
        },
        {
          heading: 'Chapter One — Platform Experience',
          paragraphs: [
            'Our team has spent years working across internet platforms, cloud computing, enterprise services, and high-concurrency products.',
            'These experiences taught us that a truly valuable technology platform does more than provide technology.',
            'It makes technology scalable, accessible, and useful.',
          ],
        },
        {
          heading: 'Chapter Two — Exploring Large Language Models',
          paragraphs: [
            'As generative AI began to accelerate, large language models emerged as a new technological foundation.',
            'We began asking:',
            'How can more models be connected?',
            'How can developers use AI more easily?',
            'How can enterprises turn AI into real productivity?',
            'These questions became an important starting point for Uter.',
          ],
        },
        {
          heading: 'Chapter Three — Building an Intelligent Service Platform',
          paragraphs: [
            'Uter continues to develop capabilities across large language model services, multi-model access, intelligent routing, developer services, and AI application enablement.',
            'Our goal is to handle the complexity of underlying technology while giving users a simple and efficient AI experience.',
          ],
        },
        {
          heading: 'Chapter Four — Looking Ahead',
          paragraphs: [
            'The AI era is only beginning.',
            'In the years ahead, more products, businesses, and individuals will work alongside artificial intelligence.',
            'Uter will continue connecting models, technologies, and applications to build an intelligent large language model service platform for the future.',
            'Connect Intelligence. Create Value.',
          ],
        },
      ],
    },
    {
      heading: 'Our Partners',
      subSections: [
        {
          heading: 'Building an Open AI Ecosystem',
          paragraphs: [
            'Uter is building an open AI ecosystem and working with leading large language model providers, AI technology companies, and cloud and infrastructure partners around the world.',
            'By connecting diverse AI capabilities, we aim to provide developers and enterprises with broader and more flexible access to intelligent services.',
            'Our ecosystem includes:',
          ],
          entries: [
            {
              label: 'Large Language Model Providers',
              value:
                'Connecting leading large language models and AI model services from around the world.',
            },
            {
              label: 'AI Technology Partners',
              value:
                'Working with innovative AI companies to explore new technologies and application scenarios.',
            },
            {
              label: 'Cloud & Infrastructure Partners',
              value:
                'Connecting cloud computing, computing infrastructure, and related technology services.',
            },
            {
              label: 'Enterprise & Industry Partners',
              value:
                'Working with businesses across industries to explore practical applications of AI in real-world scenarios.',
            },
          ],
        },
      ],
      partnerWall: PARTNER_WALL,
    },
    {
      heading: 'Join Us',
      subSections: [
        {
          heading: 'Build the Future of AI With Us',
          paragraphs: [
            'AI is redefining the future.',
            'We are looking for people who share our belief in the transformative potential of artificial intelligence.',
            'Whether your expertise is in product, technology, or operations, if you want to help build the next generation of intelligent services, we would love to hear from you.',
          ],
        },
        {
          heading: 'Product',
          paragraphs: [
            'Design AI products, shape user experiences, and explore new ways to bring large language models into real-world applications.',
          ],
        },
        {
          heading: 'Technology',
          paragraphs: [
            'Build the core technologies behind our large language model platform, intelligent routing, AI infrastructure, and distributed systems.',
          ],
        },
        {
          heading: 'Operations',
          paragraphs: [
            'Drive user growth, content, commercialization, and ecosystem development to bring AI products into more real-world scenarios.',
          ],
        },
        { heading: 'Careers', email: 'hr@uter.ai' },
      ],
      closing: [
        'If you are passionate about AI and want to work with a talented team to build the next generation of intelligent products, join us.',
      ],
    },
    {
      heading: 'Contact Us',
      subSections: [
        {
          heading: 'Get in Touch',
          paragraphs: [
            'Whether you are interested in business development, technology partnerships, channel cooperation, or media opportunities, we look forward to exploring the future of AI with you.',
          ],
        },
        { heading: 'Business Development', email: 'bd@uter.ai' },
        { heading: 'Technical Support', email: 'tech@uter.ai' },
        { heading: 'Channel Partnerships', email: 'partner@uter.ai' },
        { heading: 'Media Relations', email: 'pr@uter.ai' },
        {
          heading: 'Shenzhen Uter Network Technology Co., Ltd.',
          paragraphs: [
            'Uter',
            'Intelligent Large Language Model Services Platform',
            'Connect Intelligence. Create Value.',
          ],
        },
      ],
    },
  ],
};

export function getAboutContent(locale: DocsLocale): AboutContent {
  return locale === 'en' ? EN_CONTENT : ZH_CONTENT;
}

/**
 * One chapter of the profile, addressed by its URL slug.
 *
 * Chapters are pages of their own (`/about/<lang>/<slug>/`), so this is
 * what a chapter route resolves its params with. Unknown slugs come back
 * `undefined` and the route turns that into a 404 rather than rendering
 * an empty page.
 */
export function getAboutSection(
  locale: DocsLocale,
  slug: string
): { section: AboutSection; index: number; slug: AboutSectionSlug } | undefined {
  const index = (ABOUT_SECTION_SLUGS as readonly string[]).indexOf(slug);
  if (index === -1) return undefined;

  const section = getAboutContent(locale).sections[index];
  if (!section) return undefined;

  return { section, index, slug: ABOUT_SECTION_SLUGS[index] };
}
