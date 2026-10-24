-- 供应商图标改为公司 logo（模型 logo 与公司 logo 分离）
--
-- 背景：供应商列此前展示的是大模型/产品 logo（Anthropic→Claude、Google→Gemini、
-- ByteDance→Doubao、Alibaba→Qwen、Tencent→Hunyuan、Baidu→Wenxin、Azure→AzureAI），
-- 而供应商本身应以公司 logo 呈现；大模型的产品 logo 由 models.icon 承载。
--
-- 规则：按供应商名称匹配到公司品牌后替换为该公司的图标键，其余保持原值
-- （01.AI / 360 / AWS / MiniMax / Bailing 等在 @lobehub/icons 里没有对应的公司
-- 品牌，保留其原有图标是唯一可渲染的选择）。
--
-- 注意：
--   1. 只处理未软删除的记录。
--   2. 存储值为品牌裸名，彩色化只发生在渲染层（供应商 logo 一律单色，
--      模型 logo 才用彩色）。

UPDATE vendors
SET icon = CASE name
        WHEN 'Anthropic' THEN 'Anthropic'
        WHEN 'Google' THEN 'Google'
        WHEN 'ByteDance' THEN 'ByteDance'
        WHEN 'Volcengine' THEN 'ByteDance'
        WHEN 'Jimeng' THEN 'ByteDance'
        WHEN 'Alibaba' THEN 'Alibaba'
        WHEN 'Tencent' THEN 'Tencent'
        WHEN 'LongCat' THEN 'Tencent'
        WHEN 'Baidu' THEN 'Baidu'
        WHEN 'Azure' THEN 'Microsoft'
        WHEN 'Microsoft' THEN 'Microsoft'
        WHEN '微软' THEN 'Microsoft'
        ELSE icon
    END
WHERE deleted_at IS NULL
  AND name IN (
        'Anthropic', 'Google', 'ByteDance', 'Volcengine', 'Jimeng',
        'Alibaba', 'Tencent', 'LongCat', 'Baidu',
        'Azure', 'Microsoft', '微软'
    );
