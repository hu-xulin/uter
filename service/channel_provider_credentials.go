package service

import (
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
	_, ok := channelProviderSecretOptionKeys[key]
	return ok
}

// ChannelProviderCredentials is one provider's saved connection settings.
// Password and API key are plain here because callers are server-side flows;
// the browser only ever receives masked values unless a proof was approved.
type ChannelProviderCredentials struct {
	LoginURL string
	Username string
	Password string
	APIKey   string
}

// GetChannelProviderCredentials reads one provider group from options.
func GetChannelProviderCredentials(prefix string) ChannelProviderCredentials {
	return ChannelProviderCredentials{
		LoginURL: strings.TrimSpace(common.GetOption(prefix + ".login_url")),
		Username: strings.TrimSpace(common.GetOption(prefix + ".username")),
		Password: strings.TrimSpace(common.GetOption(prefix + ".password")),
		APIKey:   strings.TrimSpace(common.GetOption(prefix + ".api_key")),
	}
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
