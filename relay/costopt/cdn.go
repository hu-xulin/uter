package costopt

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"strconv"
	"strings"
	"time"

	costoptcfg "github.com/uter-ai/uter/setting/costopt"
)

// ===== 18. 边缘 / CDN 静态资源缓存 =====
//
// 现状缺口（V2 标记为 🟡）：此前只有一行字符串拼接的字符串钩子，缺缓存策略、
// 路径过滤与回源鉴权，无法形成完整能力。
// V2.2 补齐：路径前缀过滤、缓存时长下发、回源地址与可选回源签名。
// 参数填齐（CDN 域名 + 可选回源/签名）后即由钩子升级为完整能力；未启用时原样返回，
// 不影响主链路。

// CDNAssetURL 把相对静态资源路径改写为 CDN 前缀。
// 未启用、前缀为空、或路径不在配置前缀白名单内时原样返回。
func CDNAssetURL(path string) string {
	cfg := costoptcfg.GetCostOptSetting()
	if !cfg.CDNEnabled || cfg.CDNAssetBaseURL == "" || path == "" {
		return path
	}
	if !cdnPathAllowed(cfg, path) {
		return path
	}
	base := strings.TrimRight(cfg.CDNAssetBaseURL, "/")
	if path[0] == '/' {
		return base + path
	}
	return base + "/" + path
}

// cdnPathAllowed 路径前缀白名单过滤（空=全部静态资源都走 CDN）。
func cdnPathAllowed(cfg *costoptcfg.CostOptSetting, path string) bool {
	if len(cfg.CDNPathPrefixes) == 0 {
		return true
	}
	for _, p := range cfg.CDNPathPrefixes {
		if p == "" {
			continue
		}
		if strings.HasPrefix(path, p) {
			return true
		}
	}
	return false
}

// CDNCacheControl 生成给静态资源的 Cache-Control 响应头值。
// 未启用返回空串（调用方应跳过设置）。
func CDNCacheControl() string {
	cfg := costoptcfg.GetCostOptSetting()
	if !cfg.CDNEnabled {
		return ""
	}
	ttl := cfg.CDNCacheTTLSeconds
	if ttl <= 0 {
		ttl = 86400
	}
	return "public, max-age=" + strconv.Itoa(ttl)
}

// CDNOriginFor 返回该资源的回源地址（未配置回源则返回空串，表示由 CDN 自行回源）。
func CDNOriginFor(path string) string {
	cfg := costoptcfg.GetCostOptSetting()
	if !cfg.CDNEnabled || cfg.CDNOriginURL == "" || path == "" {
		return ""
	}
	origin := strings.TrimRight(cfg.CDNOriginURL, "/")
	if path[0] == '/' {
		return origin + path
	}
	return origin + "/" + path
}

// CDNSignHeaders 生成回源鉴权头（header/secret 任一为空则返回 nil）。
// 签名内容 = 路径 + 过期时间戳，防止回源被直接盗刷。
func CDNSignHeaders(path string, ttlSeconds int) map[string]string {
	cfg := costoptcfg.GetCostOptSetting()
	if !cfg.CDNEnabled || cfg.CDNSigningHeader == "" || cfg.CDNSigningSecret == "" {
		return nil
	}
	if ttlSeconds <= 0 {
		ttlSeconds = 600
	}
	exp := time.Now().Add(time.Duration(ttlSeconds) * time.Second).Unix()
	mac := hmac.New(sha256.New, []byte(cfg.CDNSigningSecret))
	mac.Write([]byte(path))
	mac.Write([]byte(":"))
	mac.Write([]byte(strconv.FormatInt(exp, 10)))
	return map[string]string{
		cfg.CDNSigningHeader: hex.EncodeToString(mac.Sum(nil)),
		"X-CDN-Expires":      strconv.FormatInt(exp, 10),
	}
}

// CDNIncludeQuery 缓存键是否包含 query string（供 CDN 侧规则配置参考）。
func CDNIncludeQuery() bool {
	return costoptcfg.GetCostOptSetting().CDNIncludeQuery
}
