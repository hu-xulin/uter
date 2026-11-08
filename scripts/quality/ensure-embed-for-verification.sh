#!/usr/bin/env bash
# ensure-embed-for-verification.sh — 把 //go:embed 所需的产物恢复到一个
# 「可编译且断言可通过」的状态，供验证器作为 precondition 调用。
#
# 为什么需要它（真实缺陷，不是为了方便验收）：
#
# web/dist 是 **两个** 独立工程共享的输出目录：
#   - web/      → rsbuild 生成 SPA 外壳，每次构建都会清空 dist
#   - docs-web/ → Next 静态导出，postbuild 把 out/ 拷进 dist/docs-content
#
# 因此任何一次 web 构建都会删掉文档站产物。catalogue 里 web-build 与
# docs-web-build 相邻时可以靠顺序规避，但后续任何目标（verify-all 内部的
# build:check、uter-quality-test、coverage-gate）只要再触发一次 web 构建，
# docs-content 就又空了。此时：
#   - go:embed 仍能编译（空目录 + 骨架文件满足模式）
#   - 但 main_docs_test.go 的两个用例会 FAIL，因为它们断言的是**真实**导出
# 这是一个真实的构建顺序缺口，不是测试过严——那两个测试是发布链路的防线。
#
# 与 ensure-go-embed-artifacts.sh 的分工：
#   - 那个脚本补**空骨架**，只保证编译（go vet 够用），绝不覆盖真实产物
#   - 本脚本在骨架之上，若能拿到真实文档导出就**恢复**它
#
# 恢复策略（由快到慢，绝不重新构建除非必须）：
#   1. docs-content 已有真实落地页 → 什么都不做
#   2. docs-web/out 存在 → 重新拷贝（秒级，无需 30 秒的 next build）
#   3. 两者都没有 → 退出 3，明确报告「文档站从未构建」
#
# 退出码：0 = embed 产物可编译且文档站真实可用；3 = 需要先构建 docs-web
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT" || exit 1

DIST="$ROOT/web/dist"
DOCS="$DIST/docs-content"
LANDING="$DOCS/docs/zh/index.html"
OUT="$ROOT/docs-web/out"

# 第一步：保证编译可解析（缺失才补骨架，已有产物不动）
"$ROOT/scripts/quality/ensure-go-embed-artifacts.sh" >/dev/null

# 第二步：判断文档站是否真实可用。判据与 scripts/verify-docs-artifacts.sh
# 和 main_docs_test.go 保持一致：落地页存在且大于 1KB。
docs_ok() {
  [ -s "$LANDING" ] && [ "$(wc -c < "$LANDING")" -gt 1024 ]
}

if docs_ok; then
  echo "embed precondition OK: SPA shell + real docs export present"
  exit 0
fi

# 第三步：有 out/ 就直接重拷，比重新 next build 快两个数量级
if [ -d "$OUT" ]; then
  rm -rf "$DOCS"
  mkdir -p "$DOCS"
  cp -R "$OUT"/. "$DOCS"/
  if docs_ok; then
    echo "embed precondition OK: docs export restored from docs-web/out (no rebuild needed)"
    exit 0
  fi
  echo "restored docs-content from docs-web/out but the landing page is still missing or truncated" >&2
  echo "rebuild the docs site: (cd docs-web && bun run build)" >&2
  exit 3
fi

echo "web/dist/docs-content has no real docs export and docs-web/out does not exist." >&2
echo "the docs site has never been built in this worktree. Build it first:" >&2
echo "  (cd docs-web && bun install && bun run build)" >&2
echo "Without it, //go:embed compiles but /docs is blank and main_docs_test.go fails by design." >&2
exit 3