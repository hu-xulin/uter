package common

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ---------------------------------------------------------------------------
// 监听地址解析
// ---------------------------------------------------------------------------
//
// 这组用例锁死的是「桌面模式下后端只监听回环」这一硬约束。旧实现固定用
// ":"+port（等价于 0.0.0.0），于是桌面形态下带着 Root 权限的后端对局域网
// 完全开放，而 Electron 窗口访问的又是 127.0.0.1——两边地址根本不一致。

func TestListenAddrForcesLoopbackInDesktopMode(t *testing.T) {
	t.Setenv(DesktopModeEnv, "1")
	t.Setenv(ListenHostEnv, "0.0.0.0") // 即使误配成全网卡也不得生效

	host, forced := ResolveListenHost()
	require.True(t, forced, "桌面模式必须强制回环，不得服从 HOST")
	assert.Equal(t, LoopbackHost, host)
	assert.Equal(t, "127.0.0.1:3000", ListenAddr("3000"))
	assert.True(t, IsLoopbackAddr(ListenAddr("3000")), "桌面模式监听地址必须是回环")
}

func TestListenAddrDesktopModeTruthyValues(t *testing.T) {
	for _, v := range []string{"1", "true", "TRUE", "yes", "on", " On "} {
		t.Run(v, func(t *testing.T) {
			t.Setenv(DesktopModeEnv, v)
			t.Setenv(ListenHostEnv, "")
			host, forced := ResolveListenHost()
			assert.True(t, forced, "%q 应被识别为桌面模式", v)
			assert.Equal(t, LoopbackHost, host)
		})
	}
}

func TestListenAddrServerModeDefaultsToWildcard(t *testing.T) {
	t.Setenv(DesktopModeEnv, "")
	t.Setenv(ListenHostEnv, "")

	host, forced := ResolveListenHost()
	assert.False(t, forced, "服务端部署不得被强制成回环")
	assert.Equal(t, WildcardHost, host)
	assert.Equal(t, "0.0.0.0:3000", ListenAddr("3000"))
	assert.False(t, IsLoopbackAddr(ListenAddr("3000")))
}

func TestListenAddrHonorsExplicitHostOnServerDeploy(t *testing.T) {
	t.Setenv(DesktopModeEnv, "0")
	t.Setenv(ListenHostEnv, "192.168.1.20")

	host, forced := ResolveListenHost()
	assert.False(t, forced)
	assert.Equal(t, "192.168.1.20", host)
	assert.Equal(t, "192.168.1.20:8080", ListenAddr("8080"))

	// 服务端也可以显式只听回环，此时算回环
	t.Setenv(ListenHostEnv, "127.0.0.1")
	host, forced = ResolveListenHost()
	assert.True(t, forced, "HOST 显式指向回环时应报告回环")
	assert.Equal(t, "127.0.0.1", host)
}

func TestListenAddrIsIPv6Aware(t *testing.T) {
	assert.True(t, IsLoopbackAddr("[::1]:3000"))
	assert.True(t, IsLoopbackAddr("localhost:3000"))
	assert.False(t, IsLoopbackAddr("0.0.0.0:3000"))
	assert.False(t, IsLoopbackAddr("[2001:db8::1]:3000"))
}

func TestIsDesktopModeDefaultsToFalse(t *testing.T) {
	t.Setenv(DesktopModeEnv, "")
	assert.False(t, IsDesktopMode())
	t.Setenv(DesktopModeEnv, "false")
	assert.False(t, IsDesktopMode())
}
