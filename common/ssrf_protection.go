package common

import (
	"fmt"
	"net"
	"net/url"
	"slices"
	"strconv"
	"strings"

	"golang.org/x/net/idna"
)

// SSRFProtection SSRF防护配置
type SSRFProtection struct {
	AllowPrivateIp         bool
	DomainFilterMode       bool     // true: 白名单, false: 黑名单
	DomainList             []string // domain format, e.g. example.com, *.example.com
	IpFilterMode           bool     // true: 白名单, false: 黑名单
	IpList                 []string // CIDR or single IP
	AllowedPorts           []int    // 允许的端口范围
	ApplyIPFilterForDomain bool     // 对域名启用IP过滤
}

// DefaultSSRFProtection 默认SSRF防护配置
var DefaultSSRFProtection = &SSRFProtection{
	AllowPrivateIp:   false,
	DomainFilterMode: true,
	DomainList:       []string{},
	IpFilterMode:     true,
	IpList:           []string{},
	AllowedPorts:     []int{},
}

// NewSSRFProtectionFromFetchSetting builds an SSRFProtection from persisted fetch_setting values.
func NewSSRFProtectionFromFetchSetting(allowPrivateIp bool, domainFilterMode bool, ipFilterMode bool, domainList, ipList, allowedPorts []string, applyIPFilterForDomain bool) (*SSRFProtection, error) {
	allowedPortInts, err := parsePortRanges(allowedPorts)
	if err != nil {
		return nil, fmt.Errorf("request reject - invalid port configuration: %v", err)
	}

	return &SSRFProtection{
		AllowPrivateIp:         allowPrivateIp,
		DomainFilterMode:       domainFilterMode,
		DomainList:             domainList,
		IpFilterMode:           ipFilterMode,
		IpList:                 ipList,
		AllowedPorts:           allowedPortInts,
		ApplyIPFilterForDomain: applyIPFilterForDomain,
	}, nil
}

// privateIPv4Nets IPv4 私有/保留/特殊用途网段
// 参考 IANA IPv4 Special-Purpose Address Registry
// https://www.iana.org/assignments/iana-ipv4-special-registry/
var privateIPv4Nets = []net.IPNet{
	{IP: net.IPv4(0, 0, 0, 0), Mask: net.CIDRMask(8, 32)},          // 0.0.0.0/8 ("This network" / 未指定)
	{IP: net.IPv4(10, 0, 0, 0), Mask: net.CIDRMask(8, 32)},         // 10.0.0.0/8 (私有)
	{IP: net.IPv4(100, 64, 0, 0), Mask: net.CIDRMask(10, 32)},      // 100.64.0.0/10 (运营商级 NAT / CGNAT)
	{IP: net.IPv4(127, 0, 0, 0), Mask: net.CIDRMask(8, 32)},        // 127.0.0.0/8 (回环)
	{IP: net.IPv4(169, 254, 0, 0), Mask: net.CIDRMask(16, 32)},     // 169.254.0.0/16 (链路本地)
	{IP: net.IPv4(172, 16, 0, 0), Mask: net.CIDRMask(12, 32)},      // 172.16.0.0/12 (私有)
	{IP: net.IPv4(192, 0, 0, 0), Mask: net.CIDRMask(24, 32)},       // 192.0.0.0/24 (IETF 协议分配)
	{IP: net.IPv4(192, 0, 2, 0), Mask: net.CIDRMask(24, 32)},       // 192.0.2.0/24 (TEST-NET-1)
	{IP: net.IPv4(192, 168, 0, 0), Mask: net.CIDRMask(16, 32)},     // 192.168.0.0/16 (私有)
	{IP: net.IPv4(198, 18, 0, 0), Mask: net.CIDRMask(15, 32)},      // 198.18.0.0/15 (基准测试)
	{IP: net.IPv4(198, 51, 100, 0), Mask: net.CIDRMask(24, 32)},    // 198.51.100.0/24 (TEST-NET-2)
	{IP: net.IPv4(203, 0, 113, 0), Mask: net.CIDRMask(24, 32)},     // 203.0.113.0/24 (TEST-NET-3)
	{IP: net.IPv4(224, 0, 0, 0), Mask: net.CIDRMask(4, 32)},        // 224.0.0.0/4 (组播)
	{IP: net.IPv4(240, 0, 0, 0), Mask: net.CIDRMask(4, 32)},        // 240.0.0.0/4 (保留)
	{IP: net.IPv4(255, 255, 255, 255), Mask: net.CIDRMask(32, 32)}, // 255.255.255.255/32 (受限广播)
}

// privateIPv6Nets IPv6 私有/保留/特殊用途网段
// 参考 IANA IPv6 Special-Purpose Address Registry
// https://www.iana.org/assignments/iana-ipv6-special-registry/
var privateIPv6Nets = func() []net.IPNet {
	cidrs := []string{
		"::/128",         // 未指定地址
		"::1/128",        // 回环
		"::ffff:0:0/96",  // IPv4-mapped
		"2002::/16",      // 6to4（可嵌入 IPv4 内网地址，如 2002:7f00:1:: -> 127.0.0.1）
		"::/96",          // IPv4-compatible（已废弃，::a.b.c.d 可嵌入内网）
		"64:ff9b::/96",   // Well-known IPv4/IPv6 translation prefix
		"64:ff9b:1::/48", // Local-use IPv4/IPv6 translation (RFC 8215); may embed private IPv4
		"100::/64",       // Discard-Only
		"2001::/23",      // IETF Protocol Assignments
		"2001:db8::/32",  // 文档
		"fc00::/7",       // Unique Local Address (ULA)
		"fec0::/10",      // Deprecated IPv6 site-local range; still internal on legacy networks
		"fe80::/10",      // 链路本地
		"ff00::/8",       // 组播
	}
	nets := make([]net.IPNet, 0, len(cidrs))
	for _, c := range cidrs {
		if _, n, err := net.ParseCIDR(c); err == nil && n != nil {
			nets = append(nets, *n)
		}
	}
	return nets
}()

// isPrivateIP 检查IP是否为私有/保留/特殊用途地址
func isPrivateIP(ip net.IP) bool {
	if ip == nil {
		return true
	}
	// 未指定地址 (0.0.0.0, ::)
	if ip.IsUnspecified() {
		return true
	}
	// 回环、链路本地 (unicast/multicast)
	if ip.IsLoopback() || ip.IsLinkLocalUnicast() || ip.IsLinkLocalMulticast() {
		return true
	}
	// 接口本地组播 (IPv6 ff01::/16 等)
	if ip.IsInterfaceLocalMulticast() {
		return true
	}

	if v4 := ip.To4(); v4 != nil {
		for _, privateNet := range privateIPv4Nets {
			if privateNet.Contains(v4) {
				return true
			}
		}
		return false
	}

	// IPv6 检查
	for _, privateNet := range privateIPv6Nets {
		if privateNet.Contains(ip) {
			return true
		}
	}
	// Only interpret IPv4 data in explicitly enumerated transition/tunnel prefixes above.
	// A generic last-32-bit check classifies many ordinary public IPv6 addresses as
	// IPv4 0/8 or private ranges and causes false positives.
	// 兜底: Go 标准库识别的其他私有地址
	if ip.IsPrivate() {
		return true
	}
	return false
}

// parsePortRanges 解析端口范围配置
// 支持格式: "80", "443", "8000-9000"
func parsePortRanges(portConfigs []string) ([]int, error) {
	var ports []int

	for _, config := range portConfigs {
		config = strings.TrimSpace(config)
		if config == "" {
			continue
		}

		if strings.Contains(config, "-") {
			// 处理端口范围 "8000-9000"
			parts := strings.Split(config, "-")
			if len(parts) != 2 {
				return nil, fmt.Errorf("invalid port range format: %s", config)
			}

			startPort, err := strconv.Atoi(strings.TrimSpace(parts[0]))
			if err != nil {
				return nil, fmt.Errorf("invalid start port in range %s: %v", config, err)
			}

			endPort, err := strconv.Atoi(strings.TrimSpace(parts[1]))
			if err != nil {
				return nil, fmt.Errorf("invalid end port in range %s: %v", config, err)
			}

			if startPort > endPort {
				return nil, fmt.Errorf("invalid port range %s: start port cannot be greater than end port", config)
			}

			if startPort < 1 || startPort > 65535 || endPort < 1 || endPort > 65535 {
				return nil, fmt.Errorf("port range %s contains invalid port numbers (must be 1-65535)", config)
			}

			// 添加范围内的所有端口
			for port := startPort; port <= endPort; port++ {
				ports = append(ports, port)
			}
		} else {
			// 处理单个端口 "80"
			port, err := strconv.Atoi(config)
			if err != nil {
				return nil, fmt.Errorf("invalid port number: %s", config)
			}

			if port < 1 || port > 65535 {
				return nil, fmt.Errorf("invalid port number %d (must be 1-65535)", port)
			}

			ports = append(ports, port)
		}
	}

	return ports, nil
}

// isAllowedPort 检查端口是否被允许
func (p *SSRFProtection) isAllowedPort(port int) bool {
	if len(p.AllowedPorts) == 0 {
		return true // 如果没有配置端口限制，则允许所有端口
	}

	return slices.Contains(p.AllowedPorts, port)
}

// isDomainWhitelisted 检查域名是否在白名单中
func normalizeSSRFDomain(domain string) string {
	// A terminal dot is DNS-equivalent to the same absolute name without it.
	// IDNA normalization makes Unicode and Punycode spellings obey the same
	// exact or wildcard domain rules.
	domain = strings.ToLower(strings.TrimSuffix(strings.TrimSpace(domain), "."))
	wildcard := ""
	if after, ok := strings.CutPrefix(domain, "*."); ok {
		wildcard = "*."
		domain = after
	}
	if ascii, err := idna.Lookup.ToASCII(domain); err == nil {
		domain = strings.ToLower(ascii)
	}
	return wildcard + domain
}

func isIPNumberComponent(label string) bool {
	if label == "" {
		return false
	}
	allDecimal := true
	for _, r := range label {
		if r < '0' || r > '9' {
			allDecimal = false
			break
		}
	}
	if allDecimal {
		return true
	}

	lower := strings.ToLower(label)
	base := 0
	switch {
	case strings.HasPrefix(lower, "0x"):
		base, lower = 16, lower[2:]
	case strings.HasPrefix(lower, "0o"):
		base, lower = 8, lower[2:]
	case strings.HasPrefix(lower, "0b"):
		base, lower = 2, lower[2:]
	}
	if base == 0 || lower == "" {
		return false
	}
	for _, r := range lower {
		switch {
		case r >= '0' && r <= '9':
			if int(r-'0') >= base {
				return false
			}
		case r >= 'a' && r <= 'f':
			if base <= 10 || int(r-'a')+10 >= base {
				return false
			}
		default:
			return false
		}
	}
	return true
}

func isNonCanonicalIPLiteral(host string) bool {
	host = strings.TrimSuffix(strings.TrimSpace(host), ".")
	if host == "" {
		return false
	}
	// Some URL parsers and resolver stacks accept alternative IPv4 spellings
	// (e.g. 127.1, 2130706433, 0x7f000001, 0x7f.0.0.1). Go's net.ParseIP
	// intentionally accepts only canonical literals, so never treat a host
	// composed entirely of numeric IP components as an ordinary DNS name.
	for _, label := range strings.Split(host, ".") {
		if !isIPNumberComponent(label) {
			return false
		}
	}
	return true
}

func isDomainListed(domain string, list []string) bool {
	if len(list) == 0 {
		return false
	}

	domain = normalizeSSRFDomain(domain)
	for _, item := range list {
		item = normalizeSSRFDomain(item)
		if item == "" {
			continue
		}
		// Exact match
		if domain == item {
			return true
		}
		// Wildcard match (*.example.com) intentionally requires at least
		// one subdomain label. The apex example.com must be listed explicitly;
		// otherwise a typo/overbroad allowlist entry silently expands access.
		if after, ok := strings.CutPrefix(item, "*."); ok {
			suffix := after
			if strings.HasSuffix(domain, "."+suffix) {
				return true
			}
		}
	}
	return false
}

func (p *SSRFProtection) isDomainAllowed(domain string) bool {
	listed := isDomainListed(domain, p.DomainList)
	if p.DomainFilterMode { // 白名单
		return listed
	}
	// 黑名单
	return !listed
}

// isIPWhitelisted 检查IP是否在白名单中

func isIPListed(ip net.IP, list []string) bool {
	if len(list) == 0 {
		return false
	}

	return IsIpInCIDRList(ip, list)
}

// IsIPAccessAllowed 检查IP是否允许访问
func (p *SSRFProtection) IsIPAccessAllowed(ip net.IP) bool {
	// 私有IP限制
	if isPrivateIP(ip) && !p.AllowPrivateIp {
		return false
	}

	listed := isIPListed(ip, p.IpList)
	if p.IpFilterMode { // 白名单
		return listed
	}
	// 黑名单
	return !listed
}

func (p *SSRFProtection) ipAccessError(host string, ip net.IP) error {
	if host != "" {
		if isPrivateIP(ip) && !p.AllowPrivateIp {
			return fmt.Errorf("private IP address not allowed: %s resolves to %s", host, ip.String())
		}
		if p.IpFilterMode {
			return fmt.Errorf("ip not in whitelist: %s resolves to %s", host, ip.String())
		}
		return fmt.Errorf("ip in blacklist: %s resolves to %s", host, ip.String())
	}

	if isPrivateIP(ip) && !p.AllowPrivateIp {
		return fmt.Errorf("private IP address not allowed: %s", ip.String())
	}
	if p.IpFilterMode {
		return fmt.Errorf("ip not in whitelist: %s", ip.String())
	}
	return fmt.Errorf("ip in blacklist: %s", ip.String())
}

// ValidateNetworkTarget validates the host and port before dialing.
func (p *SSRFProtection) ValidateNetworkTarget(host string, port int) error {
	host = strings.TrimSpace(host)
	if host == "" || strings.HasSuffix(host, "..") {
		return fmt.Errorf("invalid host")
	}
	if port < 1 || port > 65535 {
		return fmt.Errorf("invalid port: %d", port)
	}
	if !p.isAllowedPort(port) {
		return fmt.Errorf("port %d is not allowed", port)
	}

	if strings.Contains(host, "%") {
		// Reject IPv6 zone identifiers and percent-encoded host tricks. Zone
		// identifiers are interface-local and cannot be safely normalized into
		// a globally meaningful network target.
		return fmt.Errorf("IPv6 zone identifiers and percent escapes are not allowed in hosts")
	}
	if ip := net.ParseIP(host); ip != nil {
		if !p.IsIPAccessAllowed(ip) {
			return p.ipAccessError("", ip)
		}
		return nil
	}
	// A trailing dot is valid on DNS names, but can also be used to hide a
	// literal IPv4 address from net.ParseIP (for example, 127.0.0.1.).
	if ip := net.ParseIP(strings.TrimSuffix(host, ".")); ip != nil {
		if !p.IsIPAccessAllowed(ip) {
			return p.ipAccessError("", ip)
		}
		return nil
	}
	if isNonCanonicalIPLiteral(host) {
		return fmt.Errorf("non-canonical IP address literal is not allowed: %s", host)
	}

	if _, err := idna.Lookup.ToASCII(host); err != nil {
		return fmt.Errorf("invalid domain name")
	}
	if !p.isDomainAllowed(host) {
		if p.DomainFilterMode {
			return fmt.Errorf("domain not in whitelist: %s", host)
		}
		return fmt.Errorf("domain in blacklist: %s", host)
	}
	return nil
}

// ValidateResolvedIP validates a domain's resolved IP against private-address and
// configured IP allow/deny rules immediately before dialing it.
func (p *SSRFProtection) ValidateResolvedIP(host string, ip net.IP) error {
	if !p.IsIPAccessAllowed(ip) {
		return p.ipAccessError(host, ip)
	}
	return nil
}

// ValidateResolvedPrivateIP enforces the private/reserved-address guard for a
// domain even when the optional IP allow/deny list is disabled.
func (p *SSRFProtection) ValidateResolvedPrivateIP(host string, ip net.IP) error {
	if isPrivateIP(ip) && !p.AllowPrivateIp {
		return p.ipAccessError(host, ip)
	}
	return nil
}

// ValidateURL 验证URL是否安全
func (p *SSRFProtection) ValidateURL(urlStr string) error {
	// 解析URL
	u, err := url.Parse(urlStr)
	if err != nil {
		return fmt.Errorf("invalid URL format: %v", err)
	}

	// Only absolute HTTP(S) URLs without embedded credentials, opaque forms or
	// fragments are accepted. Userinfo is especially risky in fetch URLs because
	// net/http may turn it into an Authorization header sent to the target host.
	if u.Scheme != "http" && u.Scheme != "https" {
		return fmt.Errorf("unsupported protocol: %s (only http/https allowed)", u.Scheme)
	}
	if u.User != nil {
		return fmt.Errorf("URL must not contain user information")
	}
	if u.Opaque != "" || u.Host == "" || u.Hostname() == "" {
		return fmt.Errorf("URL must be absolute and contain a hostname")
	}
	if u.Fragment != "" {
		return fmt.Errorf("URL fragment is not allowed")
	}

	// 解析主机和端口
	host, portStr, err := net.SplitHostPort(u.Host)
	if err != nil {
		// 没有端口，使用默认端口
		host = u.Hostname()
		if u.Scheme == "https" {
			portStr = "443"
		} else {
			portStr = "80"
		}
	}

	// 验证端口
	port, err := strconv.Atoi(portStr)
	if err != nil {
		return fmt.Errorf("invalid port: %s", portStr)
	}

	if err := p.ValidateNetworkTarget(host, port); err != nil {
		return err
	}

	// Literal IPs were already checked above. If domain IP-list filtering is off,
	// private/reserved IPs must still be rejected unless explicitly allowed.
	if net.ParseIP(host) != nil || (!p.ApplyIPFilterForDomain && p.AllowPrivateIp) {
		return nil
	}

	ips, err := net.LookupIP(host)
	if err != nil {
		return fmt.Errorf("DNS resolution failed for %s: %v", host, err)
	}
	if len(ips) == 0 {
		return fmt.Errorf("DNS resolution returned no addresses for %s", host)
	}
	for _, ip := range ips {
		if p.ApplyIPFilterForDomain {
			err = p.ValidateResolvedIP(host, ip)
		} else {
			err = p.ValidateResolvedPrivateIP(host, ip)
		}
		if err != nil {
			return err
		}
	}
	return nil
}

// ValidateURLWithFetchSetting 使用FetchSetting配置验证URL
func ValidateURLWithFetchSetting(urlStr string, enableSSRFProtection, allowPrivateIp bool, domainFilterMode bool, ipFilterMode bool, domainList, ipList, allowedPorts []string, applyIPFilterForDomain bool) error {
	// 如果SSRF防护被禁用，直接返回成功
	if !enableSSRFProtection {
		return nil
	}

	protection, err := NewSSRFProtectionFromFetchSetting(allowPrivateIp, domainFilterMode, ipFilterMode, domainList, ipList, allowedPorts, applyIPFilterForDomain)
	if err != nil {
		return err
	}
	return protection.ValidateURL(urlStr)
}
