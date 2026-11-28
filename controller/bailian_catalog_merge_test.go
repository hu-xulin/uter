package controller

import (
	"testing"

	"github.com/stretchr/testify/assert"
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

func TestBailianCatalogModelsEnabledOption(t *testing.T) {
	for _, value := range []string{"", "true", "TRUE", "yes", "1"} {
		assert.True(t, bailianCatalogModelsEnabledFrom(value), "value=%q", value)
	}
	for _, value := range []string{"false", "False", "FALSE", " false "} {
		assert.False(t, bailianCatalogModelsEnabledFrom(value), "value=%q", value)
	}
}
