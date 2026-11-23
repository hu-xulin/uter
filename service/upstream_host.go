package service

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// MatchesUpstreamHost reports whether raw points at one of the allowed domains
// or a subdomain of them. Matching is done on the parsed hostname so lookalike
// lookalike hosts never match.
func MatchesUpstreamHost(raw string, domains ...string) bool {
	host := upstreamHostname(raw)
	if host == "" {
		return false
	}
	for _, domain := range domains {
		domain = strings.ToLower(strings.TrimSuffix(strings.TrimSpace(domain), "."))
		if domain == "" {
			continue
		}
		if host == domain || strings.HasSuffix(host, "."+domain) {
			return true
		}
	}
	return false
}

// IsUterRouteHost reports whether the channel address belongs to UterRoute.
func IsUterRouteHost(raw string) bool {
	host := UterRouteUpstreamHost()
	if host == "" {
		return false
	}
	return MatchesUpstreamHost(raw, host)
}

// IsBailianHost reports whether the channel address is a DashScope or Model
// Studio endpoint. The bare aliyuncs.com host is deliberately not included: it
// serves no model API and must be normalised to dashscope.aliyuncs.com first.
func IsBailianHost(raw string) bool {
	host := upstreamHostname(raw)
	switch host {
	case "dashscope.aliyuncs.com", "dashscope-intl.aliyuncs.com", "dashscope-us.aliyuncs.com":
		return true
	}
	return strings.HasSuffix(host, ".maas.aliyuncs.com")
}

// manualUpstreamProviderForHost maps well-known vendor hosts to their manual
// pricing capability descriptor. It uses exact-or-subdomain matching so
// lookalike domains never inherit a provider's capabilities.
func manualUpstreamProviderForHost(baseURL string) string {
	switch {
	case MatchesUpstreamHost(baseURL, "openai.com"):
		return "openai"
	case MatchesUpstreamHost(baseURL, "anthropic.com"):
		return "anthropic"
	case MatchesUpstreamHost(baseURL, "generativelanguage.googleapis.com"):
		return "google-gemini"
	case MatchesUpstreamHost(baseURL, "openai.azure.com"):
		return "microsoft-azure"
	case MatchesUpstreamHost(baseURL, "amazonaws.com"):
		return "aws-bedrock"
	case MatchesUpstreamHost(baseURL, "tencentcloudapi.com"):
		return "tencent-hunyuan"
	case MatchesUpstreamHost(baseURL, "volces.com"):
		return "volcengine"
	case MatchesUpstreamHost(baseURL, UterAPIUpstreamHost()):
		return "uterapi"
	default:
		return ""
	}
}

func upstreamHostname(raw string) string {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return ""
	}
	if !strings.Contains(trimmed, "://") {
		trimmed = "https://" + trimmed
	}
	parsed, err := url.Parse(trimmed)
	if err != nil {
		return ""
	}
	return strings.ToLower(strings.TrimSuffix(parsed.Hostname(), "."))
}

// validateUpstreamEndpoint guards every outbound pricing request. Channel base
// URLs are operator input, so a saved value must not be able to reach cloud
// metadata services or use a non-HTTP scheme.
func validateUpstreamEndpoint(raw string) (*url.URL, error) {
	parsed, err := url.Parse(strings.TrimSpace(raw))
	if err != nil {
		return nil, fmt.Errorf("invalid upstream URL: %w", err)
	}
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return nil, errors.New("upstream URL must use http or https")
	}
	if parsed.Host == "" {
		return nil, errors.New("upstream URL has no host")
	}
	if parsed.User != nil {
		return nil, errors.New("upstream URL must not embed credentials")
	}
	if isBlockedUpstreamHost(parsed.Hostname()) {
		// Downstream contracts (and operators) look for "blocked address";
		// keep that wording stable.
		return nil, fmt.Errorf("upstream host %q is a blocked address", parsed.Hostname())
	}
	return parsed, nil
}

// isBlockedUpstreamHost blocks cloud instance-metadata endpoints and addresses
// that cannot be a real upstream. Private ranges stay usable so self-hosted
// gateways on a LAN keep working.
func isBlockedUpstreamHost(host string) bool {
	host = strings.ToLower(strings.TrimSuffix(strings.TrimSpace(host), "."))
	switch host {
	case "", "metadata", "metadata.google.internal", "instance-data", "instance-data.ec2.internal":
		return true
	}
	ip := net.ParseIP(host)
	if ip == nil {
		return false
	}
	if ip.IsUnspecified() || ip.IsMulticast() || ip.IsLinkLocalUnicast() || ip.IsLinkLocalMulticast() {
		return true
	}
	// Alibaba Cloud's metadata service lives in the carrier-grade NAT range.
	if ip.Equal(net.ParseIP("100.100.100.200")) {
		return true
	}
	return false
}

// newUpstreamHTTPClient returns a client for upstream pricing documents. The
// dialer re-checks the resolved addresses (DNS rebinding) and redirects may not
// change the host.
func newUpstreamHTTPClient(timeout time.Duration) *http.Client {
	transport := &http.Transport{
		Proxy:                 http.ProxyFromEnvironment,
		DialContext:           safeUpstreamDialContext,
		TLSHandshakeTimeout:   10 * time.Second,
		ResponseHeaderTimeout: timeout,
	}
	return &http.Client{
		Timeout:   timeout,
		Transport: upstreamGuardTransport{next: transport},
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if len(via) >= 3 {
				return errors.New("too many upstream redirects")
			}
			origin := via[0].URL
			if !strings.EqualFold(
				strings.TrimSuffix(req.URL.Hostname(), "."),
				strings.TrimSuffix(origin.Hostname(), "."),
			) {
				return errors.New("upstream redirect changed host")
			}
			_, err := validateUpstreamEndpoint(req.URL.String())
			return err
		},
	}
}

func safeUpstreamDialContext(ctx context.Context, network, address string) (net.Conn, error) {
	host, _, err := net.SplitHostPort(address)
	if err != nil {
		return nil, err
	}
	resolved, err := net.DefaultResolver.LookupIPAddr(ctx, host)
	if err != nil {
		return nil, err
	}
	for _, candidate := range resolved {
		if isBlockedUpstreamHost(candidate.IP.String()) {
			return nil, fmt.Errorf("upstream host %q resolves to a blocked address", host)
		}
	}
	dialer := &net.Dialer{Timeout: 10 * time.Second}
	return dialer.DialContext(ctx, network, address)
}

// upstreamGuardTransport validates the destination before any proxy or dial
// runs. DialContext alone is not enough: with HTTP_PROXY configured the dialer
// only sees the proxy host, so a metadata IP literal would otherwise bypass the
// guard and hit the network.
type upstreamGuardTransport struct {
	next http.RoundTripper
}

func (t upstreamGuardTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	if req == nil || req.URL == nil {
		return nil, errors.New("upstream request has no URL")
	}
	if _, err := validateUpstreamEndpoint(req.URL.String()); err != nil {
		return nil, err
	}
	return t.next.RoundTrip(req)
}
