package model

import (
	"database/sql"
	"strings"
)

// GetLatestSystemTaskIDs returns the id of the newest row of each type that
// has one. Every type is its own MAX(id) subquery, which each database answers
// from the (type, id) index without reading older rows.
func GetLatestSystemTaskIDs(taskTypes []string) (map[string]int64, error) {
	ids := make(map[string]int64, len(taskTypes))
	if len(taskTypes) == 0 {
		return ids, nil
	}
	columns := make([]string, len(taskTypes))
	subQueries := make([]any, len(taskTypes))
	for i, taskType := range taskTypes {
		columns[i] = "(?)"
		subQueries[i] = DB.Model(&SystemTask{}).Select("MAX(id)").Where("type = ?", taskType)
	}
	rows, err := DB.Raw("SELECT "+strings.Join(columns, ", "), subQueries...).Rows()
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	latest := make([]sql.NullInt64, len(taskTypes))
	dest := make([]any, len(latest))
	for i := range latest {
		dest[i] = &latest[i]
	}
	if rows.Next() {
		if err := rows.Scan(dest...); err != nil {
			return nil, err
		}
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	for i, taskType := range taskTypes {
		if latest[i].Valid {
			ids[taskType] = latest[i].Int64
		}
	}
	return ids, nil
}
