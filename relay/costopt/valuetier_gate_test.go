package costopt

import (
	"testing"

	costoptcfg "github.com/uter-ai/uter/setting/costopt"

	"github.com/uter-ai/uter/relaykit/dto"
)

// 🔑 回归背景：ValueTierBulkOnly 的字段文档写的是「仅对 bulk（长prompt）流量
// 下沉，短交互仍走前沿模型」，但实现把长度判定整段包在
// `if cfg.ValueTierBulkOnly { ... }` 里。默认值 bulk_only=false → 判定被跳过 →
// **所有请求无条件下沉**到价值层。
//
// 实测后果：claude-haiku-4-5-20251001 的 81 token 短问答也被改写成
// openai/gpt-oss-120b。既违背字段语义，又让降本 A/B 两组走同一条路径、
// 测试结果失去可比性。
//
// 下面钉死：auto_detect_bulk 开启时，长度门槛必须生效。

func vtReq(content string) *dto.GeneralOpenAIRequest {
	return &dto.GeneralOpenAIRequest{
		Model: "claude-haiku-4-5-20251001",
		Messages: []dto.Message{
			{Role: "user", Content: content},
		},
	}
}

// 长文档：明显超过 minChars
func vtLong() string {
	s := ""
	for i := 0; i < 60; i++ {
		s += "分布式网关的限流通常需要在三个层次上协同工作。"
	}
	return s
}

func withValueTier(t *testing.T) func() {
	t.Helper()
	cfg := costoptcfg.GetCostOptSetting()
	oldActive, oldMode := cfg.ValueTierEnabled, cfg.ValueTierMode
	oldBulkOnly, oldAutoDetect := cfg.ValueTierBulkOnly, cfg.ValueTierAutoDetectBulk
	oldMin, oldModels, oldEquiv := cfg.ValueTierMinPromptChars, cfg.ValueTierModels, cfg.ValueTierModelEquivalents

	cfg.ValueTierEnabled = true
	cfg.ValueTierMode = "auto"
	cfg.ValueTierAutoDetectBulk = true
	cfg.ValueTierMinPromptChars = 1200
	// 留空 ValueTierModels = 不限模型，避免模型白名单干扰本用例
	cfg.ValueTierModels = nil
	cfg.ValueTierModelEquivalents = nil
	return func() {
		cfg.ValueTierEnabled = oldActive
		cfg.ValueTierMode = oldMode
		cfg.ValueTierBulkOnly = oldBulkOnly
		cfg.ValueTierAutoDetectBulk = oldAutoDetect
		cfg.ValueTierMinPromptChars = oldMin
		cfg.ValueTierModels = oldModels
		cfg.ValueTierModelEquivalents = oldEquiv
	}
}

func TestValueTierMatch_ShortPromptNotDowngraded(t *testing.T) {
	defer withValueTier(t)()

	// 关闭 bulk_only（默认值），但 auto_detect_bulk=true —— 这正是线上配置
	cfg := costoptcfg.GetCostOptSetting()
	cfg.ValueTierBulkOnly = false

	short := vtReq("用一句话说明什么是 API 网关。")
	if len([]rune("用一句话说明什么是 API 网关。")) >= cfg.ValueTierMinPromptChars {
		t.Fatalf("用例前提不成立：短文本已达阈值")
	}
	if ValueTierMatch(short) {
		t.Fatalf("短交互不应下沉到价值层（bulk_only=false + auto_detect_bulk=true）")
	}
}

func TestValueTierMatch_LongPromptDowngraded(t *testing.T) {
	defer withValueTier(t)()

	cfg := costoptcfg.GetCostOptSetting()
	cfg.ValueTierBulkOnly = false

	long := vtReq(vtLong())
	if len([]rune(vtLong())) < cfg.ValueTierMinPromptChars {
		t.Fatalf("用例前提不成立：长文本未达阈值")
	}
	if !ValueTierMatch(long) {
		t.Fatalf("长prompt 应下沉到价值层")
	}
}

func TestValueTierMatch_BulkOnlyTrueGatesShortPrompt(t *testing.T) {
	defer withValueTier(t)()

	cfg := costoptcfg.GetCostOptSetting()
	cfg.ValueTierBulkOnly = true
	cfg.ValueTierAutoDetectBulk = false

	if ValueTierMatch(vtReq("简答：什么是 API 网关？")) {
		t.Fatalf("bulk_only=true 时短交互绝不应下沉")
	}
	if !ValueTierMatch(vtReq(vtLong())) {
		t.Fatalf("bulk_only=true 时长 prompt 应下沉")
	}
}

func TestValueTierMatch_BothFlagsOffMeansNoGate(t *testing.T) {
	defer withValueTier(t)()

	// 显式两个开关都关 = 运营主动要求「全部下沉」，此时不加门槛
	cfg := costoptcfg.GetCostOptSetting()
	cfg.ValueTierBulkOnly = false
	cfg.ValueTierAutoDetectBulk = false

	if !ValueTierMatch(vtReq("短问题")) {
		t.Fatalf("两个开关都关时应视为不限 bulk，对所有流量下沉")
	}
}

// 顺带钉住：模型白名单为空时不限模型；非空时不匹配的模型不下沉。
func TestValueTierMatch_ModelWhitelist(t *testing.T) {
	defer withValueTier(t)()
	cfg := costoptcfg.GetCostOptSetting()
	cfg.ValueTierBulkOnly = false
	cfg.ValueTierAutoDetectBulk = false
	cfg.ValueTierModels = []string{"gpt-4o"}

	req := vtReq("任意内容")
	req.Model = "claude-haiku-4-5-20251001"
	if ValueTierMatch(req) {
		t.Fatalf("白名单不含该模型时不应下沉")
	}

	req.Model = "gpt-4o"
	if !ValueTierMatch(req) {
		t.Fatalf("白名单命中时应下沉")
	}
}
