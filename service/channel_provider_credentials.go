package service

import (
	"encoding/json"
	"fmt"
	"regexp"
	"strings"

	"github.com/uter-ai/uter/common"
)

// Channel-provider connection settings are stored as individual option keys so
// the existing option API can mask secrets and skip masked write-backs without
// introducing a second credential lifecycle.
const (
	ChannelProviderFeaturedPrefix     = "channel_provider.featured"
	ChannelProviderBailianPrefix      = "channel_provider.bailian"
	ChannelProviderSubscriptionPrefix = "channel_provider.subscription"

	ChannelProviderFeaturedLoginURLOption     = ChannelProviderFeaturedPrefix + ".login_url"
	ChannelProviderFeaturedUsernameOption     = ChannelProviderFeaturedPrefix + ".username"
	ChannelProviderFeaturedPasswordOption     = ChannelProviderFeaturedPrefix + ".password"
	ChannelProviderFeaturedAPIKeyOption       = ChannelProviderFeaturedPrefix + ".api_key"
	ChannelProviderBailianLoginURLOption      = ChannelProviderBailianPrefix + ".login_url"
	ChannelProviderBailianUsernameOption      = ChannelProviderBailianPrefix + ".username"
	ChannelProviderBailianPasswordOption      = ChannelProviderBailianPrefix + ".password"
	ChannelProviderBailianAPIKeyOption        = ChannelProviderBailianPrefix + ".api_key"
	ChannelProviderSubscriptionLoginURLOption = ChannelProviderSubscriptionPrefix + ".login_url"
	ChannelProviderSubscriptionUsernameOption = ChannelProviderSubscriptionPrefix + ".username"
	ChannelProviderSubscriptionPasswordOption = ChannelProviderSubscriptionPrefix + ".password"
	ChannelProviderSubscriptionAPIKeyOption   = ChannelProviderSubscriptionPrefix + ".api_key"
)

const (
	// ChannelProviderCredentialSlotsOption holds the non-secret slot metadata for
	// one provider: id, group, add mode and rotation strategy. Keys are stored in
	// a separate option per slot so the existing secret masking/reveal pipeline
	// keeps working.
	ChannelProviderCredentialSlotsOption = ".credential_slots"
	channelProviderSlotAPIKeyOptionFmt   = "%s.slot_%s_api_key"
	ChannelProviderMaxCredentialSlots    = 20
)

var channelProviderSlotIDPattern = regexp.MustCompile(`^[A-Za-z0-9_-]{1,64}$`)

// ChannelProviderCredentialSlot is one saved group/key-kind row from System
// Settings → Channels. Mode follows the same three values as the create wizard:
// single, batch (one channel per key) and multi_to_single (one channel, rotated
// keys).
type ChannelProviderCredentialSlot struct {
	ID       string   `json:"id"`
	Group    string   `json:"group"`
	Label    string   `json:"label,omitempty"`
	Mode     string   `json:"mode"`
	Strategy string   `json:"strategy,omitempty"`
	Keys     []string `json:"-"`
}

func ChannelProviderCredentialSlotsOptionKey(prefix string) string {
	return prefix + ChannelProviderCredentialSlotsOption
}

func ChannelProviderSlotAPIKeyOption(prefix, id string) (string, bool) {
	if !channelProviderSlotIDPattern.MatchString(id) {
		return "", false
	}
	return fmt.Sprintf(channelProviderSlotAPIKeyOptionFmt, prefix, id), true
}

func normalizeChannelProviderSlotMode(mode string) string {
	switch mode {
	case "single", "batch", "multi_to_single":
		return mode
	default:
		return "single"
	}
}

func normalizeChannelProviderSlotStrategy(strategy string) string {
	switch strategy {
	case "random", "polling":
		return strategy
	default:
		return "random"
	}
}

// channelProviderSecretOptionKeys are the only keys a step-up proof may reveal
// in clear. Login URL and username are deliberately absent: they are not
// secrets and are supplied by GET /api/option/ in plain.
var channelProviderSecretOptionKeys = map[string]struct{}{
	ChannelProviderFeaturedPasswordOption:     {},
	ChannelProviderFeaturedAPIKeyOption:       {},
	ChannelProviderBailianPasswordOption:      {},
	ChannelProviderBailianAPIKeyOption:        {},
	ChannelProviderSubscriptionPasswordOption: {},
	ChannelProviderSubscriptionAPIKeyOption:   {},
}

// IsChannelProviderSecretOptionKey reports whether an option key is a
// channel-provider credential that requires step-up verification to reveal.
func IsChannelProviderSecretOptionKey(key string) bool {
	if _, ok := channelProviderSecretOptionKeys[key]; ok {
		return true
	}
	for _, prefix := range []string{
		ChannelProviderFeaturedPrefix,
		ChannelProviderBailianPrefix,
		ChannelProviderSubscriptionPrefix,
	} {
		marker := prefix + ".slot_"
		if !strings.HasPrefix(key, marker) || !strings.HasSuffix(key, "_api_key") {
			continue
		}
		id := strings.TrimSuffix(strings.TrimPrefix(key, marker), "_api_key")
		expected, valid := ChannelProviderSlotAPIKeyOption(prefix, id)
		if valid && key == expected {
			return true
		}
	}
	return false
}

// ChannelProviderCredentials is one provider's saved connection settings.
// Password and API key are plain here because callers are server-side flows;
// the browser only ever receives masked values unless a proof was approved.
type ChannelProviderCredentials struct {
	LoginURL string
	Username string
	Password string
	APIKey   string
	Slots    []ChannelProviderCredentialSlot
}

// SlotForGroup returns the saved slot whose upstream group/key kind matches the
// channel being created. A single saved slot also acts as the default because
// providers without a group catalogue still need one usable credential.
func (c ChannelProviderCredentials) SlotForGroup(group string) (ChannelProviderCredentialSlot, bool) {
	group = strings.TrimSpace(group)
	for _, slot := range c.Slots {
		if group != "" && group != "default" && strings.TrimSpace(slot.Group) == group {
			return slot, true
		}
	}
	// A provider without a group catalogue (Uter Route / Bailian) has no
	// meaningful upstream group. Its single saved row is the default credential.
	if (group == "" || group == "default") && len(c.Slots) == 1 {
		return c.Slots[0], true
	}
	return ChannelProviderCredentialSlot{}, false
}

// ChannelProviderCredentialSlotMetadata reads the non-secret slot metadata for
// a provider. Malformed or oversized metadata is ignored rather than pruning
// saved keys: an operator must never lose credentials because of a bad edit.
func ChannelProviderCredentialSlotMetadata(prefix string) []ChannelProviderCredentialSlot {
	return ParseChannelProviderCredentialSlotMetadata(
		common.GetOption(ChannelProviderCredentialSlotsOptionKey(prefix)),
	)
}

// ParseChannelProviderCredentialSlotMetadata parses slot metadata from an
// option value. Callers that already hold OptionMapRWMutex (for example the
// derived mask view in GetOptions) must use this function instead of the
// locking helper above to avoid a self-deadlock.
func ParseChannelProviderCredentialSlotMetadata(rawValue string) []ChannelProviderCredentialSlot {
	raw := strings.TrimSpace(rawValue)
	if raw == "" || raw == "[]" || raw == "null" {
		return nil
	}
	var slots []ChannelProviderCredentialSlot
	if err := json.Unmarshal([]byte(raw), &slots); err != nil {
		return nil
	}
	if len(slots) == 0 {
		return nil
	}
	if len(slots) > ChannelProviderMaxCredentialSlots {
		slots = slots[:ChannelProviderMaxCredentialSlots]
	}
	seen := make(map[string]bool, len(slots))
	out := make([]ChannelProviderCredentialSlot, 0, len(slots))
	for _, slot := range slots {
		if !channelProviderSlotIDPattern.MatchString(slot.ID) || seen[slot.ID] {
			continue
		}
		seen[slot.ID] = true
		slot.Mode = normalizeChannelProviderSlotMode(slot.Mode)
		slot.Strategy = normalizeChannelProviderSlotStrategy(slot.Strategy)
		if slot.Mode != "multi_to_single" {
			slot.Strategy = ""
		}
		out = append(out, slot)
	}
	return out
}

// GetChannelProviderCredentials reads one provider group from options.
func GetChannelProviderCredentials(prefix string) ChannelProviderCredentials {
	credentials := ChannelProviderCredentials{
		LoginURL: strings.TrimSpace(common.GetOption(prefix + ".login_url")),
		Username: strings.TrimSpace(common.GetOption(prefix + ".username")),
		Password: strings.TrimSpace(common.GetOption(prefix + ".password")),
		APIKey:   strings.TrimSpace(common.GetOption(prefix + ".api_key")),
	}
	for _, slot := range ChannelProviderCredentialSlotMetadata(prefix) {
		optionKey, valid := ChannelProviderSlotAPIKeyOption(prefix, slot.ID)
		if !valid {
			continue
		}
		keys := make([]string, 0)
		for _, rawKey := range strings.Split(common.GetOption(optionKey), "\n") {
			key := strings.TrimSpace(rawKey)
			if key != "" {
				keys = append(keys, key)
			}
		}
		slot.Keys = keys
		credentials.Slots = append(credentials.Slots, slot)
	}
	return credentials
}

// FeaturedChannelProviderCredentials returns the Uter Route / Dreamrouter
// connection settings used when creating a channel from inside Uter.
func FeaturedChannelProviderCredentials() ChannelProviderCredentials {
	return GetChannelProviderCredentials(ChannelProviderFeaturedPrefix)
}

// BailianChannelProviderCredentials returns the Alibaba Bailian connection
// settings. It follows the same create-time fill contract as Uter Select.
func BailianChannelProviderCredentials() ChannelProviderCredentials {
	return GetChannelProviderCredentials(ChannelProviderBailianPrefix)
}

// SubscriptionChannelProviderCredentials returns the Uter.api connection
// settings. It follows the same create-time fill contract as Uter Select.
func SubscriptionChannelProviderCredentials() ChannelProviderCredentials {
	return GetChannelProviderCredentials(ChannelProviderSubscriptionPrefix)
}
