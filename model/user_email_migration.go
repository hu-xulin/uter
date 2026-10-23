package model

import (
	"fmt"

	"github.com/uter-ai/uter/common"

	"gorm.io/gorm"
)

// 邮箱大小写归一化迁移。
//
// 背景：users.email 上的索引 idx_users_email 建在原始列上，而所有查询都用
// LOWER(email) = ?（model/user.go 的 CheckUserExistOrDeleted / emailQuery /
// GetUniqueUserByEmail），函数包裹让索引完全失效，登录、注册查重、找回密码
// 三条路径都退化为全表扫描。
//
// 修法是把写入侧和查询侧对齐到同一个口径：写入早已统一小写（NormalizeEmail），
// 这里把存量行也回填成小写，之后查询改用 email = ? 命中 idx_users_email。
//
// 唯一不能自动处理的情况是「仅大小写不同」的重复邮箱：回填会让两行变成同一个值，
// 若同时把查询改成等值比较，这两行的属主会互相看到对方的账号（重复注册 / 找回密码
// 串号）。因此这类库**整体跳过**：不回填、不切换查询口径，保持现有行为，并打一条
// 可执行的错误日志交给运维处理。跳过是每进程启动时重新判定的，运维修完数据后重启
// 即自动收敛。
func migrateUserEmailNormalization(db *gorm.DB) error {
	if db == nil {
		return nil
	}

	var duplicates struct {
		Count int64 `gorm:"column:duplicate_groups"`
	}
	if err := db.Raw(`
SELECT COUNT(*) AS duplicate_groups
FROM (
    SELECT LOWER(TRIM(email)) AS normalized_email
    FROM users
    WHERE email <> ''
    GROUP BY LOWER(TRIM(email))
    HAVING COUNT(*) > 1
) AS duplicate_emails`).Scan(&duplicates).Error; err != nil {
		return fmt.Errorf("check duplicate user emails: %w", err)
	}

	if duplicates.Count > 0 {
		emailLookupNormalized.Store(false)
		common.SysError(common.LogText(
			"user email normalization skipped: %d email address(es) are shared by multiple accounts ignoring case; "+
				"email lookups stay on LOWER(email) until they are resolved", duplicates.Count))
		return nil
	}

	if err := db.Exec(`
UPDATE users
SET email = LOWER(TRIM(email))
WHERE email <> '' AND email <> LOWER(TRIM(email))`).Error; err != nil {
		return fmt.Errorf("normalize user emails: %w", err)
	}

	emailLookupNormalized.Store(true)
	return nil
}
