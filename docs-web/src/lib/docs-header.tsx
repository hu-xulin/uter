'use client';

import Image from 'next/image';
import { usePathname } from 'fumadocs-core/framework';
import { Languages, Moon, Sun } from 'lucide-react';
import { withDocsBasePath } from '@/lib/docs-base-path';
import { HOST_APP_LINK_TARGET } from './docs-base-path';
import { useTheme } from 'next-themes';
import { useEffect, useState, type ReactNode } from 'react';
import { LanguageSelect } from 'fumadocs-ui/layouts/shared/slots/language-select';

import type { DocsLocale } from '@/lib/i18n';

/**
 * Site-wide top navigation links rendered in the docs header.
 *
 * The docs site is statically exported from Next.js and has its own
 * React tree, so it can't share the SPA's `PublicHeader`. We
 * re-implement the same set of top-nav links here, pointing at the
 * SPA routes (`/`, `/dashboard`, `/pricing`, `/rankings`, `/docs`,
 * `/about`) so that users can jump between docs and the rest of the
 * app without losing the navigation context.
 *
 * Labels and URLs mirror the SPA's `useTopNavLinks()` output, and the
 * strings match the SPA's `zh` / `en` i18next entries for the same
 * keys (`Home`, `Console`, `Model Square`, `Rankings`, `Docs`,
 * `About`) so both headers read identically. The literals below are
 * copies, not imports — when one of those entries changes, read the new
 * value out of `web/src/i18n/locales/<lang>.json` (keyed by the English
 * source string) and update it here, or the bars drift apart.
 *
 * The brand block is part of the same contract: `BRAND_NAME` mirrors the
 * SPA's `localizedBrandName`, and `.Uter-brand-mark` /
 * `.Uter-brand-wordmark` in `global.css` reproduce the mark's radius and
 * the wordmark's face. The two sites are separate Tailwind builds with
 * different scales, so those cannot be expressed by reusing the app's
 * utility classes.
 *
 * The links are rendered as plain `<a href>` elements so the browser
 * performs a full document navigation — Fumadocs' `<Link>` wrapper
 * would try to client-route inside the docs site and break for
 * cross-app targets.
 */
const NAV_LINKS_ZH = [
  { title: '首页', href: '/' },
  { title: '管理', href: '/dashboard' },
  { title: '定价', href: '/pricing' },
  { title: '排行', href: '/rankings' },
  { title: '文档', href: '/docs' },
  { title: '关于', href: '/about' },
] as const;

const NAV_LINKS_EN = [
  { title: 'Home', href: '/' },
  { title: 'Console', href: '/dashboard' },
  { title: 'Model Square', href: '/pricing' },
  { title: 'Rankings', href: '/rankings' },
  { title: 'Docs', href: '/docs' },
  { title: 'About', href: '/about' },
] as const;

/**
 * Wordmark shown next to the mark, per docs locale.
 *
 * A copy of the SPA's `localizedBrandName` (`web/src/lib/brand.ts`)
 * rather than a shared import: the docs site is a separate build and has
 * no dependency on the app's `src/`. The two must agree character for
 * character — the lockup sits in the same place, at the same size, in
 * bars that are otherwise identical, so a difference here is the most
 * visible kind of drift. The app shows a bilingual form in Chinese and
 * the short mark everywhere else. Add a row when a locale is added to
 * `SUPPORTED_DOCS_LOCALES` (the app's Hant form is `Uter.ai 優特智能`).
 */
const BRAND_NAME: Record<DocsLocale, string> = {
  zh: 'Uter.ai 优特智能',
  'zh-TW': 'Uter.ai 優特智能',
  en: 'Uter.ai',
  fr: 'Uter.ai',
  ja: 'Uter.ai',
  ru: 'Uter.ai',
  vi: 'Uter.ai',
};

/**
 * Links that point at the **host app** (the Uter SPA) rather than at a docs
 * page must carry `target="_top"`.
 *
 * The docs site is exported with `basePath: '/docs-content'` and is normally
 * rendered inside the SPA's iframe (see `web/src/features/docs/docs-viewer.tsx`).
 * A plain `<a href='/sign-in'>` inside that frame navigates **the frame
 * itself**, so the browser resolves it against the frame's own base — i.e.
 * `/docs-content/docs/zh/.../sign-in`, which does not exist. The reader presses
 * 「登录」 and nothing happens: no navigation, no error, no console output.
 *
 * `target="_top"` makes the link address the top-level window instead, which is
 * what a link to the host app has to do. (The frame's sandbox also needs
 * `allow-top-navigation-by-user-activation` for the browser to allow that
 * navigation at all — that half is the host's side, in `docs-viewer.tsx`.)
 */
const COPY = {
  zh: {
    signIn: '登录',
    toggleMenu: '切换导航菜单',
    toggleTheme: '切换主题',
    chooseLanguage: '选择语言',
  },
  'zh-TW': {
    signIn: '登入',
    toggleMenu: '切換導航選單',
    toggleTheme: '切換主題',
    chooseLanguage: '選擇語言',
  },
  en: {
    signIn: 'Sign in',
    toggleMenu: 'Toggle navigation menu',
    toggleTheme: 'Toggle theme',
    chooseLanguage: 'Choose a language',
  },
  fr: {
    signIn: 'Se connecter',
    toggleMenu: 'Basculer le menu de navigation',
    toggleTheme: 'Basculer le thème',
    chooseLanguage: 'Choisir une langue',
  },
  ja: {
    signIn: 'ログイン',
    toggleMenu: 'ナビゲーションメニューを切り替え',
    toggleTheme: 'テーマを切り替え',
    chooseLanguage: '言語を選択',
  },
  ru: {
    signIn: 'Войти',
    toggleMenu: 'Переключить навигационное меню',
    toggleTheme: 'Переключить тему',
    chooseLanguage: 'Выбрать язык',
  },
  vi: {
    signIn: 'Đăng nhập',
    toggleMenu: 'Chuyển đổi menu điều hướng',
    toggleTheme: 'Chuyển đổi giao diện',
    chooseLanguage: 'Chọn ngôn ngữ',
  },
} as const;

/**
 * Scroll distance (in px) after which the header collapses into its
 * compact, floating capsule form. Mirrors `PublicHeader` in the SPA.
 */
const SCROLL_THRESHOLD = 20;

/**
 * Join conditional class names. The class lists here are fully
 * controlled by ternaries, so plain concatenation is enough — there
 * are no conflicting utilities to merge.
 */
function cx(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

/**
 * Icon-only light/dark toggle with the SPA's rotating sun/moon
 * cross-fade. The two icons are stacked and cross-animated purely via
 * `dark:` utilities, so there's no server/client render mismatch and
 * no "mounted" flash.
 *
 * Switching between light and dark here intentionally mirrors the
 * SPA's header button. Fumadocs' own three-state switch (light/dark/
 * system) remains available in the mobile header and the sidebar.
 */
function DocsThemeToggle({ label }: { label: string }) {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <button
      type='button'
      aria-label={label}
      onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
      className='Uter-brand-radius relative inline-flex size-9 items-center justify-center text-fd-muted-foreground transition-colors duration-200 hover:bg-fd-accent hover:text-fd-accent-foreground'
    >
      <Sun className='size-[1.2rem] scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90' />
      <Moon className='absolute size-[1.2rem] scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0' />
    </button>
  );
}

/**
 * Custom header shown at the top of every docs page.
 *
 * Visual language and motion are copied from the SPA's `PublicHeader`
 * so the docs and the app feel like one product:
 *
 *  - the bar is `fixed` and full-width while the page is at the top;
 *  - once the page scrolls past `SCROLL_THRESHOLD`, it animates into a
 *    centred, rounded capsule with a translucent blurred background,
 *    hairline ring and soft shadow;
 *  - the logo scales slightly on hover, nav links shift colour on
 *    hover, and the mobile hamburger morphs into an X while the
 *    full-screen overlay staggers its links in.
 *
 * All transition timings (`duration-700` with
 * `cubic-bezier(0.16,1,0.3,1)`) match the SPA exactly.
 *
 * Fumadocs' default docs header is mobile-only and doesn't surface the
 * supplied `links` on desktop — it relies on the sidebar instead. We
 * replace it with this header so users always have a way back to the
 * rest of the app without having to navigate the sidebar first.
 */
export function DocsHeader({ locale }: { locale: DocsLocale }) {
  const pathname = usePathname();
  const links = locale === 'zh' ? NAV_LINKS_ZH : NAV_LINKS_EN;
  const copy = COPY[locale];
  const brand = BRAND_NAME[locale];

  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    // `/docs` covers every statically exported docs page.
    if (href === '/docs') {
      return pathname === '/docs' || pathname.startsWith('/docs/');
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > SCROLL_THRESHOLD);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  const logo: ReactNode = (
    <Image
      // `images.unoptimized` is on (static export requires it), so next/image
      // emits `src` verbatim instead of folding in the basePath — add it here
      // or the header asks for `/logo.png`, which the SPA fallback answers
      // with index.html and the mark renders blank.
      src={withDocsBasePath('/logo.png?v=8')}
      alt={brand}
      width={28}
      height={28}
      className='Uter-brand-mark size-full object-contain'
    />
  );

  return (
    <>
      <header
        id='nd-docs-topnav'
        className='pointer-events-none fixed inset-x-0 top-0 z-50'
      >
        <div
          className={cx(
            'pointer-events-auto mx-auto transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]',
            scrolled ? 'max-w-[52rem] px-3 pt-3' : 'max-w-7xl px-4 pt-0 md:px-6'
          )}
        >
          <nav
            className={cx(
              'flex items-center justify-between gap-2 transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]',
              scrolled
                ? 'bg-fd-background/60 ring-fd-border/50 h-12 rounded-2xl pr-1.5 pl-4 shadow-[0_2px_16px_-6px_rgba(0,0,0,0.08),0_0_0_0.5px_rgba(0,0,0,0.02)] ring-[0.5px] backdrop-blur-2xl dark:shadow-[0_2px_16px_-6px_rgba(0,0,0,0.4)]'
                : 'h-16 px-2'
            )}
          >
            {/* Brand */}
            <div className='flex min-w-0 flex-1 items-center gap-1 lg:min-w-36'>
              <a
                href='/'
                target={HOST_APP_LINK_TARGET}
                className='group flex min-w-0 items-center gap-2.5'
              >
                <div className='flex size-7 shrink-0 items-center justify-center transition-all duration-300 group-hover:scale-105'>
                  {logo}
                </div>
                <span
                  className='Uter-brand-wordmark max-w-48 truncate text-lg tracking-tight'
                  title={brand}
                >
                  {brand}
                </span>
              </a>
            </div>

            {/* Desktop nav */}
            <div className='hidden min-w-0 items-center gap-0.5 lg:flex'>
              {links.map((link) => (
                <a
                  key={`${link.title}:${link.href}`}
                  href={link.href}
                  target={HOST_APP_LINK_TARGET}
                  title={link.title}
                  className={cx(
                    'Uter-brand-radius min-w-0 truncate px-3 py-1.5 text-sm font-medium transition-colors duration-200',
                    isActive(link.href)
                      ? 'text-fd-foreground'
                      : 'text-fd-muted-foreground hover:text-fd-foreground'
                  )}
                >
                  {link.title}
                </a>
              ))}

              <div className='bg-fd-border/40 mx-2 h-4 w-px' />

              <LanguageSelect
                className='Uter-brand-radius size-9'
                aria-label={copy.chooseLanguage}
              >
                <Languages className='size-[1.2rem]' />
              </LanguageSelect>

              <DocsThemeToggle label={copy.toggleTheme} />

              <div className='bg-fd-border/40 mx-1 h-4 w-px' />

              <a
                href='/sign-in'
                target={HOST_APP_LINK_TARGET}
                className='Uter-brand-cta inline-flex h-8 items-center px-3.5 text-xs font-medium transition-colors duration-200'
              >
                {copy.signIn}
              </a>
            </div>

            {/* Mobile: compact actions + hamburger */}
            <div className='flex shrink-0 items-center gap-2 lg:hidden'>
              {/*
                The sidebar's built-in language switch is disabled in
                `docs-shell.tsx`, so this is the only language control
                below `lg` — the desktop block renders its own.
              */}
              <LanguageSelect
                className='Uter-brand-radius size-9'
                aria-label={copy.chooseLanguage}
              >
                <Languages className='size-[1.2rem]' />
              </LanguageSelect>
              <DocsThemeToggle label={copy.toggleTheme} />
              <button
                type='button'
                onClick={() => setMobileOpen((v) => !v)}
                aria-label={copy.toggleMenu}
                aria-expanded={mobileOpen}
                className='Uter-brand-radius inline-flex size-9 items-center justify-center text-fd-foreground transition-colors duration-200 hover:bg-fd-accent'
              >
                <div className='relative size-4'>
                  <span
                    className={cx(
                      'absolute inset-x-0 block h-[1.5px] origin-center rounded-full bg-current transition-all duration-300',
                      mobileOpen ? 'top-[7px] rotate-45' : 'top-[3px]'
                    )}
                  />
                  <span
                    className={cx(
                      'absolute inset-x-0 top-[7px] block h-[1.5px] rounded-full bg-current transition-all duration-300',
                      mobileOpen ? 'scale-x-0 opacity-0' : 'opacity-100'
                    )}
                  />
                  <span
                    className={cx(
                      'absolute inset-x-0 block h-[1.5px] origin-center rounded-full bg-current transition-all duration-300',
                      mobileOpen ? 'top-[7px] -rotate-45' : 'top-[11px]'
                    )}
                  />
                </div>
              </button>
            </div>
          </nav>
        </div>
      </header>

      {/* Mobile full-screen overlay */}
      <div
        className={cx(
          'bg-fd-background/98 fixed inset-0 z-40 backdrop-blur-2xl transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] lg:pointer-events-none lg:hidden',
          mobileOpen
            ? 'pointer-events-auto opacity-100'
            : 'pointer-events-none opacity-0'
        )}
      >
        <div className='flex h-full flex-col justify-between px-8 pt-20 pb-10'>
          <nav className='flex flex-col gap-1'>
            {links.map((link, i) => (
              <a
                key={`${link.title}:${link.href}`}
                href={link.href}
                target={HOST_APP_LINK_TARGET}
                onClick={() => setMobileOpen(false)}
                className={cx(
                  'flex items-center gap-3 py-3 text-base font-medium tracking-tight transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]',
                  mobileOpen
                    ? 'translate-y-0 opacity-100'
                    : 'translate-y-4 opacity-0',
                  isActive(link.href)
                    ? 'text-fd-foreground'
                    : 'text-fd-muted-foreground'
                )}
                style={{
                  transitionDelay: mobileOpen ? `${100 + i * 50}ms` : '0ms',
                }}
              >
                {link.title}
              </a>
            ))}
          </nav>

          <div
            className={cx(
              'flex flex-col gap-3 transition-all duration-500',
              mobileOpen
                ? 'translate-y-0 opacity-100'
                : 'translate-y-4 opacity-0'
            )}
            style={{ transitionDelay: mobileOpen ? '250ms' : '0ms' }}
          >
            <a
              href='/sign-in'
              target={HOST_APP_LINK_TARGET}
              onClick={() => setMobileOpen(false)}
              className='Uter-brand-radius bg-fd-foreground text-fd-background inline-flex h-10 items-center justify-center text-sm font-medium transition-opacity hover:opacity-90 active:opacity-80'
            >
              {copy.signIn}
            </a>
          </div>
        </div>
      </div>
    </>
  );
}
