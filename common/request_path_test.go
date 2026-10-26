package common

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestCanonicalUpstreamPathAliasesPlaygroundToV1(t *testing.T) {
	tests := []struct {
		name string
		path string
		want string
	}{
		{name: "chat completions", path: "/pg/chat/completions", want: "/v1/chat/completions"},
		{name: "responses", path: "/pg/responses", want: "/v1/responses"},
		{name: "bare prefix", path: "/pg", want: "/v1"},
		{name: "already canonical", path: "/v1/chat/completions", want: "/v1/chat/completions"},
		{name: "api path untouched", path: "/api/user/self", want: "/api/user/self"},
		{name: "empty path untouched", path: "", want: ""},
		{name: "prefix only matches whole segment", path: "/pgx/chat", want: "/pgx/chat"},
	}

	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			assert.Equal(t, testCase.want, CanonicalUpstreamPath(testCase.path))
		})
	}
}

func TestCanonicalUpstreamPathDropsQueryString(t *testing.T) {
	// 渠道路由按 path 段比对，查询串不参与；带 query 时若原样保留会让精确匹配失配。
	assert.Equal(t, "/v1/chat/completions", CanonicalUpstreamPath("/pg/chat/completions?stream=true"))
	assert.Equal(t, "/v1/responses", CanonicalUpstreamPath("/v1/responses?stream=true"))
}