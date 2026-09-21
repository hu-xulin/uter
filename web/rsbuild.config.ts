import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { defineConfig, loadEnv } from '@rsbuild/core'
import { pluginReact } from '@rsbuild/plugin-react'
import { pluginTailwindcss } from '@rsbuild/plugin-tailwindcss'
import { tanstackRouter } from '@tanstack/router-plugin/rspack'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig(({ envMode }) => {
  const env = loadEnv({ mode: envMode, prefixes: ['VITE_'] })
  const serverUrl =
    process.env.VITE_REACT_APP_SERVER_URL ||
    env.rawPublicVars.VITE_REACT_APP_SERVER_URL ||
    'http://localhost:3000'

  const isProd = envMode === 'production'
  const devProxy = Object.fromEntries(
    (['/api', '/v1', '/mj', '/pg'] as const).map((key) => [
      key,
      { target: serverUrl, changeOrigin: true },
    ])
  ) as Record<string, { target: string; changeOrigin: boolean }>

  // Forward the statically exported pages to the Go backend (port 3000),
  // which embeds them at `web/dist/docs/`. There are two sections —
  // `/docs/<lang>/*` and `/about/<lang>/*` — and both are proxied one
  // prefix per locale. The bare `/docs` and `/about` entries are
  // deliberately *not* proxied: those are the SPA's own routes, which
  // choose the locale from the UI language and frame the export. Override
  // `NEXT_DOCS_PORT` to point at the Next.js dev server for live HMR
  // against the source.
  //
  // `/_next/*` is proxied too: the exported HTML references its CSS/JS
  // assets at `/_next/static/...` (Next.js's default asset prefix).
  // Without the proxy, rsbuild serves `index.html` for those paths
  // and the page renders without styles.
  //
  // `/search-index.json` is proxied for the same reason and one more:
  // it is not an asset the HTML references but a file the search box
  // fetches at runtime, from both sections. Unproxied, the dev server
  // answers it from its history fallback with `index.html` and a 200, so
  // the fetch succeeds, `response.json()` throws, and the search
  // silently falls back to an empty index — every query returns nothing,
  // with no visible error.
  const docsProxyPort = process.env.NEXT_DOCS_PORT || '3000'
  const docsTarget = `http://localhost:${docsProxyPort}`
  const staticLocales = ['zh', 'en']
  const staticPrefixes = [
    ...staticLocales.map((locale) => `/docs/${locale}`),
    ...staticLocales.map((locale) => `/about/${locale}`),
    // Files the docs export serves from its root rather than from a
    // localised section — the profile's portrait, the partner logo wall,
    // and the user guide's screenshots (which sit under
    // `public/user-guide/<locale>/<slug>/`). Unproxied, dev answers with
    // `index.html` and the image silently 404s as HTML.
    '/about-assets',
    '/img/partners',
    '/user-guide',
    '/apps-assets',
    '/_next',
    '/search-index.json',
  ]
  // The Next dev server hydrates the page only after its HMR websocket
  // (`ws://<origin>/_next/hmr`) is connected. The generic `/_next` proxy
  // above forwards plain HTTP but not the `Upgrade` handshake, so the
  // socket hangs forever: the proxied docs page loads and renders with no
  // console error — and never hydrates, leaving every sidebar toggle dead.
  // `ws: true` makes the dev server forward the upgrade. Must be declared
  // before `/_next` so the more specific path matches first.
  devProxy['/_next/hmr'] = {
    target: docsTarget.replace('http', 'ws'),
    ws: true,
    changeOrigin: true,
  }
  for (const prefix of staticPrefixes) {
    devProxy[prefix] = {
      target: docsTarget,
      changeOrigin: true,
    }
  }

  return {
    plugins: [pluginReact(), pluginTailwindcss({ optimize: false })],
    // Rsbuild 2: replaces deprecated `performance.chunkSplit` (RSPack 2 aligned)
    splitChunks: {
      preset: 'default',
      cacheGroups: {
        'vendor-react': {
          test: /node_modules[\\/](react|react-dom)[\\/]/,
          name: 'vendor-react',
          chunks: 'all',
          priority: 0,
          enforce: true,
        },
        'vendor-ui-primitives': {
          test: /node_modules[\\/](@base-ui|@radix-ui)[\\/]/,
          name: 'vendor-ui-primitives',
          chunks: 'all',
          priority: 0,
          enforce: true,
        },
        'vendor-tanstack': {
          test: /node_modules[\\/]@tanstack[\\/]/,
          name: 'vendor-tanstack',
          chunks: 'all',
          priority: 0,
          enforce: true,
        },
      },
    },
    source: {
      entry: {
        index: './src/main.tsx',
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        // 强制单一 React 副本：devDependencies 里 use-stick-to-bottom 等包被 pnpm
        // 解析到 react@19.3.0 的独立副本，与应用的 react@19.2.7 冲突，
        // 导致 hooks dispatcher 错配（useRef null / Invalid hook call）。
        // 这里把所有 react/react-dom 的导入（含 jsx-runtime 子路径）统一指向顶层那份。
        react: path.resolve(__dirname, './node_modules/react'),
        'react/jsx-runtime': path.resolve(
          __dirname,
          './node_modules/react/jsx-runtime'
        ),
        'react/jsx-dev-runtime': path.resolve(
          __dirname,
          './node_modules/react/jsx-dev-runtime'
        ),
        'react-dom': path.resolve(__dirname, './node_modules/react-dom'),
        'react-dom/client': path.resolve(
          __dirname,
          './node_modules/react-dom/client'
        ),
      },
    },
    html: {
      template: './index.html',
    },
    server: {
      host: '0.0.0.0',
      strictPort: false,
      proxy: devProxy,
    },
    output: {
      // Production optimizations
      minify: isProd,
      target: 'web',
      distPath: {
        root: 'dist',
      },
      // Rely on Rsbuild default legalComments ("linked" → per-chunk *.LICENSE.txt) in all modes.
      // Do not set "none" in production: that strips minifier-preserved third-party notices and
      // extracted license files, which some distributions require for open-source compliance.
    },
    performance: {
      // Remove console in production
      removeConsole: isProd ? ['log'] : false,
      buildCache: false,
    },
    tools: {
      rspack: {
        plugins: [
          tanstackRouter({
            target: 'react',
            // Dev: avoid per-route async chunks (reduces white flash on navigation + faster HMR feedback).
            // Prod: keep route-based code splitting.
            autoCodeSplitting: isProd,
          }),
        ],
      },
    },
  }
})
