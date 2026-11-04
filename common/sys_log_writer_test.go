package common

import (
	"bytes"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// LogWriter / ErrorLogWriter 必须在每次写入时读当前的 gin writer。
//
// 日志轮转的做法是换掉 gin.DefaultWriter 再关掉旧文件。任何在启动时缓存了
// writer 的中间件（访问日志、panic 恢复）在轮转之后会一直往已关闭的文件句柄
// 写，日志静默消失——这正是要防的回归。
func TestLogWritersFollowGinWriterRotation(t *testing.T) {
	originalOut, originalErr := gin.DefaultWriter, gin.DefaultErrorWriter
	t.Cleanup(func() {
		LogWriterMu.Lock()
		gin.DefaultWriter = originalOut
		gin.DefaultErrorWriter = originalErr
		LogWriterMu.Unlock()
	})

	before := &bytes.Buffer{}
	after := &bytes.Buffer{}

	LogWriterMu.Lock()
	gin.DefaultWriter = before
	LogWriterMu.Unlock()

	_, err := LogWriter.Write([]byte("first\n"))
	require.NoError(t, err)

	// 模拟一次日志轮转：换 writer。间接 writer 应该跟到新目标。
	LogWriterMu.Lock()
	gin.DefaultWriter = after
	LogWriterMu.Unlock()

	_, err = LogWriter.Write([]byte("second\n"))
	require.NoError(t, err)

	assert.Equal(t, "first\n", before.String(), "轮转前的写入应落在旧 writer")
	assert.Equal(t, "second\n", after.String(), "轮转后的写入必须落在新 writer")

	// 错误流走另一条通道，不能串到标准输出。
	errOut := &bytes.Buffer{}
	LogWriterMu.Lock()
	gin.DefaultErrorWriter = errOut
	LogWriterMu.Unlock()

	_, err = ErrorLogWriter.Write([]byte("boom\n"))
	require.NoError(t, err)

	assert.Equal(t, "boom\n", errOut.String())
	assert.Equal(t, "second\n", after.String(), "错误流不应写进标准输出 writer")
}
