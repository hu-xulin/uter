package model

import (
	"fmt"
	"strings"

	"github.com/uter-ai/uter/common"

	"gorm.io/gorm"
)

// quotaDataAggregateColumns 是 quota_data 的聚合键列，与 quotaDataCacheKey
// 和 idx_qdt_agg_unique 唯一索引的列集合一一对应。
var quotaDataAggregateColumns = []string{
	"user_id", "username", "model_name", "created_at",
	"use_group", "token_id", "channel_id", "node_name",
}

// quotaDataAggregate 是某个聚合键下所有重复行的合并结果。
type quotaDataAggregate struct {
	KeepID  int64
	GroupBy []any
	Total   int
	Sum     int
	Tokens  int
}

// dedupeQuotaDataAggregatesOnce 在建 idx_qdt_agg_unique 唯一索引之前，
// 把存量库里同一聚合键的重复行合并成一行。
//
// 为什么必须先于 AutoMigrate：AutoMigrate 建唯一索引时，存量重复行会直接让
// 约束创建失败，把启动卡死。而重复行是真实存在的——多实例部署时两个节点同时
// 刷同一个 key、或旧的「先查后写」在竞态下双写，都会留下重复。
//
// 合并方式是累加 count/quota/token_used 到保留行，再删掉同组其余行，不丢任何
// 统计量。没有重复时不做任何写入。
//
// 失败只告警不阻断启动：本迁移是数据加固，不该因为它让服务起不来。
func dedupeQuotaDataAggregatesOnce() {
	if DB == nil || !common.IsMasterNode {
		return
	}
	if !DB.Migrator().HasTable(&QuotaData{}) {
		return
	}

	aggregates, err := findDuplicatedQuotaDataAggregates(DB)
	if err != nil {
		common.SysError("failed to inspect quota_data duplicates: " + err.Error())
		return
	}
	if len(aggregates) == 0 {
		return
	}

	common.SysLog(fmt.Sprintf("quota_data contains %d duplicated aggregate keys; merging before adding unique index", len(aggregates)))
	err = DB.Transaction(func(tx *gorm.DB) error {
		// 事务内复查一次：与并发刷盘叠加时，上面的快照可能已经过时。
		current, err := findDuplicatedQuotaDataAggregates(tx)
		if err != nil {
			return err
		}
		for _, agg := range current {
			if err := mergeQuotaDataAggregate(tx, agg); err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		common.SysError("failed to merge duplicated quota_data rows: " + err.Error())
		return
	}
	common.SysLog(fmt.Sprintf("merged %d duplicated quota_data aggregate keys", len(aggregates)))
}

// findDuplicatedQuotaDataAggregates 找出所有「同一聚合键有多行」的分组，
// 并带上每组的累加值与要保留的行 id（最小 id）。
func findDuplicatedQuotaDataAggregates(db *gorm.DB) ([]quotaDataAggregate, error) {
	selectSQL := fmt.Sprintf(
		"SELECT MIN(id) AS keep_id, SUM(count) AS total, SUM(quota) AS sum, SUM(token_used) AS token_used, %s FROM quota_data GROUP BY %s HAVING COUNT(*) > 1",
		strings.Join(quotaDataAggregateColumns, ", "),
		strings.Join(quotaDataAggregateColumns, ", "),
	)
	rows, err := db.Raw(selectSQL).Rows()
	if err != nil {
		return nil, fmt.Errorf("query duplicated quota_data rows: %w", err)
	}
	defer rows.Close()

	var aggregates []quotaDataAggregate
	for rows.Next() {
		agg := quotaDataAggregate{GroupBy: make([]any, len(quotaDataAggregateColumns))}
		// 列顺序与 selectSQL 一致：keep_id、三个 SUM、再跟聚合键列。
		//
		// 注意：每个聚合键列必须绑定到【独立的】元素指针。若像
		// `for range cols { targets = append(targets, &groupBy) }` 那样反复取
		// 同一个变量的地址，所有列都会写进同一格，只有最后一列被读出来 ——
		// 去重会因此「查不到重复」而静默失效。
		targets := make([]any, 0, 4+len(quotaDataAggregateColumns))
		targets = append(targets, &agg.KeepID, &agg.Total, &agg.Sum, &agg.Tokens)
		for i := range agg.GroupBy {
			targets = append(targets, &agg.GroupBy[i])
		}
		if err := rows.Scan(targets...); err != nil {
			return nil, fmt.Errorf("scan duplicated quota_data row: %w", err)
		}
		aggregates = append(aggregates, agg)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate duplicated quota_data rows: %w", err)
	}
	return aggregates, nil
}

// mergeQuotaDataAggregate 把一组的统计量累加到保留行，并删除其余行。
func mergeQuotaDataAggregate(tx *gorm.DB, agg quotaDataAggregate) error {
	where, args := quotaDataAggregateWhere(agg)
	if err := tx.Table("quota_data").
		Where("id = ?", agg.KeepID).
		Updates(map[string]any{
			"count":      agg.Total,
			"quota":      agg.Sum,
			"token_used": agg.Tokens,
		}).Error; err != nil {
		return fmt.Errorf("merge quota_data aggregate %d: %w", agg.KeepID, err)
	}
	// Delete 用作用域而非 Table().Delete()，避免 gorm 把 QuotaData 当模型推断主键。
	if err := tx.Where(where+" AND id <> ?", append(args, agg.KeepID)...).
		Delete(&QuotaData{}).Error; err != nil {
		return fmt.Errorf("drop duplicated quota_data rows for %d: %w", agg.KeepID, err)
	}
	return nil
}

// quotaDataAggregateWhere 构造按聚合键定位一行的 WHERE 子句与绑定参数。
// 列顺序与 quotaDataAggregateColumns、agg.GroupBy 严格一致。
func quotaDataAggregateWhere(agg quotaDataAggregate) (string, []any) {
	conditions := make([]string, 0, len(quotaDataAggregateColumns))
	for _, column := range quotaDataAggregateColumns {
		conditions = append(conditions, column+" = ?")
	}
	return strings.Join(conditions, " AND "), agg.GroupBy
}
