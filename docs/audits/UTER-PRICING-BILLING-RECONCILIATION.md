# Uter 实际计费对账——状态说明（2026-11-24）

**状态：NOT_VERIFIED**。本轮未修改预扣、结算、退款或价格快照链路，也未拿到真实消费日志与供应商账单。

已做的是计费入口门禁加固：Token（`relay/helper/price.go`）、按次（`ModelPriceHelperPerCall`）、任务（`relay/relay_task.go`）在渠道没有可计费价格时，统一按显式 `pricing_mode` 判定，PENDING/ACTIVE 渠道不得回退全局价格。

未完成：
- 请求开始时冻结的 Provider / Channel / Model / Region / Deployment / PricingVersion / 销售价 / 采购成本快照一致性验证；
- 输入/输出/缓存/思考/图片/音频/视频/按次/按秒/阶梯/B 端分组/退款的重算对比；
- 百炼图像任务 `image_count`、`input_image_count`、`prompt_extend`、`output_image_type` 到结算表达式的链路证明；
- 供应商发票导出与请求 ID 映射。

不得以历史两条消费日志样本替代本轮对账结论。
