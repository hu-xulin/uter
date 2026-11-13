package model

import (
	"context"
)

// systemTaskCleanupBatchSize is how many finished rows one cleanup pass
// removes, so a large history never holds one long transaction.
const systemTaskCleanupBatchSize = 500

// DeleteFinishedSystemTasks deletes, in batches, the succeeded and failed rows
// last updated before cutoff. The newest row of every type stays: the
// scheduler and the node sync read it. A row that becomes the newest later is
// never removed.
func DeleteFinishedSystemTasks(ctx context.Context, cutoff int64) (int64, error) {
	var newestIDs []int64
	if err := DB.Model(&SystemTask{}).Group("type").Pluck("MAX(id)", &newestIDs).Error; err != nil {
		return 0, err
	}
	var deleted int64
	for {
		if err := ctx.Err(); err != nil {
			return deleted, err
		}
		query := DB.Model(&SystemTask{}).Where("status IN ? AND updated_at < ?", []SystemTaskStatus{SystemTaskStatusSucceeded, SystemTaskStatusFailed}, cutoff)
		if len(newestIDs) > 0 {
			query = query.Where("id NOT IN ?", newestIDs)
		}
		// MySQL rejects LIMIT in an IN subquery: read the ids, then delete them.
		var ids []int64
		if err := query.Order("id").Limit(systemTaskCleanupBatchSize).Pluck("id", &ids).Error; err != nil {
			return deleted, err
		}
		if len(ids) == 0 {
			return deleted, nil
		}
		result := DB.Where("id IN ?", ids).Delete(&SystemTask{})
		if result.Error != nil {
			return deleted, result.Error
		}
		deleted += result.RowsAffected
		if len(ids) < systemTaskCleanupBatchSize {
			return deleted, nil
		}
	}
}
