package common

import "testing"

func TestDefaultTrustedProxiesExcludePrivateRanges(t *testing.T) {
	// 不变量：默认可信代理只含回环，绝不含 RFC 1918 / IPv6 ULA。
	//
	// 原因：uter 默认跑在容器 / K8s 里，应用与客户端常同处10.x 网段。
	// 内网网段一旦进白名单，同网段任意请求方构造 X-Forwarded-For 就能
	// 伪造 ClientIP()，进而绕过按 IP 计的登录限流、Token allow_ips 白名单，
	// 并污染审计日志的 ip 字段。
	for _, cidr := range []string{
		"10.0.0.0/8",
		"172.16.0.0/12",
		"192.168.0.0/16",
		"fc00::/7",
	} {
		for _, got := range defaultTrustedProxyCIDRs {
			if got == cidr {
				t.Errorf("defaultTrustedProxyCIDRs 含私网网段 %q，ClientIP() 可被伪造的 X-Forwarded-For 污染", cidr)
			}
		}
	}

	// 回环仍须在内：本地 nginx / 测试 harness 需要它。
	hasLoopbackV4 := false
	for _, got := range defaultTrustedProxyCIDRs {
		if got == "127.0.0.0/8" {
			hasLoopbackV4 = true
		}
	}
	if !hasLoopbackV4 {
		t.Error("defaultTrustedProxyCIDRs 丢了 127.0.0.0/8，本地反代与测试会取不到真实客户端 IP")
	}
}

func TestResolveTrustedProxies(t *testing.T) {
	// 空值 / 空白 → 只信任回环，且标记 usedDefaults 以便上层打告警。
	for _, raw := range []string{"", "   ", "\t"} {
		got, usedDefaults, err := ResolveTrustedProxies(raw)
		if err != nil {
			t.Fatalf("ResolveTrustedProxies(%q) 报错: %v", raw, err)
		}
		if !usedDefaults {
			t.Errorf("ResolveTrustedProxies(%q) usedDefaults = false，调用方不会提示配置缺失", raw)
		}
		if len(got) != len(defaultTrustedProxyCIDRs) {
			t.Errorf("ResolveTrustedProxies(%q) = %v，want %v", raw, got, defaultTrustedProxyCIDRs)
		}
	}

	// none → 不信任任何代理，不打 usedDefaults 告警。
	got, usedDefaults, err := ResolveTrustedProxies("none")
	if err != nil {
		t.Fatalf(`ResolveTrustedProxies("none") 报错: %v`, err)
	}
	if len(got) != 0 || usedDefaults {
		t.Errorf(`ResolveTrustedProxies("none") = %v, %v；want 空且 usedDefaults=false`, got, usedDefaults)
	}

	// 显式配置原样返回并去空白。
	got, usedDefaults, err = ResolveTrustedProxies(" 10.0.0.5 , 192.168.1.1 ")
	if err != nil {
		t.Fatalf("ResolveTrustedProxies 显式配置报错: %v", err)
	}
	if usedDefaults {
		t.Error("显式配置不应标记 usedDefaults")
	}
	if len(got) != 2 || got[0] != "10.0.0.5" || got[1] != "192.168.1.1" {
		t.Errorf("ResolveTrustedProxies = %v，want [10.0.0.5 192.168.1.1]", got)
	}

	// none 不能与别的地址混用，否则语义含糊。
	if _, _, err := ResolveTrustedProxies("none,10.0.0.5"); err == nil {
		t.Error(`ResolveTrustedProxies("none,10.0.0.5") 应报错：none 必须单独使用`)
	}
	// 只有分隔符 = 没配任何地址，应报错而不是静默变成「不信任」。
	if _, _, err := ResolveTrustedProxies(" , , "); err == nil {
		t.Error("ResolveTrustedProxies 仅含分隔符时应报错")
	}
}
