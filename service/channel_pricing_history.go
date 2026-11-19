package service

import (
	"strings"
	"time"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/model"
)

const ChannelPricingHistoryKey = "ChannelPricingHistory"
const channelPricingHistoryLimit = 1000

// ChannelPricingHistoryEntry records one internal sale-price change.
type ChannelPricingHistoryEntry struct {
	ChannelID  int                           `json:"channel_id"`
	ModelName  string                        `json:"model_name"`
	Source     string                        `json:"source"`
	OldPricing *model.ChannelInternalPricing `json:"old_pricing,omitempty"`
	NewPricing *model.ChannelInternalPricing `json:"new_pricing,omitempty"`
	ChangedAt  time.Time                     `json:"changed_at"`
}

type channelPricingHistorySetting struct {
	Entries []ChannelPricingHistoryEntry `json:"entries"`
}

// AppendChannelPricingHistory adds one change and keeps a bounded log.
func AppendChannelPricingHistory(entry ChannelPricingHistoryEntry) error {
	if entry.ChannelID <= 0 || strings.TrimSpace(entry.ModelName) == "" {
		return nil
	}
	entry.ChangedAt = time.Now().UTC()
	setting := channelPricingHistorySetting{}
	if raw := strings.TrimSpace(common.OptionMap[ChannelPricingHistoryKey]); raw != "" {
		_ = common.UnmarshalJsonStr(raw, &setting)
	}
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

// ListChannelPricingHistory returns one channel's entries, newest first.
func ListChannelPricingHistory(channelID int) []ChannelPricingHistoryEntry {
	raw := strings.TrimSpace(common.OptionMap[ChannelPricingHistoryKey])
	if raw == "" || channelID <= 0 {
		return []ChannelPricingHistoryEntry{}
	}
	var setting channelPricingHistorySetting
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
