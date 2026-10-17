package oauth

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/setting/system_setting"
)

// newOAuthHTTPClient returns an HTTP client for outbound calls to OAuth provider
// endpoints (token exchange, user info, JWKS, etc.).
//
// It deliberately disables proxy usage because host processes can inherit stale
// local proxy settings. Redirects may be followed only while the scheme, host and
// effective port remain the same: token requests can carry a client secret in the
// body, and user-info requests carry bearer credentials in the Authorization
// header. A cross-origin redirect is returned to the caller instead of replaying
// credentials to a different trust boundary.
func newOAuthHTTPClient(timeout time.Duration) *http.Client {
	transport := http.DefaultTransport.(*http.Transport).Clone()
	// OAuth credentials must never traverse an inherited environment proxy.
	transport.Proxy = nil
	transport.DialContext = oauthProtectedDialContext
	return &http.Client{
		Transport: &oauthProtectedRoundTripper{base: transport},
		Timeout:   timeout,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if req == nil || req.URL == nil || len(via) == 0 || len(via) >= 10 ||
				!sameOAuthOrigin(via[0].URL, req.URL) {
				return http.ErrUseLastResponse
			}
			return nil
		},
	}
}

type oauthProtectedRoundTripper struct {
	base http.RoundTripper
}

func (t *oauthProtectedRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	if req == nil || req.URL == nil {
		return nil, fmt.Errorf("invalid OAuth request URL")
	}
	u := req.URL
	if !u.IsAbs() || (strings.ToLower(u.Scheme) != "http" && strings.ToLower(u.Scheme) != "https") ||
		u.Hostname() == "" || u.User != nil || u.Fragment != "" || u.Opaque != "" {
		return nil, fmt.Errorf("invalid OAuth request URL")
	}
	fetch := system_setting.GetFetchSetting()
	if err := common.ValidateURLWithFetchSetting(
		u.String(),
		fetch.EnableSSRFProtection,
		fetch.AllowPrivateIp,
		fetch.DomainFilterMode,
		fetch.IpFilterMode,
		fetch.DomainList,
		fetch.IpList,
		fetch.AllowedPorts,
		fetch.ApplyIPFilterForDomain,
	); err != nil {
		return nil, fmt.Errorf("OAuth endpoint rejected by SSRF protection: %w", err)
	}
	return t.base.RoundTrip(req)
}

func (t *oauthProtectedRoundTripper) CloseIdleConnections() {
	if closer, ok := t.base.(interface{ CloseIdleConnections() }); ok {
		closer.CloseIdleConnections()
	}
}

// oauthProtectedDialContext repeats target validation immediately before dialing,
// resolves the hostname itself and dials the validated IP directly to prevent DNS
// rebinding between URL validation and the actual connection.
func oauthProtectedDialContext(ctx context.Context, network, address string) (net.Conn, error) {
	fetch := system_setting.GetFetchSetting()
	dialer := &net.Dialer{Timeout: 30 * time.Second, KeepAlive: 30 * time.Second}
	if !fetch.EnableSSRFProtection {
		return dialer.DialContext(ctx, network, address)
	}
	protection, err := common.NewSSRFProtectionFromFetchSetting(
		fetch.AllowPrivateIp, fetch.DomainFilterMode, fetch.IpFilterMode,
		fetch.DomainList, fetch.IpList, fetch.AllowedPorts, fetch.ApplyIPFilterForDomain,
	)
	if err != nil {
		return nil, err
	}
	host, portText, err := net.SplitHostPort(address)
	if err != nil {
		return nil, fmt.Errorf("invalid OAuth dial address: %w", err)
	}
	port, err := strconv.Atoi(portText)
	if err != nil {
		return nil, fmt.Errorf("invalid OAuth dial port: %w", err)
	}
	if err := protection.ValidateNetworkTarget(host, port); err != nil {
		return nil, err
	}
	if ip := net.ParseIP(host); ip != nil {
		return dialer.DialContext(ctx, network, net.JoinHostPort(ip.String(), portText))
	}
	if !protection.ApplyIPFilterForDomain && protection.AllowPrivateIp {
		return dialer.DialContext(ctx, network, address)
	}
	resolved, err := net.DefaultResolver.LookupIPAddr(ctx, host)
	if err != nil {
		return nil, fmt.Errorf("OAuth endpoint DNS resolution failed: %w", err)
	}
	var candidateIPs []net.IP
	for _, item := range resolved {
		ip := item.IP
		if ip == nil || !oauthNetworkAllowsIP(network, ip) {
			continue
		}
		if protection.ApplyIPFilterForDomain {
			err = protection.ValidateResolvedIP(host, ip)
		} else {
			err = protection.ValidateResolvedPrivateIP(host, ip)
		}
		if err != nil {
			return nil, err
		}
		candidateIPs = append(candidateIPs, ip)
	}
	var lastErr error
	for _, ip := range candidateIPs {
		conn, dialErr := dialer.DialContext(ctx, network, net.JoinHostPort(ip.String(), portText))
		if dialErr == nil {
			return conn, nil
		}
		lastErr = dialErr
	}
	if lastErr != nil {
		return nil, lastErr
	}
	return nil, fmt.Errorf("OAuth endpoint DNS resolution returned no usable IP addresses")
}

func oauthNetworkAllowsIP(network string, ip net.IP) bool {
	switch network {
	case "tcp4":
		return ip.To4() != nil
	case "tcp6":
		return ip.To4() == nil
	default:
		return true
	}
}

func sameOAuthOrigin(from, to *url.URL) bool {
	if from == nil || to == nil || from.User != nil || to.User != nil ||
		from.Hostname() == "" || to.Hostname() == "" {
		return false
	}
	fromScheme := strings.ToLower(from.Scheme)
	toScheme := strings.ToLower(to.Scheme)
	if (fromScheme != "http" && fromScheme != "https") || fromScheme != toScheme {
		return false
	}
	normalizeHost := func(host string) string {
		return strings.ToLower(strings.TrimSuffix(host, "."))
	}
	normalizePort := func(u *url.URL) string {
		if port := u.Port(); port != "" {
			return port
		}
		if strings.EqualFold(u.Scheme, "https") {
			return "443"
		}
		return "80"
	}
	return normalizeHost(from.Hostname()) == normalizeHost(to.Hostname()) &&
		normalizePort(from) == normalizePort(to)
}


// maxOAuthResponseBodyBytes bounds data received from OAuth token/user-info
// endpoints. These responses are untrusted network input, even when the
// endpoint itself is configured by an administrator.
const maxOAuthResponseBodyBytes int64 = 2 << 20

// readOAuthResponseBody reads an OAuth response with a strict size limit.
func readOAuthResponseBody(body io.Reader) ([]byte, error) {
	return readOAuthResponseBodyLimit(body, maxOAuthResponseBodyBytes)
}

// readOAuthResponseBodyLimit reads at most maxBytes+1 so an oversized response
// is rejected instead of silently decoding a valid JSON prefix from a truncated
// network body.
func readOAuthResponseBodyLimit(body io.Reader, maxBytes int64) ([]byte, error) {
	if body == nil {
		return nil, fmt.Errorf("OAuth response body is nil")
	}
	if maxBytes <= 0 {
		return nil, fmt.Errorf("OAuth response body limit must be positive")
	}
	data, err := io.ReadAll(io.LimitReader(body, maxBytes+1))
	if err != nil {
		return nil, err
	}
	if int64(len(data)) > maxBytes {
		return nil, fmt.Errorf("OAuth response body exceeds %d bytes", maxBytes)
	}
	return data, nil
}

// decodeOAuthJSON decodes a bounded OAuth JSON response.
func decodeOAuthJSON(body io.Reader, target any) error {
	return decodeOAuthJSONLimit(body, target, maxOAuthResponseBodyBytes)
}

// decodeOAuthJSONLimit decodes a JSON response with an explicit byte ceiling.
func decodeOAuthJSONLimit(body io.Reader, target any, maxBytes int64) error {
	data, err := readOAuthResponseBodyLimit(body, maxBytes)
	if err != nil {
		return err
	}
	return json.NewDecoder(bytes.NewReader(data)).Decode(target)
}
