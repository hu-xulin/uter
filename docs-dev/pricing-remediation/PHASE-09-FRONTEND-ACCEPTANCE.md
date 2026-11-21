# PHASE 09 — 前端定价管理体系

状态：**PARTIALLY_VERIFIED**
（代码与类型/设计令牌门禁通过；本轮未做浏览器逐页人工回归）

## 1. 已有界面入口

- 渠道定价面板 `web/src/features/channels/components/channel-pricing-panel.tsx`
  - 官方价 / 渠道报价 / 当前售价分区展示；
  - 单模型编辑、阶梯价、按次/按秒/按分钟；
  - 批量调价：基准、模式、维度、范围、毛利保护、预览、执行；
  - 同步计划；同步结果与跳过原因；
  - 价格历史与回滚入口。
- 定价页 `web/src/features/pricing/index.tsx`
  - 渠道筛选后应用该渠道的价格/官方价/音频/缓存/阶梯/按秒价；
  - 缺失该渠道价时显示 missing，不回退全局价；
  - 六类标签：文本、图片、视频、音频、向量、全模态。
- 模型卡片两行展示：上游行 + Uter 行。
- 百炼品牌 Logo、渠道品牌标识。

## 2. 本轮前端变更

1. 批量维度勾选新增 8 项：
   `image_input`、`thinking_input`、`thinking_output`、`thinking_cache`、
   `thinking_create_cache`、`thinking_image_input`、`multi_input_output`、
   `thinking_multi_input_output`。
2. 批量预览逐维展示新增价格（`/1M`）。
3. `ChannelBatchPricingItem` 类型补齐对应字段。
4. 新增 7 个 i18n 键，7 个语言全部翻译；`bun run i18n:sync` 幂等。
5. 编辑弹窗新增 “Contract purchase cost”：按当前计费模式录入 input/output 或
   per-call/second/minute，设置 “Cost verified”，清空即删除合同成本。
6. 模型行展示合同成本金额与 Verified / Not verified 状态。
7. 渠道定价区新增“最近计费快照”折叠列表：request/task、模型、计费模式、
   销售版本、采购版本、渠道身份，数据来自 `billing_price_snapshots`。
8. 对账区新增“导入上游发票”：粘贴 JSON、显示匹配/不一致/未匹配与总额，
   并列出最近导入记录。

## 3. 仍未完成

- 按供应商/区域/部署/价格来源/模型能力筛选批量目标：后端选项未提供，
  前端也没有入口。
- 合同采购价批量导入/CSV 界面：当前仅单模型录入。
- 价格变更审批队列专用页面：仅能查看 needs_review 标记。
- 供应商账单对账页面：无。
- 浏览器端未逐页点击验证（无运行中的完整前后端栈截图对比）。

## 4. 验证

```bash
cd web && bun run typecheck          # exit 0
cd web && bun run lint               # exit 0
cd web && bun run lint:design:strict # exit 0
cd web && bun run test               # 316 files / 3204 tests PASS, exit 0
cd web && bun run i18n:sync          # 0 missing / 0 extras
# 幂等校验：两次 sync 后 7 个 locale 文件 sha256 一致
```

未执行：登录后的浏览器人工回归、视觉基线对比。公开定价页访问被登录守卫
重定向到 `/sign-in`，本轮没有可用测试账号。

## 5. 结论

界面与后端字段已对齐，类型/静态/设计门禁与 3204 条前端测试通过；但登录后的浏览器点击回归仍未执行，不能表述为“全部功能已真实点击验证”。