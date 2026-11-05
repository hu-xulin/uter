#!/usr/bin/env bash
#
# ai-specs-check.sh — AI 规范体系完整性检查（UEQE review.ai-specs 子项）
#
# 程序化守护 AGENTS.md「AI Spec System」节的物质量：
#   1. docs/ai-specs/ 10 份域规范在库、非空、含规范骨架（规范目标/完成定义）。
#   2. docs/ai-specs/engineering-quality/ 4 份质量规范 + README 在库。
#   3. engineering-quality 规范与 _reports/ 原件逐字节一致（原件存在时）。
#   4. AGENTS.md 含规范入口节（AI Spec System / Task routing / Branch strategy）。
#   5. AGENTS.md 引用的 docs/ai-specs/... 路径全部真实存在。
#   6. CONFLICT-REPORT.md 在库且被 AGENTS.md 引用。
#   7. 十份域规范均登记版本、状态、更新时间与维护责任。
#   8. .ai/README.md 不得引用已废弃的 design-system.md 路径。
#   9. ADR 目录、索引和至少一份已批准决策记录存在。
#
# 退出码：0=全部通过；1=存在缺失/篡改。由 scripts/quality/uter-quality.sh 调用。

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SPECS="$ROOT/docs/ai-specs"
EQ="$SPECS/engineering-quality"
AGENTS="$ROOT/AGENTS.md"

errors=0
fail() { echo "✘ $1"; errors=$((errors+1)); }

# ── 1. 十份域规范 ─────────────────────────────────────────────────────
DOMAIN_SPECS="AI-EXECUTION PRODUCT-REQUIREMENTS ARCHITECTURE DEVELOPMENT \
API-CONTRACT DATABASE SECURITY UX-INTERACTION DOCUMENTATION CHANGE-MANAGEMENT"
for s in $DOMAIN_SPECS; do
  f="$SPECS/$s-STANDARD.md"
  if [ ! -s "$f" ]; then
    fail "域规范缺失或为空：$f"
    continue
  fi
  grep -q '^## 1\. 规范目标' "$f" || fail "$s-STANDARD.md 缺少「规范目标」节（可能被截断/改写）"
  grep -q '完成定义' "$f" || fail "$s-STANDARD.md 缺少「完成定义」节（可能被截断/改写）"
  grep -Fq '**规范版本：**' "$f" || fail "$s-STANDARD.md 缺少规范版本"
  grep -Fq '**规范状态：** Active' "$f" || fail "$s-STANDARD.md 缺少 Active 状态"
  grep -Fq '**最后更新：**' "$f" || fail "$s-STANDARD.md 缺少最后更新时间"
  grep -Fq '**维护责任：**' "$f" || fail "$s-STANDARD.md 缺少维护责任人"
done

# ── 2. engineering-quality 组 ────────────────────────────────────────
for s in CODE-REVIEW-STANDARD AUTOMATED-TEST-STANDARD AUTO-FIX-STANDARD QUALITY-GATE-STANDARD; do
  [ -s "$EQ/$s.md" ] || fail "工程质量规范缺失：$EQ/$s.md"
done
[ -s "$EQ/README.md" ] || fail "工程质量组入口缺失：$EQ/README.md"

# ── 3. 与 _reports 原件一致性（原件被清理时跳过，不算失败）──────────
declare -a EQ_MAP=(
  "CODE-REVIEW-STANDARD.md|Uter 全面代码审查与修复规范.md"
  "AUTOMATED-TEST-STANDARD.md|Uter 全面自动化测试与问题修复规范.md"
  "AUTO-FIX-STANDARD.md|Uter AI Auto-Fix Standard.md"
  "QUALITY-GATE-STANDARD.md|Uter Engineering Quality Gate Standard.md"
)
for pair in "${EQ_MAP[@]}"; do
  eq_name="${pair%%|*}"; src_name="${pair#*|}"
  src="$ROOT/_reports/$src_name"
  [ -s "$src" ] || continue
  if ! diff -q "$src" "$EQ/$eq_name" >/dev/null 2>&1; then
    fail "工程质量规范与 _reports 原件不一致：$eq_name"
  fi
done

# ── 4. AGENTS.md 入口节 ──────────────────────────────────────────────
for marker in '## AI Spec System' '### Task routing' '### Branch strategy' '### Automated enforcement' 'CONFLICT-REPORT.md'; do
  grep -q "$marker" "$AGENTS" || fail "AGENTS.md 缺少入口节/引用：$marker"
done

# ── 5. AGENTS.md 引用的 docs/ai-specs 路径必须真实存在 ───────────────
for p in $(grep -o 'docs/ai-specs/[A-Za-z0-9_./-]*' "$AGENTS" | sort -u); do
  case "$p" in
    */) continue ;;  # 目录引用跳过
  esac
  [ -e "$ROOT/$p" ] || fail "AGENTS.md 引用了不存在的路径：$p"
done

# ── 6. 冲突报告与知识引用 ────────────────────────────────────────────
[ -s "$SPECS/CONFLICT-REPORT.md" ] || fail "冲突检查报告缺失：$SPECS/CONFLICT-REPORT.md"
AI_README="$ROOT/.ai/README.md"
if grep -Fq '`design-system.md`' "$AI_README"; then
  fail ".ai/README.md 仍引用已废弃的 design-system.md 路径"
fi

# ── 7. ADR 注册与决策记录 ────────────────────────────────────────────
ADR_DIR="$ROOT/docs/adr"
[ -s "$ADR_DIR/README.md" ] || fail "ADR 注册索引缺失：docs/adr/README.md"
[ -s "$ADR_DIR/0001-uter-design-system-single-source-of-truth.md" ] || fail "ADR-0001 缺失"
if [ -s "$ADR_DIR/0001-uter-design-system-single-source-of-truth.md" ]; then
  grep -q '^status: Accepted

if [ "$errors" -gt 0 ]; then
  echo "ai-specs-check: $errors 项不通过"
  exit 1
fi
echo "ai-specs-check: 通过（10 域规范 + 4 质量规范 + 入口节 + 引用完整性）"
 "$ADR_DIR/0001-uter-design-system-single-source-of-truth.md" || fail "ADR-0001 未标记 Accepted"
fi

if [ "$errors" -gt 0 ]; then
  echo "ai-specs-check: $errors 项不通过"
  exit 1
fi
echo "ai-specs-check: 通过（10 域规范 + 4 质量规范 + 入口节 + 引用完整性）"
