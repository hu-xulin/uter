package model

import (
	"fmt"
	"strings"

	"github.com/uter-ai/uter/common"

	"gorm.io/gorm"
)

// 模型图标回填迁移。
//
// 背景：模型卡片只渲染 models.icon，为空就回落首字母占位（管理端显示小写
// 首字母，如 wan3.0-video 的 "w"、seedance-2.0 的 "s"）。而这些行之所以为空，
// 是因为写入时产品图标推断链对某些品牌失效：
//
//   - Wan 是前端自定义图标（CUSTOM_ICONS 的 IconWan），后端 lobeIconVariants
//     （由 @lobehub/icons 生成）里没有它，defaultProductIconForModel 据此判定
//     「不可渲染」而返回空串；
//   - 推断链修复后（见 custom_icon_variants.go / defaultProductIconPrefixes），
//     新写入的模型已经能拿到正确图标，但存量行不会自己更新。
//
// 本迁移只做两件事，都严格限定在「确定是错的」范围内：
//
//  1. 空 icon 且模型名能被推断出产品图标 → 写入（如 wan3.0-video → Wan.Color）。
//     空白字符串一律视为未设置，与列表渲染时的判空口径一致。
//  2. wan 系列被误标成其它品牌图标 → 纠正为 Wan.Color。历史上有行把万相模型
//     记成 Qwen.Color（同属阿里，但产品不同），这类错误必须修，否则卡片顶着
//     通义千问的 logo 显示万相模型名。
//
// 其余一切非空值原样保留：运营在管理端手工设置的图标是最终配置，迁移绝不覆盖，
// 这也是 vendors.icon 那条「禁止批量改写」约束（TestNoBulkVendorIconRewrite）
// 的同一条原则在 models.icon 上的体现。
//
// 幂等：回填后 icon 非空，下次启动不再命中；重复执行无副作用。
func migrateModelIcons(db *gorm.DB) error {
	if db == nil {
		return nil
	}

	var rows []Model
	// 走 GORM 模型查询而不是原生 SQL：表名前缀（多套用例共用同一库时的隔离手段）
	// 由 NamingStrategy 统一处理，写死 "models" 在有前缀的环境里会找不到表。
	//
	// 只扫「空 icon」或「wan 系列但图标不是 Wan」的行，避免全表读入内存。
	if err := db.Unscoped().
		Where("deleted_at IS NULL").
		Where("TRIM(COALESCE(icon, '')) = '' OR (LOWER(model_name) LIKE 'wan%' AND TRIM(COALESCE(icon, '')) <> 'Wan.Color')").
		Find(&rows).Error; err != nil {
		return fmt.Errorf("scan models with missing or wrong icon: %w", err)
	}
	if len(rows) == 0 {
		return nil
	}

	type fix struct {
		id       int
		name     string
		icon     string
		previous string
	}
	var fixes []fix
	for _, row := range rows {
		derived := defaultProductIconForModel(row.ModelName)
		if derived == "" {
			// 推断不出可渲染图标：保持原样，运营可手工指定。
			continue
		}
		target := NormalizeColorIconKey(derived)
		if target == "" || target == row.Icon {
			continue
		}
		// 非空且不是 wan 错标的情况已在 SQL 里排除，这里再兜一层：
		// 只有原本为空、或原本是 wan 系列时才改，绝不覆盖其它非空配置。
		current := strings.TrimSpace(row.Icon)
		isWanRow := strings.HasPrefix(strings.ToLower(strings.TrimSpace(row.ModelName)), "wan")
		if current != "" && !isWanRow {
			continue
		}
		fixes = append(fixes, fix{id: row.Id, name: row.ModelName, icon: target, previous: current})
	}
	if len(fixes) == 0 {
		return nil
	}

	updated := 0
	for _, f := range fixes {
		// 同样走模型更新而不是原生 SQL：表名前缀由 GORM 处理。
		// 条件里再带一次 icon，避免与运营同时保存时覆盖对方刚写入的值。
		res := db.Model(&Model{}).
			Where("id = ? AND deleted_at IS NULL AND TRIM(COALESCE(icon, '')) = ?", f.id, f.previous).
			Update("icon", f.icon)
		if res.Error != nil {
			return fmt.Errorf("backfill icon for model %q: %w", f.name, res.Error)
		}
		updated += int(res.RowsAffected)
	}

	common.SysLog(common.LogText(
		"model icon backfill: repaired %d of %d candidate model(s)", updated, len(rows)))
	return nil
}
