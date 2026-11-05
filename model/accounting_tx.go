package model

import (
	"errors"

	"gorm.io/gorm"
)

// adjustUserUsedQuotaTx applies a user usage delta in the caller's primary-DB
// transaction. It bypasses the asynchronous batch queue and cache; callers
// must invalidate or rehydrate cache only after commit.
func adjustUserUsedQuotaTx(tx *gorm.DB, userID int, delta int) error {
	if tx == nil {
		return errors.New("user usage transaction is nil")
	}
	if userID <= 0 {
		return errors.New("user ID must be positive")
	}
	if delta == 0 {
		return nil
	}

	query := tx.Model(&User{}).Where("id = ?", userID)
	if delta < 0 {
		query = query.Where("used_quota >= ?", -delta)
	}
	result := query.Update("used_quota", gorm.Expr("used_quota + ?", delta))
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		var count int64
		if err := tx.Model(&User{}).Where("id = ?", userID).Count(&count).Error; err != nil {
			return err
		}
		if count == 0 {
			return gorm.ErrRecordNotFound
		}
		if delta < 0 {
			return errors.New("user used quota is insufficient for negative adjustment")
		}
		return gorm.ErrRecordNotFound
	}
	return nil
}

// adjustChannelUsedQuotaTx applies a channel usage delta in the caller's
// primary-DB transaction. It intentionally avoids UpdateChannelUsedQuota,
// which may enqueue an in-memory batch update and cannot participate in the
// caller's transaction.
func adjustChannelUsedQuotaTx(tx *gorm.DB, channelID int, delta int) error {
	if tx == nil {
		return errors.New("channel usage transaction is nil")
	}
	if channelID <= 0 {
		return errors.New("channel ID must be positive")
	}
	if delta == 0 {
		return nil
	}

	query := tx.Model(&Channel{}).Where("id = ?", channelID)
	if delta < 0 {
		query = query.Where("used_quota >= ?", -delta)
	}
	result := query.Update("used_quota", gorm.Expr("used_quota + ?", delta))
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		var count int64
		if err := tx.Model(&Channel{}).Where("id = ?", channelID).Count(&count).Error; err != nil {
			return err
		}
		if count == 0 {
			return gorm.ErrRecordNotFound
		}
		if delta < 0 {
			return errors.New("channel used quota is insufficient for negative adjustment")
		}
		return gorm.ErrRecordNotFound
	}
	return nil
}


// RecordMidjourneyTaskUsage synchronously persists the user request/usage and
// channel usage in one primary-DB transaction. Midjourney refunds depend on
// these values being durable before a failed task can be refunded; the generic
// batch queue is intentionally bypassed.
func RecordMidjourneyTaskUsage(userID int, channelID int, quota int) error {
	if userID <= 0 || channelID <= 0 {
		return errors.New("Midjourney usage requires positive user and channel IDs")
	}
	if quota < 0 {
		return errors.New("Midjourney usage quota cannot be negative")
	}
	return DB.Transaction(func(tx *gorm.DB) error {
		userResult := tx.Model(&User{}).
			Where("id = ?", userID).
			Updates(map[string]any{
				"used_quota":    gorm.Expr("used_quota + ?", quota),
				"request_count": gorm.Expr("request_count + ?", 1),
			})
		if userResult.Error != nil {
			return userResult.Error
		}
		if userResult.RowsAffected == 0 {
			return gorm.ErrRecordNotFound
		}

		channelQuery := tx.Model(&Channel{}).Where("id = ?", channelID)
		channelResult := channelQuery.Update("used_quota", gorm.Expr("used_quota + ?", quota))
		if channelResult.Error != nil {
			return channelResult.Error
		}
		if channelResult.RowsAffected == 0 {
			var count int64
			if err := tx.Model(&Channel{}).Where("id = ?", channelID).Count(&count).Error; err != nil {
				return err
			}
			if count == 0 {
				return gorm.ErrRecordNotFound
			}
		}
		return nil
	})
}
