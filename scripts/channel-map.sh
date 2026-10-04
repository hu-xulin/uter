#!/usr/bin/env bash
# channel-map.sh — 上游渠道适配分布查询工具
#
# 数据源:
#   constant/channel.go                # ChannelType 编号(数据库存储)
#   constant/api_type.go               # APIType iota 序列(派发)
#   relay/relay_adaptor.go:50          # GetAdaptor 派发表
#   relay/relay_adaptor.go:141         # taskPluginKeys(任务平台)
#   relay/channel/<brand>/             # 适配器包目录
#
# 用法:
#   ./scripts/channel-map.sh                              # 打印 channel/ 子目录清单
#   ./scripts/channel-map.sh --types                      # ChannelType 编号表
#   ./scripts/channel-map.sh --api-types                  # APIType iota 序列
#   ./scripts/channel-map.sh --adaptor                    # GetAdaptor 派发表
#   ./scripts/channel-map.sh --task                       # taskPluginKeys 映射
#   ./scripts/channel-map.sh --query KEYWORD              # 模糊搜 KEYWORD(名称片段或编号)
#   ./scripts/channel-map.sh --check                      # 与 docs-dev/channel-adaptor-map.md 校验关键编号
#
# 输出风格:ASCII 表格 + 颜色。跨 macOS / Linux,纯 bash + sed + grep(无 jq / gawk 依赖)。

set -uo pipefail

# ───────────────────────── 路径 ─────────────────────────
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CHANNEL_GO="$ROOT_DIR/constant/channel.go"
API_TYPE_GO="$ROOT_DIR/constant/api_type.go"
ADAPTOR_GO="$ROOT_DIR/relay/relay_adaptor.go"
CHANNEL_DIR="$ROOT_DIR/relay/channel"
DOC_MD="$ROOT_DIR/docs-dev/channel-adaptor-map.md"

# ───────────────────────── 颜色 ─────────────────────────
if [[ -t 1 ]] && command -v tput >/dev/null 2>&1 && [[ "$(tput colors 2>/dev/null || echo 0)" -ge 8 ]]; then
  C_BOLD="\033[1m"; C_DIM="\033[2m"; C_RED="\033[31m"; C_GRN="\033[32m"
  C_YEL="\033[33m"; C_BLU="\033[34m"; C_CYN="\033[36m"; C_RST="\033[0m"
else
  C_BOLD=""; C_DIM=""; C_RED=""; C_GRN=""; C_YEL=""; C_BLU=""; C_CYN=""; C_RST=""
fi

# ───────────────────────── 用法 ─────────────────────────
usage() {
  cat <<EOF
${C_BOLD}channel-map.sh${C_RST} — 上游渠道适配分布查询

USAGE:
  $(basename "$0") [OPTIONS]

OPTIONS:
  (no args)        打印 relay/channel/ 子目录清单
  --types          ChannelType 编号表(数据库存储)
  --api-types      APIType iota 序列(GetAdaptor 派发)
  --adaptor        GetAdaptor 实际派发表(relay_adaptor.go:50)
  --task           taskPluginKeys 任务平台映射
  --query KEYWORD  模糊搜 KEYWORD(名称片段或编号;纯数字按编号查)
  --check          与 docs-dev/channel-adaptor-map.md 校验关键编号
  -h, --help       显示本帮助

数据源:${C_DIM}
  $CHANNEL_GO
  $API_TYPE_GO
  $ADAPTOR_GO
  $CHANNEL_DIR/${C_RST}
EOF
}

# ───────────────────────── 数据提取(纯 sed + grep) ─────────────────────────

# ChannelType 编号 → "id\tName"
parse_channel_types() {
  # 抓 "Name = Number" 行(允许前置空白)
  sed -nE 's/^[[:space:]]*(Channel[A-Za-z_][A-Za-z0-9_]*|ChannelType[A-Za-z_][A-Za-z0-9_]*)[[:space:]]*=[[:space:]]*([0-9]+).*/\2\t\1/p' "$CHANNEL_GO" \
    | sort -n
}

# APIType iota 序列 → "idx\tName"
parse_api_types() {
  # iota 从 0 开始,每行单独一个 APITypeXxx
  # 用 awk 计数(macOS BSD awk 兼容);正则在字符类中允许数字
  awk '
    BEGIN { idx = 0 }
    {
      line = $0
      # 去注释
      sub(/\/\/.*$/, "", line)
      # 提取 APITypeXxx(允许后续数字)
      if (match(line, /APIType[A-Z][A-Za-z0-9_]*/)) {
        name = substr(line, RSTART, RLENGTH)
        printf("%d\t%s\n", idx, name)
        idx++
      }
    }
  ' "$API_TYPE_GO"
}

# GetAdaptor case 列表 → "APITypeName\tpkg"
parse_adaptor_dispatch() {
  # case 行跟 return 行是分开的,用 awk 跨行处理
  awk '
    /case[[:space:]]+constant\.APIType/ {
      line = $0
      sub(/\/\/.*$/, "", line)
      if (match(line, /APIType[A-Z][A-Za-z0-9_]+/)) {
        name = substr(line, RSTART, RLENGTH)
        pending = 1
      }
    }
    pending && /return[[:space:]]+&[a-z0-9_.]+[.({]/ {
      rest = $0
      p = index(rest, "&")
      if (p > 0) {
        rest = substr(rest, p + 1)
        # 取到第一个 "." "(" "{" 之前的子串作为包名
        for (i = 1; i <= length(rest); i++) {
          c = substr(rest, i, 1)
          if (c == "." || c == "(" || c == "{") {
            pkg = substr(rest, 1, i - 1)
            break
          }
        }
        printf("%s\t%s\n", name, pkg)
      }
      pending = 0
    }
  ' "$ADAPTOR_GO"
}

# taskPluginKeys 映射 → "Name\tkey"
parse_task_keys() {
  # 两种行格式独立处理:
  #   constant.TaskPlatformSuno: "sunoapi",
  #   constant.TaskPlatform(strconv.Itoa(constant.ChannelTypeXxx)): "key",
  # ChannelTypeXxx 后的 ")" 必须是第一个,所以 [A-Z][A-Za-z0-9_]+\) 用非贪婪匹配

  # 1. SunoAPI(单行)
  grep -E 'TaskPlatformSuno:[[:space:]]*"' "$ADAPTOR_GO" \
    | sed -nE 's/.*"([a-z][a-z0-9_-]*)".*/SunoAPI\t\1/p'

  # 2. ChannelTypeXxx 形式
  grep -E 'ChannelType[A-Z][A-Za-z0-9_]+\)' "$ADAPTOR_GO" \
    | sed -nE 's/.*ChannelType([A-Z][A-Za-z0-9_]+)\).*"([a-z][a-z0-9_-]*)".*/\1\t\2/p'
}

# relay/channel/ 子目录
list_channel_dirs() {
  find "$CHANNEL_DIR" -mindepth 1 -maxdepth 1 -type d 2>/dev/null \
    | while IFS= read -r d; do basename "$d"; done \
    | sort
}

# ───────────────────────── 输出样式 ─────────────────────────
hr()   { printf "${C_DIM}%s${C_RST}\n" "────────────────────────────────────────────────────────────"; }
hdr()  { printf "\n${C_BOLD}${C_CYN}%s${C_RST}\n" "$1"; hr; }

# ───────────────────────── 各子命令 ─────────────────────────
cmd_types() {
  hdr "ChannelType 编号表  (源: $CHANNEL_GO)"
  printf "${C_BOLD}%5s  %-30s${C_RST}\n" "id" "常量"
  hr
  while IFS=$'\t' read -r id name; do
    [[ -z "$id" ]] && continue
    printf "%5s  %-30s\n" "$id" "$name"
  done < <(parse_channel_types)
  echo
  printf "${C_DIM}* 想知道某个 ChannelType 派发到哪个 adaptor 包?用 ${C_YEL}--query <id>${C_DIM} 或 ${C_YEL}--adaptor${C_DIM}${C_RST}\n"
  printf "${C_DIM}* 完整归属表见 docs-dev/channel-adaptor-map.md${C_RST}\n"
}

cmd_api_types() {
  hdr "APIType iota 序列  (源: $API_TYPE_GO)"
  printf "${C_BOLD}%5s  %-25s  %s${C_RST}\n" "iota" "名称" "派发目标"
  hr
  while IFS=$'\t' read -r idx name; do
    [[ -z "$idx" ]] && continue
    local tgt
    tgt="$(grep -F "case constant.${name}:" "$ADAPTOR_GO" 2>/dev/null \
            | sed -nE 's/.*return[[:space:]]+&([a-z0-9_.]+)\..*/\1/p' | head -1)"
    [[ -z "$tgt" ]] && tgt="—"
    printf "%5s  %-25s  %s\n" "$idx" "$name" "$tgt"
  done < <(parse_api_types)
}

cmd_adaptor() {
  hdr "GetAdaptor 派发表  (源: $ADAPTOR_GO:50)"
  printf "${C_BOLD}%-25s  %s${C_RST}\n" "APIType" "Adaptor 包"
  hr
  while IFS=$'\t' read -r case_name pkg; do
    [[ -z "$case_name" ]] && continue
    local note=""
    case "$pkg" in
      openai) note="  ${C_DIM}(或复用 openai.Adaptor)${C_RST}" ;;
    esac
    printf "%-25s  %s%s\n" "$case_name" "$pkg" "$note"
  done < <(parse_adaptor_dispatch)
}

cmd_task() {
  hdr "taskPluginKeys 映射  (源: $ADAPTOR_GO:141)"
  printf "${C_BOLD}%-25s  %s${C_RST}\n" "ChannelType" "JS plugin key"
  hr
  while IFS=$'\t' read -r name key; do
    [[ -z "$name" ]] && continue
    printf "%-25s  %s\n" "$name" "$key"
  done < <(parse_task_keys)
}

cmd_dirs() {
  hdr "relay/channel/ 子目录"
  printf "${C_BOLD}%-30s  %-8s${C_RST}\n" "包" "adaptor.go"
  hr
  while IFS= read -r dir; do
    [[ -z "$dir" ]] && continue
    local has_adaptor="—"
    if [[ -f "$CHANNEL_DIR/$dir/adaptor.go" ]]; then
      has_adaptor="${C_GRN}yes${C_RST}"
    fi
    printf "%-30s  %b\n" "$dir" "$has_adaptor"
  done < <(list_channel_dirs)
}

cmd_query() {
  local q="$1"
  hdr "查询: ${C_YEL}$q${C_RST}"

  if [[ "$q" =~ ^[0-9]+$ ]]; then
    # 数字 → 找对应 ChannelType / APIType
    local ct apiat
    ct="$(parse_channel_types | awk -F'\t' -v n="$q" '$1 == n { print $2; exit }')"
    apiat="$(parse_api_types | awk -F'\t' -v n="$q" '$1 == n { print $2; exit }')"

    # 从 docs 文档中精确提取该 ChannelType 对应的适配器包
    local ct_pkg="—"
    if [[ -n "$ct" ]]; then
      local short="${ct#ChannelType}"
      short="${short#Channel}"
      ct_pkg="$(grep -E "\\|[[:space:]]*${q}[[:space:]]*\\|[[:space:]]*${short}[[:space:]]*\\|" "$DOC_MD" 2>/dev/null \
                 | sed -nE 's/.*\|[[:space:]]*`?(relay\/channel\/[^ `|]+)`?[[:space:]]*\|.*/\1/p' | head -1)"
      [[ -z "$ct_pkg" ]] && ct_pkg="(复用 / 走 task-plugin / 历史)"
    fi

    printf "  ${C_BOLD}ChannelType${C_RST}      : %s\n" "${ct:-—}"
    printf "  ${C_BOLD}适配器目录${C_RST}      : %s\n" "${ct_pkg}"
    printf "  ${C_BOLD}APIType${C_RST}          : %s\n" "${apiat:-—}"

    if [[ -n "$apiat" ]]; then
      local dispatch
      dispatch="$(awk -v t="$apiat" '
        index($0, "case constant." t ":") > 0 { want = 1; next }
        want && /return[[:space:]]+&[a-z0-9_.]+[.({]/ {
          rest = $0
          p = index(rest, "&")
          if (p > 0) {
            rest = substr(rest, p + 1)
            for (i = 1; i <= length(rest); i++) {
              c = substr(rest, i, 1)
              if (c == "." || c == "(" || c == "{") {
                print substr(rest, 1, i - 1)
                exit
              }
            }
          }
          want = 0
        }
      ' "$ADAPTOR_GO")"
      printf "  ${C_BOLD}APIType 派发到${C_RST}  : %s\n" "${dispatch:-—}"
    fi
  else
    local q_lower
    q_lower="$(echo "$q" | tr '[:upper:]' '[:lower:]')"

    printf "  ${C_BOLD}ChannelType 匹配${C_RST}:\n"
    parse_channel_types | awk -F'\t' -v q="$q_lower" 'tolower($2) ~ tolower(q) { printf "    %5s  %s\n", $1, $2 }'

    printf "  ${C_BOLD}APIType 匹配${C_RST}:\n"
    parse_api_types | awk -F'\t' -v q="$q_lower" 'tolower($2) ~ tolower(q) { printf "    %5s  %s\n", $1, $2 }'

    printf "  ${C_BOLD}relay/channel/ 匹配${C_RST}:\n"
    list_channel_dirs | awk -v q="$q_lower" 'tolower($0) ~ tolower(q) { printf "    %s/\n", $0 }'
  fi
}

cmd_check() {
  if [[ ! -f "$DOC_MD" ]]; then
    echo "${C_RED}✗ $DOC_MD 不存在,无法校验${C_RST}"; return 1
  fi
  hdr "校验 docs-dev/channel-adaptor-map.md 是否与源码一致"
  local pass=0 fail=0
  while IFS=$'\t' read -r id name; do
    [[ -z "$id" || "$id" == "0" ]] && continue
    # 文档中表格格式: "| <id> | <name> | ..."
    # 先剥前缀 ChannelType / Channel(Cloudflare 这类)
    local short
    short="${name#ChannelType}"
    short="${short#Channel}"
    if grep -qE "\\|[[:space:]]*${id}[[:space:]]*\\|[[:space:]]*${short}[[:space:]]*\\|" "$DOC_MD" 2>/dev/null; then
      pass=$((pass+1))
    else
      printf "  ${C_RED}✗ 缺失:${C_RST} ChannelType=%s (%s)\n" "$id" "$name"
      fail=$((fail+1))
    fi
  done < <(parse_channel_types)

  echo
  printf "  ${C_GRN}✓ 一致: %d${C_RST}  ${C_RED}✗ 缺失: %d${C_RST}\n" "$pass" "$fail"
  [[ "$fail" == 0 ]] && return 0 || return 1
}

# ───────────────────────── 入口 ─────────────────────────
if [[ $# -eq 0 ]]; then
  cmd_dirs
  exit 0
fi

case "$1" in
  -h|--help)   usage; exit 0 ;;
  --types)     cmd_types ;;
  --api-types) cmd_api_types ;;
  --adaptor)   cmd_adaptor ;;
  --task)      cmd_task ;;
  --query)     [[ $# -ge 2 ]] || { echo "${C_RED}✗ --query 需要一个参数${C_RST}"; exit 2; }
               cmd_query "$2" ;;
  --check)     cmd_check ;;
  *)           echo "${C_RED}未知选项: $1${C_RST}"; echo; usage; exit 2 ;;
esac