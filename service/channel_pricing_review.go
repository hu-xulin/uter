package service

import (
	"math"
	"strings"
	"time"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/model"
)

const ChannelPricingReviewKey = "ChannelPricingReviews"
const channelPricingReviewLimit = 500

// ChannelPricingReviewEntry is one upstream price change that needs approval
// before the scheduled rule may touch the channel's effective price.
type ChannelPricingReviewEntry struct {
	ID        int64     `json:"id,omitempty"`
	ChannelID int       `json:"channel_id"`
	ModelName string    `json:"model_name"`
	Field     string    `json:"field"`
	Old       float64   `json:"old"`
	New       float64   `json:"new"`
	Percent   float64   `json:"percent"`
	CreatedAt time.Time `json:"created_at"`
}

type channelPricingReviewSetting struct {
	Entries []ChannelPricingReviewEntry `json:"entries"`
}

func channelPricingReviewRaw() channelPricingReviewSetting {
	setting := channelPricingReviewSetting{}
	if raw := strings.TrimSpace(common.GetOption(ChannelPricingReviewKey)); raw != "" {
		_ = common.UnmarshalJsonStr(raw, &setting)
	}
	return setting
}

// BuildChannelPricingReviews keeps only model changes above the threshold that
// belong to the channel's served models.
func BuildChannelPricingReviews(
	changes []UpstreamPriceChange,
	channelID int,
	channelModels []string,
	thresholdPercent float64,
) []ChannelPricingReviewEntry {
	wanted := make(map[string]bool, len(channelModels))
	for _, name := range channelModels {
		wanted[strings.TrimSpace(name)] = true
	}
	out := make([]ChannelPricingReviewEntry, 0)
	for _, change := range changes {
		if change.Kind != "price_changed" || change.Old == nil || change.New == nil {
			continue
		}
		if len(wanted) > 0 && !wanted[change.ModelID] {
			continue
		}
		oldValue, newValue := *change.Old, *change.New
		if oldValue <= 0 {
			continue
		}
		percent := math.Abs(newValue-oldValue) / oldValue * 100
		if thresholdPercent > 0 && percent < thresholdPercent {
			continue
		}
		out = append(out, ChannelPricingReviewEntry{
			ChannelID: channelID, ModelName: change.ModelID, Field: change.Field,
			Old: oldValue, New: newValue, Percent: percent,
			CreatedAt: time.Now().UTC(),
		})
	}
	return out
}

// AppendChannelPricingReviews adds pending entries, replacing an existing
// pending entry for the same channel/model/field. The durable table is primary;
// the option log is a fallback during upgrades.
func AppendChannelPricingReviews(entries []ChannelPricingReviewEntry) error {
	if len(entries) == 0 {
		return nil
	}
	rows := make([]model.ChannelPricingReview, 0, len(entries))
	for _, entry := range entries {
		rows = append(rows, model.ChannelPricingReview{
			ChannelID: entry.ChannelID, ModelName: entry.ModelName, Field: entry.Field,
			Old: entry.Old, New: entry.New, Percent: entry.Percent,
			CreatedAt: entry.CreatedAt.Unix(),
		})
	}
	if err := model.AppendChannelPricingReviews(rows); err == nil {
		return nil
	} else {
		common.SysError("append channel pricing review table failed: " + err.Error())
	}
	return appendChannelPricingReviewsOption(entries)
}

func ListChannelPricingReviews(channelID int) []ChannelPricingReviewEntry {
	if rows, err := model.ListChannelPricingReviews(channelID); err == nil {
		out := make([]ChannelPricingReviewEntry, 0, len(rows))
		for _, row := range rows {
			out = append(out, ChannelPricingReviewEntry{
				ID: row.ID, ChannelID: row.ChannelID, ModelName: row.ModelName,
				Field: row.Field, Old: row.Old, New: row.New, Percent: row.Percent,
				CreatedAt: time.Unix(row.CreatedAt, 0).UTC(),
			})
		}
		return out
	}
	return listChannelPricingReviewsOption(channelID)
}

func appendChannelPricingReviewsOption(entries []ChannelPricingReviewEntry) error {
	setting := channelPricingReviewRaw()
	for _, entry := range entries {
		kept := setting.Entries[:0]
		for _, existing := range setting.Entries {
			if existing.ChannelID == entry.ChannelID &&
				existing.ModelName == entry.ModelName &&
				existing.Field == entry.Field {
				continue
			}
			kept = append(kept, existing)
		}
		setting.Entries = append(kept, entry)
	}
	if len(setting.Entries) > channelPricingReviewLimit {
		setting.Entries = setting.Entries[len(setting.Entries)-channelPricingReviewLimit:]
	}
	raw, err := common.Marshal(setting)
	if err != nil {
		return err
	}
	return model.UpdateOption(ChannelPricingReviewKey, string(raw))
}

func listChannelPricingReviewsOption(channelID int) []ChannelPricingReviewEntry {
	setting := channelPricingReviewRaw()
	out := make([]ChannelPricingReviewEntry, 0)
	for _, entry := range setting.Entries {
		if entry.ChannelID == channelID {
			out = append(out, entry)
		}
	}
	return out
}

// ClearChannelPricingReviews removes every pending entry for one channel.
func ClearChannelPricingReviews(channelID int) error {
	if err := model.ClearChannelPricingReviews(channelID); err == nil {
		_ = clearChannelPricingReviewsOption(channelID)
		return nil
	}
	return clearChannelPricingReviewsOption(channelID)
}

func clearChannelPricingReviewsOption(channelID int) error {
	setting := channelPricingReviewRaw()
	kept := setting.Entries[:0]
	for _, entry := range setting.Entries {
		if entry.ChannelID != channelID {
			kept = append(kept, entry)
		}
	}
	setting.Entries = kept
	raw, err := common.Marshal(setting)
	if err != nil {
		return err
	}
	return model.UpdateOption(ChannelPricingReviewKey, string(raw))
}
