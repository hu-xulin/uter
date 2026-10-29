# >>> uter design-token gate >>>
# 本地提交门禁 —— 设计令牌合规（规范 §1.1 颜色 / §1.2 字号阶梯 / §1.3 圆角 /
# §1.5 投影 / §1.6 动效节奏）。
#
# 这个片段由 `web/scripts/setup-git-hooks.mjs` **追加**到 `.git/hooks/pre-commit`
# —— 追加而不是覆盖：同一个文件里的身份守卫（`init.templateDir` 下发）必须继续
# 生效，本门禁只在其之后多拦一层「字号/颜色/图标/圆角/投影/动效」违规。
#
# CI 侧是同一把尺子：`.github/workflows/ci.yml` 与 `release-gate.yml` 的 frontend
# job 跑 `bun run lint:design:strict`，有违规即阻断合并。
#
# 只在本次提交涉及 web/ 时运行，避免纯后端提交被无谓打扰。

gate_staged="$(git diff --cached --name-only 2>/dev/null || true)"

if printf '%s\n' "$gate_staged" | grep -q '^web/'; then
  if command -v node >/dev/null 2>&1; then
    gate_runner="node"
  elif command -v bun >/dev/null 2>&1; then
    gate_runner="bun"
  else
    echo "⚠️ 找不到 node / bun，跳过本地设计令牌检查（CI 门禁仍然会拦截）。" >&2
    gate_runner=""
  fi

  if [ -n "$gate_runner" ]; then
    if ! "$gate_runner" web/scripts/check-design-tokens.mjs --strict; then
      echo "" >&2
      echo "✗ 设计令牌不合规，本次提交已阻断。" >&2
      echo "  · 修复方式见检查器输出末尾的说明。" >&2
      echo "  · 确属例外时，在 web/scripts/check-design-tokens.mjs 的 ALLOWLIST 登记，" >&2
      echo "    并写明理由与影响范围（没有理由的例外等于没有规范）。" >&2
      exit 1
    fi
  fi
fi
# <<< uter design-token gate <<<
