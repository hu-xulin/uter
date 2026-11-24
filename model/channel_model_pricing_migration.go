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

// PrepareChannelModelPricingOwner backfills the explicit ownership column for
// historical rows. Source labels remain audit data; the resulting owner is the
// single authority used by sync, review and provider-identity cleanup. Rows with
// no recognizable automatic source default to OPERATOR so a migration can never
// make an operator-entered price replaceable.
func PrepareChannelModelPricingOwner(db *gorm.DB) error {
	if db == nil || !db.Migrator().HasTable(&ChannelModelPricing{}) {
		return nil
	}
	if !db.Migrator().HasColumn(&ChannelModelPricing{}, "pricing_owner") {
		if err := db.Migrator().AddColumn(&ChannelModelPricing{}, "PricingOwner"); err != nil {
			return fmt.Errorf("add pricing_owner column: %w", err)
		}
	}
	type ownerSource struct {
		Id              int64
		PricingSource   string
		InternalPricing string
	}
	var rows []ownerSource
	if err := db.Model(&ChannelModelPricing{}).
		Where("pricing_owner IS NULL OR pricing_owner = ''").
		Select("id, pricing_source, internal_pricing").
		Find(&rows).Error; err != nil {
		return err
	}
	updated := 0
	for _, row := range rows {
		owner := PricingOwnerForSource(row.PricingSource)
		if owner == "" {
			owner = PricingOwnerForSource(internalPricingSource(row.InternalPricing))
		}
		if owner == "" {
			owner = ChannelPricingOwnerOperator
		}
		if err := db.Model(&ChannelModelPricing{}).Where("id = ?", row.Id).
			UpdateColumn("pricing_owner", owner).Error; err != nil {
			return err
		}
		updated++
	}
	const ownerIndex = "idx_channel_model_pricing_pricing_owner"
	if !db.Migrator().HasIndex(&ChannelModelPricing{}, ownerIndex) {
		if err := db.Exec(
			"CREATE INDEX idx_channel_model_pricing_pricing_owner ON channel_model_pricing(pricing_owner)",
		).Error; err != nil {
			return fmt.Errorf("create pricing_owner index: %w", err)
		}
	}
	if updated > 0 {
		common.SysLog(fmt.Sprintf("channel pricing owner migration backfilled %d rows", updated))
	}
	return nil
}
