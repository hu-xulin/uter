package controller

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/constant"
	"github.com/uter-ai/uter/model"
	"github.com/uter-ai/uter/service"
)

// RevealChannelProviderCredential returns one saved upstream credential after
// the step-up middleware has validated a proof bound to this exact option key.
// Login URL and username are plain option values and are never routed here.
func RevealChannelProviderCredential(c *gin.Context) {
	optionKey := strings.TrimSpace(c.Param("key"))
	if !service.IsChannelProviderSecretOptionKey(optionKey) {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": service.ErrVerificationContextInvalid.Error()})
		return
	}
	value := strings.TrimSpace(common.GetOption(optionKey))
	recordManageAudit(c, "channel_provider.credential.reveal", map[string]any{
		"key": optionKey,
	})
	common.ApiSuccess(c, gin.H{"key": optionKey, "value": value})
}

// applyChannelProviderCredentials fills a newly created channel from the
// matching System Settings → Channels group:
//
//	Uter Route (65) → Uter Select
//	Alibaba Bailian (17) → Uter Bailian
//	Uter.api (64) → Uter Subscription
//
// The values never pass through the browser: the create request may omit them
// and the server resolves them before validation and persistence. Operator-
// entered values win; saved values only fill empty fields. All three groups
// share this contract.
type channelProviderCredentialFill struct {
	UsedSavedKey bool
	Mode         string
	MultiKeyMode constant.MultiKeyMode
}

func applyChannelProviderCredentials(channel *model.Channel) error {
	_, err := applyChannelProviderCredentialsDetailed(channel)
	return err
}

// applyChannelProviderCredentialsDetailed is the same create-time fill used by
// AddChannel, but also reports the Add Mode declared by the saved group slot.
// Explicit operator input always wins: a saved mode is only suggested when the
// key itself came from System Settings.
func applyChannelProviderCredentialsDetailed(channel *model.Channel) (channelProviderCredentialFill, error) {
	fill := channelProviderCredentialFill{}
	if channel == nil {
		return fill, nil
	}
	var credentials service.ChannelProviderCredentials
	switch channel.Type {
	case constant.ChannelTypeUterRoute:
		credentials = service.FeaturedChannelProviderCredentials()
	case constant.ChannelTypeAli:
		credentials = service.BailianChannelProviderCredentials()
	case constant.ChannelTypeUterAPI:
		credentials = service.SubscriptionChannelProviderCredentials()
	default:
		return fill, nil
	}
	if credentials.LoginURL != "" && (channel.BaseURL == nil || strings.TrimSpace(*channel.BaseURL) == "") {
		baseURL := credentials.LoginURL
		channel.BaseURL = &baseURL
	}
	if strings.TrimSpace(channel.Key) == "" {
		// 分组槽位是用户显式按「密钥种类」保存的新结构，优先于旧的单一
		// API Key；只有没有可用槽位时才回退旧值，避免旧值抢先占住 key
		// 导致分组模式永远不生效。
		if slot, ok := credentials.SlotForGroup(channel.Group); ok && len(slot.Keys) > 0 {
			switch slot.Mode {
			case "batch":
				channel.Key = strings.Join(slot.Keys, "\n")
				fill.Mode = "batch"
			case "multi_to_single":
				channel.Key = strings.Join(slot.Keys, "\n")
				fill.Mode = "multi_to_single"
				fill.MultiKeyMode = constant.MultiKeyMode(slot.Strategy)
			default:
				channel.Key = slot.Keys[0]
			}
			fill.UsedSavedKey = true
		} else if credentials.APIKey != "" {
			channel.Key = credentials.APIKey
			fill.UsedSavedKey = true
		}
	}
	if credentials.LoginURL == "" && credentials.Username == "" && credentials.Password == "" {
		return fill, nil
	}

	// System settings are defaults only. Values explicitly supplied by the
	// operator in the create payload must win; for an encrypted password we
	// pass an empty plaintext so the existing envelope survives normalization.
	loginURL, username, password := credentials.LoginURL, credentials.Username, credentials.Password
	settings := parseSettingsMap(channel.OtherSettings)
	if raw, ok := settings[upstreamConsoleKey]; ok {
		switch typed := raw.(type) {
		case map[string]any:
			if existing := stringValue(typed["login_url"]); existing != "" {
				loginURL = existing
			}
			if existing := stringValue(typed["username"]); existing != "" {
				username = existing
			}
			if existing := stringValue(typed["password"]); existing != "" {
				password = existing
			} else if stringValue(typed["password_encrypted"]) != "" {
				password = ""
			}
		case string:
			if typed != "" {
				var existing upstreamConsoleEnvelope
				if err := json.Unmarshal([]byte(typed), &existing); err != nil {
					return fill, err
				}
				if existing.LoginURL != "" {
					loginURL = existing.LoginURL
				}
				if existing.Username != "" {
					username = existing.Username
				}
				if existing.Password != "" {
					password = existing.Password
				} else if existing.PasswordEncrypted != "" {
					password = ""
				}
			}
		}
	}

	merged, err := mergeConsoleCredentialsIntoSettings(channel.OtherSettings, loginURL, username, password)
	if err != nil {
		return fill, err
	}
	channel.OtherSettings = merged
	return fill, nil
}
