package costopt

import (
	"context"
	"testing"

	costoptcfg "github.com/uter-ai/uter/setting/costopt"

	"github.com/stretchr/testify/require"
	relaycommon "github.com/uter-ai/uter/relay/common"
	"github.com/uter-ai/uter/relaykit/dto"
)

// CI 成本回归：对确定性降本逻辑做断言，防止"省钱逻辑"回退（token 当延迟管）。
// 这些用例不依赖外部网络，纯逻辑验证。

func newTestRequest(nUser int, lastUser string) *dto.GeneralOpenAIRequest {
	msgs := make([]dto.Message, 0, nUser+1)
	for i := 0; i < nUser; i++ {
		msgs = append(msgs, dto.Message{Role: "user", Content: "历史消息"})
	}
	if lastUser != "" {
		msgs = append(msgs, dto.Message{Role: "user", Content: lastUser})
	}
	return &dto.GeneralOpenAIRequest{Model: "gpt-4o", Messages: msgs}
}

func TestRegression_ContextWindowTruncates(t *testing.T) {
	cfg := costoptcfg.GetCostOptSetting()
	cfg.ContextWindowEnabled = true
	cfg.ContextWindowMaxMessages = 5
	defer func() { cfg.ContextWindowEnabled = false }()

	req := newTestRequest(30, "最后一个问题")
	before := len(req.Messages)
	ApplyContextWindow(req, &relaycommon.RelayInfo{})
	require.Less(t, len(req.Messages), before, "上下文滑动窗口应裁掉旧消息，降低输入 token")
	require.LessOrEqual(t, len(req.Messages), 5)
	// 最后一个用户问题应保留
	require.Equal(t, "最后一个问题", req.Messages[len(req.Messages)-1].StringContent())
}

func TestRegression_ComplexityRoutingRewritesCheap(t *testing.T) {
	cfg := costoptcfg.GetCostOptSetting()
	cfg.ComplexityRoutingEnabled = true
	cfg.ComplexityRoutingFromModels = []string{"gpt-4o"}
	cfg.ComplexityRoutingCheapModel = "gpt-4o-mini"
	defer func() { cfg.ComplexityRoutingEnabled = false }()

	// 模型保真：复杂度路由已停用，简单问题也不得下沉到别的模型。
	req := &dto.GeneralOpenAIRequest{Model: "gpt-4o", Messages: []dto.Message{{Role: "user", Content: "现在几点"}}}
	ok := ApplyComplexityRouting(req, &relaycommon.RelayInfo{})
	require.False(t, ok, "模型保真：复杂度路由已停用，不得降级模型")
	require.Equal(t, "gpt-4o", req.Model, "客户选择的模型必须保持不变")
}

func TestRegression_ToolDefTrimStrips(t *testing.T) {
	cfg := costoptcfg.GetCostOptSetting()
	cfg.ToolDefTrimEnabled = true
	cfg.ToolDefTrimStripDescription = true
	defer func() { cfg.ToolDefTrimEnabled = false; cfg.ToolDefTrimStripDescription = false }()

	req := &dto.GeneralOpenAIRequest{
		Tools: []dto.ToolCallRequest{{Type: "function", Function: dto.FunctionRequest{Name: "f", Description: "很长的描述"}}},
	}
	ApplyToolDefTrim(req)
	require.Equal(t, "", req.Tools[0].Function.Description, "工具定义精简应剥离 description，降低每请求 token")
}

func TestRegression_DetectLoop(t *testing.T) {
	cfg := costoptcfg.GetCostOptSetting()
	cfg.LoopDetectionEnabled = true
	cfg.LoopDetectionThreshold = 3
	defer func() { cfg.LoopDetectionEnabled = false }()

	req := &dto.GeneralOpenAIRequest{
		Messages: []dto.Message{
			{Role: "user", Content: "重复"},
			{Role: "assistant", Content: "x"},
			{Role: "user", Content: "重复"},
			{Role: "assistant", Content: "y"},
			{Role: "user", Content: "重复"},
		},
	}
	hit, _ := DetectLoop(req)
	require.True(t, hit, "连续 3 条相同用户消息应被判为死循环")
}

func TestRegression_AgentStepBudgetBlocks(t *testing.T) {
	cfg := costoptcfg.GetCostOptSetting()
	cfg.AgentStepBudgetEnabled = true
	cfg.AgentStepBudgetMaxSteps = 5
	defer func() { cfg.AgentStepBudgetEnabled = false }()

	r := CheckAgentStepBudget(context.Background(), &relaycommon.RelayInfo{}, map[string]string{"X-Uter-Agent-Step": "5"})
	require.True(t, r.Blocked, "步数达到上限应被拦截，防 Agent 失控烧钱")

	r2 := CheckAgentStepBudget(context.Background(), &relaycommon.RelayInfo{}, map[string]string{"X-Uter-Agent-Step": "2"})
	require.False(t, r2.Blocked, "步数未达上限不应拦截")
}

func TestRegression_GeoRoute(t *testing.T) {
	cfg := costoptcfg.GetCostOptSetting()
	cfg.GeoRoutingEnabled = true
	cfg.GeoRoutingChannelTypeByRegion = map[string]string{"eu": "Azure"}
	defer func() { cfg.GeoRoutingEnabled = false }()

	require.Equal(t, "Azure", GeoRoutePreferredChannelType("eu"), "区域 eu 应路由到 Azure 渠道类型")
	require.Equal(t, "", GeoRoutePreferredChannelType("us"), "未配置区域不应偏好")
}
