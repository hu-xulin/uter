package costopt

import (
	relaycommon "github.com/uter-ai/uter/relay/common"
	costoptcfg "github.com/uter-ai/uter/setting/costopt"
)

// GeoRoutePreferredChannelType 根据请求头区域返回配置的偏好渠道类型名（空=不偏好）。
// handler 在派发前调用本函数，并把结果 c.Set("costopt_geo_ct", ...) 透传给选路加权。
func GeoRoutePreferredChannelType(region string) string {
	cfg := costoptcfg.GetCostOptSetting()
	if !cfg.GeoRoutingEnabled || region == "" {
		return ""
	}
	return cfg.GeoRoutingChannelTypeByRegion[region]
}

// GeoRoutingRegionHeader 返回配置的区域请求头名（默认 X-Uter-Region）。
func GeoRoutingRegionHeader() string {
	cfg := costoptcfg.GetCostOptSetting()
	if cfg.GeoRoutingEnabled && cfg.GeoRoutingRegionHeader != "" {
		return cfg.GeoRoutingRegionHeader
	}
	return "X-Uter-Region"
}

// ApplyGeoRouting 计算区域偏好渠道类型（供 handler 写入 gin 上下文）。
func ApplyGeoRouting(info *relaycommon.RelayInfo, region string) string {
	return GeoRoutePreferredChannelType(region)
}
