package controller

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/constant"
	"github.com/uter-ai/uter/model"
	"github.com/uter-ai/uter/service"
)

// 自定义渠道可手动拉取 /api/pricing：价格与计费表达式写入渠道定价，
// 同步结果按渠道记录。
func TestSyncGenericChannelPricingHandler(t *testing.T) {
	db := setupModelListControllerTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.ChannelModelPricing{}, &model.ChannelPricingHistory{}))

	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
		writer.Header().Set("Content-Type", "application/json")
		_, _ = writer.Write([]byte(`{"success":true,"data":[
			{"model_name":"m-a","billing_mode":"tiered_expr","billing_expr":"tier(\"base\", p * 1 + c * 2)"},
			{"model_name":"m-b","billing_mode":"tiered_expr","billing_expr":"tier(\"base\", fixed(0.02)) * image_count"}
		]}`))
	}))
	t.Cleanup(server.Close)

	base := server.URL
	channel := &model.Channel{
		Type: constant.ChannelTypeOpenAI, Name: "Uter.api", BaseURL: &base,
		Key: "sk-test", Models: "", Group: "default", Status: 1,
	}
	require.NoError(t, db.Create(channel).Error)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, fmt.Sprintf("/api/channel/%d/upstream/prices/sync", channel.Id),
		strings.NewReader(`{"apply_models":true}`))
	ctx.Request.Header.Set("Content-Type", "application/json")
	ctx.Params = gin.Params{{Key: "id", Value: fmt.Sprintf("%d", channel.Id)}}

	SyncGenericChannelPricing(ctx)

	require.Equal(t, http.StatusOK, recorder.Code, recorder.Body.String())
	identity := model.ChannelPricingIdentity{ChannelId: channel.Id, ModelName: "m-a"}
	row, err := model.GetChannelModelPricingFor(identity)
	require.NoError(t, err)
	var internal model.ChannelInternalPricing
	require.NoError(t, common.UnmarshalJsonStr(row.InternalPricing, &internal))
	assert.Equal(t, model.ChannelPricingModeTieredExpr, internal.Mode)
	assert.Contains(t, internal.BillingExpr, "tier(\"base\"")

	var stored model.Channel
	require.NoError(t, db.First(&stored, channel.Id).Error)
	assert.Equal(t, "m-a,m-b", stored.Models, "apply_models imports the catalogue ids")

	states, err := model.ListChannelSyncStates(channel.Id)
	require.NoError(t, err)
	require.Len(t, states, 1)
	assert.Equal(t, model.ChannelSyncTypePrices, states[0].SyncType)
	assert.Equal(t, 2, states[0].Written)
	assert.Equal(t, 2, states[0].Fetched)
	assert.Positive(t, states[0].LastSuccessAt)
}

// 上游分组可设置/清除，用于把供应商分组倍率折算成采购成本。
func TestGenericUpstreamBillingGroupHandlers(t *testing.T) {
	db := setupModelListControllerTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.Option{}))

	base := "https://api.uter.ai"
	channel := &model.Channel{
		Type: constant.ChannelTypeOpenAI, Name: "Uter.api", BaseURL: &base,
		Key: "sk-test", Models: "m-a", Group: "default", Status: 1,
	}
	require.NoError(t, db.Create(channel).Error)

	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Request = httptest.NewRequest(http.MethodPut, fmt.Sprintf("/api/channel/%d/upstream_billing_group", channel.Id),
		strings.NewReader(`{"group":"Claude-稳定"}`))
	ctx.Request.Header.Set("Content-Type", "application/json")
	ctx.Params = gin.Params{{Key: "id", Value: fmt.Sprintf("%d", channel.Id)}}
	SetGenericUpstreamBillingGroup(ctx)
	assert.Equal(t, "Claude-稳定", service.GetGenericUpstreamBillingGroup(channel.Id))

	recorder := httptest.NewRecorder()
	getCtx, _ := gin.CreateTestContext(recorder)
	getCtx.Request = httptest.NewRequest(http.MethodGet, fmt.Sprintf("/api/channel/%d/upstream_billing_group", channel.Id), nil)
	getCtx.Params = gin.Params{{Key: "id", Value: fmt.Sprintf("%d", channel.Id)}}
	GetGenericUpstreamBillingGroup(getCtx)
	assert.Contains(t, recorder.Body.String(), "Claude-稳定")

	clearCtx, _ := gin.CreateTestContext(httptest.NewRecorder())
	clearCtx.Request = httptest.NewRequest(http.MethodPut, fmt.Sprintf("/api/channel/%d/upstream_billing_group", channel.Id),
		strings.NewReader(`{"group":""}`))
	clearCtx.Request.Header.Set("Content-Type", "application/json")
	clearCtx.Params = gin.Params{{Key: "id", Value: fmt.Sprintf("%d", channel.Id)}}
	SetGenericUpstreamBillingGroup(clearCtx)
	assert.Empty(t, service.GetGenericUpstreamBillingGroup(channel.Id))
}
