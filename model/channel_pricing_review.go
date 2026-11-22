package model

import (
	"errors"
	"math"
	"time"

	"gorm.io/gorm"
)

const (
	ChannelPricingReviewStatusPending  = "pending"
	ChannelPricingReviewStatusApproved = "approved"
	ChannelPricingReviewStatusRejected = "rejected"
)

// ChannelPricingReview is one upstream price change waiting for an operator.
type ChannelPricingReview struct {
	ID        int64  `gorm:"primaryKey;autoIncrement"`
	ChannelID int    `gorm:"index:idx_channel_pricing_review_channel"`
	ModelName string `gorm:"size:255;index:idx_channel_pricing_review_model"`
	// Identity and PricingVersion tie the review to the exact row and price
	// state it was raised on; approval must not apply to a newer state.
	Provider       string `gorm:"size:64"`
	Region         string `gorm:"size:64"`
	DeploymentId   string `gorm:"size:128"`
	PricingVersion string `gorm:"size:64"`
	// SyncStartedAt ties the review to the sync attempt that raised it; the
	// channel's channel_sync_states row carries the same last_started_at.
	SyncStartedAt int64   `gorm:"index"`
	Field         string  `gorm:"size:64"`
	Old           float64 `gorm:"type:decimal(20,10)"`
	New           float64 `gorm:"type:decimal(20,10)"`
	Percent       float64 `gorm:"type:decimal(20,10)"`
	Status        string  `gorm:"size:32;index"`
	// Decision records who approved or rejected the change and why.
	ReviewerID   int    `gorm:"index"`
	ReviewerName string `gorm:"size:128"`
	Note         string `gorm:"size:512"`
	DecidedAt    int64  `gorm:"index"`
	CreatedAt    int64  `gorm:"index"`
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
			// A change that was already approved or rejected must not be
			// re-queued on every sync: the operator's decision covers this
			// exact old/new pair. Explicit values are compared in Go so no
			// dialect-specific quoting of the `new` column is needed.
			var decided []ChannelPricingReview
			if err := tx.Where("channel_id = ? AND model_name = ? AND field = ? AND status IN ?",
				row.ChannelID, row.ModelName, row.Field,
				[]string{ChannelPricingReviewStatusApproved, ChannelPricingReviewStatusRejected}).
				Find(&decided).Error; err != nil {
				return err
			}
			alreadyDecided := false
			for _, entry := range decided {
				if math.Abs(entry.New-row.New) < 1e-9 {
					alreadyDecided = true
					break
				}
			}
			if alreadyDecided {
				continue
			}
			if err := tx.Create(&row).Error; err != nil {
				return err
			}
		}
		return nil
	})
}

func ListChannelPricingReviews(channelID int) ([]ChannelPricingReview, error) {
	return ListChannelPricingReviewsByStatus(channelID, ChannelPricingReviewStatusPending)
}

// ListChannelPricingReviewsByStatus lists reviews for one channel. Empty status
// means pending; "all" returns every recorded decision.
func ListChannelPricingReviewsByStatus(channelID int, status string) ([]ChannelPricingReview, error) {
	if DB == nil {
		return nil, errors.New("database is not initialized")
	}
	query := DB.Where("channel_id = ?", channelID)
	switch status {
	case "", ChannelPricingReviewStatusPending:
		query = query.Where("status = ?", ChannelPricingReviewStatusPending)
	case "all":
	default:
		query = query.Where("status = ?", status)
	}
	var rows []ChannelPricingReview
	err := query.Order("created_at DESC, id DESC").Find(&rows).Error
	return rows, err
}

// DecideChannelPricingReviews moves every pending row of one channel to the
// given decision. Approved and rejected rows stay as audit history.
func DecideChannelPricingReviews(channelID int, status string, reviewerID int, reviewerName, note string) (int64, error) {
	if DB == nil {
		return 0, errors.New("database is not initialized")
	}
	if status != ChannelPricingReviewStatusApproved && status != ChannelPricingReviewStatusRejected {
		return 0, errors.New("review decision must be approved or rejected")
	}
	result := DB.Model(&ChannelPricingReview{}).
		Where("channel_id = ? AND status = ?", channelID, ChannelPricingReviewStatusPending).
		Updates(map[string]any{
			"status":        status,
			"reviewer_id":   reviewerID,
			"reviewer_name": reviewerName,
			"note":          note,
			"decided_at":    time.Now().Unix(),
		})
	return result.RowsAffected, result.Error
}

func ClearChannelPricingReviews(channelID int) error {
	if DB == nil {
		return errors.New("database is not initialized")
	}
	return DB.Where("channel_id = ? AND status = ?", channelID, ChannelPricingReviewStatusPending).
		Delete(&ChannelPricingReview{}).Error
}
