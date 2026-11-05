-- =============================================================================
-- v0.2 -> v0.3 历史配额迁移
-- -----------------------------------------------------------------------------
-- 作用：将每个用户名下 Token 的剩余额度(remain_quota)累加进用户余额(quota)。
--
-- 安全约束（务必遵守）：
--   1. 执行状态不明的数据库【禁止直接重跑】。先执行文末"执行前检查"确认
--      _migrations 中是否已存在 'v0.2-v0.3' 记录：
--        SELECT version FROM _migrations WHERE version = 'v0.2-v0.3';
--      若已存在记录，说明迁移已完成，不要再执行本脚本。
--   2. 本脚本设计为幂等：重复执行不会重复入账（已用 _migrations 记录执行状态）。
--   3. 修复原脚本的空值缺陷：无 Token 的用户原 UPDATE 会因子查询返回 NULL 而把
--      quota 置为 NULL（数据损坏）；本脚本用 COALESCE 兜底，且只对"有 Token"的
--      用户执行更新。
-- =============================================================================

BEGIN;

-- 执行记录表（跨库通用：PostgreSQL / MySQL / SQLite 均支持 IF NOT EXISTS）。
CREATE TABLE IF NOT EXISTS _migrations (
    version VARCHAR(64) PRIMARY KEY
);

-- 仅当本版本尚未记录时才入账；重复执行时此 UPDATE 命中 0 行，不会重复增加余额。
UPDATE users
SET quota = quota + COALESCE((
    SELECT SUM(remain_quota)
    FROM tokens
    WHERE tokens.user_id = users.id
), 0)
WHERE NOT EXISTS (
    SELECT 1 FROM _migrations WHERE version = 'v0.2-v0.3'
)
AND EXISTS (
    SELECT 1 FROM tokens WHERE tokens.user_id = users.id
);

-- 记录执行状态（幂等插入：已存在则不再插入）。
INSERT INTO _migrations (version)
SELECT 'v0.2-v0.3'
WHERE NOT EXISTS (
    SELECT 1 FROM _migrations WHERE version = 'v0.2-v0.3'
);

COMMIT;

-- =============================================================================
-- 执行前检查（状态不明时先跑这条，确认是否已经迁移过）
-- =============================================================================
-- SELECT version FROM _migrations WHERE version = 'v0.2-v0.3';

-- =============================================================================
-- 执行后核对
-- =============================================================================
-- 1) 确认迁移已记录：
--    SELECT version FROM _migrations WHERE version = 'v0.2-v0.3';
-- 2) 抽样核对某用户的 quota 是否等于"迁移前 quota + 其 Token 剩余额度之和"：
--    SELECT u.id, u.quota,
--           (SELECT COALESCE(SUM(t.remain_quota),0) FROM tokens t WHERE t.user_id = u.id) AS token_sum
--    FROM users u
--    WHERE u.id = <某用户ID>;
-- 3) 确认没有用户的 quota 被写成 NULL：
--    SELECT COUNT(*) FROM users WHERE quota IS NULL;
--    （应为 0；若 > 0，说明存在其他写入路径，需立即排查。）
