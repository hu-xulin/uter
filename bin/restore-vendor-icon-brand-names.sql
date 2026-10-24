-- 供应商图标还原为品牌裸名（配合「图标以运营在「模型-供应商」里的设置为准」的整改）
--
-- 背景：启动迁移曾把存量 vendors.icon 的裸名升级成 .Color / .Avatar 变体，
-- 并按品牌映射把个别供应商强制对齐到别的品牌（例如 Meta 供应商被写成
-- Ollama.Avatar）。该迁移已从代码中移除，本脚本用于把被改写的值还原回
-- 品牌裸名；彩色化只在渲染层发生（前端 colorIconName），因此外观不变。
--
-- 注意：
--   1. 只处理未软删除的记录；软删行从未被迁移，保持原样。
--   2. Meta 供应商特判为 'Meta'：品牌映射曾把它误指向 Ollama。
--   3. 请在部署「已移除该迁移」的新二进制之后再执行，否则旧二进制重启会再次改写。

UPDATE vendors
SET icon = CASE
        -- Meta 供应商被品牌映射误指向 Ollama，还原为 Meta 自身图标。
        WHEN name = 'Meta' AND icon IN ('Ollama.Avatar', 'Ollama.Color', 'Ollama')
            THEN 'Meta'
        -- 品牌裸名：剥离结尾的彩色 / 头像变体后缀。
        WHEN icon LIKE '%.Color'
            THEN SUBSTRING(icon, 1, LENGTH(icon) - LENGTH('.Color'))
        WHEN icon LIKE '%.Avatar'
            THEN SUBSTRING(icon, 1, LENGTH(icon) - LENGTH('.Avatar'))
        ELSE icon
    END
WHERE deleted_at IS NULL
  AND icon IS NOT NULL
  AND icon <> ''
  AND (
        icon LIKE '%.Color'
        OR icon LIKE '%.Avatar'
        OR (name = 'Meta' AND icon = 'Ollama')
    );
