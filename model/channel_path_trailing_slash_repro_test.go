package model

import (
	"testing"

	"github.com/uter-ai/uter/common"
	kitdto "github.com/uter-ai/uter/relaykit/dto"

	"github.com/stretchr/testify/require"
)

// 缺陷复现（UAP-REAL-REPAIR-001）：
//
// 渠道的 advanced_routes 按**上游路径**登记（/v1/chat/completions），
// channelMatchesFilter 用 common.CanonicalUpstreamPath 归一化站内调试台路径
// 后交给 AdvancedCustomConfig.SupportsPathForModel 做精确相等比对。
//
// 当请求路径带尾斜杠时（Gin 的 RedirectTrailingSlash 在 plugin-router 中
// 被显式关闭，且 relay_info / advancedcustom adaptor 还会从 RequestURLPath
// 再次取路径），归一化结果仍保留尾斜杠，与登记路径精确比对失配，
// 唯一候选渠道被判成「不支持该端点」→「分组下没有可用渠道」503。
//
// 本测试不依赖数据库，直接复用生产路径上的两个真实函数复现该误判。
func TestReproTrailingSlashCanonicalPathBreaksChannelMatching(t *testing.T) {
	config := &kitdto.AdvancedCustomConfig{
		Routes: []kitdto.AdvancedCustomRoute{{
			IncomingPath: "/v1/chat/completions",
			UpstreamPath: "/v1/chat/completions",
			Converter:    "none",
		}},
	}

	// 对照组：不带尾斜杠的既有行为必须始终成立（防止修复引入回归）。
	require.True(t,
		config.SupportsPathForModel(common.CanonicalUpstreamPath("/pg/chat/completions"), "gpt-4o"),
		"baseline playground path must keep matching")

	for _, path := range []string{
		"/pg/chat/completions/",
		"/pg/chat/completions/?stream=true",
		"/v1/chat/completions/",
	} {
		t.Run(path, func(t *testing.T) {
			canonical := common.CanonicalUpstreamPath(path)
			require.Equal(t, "/v1/chat/completions", canonical,
				"canonical path must be usable for exact channel-route matching")
			require.True(t, config.SupportsPathForModel(canonical, "gpt-4o"),
				"trailing slash must not make the only configured channel look unsupported")
		})
	}
}
