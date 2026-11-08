package billingexpr

import (
	"encoding/json"
	"math"
	"sort"
	"strings"
)

// usageDurationKeys 是任务插件汇报「可计费媒体时长」时使用的字段名族，
// 与 relay 侧 classifyUsageKey 的 duration 族同口径（大小写、下划线、
// 连字符都不参与区分）。放在本包是为了让结算端只依赖用量事实本身，
// 不必反向 import relay 包。
var usageDurationKeys = map[string]struct{}{
	"duration":        {},
	"durationseconds": {},
	"second":          {},
	"seconds":         {},
}

// RequestInputForUsage 把任务用量事实包成表达式请求输入，并把插件汇报的
// 可计费秒数绑定到 `duration` 变量。
//
// 为什么需要它：`duration` 是 billing_expr 的一等变量（视频按秒计费的表达式
// 都这么写，例如
// `tier("720p", (duration > 0 ? duration : 5) * 0.06268654)`），但任务结算只
// 传用量事实、RequestInput.Duration 一直是 nil——于是 `duration` 恒为 0，
// 表达式永远走 `: 5` 的兜底秒数。10 秒的 1080P 视频按 5 秒计价，是收入侧的
// 持续少收。把插件汇报的秒数绑定回 duration，按秒计费才与插件声明的用量一致。
//
// 插件没报时长时 Duration 保持 nil，沿用「未提供」语义：表达式自己决定兜底，
// 绝不在结算端替它猜一个秒数。
func RequestInputForUsage(usage map[string]any) RequestInput {
	input := RequestInput{Usage: usage}
	if seconds, ok := DurationSecondsFromUsage(usage); ok {
		input.Duration = &seconds
	}
	return input
}

// DurationSecondsFromUsage 从任务用量事实里取可计费的秒数。
//
// 只认规范名族里**唯一**的一个字段，且必须 > 0：插件没报时长时返回
// ok=false。多个字段命中同一族属于契约歧义，同样返回 ok=false，避免按任意
// 一个算钱。
func DurationSecondsFromUsage(usage map[string]any) (float64, bool) {
	if len(usage) == 0 {
		return 0, false
	}
	// 排序后再扫，保证同一份事实每次得到同一个结果。
	keys := make([]string, 0, len(usage))
	for key := range usage {
		keys = append(keys, key)
	}
	sort.Strings(keys)

	var seconds float64
	found := false
	for _, key := range keys {
		if _, ok := usageDurationKeys[foldUsageKey(key)]; !ok {
			continue
		}
		value, ok := usageNumber(usage[key])
		if !ok || value <= 0 {
			continue
		}
		if found {
			// 同一族出现两个可用值，无法判定哪个才是可计费时长。
			return 0, false
		}
		seconds = value
		found = true
	}
	return seconds, found
}

// foldUsageKey 折掉大小写与分隔符，与 relay 的 classifyUsageKey 同规则。
func foldUsageKey(key string) string {
	key = strings.ToLower(strings.TrimSpace(key))
	key = strings.ReplaceAll(key, "_", "")
	return strings.ReplaceAll(key, "-", "")
}

// usageNumber 把插件汇报的数值事实转成 float64。插件通过 JSON 边界把数字
// 传过来，可能是 float64/int/json.Number/字符串字面量。
func usageNumber(value any) (float64, bool) {
	switch typed := value.(type) {
	case float64:
		return usableFloat(typed)
	case float32:
		return usableFloat(float64(typed))
	case int:
		return usableFloat(float64(typed))
	case int64:
		return usableFloat(float64(typed))
	case json.Number:
		parsed, err := typed.Float64()
		if err != nil {
			return 0, false
		}
		return usableFloat(parsed)
	default:
		return 0, false
	}
}

func usableFloat(value float64) (float64, bool) {
	if math.IsNaN(value) || math.IsInf(value, 0) {
		return 0, false
	}
	return value, true
}
