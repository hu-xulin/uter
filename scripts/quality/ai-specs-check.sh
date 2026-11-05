#!/usr/bin/env bash
#
# ai-specs-check.sh — AI 规范体系完整性检查（UEQE review.ai-specs 子项）
#
# 检查规范清单、版本元数据、Agent 入口、文档引用、ADR 注册和唯一工作分支策略。
# 退出码：0=全部通过；1=存在缺失/不一致。
#
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SPECS="$ROOT/docs/ai-specs"
EQ="$SPECS/engineering-quality"
AGENTS="$ROOT/AGENTS.md"
AI_README="$ROOT/.ai/README.md"
AIES="$ROOT/.ai/AIES.md"
AUTO_FIX="$EQ/AUTO-FIX-STANDARD.md"
EQ_README="$EQ/README.md"
ADR_DIR="$ROOT/docs/adr"

errors=0
fail() {
  printf '✘ %s\n' "$1"
  errors=$((errors + 1))
}
pass() { printf '✔ %s\n' "$1"; }

check_review_date() {
  local file="$1" label="$2" due due_epoch today_epoch
  due="$(sed -n 's/^[*][*]下次复核：[*][*][[:space:]]*//p' "$file" | head -n 1)"
  if [[ ! "$due" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]]; then
    fail "$label 下次复核日期缺失或格式错误：$due"
    return
  fi
  if due_epoch="$(date -d "$due" +%s 2>/dev/null)"; then
    :
  elif due_epoch="$(date -j -f "%Y-%m-%d" "$due" +%s 2>/dev/null)"; then
    :
  else
    fail "$label 无法解析下次复核日期：$due"
    return
  fi
  today_epoch="$(date +%s)"
  [ "$due_epoch" -ge "$today_epoch" ] || fail "$label 知识已过期，须复核后恢复 Active：$due"
}

# 1. Ten domain standards and required metadata.
DOMAIN_SPECS="AI-EXECUTION PRODUCT-REQUIREMENTS ARCHITECTURE DEVELOPMENT API-CONTRACT DATABASE SECURITY UX-INTERACTION DOCUMENTATION CHANGE-MANAGEMENT"
for spec in $DOMAIN_SPECS; do
  file="$SPECS/$spec-STANDARD.md"
  if [ ! -s "$file" ]; then
    fail "域规范缺失或为空：$file"
    continue
  fi
  grep -q '^## 1\. 规范目标' "$file" || fail "$spec-STANDARD.md 缺少规范目标"
  grep -q '完成定义' "$file" || fail "$spec-STANDARD.md 缺少完成定义"
  grep -Fq '**规范版本：**' "$file" || fail "$spec-STANDARD.md 缺少规范版本"
  grep -Fq '**规范状态：** Active' "$file" || fail "$spec-STANDARD.md 缺少 Active 状态"
  grep -Fq '**最后更新：**' "$file" || fail "$spec-STANDARD.md 缺少最后更新时间"
  grep -Fq '**维护责任：**' "$file" || fail "$spec-STANDARD.md 缺少维护责任"
  check_review_date "$file" "$spec-STANDARD.md"
done

# 2. Engineering-quality standards and entry point.
for spec in CODE-REVIEW-STANDARD AUTOMATED-TEST-STANDARD AUTO-FIX-STANDARD QUALITY-GATE-STANDARD; do
  [ -s "$EQ/$spec.md" ] || fail "工程质量规范缺失：$EQ/$spec.md"
done
[ -s "$EQ/README.md" ] || fail "工程质量规范入口缺失：$EQ/README.md"

# 3. Engineering-quality standards must carry the same governance metadata.
for spec in CODE-REVIEW-STANDARD AUTOMATED-TEST-STANDARD AUTO-FIX-STANDARD QUALITY-GATE-STANDARD; do
  file="$EQ/$spec.md"
  [ -s "$file" ] || continue
  grep -Fq '**规范版本：**' "$file" || fail "$spec.md 缺少规范版本"
  grep -Fq '**规范状态：** Active' "$file" || fail "$spec.md 缺少 Active 状态"
  grep -Fq '**最后更新：**' "$file" || fail "$spec.md 缺少最后更新时间"
  grep -Fq '**维护责任：**' "$file" || fail "$spec.md 缺少维护责任"
  check_review_date "$file" "$spec.md"
done

# 4. Required Agent governance entry points.
for marker in '## AI Spec System' '### Task routing' '### Branch strategy' '### Automated enforcement' 'CONFLICT-REPORT.md'; do
  grep -Fq "$marker" "$AGENTS" || fail "AGENTS.md 缺少入口或引用：$marker"
done

# 5. All literal docs/ai-specs paths referenced by AGENTS.md must exist.
while IFS= read -r path; do
  [ -n "$path" ] || continue
  case "$path" in */) continue ;; esac
  [ -e "$ROOT/$path" ] || fail "AGENTS.md 引用了不存在的路径：$path"
done < <(grep -oE 'docs/ai-specs/[A-Za-z0-9_./-]+' "$AGENTS" | sort -u || true)

# 6. No known obsolete design-system references; conflict report must reflect ADR registry.
[ -s "$SPECS/CONFLICT-REPORT.md" ] || fail "冲突报告缺失"
if grep -Fq '`design-system.md`' "$AI_README"; then
  fail ".ai/README.md 仍引用废弃 design-system.md 路径"
fi
if grep -Fq '`design-system.md`' "$AIES"; then
  fail ".ai/AIES.md 仍引用废弃 design-system.md 路径"
fi
if grep -Fq '仓库尚无 `docs/adr/`' "$SPECS/CONFLICT-REPORT.md"; then
  fail "CONFLICT-REPORT.md 的 ADR 状态已过期"
fi

# 7. Single non-main work branch policy must be reflected in governing docs.
grep -Fq '最多一个非' "$AGENTS" || fail "AGENTS.md 未声明每项目最多一个非 main 分支"
grep -Fq '不得创建第二个分支' "$AGENTS" || fail "AGENTS.md 未禁止创建第二个工作分支"
grep -Fq '禁止创建第二分支' "$AUTO_FIX" || fail "AUTO-FIX-STANDARD.md 未执行唯一工作分支策略"
grep -Fq '禁止创建第二分支' "$EQ_README" || fail "工程质量入口未执行唯一工作分支策略"

# 8. ADR registry and accepted decision.
[ -s "$ADR_DIR/README.md" ] || fail "ADR 注册索引缺失"
ADR_FILE="$ADR_DIR/0001-uter-design-system-single-source-of-truth.md"
[ -s "$ADR_FILE" ] || fail "ADR-0001 缺失"
if [ -s "$ADR_FILE" ]; then
  grep -Eq '^status: Accepted$' "$ADR_FILE" || fail "ADR-0001 未标记 Accepted"
  grep -Fq '0001-uter-design-system-single-source-of-truth.md' "$ADR_DIR/README.md" || fail "ADR 索引未登记 ADR-0001"
fi

if [ "$errors" -gt 0 ]; then
  printf 'ai-specs-check: %s 项不通过\n' "$errors"
  exit 1
fi
printf 'ai-specs-check: 通过（10 域规范、4 质量规范、Agent 入口、引用、唯一分支策略、ADR）\n'
