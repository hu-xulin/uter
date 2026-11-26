/*
Copyright (C) 2023-2026 Uter.ai

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@uter.ai
*/
package controller

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/constant"
	"github.com/uter-ai/uter/model"
	"github.com/uter-ai/uter/service"
)

func loginURLOptionForType(channelType int) string {
	switch channelType {
	case constant.ChannelTypeUterRoute:
		return service.ChannelProviderFeaturedLoginURLOption
	case constant.ChannelTypeAli:
		return service.ChannelProviderBailianLoginURLOption
	case constant.ChannelTypeUterAPI:
		return service.ChannelProviderSubscriptionLoginURLOption
	default:
		return ""
	}
}

func setChannelProviderOptionsForTest(t *testing.T, values map[string]string) {
	t.Helper()
	type previousValue struct {
		value   string
		existed bool
	}

	common.OptionMapRWMutex.Lock()
	if common.OptionMap == nil {
		common.OptionMap = make(map[string]string)
	}
	previous := make(map[string]previousValue, len(values))
	for key, value := range values {
		old, existed := common.OptionMap[key]
		previous[key] = previousValue{value: old, existed: existed}
		common.OptionMap[key] = value
	}
	common.OptionMapRWMutex.Unlock()

	t.Cleanup(func() {
		common.OptionMapRWMutex.Lock()
		for key, old := range previous {
			if old.existed {
				common.OptionMap[key] = old.value
			} else {
				delete(common.OptionMap, key)
			}
		}
		common.OptionMapRWMutex.Unlock()
	})
}

func TestBuildChannelProviderMaskViewValueMasksEachLine(t *testing.T) {
	setChannelProviderOptionsForTest(t, map[string]string{
		service.ChannelProviderFeaturedAPIKeyOption:   "first-key-1234\nshort",
		service.ChannelProviderFeaturedPasswordOption: "password-9876",
	})

	var view struct {
		Featured struct {
			Password string `json:"password"`
			APIKey   string `json:"api_key"`
		} `json:"featured"`
	}
	require.NoError(t, json.Unmarshal([]byte(buildChannelProviderMaskViewValue()), &view))
	require.Equal(t, "firs******1234\nshor*", view.Featured.APIKey)
	require.Equal(t, "pass*****9876", view.Featured.Password)
}

func TestApplyChannelProviderCredentialsFillsConfiguredGroups(t *testing.T) {
	initConsoleTestSecrets(t)
	cases := []struct {
		name        string
		channelType int
		wantBaseURL string
		options     map[string]string
	}{
		{
			name:        "Uter Select uses the independent API address, not the console login URL",
			channelType: constant.ChannelTypeUterRoute,
			wantBaseURL: "https://api.example.com",
			options: map[string]string{
				service.ChannelProviderFeaturedLoginURLOption: "https://console.example.com",
				service.ChannelProviderFeaturedAPIURLOption:   "https://api.example.com",
				service.ChannelProviderFeaturedUsernameOption: "operator",
				service.ChannelProviderFeaturedPasswordOption: "upstream-password",
				service.ChannelProviderFeaturedAPIKeyOption:   "key-one\nkey-two",
			},
		},
		{
			name:        "Uter Bailian uses the workspace API address, not the console login URL",
			channelType: constant.ChannelTypeAli,
			wantBaseURL: "https://ws-space.cn-beijing.maas.aliyuncs.com",
			options: map[string]string{
				service.ChannelProviderBailianLoginURLOption: "https://bailian.console.aliyun.com",
				service.ChannelProviderBailianAPIURLOption:   "https://ws-space.cn-beijing.maas.aliyuncs.com",
				service.ChannelProviderBailianUsernameOption: "operator",
				service.ChannelProviderBailianPasswordOption: "upstream-password",
				service.ChannelProviderBailianAPIKeyOption:   "key-one\nkey-two",
			},
		},
		{
			name:        "Uter Subscription uses the independent API address, not the console login URL",
			channelType: constant.ChannelTypeUterAPI,
			wantBaseURL: "https://api.example.com",
			options: map[string]string{
				service.ChannelProviderSubscriptionLoginURLOption: "https://console.example.com",
				service.ChannelProviderSubscriptionAPIURLOption:   "https://api.example.com",
				service.ChannelProviderSubscriptionUsernameOption: "operator",
				service.ChannelProviderSubscriptionPasswordOption: "upstream-password",
				service.ChannelProviderSubscriptionAPIKeyOption:   "key-one\nkey-two",
			},
		},
		{
			name:        "Console login URL alone never becomes the API base URL (fail closed)",
			channelType: constant.ChannelTypeUterRoute,
			wantBaseURL: "",
			options: map[string]string{
				service.ChannelProviderFeaturedLoginURLOption: "https://console.example.com",
				service.ChannelProviderFeaturedUsernameOption: "operator",
				service.ChannelProviderFeaturedPasswordOption: "upstream-password",
				// No api_url and no dedicated endpoint option: fail closed.
				service.UterRouteUpstreamURLOption: "",
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			setChannelProviderOptionsForTest(t, tc.options)
			channel := &model.Channel{
				Type:          tc.channelType,
				OtherSettings: `{"proxy":"keep-me"}`,
			}
			require.NoError(t, applyChannelProviderCredentials(channel))

			if tc.wantBaseURL == "" {
				require.Nil(t, channel.BaseURL, "console login URL must never become an API endpoint")
			} else {
				require.NotNil(t, channel.BaseURL)
				require.Equal(t, tc.wantBaseURL, *channel.BaseURL)
			}

			var settings map[string]any
			require.NoError(t, json.Unmarshal([]byte(channel.OtherSettings), &settings))
			require.Equal(t, "keep-me", settings["proxy"])
			console := settings[upstreamConsoleKey].(map[string]any)
			// The console login URL is stored for the secondary cross-check only.
			require.Equal(t, tc.options[loginURLOptionForType(tc.channelType)], console["login_url"])
			require.Equal(t, "operator", console["username"])
			require.NotContains(t, console, "password")
			require.NotEmpty(t, console["password_encrypted"])
			plain, err := common.DecryptSecret(console["password_encrypted"].(string))
			require.NoError(t, err)
			require.Equal(t, "upstream-password", plain)
		})
	}
}

func TestApplyChannelProviderCredentialsKeepsOperatorValues(t *testing.T) {
	initConsoleTestSecrets(t)
	cases := []struct {
		name        string
		channelType int
		options     map[string]string
	}{
		{
			name:        "Uter Route",
			channelType: constant.ChannelTypeUterRoute,
			options: map[string]string{
				service.ChannelProviderFeaturedLoginURLOption: "https://configured.example.com",
				service.ChannelProviderFeaturedUsernameOption: "configured-user",
				service.ChannelProviderFeaturedPasswordOption: "configured-password",
				service.ChannelProviderFeaturedAPIKeyOption:   "configured-key",
			},
		},
		{
			name:        "Alibaba Bailian",
			channelType: constant.ChannelTypeAli,
			options: map[string]string{
				service.ChannelProviderBailianLoginURLOption: "https://configured.example.com",
				service.ChannelProviderBailianUsernameOption: "configured-user",
				service.ChannelProviderBailianPasswordOption: "configured-password",
				service.ChannelProviderBailianAPIKeyOption:   "configured-key",
			},
		},
		{
			name:        "Uter.api",
			channelType: constant.ChannelTypeUterAPI,
			options: map[string]string{
				service.ChannelProviderSubscriptionLoginURLOption: "https://configured.example.com",
				service.ChannelProviderSubscriptionUsernameOption: "configured-user",
				service.ChannelProviderSubscriptionPasswordOption: "configured-password",
				service.ChannelProviderSubscriptionAPIKeyOption:   "configured-key",
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			setChannelProviderOptionsForTest(t, tc.options)
			operatorURL := "https://operator.example.com"
			channel := &model.Channel{
				Type:          tc.channelType,
				BaseURL:       &operatorURL,
				Key:           "operator-key",
				OtherSettings: `{"upstream_console":{"login_url":"https://operator.example.com","username":"operator-user","password":"operator-password"}}`,
			}
			require.NoError(t, applyChannelProviderCredentials(channel))

			require.Equal(t, operatorURL, *channel.BaseURL)
			require.Equal(t, "operator-key", channel.Key)
			var settings map[string]any
			require.NoError(t, json.Unmarshal([]byte(channel.OtherSettings), &settings))
			console := settings[upstreamConsoleKey].(map[string]any)
			require.Equal(t, "https://operator.example.com", console["login_url"])
			require.Equal(t, "operator-user", console["username"])
			plain, err := common.DecryptSecret(console["password_encrypted"].(string))
			require.NoError(t, err)
			require.Equal(t, "operator-password", plain)
		})
	}
}

func TestApplyChannelProviderCredentialsIgnoresOtherChannelTypes(t *testing.T) {
	setChannelProviderOptionsForTest(t, map[string]string{
		service.ChannelProviderFeaturedAPIKeyOption:     "configured-key",
		service.ChannelProviderBailianAPIKeyOption:      "configured-key",
		service.ChannelProviderSubscriptionAPIKeyOption: "configured-key",
	})

	for _, channelType := range []int{constant.ChannelTypeOpenAI, constant.ChannelTypeSub2API} {
		channel := &model.Channel{Type: channelType}
		require.NoError(t, applyChannelProviderCredentials(channel))
		require.Nil(t, channel.BaseURL)
		require.Empty(t, channel.Key)
	}
}

func TestBuildChannelProviderMaskViewValueMasksGroupedSlots(t *testing.T) {
	setChannelProviderOptionsForTest(t, map[string]string{
		service.ChannelProviderCredentialSlotsOptionKey(service.ChannelProviderSubscriptionPrefix): `[{"id":"slot-claude","group":"claude-economy","mode":"multi_to_single","strategy":"polling"}]`,
		"channel_provider.subscription.slot_slot-claude_api_key":                                   "first-key-1234\nsecond-key-9876",
	})

	var view struct {
		Subscription struct {
			APIKey string `json:"api_key"`
			Slots  []struct {
				ID     string `json:"id"`
				APIKey string `json:"api_key"`
			} `json:"slots"`
		} `json:"subscription"`
	}
	require.NoError(t, json.Unmarshal([]byte(buildChannelProviderMaskViewValue()), &view))
	require.Len(t, view.Subscription.Slots, 1)
	require.Equal(t, "slot-claude", view.Subscription.Slots[0].ID)
	require.Equal(t, "firs******1234\nseco*******9876", view.Subscription.Slots[0].APIKey)
}

func TestApplyChannelProviderCredentialsUsesGroupedSlotMode(t *testing.T) {
	initConsoleTestSecrets(t)
	cases := []struct {
		name        string
		channelType int
		prefix      string
	}{
		{"Uter Route", constant.ChannelTypeUterRoute, service.ChannelProviderFeaturedPrefix},
		{"Alibaba Bailian", constant.ChannelTypeAli, service.ChannelProviderBailianPrefix},
		{"Uter.api", constant.ChannelTypeUterAPI, service.ChannelProviderSubscriptionPrefix},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			setChannelProviderOptionsForTest(t, map[string]string{
				service.ChannelProviderCredentialSlotsOptionKey(tc.prefix): `[{"id":"slot-economy","group":"claude-economy","mode":"multi_to_single","strategy":"polling"}]`,
				tc.prefix + ".slot_slot-economy_api_key":                   "key-one\nkey-two",
				tc.prefix + ".api_key":                                     "legacy-key",
			})
			channel := &model.Channel{Type: tc.channelType, Group: "default"}
			fill, err := applyChannelProviderCredentialsDetailed(channel)
			require.NoError(t, err)
			require.True(t, fill.UsedSavedKey)
			require.Equal(t, "multi_to_single", fill.Mode)
			require.Equal(t, constant.MultiKeyModePolling, fill.MultiKeyMode)
			require.Equal(t, "key-one\nkey-two", channel.Key)
		})
	}
}
