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
package service

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/constant"
	"github.com/uter-ai/uter/model"
	"github.com/uter-ai/uter/pkg/billingexpr"
)

func TestUterAPIGroupPriceKeepsProviderSource(t *testing.T) {
	encoded, err := common.Marshal(model.ChannelInternalPricing{
		Mode: model.ChannelPricingModeTieredExpr, BillingExpr: "p * 5 + c * 10",
	})
	require.NoError(t, err)
	record := model.ChannelOfficialPricingRecord{
		Source:          "uterapi:/api/pricing",
		InternalPricing: string(encoded),
	}
	applyGroupRatioToRecord(&record, "vip", 0.5)
	assert.Contains(t, record.InternalPricing, `"source":"uterapi:/api/pricing#group=vip"`)
	assert.NotContains(t, record.InternalPricing, "newapi:")
}

func TestUterAPIEffectiveBaseURLPrefersSystemSettings(t *testing.T) {
	common.OptionMapRWMutex.Lock()
	previous := common.OptionMap
	common.OptionMap = map[string]string{
		UterAPIUpstreamURLOption:               "https://legacy-uterapi.test",
		ChannelProviderSubscriptionAPIURLOption: "https://settings-uterapi.test",
	}
	common.OptionMapRWMutex.Unlock()
	t.Cleanup(func() {
		common.OptionMapRWMutex.Lock()
		common.OptionMap = previous
		common.OptionMapRWMutex.Unlock()
	})

	assert.Equal(t, "https://settings-uterapi.test", UterAPIEffectiveBaseURL())
	assert.Equal(t, "https://settings-uterapi.test/api/pricing", uterapiPricingURL())

	// Removing the explicit system-settings address must restore the legacy
	// option so existing deployments keep working.
	common.OptionMapRWMutex.Lock()
	delete(common.OptionMap, ChannelProviderSubscriptionAPIURLOption)
	common.OptionMapRWMutex.Unlock()
	assert.Equal(t, "https://legacy-uterapi.test", UterAPIEffectiveBaseURL())
}

func uterapiPricingServer(t *testing.T) *httptest.Server {
	t.Helper()
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.URL.Path != "/api/pricing" {
			http.NotFound(writer, request)
			return
		}
		if request.Header.Get("Authorization") != "Bearer sk-uterapi-test" {
			writer.WriteHeader(http.StatusUnauthorized)
			return
		}
		writer.Header().Set("Content-Type", "application/json")
		_, _ = writer.Write([]byte(`{"success":true,"data":[
			{"model_name":"gpt-a","model_ratio":1,"completion_ratio":5,
			 "billing_mode":"tiered_expr","billing_expr":"tier(\"base\", p * 2 + c * 10)"}
		],"group_ratio":{"Codex":0.5}}`))
	}))
	t.Cleanup(server.Close)
	return server
}

func TestFetchUterAPIPricingPayloadSendsChannelKey(t *testing.T) {
	server := uterapiPricingServer(t)
	payload, err := fetchUterAPIPricingPayload(context.Background(), server.URL, "sk-uterapi-test")
	require.NoError(t, err)
	require.Len(t, payload.Data, 1)
	assert.Equal(t, "gpt-a", payload.Data[0].ModelName)
	assert.InDelta(t, 0.5, payload.GroupRatio["Codex"], 1e-9)
}

// 分组归属来自上游 enable_groups，不能由模型名称推断。
func TestAuthorizedUterAPIModelsUsesEnableGroups(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		writer.Header().Set("Content-Type", "application/json")
		_, _ = writer.Write([]byte(`{"success":true,"data":[
			{"model_name":"claude-a","enable_groups":["Claude-max"],"billing_mode":"tiered_expr","billing_expr":"p"},
			{"model_name":"gpt-a","enable_groups":["Codex"],"billing_mode":"tiered_expr","billing_expr":"p"},
			{"model_name":"mixed","enable_groups":["Claude-max","Codex"],"billing_mode":"tiered_expr","billing_expr":"p"}
		],"group_ratio":{"Claude-max":2,"Codex":0.5}}`))
	}))
	t.Cleanup(server.Close)

	allowed, err := AuthorizedUterAPIModels(
		context.Background(), server.URL, "Claude-max", []string{"key"},
		[]string{"claude-a", "gpt-a", "mixed"},
	)
	require.NoError(t, err)
	assert.Equal(t, []string{"claude-a", "mixed"}, allowed)

	// 名称像 claude 但没有声明该分组的模型不得混入。
	allowed, err = AuthorizedUterAPIModels(
		context.Background(), server.URL, "Codex", []string{"key"},
		[]string{"claude-a", "gpt-a", "mixed"},
	)
	require.NoError(t, err)
	assert.Equal(t, []string{"gpt-a", "mixed"}, allowed)
}

// 上游没有发布 enable_groups 时不能仅凭模型名称放行。
func TestAuthorizedUterAPIModelsFailsClosedWithoutGroupMetadata(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		writer.Header().Set("Content-Type", "application/json")
		_, _ = writer.Write([]byte(`{"success":true,"data":[
			{"model_name":"claude-a","billing_mode":"tiered_expr","billing_expr":"p"}
		],"group_ratio":{"Claude-max":2}}`))
	}))
	t.Cleanup(server.Close)

	allowed, err := AuthorizedUterAPIModels(
		context.Background(), server.URL, "Claude-max", []string{"key"}, []string{"claude-a"},
	)
	require.NoError(t, err)
	assert.Empty(t, allowed)
}

func TestUterAPIProviderAdapterIsRegistered(t *testing.T) {
	server := uterapiPricingServer(t)
	payload, err := FetchUpstreamCatalog(context.Background(), "uterapi", UpstreamFetchConfig{
		BaseURL: server.URL,
		APIKey:  "sk-uterapi-test",
	})
	require.NoError(t, err)
	result, ok := payload.(*GenericPricingPayload)
	require.True(t, ok)
	require.Len(t, result.Data, 1)
}

func TestUterAPIPricingEndpointAcceptsFullPriceURL(t *testing.T) {
	endpoint, err := uterapiPricingEndpointFor("https://uterapi.ai/api/pricing")
	require.NoError(t, err)
	assert.Equal(t, "https://uterapi.ai/api/pricing", endpoint)

	endpoint, err = uterapiPricingEndpointFor("https://uterapi.ai/v1")
	require.NoError(t, err)
	assert.Equal(t, "https://uterapi.ai/api/pricing", endpoint)
}

func TestUterAPIGroupRatioUpdatesChannelPriceAndUterMarkup(t *testing.T) {
	entry := GenericPricingEntry{
		ModelName: "gpt-a", BillingMode: "tiered_expr",
		BillingExpr: `tier("base", p * 10 + c * 50)`,
	}
	official, _, _ := genericOfficialPricing(entry, 1000, 0)
	record := model.ChannelOfficialPricingRecord{
		ModelName: "gpt-a",
	}
	normalized, err := common.Marshal(official)
	require.NoError(t, err)
	record.NormalizedPricing = string(normalized)
	record.InternalPricing = genericExpressionInternalPricing(entry, 1000)
	require.NotEmpty(t, record.InternalPricing)

	applyGroupRatioToRecord(&record, "Codex", 0.5)

	var view model.ChannelOfficialPricing
	require.NoError(t, common.UnmarshalJsonStr(record.NormalizedPricing, &view))
	require.NotNil(t, view.ChannelPrice)
	assert.InDelta(t, 5, view.ChannelPrice.InputPerMillionUSD.Float64(), 1e-9)
	assert.InDelta(t, 25, view.ChannelPrice.OutputPerMillionUSD.Float64(), 1e-9)

	var internal model.ChannelInternalPricing
	require.NoError(t, common.UnmarshalJsonStr(record.InternalPricing, &internal))
	// Assert the price semantics, not an implementation-specific string form:
	// the group ratio and the Uter markup must both be reflected in the
	// computed charge (10*0.5*1.1 = 5.5 input, 50*0.5*1.1 = 27.5 output).
	params := billingexpr.TokenParams{P: 1, C: 1}
	charge, _, err := billingexpr.RunExprWithRequest(internal.BillingExpr, params, billingexpr.RequestInput{})
	require.NoError(t, err)
	assert.InDelta(t, 33, charge, 1e-6, "discounted then marked up: (10+50)*0.5*1.1")
}

func TestUterAPIGenericSyncRequiresBillingGroup(t *testing.T) {
	previousOptions := common.OptionMap
	common.OptionMap = map[string]string{UterAPIUpstreamURLOption: "https://example-uterapi.test"}
	t.Cleanup(func() { common.OptionMap = previousOptions })
	base := "https://api.example-uterapi.test"
	channel := &model.Channel{
		Id: 999999, Type: constant.ChannelTypeNewAPI,
		BaseURL: &base, Key: "sk-uterapi-test",
	}
	_, _, err := SyncGenericChannelPricingWithModels(context.Background(), channel)
	require.ErrorContains(t, err, "no upstream billing group")
}
