/*
Copyright (C) 2023-2026 Uter.ai

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT WARRANTY OF ANY KIND, either expressed or implied, including
but not limited to the warranties of merchantability, fitness for a
particular purpose and noninfringement. In no event shall the authors or
copyright holders be liable for any claim, damages or other liability,
whether in an action of contract, tort or otherwise, arising from, out of
or in connection with the software or the use or other dealings in the
software.

For commercial licensing, please contact support@uter.ai
*/
package controller

import (
	"net/http"
	"strconv"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/constant"
	"github.com/uter-ai/uter/model"
	"github.com/uter-ai/uter/relaykit/dto"
	"github.com/uter-ai/uter/service"
)

// TestAddChannelUterAPIServerFillsManagedCredentials covers the generic
// POST /api/channel path for a type-64 channel: when the form leaves Base URL
// and Key empty, the server must inject the managed subscription credentials so
// validateChannel's New API base-URL rule is satisfied and the channel persists.
func TestAddChannelUterAPIServerFillsManagedCredentials(t *testing.T) {
	setupUterAPIRecipeDB(t)
	setChannelProviderOptionsForTest(t, map[string]string{
		service.ChannelProviderSubscriptionAPIURLOption: "https://uter.api.example/v1",
		service.ChannelProviderSubscriptionAPIKeyOption: "saved-subscription-key",
	})

	recorder := postAddChannel(t, 1, common.RoleRootUser, `{
		"mode": "single",
		"channel": {
			"name": "Uter.api via generic add",
			"type": 64,
			"models": "model-a,model-b",
			"group": "default"
		}
	}`)

	require.Equal(t, http.StatusOK, recorder.Code, recorder.Body.String())
	assert.Contains(t, recorder.Body.String(), `"success":true`)

	all, err := model.GetAllChannels(0, 100, true, true)
	require.NoError(t, err)
	var created *model.Channel
	for _, channel := range all {
		if channel.Name == "Uter.api via generic add" {
			created = channel
			break
		}
	}
	require.NotNil(t, created, "type-64 channel must be persisted via generic add")
	assert.Equal(t, constant.ChannelTypeUterAPI, created.Type)
	require.NotNil(t, created.BaseURL)
	assert.Equal(t, "https://uter.api.example/v1", *created.BaseURL)
	assert.Equal(t, "saved-subscription-key", created.Key)
	assert.Equal(t, 0, created.Status, "generic type-64 create must start disabled until prices are verified")
	assert.Equal(
		t, dto.ChannelPricingModeScopedPending, created.GetOtherSettings().PricingMode,
		"generic type-64 create must not fall back to global pricing",
	)
}

// TestAddChannelUterAPIWithoutConfiguredBaseURLFails covers the failure branch:
// a type-64 channel cannot be created when neither the form nor system settings
// provide an upstream API address. No channel may be persisted.
func TestAddChannelUterAPIWithoutConfiguredBaseURLFails(t *testing.T) {
	setupUterAPIRecipeDB(t)
	setChannelProviderOptionsForTest(t, map[string]string{
		service.ChannelProviderSubscriptionAPIURLOption: "",
		service.ChannelProviderSubscriptionAPIKeyOption: "saved-subscription-key",
	})
	previousOption := common.OptionMap[service.UterAPIUpstreamURLOption]
	delete(common.OptionMap, service.UterAPIUpstreamURLOption)
	t.Cleanup(func() {
		if previousOption != "" {
			common.OptionMap[service.UterAPIUpstreamURLOption] = previousOption
		}
	})

	recorder := postAddChannel(t, 1, common.RoleRootUser, `{
		"mode": "single",
		"channel": {
			"name": "Uter.api missing base URL",
			"type": 64,
			"models": "model-a",
			"group": "default"
		}
	}`)

	assert.Contains(t, recorder.Body.String(), `"success":false`)
	all, err := model.GetAllChannels(0, 100, true, true)
	require.NoError(t, err)
	for _, channel := range all {
		assert.NotEqual(t, "Uter.api missing base URL", channel.Name,
			"no channel may be persisted when the upstream URL is missing")
	}
}

// TestCreateUterAPIChannelsRejectsUnconfiguredUpstream covers the dedicated
// creation endpoint's explicit guard: with no upstream URL configured it must
// return the dedicated error and create nothing.
func TestCreateUterAPIChannelsRejectsUnconfiguredUpstream(t *testing.T) {
	setupUterAPIRecipeDB(t)
	previousTest := uterapiBaseURLForTest
	uterapiBaseURLForTest = ""
	t.Cleanup(func() { uterapiBaseURLForTest = previousTest })
	setChannelProviderOptionsForTest(t, map[string]string{
		service.ChannelProviderSubscriptionAPIURLOption: "",
		service.ChannelProviderSubscriptionAPIKeyOption: "saved-key",
	})
	previousOption := common.OptionMap[service.UterAPIUpstreamURLOption]
	delete(common.OptionMap, service.UterAPIUpstreamURLOption)
	t.Cleanup(func() {
		if previousOption != "" {
			common.OptionMap[service.UterAPIUpstreamURLOption] = previousOption
		}
	})

	recorder := runUterAPICreate(t, `{"slots":[{"group":"Claude-max","keys":["claude-key"]}],"group":"default"}`)

	assert.Contains(t, recorder.Body.String(), `"success":false`)
	assert.Contains(t, recorder.Body.String(), "not configured")
	all, err := model.GetAllChannels(0, 100, true, true)
	require.NoError(t, err)
	assert.Empty(t, all, "no channel may be created when upstream is unconfigured")
}

// A multi-key slot can still create one channel from its healthy subset. The
// response must expose the dropped key count instead of silently reporting a
// fully healthy channel with reduced failover capacity.
func TestCreateUterAPIChannelsReportsPartiallyUsableKeys(t *testing.T) {
	setupUterAPIRecipeDB(t)
	newUterAPISlotServer(t)

	recorder := runUterAPICreate(t, `{
		"slots":[{"name":"mixed","group":"Claude-max","keys":["claude-key","bad-key"]}],
		"group":"default",
		"models":"claude-a"
	}`)

	require.Equal(t, http.StatusOK, recorder.Code, recorder.Body.String())
	assert.Contains(t, recorder.Body.String(), `"success":true`)
	assert.Contains(t, recorder.Body.String(), `"keys_total":2`)
	assert.Contains(t, recorder.Body.String(), `"keys_usable":1`)
	assert.Contains(t, recorder.Body.String(), `"key_warning"`)
}

// TestUpdateChannelUterAPIPreservesManagedFields covers the full edit path of a
// type-64 channel: a PUT that changes the name and models must preserve the
// stored Base URL and must not be blocked by the New API base-URL rule even
// though the request body omits base_url.
func TestUpdateChannelUterAPIPreservesManagedFields(t *testing.T) {
	setupUterAPIRecipeDB(t)
	baseURL := "https://uter.api.example/v1"
	channel := &model.Channel{
		Name:    "Uter.api to edit",
		Type:    constant.ChannelTypeUterAPI,
		BaseURL: &baseURL,
		Key:     "claude-key",
		Models:  "model-a,model-b",
		Group:   "default",
		Status:  common.ChannelStatusEnabled,
	}
	require.NoError(t, model.DB.Create(channel).Error)

	// The drawer always sends base_url on edit (transformFormDataToUpdatePayload),
	// prefilled from the stored channel. Mirror that contract here.
	recorder := putUpdateChannel(t, 1, common.RoleRootUser, `{
		"id": `+strconv.Itoa(channel.Id)+`,
		"name": "Uter.api renamed",
		"type": 64,
		"base_url": "`+baseURL+`",
		"models": "model-a",
		"group": "default"
	}`)

	require.Equal(t, http.StatusOK, recorder.Code, recorder.Body.String())
	updated, err := model.GetChannelById(channel.Id, true)
	require.NoError(t, err)
	require.NotNil(t, updated)
	assert.Equal(t, "Uter.api renamed", updated.Name)
	assert.Equal(t, "model-a", updated.Models)
	require.NotNil(t, updated.BaseURL)
	assert.Equal(t, baseURL, *updated.BaseURL, "edit must not erase the stored managed Base URL")
	assert.Equal(t, "claude-key", updated.Key, "edit must preserve the stored key when none is supplied")
}

// A real key change invalidates the price rows authorized by the old key. The
// edit must park the channel in the pending, disabled state until the async
// re-verification proves the new key still prices every served model.
func TestUpdateChannelUterAPIKeyChangeWaitsForRepricing(t *testing.T) {
	setupUterAPIRecipeDB(t)
	baseURL := "https://uter.api.example/v1"
	channel := &model.Channel{
		Name:    "Uter.api rekey",
		Type:    constant.ChannelTypeUterAPI,
		BaseURL: &baseURL,
		Key:     "claude-key",
		Models:  "claude-a",
		Group:   "default",
		Status:  common.ChannelStatusEnabled,
	}
	settings := dto.ChannelOtherSettings{PricingMode: dto.ChannelPricingModeScopedActive}
	channel.SetOtherSettings(settings)
	require.NoError(t, model.DB.Create(channel).Error)

	recorder := putUpdateChannel(t, 1, common.RoleRootUser, `{
		"id": `+strconv.Itoa(channel.Id)+`,
		"name": "Uter.api rekey",
		"type": 64,
		"base_url": "`+baseURL+`",
		"key": "replacement-key",
		"models": "claude-a",
		"group": "default"
	}`)
	require.Equal(t, http.StatusOK, recorder.Code, recorder.Body.String())
	updated, err := model.GetChannelById(channel.Id, true)
	require.NoError(t, err)
	require.NotNil(t, updated)
	assert.Equal(t, 0, updated.Status, "rekeyed channel must stay disabled until prices are re-verified")
	assert.Equal(t, dto.ChannelPricingModeScopedPending, updated.GetOtherSettings().PricingMode)
	assert.Equal(t, "replacement-key", updated.Key)
}

func TestChannelKeyCredentialChangedIgnoresMaskedResubmission(t *testing.T) {
	masked := common.MaskSecretValue("claude-key")
	assert.False(t, channelKeyCredentialChanged(masked, "claude-key"))
	assert.False(t, channelKeyCredentialChanged("old-key\n"+masked, "old-key"))
	assert.True(t, channelKeyCredentialChanged("new-key", "old-key"))
	assert.True(t, channelKeyCredentialChanged(masked+"\nnew-key", "old-key"))
}

// TestUterAPIModelMappingCycleIsRejected covers a negative branch of the
// dedicated creation flow: a cyclic model_mapping must not create a channel.
// The endpoint reports per-slot errors in its results and returns a generic
// top-level message, so the contract asserted here is success:false plus an
// empty channel table.
func TestUterAPIModelMappingCycleIsRejected(t *testing.T) {
	setupUterAPIRecipeDB(t)
	newUterAPISlotServer(t)

	recorder := runUterAPICreate(t, `{
		"slots":[{"group":"Claude-max","keys":["claude-key"]}],
		"group":"default",
		"models":"a",
		"model_mapping":"{\"a\":\"b\",\"b\":\"a\"}"
	}`)

	assert.Contains(t, recorder.Body.String(), `"success":false`)
	all, err := model.GetAllChannels(0, 100, true, true)
	require.NoError(t, err)
	assert.Empty(t, all, "a cyclic model mapping must not create a channel")
}
