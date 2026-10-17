package middleware

import "testing"

func TestRedactSensitiveAccessLogQuery(t *testing.T) {
	tests := []struct {
		name string
		path string
		want string
	}{
		{
			name: "Epay notification query is redacted",
			path: "/api/user/epay/notify?out_trade_no=order-1&sign=secret&money=1.00",
			want: "/api/user/epay/notify",
		},
		{
			name: "subscription browser return query is redacted",
			path: "/api/subscription/epay/return?trade_no=order-1&sign=secret",
			want: "/api/subscription/epay/return",
		},
		{
			name: "payment webhook query is redacted",
			path: "/api/creem/webhook?secret=should-not-log",
			want: "/api/creem/webhook",
		},
		{
			name: "OAuth callback query remains redacted",
			path: "/api/oauth/github?code=one-time-code&state=secret",
			want: "/api/oauth/github",
		},
		{
			name: "ordinary API query is retained",
			path: "/api/user/models?page=2",
			want: "/api/user/models?page=2",
		},
		{
			name: "path without query is unchanged",
			path: "/api/user/epay/notify",
			want: "/api/user/epay/notify",
		},

		{
			name: "Gemini query API key is redacted while benign filters remain",
			path: "/v1beta/models/gemini-pro:generateContent?key=top-secret&foo=bar",
			want: "/v1beta/models/gemini-pro:generateContent?foo=bar&key=%5BREDACTED%5D",
		},
		{
			name: "API key aliases are redacted case insensitively",
			path: "/api/models?API-Key=secret-one&X_Goog_Api_Key=secret-two&page=3",
			want: "/api/models?API-Key=%5BREDACTED%5D&X_Goog_Api_Key=%5BREDACTED%5D&page=3",
		},
		{
			name: "access tokens and signatures are redacted",
			path: "/api/resource?access_token=secret&signature=proof&page=4",
			want: "/api/resource?access_token=%5BREDACTED%5D&page=4&signature=%5BREDACTED%5D",
		},
		{
			name: "malformed query is discarded fail closed",
			path: "/api/resource?token=%ZZ&page=2",
			want: "/api/resource",
		},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if got := redactSensitiveAccessLogQuery(tc.path); got != tc.want {
				t.Fatalf("redactSensitiveAccessLogQuery(%q) = %q, want %q", tc.path, got, tc.want)
			}
		})
	}
}
