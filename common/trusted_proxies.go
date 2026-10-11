package common

import (
	"errors"
	"fmt"
	"strings"

	"github.com/gin-gonic/gin"
)

// defaultTrustedProxyCIDRs 只信任回环，不含 RFC 1918 私网与 IPv6 ULA。
//
// 为什么不再默认信任内网网段：uter 的默认部署形态是容器 / K8s（见
// docker-compose.yml），应用与客户端往往同处 10.x / 172.16.x / 192.168.x。
// gin 的 ClientIP() 在直连方命中可信列表时会采信 X-Forwarded-For，于是
// 同网段的任意请求方构造一个 XFF 头就能让 ClientIP() 每次返回不同值。
// 受影响的三处都是安全控制：按 IP 计的登录/验证码限流、Token 的 allow_ips
// 白名单、审计日志记录的 ip。信任内网等于把这三处的可信度降为 0。
//
// 兼容性：确实在反代后部署的站点必须显式配置 TRUSTED_PROXIES
// （列出真实反代的 IP/CIDR）或 TRUSTED_PROXIES=none。这是有意的
// breaking change —— 静默采信来源不可信的请求头比「取不到真实 IP」更糟。
var defaultTrustedProxyCIDRs = []string{
	"127.0.0.0/8",
	"::1",
}

// ResolveTrustedProxies parses TRUSTED_PROXIES without applying it to an
// engine. The returned slice can be reused by the outer and plugin engines.
func ResolveTrustedProxies(raw string) (trustedProxies []string, usedDefaults bool, err error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return append([]string(nil), defaultTrustedProxyCIDRs...), true, nil
	}
	if strings.EqualFold(raw, "none") {
		return nil, false, nil
	}

	parts := strings.Split(raw, ",")
	trustedProxies = make([]string, 0, len(parts))
	for _, part := range parts {
		trustedProxy := strings.TrimSpace(part)
		if trustedProxy == "" {
			continue
		}
		if strings.EqualFold(trustedProxy, "none") {
			return nil, false, errors.New("TRUSTED_PROXIES=none must be used alone")
		}
		trustedProxies = append(trustedProxies, trustedProxy)
	}
	if len(trustedProxies) == 0 {
		return nil, false, errors.New("TRUSTED_PROXIES does not contain an IP address or CIDR")
	}
	return trustedProxies, false, nil
}

func ConfigureTrustedProxies(engine *gin.Engine, trustedProxies []string) error {
	if err := engine.SetTrustedProxies(trustedProxies); err != nil {
		return fmt.Errorf("invalid TRUSTED_PROXIES: %w", err)
	}
	return nil
}
