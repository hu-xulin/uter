package oauth

import (
	"crypto/tls"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
	"github.com/uter-ai/uter/setting/system_setting"
)

func TestDiscordRedirectURIUsesBrowserOrigin(t *testing.T) {
	previous := system_setting.ServerAddress
	t.Cleanup(func() { system_setting.ServerAddress = previous })
	system_setting.ServerAddress = "https://uter.ai/"

	tests := []struct {
		name           string
		host           string
		forwardedProto string
		tls            bool
		want           string
	}{
		{
			name: "localhost keeps the local origin",
			host: "localhost:3000",
			want: "http://localhost:3000/oauth/discord",
		},
		{
			name: "loopback IP keeps the local origin",
			host: "127.0.0.1:3000",
			want: "http://127.0.0.1:3000/oauth/discord",
		},
		{
			name: "production origin matches server address",
			host: "uter.ai",
			tls:  true,
			want: "https://uter.ai/oauth/discord",
		},
		{
			name:           "proxy forwarded scheme is honored",
			host:           "uter.ai",
			forwardedProto: "https",
			want:           "https://uter.ai/oauth/discord",
		},
		{
			name:           "unknown host falls back to server address",
			host:           "evil.example.com",
			forwardedProto: "https",
			want:           "https://uter.ai/oauth/discord",
		},
	}

	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			context, _ := gin.CreateTestContext(httptest.NewRecorder())
			context.Request = httptest.NewRequest("GET", "http://"+testCase.host+"/api/oauth/discord", nil)
			context.Request.Host = testCase.host
			if testCase.forwardedProto != "" {
				context.Request.Header.Set("X-Forwarded-Proto", testCase.forwardedProto)
			}
			if testCase.tls {
				context.Request.TLS = &tls.ConnectionState{}
			}

			require.Equal(t, testCase.want, discordRedirectURI(context))
		})
	}
}
