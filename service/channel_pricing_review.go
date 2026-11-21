package service

import (
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/model"
	"github.com/uter-ai/uter/relaykit/dto"
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
	Status    string    `json:"status,omitempty"`
	Reviewer  string    `json:"reviewer,omitempty"`
	Note      string    `json:"note,omitempty"`
	DecidedAt int64     `json:"decided_at,omitempty"`
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
		notifyPricingReviewAdmins(entries)
		return nil
	} else {
		common.SysError("append channel pricing review table failed: " + err.Error())
	}
	if err := appendChannelPricingReviewsOption(entries); err != nil {
		return err
	}
	notifyPricingReviewAdmins(entries)
	return nil
}

// notifyPricingReviewAdmins tells administrators that upstream prices moved
// beyond the configured threshold and are waiting for a decision. Delivery
// failures never block the sync itself.
func notifyPricingReviewAdmins(entries []ChannelPricingReviewEntry) {
	if len(entries) == 0 {
		return
	}
	channelID := entries[0].ChannelID
	name := fmt.Sprintf("#%d", channelID)
	if channel, err := model.GetChannelById(channelID, false); err == nil && channel != nil && channel.Name != "" {
		name = channel.Name
	}
	count := len(entries)
	notifyAdmins("channel_pricing_review", func(role int, setting dto.UserSetting) bool {
		if setting.ChannelNotifyEnabled != nil {
			return *setting.ChannelNotifyEnabled
		}
		return role == common.RoleRootUser
	}, func(lang string) (string, string) {
		if strings.HasPrefix(strings.ToLower(lang), "zh") {
			return "渠道价格变更待审核",
				fmt.Sprintf("渠道 %s 有 %d 条上游价格变更超过阈值，请在渠道定价页审批或拒绝。", name, count)
		}
		return "Channel price change awaiting review",
			fmt.Sprintf("Channel %s has %d upstream price changes above the threshold. Approve or reject them on the channel pricing page.", name, count)
	})
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

// ListChannelPricingReviewsByStatus returns pending or decided review history.
func ListChannelPricingReviewsByStatus(channelID int, status string) []ChannelPricingReviewEntry {
	rows, err := model.ListChannelPricingReviewsByStatus(channelID, status)
	if err != nil {
		return nil
	}
	out := make([]ChannelPricingReviewEntry, 0, len(rows))
	for _, row := range rows {
		out = append(out, ChannelPricingReviewEntry{
			ID: row.ID, ChannelID: row.ChannelID, ModelName: row.ModelName,
			Field: row.Field, Old: row.Old, New: row.New, Percent: row.Percent,
			Status: row.Status, Reviewer: row.ReviewerName, Note: row.Note,
			DecidedAt: row.DecidedAt, CreatedAt: time.Unix(row.CreatedAt, 0).UTC(),
		})
	}
	return out
}

// DecideChannelPricingReviews records an approval or rejection. Approval is
// done by the caller after it applies the schedule rule, so a failed price
// write leaves the entries pending.
func DecideChannelPricingReviews(channelID int, status string, reviewerID int, reviewerName, note string) (int64, error) {
	affected, err := model.DecideChannelPricingReviews(channelID, status, reviewerID, reviewerName, note)
	if err != nil {
		return 0, err
	}
	if status == model.ChannelPricingReviewStatusRejected || status == model.ChannelPricingReviewStatusApproved {
		_ = clearChannelPricingReviewsOption(channelID)
	}
	return affected, nil
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
