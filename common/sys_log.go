package common

import (
	"fmt"
	"io"
	"net"
	"os"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

// LogWriterMu protects concurrent access to gin.DefaultWriter/gin.DefaultErrorWriter
// during log file rotation. Acquire RLock when reading/writing through the writers,
// acquire Lock when swapping writers and closing old files.
var LogWriterMu sync.RWMutex

// LogWriter 与 ErrorLogWriter 在每次写入时才去读 gin.DefaultWriter /
// gin.DefaultErrorWriter，而不是在启动时把当时的值存下来。
//
// 日志轮转会把这两个 gin Writer 换成新文件、并关闭旧文件。任何在启动时
// 缓存了 writer 的中间件（gin 的访问日志、panic 恢复）在轮转之后就会一直
// 往已关闭的文件句柄写，日志静默丢失。这类中间件必须改用这两个间接 writer。
var (
	LogWriter      io.Writer = currentLogWriter{}
	ErrorLogWriter io.Writer = currentLogWriter{errorStream: true}
)

type currentLogWriter struct {
	errorStream bool
}

func (w currentLogWriter) Write(p []byte) (int, error) {
	LogWriterMu.RLock()
	defer LogWriterMu.RUnlock()
	if w.errorStream {
		return gin.DefaultErrorWriter.Write(p)
	}
	return gin.DefaultWriter.Write(p)
}

func SysLog(s string) {
	t := time.Now()
	LogWriterMu.RLock()
	_, _ = fmt.Fprintf(gin.DefaultWriter, "[SYS] %v | %s \n", t.Format("2006/01/02 - 15:04:05"), s)
	LogWriterMu.RUnlock()
}

func SysError(s string) {
	t := time.Now()
	LogWriterMu.RLock()
	_, _ = fmt.Fprintf(gin.DefaultErrorWriter, "[SYS] %v | %s \n", t.Format("2006/01/02 - 15:04:05"), s)
	LogWriterMu.RUnlock()
}

func FatalLog(v ...any) {
	t := time.Now()
	LogWriterMu.RLock()
	_, _ = fmt.Fprintf(gin.DefaultErrorWriter, "[FATAL] %v | %v \n", t.Format("2006/01/02 - 15:04:05"), v)
	LogWriterMu.RUnlock()
	os.Exit(1)
}

// LogStartupSuccess 打印启动横幅。
//
// listenAddr 是 http.Server 实际使用的 "host:port"。只监听回环时不再宣传
// 「Network: http://<lan-ip>:port」——那会让运维以为服务对局域网开放，也会在
// 桌面形态下把「其实只有本机可达」误报成「全网可达」。
func LogStartupSuccess(startTime time.Time, listenAddr string) {
	duration := time.Since(startTime)
	durationMs := duration.Milliseconds()

	host, port, err := net.SplitHostPort(listenAddr)
	if err != nil {
		host, port = listenAddr, ""
	}
	loopbackOnly := IsLoopbackAddr(listenAddr)

	// Get network IPs（仅在实际对外监听时才需要）
	var networkIps []string
	if !loopbackOnly {
		networkIps = GetNetworkIps()
	}

	LogWriterMu.RLock()
	defer LogWriterMu.RUnlock()

	if SessionCookieSecure == false {
		// Warn when the local HTTP compatibility mode disables cookie transport
		// security and refresh/logout Origin validation.
		fmt.Fprintf(gin.DefaultWriter, "\n")
		fmt.Fprintf(gin.DefaultWriter, "  \033[33m%s\033[0m\n", LogText("Warning: Refresh cookie is not secure and refresh/logout Origin validation is disabled. Please set SESSION_COOKIE_SECURE=true in production."))
		fmt.Fprintf(gin.DefaultWriter, "\n")
	}

	fmt.Fprintf(gin.DefaultWriter, "\n")
	fmt.Fprintf(gin.DefaultWriter, "  \033[32m%s %s\033[0m  %s\n", SystemName, Version, LogText("ready in %d ms", durationMs))
	fmt.Fprintf(gin.DefaultWriter, "\n")

	if loopbackOnly {
		fmt.Fprintf(gin.DefaultWriter, "  ➜  \033[1m%-8s\033[0m http://%s/\n", LogText("Local:"), net.JoinHostPort(host, port))
		fmt.Fprintf(gin.DefaultWriter, "  \033[2m%s\033[0m\n", LogText("bound to loopback only: not reachable from other devices on the network"))
	} else {
		if !IsRunningInContainer() {
			fmt.Fprintf(gin.DefaultWriter, "  ➜  \033[1m%-8s\033[0m http://localhost:%s/\n", LogText("Local:"), port)
		}
		for _, ip := range networkIps {
			fmt.Fprintf(gin.DefaultWriter, "  ➜  \033[1m%-8s\033[0m http://%s:%s/\n", LogText("Network:"), ip, port)
		}
	}

	fmt.Fprintf(gin.DefaultWriter, "\n")
}
