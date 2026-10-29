package controller

import (
	"testing"

	"github.com/uter-ai/uter/common"
	"github.com/uter-ai/uter/setting/system_setting"
)

// TestWeChatWebReturnOriginAllowed 验证微信网站应用登录发起 origin 的白名单：
// 只允许站点 ServerAddress、授权回调域与请求 Host 三个来源，且必须是干净的
// https origin——这是回调页跨域跳回主站的信任锚，放任任意 origin 会把一次性
// code/state 转发到外部域（open redirect）。
func TestWeChatWebReturnOriginAllowed(t *testing.T) {
	previousServerAddress := system_setting.ServerAddress
	previousCallbackDomain := common.WeChatWebCallbackDomain
	t.Cleanup(func() {
		system_setting.ServerAddress = previousServerAddress
		common.WeChatWebCallbackDomain = previousCallbackDomain
	})
	system_setting.ServerAddress = "https://uter.ai"
	common.WeChatWebCallbackDomain = "wx.uter.cc"

	const requestHost = "uter.ai:3000"

	tests := []struct {
		name    string
		origin  string
		allowed bool
	}{
		{"main site origin", "https://uter.ai", true},
		{"main site origin with trailing slash", "https://uter.ai/", true},
		{"callback domain origin", "https://wx.uter.cc", true},
		{"request host origin", "https://uter.ai:3000", true},
		{"bare callback domain is not an origin", "wx.uter.cc", false},
		{"foreign domain", "https://evil.example.com", false},
		{"subdomain of callback domain", "https://evil.wx.uter.cc", false},
		{"plain http", "http://uter.ai", false},
		{"origin with path", "https://uter.ai/oauth", false},
		{"origin with query", "https://uter.ai/?x=1", false},
		{"origin with fragment", "https://uter.ai/#f", false},
		{"empty", "", false},
		{"garbage", "::::", false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := wechatWebReturnOriginAllowed(tt.origin, requestHost); got != tt.allowed {
				t.Fatalf("wechatWebReturnOriginAllowed(%q) = %v, want %v", tt.origin, got, tt.allowed)
			}
		})
	}
}

// TestHostFromSiteAddress 覆盖 host 提取对 origin 与裸域名两种形态的支持。
func TestHostFromSiteAddress(t *testing.T) {
	tests := []struct {
		address string
		want    string
	}{
		{"https://uter.ai", "uter.ai"},
		{"https://uter.ai:3000", "uter.ai:3000"},
		{"uter.cc", "uter.cc"},
		{"wx.uter.cc/", "wx.uter.cc"},
		{"", ""},
		{"   ", ""},
	}
	for _, tt := range tests {
		if got := hostFromSiteAddress(tt.address); got != tt.want {
			t.Fatalf("hostFromSiteAddress(%q) = %q, want %q", tt.address, got, tt.want)
		}
	}
}
