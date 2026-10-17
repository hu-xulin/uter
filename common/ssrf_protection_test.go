package common

import (
	"net"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestSSRFProtectionRejectsLiteralPrivateAndReservedIPs(t *testing.T) {
	protection := &SSRFProtection{
		AllowPrivateIp:   false,
		DomainFilterMode: false,
		IpFilterMode:     false,
	}

	tests := []string{
		"127.0.0.1",
		"10.0.0.1",
		"169.254.169.254",
		"64:ff9b:1::a9fe:a9fe", // RFC 8215 local-use NAT64 embedding 169.254.169.254
		"fc00::1",
		"fec0::1", // Deprecated IPv6 site-local range
		"::ffff:127.0.0.1",
	}
	for _, host := range tests {
		t.Run(host, func(t *testing.T) {
			require.Error(t, protection.ValidateNetworkTarget(host, 80))
		})
	}
}

func TestSSRFProtectionAllowsPrivateIPWhenExplicitlyEnabled(t *testing.T) {
	protection := &SSRFProtection{
		AllowPrivateIp:   true,
		DomainFilterMode: false,
		IpFilterMode:     false,
	}

	require.NoError(t, protection.ValidateNetworkTarget("10.0.0.1", 80))
}

func TestSSRFProtectionRejectsResolvedPrivateIP(t *testing.T) {
	protection := &SSRFProtection{
		AllowPrivateIp:         false,
		DomainFilterMode:       false,
		IpFilterMode:           false,
		ApplyIPFilterForDomain: true,
	}

	require.NoError(t, protection.ValidateNetworkTarget("example.com", 80))
	require.Error(t, protection.ValidateResolvedIP("example.com", net.ParseIP("169.254.169.254")))
}

func TestNewSSRFProtectionFromFetchSettingParsesPortRanges(t *testing.T) {
	protection, err := NewSSRFProtectionFromFetchSetting(false, false, false, nil, nil, []string{"80", "8000-8001"}, true)
	require.NoError(t, err)

	require.NoError(t, protection.ValidateNetworkTarget("example.com", 8001))
	require.Error(t, protection.ValidateNetworkTarget("example.com", 9000))
}


func TestSSRFProtectionRejectsNonCanonicalIPHostForms(t *testing.T) {
	protection := &SSRFProtection{
		AllowPrivateIp:         false,
		DomainFilterMode:       false,
		IpFilterMode:           false,
		ApplyIPFilterForDomain: false,
	}
	for _, host := range []string{
		"127.0.0.1.",
		"127.1",
		"2130706433",
		"0x7f000001",
		"0x7f.0.0.1",
		"0177.0.0.1",
		"fe80::1%lo0",
	} {
		t.Run(host, func(t *testing.T) {
			require.Error(t, protection.ValidateNetworkTarget(host, 80))
		})
	}
}

func TestSSRFProtectionDomainBlacklistNormalizesTrailingDot(t *testing.T) {
	protection := &SSRFProtection{
		AllowPrivateIp:   false,
		DomainFilterMode: false,
		DomainList:       []string{"blocked.example.test", "*.blocked.example.test"},
		IpFilterMode:     false,
		AllowedPorts:     []int{443},
	}
	require.Error(t, protection.ValidateNetworkTarget("blocked.example.test.", 443))
	require.Error(t, protection.ValidateNetworkTarget("child.blocked.example.test.", 443))
	require.NoError(t, protection.ValidateNetworkTarget("allowed.example.test.", 443))
}


func TestSSRFProtectionDomainBlacklistNormalizesIDN(t *testing.T) {
	protection := &SSRFProtection{
		AllowPrivateIp:   false,
		DomainFilterMode: false,
		DomainList:       []string{"bücher.example.test"},
		IpFilterMode:     false,
		AllowedPorts:     []int{443},
	}
	require.Error(t, protection.ValidateNetworkTarget("xn--bcher-kva.example.test", 443))
}

func TestSSRFProtectionRejectsMultipleTrailingDots(t *testing.T) {
	protection := &SSRFProtection{
		AllowPrivateIp:   false,
		DomainFilterMode: false,
		DomainList:       []string{"blocked.example.test"},
		IpFilterMode:     false,
		AllowedPorts:     []int{443},
	}
	require.Error(t, protection.ValidateNetworkTarget("blocked.example.test..", 443))
}


func TestSSRFProtectionAllowsPublicIPv6Addresses(t *testing.T) {
	protection := &SSRFProtection{
		AllowPrivateIp:   false,
		DomainFilterMode: false,
		IpFilterMode:     false,
	}

	for _, host := range []string{
		"2001:4860:4860::8888", // Google Public DNS
		"2606:4700:4700::1111", // Cloudflare DNS
	} {
		t.Run(host, func(t *testing.T) {
			require.NoError(t, protection.ValidateNetworkTarget(host, 443))
		})
	}
}


func TestSSRFProtectionEnforcesPrivateIPWhenDomainIPFilteringDisabled(t *testing.T) {
	protection := &SSRFProtection{
		AllowPrivateIp:         false,
		DomainFilterMode:       false,
		IpFilterMode:           false,
		ApplyIPFilterForDomain: false,
	}
	require.Error(t, protection.ValidateResolvedPrivateIP("internal.example", net.ParseIP("127.0.0.1")))
	require.Error(t, protection.ValidateResolvedPrivateIP("metadata.example", net.ParseIP("169.254.169.254")))
	require.NoError(t, protection.ValidateResolvedPrivateIP("public.example", net.ParseIP("8.8.8.8")))
}


func TestSSRFProtectionRejectsUnsafeURLShapes(t *testing.T) {
	protection := &SSRFProtection{
		AllowPrivateIp:         false,
		DomainFilterMode:       false,
		IpFilterMode:           false,
		ApplyIPFilterForDomain: false,
		AllowedPorts:           []int{80, 443},
	}

	tests := []struct {
		name string
		url  string
	}{
		{name: "userinfo", url: "https://user:password@example.com/resource"},
		{name: "opaque URL", url: "https:opaque-data"},
		{name: "missing host", url: "https:///resource"},
		{name: "fragment", url: "https://example.com/resource#fragment"},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			require.Error(t, protection.ValidateURL(tc.url))
		})
	}
}


func TestSSRFWildcardRequiresSubdomain(t *testing.T) {
	wildcard := []string{"*.example.test"}

	require.False(t, isDomainListed("example.test", wildcard), "wildcard should not include the apex domain")
	require.True(t, isDomainListed("api.example.test", wildcard), "wildcard should include a subdomain")
	require.True(t, isDomainListed("v2.api.example.test", wildcard), "wildcard should include nested subdomains")
	require.False(t, isDomainListed("fakeexample.test", wildcard), "wildcard must not match a suffix lookalike")
	require.False(t, isDomainListed("example.test.evil", wildcard), "wildcard must not match a longer suffix")
}

func TestSSRFWildcardAllowlistDoesNotImplicitlyAllowApex(t *testing.T) {
	protection := &SSRFProtection{
		AllowPrivateIp:   false,
		DomainFilterMode: true,
		DomainList:       []string{"*.example.test"},
		IpFilterMode:     false,
		AllowedPorts:     []int{443},
	}

	require.Error(t, protection.ValidateNetworkTarget("example.test", 443))
	require.NoError(t, protection.ValidateNetworkTarget("api.example.test", 443))
}
