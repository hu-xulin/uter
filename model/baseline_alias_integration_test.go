package model

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/uter-ai/uter/common"
)

func TestSynchronizedBaselineUsesWhitelistOptionAndExportsConflicts(t *testing.T) {
	withSynchronizedPricing(t, map[string]map[string]any{
		"ModelRatio": {
			"DeepSeek-V4-1-Flash-fast": 0.125,
			"DeepSeek-V4-1-Flash-Fast": 0.3,
		},
	})

	previousOptions := common.OptionMap
	common.OptionMap = map[string]string{}
	t.Cleanup(func() { common.OptionMap = previousOptions })

	// Without a whitelist the group is dropped but exported for auditing.
	baseline := synchronizedOfficialBaseline()
	_, ok := baseline["deepseek:v4:1:flash:fast"]
	require.False(t, ok)
	exported := common.GetOption(BaselineAliasConflictsOptionKey)
	require.NotEmpty(t, exported, "conflicts must be exported as an auditable option")
	var conflicts []BaselineAliasConflict
	require.NoError(t, json.Unmarshal([]byte(exported), &conflicts))
	require.Len(t, conflicts, 1)

	// With the whitelist the exact model ID is recovered.
	common.OptionMap[BaselineAliasWhitelistOptionKey] =
		`{"deepseek:v4:1:flash:fast":"DeepSeek-V4-1-Flash-Fast"}`
	baseline = synchronizedOfficialBaseline()
	row, ok := baseline["deepseek:v4:1:flash:fast"]
	require.True(t, ok, "an explicit whitelist must restore the contested baseline group")
	require.InDelta(t, 0.6, row.Input, 1e-9)
}
