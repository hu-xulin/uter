#!/usr/bin/env bash
# ensure-embed-for-verification.sh — 把 //go:embed 所需的产物恢复到一个
# 「可编译且断言可通过」的状态，供验证器作为 precondition 调用。
#
# 为什么需要它（真实缺陷，不是为了方便验收）：
#
# `//go:embed web/dist` 对缺失路径是**静默跳过**的。只跑 Go 编译、或只补
# 一个空 index.html 骨架，编译照样成功，但二进制里没有 SPA bundle、没有
# 文档 MDX 的异步 chunk、没有 7 份搜索索引和 user-guide 截图 —— 服务能起，
# /docs 渲染不出正文、搜索空、截图裂图。main_docs_test.go 的真实产物用例
# 正是为此存在，它们会在这种状态下 FAIL。
#
# 文档收敛后 web/dist 只由 `cd web && bun run build` 产出，不再有第二个
# docs-web 静态站往里拷 docs-content。因此恢复策略只有一条：用发布链路
# 共用的 verify-docs-artifacts.sh 校验真实产物，缺了就明确报「前端未构建」，
# 绝不靠拷贝旧导出或造骨架把断言糊过去。
#
# 与 ensure-go-embed-artifacts.sh 的分工：
#   - 那个脚本补**空骨架**，只保证 go vet / go build 能编译，绝不覆盖真实产物
#   - 本脚本在骨架之上进一步要求**真实产物齐备**，否则以 3 退出
#
# 退出码：0 = embed 产物可编译且原生文档静态产物齐备；3 = 需要先构建前端
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT" || exit 1

DIST="$ROOT/web/dist"

# 第一步：保证编译可解析（缺失才补骨架，已有产物不动）
"$ROOT/scripts/quality/ensure-go-embed-artifacts.sh" >/dev/null

# 第二步：判据与发布链路完全一致 —— SPA 外壳非占位、bundle 存在、
# 7 语言搜索索引、明暗主题截图，缺一项都不算「可验证」。
if "$ROOT/scripts/verify-docs-artifacts.sh" "$DIST" >/dev/null 2>&1; then
  echo "embed precondition OK: SPA shell + native docs assets present"
  exit 0
fi

echo "web/dist is a placeholder or an incomplete build; native docs assets are missing." >&2
echo "A real frontend build is required before this verification can run:" >&2
echo "  (cd web && bun install --frozen-lockfile && bun run build)" >&2
echo "scripts/verify-docs-artifacts.sh is the authoritative check; run it for the exact failure." >&2
exit 3
