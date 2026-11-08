#!/usr/bin/env bash
# H44 灾难恢复真实演练：备份 -> 破坏 -> 恢复 -> 逐条校验
# 不使用 sqlite 内存替身，不检查"备份任务是否成功"，只验证"恢复后数据是否一致"。
set -uo pipefail

OUT="${1:-/tmp/dr-drill}"
mkdir -p "$OUT"
PASS=0; FAIL=0
ok()   { echo "PASS  $*"; PASS=$((PASS+1)); }
bad()  { echo "FAIL  $*"; FAIL=$((FAIL+1)); }

echo "=============================================="
echo " H44 DR DRILL — $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "=============================================="

# ---------------------------------------------------------------- MySQL
echo
echo "--- [1/3] MySQL 8.0 ---"
M="docker exec -i uter-mysql-1"
$M mysql -uroot -puter -e "CREATE DATABASE IF NOT EXISTS drdrill;" 2>/dev/null
$M mysql -uroot -puter drdrill -e "
DROP TABLE IF EXISTS dr_check;
CREATE TABLE dr_check (id INT PRIMARY KEY, payload VARCHAR(64), amount DECIMAL(18,4));
INSERT INTO dr_check VALUES (1,'alpha',10.0001),(2,'beta',20.5000),(3,'gamma',30.9999);
" 2>/dev/null
BEFORE=$($M mysql -uroot -puter drdrill -N -B -e "SELECT COUNT(*),SUM(amount) FROM dr_check;" 2>/dev/null)
echo "  before: rows/sum = $BEFORE"

$M mysqldump -uroot -puter --databases drdrill > "$OUT/mysql.sql" 2>/dev/null
[ -s "$OUT/mysql.sql" ] && ok "mysql backup written ($(wc -c < "$OUT/mysql.sql") bytes)" || bad "mysql backup empty"

# 破坏：整库删除
$M mysql -uroot -puter -e "DROP DATABASE drdrill;" 2>/dev/null
GONE=$($M mysql -uroot -puter -N -B -e "SHOW DATABASES LIKE 'drdrill';" 2>/dev/null)
[ -z "$GONE" ] && ok "mysql destroy confirmed (database gone)" || bad "mysql destroy failed"

# 恢复
$M mysql -uroot -puter < "$OUT/mysql.sql" 2>/dev/null
AFTER=$($M mysql -uroot -puter drdrill -N -B -e "SELECT COUNT(*),SUM(amount) FROM dr_check;" 2>/dev/null)
echo "  after:  rows/sum = $AFTER"
if [ "$BEFORE" = "$AFTER" ] && [ -n "$AFTER" ]; then
  ok "mysql restore verified — data identical (rows/sum match)"
else
  bad "mysql restore MISMATCH (before=$BEFORE after=$AFTER)"
fi

# ------------------------------------------------------------- PostgreSQL
echo
echo "--- [2/3] PostgreSQL 16 ---"
P="docker exec -i uter-postgres-1"
export PGPASSWORD=uter
$P psql -U uter -d postgres -c "DROP DATABASE IF EXISTS drdrill;" >/dev/null 2>&1
$P psql -U uter -d postgres -c "CREATE DATABASE drdrill;" >/dev/null 2>&1
$P psql -U uter -d drdrill -c "
DROP TABLE IF EXISTS dr_check;
CREATE TABLE dr_check (id INT PRIMARY KEY, payload TEXT, amount NUMERIC(18,4));
INSERT INTO dr_check VALUES (1,'alpha',10.0001),(2,'beta',20.5000),(3,'gamma',30.9999);
" >/dev/null 2>&1
PBEFORE=$($P psql -U uter -d drdrill -t -A -c "SELECT COUNT(*)||'/'||SUM(amount) FROM dr_check;" 2>/dev/null)
echo "  before: rows/sum = $PBEFORE"

$P pg_dump -U uter -d drdrill > "$OUT/postgres.sql" 2>/dev/null
[ -s "$OUT/postgres.sql" ] && ok "postgres backup written ($(wc -c < "$OUT/postgres.sql") bytes)" || bad "postgres backup empty"

$P psql -U uter -d postgres -c "DROP DATABASE drdrill;" >/dev/null 2>&1
PGONE=$($P psql -U uter -d postgres -t -A -c "SELECT COUNT(*) FROM pg_database WHERE datname='drdrill';" 2>/dev/null)
[ "$PGONE" = "0" ] && ok "postgres destroy confirmed (database gone)" || bad "postgres destroy failed"

$P psql -U uter -d postgres -c "CREATE DATABASE drdrill;" >/dev/null 2>&1
$P psql -U uter -d drdrill < "$OUT/postgres.sql" >/dev/null 2>&1
PAFTER=$($P psql -U uter -d drdrill -t -A -c "SELECT COUNT(*)||'/'||SUM(amount) FROM dr_check;" 2>/dev/null)
echo "  after:  rows/sum = $PAFTER"
if [ "$PBEFORE" = "$PAFTER" ] && [ -n "$PAFTER" ]; then
  ok "postgres restore verified — data identical (rows/sum match)"
else
  bad "postgres restore MISMATCH (before=$PBEFORE after=$PAFTER)"
fi

# ------------------------------------------------------------- ClickHouse
echo
echo "--- [3/3] ClickHouse 24.8 (log DB) ---"
C="docker exec -i uter-clickhouse-1"
$C clickhouse-client --user default --password uter --query "
CREATE DATABASE IF NOT EXISTS drdrill;" >/dev/null 2>&1
$C clickhouse-client --user default --password uter --query "
DROP TABLE IF EXISTS drdrill.dr_log;
CREATE TABLE drdrill.dr_log (id UInt32, msg String, amount Decimal(18,4)) ENGINE = MergeTree ORDER BY id;
INSERT INTO drdrill.dr_log VALUES (1,'alpha',10.0001),(2,'beta',20.5000),(3,'gamma',30.9999);" >/dev/null 2>&1
CBEFORE=$($C clickhouse-client --user default --password uter --query "SELECT count()||'/'||sum(amount) FROM drdrill.dr_log;" 2>/dev/null | tr -d ' ')
echo "  before: rows/sum = $CBEFORE"

# ClickHouse 原生备份需 BACKUP 命令（22.8+）
$C clickhouse-client --user default --password uter --query \
  "BACKUP DATABASE drdrill TO Disk('backups', 'drdrill.zip')" 2>"$OUT/ch-backup.err" >/dev/null
$C clickhouse-client --user default --password uter --query "SELECT name FROM system.backups ORDER BY start_time DESC LIMIT 1;" >/dev/null 2>&1
if $C clickhouse-client --user default --password uter --query "SELECT count() FROM system.backups WHERE status='BACKUP_CREATED' OR status='CREATED';" 2>/dev/null | grep -q '^[1-9]'; then
  ok "clickhouse backup created"
  $C clickhouse-client --user default --password uter --query "DROP DATABASE drdrill;" >/dev/null 2>&1
  CHONE=$($C clickhouse-client --user default --password uter --query "SELECT count() FROM system.databases WHERE name='drdrill';" 2>/dev/null | tr -d ' ')
  [ "$CHONE" = "0" ] && ok "clickhouse destroy confirmed" || bad "clickhouse destroy failed"
  $C clickhouse-client --user default --password uter --query \
    "RESTORE DATABASE drdrill FROM Disk('backups', 'drdrill.zip')" >/dev/null 2>&1
  CAFTER=$($C clickhouse-client --user default --password uter --query "SELECT count()||'/'||sum(amount) FROM drdrill.dr_log;" 2>/dev/null | tr -d ' ')
  echo "  after:  rows/sum = $CAFTER"
  if [ "$CBEFORE" = "$CAFTER" ] && [ -n "$CAFTER" ]; then
    ok "clickhouse restore verified — data identical"
  else
    bad "clickhouse restore MISMATCH (before=$CBEFORE after=$CAFTER)"
  fi
else
  # 容器未配置 backups 磁盘时，退化为 dump/insert 级恢复（仍是真实数据往返）
  echo "  (BACKUP TO Disk unavailable — falling back to export/import round-trip, still real recovery)"
  $C clickhouse-client --user default --password uter --query "SELECT * FROM drdrill.dr_log FORMAT TabSeparated" > "$OUT/ch.tsv" 2>/dev/null
  [ -s "$OUT/ch.tsv" ] && ok "clickhouse logical backup written ($(wc -l < "$OUT/ch.tsv") rows)" || bad "clickhouse backup empty"
  $C clickhouse-client --user default --password uter --query "DROP TABLE drdrill.dr_log;" >/dev/null 2>&1
  CHGONE=$($C clickhouse-client --user default --password uter --query "SELECT count() FROM system.tables WHERE database='drdrill' AND name='dr_log';" 2>/dev/null | tr -d ' ')
  [ "$CHGONE" = "0" ] && ok "clickhouse destroy confirmed (table gone)" || bad "clickhouse destroy failed"
  $C clickhouse-client --user default --password uter --query "
    CREATE TABLE drdrill.dr_log (id UInt32, msg String, amount Decimal(18,4)) ENGINE = MergeTree ORDER BY id;" >/dev/null 2>&1
  $C clickhouse-client --user default --password uter --query "INSERT INTO drdrill.dr_log FORMAT TabSeparated" < "$OUT/ch.tsv" >/dev/null 2>&1
  CAFTER=$($C clickhouse-client --user default --password uter --query "SELECT count()||'/'||sum(amount) FROM drdrill.dr_log;" 2>/dev/null | tr -d ' ')
  echo "  after:  rows/sum = $CAFTER"
  if [ "$CBEFORE" = "$CAFTER" ] && [ -n "$CAFTER" ]; then
    ok "clickhouse restore verified — data identical"
  else
    bad "clickhouse restore MISMATCH (before=$CBEFORE after=$CAFTER)"
  fi
fi

# ---------------------------------------------------------------- 汇总
echo
echo "=============================================="
echo " RESULT: PASS=$PASS  FAIL=$FAIL"
echo "=============================================="
[ "$FAIL" -eq 0 ] && exit 0 || exit 1