package service

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/constant"
	"github.com/uter-ai/uter/model"
	"github.com/uter-ai/uter/setting/operation_setting"
)

const uterAPIFixPricing = `{"success":true,"data":[
	{"model_name":"model-a","enable_groups":["Group A"],"billing_mode":"tiered_expr","billing_expr":"tier(\"base\", p * 2 + c * 10)","pricing_version":"v1"},
	{"model_name":"model-b","enable_groups":["Group B"],"billing_mode":"tiered_expr","billing_expr":"tier(\"base\", p * 3 + c * 15)","pricing_version":"v1"}
],"group_ratio":{"Group A":0.8,"Group B":0.7},"group_display":{"Group A":{"name":"Group A Display"}},"quota_per_unit":500000}`

func setupUterAPIFixDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(
		&model.Channel{}, &model.ChannelModelPricing{}, &model.ChannelPricingHistory{},
		&model.ChannelSyncState{}, &model.Option{}, &model.BillingPriceSnapshot{},
		&model.BillingCostBreakdown{}, &model.BillingFinancialLedger{},
		&model.SystemTask{}, &model.SystemTaskLock{},
	))
	previousDB := model.DB
	model.DB = db
	t.Cleanup(func() { model.DB = previousDB })

	previousOptions := common.OptionMap
	common.OptionMap = map[string]string{}
	t.Cleanup(func() { common.OptionMap = previousOptions })

	previousFX := operation_setting.USDExchangeRate
	operation_setting.USDExchangeRate = 7
	t.Cleanup(func() { operation_setting.USDExchangeRate = previousFX })
	return db
}

func newUterAPIFixServer(t *testing.T, pricingByKey map[string]string, modelsByKey map[string][]string) *httptest.Server {
	t.Helper()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		auth := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
		switch r.URL.Path {
		case "/api/pricing":
			payload, ok := pricingByKey[auth]
			if !ok {
				w.WriteHeader(http.StatusUnauthorized)
				return
			}
			_, _ = w.Write([]byte(payload))
		case "/v1/models":
			ids, ok := modelsByKey[auth]
			if !ok {
				w.WriteHeader(http.StatusUnauthorized)
				return
			}
			items := make([]map[string]string, 0, len(ids))
			for _, id := range ids {
				items = append(items, map[string]string{"id": id})
			}
			encoded, err := common.Marshal(map[string]any{"data": items})
			if err != nil {
				w.WriteHeader(http.StatusInternalServerError)
				return
			}
			_, _ = w.Write(encoded)
		default:
			http.NotFound(w, r)
		}
	}))
	t.Cleanup(server.Close)
	return server
}

func newUterAPIFixChannel(db *gorm.DB, baseURL string, models string, group string) *model.Channel {
	channel := &model.Channel{
		Type:    constant.ChannelTypeUterAPI,
		Name:    "Uter.api fix",
		BaseURL: &baseURL,
		Key:     "sk-fix",
		Models:  models,
		Group:   "default",
		Status:  common.ChannelStatusEnabled,
	}
	if err := db.Create(channel).Error; err != nil {
		panic(err)
	}
	if err := SetGenericUpstreamBillingGroup(channel.Id, group); err != nil {
		panic(err)
	}
	return channel
}

func TestDiscoverAuthorizedUterAPIModelsRequiresAllKeysToAgree(t *testing.T) {
	conflict := newUterAPIFixServer(t, map[string]string{
		"sk-1": uterAPIFixPricing,
		"sk-2": strings.Replace(uterAPIFixPricing, `"Group A":0.8`, `"Group A":0.5`, 1),
	}, map[string][]string{"sk-1": {"model-a"}, "sk-2": {"model-a"}})

	_, err := DiscoverAuthorizedUterAPIModels(context.Background(), conflict.URL, "Group A", []string{"sk-1", "sk-2"})
	require.ErrorContains(t, err, "inconsistent ratios")

	subset := newUterAPIFixServer(t, map[string]string{
		"sk-1": uterAPIFixPricing,
		"sk-2": strings.Replace(uterAPIFixPricing, `"Group A"],"billing_mode":"tiered_expr","billing_expr":"tier(\"base\", p * 2`, `"Group A"],"billing_mode":"tiered_expr","billing_expr":"tier(\"base\", p * 2`, 1),
	}, map[string][]string{"sk-1": {"model-a", "model-b"}, "sk-2": {"model-a"}})
	// Remove model-a from Group B in the second key: only model-a remains
	// authorized for Group A in both documents, and both keys see it.
	subsetPayload := strings.Replace(uterAPIFixPricing, `{"model_name":"model-b","enable_groups":["Group B"]`, `{"model_name":"model-b","enable_groups":[]`, 1)
	subset = newUterAPIFixServer(t, map[string]string{"sk-1": uterAPIFixPricing, "sk-2": subsetPayload},
		map[string][]string{"sk-1": {"model-a", "model-b"}, "sk-2": {"model-a", "model-b"}})
	models, err := DiscoverAuthorizedUterAPIModels(context.Background(), subset.URL, "Group A", []string{"sk-1", "sk-2"})
	require.NoError(t, err)
	assert.Equal(t, []string{"model-a"}, models)
}

func TestUterAPIRefreshKeepsOfficialOnlyWhenSalePriceWasRemoved(t *testing.T) {
	db := setupUterAPIFixDB(t)
	server := newUterAPIFixServer(t,
		map[string]string{"sk-fix": uterAPIFixPricing},
		map[string][]string{"sk-fix": {"model-a", "model-b"}},
	)
	common.OptionMap[UterAPIUpstreamURLOption] = server.URL
	channel := newUterAPIFixChannel(db, server.URL, "model-a", "Group A")

	written, _, _, err := SyncUterAPIChannelPricing(context.Background(), channel, "Group A")
	require.NoError(t, err)
	require.Equal(t, 1, written)
	require.NoError(t, db.Model(&model.ChannelModelPricing{}).
		Where("channel_id = ? AND model_name = ?", channel.Id, "model-a").
		Updates(map[string]any{
			"internal_pricing": "",
			"pricing_owner":    "",
			"pricing_status":   model.ChannelPricingStatusOfficialOnly,
		}).Error)

	written, _, _, _, err = RefreshUterAPIChannelPricing(context.Background(), channel, "Group A")
	require.NoError(t, err)
	require.Equal(t, 1, written)
	rows, err := model.ListChannelModelPricing(channel.Id)
	require.NoError(t, err)
	require.Len(t, rows, 1)
	assert.Equal(t, model.ChannelPricingStatusOfficialOnly, rows[0].PricingStatus)
	assert.Empty(t, rows[0].InternalPricing)
}

func TestUterAPISyncParksModelWhoseGroupAuthorizationWasRemoved(t *testing.T) {
	db := setupUterAPIFixDB(t)
	payload := strings.Replace(uterAPIFixPricing,
		`{"model_name":"model-b","enable_groups":["Group B"]`,
		`{"model_name":"model-b","enable_groups":[]`, 1)
	server := newUterAPIFixServer(t,
		map[string]string{"sk-fix": payload},
		map[string][]string{"sk-fix": {"model-a", "model-b"}},
	)
	common.OptionMap[UterAPIUpstreamURLOption] = server.URL
	channel := newUterAPIFixChannel(db, server.URL, "model-a,model-b", "Group A")
	require.NoError(t, db.Create(&model.ChannelModelPricing{
		ChannelId:         channel.Id,
		Provider:          "uterapi",
		ModelName:         "model-b",
		Currency:          "USD",
		NormalizedPricing: `{"currency":"USD","unit":"expression","tiers":[{"range_name":"base","input_per_million_usd":3,"output_per_million_usd":15,"unit":"per_1m_token"}]}`,
		InternalPricing:   `{"mode":"tiered_expr","billing_expr":"p * 3","source":"newapi-expression","updated_at":1}`,
		PricingSource:     "newapi:/api/pricing",
		PricingOwner:      model.ChannelPricingOwnerAuto,
		PricingStatus:     model.ChannelPricingStatusConfigured,
		FetchedAt:         1,
		UpdatedAt:         1,
		LifecycleStatus:   model.ChannelModelLifecycleActive,
	}).Error)

	_, _, _, err := SyncUterAPIChannelPricing(context.Background(), channel, "Group A")
	require.NoError(t, err)
	rows, err := model.ListChannelModelPricing(channel.Id)
	require.NoError(t, err)
	require.Len(t, rows, 2)
	byName := map[string]model.ChannelModelPricing{}
	for _, row := range rows {
		byName[row.ModelName] = row
	}
	require.Equal(t, model.ChannelPricingStatusConfigured, byName["model-a"].PricingStatus)
	assert.NotEmpty(t, byName["model-a"].InternalPricing)
	require.Equal(t, model.ChannelPricingStatusNeedsReview, byName["model-b"].PricingStatus)
	assert.Empty(t, byName["model-b"].InternalPricing)
}

func TestPreviewUterAPIPriceCatalogUsesAuthenticatedCatalogWhenKeysProvided(t *testing.T) {
	setupUterAPIFixDB(t)
	publicPayload := strings.Replace(uterAPIFixPricing, `"Group A":0.8`, `"Group A":0.5`, 1)
	server := newUterAPIFixServer(t,
		map[string]string{"": publicPayload, "sk-fix": uterAPIFixPricing},
		map[string][]string{"sk-fix": {"model-a"}},
	)
	common.OptionMap[UterAPIUpstreamURLOption] = server.URL

	preview, err := PreviewUterAPIPriceCatalog(context.Background(), "Group A", "sk-fix")
	require.NoError(t, err)
	assert.InDelta(t, 0.8, preview.Ratio, 1e-12)
	assert.Equal(t, "Group A Display", preview.GroupName)
	assert.True(t, preview.Authenticated)
	require.Len(t, preview.Records, 1)
	assert.Equal(t, "model-a", preview.Records[0].ModelName)

	publicPreview, err := PreviewUterAPIPriceCatalog(context.Background(), "Group A")
	require.NoError(t, err)
	assert.InDelta(t, 0.5, publicPreview.Ratio, 1e-12)
	assert.False(t, publicPreview.Authenticated)
}

func TestRunUterAPIUpstreamSyncOnceRefreshesStalePrices(t *testing.T) {
	db := setupUterAPIFixDB(t)
	server := newUterAPIFixServer(t,
		map[string]string{"sk-fix": uterAPIFixPricing},
		map[string][]string{"sk-fix": {"model-a"}},
	)
	common.OptionMap[UterAPIUpstreamURLOption] = server.URL
	channel := newUterAPIFixChannel(db, server.URL, "model-a", "Group A")

	_, _, _, err := SyncUterAPIChannelPricing(context.Background(), channel, "Group A")
	require.NoError(t, err)
	stale := time.Now().Add(-72 * time.Hour).Unix()
	require.NoError(t, db.Model(&model.ChannelModelPricing{}).
		Where("channel_id = ?", channel.Id).Update("fetched_at", stale).Error)

	RunUterAPIUpstreamSyncOnce(context.Background())

	rows, err := model.ListChannelModelPricing(channel.Id)
	require.NoError(t, err)
	require.Len(t, rows, 1)
	assert.Greater(t, rows[0].FetchedAt, stale)
	assert.Greater(t, uterAPISyncStateFor(channel.Id), int64(0))
	assert.Zero(t, genericSyncStateFor(channel.Id))
}

func TestUterAPISyncStateAndBackoffAreIsolatedFromGeneric(t *testing.T) {
	setupUterAPIFixDB(t)
	const channelID = 4242
	now := time.Unix(1_000_000, 0)

	setGenericSyncState(channelID, 100)
	setUterAPISyncState(channelID, 200)
	assert.Equal(t, int64(100), genericSyncStateFor(channelID))
	assert.Equal(t, int64(200), uterAPISyncStateFor(channelID))

	recordGenericSyncFailure(channelID, now)
	assert.True(t, genericBackoffActive(channelID, now))
	assert.False(t, uterAPIBackoffActive(channelID, now))

	recordUterAPISyncFailure(channelID, now)
	assert.True(t, uterAPIBackoffActive(channelID, now))
	clearUterAPISyncFailure(channelID)
	assert.False(t, uterAPIBackoffActive(channelID, now))
	assert.True(t, genericBackoffActive(channelID, now))
}

func TestUterAPIObservabilityEventsAreBoundedAndDeduplicated(t *testing.T) {
	setupUterAPIFixDB(t)
	now := time.Unix(1_700_000, 0)
	for i := 0; i < 205; i++ {
		AppendUterAPIObservabilityEvent(
			fmt.Sprintf("TYPE_%03d", i), "warn", 1, fmt.Sprintf("subject-%03d", i), "first", now,
		)
	}
	AppendUterAPIObservabilityEvent("TYPE_100", "warn", 1, "subject-100", "updated", now.Add(time.Second))

	events := loadUterAPIObservabilityEvents()
	require.Len(t, events, uterAPIObservabilityEventLimit)
	found := false
	for _, event := range events {
		if event.ID != "TYPE_100:1:subject-100" {
			continue
		}
		found = true
		assert.Equal(t, 2, event.Count)
		assert.Equal(t, "updated", event.Message)
	}
	assert.True(t, found)
}

func TestReportUterAPIExpiredPricesEmitsBillingGateReason(t *testing.T) {
	db := setupUterAPIFixDB(t)
	channel := newUterAPIFixChannel(db, "http://127.0.0.1", "model-a", "Group A")
	input, output := 2.0, 4.0
	internal, err := common.Marshal(model.ChannelInternalPricing{
		Mode:                model.ChannelPricingModePerMillionTokens,
		InputUSDPerMillion:  model.MoneyFromFloatPtr(&input),
		OutputUSDPerMillion: model.MoneyFromFloatPtr(&output),
	})
	require.NoError(t, err)
	require.NoError(t, db.Create(&model.ChannelModelPricing{
		ChannelId:       channel.Id,
		ModelName:       "model-a",
		Provider:        "uterapi",
		PricingStatus:   model.ChannelPricingStatusConfigured,
		PricingOwner:    model.ChannelPricingOwnerAuto,
		PricingSource:   "uterroute-official",
		InternalPricing: string(internal),
		FetchedAt:       time.Now().Add(-72 * time.Hour).Unix(),
		LifecycleStatus: model.ChannelModelLifecycleActive,
	}).Error)

	reportUterAPIExpiredPrices(channel.Id, "", time.Now())
	for _, event := range loadUterAPIObservabilityEvents() {
		if event.Type != UterAPIEventPriceExpired {
			continue
		}
		assert.Equal(t, "model-a", event.Subject)
		return
	}
	t.Fatal("PRICE_EXPIRED event was not recorded")
}

func TestUterAPIRefreshUsesHealthyKeySubsetButCreationStaysStrict(t *testing.T) {
	db := setupUterAPIFixDB(t)
	server := newUterAPIFixServer(t,
		map[string]string{"sk-good": uterAPIFixPricing},
		map[string][]string{"sk-good": {"model-a"}},
	)
	common.OptionMap[UterAPIUpstreamURLOption] = server.URL

	channel := newUterAPIFixChannel(db, server.URL, "model-a", "Group A")
	channel.Key = "sk-good\nsk-bad"
	require.NoError(t, db.Model(&model.Channel{}).Where("id = ?", channel.Id).Update("key", channel.Key).Error)

	strictChannel := *channel
	_, _, _, err := SyncUterAPIChannelPricing(context.Background(), &strictChannel, "Group A")
	require.Error(t, err, "creation must fail when any enabled key is unusable")

	written, _, _, _, err := RefreshUterAPIChannelPricing(context.Background(), channel, "Group A")
	require.NoError(t, err)
	assert.Greater(t, written, 0)

	eventKey := UterAPIKeyHealthEventPrefix + fmt.Sprintf("%d", channel.Id)
	raw := strings.TrimSpace(common.GetOption(eventKey))
	require.NotEmpty(t, raw)
	var event UterAPIKeyHealthEvent
	require.NoError(t, common.UnmarshalJsonStr(raw, &event))
	assert.True(t, event.Degraded)
	assert.Equal(t, 2, event.EnabledKeys)
	assert.Equal(t, 1, event.HealthyKeys)
	require.Len(t, event.Unhealthy, 1)
	assert.Equal(t, uterAPIKeyFingerprint("sk-bad"), event.Unhealthy[0].Fingerprint)

	health := loadUterAPIKeyHealth(channel.Id)
	assert.Equal(t, uterAPIKeyHealthy, health[uterAPIKeyFingerprint("sk-good")].Status)
	assert.Equal(t, uterAPIKeyUnhealthy, health[uterAPIKeyFingerprint("sk-bad")].Status)

	observed := false
	for _, item := range loadUterAPIObservabilityEvents() {
		if item.Type != UterAPIEventKeyDegraded || item.ChannelID != channel.Id {
			continue
		}
		observed = true
		assert.Contains(t, item.Subject, uterAPIKeyFingerprint("sk-bad"))
	}
	assert.True(t, observed, "a degraded refresh must emit an observable event")
}

func TestUterAPIRefreshFailsClosedWithoutAnyHealthyKey(t *testing.T) {
	db := setupUterAPIFixDB(t)
	server := newUterAPIFixServer(t,
		map[string]string{},
		map[string][]string{},
	)
	common.OptionMap[UterAPIUpstreamURLOption] = server.URL
	channel := newUterAPIFixChannel(db, server.URL, "model-a", "Group A")

	_, _, _, _, err := RefreshUterAPIChannelPricing(context.Background(), channel, "Group A")
	require.Error(t, err)

	eventKey := UterAPIKeyHealthEventPrefix + fmt.Sprintf("%d", channel.Id)
	raw := strings.TrimSpace(common.GetOption(eventKey))
	require.NotEmpty(t, raw)
	var event UterAPIKeyHealthEvent
	require.NoError(t, common.UnmarshalJsonStr(raw, &event))
	assert.Equal(t, 0, event.HealthyKeys)
	assert.True(t, event.Degraded)
}

func TestUterAPIVerificationHappensAtOperationBoundary(t *testing.T) {
	db := setupUterAPIFixDB(t)
	server := newUterAPIFixServer(t,
		map[string]string{"sk-fix": uterAPIFixPricing},
		map[string][]string{"sk-fix": {"model-a"}},
	)
	common.OptionMap[UterAPIUpstreamURLOption] = server.URL
	channel := newUterAPIFixChannel(db, server.URL, "model-a", "Group A")

	verifyKey := ChannelPricingAutoVerifyPrefix + fmt.Sprintf("%d", channel.Id)
	sentinel := `{"sentinel":true}`
	require.NoError(t, model.UpdateOption(verifyKey, sentinel))

	written, _, _, _, err := RefreshUterAPIChannelPricing(context.Background(), channel, "Group A")
	require.NoError(t, err)
	assert.Greater(t, written, 0)
	assert.Equal(t, sentinel, common.GetOption(verifyKey), "refresh kernel must not verify by itself")

	_, _, _, err = SyncUterAPIChannelPricing(context.Background(), channel, "Group A")
	require.NoError(t, err)
	assert.NotEqual(t, sentinel, common.GetOption(verifyKey), "creation boundary must verify once")
}

func TestUterAPIOperationCacheReusesUpstreamSnapshots(t *testing.T) {
	setupUterAPIFixDB(t)
	var pricingCalls, modelCalls int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		auth := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
		if auth != "sk-fix" {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		switch r.URL.Path {
		case "/api/pricing":
			atomic.AddInt32(&pricingCalls, 1)
			_, _ = w.Write([]byte(uterAPIFixPricing))
		case "/v1/models":
			atomic.AddInt32(&modelCalls, 1)
			_, _ = w.Write([]byte(`{"data":[{"id":"model-a"},{"id":"model-b"}]}`))
		default:
			http.NotFound(w, r)
		}
	}))
	t.Cleanup(server.Close)

	ctx, _ := WithUterAPIUpstreamCache(context.Background())
	for i := 0; i < 2; i++ {
		models, err := DiscoverAuthorizedUterAPIModels(ctx, server.URL, "Group A", []string{"sk-fix"})
		require.NoError(t, err)
		assert.Equal(t, []string{"model-a"}, models)
	}
	assert.Equal(t, int32(1), atomic.LoadInt32(&pricingCalls))
	assert.Equal(t, int32(1), atomic.LoadInt32(&modelCalls))

	freshCtx, _ := WithUterAPIUpstreamCache(context.Background())
	models, err := DiscoverAuthorizedUterAPIModels(freshCtx, server.URL, "Group A", []string{"sk-fix"})
	require.NoError(t, err)
	assert.Equal(t, []string{"model-a"}, models)
	assert.Equal(t, int32(2), atomic.LoadInt32(&pricingCalls))
	assert.Equal(t, int32(2), atomic.LoadInt32(&modelCalls))
}

func TestPreviewUterAPIPriceCatalogUsesDocumentQuotaBasis(t *testing.T) {
	setupUterAPIFixDB(t)
	payload := `{"success":true,"data":[{"model_name":"ratio-model","enable_groups":["Group A"],"model_ratio":1,"completion_ratio":2}],"group_ratio":{"Group A":1},"quota_per_unit":500000}`
	server := newUterAPIFixServer(t,
		map[string]string{"sk-fix": payload},
		map[string][]string{"sk-fix": {"ratio-model"}},
	)
	common.OptionMap[UterAPIUpstreamURLOption] = server.URL

	preview, err := PreviewUterAPIPriceCatalog(context.Background(), "Group A", "sk-fix")
	require.NoError(t, err)
	require.Len(t, preview.Records, 1)
	var view model.ChannelOfficialPricing
	require.NoError(t, common.UnmarshalJsonStr(preview.Records[0].NormalizedPricing, &view))
	require.Len(t, view.Tiers, 1)
	require.NotNil(t, view.Tiers[0].InputPerMillionUSD)
	assert.InDelta(t, 2, view.Tiers[0].InputPerMillionUSD.Float64(), 1e-9)
	assert.False(t, view.NeedsReview, fmt.Sprintf("unexpected reasons: %v", view.ReviewReasons))
}
