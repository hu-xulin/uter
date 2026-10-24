package common

import (
	"net"
	"os"
	"strings"
)

// ---------------------------------------------------------------------------
// HTTP 监听地址解析
// ---------------------------------------------------------------------------
//
// 监听地址必须由「部署形态」决定，而不是由默认值顺手决定：
//
//   - 桌面模式（Electron 内嵌后端）：**恒**绑定 127.0.0.1。桌面应用的后端里带着
//     完整的 Root 权限与初始化入口，一旦监听 0.0.0.0，同一局域网内的任何设备都能
//     访问它、并在首次初始化时抢先创建 Root 账户。
//   - 服务端部署：默认绑定 0.0.0.0（容器/云主机必须如此），但支持 HOST 显式覆盖，
//     并在启动日志里明确打印实际绑定地址，避免「以为只听本机、其实全网可达」。
//
// 之所以不让桌面模式服从 HOST：桌面形态没有「远程访问」这个正当用途，允许覆盖
// 等于给这条攻击面留了一个开关；服务端的远程监听则由 HOST 显式开启。

const (
	// DesktopModeEnv 由 Electron 主进程设置，标记当前进程是桌面应用内嵌后端。
	DesktopModeEnv = "UTER_DESKTOP"
	// ListenHostEnv 显式指定监听主机（仅服务端部署生效）。
	ListenHostEnv = "HOST"
	// LoopbackHost 是桌面模式强制使用的监听地址。
	LoopbackHost = "127.0.0.1"
	// WildcardHost 是服务端部署的默认监听地址（全部网卡）。
	WildcardHost = "0.0.0.0"
)

// IsDesktopMode 报告当前进程是否运行在桌面（Electron）形态下。
func IsDesktopMode() bool {
	switch strings.ToLower(strings.TrimSpace(os.Getenv(DesktopModeEnv))) {
	case "1", "true", "yes", "on":
		return true
	default:
		return false
	}
}

// ResolveListenHost 返回 HTTP 服务应绑定的主机地址，以及该地址是否被强制为回环。
//
// forcedLoopback 为 true 表示「无论 HOST 怎么配，都只监听回环」——桌面模式即如此，
// 调用方据此决定是否跳过「Network:」地址的宣传与是否拒绝远程初始化请求。
func ResolveListenHost() (host string, forcedLoopback bool) {
	if IsDesktopMode() {
		return LoopbackHost, true
	}
	if h := strings.TrimSpace(os.Getenv(ListenHostEnv)); h != "" {
		return h, isLoopbackHost(h)
	}
	return WildcardHost, false
}

// ListenAddr 返回 http.Server.Addr 使用的 "host:port" 形式。
//
// 与旧实现（":" + port，等价于 0.0.0.0）的区别在于主机部分总是显式给出，
// 于是「实际绑定了哪个地址」可以被日志、测试与运维直接读到。
func ListenAddr(port string) string {
	host, _ := ResolveListenHost()
	return net.JoinHostPort(host, port)
}

// IsLoopbackAddr 报告 "host:port" 形式地址的主机部分是否为回环地址。
func IsLoopbackAddr(addr string) bool {
	host, _, err := net.SplitHostPort(addr)
	if err != nil {
		host = addr
	}
	return isLoopbackHost(host)
}

func isLoopbackHost(host string) bool {
	trimmed := strings.Trim(strings.TrimSpace(host), "[]")
	if strings.EqualFold(trimmed, "localhost") {
		return true
	}
	ip := net.ParseIP(trimmed)
	return ip != nil && ip.IsLoopback()
}
