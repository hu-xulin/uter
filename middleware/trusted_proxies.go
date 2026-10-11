package middleware

import (
	"log"
	"os"

	"github.com/uter-ai/uter/common"

	"github.com/gin-gonic/gin"
)

func ConfigureTrustedProxies(engine *gin.Engine) error {
	trustedProxies, usedDefaults, err := common.ResolveTrustedProxies(os.Getenv("TRUSTED_PROXIES"))
	if err != nil {
		return err
	}
	if usedDefaults {
		log.Print("WARNING: TRUSTED_PROXIES is unset or blank; trusting ONLY loopback proxy addresses. X-Forwarded-For / X-Real-IP are ignored, so ClientIP() returns the direct peer. " +
			"If uter runs behind a reverse proxy (nginx / Caddy / a cloud LB), set TRUSTED_PROXIES to that proxy's IP/CIDR, or TRUSTED_PROXIES=none to trust no proxies at all. " +
			"Note: while unset, IP-based rate limits, token allow_ips, and audit log IPs all see the proxy address instead of the real client.")
	}
	return common.ConfigureTrustedProxies(engine, trustedProxies)
}
