/*
 * Copyright (C) 2023-2026 Uter.ai
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 *
 * For commercial licensing, please contact support@uter.ai
 */
/**
 * 把「设计令牌门禁」片段**追加**到 `.git/hooks/pre-commit`。
 *
 * ## 为什么是「追加」而不是设置 `core.hooksPath`
 *
 * 仓库已经有一套**身份守卫**钩子（`.git/hooks/pre-commit` 与 `pre-push`），
 * 由 git 的 `init.templateDir` 下发到每个新 clone，用来拒绝已退役的
 * 「yunhoon」身份。它们是「永不退回 yunhoon」三层防护里的两层。
 *
 * 一旦设置 `core.hooksPath`，git 就**只**认那个目录 —— `.git/hooks/pre-push`
 * 会被整体忽略，等于静默拆掉一层身份防护。所以本脚本**不动** `core.hooksPath`，
 * 改为把门禁片段追加进已有的 `pre-commit`，让身份守卫先跑、设计门禁后跑。
 *
 * ## 为什么要插在末尾 `exit 0` **之前**
 *
 * 身份守卫脚本以 `exit 0` 收尾。若把片段追加到文件末尾，它就是**死代码** ——
 * 永远执行不到。因此插入点取「最后一个顶层 `exit 0` 之前」；文件里没有
 * `exit 0` 时才追加到末尾。
 *
 * ## 幂等
 *
 * 片段带 `# >>> uter design-token gate >>>` 标记。已存在则跳过，重复运行
 * （`bun install` 的 prepare 每次都会调本脚本）不会重复追加。
 */
import { execFileSync } from 'node:child_process'
import { chmodSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const MARKER = '# >>> uter design-token gate >>>'

/** 门禁片段（随仓库提交，保证团队拿到同一份逻辑）。 */
const SNIPPET_PATH = fileURLToPath(
  new URL('./hooks/design-token-gate.sh', import.meta.url)
)

function gitRoot() {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return null
  }
}

const root = gitRoot()
if (!root) {
  console.log('· 非 Git 仓库，跳过本地门禁安装（CI 门禁仍然生效）。')
  process.exit(0)
}

const hookPath = join(root, '.git', 'hooks', 'pre-commit')
const snippet = readFileSync(SNIPPET_PATH, 'utf8').trimEnd()

if (!existsSync(hookPath)) {
  // 全新 clone 且没有 template 下发的钩子：只装设计门禁。
  writeFileSync(hookPath, `#!/bin/sh\n${snippet}\n`)
  chmodSync(hookPath, 0o755)
  console.log('✓ 未发现既有 pre-commit，已创建并写入设计令牌门禁。')
  process.exit(0)
}

const existing = readFileSync(hookPath, 'utf8')

if (existing.includes(MARKER)) {
  console.log('· 设计令牌门禁已在 .git/hooks/pre-commit 中，无需重复安装。')
  process.exit(0)
}

const lines = existing.split('\n')

/**
 * 插入点：`set -u` 之后（没有则退到 shebang 之后）。
 *
 * ⚠️ 必须是**身份守卫之前**，不能追加到末尾：身份守卫里
 * `case "$origin" in … *) exit 0 ;; esac` 的 `*)` 分支带一个 `exit 0` ——
 * 非公司仓库（origin 不匹配 uter-ai / panda-mall）在那里就**结束整个钩子**，
 * 排在它之后的片段就成了永远执行不到的死代码（这正是第一版接法的缺陷：
 * 门禁看着装上了，实际从不生效）。
 *
 * 顺序上把设计门禁放在身份守卫之前是有意的：身份违规的提交会先报设计
 * 问题，但两层都会各自拦下，不会漏。
 */
let insertAt = lines.findIndex((l) => l.trim() === 'set -u')
if (insertAt >= 0) {
  insertAt += 1
} else {
  const shebang = lines.findIndex((l) => l.trim().startsWith('#!'))
  insertAt = shebang >= 0 ? shebang + 1 : 0
}

const merged = [
  ...lines.slice(0, insertAt),
  ...snippet.split('\n'),
  ...lines.slice(insertAt),
].join('\n')

writeFileSync(hookPath, merged)
chmodSync(hookPath, 0o755)
console.log(
  '✓ 设计令牌门禁已追加到 .git/hooks/pre-commit（身份守卫保留在前）。'
)
