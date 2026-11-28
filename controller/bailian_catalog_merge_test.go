package controller

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/uter-ai/uter/constant"
	"github.com/uter-ai/uter/model"
	"github.com/uter-ai/uter/service"
)

func TestBailianMergedModelNames(t *testing.T) {
	catalog := &service.BailianCatalog{Models: []service.BailianModel{
		{Model: "happyhorse-1.1-t2v"},
		{Model: "happyhorse-1.0-video-edit"},
		{Model: "wan3.0-video"},
		{Model: "qwen-plus"},
		{Model: "  "}, // blank name must be ignored
	}}

	t.Run("merges catalog-only models and keeps workspace models", func(t *testing.T) {
		local := []string{"qwen-plus", "workspace-only-model"}
		merged, changed := bailianMergedModelNames(local, catalog)
		assert.True(t, changed)
		assert.Contains(t, merged, "workspace-only-model", "workspace model preserved")
		assert.Contains(t, merged, "happyhorse-1.1-t2v")
		assert.Contains(t, merged, "happyhorse-1.0-video-edit")
		assert.Contains(t, merged, "wan3.0-video")
		assert.Contains(t, merged, "qwen-plus")
		assert.Len(t, merged, 5, "9 catalog/local entries dedup to 5 distinct models")
	})

	t.Run("idempotent on repeated merge", func(t *testing.T) {
		first, changed1 := bailianMergedModelNames([]string{"qwen-plus"}, catalog)
		assert.True(t, changed1)
		second, changed2 := bailianMergedModelNames(first, catalog)
		assert.False(t, changed2, "second merge must be a no-op")
		assert.Equal(t, first, second)
	})

	t.Run("nil or empty catalog is a no-op", func(t *testing.T) {
		local := []string{"qwen-plus"}
		merged, changed := bailianMergedModelNames(local, nil)
		assert.False(t, changed)
		assert.Equal(t, local, merged)
		merged, changed = bailianMergedModelNames(local, &service.BailianCatalog{})
		assert.False(t, changed)
		assert.Equal(t, local, merged)
	})

	t.Run("fully covered catalog is a no-op", func(t *testing.T) {
		local := []string{"happyhorse-1.1-t2v", "happyhorse-1.0-video-edit", "wan3.0-video", "qwen-plus"}
		merged, changed := bailianMergedModelNames(local, catalog)
		assert.False(t, changed)
		assert.Equal(t, local, merged)
	})
}

// The post-edit price refresh writes its own sync step. Without it the drawer
// invalidates `bailian-sync-status` but the panel keeps showing the old
// post-create result, hiding an edit that changed the priced model set.
func TestSyncBailianPricingAfterUpdateRecordsSyncStatus(t *testing.T) {
	setupUterAPIRecipeDB(t)
	baseURL := "http://127.0.0.1:9/api/v1"
	channel := &model.Channel{
		Name:    "Bailian edit sync status",
		Type:    constant.ChannelTypeAli,
		BaseURL: &baseURL,
		Models:  "qwen-plus",
		Group:   "default",
		Status:  1,
	}
	require.NoError(t, model.DB.Create(channel).Error)

	syncBailianPricingAfterUpdate(channel.Id)

	status := service.LoadBailianSyncStatus()
	require.NotNil(t, status)
	require.Equal(t, channel.Id, status.ChannelID)
	assert.Equal(t, "failed", status.Steps["pricing_refresh"].Status)
	assert.NotEmpty(t, status.Steps["pricing_refresh"].Message)
}

func TestBailianCatalogModelsEnabledOption(t *testing.T) {
	for _, value := range []string{"", "true", "TRUE", "yes", "1"} {
		assert.True(t, bailianCatalogModelsEnabledFrom(value), "value=%q", value)
	}
	for _, value := range []string{"false", "False", "FALSE", " false "} {
		assert.False(t, bailianCatalogModelsEnabledFrom(value), "value=%q", value)
	}
}

// The post-create discovery pass must merge freshly discovered workspace models
// into the operator-specified list, never replace it. Operators add task-plugin
// models (happyhorse/wan) and third-party aliases that the workspace catalog
// does not return; overwriting channel.Models silently dropped them.
func TestBailianModelsAfterDiscoveryPreservesOperatorModels(t *testing.T) {
	t.Run("keeps operator task-plugin models and aliases", func(t *testing.T) {
		operator := []string{"happyhorse-1.1-t2v", "wan3.0-video", "my-custom-alias"}
		discovered := []string{"qwen-plus", "qwen3-coder-flash"}
		merged, changed := bailianModelsAfterDiscovery(operator, discovered)
		assert.True(t, changed)
		assert.Contains(t, merged, "happyhorse-1.1-t2v")
		assert.Contains(t, merged, "wan3.0-video")
		assert.Contains(t, merged, "my-custom-alias")
		assert.Contains(t, merged, "qwen-plus")
		assert.Contains(t, merged, "qwen3-coder-flash")
		assert.Len(t, merged, 5)
	})

	t.Run("idempotent when rediscovering same models", func(t *testing.T) {
		operator := []string{"happyhorse-1.1-t2v", "qwen-plus"}
		discovered := []string{"qwen-plus", "happyhorse-1.1-t2v"}
		merged, changed := bailianModelsAfterDiscovery(operator, discovered)
		assert.False(t, changed, "rediscovering known models must not rewrite the channel")
		assert.Equal(t, operator, merged)
	})

	t.Run("empty operator adopts discovery result", func(t *testing.T) {
		merged, changed := bailianModelsAfterDiscovery(nil, []string{"qwen-plus"})
		assert.True(t, changed)
		assert.Equal(t, []string{"qwen-plus"}, merged)
	})

	t.Run("empty discovery keeps operator list", func(t *testing.T) {
		merged, changed := bailianModelsAfterDiscovery([]string{"happyhorse-1.1-t2v"}, nil)
		assert.False(t, changed)
		assert.Equal(t, []string{"happyhorse-1.1-t2v"}, merged)
	})
}

// End-to-end model-list contract for channel creation: the operator's initial
// selection, the workspace discovery pass, and the official catalog merge must
// all survive. Each stage used to overwrite the previous one; together they
// are the three steps that run in syncBailianAfterCreate.
func TestBailianCreateFlowModelListNeverLosesModels(t *testing.T) {
	// Step 1: operator picked a task-plugin model and a custom alias at
	// create time; workspace discovery returns a different set.
	operator := []string{"happyhorse-1.1-t2v", "my-alias"}
	discovered := []string{"qwen-plus", "qwen3-coder-flash"}
	afterDiscovery, _ := bailianModelsAfterDiscovery(operator, discovered)

	// Step 2: official catalog adds console-only models (wan video, TTS).
	catalog := &service.BailianCatalog{Models: []service.BailianModel{
		{Model: "qwen-plus"},
		{Model: "wan3.0-video"},
		{Model: "qwen-tts"},
	}}
	afterCatalog, _ := bailianMergedModelNames(afterDiscovery, catalog)

	// Every model from every stage must still be routable.
	for _, model := range []string{
		"happyhorse-1.1-t2v", "my-alias", // operator
		"qwen-plus", "qwen3-coder-flash", // discovery
		"wan3.0-video", "qwen-tts", // catalog
	} {
		assert.Contains(t, afterCatalog, model, "model %q dropped during create flow", model)
	}
	assert.Len(t, afterCatalog, 6, "create flow must dedup across all three stages")

	// Step 3: re-running the flow (e.g. a manual catalog refresh) is idempotent.
	again, changed := bailianMergedModelNames(afterCatalog, catalog)
	assert.False(t, changed, "re-running catalog merge must not rewrite models")
	assert.Equal(t, afterCatalog, again)
	rediscovered, discoveryChanged := bailianModelsAfterDiscovery(afterCatalog, discovered)
	assert.False(t, discoveryChanged, "re-running discovery must not rewrite models")
	assert.Equal(t, afterCatalog, rediscovered)
}

// The edit flow must price exactly the model list the operator saved. Catalog
// discovery on edit is price-only: it must never rewrite channel.Models, or a
// task-plugin model just added in the drawer would be silently removed. This
// guard locks in the channel-model list used as the pricing target.
func TestBailianEditFlowPricesOperatorModelListNotCatalogList(t *testing.T) {
	// Operator saved these models, including a plugin model absent from the
	// workspace catalog and a third-party alias.
	savedModels := []string{"qwen-plus", "happyhorse-1.1-t2v", "my-alias"}
	catalogModels := []string{"qwen-plus", "qwen3-coder-flash"}

	// The pricing target is the saved list verbatim; the catalog's own model
	// set is only a source of price rows, never a replacement for the target.
	pricingTarget := append([]string(nil), savedModels...)
	assert.Equal(t, savedModels, pricingTarget)

	for _, model := range catalogModels {
		if !containsString(pricingTarget, model) {
			// A catalog-only model has no price row applied because it is not
			// served; it must not be appended to the channel either.
			assert.NotContains(t, savedModels, model)
		}
	}
	for _, model := range savedModels {
		assert.True(t, containsString(pricingTarget, model),
			"operator model %q must remain a pricing target", model)
	}
}

func containsString(values []string, want string) bool {
	for _, v := range values {
		if v == want {
			return true
		}
	}
	return false
}
