package costopt

import (
	"testing"

	costoptcfg "github.com/uter-ai/uter/setting/costopt"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	relaycommon "github.com/uter-ai/uter/relay/common"
	"github.com/uter-ai/uter/relaykit/dto"
)

// withShortCircuitConfig 临时配置短路规则，结束后还原全局配置。
func withShortCircuitConfig(t *testing.T, enabled bool, rules []costoptcfg.ShortCircuitRule) {
	t.Helper()
	cfg := costoptcfg.GetCostOptSetting()
	prev := *cfg
	cfg.ShortCircuitEnabled = enabled
	cfg.ShortCircuitRules = rules
	t.Cleanup(func() { *cfg = prev })
}

func scRequest(text string) *dto.GeneralOpenAIRequest {
	stream := false
	return &dto.GeneralOpenAIRequest{
		Model:  "gpt-4o",
		Stream: &stream,
		Messages: []dto.Message{
			{Role: "system", Content: "you are helpful"},
			{Role: "user", Content: text},
		},
	}
}

func scInfo() *relaycommon.RelayInfo {
	return &relaycommon.RelayInfo{UserId: 1, UsingGroup: "default", TokenGroup: "default", ChannelMeta: &relaycommon.ChannelMeta{ChannelType: 1}, OriginModelName: "gpt-4o"}
}

func TestMatchShortCircuit_Disabled(t *testing.T) {
	withShortCircuitConfig(t, false, []costoptcfg.ShortCircuitRule{
		{ID: "r1", Enabled: true, Match: "exact", Pattern: "hi", Answer: "hello"},
	})
	_, hit := MatchShortCircuit(scRequest("hi"), scInfo())
	assert.False(t, hit, "开关关闭时不应命中")
}

func TestMatchShortCircuit_ExactContainsRegex(t *testing.T) {
	withShortCircuitConfig(t, true, []costoptcfg.ShortCircuitRule{
		{ID: "exact", Enabled: true, Match: "exact", Pattern: "你好", Answer: "exact-ans", Priority: 1},
		{ID: "contains", Enabled: true, Match: "contains", Pattern: "退款", Answer: "contains-ans", Priority: 1},
		{ID: "regex", Enabled: true, Match: "regex", Pattern: `^订单\d+$`, Answer: "regex-ans", Priority: 1},
	})

	ans, hit := MatchShortCircuit(scRequest("你好"), scInfo())
	require.True(t, hit)
	assert.Equal(t, "exact-ans", ans)

	ans, hit = MatchShortCircuit(scRequest("我要退款怎么办"), scInfo())
	require.True(t, hit)
	assert.Equal(t, "contains-ans", ans)

	ans, hit = MatchShortCircuit(scRequest("订单12345"), scInfo())
	require.True(t, hit)
	assert.Equal(t, "regex-ans", ans)

	_, hit = MatchShortCircuit(scRequest("完全不相关的问题"), scInfo())
	assert.False(t, hit, "无规则匹配时应返回未命中")
}

func TestMatchShortCircuit_CaseInsensitive(t *testing.T) {
	withShortCircuitConfig(t, true, []costoptcfg.ShortCircuitRule{
		{ID: "ci", Enabled: true, Match: "exact", Pattern: "Hello", Answer: "ci-ans", CaseSensitive: false},
	})
	ans, hit := MatchShortCircuit(scRequest("hello"), scInfo())
	require.True(t, hit)
	assert.Equal(t, "ci-ans", ans)

	// 区分大小写时不应命中
	withShortCircuitConfig(t, true, []costoptcfg.ShortCircuitRule{
		{ID: "cs", Enabled: true, Match: "exact", Pattern: "Hello", Answer: "cs-ans", CaseSensitive: true},
	})
	_, hit = MatchShortCircuit(scRequest("hello"), scInfo())
	assert.False(t, hit, "区分大小写时小写不应命中大写规则")
}

func TestMatchShortCircuit_ScopeAndModel(t *testing.T) {
	withShortCircuitConfig(t, true, []costoptcfg.ShortCircuitRule{
		{ID: "scope", Enabled: true, Match: "exact", Pattern: "hi", Answer: "scope-ans", Scope: "vip"},
	})
	// 分组不匹配
	info := scInfo()
	info.UsingGroup = "default"
	_, hit := MatchShortCircuit(scRequest("hi"), info)
	assert.False(t, hit, "Scope 限定 vip，default 分组不应命中")

	info.UsingGroup = "vip"
	ans, hit := MatchShortCircuit(scRequest("hi"), info)
	require.True(t, hit)
	assert.Equal(t, "scope-ans", ans)

	// 模型不匹配
	withShortCircuitConfig(t, true, []costoptcfg.ShortCircuitRule{
		{ID: "model", Enabled: true, Match: "exact", Pattern: "hi", Answer: "model-ans", Model: "gpt-4o"},
	})
	req := scRequest("hi")
	req.Model = "gpt-3.5-turbo"
	_, hit = MatchShortCircuit(req, scInfo())
	assert.False(t, hit, "Model 限定 gpt-4o，其它模型不应命中")
}

func TestMatchShortCircuit_PriorityAndDisabled(t *testing.T) {
	// 高优先级优先；disabled 规则跳过
	withShortCircuitConfig(t, true, []costoptcfg.ShortCircuitRule{
		{ID: "low", Enabled: true, Match: "contains", Pattern: "天气", Answer: "low-ans", Priority: 1},
		{ID: "high", Enabled: true, Match: "contains", Pattern: "天气", Answer: "high-ans", Priority: 10},
		{ID: "off", Enabled: false, Match: "contains", Pattern: "天气", Answer: "off-ans", Priority: 100},
	})
	ans, hit := MatchShortCircuit(scRequest("今天天气如何"), scInfo())
	require.True(t, hit)
	assert.Equal(t, "high-ans", ans, "高优先级规则应优先命中，disabled 规则应被跳过")
}
