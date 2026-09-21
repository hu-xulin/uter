'use client';

import Image from 'next/image';
import { usePathname } from 'fumadocs-core/framework';
import { Languages, Moon, Sun } from 'lucide-react';
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
 * `About`) so both headers read identically.
 *
 * The links are rendered as plain `<a href>` elements so the browser
 * performs a full document navigation — Fumadocs' `<Link>` wrapper
 * would try to client-route inside the docs site and break for
 * cross-app targets.
 */
const NAV_LINKS_ZH = [
  { title: '主页', href: '/' },
  { title: '管理', href: '/dashboard' },
  { title: '定价', href: '/pricing' },
  { title: '排行', href: '/rankings' },
  { title: '查看文档', href: '/docs' },
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

const COPY = {
  zh: {
    brand: 'Uter',
    signIn: '登录',
    toggleMenu: '切换导航菜单',
    toggleTheme: '切换主题',
    chooseLanguage: '选择语言',
  },
  en: {
    brand: 'Uter',
    signIn: 'Sign in',
    toggleMenu: 'Toggle navigation menu',
    toggleTheme: 'Toggle theme',
    chooseLanguage: 'Choose a language',
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
      className='relative inline-flex size-9 items-center justify-center rounded-lg text-fd-muted-foreground transition-colors duration-200 hover:bg-fd-accent hover:text-fd-accent-foreground'
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
      src='/logo.png?v=3'
      alt={copy.brand}
      width={28}
      height={28}
      className='size-full rounded-lg object-contain'
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
              <a href='/' className='group flex min-w-0 items-center gap-2.5'>
                <div className='flex size-7 shrink-0 items-center justify-center transition-all duration-300 group-hover:scale-105'>
                  {logo}
                </div>
                <span
                  className='max-w-48 truncate text-lg tracking-tight'
                  title={copy.brand}
                >
                  {copy.brand}
                </span>
              </a>
            </div>

            {/* Desktop nav */}
            <div className='hidden min-w-0 items-center gap-0.5 lg:flex'>
              {links.map((link) => (
                <a
                  key={`${link.title}:${link.href}`}
                  href={link.href}
                  title={link.title}
                  className={cx(
                    'min-w-0 truncate rounded-lg px-3 py-1.5 text-sm font-medium transition-colors duration-200',
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
                className='size-9'
                aria-label={copy.chooseLanguage}
              >
                <Languages className='size-[1.2rem]' />
              </LanguageSelect>

              <DocsThemeToggle label={copy.toggleTheme} />

              <div className='bg-fd-border/40 mx-1 h-4 w-px' />

              <a
                href='/sign-in'
                className='bg-fd-primary text-fd-primary-foreground inline-flex h-8 items-center rounded-lg px-3.5 text-xs font-medium transition-opacity duration-200 hover:opacity-90'
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
                className='size-9'
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
                className='inline-flex size-9 items-center justify-center rounded-lg text-fd-foreground transition-colors duration-200 hover:bg-fd-accent'
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
              onClick={() => setMobileOpen(false)}
              className='bg-fd-foreground text-fd-background inline-flex h-10 items-center justify-center rounded-lg text-sm font-medium transition-opacity hover:opacity-90 active:opacity-80'
            >
              {copy.signIn}
            </a>
          </div>
        </div>
      </div>
    </>
  );
}
