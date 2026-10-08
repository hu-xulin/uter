package model

import (
	"strings"

	"gorm.io/gorm"
)

// FillLocalizedDescriptions 只补齐 models.descriptions 里**缺失的语种**，
// 绝不覆盖已有文本。
//
// 它与 AutoFillOfficialMetadata 走两条独立通道：后者负责 description /
// icon / tags 等单值字段的手动向导与自动填充语义（受 MetadataSyncFields
// 白名单与 sync_official 开关约束），而这里只管多语副本，刻意不侵入那条
// 链路，以免管理员在向导里选中的字段集合被多语填充改写。
//
// 只补空白同样保证幂等：重复同步不会覆盖管理员手工润色过的译文，
// 收敛后再次调用不产生任何写入。
func FillLocalizedDescriptions(
	upstream map[string]map[string]string,
) (filled []string, err error) {
	if len(upstream) == 0 {
		return nil, nil
	}

	var records []Model
	// 必须一并取 updated_time：它是下面乐观锁的版本依据。漏取会让
	// record.UpdatedTime 恒为 0，WHERE 条件永不匹配，表现为「同步静默不生效」。
	if err := DB.Select("id", "model_name", "description", "descriptions", "updated_time").
		Where("model_name IN ?", mapKeys(upstream)).
		Find(&records).Error; err != nil {
		return nil, err
	}
	if len(records) == 0 {
		return nil, nil
	}

	byName := make(map[string]*Model, len(records))
	for i := range records {
		byName[records[i].ModelName] = &records[i]
	}

	type pending struct {
		id      int
		name    string
		merged  LocalizedDescription
		version int64
	}
	updates := make([]pending, 0, len(records))
	for _, record := range records {
		incoming := sanitizeDescription(upstream[record.ModelName])
		if len(incoming) == 0 {
			continue
		}
		// 以库里的现状为基底（而非入库值），避免同一批次内后读的记录拿到
		// 已被本函数改写的内存值。
		merged := make(LocalizedDescription, len(record.Descriptions)+len(incoming))
		for locale, text := range record.Descriptions {
			merged[locale] = text
		}
		hasNewLocale := false
		for locale, text := range incoming {
			if strings.TrimSpace(merged[locale]) != "" {
				continue
			}
			merged[locale] = text
			hasNewLocale = true
		}
		if !hasNewLocale {
			continue
		}
		updates = append(updates, pending{
			id: record.Id, name: record.ModelName,
			merged: merged, version: record.UpdatedTime,
		})
	}
	if len(updates) == 0 {
		return nil, nil
	}

	// 直接走 metadataTransaction：它内部已经持有 metadataMutationMu（同一把
	// 非可重入的 sync.Mutex），这里绝不能再加锁，否则必然自死锁。
	// 事务内的乐观锁（id + updated_time）保证多语填充不会与手动编辑交错。
	err = metadataTransaction(func(tx *gorm.DB) error {
		for _, item := range updates {
			encoded, err := item.merged.Value()
			if err != nil {
				return err
			}
			// 用 id + updated_time 做乐观锁：同步期间管理员若改过这一行，
			// updated_time 会变，此时跳过而不是覆盖他的编辑。
			res := tx.Model(&Model{}).
				Where("id = ? AND updated_time = ?", item.id, item.version).
				UpdateColumn("descriptions", encoded)
			if res.Error != nil {
				return res.Error
			}
			if res.RowsAffected > 0 {
				filled = append(filled, item.name)
			}
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return filled, nil
}

// MergeTranslatedDescriptions 写入 LLM 补译结果，同样只补空白语种。
//
// 与 FillLocalizedDescriptions 分开是因为来源不同（本地模型 vs 上游目录），
// 需要独立的日志与失败隔离：翻译失败绝不能影响上游同步已写入的描述。
func MergeTranslatedDescriptions(translated map[string]map[string]string) (filled []string, err error) {
	return FillLocalizedDescriptions(translated)
}

func mapKeys(in map[string]map[string]string) []string {
	keys := make([]string, 0, len(in))
	for key := range in {
		keys = append(keys, key)
	}
	return keys
}
