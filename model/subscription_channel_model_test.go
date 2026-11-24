package model

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/uter-ai/uter/dto"
)

func TestNormalizeAllowedChannelModels(t *testing.T) {
	cases := []struct {
		name string
		raw  string
		want string // "" means unrestricted
	}{
		{"empty", "", ""},
		{"empty object", "{}", ""},
		{"invalid json", "not json", ""},
		{"invalid channel id", `{"abc":["gpt-4"]}`, ""},
		{"zero channel id", `{"0":["gpt-4"]}`, ""},
		{"empty model list", `{"12":[]}`, ""},
		{"sorted and deduped", `{"12":["gpt-4","claude","gpt-4"],"3":["gemini"]}`,
			`{"12":["claude","gpt-4"],"3":["gemini"]}`},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := NormalizeAllowedChannelModels(tc.raw)
			require.Equal(t, tc.want, got)
		})
	}
}

func TestParseAllowedChannelModels(t *testing.T) {
	parsed := ParseAllowedChannelModels(`{"12":["gpt-4"],"30":["gemini","claude"]}`)
	require.Equal(t, []string{"gpt-4"}, parsed[12])
	require.Equal(t, []string{"gemini", "claude"}, parsed[30])
	require.Nil(t, ParseAllowedChannelModels(""))
	require.Nil(t, ParseAllowedChannelModels("{}"))
}

func TestAllowedChannelModelsStableMarshal(t *testing.T) {
	// json.Marshal sorts map keys; ensure the normalized form is stable so
	// stored snapshots and comparisons are deterministic.
	a := NormalizeAllowedChannelModels(`{"30":["b","a"],"12":["z"]}`)
	b := NormalizeAllowedChannelModels(`{"12":["z"],"30":["a","b"]}`)
	require.Equal(t, a, b)
	var m map[string][]string
	require.NoError(t, json.Unmarshal([]byte(a), &m))
	require.Equal(t, []string{"a", "b"}, m["30"])
}

func TestChannelFilterSubscriptionPlan(t *testing.T) {
	ch := &Channel{Id: 12}
	filter := dto.ChannelFilter{
		Kind:                 dto.FilterSubscriptionPlan,
		AllowedChannelModels: map[int][]string{12: {"gpt-4", "claude"}},
	}
	ok, kind := ChannelSatisfiesFilters(ch, "gpt-4", []dto.ChannelFilter{filter})
	require.True(t, ok)
	require.Empty(t, kind)

	ok, kind = ChannelSatisfiesFilters(ch, "gemini", []dto.ChannelFilter{filter})
	require.False(t, ok)
	require.Equal(t, dto.FilterSubscriptionPlan, kind)

	other := &Channel{Id: 99}
	ok, _ = ChannelSatisfiesFilters(other, "gpt-4", []dto.ChannelFilter{filter})
	require.False(t, ok)

	// Empty map is a no-op.
	noop := dto.ChannelFilter{Kind: dto.FilterSubscriptionPlan}
	ok, _ = ChannelSatisfiesFilters(other, "anything", []dto.ChannelFilter{noop})
	require.True(t, ok)
}
