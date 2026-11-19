package model

import (
	"errors"
	"time"

	"gorm.io/gorm"
)

const ChannelPricingReviewStatusPending = "pending"

// ChannelPricingReview is one upstream price change waiting for an operator.
type ChannelPricingReview struct {
	ID        int64   `gorm:"primaryKey;autoIncrement"`
	ChannelID int     `gorm:"index:idx_channel_pricing_review_channel"`
	ModelName string  `gorm:"size:255;index:idx_channel_pricing_review_model"`
	Field     string  `gorm:"size:64"`
	Old       float64 `gorm:"type:decimal(20,10)"`
	New       float64 `gorm:"type:decimal(20,10)"`
	Percent   float64 `gorm:"type:decimal(20,10)"`
	Status    string  `gorm:"size:32;index"`
	CreatedAt int64   `gorm:"index"`
}

func (ChannelPricingReview) TableName() string { return "channel_pricing_review" }

// AppendChannelPricingReviews replaces a pending entry for the same
// channel/model/field instead of stacking duplicates across syncs.
func AppendChannelPricingReviews(rows []ChannelPricingReview) error {
	if DB == nil {
		return errors.New("database is not initialized")
	}
	if len(rows) == 0 {
		return nil
	}
	return DB.Transaction(func(tx *gorm.DB) error {
		for _, row := range rows {
			if row.ChannelID <= 0 || row.ModelName == "" {
				continue
			}
			if row.Status == "" {
				row.Status = ChannelPricingReviewStatusPending
			}
			if row.CreatedAt == 0 {
				row.CreatedAt = time.Now().Unix()
			}
			if err := tx.Where("channel_id = ? AND model_name = ? AND field = ? AND status = ?",
				row.ChannelID, row.ModelName, row.Field, ChannelPricingReviewStatusPending).
				Delete(&ChannelPricingReview{}).Error; err != nil {
				return err
			}
			if err := tx.Create(&row).Error; err != nil {
				return err
			}
		}
		return nil
	})
}

func ListChannelPricingReviews(channelID int) ([]ChannelPricingReview, error) {
	if DB == nil {
		return nil, errors.New("database is not initialized")
	}
	var rows []ChannelPricingReview
	err := DB.Where("channel_id = ? AND status = ?", channelID, ChannelPricingReviewStatusPending).
		Order("created_at DESC, id DESC").
		Find(&rows).Error
	return rows, err
}

func ClearChannelPricingReviews(channelID int) error {
	if DB == nil {
		return errors.New("database is not initialized")
	}
	return DB.Where("channel_id = ? AND status = ?", channelID, ChannelPricingReviewStatusPending).
		Delete(&ChannelPricingReview{}).Error
}
