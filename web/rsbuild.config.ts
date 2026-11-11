import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { defineConfig, loadEnv } from '@rsbuild/core'
import { pluginMdx } from '@rsbuild/plugin-mdx'
import { pluginReact } from '@rsbuild/plugin-react'
import { pluginTailwindcss } from '@rsbuild/plugin-tailwindcss'
import { tanstackRouter } from '@tanstack/router-plugin/rspack'
import rehypeSlug from 'rehype-slug'
import remarkGfm from 'remark-gfm'

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
  ) as Record<string, { target: string; changeOrigin: boolean; ws?: boolean }>

  // Docs are native SPA routes now: MDX lives in `src/docs-content/**` and
  // its static assets (7 search indexes, user-guide screenshots, apps-assets,
  // …) live under `web/public` at their root paths. rsbuild's dev server
  // serves `public/` directly, so there is no second static site, no
  // `/docs-content` mount and therefore no docs proxy entries here. Only the
  // API prefixes need forwarding to the Go backend.
  //
  // Keep this comment if you are tempted to re-add `/docs-content` proxies:
  // the retired Next.js export used that prefix; a stale proxy now would
  // shadow real root-level assets such as `/docs-search/zh.json`.

  return {
    plugins: [
      pluginReact(),
      // Native docs pipeline: compile `src/docs-content/**/*.mdx` — authored
      // with `<Callout>` directives and GFM tables — into lazy React
      // components so the docs render as ordinary SPA routes, with no iframe
      // and no second static site. `remark-gfm` is required for the GFM
      // tables the docs use.
      pluginMdx({
        mdxLoaderOptions: {
          remarkPlugins: [remarkGfm],
          // Anchor every h2/h3 so the native docs' table of contents (built
          // from the rendered DOM in `native-docs-view.tsx`) has stable
          // fragments to point at.
          rehypePlugins: [rehypeSlug],
        },
      }),
      pluginTailwindcss({ optimize: false }),
    ],
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
        // zod is imported by 60+ modules (forms, schemas, feature types) across
        // both the eager app graph and every async route, so it is a prime
        // candidate for a single hoisted vendor chunk: dedupes it across all
        // route chunks and keeps it in a long-lived cache that changes far less
        // often than application code.
        'vendor-zod': {
          test: /node_modules[\\/]zod[\\/]/,
          name: 'vendor-zod',
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
      // Bulk-copying `public/` through Node's fs.cp trips the sandboxed
      // bulk-delete guard in restricted environments (it unlinks each
      // destination file before copying). Setting this flag lets the caller
      // skip that copy and place `public/` into `dist/` itself.
      ...(process.env.UTER_SKIP_PUBLIC_COPY === '1'
        ? { publicDir: false }
        : {}),
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
      rspack: (config) => {
        config.plugins = config.plugins || []
        config.plugins.push(
          tanstackRouter({
            target: 'react',
            // Dev: avoid per-route async chunks (reduces white flash on navigation + faster HMR feedback).
            // Prod: keep route-based code splitting.
            autoCodeSplitting: isProd,
          })
        )
        return config
      },
    },
  }
})
