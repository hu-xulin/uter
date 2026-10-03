/*
Copyright (C) 2023-2026 Uter.ai

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General License
along with this program. If not, see <https://www.gnu.org/licenses/>.
*/

package controller

import "testing"

// TestNormalizePayClient 锁定网站支付收银台形态的收敛规则：
// 客户端只能传白名单值，任何未知/异常输入一律降级为 pc，
// 避免前端传入任意字符串影响下单接口选择。
func TestNormalizePayClient(t *testing.T) {
	cases := []struct {
		in   string
		want string
	}{
		{"pc", "pc"},
		{"mobile", "mobile"},
		{"Mobile", "mobile"},
		{" MOBILE ", "mobile"},
		{"h5", "mobile"},
		{"wap", "mobile"},
		{"m", "mobile"},
		{"", "pc"},
		{"PC", "pc"},
		{"../../../etc/passwd", "pc"},
		{"android", "pc"},
	}
	for _, c := range cases {
		if got := normalizePayClient(c.in); got != c.want {
			t.Errorf("normalizePayClient(%q) = %q, want %q", c.in, got, c.want)
		}
	}
}

// TestWithH5RedirectUrl 校验微信 H5 中间页链接的 redirect_url 覆盖逻辑。
// 微信规定该链接只允许追加/替换 redirect_url，不得改动其它参数，
// 否则支付无法拉起；解析失败时必须原样返回而不是返回空串。
func TestWithH5RedirectUrl(t *testing.T) {
	h5 := "https://wx.tenpay.com/cgi-bin/mmpayweb-bin/checkmweb?prepay_id=wx1&package=2"
	got := withH5RedirectUrl(h5, "https://uter.cc/wallet?pay=success")

	if got == "" {
		t.Fatal("withH5RedirectUrl must not return an empty URL")
	}
	if got == h5 {
		t.Fatal("redirect_url was not applied")
	}
	// 原有参数必须保留。
	if !containsAll(got, "prepay_id=wx1", "package=2") {
		t.Fatalf("original query params must be preserved, got %q", got)
	}
	// redirect_url 必须存在且经过 URL 编码。
	if !containsAll(got, "redirect_url=https%3A%2F%2Futer.cc%2Fwallet%3Fpay%3Dsuccess") {
		t.Fatalf("redirect_url must be url-encoded, got %q", got)
	}

	// 已存在 redirect_url 时应被覆盖而不是追加第二个。
	existing := "https://wx.tenpay.com/x?redirect_url=old"
	got2 := withH5RedirectUrl(existing, "https://uter.cc/wallet")
	if !containsAll(got2, "redirect_url=https%3A%2F%2Futer.cc%2Fwallet") || containsAll(got2, "old") {
		t.Fatalf("existing redirect_url must be replaced, got %q", got2)
	}

	// 非法 URL 原样返回。
	if got3 := withH5RedirectUrl("://not a url", "x"); got3 != "://not a url" {
		t.Fatalf("invalid URL must be returned as-is, got %q", got3)
	}
}

func containsAll(s string, subs ...string) bool {
	for _, sub := range subs {
		found := false
		for i := 0; i+len(sub) <= len(s); i++ {
			if s[i:i+len(sub)] == sub {
				found = true
				break
			}
		}
		if !found {
			return false
		}
	}
	return true
}
