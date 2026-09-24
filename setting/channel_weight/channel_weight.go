package channel_weight

import "strconv"

// ChannelModelEntry is the per-(channel, model) routing override. A nil field
// means "fall back to the channel-level value".
type ChannelModelEntry struct {
	// Weight is the traffic weight for this (channel, model). nil -> use the
	// channel-level Weight.
	Weight *int `json:"weight"`
	// Priority is the routing priority tier for this (channel, model). nil ->
	// use the channel-level Priority.
	Priority *int64 `json:"priority"`
}

// ChannelModelWeightSetting maps channelId -> model -> entry.
type ChannelModelWeightSetting struct {
	Enabled  bool                                     `json:"enabled"`
	Channels map[string]map[string]ChannelModelEntry `json:"channels"`
}

var channelModelWeightCache parsedSetting[ChannelModelWeightSetting]

// GetChannelModelWeightSetting returns the decoded setting, or nil when unset
// / invalid. Treat the result as read-only.
func GetChannelModelWeightSetting() *ChannelModelWeightSetting {
	return channelModelWeightCache.get(ChannelModelWeightOptionKey)
}

// Enabled reports whether per-model routing affects selection.
func Enabled() bool {
	s := GetChannelModelWeightSetting()
	return s != nil && s.Enabled && len(s.Channels) > 0
}

// GetChannelModelWeight returns the configured per-model weight for a channel.
// ok is false when unset / disabled / not applicable, so callers fall back to
// the channel-level Weight.
func GetChannelModelWeight(channelId int, model string) (int, bool) {
	s := GetChannelModelWeightSetting()
	if s == nil || !s.Enabled || channelId <= 0 {
		return 0, false
	}
	ch, ok := s.Channels[strconv.Itoa(channelId)]
	if !ok {
		return 0, false
	}
	entry, ok := ch[model]
	if !ok || entry.Weight == nil {
		return 0, false
	}
	return *entry.Weight, true
}

// GetChannelModelPriority returns the configured per-model priority for a
// channel. ok is false when unset / disabled / not applicable, so callers fall
// back to the channel-level Priority.
func GetChannelModelPriority(channelId int, model string) (int64, bool) {
	s := GetChannelModelWeightSetting()
	if s == nil || !s.Enabled || channelId <= 0 {
		return 0, false
	}
	ch, ok := s.Channels[strconv.Itoa(channelId)]
	if !ok {
		return 0, false
	}
	entry, ok := ch[model]
	if !ok || entry.Priority == nil {
		return 0, false
	}
	return *entry.Priority, true
}
