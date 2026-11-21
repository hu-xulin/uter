package service

import (
	"strconv"
	"strings"
	"time"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/model"
)

const ChannelPricingHistoryKey = "ChannelPricingHistory"
const channelPricingHistoryLimit = 1000

// ChannelPricingHistoryEntry records one internal sale-price change.
type ChannelPricingHistoryEntry struct {
	ID           int64                         `json:"id,omitempty"`
	ChannelID    int                           `json:"channel_id"`
	ModelName    string                        `json:"model_name"`
	Provider     string                        `json:"provider,omitempty"`
	Region       string                        `json:"region,omitempty"`
	DeploymentId string                        `json:"deployment_id,omitempty"`
	Source       string                        `json:"source"`
	OldPricing   *model.ChannelInternalPricing `json:"old_pricing,omitempty"`
	NewPricing   *model.ChannelInternalPricing `json:"new_pricing,omitempty"`
	ChangedAt    time.Time                     `json:"changed_at"`
}

// SetChannelPricingWithHistory writes the price and its audit row atomically.
// The option-log fallback is intentionally not used here: a history failure
// must fail the price change instead of leaving an unaudited price behind.
func SetChannelPricingWithHistory(
	identity model.ChannelPricingIdentity,
	pricing model.ChannelInternalPricing,
	source string,
	expectedVersion string,
	oldPricing *model.ChannelInternalPricing,
) error {
	if strings.TrimSpace(source) != "" && strings.TrimSpace(pricing.Source) == "" {
		pricing.Source = source
	}
	oldJSON, _ := common.Marshal(oldPricing)
	newJSON, _ := common.Marshal(pricing)
	return model.SetChannelInternalPricingWithAudit(identity, pricing, expectedVersion, model.ChannelPricingHistory{
		Source: source, OldPricing: string(oldJSON), NewPricing: string(newJSON),
	})
}

// AppendChannelPricingHistory writes to the durable table; the option log is a
// bounded fallback for installations where the table is not available yet.
func AppendChannelPricingHistory(entry ChannelPricingHistoryEntry) error {
	if entry.ChannelID <= 0 || strings.TrimSpace(entry.ModelName) == "" {
		return nil
	}
	entry.ChangedAt = time.Now().UTC()
	oldJSON, _ := common.Marshal(entry.OldPricing)
	newJSON, _ := common.Marshal(entry.NewPricing)
	if err := model.AppendChannelPricingHistory(model.ChannelPricingHistory{
		ChannelID: entry.ChannelID, ModelName: entry.ModelName,
		Provider: entry.Provider, Region: entry.Region, DeploymentId: entry.DeploymentId,
		Source:     entry.Source,
		OldPricing: string(oldJSON), NewPricing: string(newJSON),
		ChangedAt: entry.ChangedAt.Unix(),
	}); err == nil {
		return nil
	} else {
		common.SysError("append channel pricing history table failed: " + err.Error())
	}
	return appendChannelPricingHistoryOption(entry)
}

// ListChannelPricingHistory returns durable rows first, then falls back to the
// legacy option log.
func ListChannelPricingHistory(channelID int) []ChannelPricingHistoryEntry {
	if channelID <= 0 {
		return []ChannelPricingHistoryEntry{}
	}
	if rows, err := model.ListChannelPricingHistory(channelID, channelPricingHistoryLimit); err == nil {
		out := make([]ChannelPricingHistoryEntry, 0, len(rows))
		for _, row := range rows {
			out = append(out, channelPricingHistoryEntryFromModel(row))
		}
		return out
	}
	return listChannelPricingHistoryOption(channelID)
}

// GetChannelPricingHistoryEntry loads one durable row for rollback.
func GetChannelPricingHistoryEntry(id int64) (*ChannelPricingHistoryEntry, error) {
	row, err := model.GetChannelPricingHistoryByID(id)
	if err != nil {
		return nil, err
	}
	entry := channelPricingHistoryEntryFromModel(*row)
	return &entry, nil
}

func channelPricingHistoryEntryFromModel(row model.ChannelPricingHistory) ChannelPricingHistoryEntry {
	entry := ChannelPricingHistoryEntry{
		ID: row.ID, ChannelID: row.ChannelID, ModelName: row.ModelName,
		Provider: row.Provider, Region: row.Region, DeploymentId: row.DeploymentId,
		Source: row.Source, ChangedAt: time.Unix(row.ChangedAt, 0).UTC(),
	}
	if strings.TrimSpace(row.OldPricing) != "" {
		var oldPricing model.ChannelInternalPricing
		if err := common.UnmarshalJsonStr(row.OldPricing, &oldPricing); err == nil {
			entry.OldPricing = &oldPricing
		}
	}
	if strings.TrimSpace(row.NewPricing) != "" {
		var newPricing model.ChannelInternalPricing
		if err := common.UnmarshalJsonStr(row.NewPricing, &newPricing); err == nil {
			entry.NewPricing = &newPricing
		}
	}
	return entry
}

type channelPricingHistoryOptionSetting struct {
	Entries []ChannelPricingHistoryEntry `json:"entries"`
}

func appendChannelPricingHistoryOption(entry ChannelPricingHistoryEntry) error {
	setting := channelPricingHistoryOptionSetting{}
	if raw := strings.TrimSpace(common.GetOption(ChannelPricingHistoryKey)); raw != "" {
		_ = common.UnmarshalJsonStr(raw, &setting)
	}
	entry.ID = 0
	setting.Entries = append(setting.Entries, entry)
	if len(setting.Entries) > channelPricingHistoryLimit {
		setting.Entries = setting.Entries[len(setting.Entries)-channelPricingHistoryLimit:]
	}
	raw, err := common.Marshal(setting)
	if err != nil {
		return err
	}
	return model.UpdateOption(ChannelPricingHistoryKey, string(raw))
}

func listChannelPricingHistoryOption(channelID int) []ChannelPricingHistoryEntry {
	raw := strings.TrimSpace(common.GetOption(ChannelPricingHistoryKey))
	if raw == "" {
		return []ChannelPricingHistoryEntry{}
	}
	var setting channelPricingHistoryOptionSetting
	if err := common.UnmarshalJsonStr(raw, &setting); err != nil {
		return []ChannelPricingHistoryEntry{}
	}
	out := make([]ChannelPricingHistoryEntry, 0)
	for i := len(setting.Entries) - 1; i >= 0; i-- {
		if setting.Entries[i].ChannelID == channelID {
			out = append(out, setting.Entries[i])
		}
	}
	return out
}

// ParseHistoryID is a small helper for controller routes.
func ParseHistoryID(raw string) (int64, error) {
	return strconv.ParseInt(strings.TrimSpace(raw), 10, 64)
}
