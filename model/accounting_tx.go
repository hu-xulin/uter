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

	result := tx.Model(&User{}).
		Where("id = ?", userID).
		Update("used_quota", gorm.Expr("used_quota + ?", delta))
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
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

	result := tx.Model(&Channel{}).
		Where("id = ?", channelID).
		Update("used_quota", gorm.Expr("used_quota + ?", delta))
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}
