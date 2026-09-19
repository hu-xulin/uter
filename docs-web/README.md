# URouters Docs

Next.js + Fumadocs landing page that mirrors the style of
[docs.newapi.pro/docs/zh](https://docs.newapi.pro/docs/zh). The page
sits at `/docs/zh/` and is the target of every "View documentation"
link in the SPA dashboard.

## Stack

- **Next.js 16** App Router with `output: 'export'` — fully static
- **Fumadocs UI** for the design tokens (`fd-*` CSS variables) and the
  theme toggles
- **Tailwind CSS v4** via `@tailwindcss/postcss`
- **Bun** as the package manager

## Development

```bash
bun install
bun run dev           # starts on http://localhost:3100
```

The dev server runs on port 3100 to avoid clashing with the SPA's
dev server on 3000.

## Production build

```bash
bun run build
```

`next build` produces `docs-web/out/`, then `scripts/copy-to-web.mjs`
copies it into `web/dist/docs/`. The Go backend serves that directory
at the URL root.

## URL layout

| User-facing URL              | Served by                                |
| ---------------------------- | ---------------------------------------- |
| `/docs/zh/`                  | Next.js static — quickstart landing page |
| `/docs/zh/_next/...`         | Next.js static chunks                    |
| `/docs/zh/img/partners/...`  | Static asset from `public/`              |

The Go router mounts `web/dist/docs/` at the root with fallthrough to
the SPA, so `/docs/zh/` resolves to the docs landing while `/dashboard`
still hits the React app.