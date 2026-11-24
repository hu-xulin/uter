# Uter 供应商适配矩阵（本轮核验结果，2026-11-24）

| 供应商 | 审计输入要求 | 当前 HEAD 实测 | 本轮动作 |
| --- | --- | --- | --- |
| Uter Route | 保留独立适配器 | 独立适配器存在；本轮未修改 | 未改；标记 NOT_VERIFIED |
| 阿里云百炼 | 保留独立适配器 | 独立适配器存在；币种来自地域推断的问题未修 | 未改；标记 NOT_BUILT |
| Uter.api | 独立 Provider `uterapi`，取代 XXAPI | 独立渠道类型 `ChannelTypeUterAPI` 存在；分组过滤此前靠名称推断 | 已改为 `enable_groups` ∩ Key 可见模型；创建失败保护；价格 Provider 改为 `uterapi` 并接管旧行 |
| 其他 New API 兼容上游 | 通用协议适配，不得冒充 Uter.api | 通用路径默认 Provider `newapi-compatible` | Provider ID 改为调用方可传入，通用路径保留默认值 |
| XXAPI | 不作为独立供应商 | 未发现独立供应商代码 | 未新增；未做全仓清理 |
| Apiko | 彻底删除 | 运行时适配器不存在；`apiko-` 来源前缀仍在；历史数据存在 | 未删除；需备份与授权，标记 NOT_BUILT |

结论：供应商结构未按审计要求全部定型；本轮只收紧 Uter.api 的授权与创建闭环。
