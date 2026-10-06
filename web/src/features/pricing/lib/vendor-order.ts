import type { PricingModel, PricingVendor } from '../types'

/**
 * A vendor paired with the number of models it publishes.
 *
 * `icon` is the raw icon key (may carry a trailing ".Color" that the caller
 * strips before rendering) so this helper stays free of any React/UI imports
 * and can be unit-tested under plain Node.
 */
export type OrderedVendor = {
  name: string
  icon?: string
  count: number
}

/**
 * Order pricing vendors by how many models they publish, most models first.
 *
 * Equal counts fall back to name order to keep the list deterministic. Vendors
 * with zero models are dropped (the sidebar only shows providers that actually
 * surface in the current model set). "All Vendors" is intentionally excluded
 * here — the caller pins it to the top as the filter reset.
 *
 * 计数口径（与管理页保持一致）：
 * 后端 `updatePricing` 通过 `syncVendorModelCounts` 给每个供应商填充了
 * `model_count`，该值来自 `model.GetEffectiveVendorModelCounts`（models 表计数 +
 * 按名称规则归因的合成默认品牌），与管理页「关联模型数」完全同口径。因此前端
 * 优先采用 `vendor.model_count`；仅当旧载荷缺失该字段时，才回落到从 `models`
 * 数组按 `vendor_name` 重算，从而保证定价页左侧供应商模型数与管理页一一对应。
 */
export function orderVendorsByModelCount(
  models: PricingModel[],
  vendors: PricingVendor[]
): OrderedVendor[] {
  // 后端口径（管理页同款）的关联模型数，按供应商名索引。
  const backendCounts = new Map<string, number>()
  for (const vendor of vendors) {
    if (typeof vendor.model_count === 'number' && vendor.model_count > 0) {
      backendCounts.set(vendor.name, vendor.model_count)
    }
  }

  // 兜底：仅在后端未提供 model_count 时，从当前展示的 models 数组按 vendor_name 重算。
  const modelCounts = new Map<string, number>()
  for (const model of models) {
    const name = model.vendor_name
    if (!name) continue
    modelCounts.set(name, (modelCounts.get(name) ?? 0) + 1)
  }

  return vendors
    .map((vendor) => {
      const backend = backendCounts.get(vendor.name)
      const fromModels = modelCounts.get(vendor.name) ?? 0
      // 优先用后端管理页口径的关联模型数；缺失时回落本地重算。
      const count = backend != null ? backend : fromModels
      return {
        name: vendor.name,
        icon: vendor.icon,
        count,
      }
    })
    .filter((vendor) => vendor.count > 0)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
}
