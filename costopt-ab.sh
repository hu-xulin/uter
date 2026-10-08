#!/usr/bin/env bash
# 降本优化（costopt）开/关 的 Token 消耗对比测量脚本
#
# 用法：
#   ./costopt-ab.sh snapshot on     # 采基线快照（降本全关）
#   ./costopt-ab.sh snapshot off    # 采对照快照（降本全开）
#   ./costopt-ab.sh report          # 对比两次快照
#
# 设计要点（都是踩过的坑）：
#  1) metrics 计数是**进程内原子量**，重启即清零 → 每次测量必须重新读，不能跨重启比。
#  2) 命中计数只在 metrics_enabled=true 时累加 → 采样期间务必保持它开着。
#  3) 前后两次必须是**同一批流量**（同样模型/同样时间段），否则 token 差异全是业务波动。
#  4) total_tokens_saved_est 目前**恒为 0**（AddTokensSaved 无调用方）→ 别拿它当结论，
#     要用 cache_tokens / quota 这些真实落库字段算。

set -euo pipefail
cd "$(dirname "$0")"

DB="one-api.db"
OUT="_reports/costopt-ab"
mkdir -p "$OUT"

snapshot() {
  local label="$1" ts
  ts=$(date +%Y%m%d-%H%M%S)
  sqlite3 "$DB" > "$OUT/${label}-${ts}.txt" <<SQL
.mode list
.headers on
SELECT
  datetime('now')                AS sampled_at,
  '$label'                       AS arm,
  COUNT(*)                        AS reqs,
  COALESCE(SUM(prompt_tokens),0)  AS prompt_tokens,
  COALESCE(SUM(completion_tokens),0) AS completion_tokens,
  COALESCE(SUM(quota),0)          AS quota,
  COALESCE(SUM(json_extract(other,'$.cache_tokens')),0) AS cache_tokens
FROM logs
WHERE type = 2
  AND created_at >= strftime('%s','now') - ${WINDOW_SECONDS:-86400};
SQL
  # 追加窗口起点，便于确认两段流量是否可比（注意：必须先写 CSV 再追加）
  printf 'window_start=%s\n' \
    "$(sqlite3 "$DB" "SELECT datetime(MIN(created_at),'unixepoch') FROM logs WHERE type=2 AND created_at >= strftime('%s','now') - ${WINDOW_SECONDS:-86400};")" \
    >> "$OUT/${label}-${ts}.txt"
  echo "→ 已保存 $OUT/${label}-${ts}.txt"
}

report() {
  echo "=== 降本对比报告 ==="
  for f in "$OUT"/on-*.txt "$OUT"/off-*.txt; do
    [ -f "$f" ] || continue
    echo "--- $(basename "$f") ---"
    cat "$f"
    echo
  done
  if ! ls "$OUT"/on-*.txt >/dev/null 2>&1 || ! ls "$OUT"/off-*.txt >/dev/null 2>&1; then
    echo "需要各采一次 on / off 快照才能对比。"; exit 1
  fi
  python3 - <<'PY'
import csv, glob
def load(arm):
    f = sorted(glob.glob(f'_reports/costopt-ab/{arm}-*.txt'))[-1]
    # 快照是 sqlite `.mode list` 的**竖线分隔**格式，不是逗号 → delimiter='|'
    lines = [l for l in open(f) if not l.startswith('window_start')]
    for row in csv.DictReader(lines, delimiter='|'):
        return {k: int(v) for k, v in row.items() if isinstance(v, str) and v.isdigit()}
    return None
on, off = load('on'), load('off')
if not on or not off:
    raise SystemExit('快照解析失败')
print(f"{'指标':<24}{'降本开':>14}{'降本关':>14}{'差异':>14}{'降幅':>10}")
print('-' * 76)
for k, label in [('reqs','请求数'),('prompt_tokens','prompt tokens'),
                 ('cache_tokens','其中 cache_tokens'),
                 ('completion_tokens','completion tokens'),('quota','计费额度')]:
    a, b = on[k], off[k]
    d = b - a
    pct = f'{(d/b*100):.1f}%' if b else 'n/a'
    print(f'{label:<24}{a:>14,}{b:>14,}{d:>+14,}{pct:>10}')
print()
if on['reqs'] != off['reqs']:
    print(f"⚠️  两段请求数不同（{on['reqs']} vs {off['reqs']}），token 总量不可直接比；"
          '请改用「每请求均值」或重采等量流量。')
else:
    print(f"请求数一致（{on['reqs']}），总量可直接比较。")
PY
}

case "${1:-}" in
  snapshot)
    [ -n "${2:-}" ] || { echo "用法: $0 snapshot on|off"; exit 1; }
    snapshot "$2"
    ;;
  report) report ;;
  *) echo "用法: $0 snapshot on|off | report"; exit 1 ;;
esac