import { ContentCardGrid } from '@/lib/content-renderer';
import { DocsShell } from '@/lib/docs-shell';
import type { DocsLocale } from '@/lib/i18n';
import { SUPPORTED_DOCS_LOCALES, docsLocaleFromSegment } from '@/lib/i18n';
import { LABELS, SLUGS } from '@/lib/nav';

/**
 * `/docs/<lang>/` — the docs site's own front page, 文档 / Docs.
 *
 * This route has been a quick-start page and then a jump-off point that
 * forwarded to 特性说明. It is a page again: one card per section of the
 * outline, so the locale root is somewhere to land rather than only
 * somewhere to pass through.
 *
 * The cards are built from the same `SLUGS` / `LABELS` the sidebar uses,
 * so a section cannot be renamed or moved in one place and left behind
 * in the other.
 */
const TITLE: Record<DocsLocale, string> = { zh: '文档', en: 'Docs' };

const INTRO: Record<DocsLocale, string> = {
  zh: '按板块浏览：特性说明、用户指南、API 参考、AI 应用与协议文件。',
  en: 'Browse by section: features, the user guide, the API reference, AI apps and the legal documents.',
};

type TeaserKey = 'features' | 'guide' | 'api' | 'apps' | 'userAgreement' | 'privacyPolicy';

const TEASERS: Record<DocsLocale, Record<TeaserKey, string>> = {
  zh: {
    features: '平台能力总览：模型接入、计费方式与额度控制。',
    guide: '从注册、创建令牌到发起第一次调用的操作路径。',
    api: '按协议分组的接口文档，含请求参数与响应字段。',
    apps: '已适配平台的第三方客户端与工具的配置说明。',
    userAgreement: '服务条款、账号使用规范与双方权利义务。',
    privacyPolicy: '数据收集范围、使用方式与保护措施。',
  },
  en: {
    features: 'What the platform does: model access, billing and quota control.',
    guide: 'From sign-up and creating a token to your first API call.',
    api: 'Endpoint reference grouped by protocol, with parameters and responses.',
    apps: 'Configuring the third-party clients and tools that already support the platform.',
    userAgreement: 'Terms of service, account rules and the rights of both sides.',
    privacyPolicy: 'What data is collected, how it is used and how it is protected.',
  },
};

export function generateStaticParams() {
  return SUPPORTED_DOCS_LOCALES.map((lang) => ({ lang }));
}

export default async function DocsLandingPage(props: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await props.params;
  const locale = docsLocaleFromSegment(lang);
  const prefix = `/docs/${locale}`;
  const labels = LABELS[locale];
  const teasers = TEASERS[locale];

  return (
    <DocsShell locale={locale} title={TITLE[locale]} description={INTRO[locale]} toc={[]}>
      <ContentCardGrid
        items={[
          {
            title: labels.features,
            url: `${prefix}/${SLUGS.features}`,
            teaser: teasers.features,
          },
          {
            title: labels.guide,
            url: `${prefix}/${SLUGS.guide}`,
            teaser: teasers.guide,
          },
          { title: labels.api, url: `${prefix}/${SLUGS.api}`, teaser: teasers.api },
          { title: labels.apps, url: `${prefix}/${SLUGS.apps}`, teaser: teasers.apps },
          {
            title: labels.userAgreement,
            url: `${prefix}/${SLUGS.legal}/user-agreement`,
            teaser: teasers.userAgreement,
          },
          {
            title: labels.privacyPolicy,
            url: `${prefix}/${SLUGS.legal}/privacy-policy`,
            teaser: teasers.privacyPolicy,
          },
        ]}
      />
    </DocsShell>
  );
}
