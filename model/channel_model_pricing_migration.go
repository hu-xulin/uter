package model

import (
	"fmt"

	"github.com/uter-ai/uter/common"
	"gorm.io/gorm"
)

const legacyChannelPricingIndex = "idx_channel_model_pricing"

// PrepareChannelModelPricingIdentity upgrades the channel price table from the
// legacy (channel, model) identity to the full upstream identity. Duplicate
// rows under the new key are merged first, because the new unique index cannot
// be created while duplicates exist. The legacy unique index is then dropped;
// AutoMigrate creates the identity index afterwards.
func PrepareChannelModelPricingIdentity(db *gorm.DB) error {
	if db == nil || !db.Migrator().HasTable(&ChannelModelPricing{}) {
		return nil
	}
	type identityGroup struct {
		ChannelId    int
		Provider     string
		Region       string
		DeploymentId string
		ModelName    string
		RowCount     int64
	}
	var groups []identityGroup
	if err := db.Model(&ChannelModelPricing{}).
		Select("channel_id, provider, region, deployment_id, model_name, COUNT(*) AS row_count").
		Group("channel_id, provider, region, deployment_id, model_name").
		Having("COUNT(*) > 1").
		Scan(&groups).Error; err != nil {
		return err
	}
	merged := 0
	for _, group := range groups {
		var rows []ChannelModelPricing
		if err := db.Where(
			"channel_id = ? AND provider = ? AND region = ? AND deployment_id = ? AND model_name = ?",
			group.ChannelId, group.Provider, group.Region, group.DeploymentId, group.ModelName,
		).Order("updated_at DESC").Order("id DESC").Find(&rows).Error; err != nil {
			return err
		}
		keeper := channelPricingIdentityKeeper(rows)
		for _, row := range rows {
			if row.Id == keeper.Id {
				continue
			}
			if err := db.Delete(&ChannelModelPricing{}, row.Id).Error; err != nil {
				return err
			}
			merged++
		}
	}
	if merged > 0 {
		common.SysLog(fmt.Sprintf(
			"channel pricing identity migration merged %d duplicate rows", merged))
	}
	if db.Migrator().HasIndex(&ChannelModelPricing{}, legacyChannelPricingIndex) {
		if err := db.Migrator().DropIndex(&ChannelModelPricing{}, legacyChannelPricingIndex); err != nil {
			return err
		}
	}
	return nil
}

// channelPricingIdentityKeeper keeps the row that billing already uses: a row
// with an operator price wins, then the most recently updated row.
func channelPricingIdentityKeeper(rows []ChannelModelPricing) ChannelModelPricing {
	for _, row := range rows {
		if row.PricingStatus == ChannelPricingStatusConfigured && row.InternalPricing != "" {
			return row
		}
	}
	return rows[0]
}
