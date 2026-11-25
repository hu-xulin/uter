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
	"github.com/uter-ai/uter/model"
)

func previewCatalogServer(t *testing.T) *httptest.Server {
	t.Helper()
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.URL.Path != "/api/pricing" {
			http.NotFound(writer, request)
			return
		}
		writer.Header().Set("Content-Type", "application/json")
		_, _ = writer.Write([]byte(`{"success":true,"data":[
			{"model_name":"gpt-a","quota_type":1,"model_ratio":1,"billing_mode":"tiered_expr",
			 "billing_expr":"tier(\"base\", p * 10 + c * 50)","enable_groups":["Codex"]},
			{"model_name":"claude-a","quota_type":1,"model_ratio":1,"billing_mode":"tiered_expr",
			 "billing_expr":"tier(\"base\", p * 20 + c * 100)","enable_groups":["Claude"]}
		],"group_ratio":{"Codex":0.5,"Claude":1},
		 "group_display":{"Codex":{"name":"Codex · Standard"}}}`))
	}))
	t.Cleanup(server.Close)
	return server
}

func withPreviewCatalogURL(t *testing.T, url string) {
	t.Helper()
	previous := common.OptionMap
	common.OptionMap = map[string]string{UterAPIUpstreamURLOption: url}
	t.Cleanup(func() { common.OptionMap = previous })
}

func TestPreviewUterAPIPriceCatalogAppliesGroupRatioAndDisplayName(t *testing.T) {
	server := previewCatalogServer(t)
	withPreviewCatalogURL(t, server.URL)
	withFXRate(t, 5)

	preview, err := PreviewUterAPIPriceCatalog(context.Background(), "Codex")
	require.NoError(t, err)
	assert.Equal(t, "Codex", preview.Group)
	assert.Equal(t, "Codex · Standard", preview.GroupName)
	assert.InDelta(t, 0.5, preview.Ratio, 1e-9)
	// Only models whose enable_groups includes the selected group are priced.
	require.Len(t, preview.Records, 1)
	assert.Equal(t, "gpt-a", preview.Records[0].ModelName)

	var view model.ChannelOfficialPricing
	require.NoError(t, common.UnmarshalJsonStr(preview.Records[0].NormalizedPricing, &view))
	require.NotNil(t, view.ChannelPrice)
	require.NotNil(t, view.ChannelPrice.InputPerMillionUSD)
	require.NotNil(t, view.ChannelPrice.OutputPerMillionUSD)
	// Official expression 10/50 × 0.5 group ratio = 5/25 credit dollars;
	// dividing by the 5 CNY/USD market rate gives the real channel price.
	assert.InDelta(t, 1, view.ChannelPrice.InputPerMillionUSD.Float64(), 1e-9)
	assert.InDelta(t, 5, view.ChannelPrice.OutputPerMillionUSD.Float64(), 1e-9)
}

func TestPreviewUterAPIPriceCatalogFailsClosed(t *testing.T) {
	server := previewCatalogServer(t)
	withPreviewCatalogURL(t, server.URL)

	_, err := PreviewUterAPIPriceCatalog(context.Background(), "")
	require.ErrorContains(t, err, "billing group is required")

	_, err = PreviewUterAPIPriceCatalog(context.Background(), "Unknown")
	require.ErrorContains(t, err, "has no published ratio")
}
