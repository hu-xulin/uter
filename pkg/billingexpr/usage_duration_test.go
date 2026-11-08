package billingexpr

import (
	"encoding/json"
	"testing"
)

// TestRequestInputForUsageBindsDuration 锁定「任务用量事实里的秒数要绑定到
// `duration` 变量」这条契约。
//
// 背景：按秒计费的上游表达式写成 `(duration > 0 ? duration : 5) * 单价`，
// 而任务结算只传 Usage。duration 恒为 0 时表达式永远走 `: 5` 的兜底，
// 10 秒视频按 5 秒收钱——这是收入侧少收，且不会报错，只能靠测试守住。
func TestRequestInputForUsageBindsDuration(t *testing.T) {
	input := RequestInputForUsage(map[string]any{"seconds": float64(10), "resolution": "1080P"})
	if input.Duration == nil {
		t.Fatal("duration was not bound from usage facts")
	}
	if *input.Duration != 10 {
		t.Errorf("duration = %v, want 10", *input.Duration)
	}
	if input.Usage["resolution"] != "1080P" {
		t.Errorf("usage facts were not carried through: %v", input.Usage)
	}

	// 插件没报时长时保持「未提供」语义，不在结算端猜一个秒数。
	if input := RequestInputForUsage(map[string]any{"resolution": "1080P"}); input.Duration != nil {
		t.Errorf("duration bound without a duration fact: %v", *input.Duration)
	}
	if input := RequestInputForUsage(nil); input.Duration != nil {
		t.Errorf("duration bound from nil usage: %v", *input.Duration)
	}
}

// TestDurationSecondsFromUsage 覆盖字段名族、数值形态与歧义拒绝。
func TestDurationSecondsFromUsage(t *testing.T) {
	accepted := []struct {
		name  string
		usage map[string]any
		want  float64
	}{
		{"canonical seconds", map[string]any{"seconds": float64(10)}, 10},
		{"duration alias", map[string]any{"duration": float64(7)}, 7},
		{"snake case", map[string]any{"duration_seconds": float64(4)}, 4},
		{"camel case", map[string]any{"durationSeconds": float64(3)}, 3},
		{"kebab case", map[string]any{"duration-seconds": float64(6)}, 6},
		{"json number", map[string]any{"seconds": json.Number("9")}, 9},
		{"unrelated field", map[string]any{"resolution": "1080P", "seconds": float64(12)}, 12},
	}
	for _, tc := range accepted {
		got, ok := DurationSecondsFromUsage(tc.usage)
		if !ok || got != tc.want {
			t.Errorf("%s: got (%v, %v), want (%v, true)", tc.name, got, ok, tc.want)
		}
	}

	rejected := []struct {
		name  string
		usage map[string]any
	}{
		{"no duration field", map[string]any{"resolution": "1080P"}},
		{"nil usage", nil},
		{"empty usage", map[string]any{}},
		// 0 与负数都不是可计费时长：让表达式自己决定兜底，不在结算端替它算 0。
		{"zero seconds", map[string]any{"seconds": float64(0)}},
		{"negative seconds", map[string]any{"seconds": float64(-1)}},
		// 同名族出现两个可用值属于契约歧义，按任意一个算钱都是错的。
		{"ambiguous family", map[string]any{"seconds": float64(10), "duration": float64(20)}},
		// 非数值形态（字符串、布尔）不参与绑定。
		{"string seconds", map[string]any{"seconds": "10"}},
		{"bool seconds", map[string]any{"seconds": true}},
	}
	for _, tc := range rejected {
		if got, ok := DurationSecondsFromUsage(tc.usage); ok {
			t.Errorf("%s: unexpectedly bound duration %v", tc.name, got)
		}
	}
}

// TestPerSecondExpressionUsesBoundDuration 用真实的上游按秒表达式证明：
// 绑定 duration 后，档位与秒数都按实际用量结算。
func TestPerSecondExpressionUsesBoundDuration(t *testing.T) {
	const wan3 = `u("resolution") == "1080P" ? tier("1080p", (duration > 0 ? duration : 5) * 0.12537315) : ` +
		`(u("resolution") == "480P" ? tier("480p", (duration > 0 ? duration : 5) * 0.03134327) : ` +
		`tier("720p", (duration > 0 ? duration : 5) * 0.06268654))`

	cases := []struct {
		name      string
		usage     map[string]any
		wantCost  float64
		wantTier  string
		tolerance float64
	}{
		{"1080P ten seconds", map[string]any{"seconds": float64(10), "resolution": "1080P"}, 1.2537315, "1080p", 1e-6},
		{"480P ten seconds", map[string]any{"seconds": float64(10), "resolution": "480P"}, 0.3134327, "480p", 1e-6},
		{"720P ten seconds", map[string]any{"seconds": float64(10), "resolution": "720P"}, 0.6268654, "720p", 1e-6},
		// 没报秒数时沿用表达式自己的 5 秒兜底，且不再报 nil 运算错误。
		{"1080P without seconds", map[string]any{"resolution": "1080P"}, 0.62686575, "1080p", 1e-6},
	}
	for _, tc := range cases {
		cost, trace, err := RunExprWithRequest(wan3, TokenParams{}, RequestInputForUsage(tc.usage))
		if err != nil {
			t.Fatalf("%s: run failed: %v", tc.name, err)
		}
		if trace.MatchedTier != tc.wantTier {
			t.Errorf("%s: tier = %q, want %q", tc.name, trace.MatchedTier, tc.wantTier)
		}
		if diff := cost - tc.wantCost; diff > tc.tolerance || diff < -tc.tolerance {
			t.Errorf("%s: cost = %v, want %v", tc.name, cost, tc.wantCost)
		}
	}
}
