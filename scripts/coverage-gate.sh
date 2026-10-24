#!/usr/bin/env bash
#
# 覆盖率门禁：按包检查语句覆盖率，跌破阈值即失败（F-15）。
#
# 为什么不是「总覆盖率一个数字」：总覆盖率会被体量大的低风险包稀释，
# 资金、权限相关的包即使掉十几个点，总量也可能几乎不动。这里对关键包
# 逐个设阈值，把「这批测试被削弱」直接变成 CI 红灯。
#
# 阈值取当前基线往下留 2 个点左右，避免正常重构（删掉一段被测代码、
# 新增少量未覆盖分支）造成误报，同时仍能挡住成批删除测试。
#
# 用法：
#   scripts/coverage-gate.sh <coverage.out> <module-path> <pkg-suffix>=<min-percent> ...
#
# 示例：
#   scripts/coverage-gate.sh coverage.out github.com/uter-ai/uter \
#     controller=39 model=45 service=43
set -euo pipefail

if [ "$#" -lt 3 ]; then
  echo "usage: $0 <coverage-profile> <module-path> <pkg-suffix>=<min-percent> ..." >&2
  exit 2
fi

profile=$1
module=$2
shift 2

if [ ! -s "$profile" ]; then
  echo "覆盖率文件不存在或为空：$profile" >&2
  exit 2
fi

# coverprofile 每行格式：<file>:<start>,<end> <num-statements> <count>
# 按目录（即包）聚合语句数与命中语句数。
report=$(awk -v module="$module" '
  NR > 1 {
    split($1, loc, ":")
    file = loc[1]
    count = split(file, parts, "/")
    pkg = ""
    for (i = 1; i < count; i++) pkg = pkg (i > 1 ? "/" : "") parts[i]
    if (index(pkg, module) != 1) next
    suffix = substr(pkg, length(module) + 2)
    if (suffix == "") next
    stmts = $2
    total[suffix] += stmts
    if ($3 + 0 > 0) covered[suffix] += stmts
  }
  END {
    for (pkg in total) {
      if (total[pkg] > 0) printf "%s %.1f %d\n", pkg, covered[pkg] * 100 / total[pkg], total[pkg]
    }
  }
' "$profile")

failed=0
# 先复制到数组：下面不能改动 "$@"，否则循环会在中途被 set -- 破坏。
specs=("$@")
for spec in "${specs[@]}"; do
  pkg=${spec%%=*}
  min=${spec##*=}
  actual=$(printf '%s\n' "$report" | awk -v p="$pkg" '$1 == p { print $2; exit }')
  if [ -z "$actual" ]; then
    echo "✗ ${pkg}：覆盖率文件中没有该包的语句，无法校验阈值"
    failed=1
    continue
  fi
  # awk 输出保留一位小数；截断取整后再比较，避免依赖 bc。
  actual_int=${actual%.*}
  if [ "$actual_int" -lt "$min" ]; then
    echo "✗ ${pkg}：覆盖率 ${actual}% 低于阈值 ${min}%"
    failed=1
  else
    echo "✓ ${pkg}：覆盖率 ${actual}%（阈值 ${min}%）"
  fi
done

if [ "$failed" -ne 0 ]; then
  echo ""
  echo "覆盖率门禁未通过。若为有意的重构，请同步调整 .github/workflows/ci.yml 中的阈值并说明原因。"
  exit 1
fi

echo ""
echo "覆盖率门禁通过。"
