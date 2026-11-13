package common

import "strings"

// PlaygroundRoutePrefix 是站内调试台的路由前缀。调试台复用 OpenAI Chat
// Completions 的端点语义，但挂在自己的前缀下以区别于对外 API。
const PlaygroundRoutePrefix = "/pg"

// CanonicalUpstreamPath 把「站内别名路径」映射成 relay 实际发往上游的路径。
//
// 存在两套路径表达同一件事：
//   - 进来的是 /pg/chat/completions（站内调试台）
//   - 真正转发上游的是 /v1/chat/completions（见 relay/common.GenRelayInfo 的改写）
//
// 渠道侧的路由能力（Advanced Custom 的 advanced_routes、任务插件的端点声明）
// 全部按**上游路径**登记。因此任何「按请求路径判断渠道是否支持」的比较，都必须
// 先把站内别名归一化，否则会把 /pg/* 当成一个没人声明过的端点，把所有按上游
// 路径配置的渠道判成不支持，最终以「分组下没有可用渠道」告终。
//
// 查询串与渠道路由匹配无关（按 path 段比对），这里一并剥掉，避免带 query 时
// 精确匹配失配。传入原始请求路径，返回可用于渠道能力比对的路径。
func CanonicalUpstreamPath(path string) string {
	path, _, _ = strings.Cut(path, "?")
	if path == PlaygroundRoutePrefix {
		return "/v1"
	}
	rest, ok := strings.CutPrefix(path, PlaygroundRoutePrefix+"/")
	if !ok {
		return path
	}
	return "/v1/" + rest
}
