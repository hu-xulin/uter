package model

import (
	"fmt"

	"gorm.io/gorm"
)

// legacyRedundantLogIndexes 是 logs 表上已被复合索引完全覆盖的单列索引。
//
// 背景：logs 是每请求一行的最热写入表，多一棵索引就多一次写放大。模型定义里已经
// 去掉了这两列的裸 `index` tag（见 Log.UserId / Log.ModelName 的注释），但
// AutoMigrate 只建不删，存量库里的旧索引会一直留着——注释写着「已冗余」而库里
// 实际还在，等于优化没生效。
//
//   - idx_logs_user_id   → 被 idx_user_id_id(user_id, id) 的最左前缀覆盖
//   - idx_logs_model_name → 被 index_username_model_name(model_name, username) 覆盖
//
// 只删这两棵：其余单列索引（username / token_name / channel_id / group / ip …）
// 都有各自的独立查询面，复合索引的最左前缀覆盖不到。
var legacyRedundantLogIndexes = []string{"idx_logs_user_id", "idx_logs_model_name"}

// migrateLogIndexRedundancy 删除存量库中已被复合索引覆盖的单列索引。
// 幂等：索引不存在时直接跳过。
func migrateLogIndexRedundancy(db *gorm.DB) error {
	if db == nil {
		return nil
	}
	for _, name := range legacyRedundantLogIndexes {
		if !db.Migrator().HasIndex(&Log{}, name) {
			continue
		}
		if err := db.Migrator().DropIndex(&Log{}, name); err != nil {
			// 删索引失败不该拦住启动：它只影响写入放大，不影响正确性。
			// 留给运维在低峰期手工处理，日志里能看到具体是哪一棵。
			return fmt.Errorf("drop redundant log index %s: %w", name, err)
		}
	}
	return nil
}
