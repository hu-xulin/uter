#!/usr/bin/env bash
#
# git-sync.sh — 一键暂存(已跟踪改动) → 提交 → 推送到 upstream
#
# 设计原则（针对本仓库的已知坑）：
#   1. 默认只 git add -u：仅纳入「已跟踪文件」的修改/删除，绝不自动添加未跟踪文件。
#      新文件 / 密钥 / 大目录必须你先手动 `git add <路径>` 后再跑本脚本，避免误提交。
#   2. 提交前检测「陈旧 index 陷阱」：若索引里已有非本次的已暂存改动（历史会话里
#      git add 过未提交的内容），脚本中止并提示，绝不会把它们偷偷卷进本次提交。
#      确有把握时用 --force 跳过该检查。
#   3. .env 等被 .gitignore 忽略的文件不会被提交（git add -u 本就不碰未跟踪项）。
#
# 用法：
#   ./scripts/git-sync.sh                 # 自动生成提交信息（真正一键）
#   ./scripts/git-sync.sh -m "说明"       # 指定提交信息
#   ./scripts/git-sync.sh --all -m "..."  # 额外把未跟踪文件也纳入（危险，需谨慎）
#   ./scripts/git-sync.sh --force         # 忽略陈旧 index 检查
#   ./scripts/git-sync.sh --dry           # 只预览将要提交的内容，不提交不推送
#
set -euo pipefail

MSG=""
AUTO_MSG=0
FORCE=0
ALL=0
DRY=0

while [ $# -gt 0 ]; do
  case "$1" in
    -m|--message) MSG="$2"; shift 2 ;;
    --auto)       AUTO_MSG=1; shift ;;
    -f|--force)   FORCE=1; shift ;;
    --all)        ALL=1; shift ;;
    --dry)        DRY=1; shift ;;
    -h|--help)
      grep '^#' "$0" | sed 's/^#\{1,2\} //' | sed '/^git-sync.sh/d'
      exit 0 ;;
    *) echo "未知参数: $1（用 -h 查看用法）" >&2; exit 1 ;;
  esac
done

# 切到仓库根目录，避免相对路径问题
cd "$(git rev-parse --show-toplevel)"

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
UPSTREAM="$(git rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>/dev/null || echo "")"

echo "▶ 仓库: $(pwd)  分支: $BRANCH  上游: ${UPSTREAM:-<无>}"

# 1) 陈旧 index 检查（--force 可跳过）
STAGED_BEFORE="$(git diff --cached --name-only)"
if [ -n "$STAGED_BEFORE" ] && [ "$FORCE" -ne 1 ]; then
  echo "⚠️ 索引中已有已暂存改动（疑似历史会话遗留的陈旧 index，本仓库已知陷阱）：" >&2
  echo "$STAGED_BEFORE" >&2
  echo "请先审查：git reset（取消暂存）或 git commit 单独处理；确有把握再 --force。" >&2
  exit 1
fi

# 2) 暂存
if [ "$ALL" -eq 1 ]; then
  echo "⚠️ --all：将把未跟踪文件也纳入（含可能的大目录/密钥），请确认无误。"
  git add -A
else
  git add -u
fi

TO_COMMIT="$(git diff --cached --name-only)"
if [ -z "$TO_COMMIT" ]; then
  echo "✅ 没有已跟踪的改动需要提交。若需纳入新文件，请先 git add <文件> 再跑本脚本。"
  exit 0
fi

echo "待提交文件（$(echo "$TO_COMMIT" | wc -l | tr -d ' ') 个）："
echo "$TO_COMMIT" | sed 's/^/   /'

if [ "$DRY" -eq 1 ]; then
  echo "🔍 --dry：仅预览，未提交/未推送。"
  git diff --cached --stat
  exit 0
fi

# 3) 提交信息
if [ -z "$MSG" ]; then
  if [ "$AUTO_MSG" -eq 1 ] || true; then
    COUNT="$(echo "$TO_COMMIT" | wc -l | tr -d ' ')"
    DIRS="$(echo "$TO_COMMIT" | sed 's#/.*##' | sort -u | tr '\n' ',' | sed 's/,$//')"
    MSG="chore(sync): ${COUNT} files [${DIRS}] $(date +%Y-%m-%d)"
  fi
fi

# 4) 提交
git commit -m "$MSG"
echo "✅ 已提交: $(git rev-parse --short HEAD)  $MSG"

# 5) 推送
if [ -z "$UPSTREAM" ]; then
  echo "当前分支 $BRANCH 无 upstream，执行 git push -u origin $BRANCH"
  git push -u origin "$BRANCH"
else
  git push
fi

echo "🎉 已推送到 $(git rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>/dev/null || echo "$BRANCH")"
