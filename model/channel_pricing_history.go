package model

import (
	"errors"
	"time"

	"gorm.io/gorm"
)

// ChannelPricingHistory is one durable internal-price change. The operator's
// sale price is stored as JSON so old/new entries stay comparable even when the
// pricing shape evolves.
type ChannelPricingHistory struct {
	ID           int64  `gorm:"primaryKey;autoIncrement"`
	ChannelID    int    `gorm:"index:idx_channel_pricing_history_channel"`
	ModelName    string `gorm:"size:255;index:idx_channel_pricing_history_model"`
	Provider     string `gorm:"size:64;index:idx_channel_pricing_history_provider"`
	Region       string `gorm:"size:64"`
	DeploymentId string `gorm:"size:128"`
	Source       string `gorm:"size:32"`
	OldPricing   string `gorm:"type:text"`
	NewPricing   string `gorm:"type:text"`
	ChangedAt    int64  `gorm:"index:idx_channel_pricing_history_time"`
}

func (ChannelPricingHistory) TableName() string { return "channel_pricing_history" }

func AppendChannelPricingHistory(row ChannelPricingHistory) error {
	if DB == nil {
		return errors.New("database is not initialized")
	}
	if row.ChannelID <= 0 || row.ModelName == "" {
		return errors.New("channel and model are required")
	}
	if row.ChangedAt == 0 {
		row.ChangedAt = time.Now().Unix()
	}
	return DB.Create(&row).Error
}

func ListChannelPricingHistory(channelID int, limit int) ([]ChannelPricingHistory, error) {
	if DB == nil {
		return nil, errors.New("database is not initialized")
	}
	query := DB.Where("channel_id = ?", channelID).Order("changed_at DESC, id DESC")
	if limit > 0 {
		query = query.Limit(limit)
	}
	var rows []ChannelPricingHistory
	err := query.Find(&rows).Error
	return rows, err
}

func GetChannelPricingHistoryByID(id int64) (*ChannelPricingHistory, error) {
	if DB == nil {
		return nil, errors.New("database is not initialized")
	}
	var row ChannelPricingHistory
	if err := DB.First(&row, id).Error; err != nil {
		return nil, err
	}
	return &row, nil
}

// EnsureChannelPricingHistoryTable is used by migrations/tests.
func EnsureChannelPricingHistoryTable(db *gorm.DB) error {
	return db.AutoMigrate(&ChannelPricingHistory{})
}
