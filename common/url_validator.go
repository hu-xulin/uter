package common

import (
	"fmt"
	"net"
	"net/url"
	"strings"

	"github.com/uter-ai/uter/constant"
)

// ValidateRedirectURL validates that a redirect URL is safe to use.
// It checks that:
//   - The URL is properly formatted
//   - The scheme is either http or https
//   - The domain is in the trusted domains list (exact match or subdomain)
//
// Returns nil if the URL is valid and trusted, otherwise returns an error
// describing why the validation failed.
func ValidateRedirectURL(rawURL string) error {
	// Parse the URL
	parsedURL, err := url.Parse(rawURL)
	if err != nil {
		return fmt.Errorf("invalid URL format: %s", err.Error())
	}

	if parsedURL.Scheme != "http" && parsedURL.Scheme != "https" {
		return fmt.Errorf("invalid URL scheme: only http and https are allowed")
	}
	// Trusted hostnames do not make cleartext redirects safe. Keep HTTP for
	// explicit local development callbacks only; external redirect destinations
	// must use HTTPS to protect post-checkout URLs and query parameters.
	if parsedURL.Scheme == "http" {
		host := strings.ToLower(strings.TrimSuffix(parsedURL.Hostname(), "."))
		ip := net.ParseIP(host)
		if host != "localhost" && (ip == nil || !ip.IsLoopback()) {
			return fmt.Errorf("redirect URL must use HTTPS except for loopback development addresses")
		}
	}
	if parsedURL.User != nil {
		return fmt.Errorf("redirect URL must not contain user information")
	}
	if parsedURL.Hostname() == "" || parsedURL.Opaque != "" {
		return fmt.Errorf("redirect URL must be an absolute HTTP(S) URL with a hostname")
	}

	domain := strings.ToLower(parsedURL.Hostname())

	for _, trustedDomain := range constant.TrustedRedirectDomains {
		if domain == trustedDomain || strings.HasSuffix(domain, "."+trustedDomain) {
			return nil
		}
	}

	return fmt.Errorf("domain %s is not in the trusted domains list", domain)
}
