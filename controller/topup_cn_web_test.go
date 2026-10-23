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

import (
	"encoding/json"
	"testing"
)

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

// TestBuildAlipayWebPayParams 锁定支付宝「网站支付」两种形态的下单参数。
//
// 站点只签约了「电脑网站支付」与「手机网站支付」两类产品，因此下单方法只能是
// alipay.trade.page.pay（product_code=FAST_INSTANT_TRADE_PAY）或
// alipay.trade.wap.pay（product_code=QUICK_WAP_WAY）。当面付扫码（precreate）
// 与小程序下单（alipay.trade.create）均不在签约范围内，一旦重新出现在
// params["method"] 里，说明签约产品与实际下单不一致，下单必然被支付宝拒绝。
func TestBuildAlipayWebPayParams(t *testing.T) {
	const (
		appId     = "2021000000000000"
		timestamp = "2026-10-23 09:00:00"
		tradeNo   = "USR1NOabcdefgh1234567890"
		amount    = int64(500000)
		payMoney  = 10.0
		notifyUrl = "https://uter.cc/api/user/alipay/notify"
		returnUrl = "https://uter.cc/wallet?pay=success"
		quitUrl   = "https://uter.cc/wallet"
	)

	cases := []struct {
		name            string
		client          string
		wantMethod      string
		wantProductCode string
		wantQuitUrl     bool
	}{
		{"pc", "pc", alipayMethodPagePay, alipayProductCodePC, false},
		{"mobile", "mobile", alipayMethodWapPay, alipayProductCodeMobile, true},
		// 兜底：任何非 "mobile" 的取值都不得落到第三种下单形态。
		{"unknown falls back to pc", "weird", alipayMethodPagePay, alipayProductCodePC, false},
		{"empty falls back to pc", "", alipayMethodPagePay, alipayProductCodePC, false},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			params := buildAlipayWebPayParams(c.client, appId, timestamp, tradeNo, amount, payMoney, notifyUrl, returnUrl, quitUrl)

			if got := params["method"]; got != c.wantMethod {
				t.Errorf("method = %q, want %q", got, c.wantMethod)
			}
			if got := params["app_id"]; got != appId {
				t.Errorf("app_id = %q, want %q", got, appId)
			}
			if got := params["timestamp"]; got != timestamp {
				t.Errorf("timestamp = %q, want %q", got, timestamp)
			}
			if got := params["notify_url"]; got != notifyUrl {
				t.Errorf("notify_url = %q, want %q", got, notifyUrl)
			}
			if got := params["return_url"]; got != returnUrl {
				t.Errorf("return_url = %q, want %q", got, returnUrl)
			}
			if _, signed := params["sign"]; signed {
				t.Error("buildAlipayWebPayParams must not include sign")
			}

			var biz map[string]string
			if err := json.Unmarshal([]byte(params["biz_content"]), &biz); err != nil {
				t.Fatalf("biz_content is not valid JSON: %v (%q)", err, params["biz_content"])
			}
			if got := biz["product_code"]; got != c.wantProductCode {
				t.Errorf("biz_content.product_code = %q, want %q", got, c.wantProductCode)
			}
			if got := biz["out_trade_no"]; got != tradeNo {
				t.Errorf("biz_content.out_trade_no = %q, want %q", got, tradeNo)
			}
			if got := biz["total_amount"]; got != "10.00" {
				t.Errorf("biz_content.total_amount = %q, want %q", got, "10.00")
			}
			if biz["subject"] == "" {
				t.Error("biz_content.subject must not be empty")
			}

			quit, hasQuit := biz["quit_url"]
			if hasQuit != c.wantQuitUrl {
				t.Fatalf("biz_content.quit_url present = %v, want %v", hasQuit, c.wantQuitUrl)
			}
			if c.wantQuitUrl && quit != quitUrl {
				t.Errorf("biz_content.quit_url = %q, want %q", quit, quitUrl)
			}
		})
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
