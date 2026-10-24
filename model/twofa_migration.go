package model

import (
	"errors"

	"github.com/uter-ai/uter/common"

	"gorm.io/gorm"
)

// DefaultTwoFASecretMigrationBatch 是批量迁移的默认分批大小。
//
// 取 200 是为了在「一次事务内持有的行数」与「迁移进度可观测」之间取平衡：
// 每批独立提交，中途失败不会让整个迁移回滚，已升级的批保持升级状态。
const DefaultTwoFASecretMigrationBatch = 200

// TwoFASecretMigrationResult 汇总一次批量迁移的结果。
type TwoFASecretMigrationResult struct {
	// Scanned 是读到的记录总数（含软删除以外的全部行）。
	Scanned int
	// Encrypted 是读到时就已经是密文的记录数，本次不做任何改动。
	Encrypted int
	// Migrated 是本次由明文升级为密文的记录数。
	Migrated int
	// Failed 是升级失败的记录数。
	Failed int
	// FailedIDs 是升级失败的记录 ID，便于人工跟进与重跑。
	FailedIDs []int
}

// TotalHandled 返回已处理的记录数，用于判断迁移是否走完。
func (r TwoFASecretMigrationResult) TotalHandled() int {
	return r.Encrypted + r.Migrated + r.Failed
}

// MigrateTwoFASecretsToEncrypted 分批把历史明文 TOTP 种子升级为密文。
//
// 设计要点对应清单第八章的迁移要求：
//
//   - 分批读取：按主键游标推进，不在内存里堆全表；
//   - 避免重复加密：读到时已是密文信封的行直接跳过，明文行用条件 UPDATE
//     （id + secret 仍等于那段明文）升级，因此重复执行与并发执行都幂等；
//   - 校验迁移结果：逐行比对回写后的值确实是密文信封，不是就把这行记失败；
//   - 失败时告警并保留安全恢复路径：升级失败的行**不清除明文**，原样留在
//     库里，下次重跑仍会尝试；删掉明文等于直接销毁用户的 2FA，比晚一点迁移
//     更糟。
func MigrateTwoFASecretsToEncrypted(batchSize int) (TwoFASecretMigrationResult, error) {
	if batchSize <= 0 {
		batchSize = DefaultTwoFASecretMigrationBatch
	}

	result := TwoFASecretMigrationResult{}
	cursor := 0
	for {
		rows, err := loadTwoFASecretBatch(cursor, batchSize)
		if err != nil {
			return result, err
		}
		if len(rows) == 0 {
			break
		}

		for i := range rows {
			cursor = rows[i].Id
			result.Scanned++

			if common.IsSecretEnvelope(rows[i].Secret) {
				result.Encrypted++
				continue
			}

			migrated, err := rows[i].upgradePlainSecret(rows[i].Secret)
			if err != nil {
				result.Failed++
				result.FailedIDs = append(result.FailedIDs, rows[i].Id)
				common.SysLog(common.LogText(
					"twofa migration: failed to encrypt secret user_id=%d twofa_id=%d: %s",
					rows[i].UserId, rows[i].Id, err.Error()))
				continue
			}
			if !migrated {
				// 条件 UPDATE 没命中：这一行在读取之后被改过了（另一轮迁移或
				// 用户正在重新绑定）。不算失败，下一轮会重新读到最新值。
				result.Encrypted++
				continue
			}
			if !common.IsSecretEnvelope(rows[i].Secret) {
				result.Failed++
				result.FailedIDs = append(result.FailedIDs, rows[i].Id)
				common.SysLog(common.LogText(
					"twofa migration: post-write verification failed user_id=%d twofa_id=%d",
					rows[i].UserId, rows[i].Id))
				continue
			}
			result.Migrated++
		}

		if len(rows) < batchSize {
			break
		}
	}

	if result.Failed > 0 {
		// 汇总告警：失败行仍为明文，迁移可以整体重跑。
		common.SysLog(common.LogText(
			"twofa migration finished with %d plaintext rows left unencrypted (scanned=%d migrated=%d); rerun the migration",
			result.Failed, result.Scanned, result.Migrated))
	}
	return result, nil
}

// loadTwoFASecretBatch 按主键游标读取一批 2FA 行，只取迁移需要的列。
func loadTwoFASecretBatch(afterID int, limit int) ([]TwoFA, error) {
	var rows []TwoFA
	err := DB.Select("id", "user_id", "secret").
		Where("id > ?", afterID).
		Order("id ASC").
		Limit(limit).
		Find(&rows).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return rows, nil
}
